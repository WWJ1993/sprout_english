interface TranscriptLine {
  startMin: number; startSec: number
  endMin: number; endSec: number
  text: string
}

function parseLines(raw: string): TranscriptLine[] {
  return raw.split('\n').flatMap(line => {
    const m = line.match(/^\[(\d+):(\d+)\s*-\s*(\d+):(\d+)\]\s*(.+)$/)
    if (!m) return []
    return [{ startMin: +m[1], startSec: +m[2], endMin: +m[3], endSec: +m[4], text: m[5].trim() }]
  })
}

function toTimestamp(min: number, sec: number): string {
  return `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

function toSrtTimestamp(min: number, sec: number, ms = 0): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')},${String(ms).padStart(3,'0')}`
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// 导出 SRT 字幕文件
export function exportTranscriptSrt(transcriptTs: string, filename: string) {
  const lines = parseLines(transcriptTs)
  const srt = lines.map((l, i) =>
    `${i + 1}\n${toSrtTimestamp(l.startMin, l.startSec)} --> ${toSrtTimestamp(l.endMin, l.endSec)}\n${l.text}\n`
  ).join('\n')
  triggerDownload(srt, filename, 'text/srt;charset=utf-8')
}

// 导出纯文本字幕（时间+文本）
export function exportTranscriptTxt(transcriptTs: string, filename: string) {
  const lines = parseLines(transcriptTs)
  const txt = lines.map(l => `[${toTimestamp(l.startMin, l.startSec)}] ${l.text}`).join('\n')
  triggerDownload(txt, filename, 'text/plain;charset=utf-8')
}

// 导出字幕 PDF（文字版，可选中，非截图）
export async function exportTranscriptPdf(transcriptTs: string, filename: string) {
  const { default: jsPDF } = await import('jspdf')
  const lines = parseLines(transcriptTs)
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const marginL = 15, marginR = 15, marginT = 20, marginB = 15
  const maxW = pageW - marginL - marginR
  let y = marginT

  // Title
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text(filename.replace('.pdf', ''), marginL, y)
  y += 8

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(150, 150, 150)
  pdf.text(`共 ${lines.length} 句`, marginL, y)
  y += 8

  pdf.setTextColor(50, 50, 50)

  let lastMarkerMin = -1

  for (const line of lines) {
    // 5-minute divider
    if (line.startMin > 0 && line.startMin % 5 === 0 && line.startMin !== lastMarkerMin) {
      lastMarkerMin = line.startMin
      if (y > pageH - marginB - 6) { pdf.addPage(); y = marginT }
      pdf.setDrawColor(200, 200, 200)
      pdf.setLineDashPattern([2, 2], 0)
      pdf.line(marginL, y, pageW - marginR, y)
      pdf.setFontSize(8)
      pdf.setTextColor(180, 180, 180)
      pdf.text(`— ${line.startMin} 分钟 —`, pageW / 2, y + 3, { align: 'center' })
      pdf.setLineDashPattern([], 0)
      y += 7
      pdf.setTextColor(50, 50, 50)
    }

    const timeTag = toTimestamp(line.startMin, line.startSec)
    const textLines = pdf.splitTextToSize(line.text, maxW - 16)
    const rowH = textLines.length * 5 + 3

    if (y + rowH > pageH - marginB) { pdf.addPage(); y = marginT }

    // Time badge
    pdf.setFontSize(8)
    pdf.setFont('courier', 'normal')
    pdf.setTextColor(99, 102, 241)
    pdf.text(timeTag, marginL, y + 4)

    // Text
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(50, 50, 50)
    textLines.forEach((tl: string, i: number) => {
      pdf.text(tl, marginL + 16, y + 4 + i * 5)
    })

    y += rowH
  }

  pdf.save(filename)
}

// 把带时间戳的转录文本转成可打印的 HTML（仅用于其他报告类型）
export function transcriptToHtml(transcriptTs: string, title: string): string {
  const lines = transcriptTs.split('\n')
  let lastMarker = -1
  const rows = lines.map(line => {
    const m = line.match(/^\[(\d+):(\d+)\s*-\s*(\d+):(\d+)\]\s*(.+)$/)
    if (!m) return ''
    const startMin = parseInt(m[1])
    const startSec = parseInt(m[2])
    let marker = ''
    if (startMin > 0 && startMin % 5 === 0 && startMin !== lastMarker) {
      lastMarker = startMin
      marker = `<div style="text-align:center;color:#9ca3af;font-size:11px;padding:6px 0;border-top:1px dashed #e5e7eb;margin:4px 0">— 第 ${startMin} 分钟 —</div>`
    }
    const time = `${String(startMin).padStart(2,'0')}:${String(startSec).padStart(2,'0')}`
    return `${marker}<div style="display:flex;gap:10px;padding:4px 0;border-bottom:1px solid #f3f4f6">
      <span style="flex-shrink:0;background:#eef2ff;color:#6366f1;font-size:11px;font-family:monospace;padding:1px 6px;border-radius:20px;height:fit-content;margin-top:2px">${time}</span>
      <span style="font-size:13px;color:#374151;line-height:1.6">${m[5]}</span>
    </div>`
  }).join('')
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
  <style>body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;background:#f9fafb;padding:24px;color:#2c3e50}
  h1{font-size:18px;font-weight:700;color:#1f2937;margin-bottom:4px}
  .sub{font-size:12px;color:#9ca3af;margin-bottom:16px}
  .container{background:white;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.05)}</style>
  </head><body>
  <h1>🎬 ${title} · 字幕转录</h1>
  <div class="sub">共 ${lines.filter(l => /^\[/.test(l)).length} 句</div>
  <div class="container">${rows}</div>
  </body></html>`
}

export function exportReportPdf(htmlContent: string, filename: string): void {
  const win = window.open('', '_blank')
  if (!win) return
  // 注入打印触发脚本和文件名提示
  const printable = htmlContent.replace(
    '</head>',
    `<style>@media print{}</style>
    <script>
      document.title = ${JSON.stringify(filename.replace('.pdf', ''))};
      window.onload = function() { window.print(); };
    <\/script>
    </head>`
  )
  win.document.open()
  win.document.write(printable)
  win.document.close()
}
