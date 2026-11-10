import type { Course, Student, PracticeRecord } from '../types'
import { supabase } from '../lib/supabase'

// 数据归属：所有写入都显式带上当前登录用户 UID。
// 数据库侧同时有 `owner_id uuid default auth.uid()` 兜底，双保险。
// 开启 RLS 后，owner_id 不匹配的行会被静默过滤（不报错），所以这里必须可靠。
async function ownerId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

// ---- row mappers ----

function rowToStudent(r: Record<string, unknown>): Student {
  return {
    id: r.id as string,
    name: r.name as string,
    age: r.age as number,
    createdAt: r.created_at as string,
  }
}

function rowToCourse(r: Record<string, unknown>): Course {
  return {
    id: r.id as number,
    studentId: r.student_id as string,
    date: r.date as string,
    teacher: r.teacher as string,
    student: r.student as string,
    topic: r.topic as string,
    duration: r.duration as number,
    rate: r.rate as number,
    good: r.good as string[],
    weak: r.weak as string[],
    reports: r.reports as Course['reports'],
    transcript: r.transcript as string | undefined,
    transcriptTs: r.transcript_ts as string | undefined,
    videoUrl: r.video_url as string | undefined,
    uploadedAt: r.uploaded_at as string | null,
  }
}

// 关键：只写入本次「确实提供」的字段。缺字段时绝不写 null ——
// 否则从列表对象 / 旧数据包触发 upsert 会把数据库里已有的字幕、视频 URL 覆盖清空。
// 数据包(packet.json)用 snake_case 的 transcript_ts，Course 用 camelCase 的
// transcriptTs，两者都兼容，避免网页上传数据包时把字幕写成 null。
function courseToRow(c: Course & { transcript_ts?: string }) {
  const row: Record<string, unknown> = {
    id: c.id,
    student_id: c.studentId,
    date: c.date,
    teacher: c.teacher,
    student: c.student,
    topic: c.topic,
    duration: c.duration,
    rate: c.rate,
    good: c.good,
    weak: c.weak,
    uploaded_at: c.uploadedAt ?? null,
  }
  const transcriptTs = c.transcriptTs ?? c.transcript_ts
  if (c.transcript != null) row.transcript = c.transcript
  if (transcriptTs != null) row.transcript_ts = transcriptTs
  if (c.videoUrl != null) row.video_url = c.videoUrl
  return row
}

function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t = performance.now()
  return fn().then(r => {
    console.log(`[db] ${label} — ${(performance.now() - t).toFixed(0)}ms`)
    return r
  }, e => {
    console.error(`[db] ${label} FAILED — ${(performance.now() - t).toFixed(0)}ms`, e)
    throw e
  })
}

// Supabase 免费项目空闲会被暂停，首次访问需唤醒（耗时 10~20s），
// 期间请求可能连接重置/超时。这里对读操作加重试，让页面在数据库唤醒过程中自动恢复，
// 而不是永久卡在「加载中…」。
async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 4): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      const wait = 1500 * (i + 1)
      console.warn(`[db] ${label} 第${i + 1}次失败，将在 ${wait}ms 后重试…`, e)
      await new Promise(r => setTimeout(r, wait))
    }
  }
  throw lastErr
}

// ---- Students ----

export async function getAllStudents(): Promise<Student[]> {
  return withRetry('getAllStudents', () =>
    timed('getAllStudents', async () => {
      const { data, error } = await supabase.from('students').select('*').order('created_at')
      if (error) throw error
      return (data ?? []).map(rowToStudent)
    })
  )
}

export async function saveStudent(s: Student): Promise<void> {
  const { error } = await supabase.from('students').upsert({
    id: s.id,
    name: s.name,
    age: s.age,
    created_at: s.createdAt,
    owner_id: await ownerId(),
  })
  if (error) throw error
}

export async function deleteStudent(id: string): Promise<void> {
  // cascade set up in DB — deletes courses and practice records automatically
  const { error } = await supabase.from('students').delete().eq('id', id)
  if (error) throw error
}

// ---- Courses ----

export async function getAllCourses(): Promise<Course[]> {
  const { data, error } = await supabase.from('courses').select('*').order('date')
  if (error) throw error
  return (data ?? []).map(rowToCourse)
}

// 列表只拉元数据，不含大字段
export async function getCoursesByStudent(studentId: string): Promise<Course[]> {
  return withRetry(`getCoursesByStudent(${studentId})`, () =>
    timed(`getCoursesByStudent(${studentId})`, async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id,student_id,date,teacher,student,topic,duration,rate,good,weak,uploaded_at')
        .eq('student_id', studentId)
        .order('date')
      if (error) throw error
      return (data ?? []).map(r => ({
        ...rowToCourse({ ...r, reports: { report: '', vocab: '', qa: '', plan: '' }, transcript: undefined, transcript_ts: undefined }),
      }))
    })
  )
}

