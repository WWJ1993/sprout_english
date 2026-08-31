import { useState, useEffect, useRef } from 'react'
import { useStudent } from '../context/StudentContext'
import { getCoursesByStudent, getCourseDetail, saveCourse } from '../store/db'
import { rateBg } from '../lib/weakness'
import { exportReportPdf, exportTranscriptPdf } from '../lib/pdfExport'
import TranscriptView from '../components/Transcript/TranscriptView'
import type { Course } from '../types'

const TABS = [
  { key: 'report', label: '课程分析', icon: '📘' },
  { key: 'vocab', label: '句式词汇', icon: '🔤' },
  { key: 'qa', label: '问答记录', icon: '💬' },
  { key: 'plan', label: '练习计划', icon: '📝' },
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

function CourseDetail({ course: meta, cache }: { course: Course; cache: Map<number, Course> }) {
  const [course, setCourse] = useState<Course>(() => cache.get(meta.id) ?? meta)
  const [loadingDetail, setLoadingDetail] = useState(() => !cache.has(meta.id))
  const [tab, setTab] = useState<TabKey>('report')
  const [exporting, setExporting] = useState(false)
  const iframeKey = `${course.id}-${tab}`

  useEffect(() => {
    if (cache.has(meta.id)) {
      setCourse(cache.get(meta.id)!)
      setLoadingDetail(false)
      return
    }
    setLoadingDetail(true)
    getCourseDetail(meta.id).then(detail => {
      if (detail) {
        cache.set(meta.id, detail)
        setCourse(detail)
      }
      setLoadingDetail(false)
    })
  }, [meta.id, cache])

  const reports = course.reports || {}
  const hasReport = (key: string) => !!(reports as Record<string, string>)[key]

  async function handleExportPdf() {
    setExporting(true)
    try {
      if (tab === 'transcript') {
        const ts = course.transcriptTs || course.transcript || ''
        if (!ts) return
        await exportTranscriptPdf(ts, `${course.date}-字幕转录.pdf`)
      } else {
        const html = (reports as Record<string, string>)[tab]
        if (!html) return
        const labelMap: Record<string, string> = { report: '课程分析报告', vocab: '句式词汇分析', qa: '问答分析', plan: '三天练习计划' }
        exportReportPdf(html, `${course.date}-${labelMap[tab] || tab}.pdf`)
      }
    } finally {
      setExporting(false)
    }
  }

  const canExport = tab === 'transcript'
    ? !!(course.transcriptTs || course.transcript)
    : hasReport(tab)

  return (
    <div className="flex-1 min-w-0">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-50">
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

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(t => {
            const disabled = t.key !== 'transcript' && !hasReport(t.key)
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

        <div className="p-4">
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
          ) : hasReport(tab) ? (
            <iframe
              key={iframeKey}
              className="report-iframe"
              src={URL.createObjectURL(
                new Blob([(reports as Record<string, string>)[tab]], { type: 'text/html;charset=utf-8' })
              )}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
              <span className="text-4xl">📭</span>
              <p className="text-sm">本课无此报告</p>
            </div>
          )}
        </div>
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
