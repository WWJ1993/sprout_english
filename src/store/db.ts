import { createClient } from '@supabase/supabase-js'
import type { Course, Student, PracticeRecord } from '../types'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
)

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
    uploadedAt: r.uploaded_at as string | null,
  }
}

function courseToRow(c: Course) {
  return {
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
    reports: c.reports,
    transcript: c.transcript ?? null,
    transcript_ts: c.transcriptTs ?? null,
    uploaded_at: c.uploadedAt ?? null,
  }
}

// ---- Students ----

export async function getAllStudents(): Promise<Student[]> {
  const { data, error } = await supabase.from('students').select('*').order('created_at')
  if (error) throw error
  return (data ?? []).map(rowToStudent)
}

export async function saveStudent(s: Student): Promise<void> {
  const { error } = await supabase.from('students').upsert({
    id: s.id,
    name: s.name,
    age: s.age,
    created_at: s.createdAt,
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
  const { data, error } = await supabase
    .from('courses')
    .select('id,student_id,date,teacher,student,topic,duration,rate,good,weak,uploaded_at')
    .eq('student_id', studentId)
    .order('date')
  if (error) throw error
  return (data ?? []).map(r => ({
    ...rowToCourse({ ...r, reports: { report: '', vocab: '', qa: '', plan: '' }, transcript: undefined, transcript_ts: undefined }),
  }))
}

// 按需加载单课完整数据（含 reports 和字幕）
export async function getCourseDetail(id: number): Promise<Course | null> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return rowToCourse(data)
}

export async function saveCourse(c: Course): Promise<void> {
  const { error } = await supabase.from('courses').upsert(courseToRow(c))
  if (error) throw error
}

export async function countCourses(): Promise<number> {
  const { count, error } = await supabase.from('courses').select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

// ---- Practice ----

export async function savePractice(r: PracticeRecord): Promise<void> {
  const { error } = await supabase.from('practice').upsert({
    ts: r.ts,
    student_id: r.studentId,
    correct: r.correct,
    point: r.point,
    mode: r.mode,
  })
  if (error) throw error
}
