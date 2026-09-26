import { useState, useEffect, useRef } from 'react'
import { marked } from 'marked'
import { useStudent } from '../context/StudentContext'
import { getCoursesByStudent, getCourseDetail, getCourseReport, getCourseReportsInit, saveCourse, saveCourseNote } from '../store/db'
import { rateBg } from '../lib/weakness'
import { exportReportPdf, exportTranscriptPdf } from '../lib/pdfExport'
import TranscriptView from '../components/Transcript/TranscriptView'
import { renderReport } from '../lib/reportTemplates'
import type { ReportDoc } from '../lib/reportTemplates'
import '../lib/report.css'
import type { Course } from '../types'

const TABS = [
  { key: 'report', label: '课程分析', icon: '📘' },
  { key: 'vocab', label: '句式词汇', icon: '🔤' },
  { key: 'qa', label: '问答记录', icon: '💬' },
  { key: 'plan', label: '练习计划', icon: '📝' },
  { key: 'notes', label: '课堂笔记', icon: '🗒️' },
  { key: 'transcript', label: '字幕', icon: '🎬' },
] as const

type TabKey = typeof TABS[number]['key']

function UploadZone({ onUpload }: { onUpload: (file: File) => void }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div
      className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors
        ${drag ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onUpload(f) }}
    >
      <div className="text-4xl mb-2">⬆️</div>
      <p className="text-sm font-medium text-gray-600">点击或拖拽上传课程数据包</p>
      <p className="text-xs text-gray-400 mt-1">支持 .json 格式数据包（由 claude skill 生成）</p>
      <input ref={inputRef} type="file" accept=".json" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }} />
    </div>
  )
}

const NOTE_TEMPLATE = `## 🌟 今天我学会了

- 新单词：
- 新句型：

## ⚠️ 我容易错的地方

- [ ]
- [ ]

## 🎯 明天我想多练

`

// 图片压缩：最长边 ≤ 900px，转 JPEG（q0.72），返回 dataURL 直接内嵌进 Markdown。
// 过大（>400KB）时降质重试一次，控制单图体积，避免笔记内容膨胀。
async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const maxSide = 900
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  let url = canvas.toDataURL('image/jpeg', 0.72)
  if (url.length > 400_000) url = canvas.toDataURL('image/jpeg', 0.55)
  return url
}

