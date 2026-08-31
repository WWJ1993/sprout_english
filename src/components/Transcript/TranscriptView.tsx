import { useState, useMemo } from 'react'
import { exportTranscriptSrt, exportTranscriptTxt } from '../../lib/pdfExport'

interface TranscriptLine {
  startMin: number
  startSec: number
  endMin: number
  endSec: number
  text: string
  raw: string
}

function parseTranscript(raw: string): TranscriptLine[] {
  return raw
    .split('\n')
    .map(line => {
      const m = line.match(/^\[(\d+):(\d+)\s*-\s*(\d+):(\d+)\]\s*(.+)$/)
      if (!m) return null
      return {
        startMin: parseInt(m[1]),
        startSec: parseInt(m[2]),
        endMin: parseInt(m[3]),
        endSec: parseInt(m[4]),
        text: m[5].trim(),
        raw: line,
      }
    })
    .filter(Boolean) as TranscriptLine[]
}

function highlight(text: string, query: string) {
  if (!query.trim()) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return parts.map(p =>
    p.toLowerCase() === query.toLowerCase()
      ? `<mark>${p}</mark>`
      : p
  ).join('')
}

interface Props {
  transcriptTs?: string
  transcript?: string
  basename?: string  // 用于下载文件名，如 "2026-08-25-Sonia"
}

export default function TranscriptView({ transcriptTs, transcript, basename = '字幕' }: Props) {
  const [search, setSearch] = useState('')

  const lines = useMemo(
    () => (transcriptTs ? parseTranscript(transcriptTs) : []),
    [transcriptTs]
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return lines
    return lines.filter(l => l.text.toLowerCase().includes(search.toLowerCase()))
  }, [lines, search])

  if (!transcriptTs && !transcript) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
        <span className="text-4xl">🎬</span>
        <p className="text-sm">本课无转录文本（源视频已清理）</p>
      </div>
    )
  }

  // fallback: plain text
  if (!transcriptTs && transcript) {
    return (
      <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-mono max-h-[600px] overflow-y-auto">
        {transcript}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="搜索关键词…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          共 {lines.length} 句{search ? `，匹配 ${filtered.length} 句` : ''}
        </span>
        {transcriptTs && (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => exportTranscriptTxt(transcriptTs, `${basename}.txt`)}
              className="text-xs px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              title="导出时间+字幕 TXT 文件"
            >
              ↓ TXT
            </button>
            <button
              onClick={() => exportTranscriptSrt(transcriptTs, `${basename}.srt`)}
              className="text-xs px-2.5 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
              title="导出 SRT 字幕文件（可导入播放器）"
            >
              ↓ SRT
            </button>
          </div>
        )}
      </div>

      {/* Lines */}
      <div className="max-h-[560px] overflow-y-auto space-y-0 rounded-xl border border-gray-100">
        {filtered.map((line, idx) => {
          const prevLine = filtered[idx - 1]
          const showDivider =
            !search &&
            line.startMin > 0 &&
            line.startMin % 5 === 0 &&
            (!prevLine || prevLine.startMin < line.startMin)

          return (
            <div key={`${line.startMin}-${line.startSec}-${idx}`}>
              {showDivider && (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50 text-xs text-gray-400 border-t border-b border-gray-100">
                  <span className="flex-1 border-t border-dashed border-gray-200" />
                  <span>第 {line.startMin} 分钟</span>
                  <span className="flex-1 border-t border-dashed border-gray-200" />
                </div>
              )}
              <div
                className="flex items-start gap-3 px-4 py-2.5 hover:bg-indigo-50/50 transition-colors border-b border-gray-50 last:border-0 scroll-mt-2"
                id={`ts-${line.startMin}-${line.startSec}`}
              >
                <span className="shrink-0 mt-0.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-indigo-50 text-indigo-500">
                    {String(line.startMin).padStart(2, '0')}:{String(line.startSec).padStart(2, '0')}
                  </span>
                </span>
                <span
                  className="text-sm text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: highlight(line.text, search) }}
                />
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">没有匹配的内容</div>
        )}
      </div>
    </div>
  )
}