// 按需加载单课完整数据（含字幕、视频 URL；不含 reports）
// 之前这里既没加重试、又把 error 静默吞成 null，导致 Supabase 暂停/连接重置时
// 详情页静默退回「不含字幕的列表对象」，用户以为字幕被删了。现在与其余读操作
// 一样走 withRetry；仅「确实查无此课」(PGRST116) 返回 null，网络/临时错误抛出重试。
export async function getCourseDetail(id: number): Promise<Course | null> {
  return withRetry(`getCourseDetail(${id})`, () =>
    timed(`getCourseDetail(${id})`, async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id,student_id,date,teacher,student,topic,duration,rate,good,weak,transcript,transcript_ts,video_url,uploaded_at')
        .eq('id', id)
        .single()
      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }
      return rowToCourse({ ...data, reports: { report: '', vocab: '', qa: '', plan: '' } })
    })
  )
}

// 按需加载单个 tab 的报告内容
export async function getCourseReport(courseId: number, tab: string): Promise<string> {
  return timed(`getCourseReport(${courseId}, ${tab})`, async () => {
    const { data, error } = await supabase
      .from('course_reports')
      .select('content')
      .eq('course_id', courseId)
      .eq('tab', tab)
      .single()
    if (error || !data) return ''
    return data.content as string
  })
}

// 查询某课程有哪些 tab 有报告
export async function getCourseReportTabs(courseId: number): Promise<string[]> {
  return timed(`getCourseReportTabs(${courseId})`, async () => {
    const { data, error } = await supabase
      .from('course_reports')
      .select('tab')
      .eq('course_id', courseId)
    if (error || !data) return []
    return data.map((r: { tab: string }) => r.tab)
  })
}

// 一次请求拿所有 tabs 列表 + 默认 report tab 内容
export async function getCourseReportsInit(courseId: number): Promise<{ tabs: string[]; reportHtml: string }> {
  return withRetry(`getCourseReportsInit(${courseId})`, () =>
    timed(`getCourseReportsInit(${courseId})`, async () => {
      const { data, error } = await supabase
        .from('course_reports')
        .select('tab,content')
        .eq('course_id', courseId)
      if (error || !data) return { tabs: [], reportHtml: '' }
      const tabs = data.map((r: { tab: string }) => r.tab)
      const reportRow = data.find((r: { tab: string; content: string }) => r.tab === 'report')
      return { tabs, reportHtml: reportRow?.content ?? '' }
    })
  )
}

// 一次拉取某课程的全部报告（含 notes），供「单课 AI 陪练提示词」生成使用。
// 提示词需要同时用到 report / vocab / qa / plan 四份报告，逐个 tab 请求太慢。
export async function getAllCourseReports(courseId: number): Promise<Record<string, string>> {
  return withRetry(`getAllCourseReports(${courseId})`, () =>
    timed(`getAllCourseReports(${courseId})`, async () => {
      const { data, error } = await supabase
        .from('course_reports')
        .select('tab,content')
        .eq('course_id', courseId)
      if (error) throw error
      const out: Record<string, string> = {}
      for (const r of data ?? []) {
        if (typeof r.tab === 'string' && typeof r.content === 'string') out[r.tab] = r.content
      }
      return out
    })
  )
}

export async function saveCourse(c: Course): Promise<void> {
  const row = courseToRow(c)
  const { reports, ...courseRow } = row as typeof row & { reports?: unknown }
  void reports
  const { error } = await supabase.from('courses').upsert({ ...courseRow, owner_id: await ownerId() })
  if (error) throw error
  // save reports to separate table
  const reportEntries = Object.entries(c.reports ?? {}).filter(([, v]) => v)
  if (reportEntries.length) {
    const { error: re } = await supabase.from('course_reports').upsert(
      reportEntries.map(([tab, content]) => ({ course_id: c.id, tab, content }))
    )
    if (re) throw re
  }
}

// 保存课堂笔记（复用 course_reports 表，tab='notes'，content 为纯文本，可反复编辑）
export async function saveCourseNote(courseId: number, content: string): Promise<void> {
  return timed(`saveCourseNote(${courseId})`, async () => {
    const { error } = await supabase.from('course_reports').upsert({
      course_id: courseId,
      tab: 'notes',
      content,
    })
    if (error) throw error
  })
}

export async function countCourses(): Promise<number> {
  const { count, error } = await supabase.from('courses').select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

// ---- Class videos (Supabase Storage) ----

/** 上传课程视频到公开桶 class-videos，返回公开播放 URL。 */
export async function uploadClassVideo(
  file: Blob,
  path: string,
  contentType = 'video/mp4'
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('class-videos')
    .upload(path, file, { contentType, upsert: true, cacheControl: '31536000' })
  if (error) throw error
  const { data: urlData } = supabase.storage.from('class-videos').getPublicUrl(data.path)
  return urlData.publicUrl
}

/** 把视频 URL 写回 courses 表。 */
export async function saveCourseVideoUrl(courseId: number, videoUrl: string): Promise<void> {
  const { error } = await supabase
    .from('courses')
    .update({ video_url: videoUrl })
    .eq('id', courseId)
  if (error) throw error
}

// ---- Practice ----

export async function savePractice(r: PracticeRecord): Promise<void> {
  const { error } = await supabase.from('practice').upsert({
    ts: r.ts,
    student_id: r.studentId,
    correct: r.correct,
    point: r.point,
    mode: r.mode,
    owner_id: await ownerId(),
  })
  if (error) throw error
}