// 课堂笔记：孩子复习完报告后自己写，支持 Markdown，可反复编辑保存
function NotesView({ courseId, initial, onSaved }: { courseId: number; initial: string; onSaved?: () => void }) {
  const [text, setText] = useState(initial)
  const [savedText, setSavedText] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [imgBusy, setImgBusy] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const dirty = text !== savedText

  // 切换课程时重置
  useEffect(() => {
    setText(initial)
    setSavedText(initial)
    setSavedAt(null)
    setError(null)
  }, [courseId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await saveCourseNote(courseId, text)
      setSavedText(text)
      setSavedAt(new Date())
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const empty = !text.trim()

  // 插入图片（粘贴或选图共用）：压缩后在光标处插入 Markdown 图片语法
  async function handleImage(file: File) {
    if (!file.type.startsWith('image/')) return
    setImgBusy(true)
    setError(null)
    try {
      const dataUrl = await compressImage(file)
      const md = `![图片](${dataUrl})\n`
      const ta = textareaRef.current
      if (ta && mode === 'edit') {
        const s = ta.selectionStart ?? text.length
        const e = ta.selectionEnd ?? text.length
        setText(text.slice(0, s) + md + text.slice(e))
        requestAnimationFrame(() => {
          ta.focus()
          ta.selectionStart = ta.selectionEnd = s + md.length
        })
      } else {
        setText(text + (text && !text.endsWith('\n') ? '\n' : '') + md)
      }
    } catch {
      setError('图片处理失败，请换一张试试')
    } finally {
      setImgBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-gray-400">
          复习完上面的报告后，把学到的和容易错的记在这里 ✍️（随时可以修改再保存）
        </p>
        <div className="flex items-center gap-2">
          {/* 编辑 / 预览切换 */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            <button
              onClick={() => setMode('edit')}
              className={`px-2.5 py-1.5 transition-colors ${mode === 'edit' ? 'bg-indigo-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >✏️ 编辑</button>
            <button
              onClick={() => setMode('preview')}
              className={`px-2.5 py-1.5 transition-colors ${mode === 'preview' ? 'bg-indigo-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >👁 预览</button>
          </div>
          {empty && (
            <button
              onClick={() => setText(NOTE_TEMPLATE)}
              className="text-xs text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              ✨ 插入复习模板
            </button>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={imgBusy || mode !== 'edit'}
            title="选择图片（也可以直接在编辑器里粘贴截图）"
            className="text-xs text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors
              disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          >
            {imgBusy ? '⏳ 图片处理中…' : '📎 插图'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleImage(f)
              e.target.value = ''
            }}
          />
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors
              ${dirty && !saving
                ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            {saving ? '保存中…' : dirty ? '💾 保存笔记' : '已保存'}
          </button>
        </div>
      </div>

      {(savedAt || error) && !dirty && (
        <p className={`text-xs ${error ? 'text-red-500' : 'text-green-600'}`}>
          {error ?? `✅ 已保存 ${savedAt!.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}（⌘/Ctrl+S 也可以保存）`}
        </p>
      )}

      {mode === 'edit' ? (
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onPaste={e => {
            const f = [...e.clipboardData.files].find(f => f.type.startsWith('image/'))
            if (f) {
              e.preventDefault()
              handleImage(f)
            }
          }}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
              e.preventDefault()
              if (dirty && !saving) handleSave()
            }
          }}
          placeholder={'复习完写点笔记吧～支持 Markdown，可直接粘贴截图：\n\n## 今天我学会了\n- stork 是鹳\n\n## 我容易错的地方\n- Zebras **are**（不是 is！）\n\n## 明天我想多练\n- [ ] I can 句型'}
          className="w-full min-h-[420px] rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100
            p-4 text-sm leading-relaxed text-gray-700 resize-y outline-none transition-colors font-mono"
          style={{ fontFamily: 'inherit' }}
        />
      ) : (
        <div
          className="md-preview w-full min-h-[420px] rounded-xl border border-gray-100 bg-gray-50/60 p-5 text-sm leading-relaxed text-gray-700"
          dangerouslySetInnerHTML={{ __html: marked.parse(text || '_还没有内容，切回「编辑」写点什么吧～_') }}
        />
      )}

      {dirty && (
        <p className="text-xs text-amber-500">● 有未保存的修改，记得点「保存笔记」</p>
      )}
    </div>
  )
}

// 数据驱动渲染：report/vocab/qa/plan 存的是结构化 block JSON，这里用共享模板渲染。
// 兼容旧版整页 HTML（解析失败则走 iframe 兜底）。
function ReportRenderer({ html }: { html: string }) {
  let doc: ReportDoc | null = null
  try {
    const parsed = JSON.parse(html)
    if (parsed && Array.isArray(parsed.blocks)) doc = parsed as ReportDoc
  } catch {
    doc = null
  }
  if (doc) {
    return <div className="report-body" dangerouslySetInnerHTML={{ __html: renderReport(doc) }} />
  }
  return (
    <iframe
      className="report-iframe"
      src={URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))}
    />
  )
}

function CourseDetail({ course: meta, cache }: { course: Course; cache: Map<number, Course> }) {
  const [course, setCourse] = useState<Course>(() => cache.get(meta.id) ?? meta)
  const [loadingDetail, setLoadingDetail] = useState(() => !cache.has(meta.id))
  const [tab, setTab] = useState<TabKey>('report')
  const [exporting, setExporting] = useState(false)
  const [availableTabs, setAvailableTabs] = useState<string[]>([])
  const [tabContent, setTabContent] = useState<Record<string, string>>({})
  const [loadingTab, setLoadingTab] = useState(false)

  // 加载课程元数据 + 字幕 + 可用 tab 列表 + 默认 report 内容（一次请求）
  useEffect(() => {
    if (!cache.has(meta.id)) {
      setLoadingDetail(true)
      getCourseDetail(meta.id).then(detail => {
        if (detail) { cache.set(meta.id, detail); setCourse(detail) }
        setLoadingDetail(false)
      })
    } else {
      setCourse(cache.get(meta.id)!)
      setLoadingDetail(false)
    }
    setTabContent({})
    setAvailableTabs([])
    setTab('report')
    getCourseReportsInit(meta.id).then(({ tabs, reportHtml }) => {
      setAvailableTabs(tabs)
      if (reportHtml) setTabContent({ report: reportHtml })
    })
  }, [meta.id, cache])

  // 按需加载当前 tab 内容
  useEffect(() => {
    if (tab === 'transcript') return
    if (tabContent[tab] !== undefined) return
    setLoadingTab(true)
    getCourseReport(meta.id, tab).then(content => {
      setTabContent(prev => ({ ...prev, [tab]: content }))
      setLoadingTab(false)
    })
  }, [tab, meta.id, tabContent])

  const hasReport = (key: string) => availableTabs.includes(key)
  const currentHtml = tabContent[tab] ?? ''

  async function handleExportPdf() {
    setExporting(true)
    try {
      if (tab === 'transcript') {
        const ts = course.transcriptTs || course.transcript || ''
        if (!ts) return
        await exportTranscriptPdf(ts, `${course.date}-字幕转录.pdf`)
      } else {
        if (!currentHtml) return
        const labelMap: Record<string, string> = { report: '课程分析报告', vocab: '句式词汇分析', qa: '问答分析', plan: '三天练习计划' }
        exportReportPdf(currentHtml, `${course.date}-${labelMap[tab] || tab}.pdf`)
      }
    } finally {
      setExporting(false)
    }
  }

  const canExport = tab === 'transcript'
    ? !!(course.transcriptTs || course.transcript)
    : tab !== 'notes' && hasReport(tab)

  return (
    <div className="flex-1 min-w-0">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 mb-1 shadow-sm border border-gray-50">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-gray-800">{course.topic}</h2>
            <p className="text-xs text-gray-400 mt-1">
              {course.date} · {course.duration} 分钟 · 老师 {course.teacher} · 学生 {course.student}
            </p>
          </div>
          <span className={`text-lg font-extrabold px-3 py-1 rounded-xl ${rateBg(course.rate)}`}>
            {course.rate}%
          </span>
        </div>

        {/* Good / Weak */}
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <div className="bg-green-50 rounded-xl p-3 border-l-4 border-green-400">
            <h4 className="text-xs font-bold text-green-700 mb-1.5">✅ 亮点</h4>
            <ul className="space-y-1">
              {course.good.map((g, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-1"><span className="text-green-400 mt-0.5">•</span>{g}</li>
              ))}
            </ul>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 border-l-4 border-amber-400">
            <h4 className="text-xs font-bold text-amber-700 mb-1.5">⚠️ 薄弱点</h4>
            <ul className="space-y-1">
              {course.weak.map((w, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-1"><span className="text-amber-400 mt-0.5">•</span>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Tabs —— 吸顶常驻：头部滑出视口后，tab 栏固定在顶栏正下方 */}
      <div className="sticky top-14 z-30 py-2 bg-[#f5f7fa]">
        <div className="bg-white rounded-2xl shadow-md border border-gray-50">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(t => {
            const disabled = t.key !== 'transcript' && t.key !== 'notes' && !hasReport(t.key)
            const hasNote = t.key === 'notes' && availableTabs.includes('notes')
            return (
              <button
                key={t.key}
                disabled={disabled}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2
                  ${tab === t.key
                    ? 'border-indigo-500 text-indigo-700 bg-indigo-50/50'
                    : disabled
                      ? 'border-transparent text-gray-300 cursor-not-allowed'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
              >
                {t.icon} {t.label}
                {hasNote && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="已有笔记" />}
              </button>
            )
          })}
          {/* PDF export button */}
          {canExport && (
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              className="ml-auto mr-3 my-auto text-xs text-gray-400 hover:text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap"
            >
              {exporting ? '导出中…' : '📄 导出 PDF'}
            </button>
          )}
        </div>
        </div>
      </div>

      {/* 内容区 —— 滑动区域，内容从吸顶 tab 栏下方滑过 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-4">
        {loadingDetail ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
              <span className="animate-spin">⟳</span> 加载中…
            </div>
          ) : tab === 'transcript' ? (
            <TranscriptView
              transcriptTs={course.transcriptTs}
              transcript={course.transcript}
              basename={`${course.date}-${course.teacher}`}
            />
          ) : tab === 'notes' ? (
            loadingTab ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
                <span className="animate-spin">⟳</span> 加载笔记…
              </div>
            ) : (
              <NotesView
                courseId={course.id}
                initial={tabContent['notes'] ?? ''}
                onSaved={() => setAvailableTabs(prev => prev.includes('notes') ? prev : [...prev, 'notes'])}
              />
            )
          ) : loadingTab ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
              <span className="animate-spin">⟳</span> 加载报告…
            </div>
          ) : currentHtml ? (
            <ReportRenderer html={currentHtml} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
              <span className="text-4xl">📭</span>
              <p className="text-sm">本课无此报告</p>
            </div>
          )}
        </div>
    </div>
  )
}

export default function Courses() {
  const { currentStudent } = useStudent()
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [uploadStatus, setUploadStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showList, setShowList] = useState(true)
  const detailCache = useRef<Map<number, Course>>(new Map())

  const load = async (studentId: string) => {
    setLoading(true)
    const data = await getCoursesByStudent(studentId)
    setCourses(data)
    if (data.length && !selectedId) setSelectedId(data[data.length - 1].id)
    setLoading(false)
  }

  useEffect(() => {
    if (currentStudent) load(currentStudent.id)
  }, [currentStudent?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpload(file: File) {
    try {
      const text = await file.text()
      let data = JSON.parse(text)
      if (Array.isArray(data)) data = data[0]
      if (!data?.date) throw new Error('数据包格式不符：缺少 date 字段')
      const maxId = courses.reduce((m, c) => Math.max(m, c.id), 0)
      if (!data.id || courses.find(c => c.id === data.id)) data.id = maxId + 1
      data.studentId = currentStudent!.id
      data.uploadedAt = new Date().toISOString()
      await saveCourse(data)
      setUploadStatus({ ok: true, msg: `✅ 上传成功：${data.date} ${data.teacher}` })
      await load(currentStudent!.id)
      setSelectedId(data.id)
      setTimeout(() => setUploadStatus(null), 4000)
    } catch (err: unknown) {
      setUploadStatus({ ok: false, msg: `❌ 上传失败：${err instanceof Error ? err.message : '未知错误'}` })
    }
  }

  const selected = courses.find(c => c.id === selectedId)
  const sorted = [...courses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">加载中…</div>

  return (
    <div className="flex gap-4 items-start">
      {/* Sidebar */}
      <aside className={`${showList ? 'block' : 'hidden'} sm:block w-full sm:w-64 shrink-0`}>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
          {/* Upload */}
          <div className="p-3 border-b border-gray-100">
            <UploadZone onUpload={handleUpload} />
            {uploadStatus && (
              <p className={`mt-2 text-xs ${uploadStatus.ok ? 'text-green-600' : 'text-red-500'}`}>
                {uploadStatus.msg}
              </p>
            )}
          </div>

          {/* List */}
          <div className="p-2">
            <p className="text-xs text-gray-400 px-2 py-1.5">课程列表（{courses.length} 节）</p>
            <div className="space-y-1 max-h-[calc(100vh-340px)] overflow-y-auto">
              {sorted.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedId(c.id); setShowList(false) }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors
                    ${c.id === selectedId
                      ? 'bg-indigo-50 border border-indigo-200'
                      : 'hover:bg-gray-50 border border-transparent'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{c.date}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rateBg(c.rate)}`}>{c.rate}%</span>
                  </div>
                  <p className="text-sm font-medium text-gray-700 mt-0.5 leading-snug line-clamp-2">{c.topic}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{c.teacher}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Detail */}
      {!showList && selected ? (
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setShowList(true)}
            className="sm:hidden mb-3 text-sm text-indigo-600 hover:underline flex items-center gap-1"
          >
            ← 返回列表
          </button>
          <CourseDetail course={selected} cache={detailCache.current} />
        </div>
      ) : (
        <div className="hidden sm:flex flex-1 min-w-0">
          {selected
            ? <CourseDetail course={selected} cache={detailCache.current} />
            : <div className="flex items-center justify-center w-full h-64 text-gray-400 text-sm">选择左侧课程查看</div>
          }
        </div>
      )}
    </div>
  )
}
