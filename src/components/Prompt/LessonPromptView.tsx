import { useEffect, useRef, useState } from 'react'
import { getAllCourseReports } from '../../store/db'
import {
  generateLessonPrompt,
  REPORT_KEYS,
  type LessonPromptResult,
  type ReportKey,
} from '../../lib/lessonPromptGen'
import type { Course, Student } from '../../types'

interface Props {
  course: Course
  student: Student | null
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; result: LessonPromptResult }

const TAB_LABEL: Record<ReportKey, string> = {
  report: '课程分析',
  vocab: '句式词汇',
  qa: '问答记录',
  plan: '练习计划',
}

// 剪贴板 API 在非安全上下文 / 无权限时会抛错，必须留 execCommand 兜底。
async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch {
    // 落到下面的兜底路径
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '-1000px'
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand('copy')
  ta.remove()
  if (!ok) throw new Error('浏览器拒绝了复制操作，请手动选中文本复制')
}

export default function LessonPromptView({ course, student }: Props) {
  const [nonce, setNonce] = useState(0)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)

  // 请求标识：输入变化时「渲染期」直接派生 loading，切换课程不会先闪一帧上一节课的提示词。
  // meta 里已含 topic / good / weak / rate / duration，详情请求只补字幕与视频，
  // 因此不必因 course 对象从 meta 换成 detail 而重算（避免多一次数据库往返）。
  const cacheKey = [
    course.id, course.uploadedAt ?? '', student?.id ?? '',
    student?.name ?? '', student?.age ?? '', nonce,
  ].join('|')
  const [loaded, setLoaded] = useState<{ cacheKey: string; value: LoadState } | null>(null)
  const state: LoadState = loaded?.cacheKey === cacheKey ? loaded.value : { status: 'loading' }
  const shownCopyError = loaded?.cacheKey === cacheKey ? copyError : null

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
  }, [])

  useEffect(() => {
    let cancelled = false
    getAllCourseReports(course.id)
      .then(all => {
        if (cancelled) return
        const reports: Partial<Record<ReportKey, string>> = {}
        for (const tabKey of REPORT_KEYS) {
          if (all[tabKey]) reports[tabKey] = all[tabKey]
        }
        setLoaded({
          cacheKey,
          value: { status: 'ready', result: generateLessonPrompt({ course, reports, student }) },
        })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setLoaded({
          cacheKey,
          value: {
            status: 'error',
            message: e instanceof Error ? e.message : '课程报告加载失败，请稍后重试',
          },
        })
      })
    return () => { cancelled = true }
  }, [cacheKey]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCopy() {
    if (state.status !== 'ready') return
    setCopyError(null)
    try {
      await copyText(state.result.prompt)
      setCopied(true)
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : '复制失败，请手动选中文本复制')
    }
  }

  function handleDownload() {
    if (state.status !== 'ready') return
    const blob = new Blob([state.result.prompt], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${course.date}-${course.teacher}-AI陪练提示词.md`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  if (state.status === 'loading') {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
        <span className="animate-spin">⟳</span> 正在读取本课四份报告并生成提示词…
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-sm">
        <p className="text-red-500">❌ {state.message}</p>
        <button
          onClick={() => setNonce(n => n + 1)}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm hover:bg-indigo-700"
        >
          重试
        </button>
      </div>
    )
  }

  const { prompt, source } = state.result
  const badges = [
    `使用报告 ${source.used.length}/4：${source.used.map(k => TAB_LABEL[k]).join('、') || '无'}`,
    `目标句型 ${source.patterns}`,
    `目标词汇 ${source.vocabWords}`,
    `纠错对照 ${source.errorPairs}`,
    `真实错误问答 ${source.qaErrors}`,
    `练习脚本 ${source.practicePairs}`,
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-gray-700">🤖 本课专属 AI 外教陪练提示词</h3>
          <p className="text-xs text-gray-400 mt-1">
            只用 {course.date} 这一节课的真实语料：本节讲的句型词汇 + 课上真实说错的话。复制后粘贴到豆包 / ChatGPT / Claude 即可开练。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ⬇️ 下载 .md
          </button>
          <button
            onClick={handleCopy}
            className={`text-xs font-medium px-4 py-1.5 rounded-lg transition-colors
              ${copied ? 'bg-green-100 text-green-700' : 'bg-indigo-500 text-white hover:bg-indigo-600'}`}
          >
            {copied ? '✅ 已复制' : '📋 一键复制'}
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {badges.map(b => (
          <span key={b} className="text-[11px] text-indigo-700 bg-indigo-50 rounded-full px-2.5 py-1">{b}</span>
        ))}
      </div>

      {source.warnings.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 leading-relaxed">
          <span className="font-semibold">生成依据提示：</span>
          {source.warnings.map((w, i) => <div key={i}>· {w}</div>)}
        </div>
      )}

      {shownCopyError && <p className="text-xs text-red-500">{shownCopyError}</p>}

      <pre className="w-full max-h-[62vh] overflow-auto rounded-xl border border-gray-100 bg-gray-50/70 p-4
        text-xs leading-relaxed text-gray-700 whitespace-pre-wrap break-words font-mono">
        {prompt}
      </pre>

      <p className="text-xs text-gray-400">
        共 {prompt.length} 字符 · 由课程数据确定性生成，不调用 AI 接口；重新上传数据包后内容会自动更新。
      </p>
    </div>
  )
}
