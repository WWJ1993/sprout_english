// ============================================================
// Sprout English — Report rendering from structured block JSON
// Single source of truth. Reused by the React app and (inlined)
// by the skill's local preview. No per-course CSS is stored.
// ============================================================

export type Block =
  | { t: 'heading'; text: string; level?: 2 | 3 }
  | { t: 'stats'; items: { num: string; label: string }[] }
  | { t: 'timeline'; items: { time: string; html: string }[] }
  | { t: 'table'; columns: string[]; rows: string[][]; note?: string }
  | { t: 'prose'; html: string }
  | { t: 'note'; kind: 'grammar' | 'info'; html: string }
  | { t: 'pattern'; title: string; tag?: string; freq?: 'high' | 'mid' | 'low'; formula: string; usage?: string; examples: string[] }
  | { t: 'vocabGroup'; title: string; words: { en: string; cn: string; ex?: string }[] }
  | { t: 'qaGroup'; title: string; items: { n: number; correct?: 'correct' | 'wrong' | 'partial'; lines: { role?: 'teacher' | 'student'; text: string; trans?: string }[] }[] }
  | { t: 'reviewGrid'; cards: { cls: 'must' | 'improve' | 'extend'; title: string; items: string[] }[] }
  | { t: 'practice'; icon?: string; title: string; tag?: string; tip?: string; pairs: { q: string; a: string; alt?: string; cn?: string }[]; dialog?: { scene: string; lines: { who: 'p' | 'l'; text: string; cn?: string }[] }; checklist: string[] }
  | { t: 'divider' }

export type ReportDoc = {
  title: string
  sub?: string
  blocks: Block[]
  footer?: string
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function renderBlock(b: Block): string {
  switch (b.t) {
    case 'heading':
      return `<h${b.level ?? 2}>${esc(b.text)}</h${b.level ?? 2}>`
    case 'stats':
      return `<div class="stats-row">${b.items
        .map(i => `<div class="stat-box"><div class="num">${esc(i.num)}</div><div class="label">${esc(i.label)}</div></div>`)
        .join('')}</div>`
    case 'timeline':
      return `<div class="timeline">${b.items
        .map(i => `<div class="tl-item"><div class="tl-time">${esc(i.time)}</div><div class="tl-text">${i.html}</div></div>`)
        .join('')}</div>`
    case 'table':
      return `<div class="table-wrap"><table><thead><tr>${b.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>` +
        `<tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>` +
        (b.note ? `<p class="example">${esc(b.note)}</p>` : '') + `</div>`
    case 'prose':
      return `<div class="prose">${b.html}</div>`
    case 'note':
      return `<div class="${b.kind === 'grammar' ? 'grammar-note' : 'info-note'}">${b.html}</div>`
    case 'pattern':
      return `<div class="pattern-block tag-${b.tag ?? 'blue'}">` +
        `<div class="pattern-header"><span>${esc(b.title)}</span>` +
        (b.freq ? `<span class="freq freq-${b.freq}">${esc({ high: '高频', mid: '中频', low: '低频' }[b.freq])}</span>` : '') +
        `</div><div class="pattern-body">` +
        `<div class="formula">${esc(b.formula)}</div>` +
        (b.usage ? `<div class="usage">${esc(b.usage)}</div>` : '') +
        `<div class="examples">${b.examples.map(e => `<span class="ex-chip">${e}</span>`).join('')}</div>` +
        `</div></div>`
    case 'vocabGroup':
      return `<div class="chip-grid">${b.words
        .map(w => `<div class="chip"><div class="en">${esc(w.en)}</div><div class="cn">${esc(w.cn)}</div>` +
          (w.ex ? `<div class="ex">${esc(w.ex)}</div>` : '') + `</div>`)
        .join('')}</div>`
    case 'qaGroup':
      return `<div class="qa-group"><h3>${esc(b.title)}</h3>` +
        b.items.map(it => {
          const cls = it.correct ? ` qa-${it.correct}` : ''
          const lines = it.lines.map(l => {
            const bubbleCls = l.role === 'teacher' ? 'teacher' : l.role === 'student' ? 'student' : ''
            const role = l.role ? `<div class="role">${l.role === 'teacher' ? 'Teacher' : 'Mera'}</div>` : ''
            const trans = l.trans ? `<div class="trans">${esc(l.trans)}</div>` : ''
            return `<div class="qa-bubble ${bubbleCls}">${role}<div class="text">${esc(l.text)}</div>${trans}</div>`
          }).join('')
          return `<div class="qa-row${cls}"><div class="qa-num">${it.n}</div>${lines}</div>`
        }).join('') + `</div>`
    case 'reviewGrid':
      return `<div class="review-grid">${b.cards
        .map(c => `<div class="review-card ${c.cls}"><h4>${esc(c.title)}</h4><ul>${c.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`)
        .join('')}</div>`
    case 'practice':
      return `<div class="practice-group">` +
        `<div class="practice-title"><span class="icon">${esc(b.icon ?? '🎯')}</span><span>${esc(b.title)}</span>` +
        (b.tag ? `<span class="tag">${esc(b.tag)}</span>` : '') + `</div>` +
        (b.tip ? `<div class="info-note">${b.tip}</div>` : '') +
        b.pairs.map(p =>
          `<div class="qa-pair"><div class="q"><span class="label">Q</span>${esc(p.q)}` +
          (p.cn ? `<div class="cn">${esc(p.cn)}</div>` : '') + `</div>` +
          `<div class="a"><span class="label">A</span>${esc(p.a)}` +
          (p.alt ? `<div class="alt">${esc(p.alt)}</div>` : '') + `</div></div>`
        ).join('') +
        (b.dialog ? `<div class="dialog-box"><div class="scene">${esc(b.dialog.scene)}</div>` +
          b.dialog.lines.map(l => `<div class="dialog-line"><span class="who ${l.who}">${l.who === 'p' ? '家长' : 'Mera'}：</span>${esc(l.text)}` +
            (l.cn ? ` <span class="cn">${esc(l.cn)}</span>` : '') + `</div>`).join('') + `</div>` : '') +
        (b.checklist.length ? `<div class="daily-checklist"><h4>每日打卡</h4>` +
          b.checklist.map(i => `<div class="item"><div class="checkbox"></div><div>${esc(i)}</div></div>`).join('') + `</div>` : '') +
        `</div>`
    case 'divider':
      return `<div class="divider"></div>`
  }
}

export function renderReport(doc: ReportDoc): string {
  const header = `<div class="header"><h1>${esc(doc.title)}</h1>` +
    (doc.sub ? `<div class="sub">${esc(doc.sub)}</div>` : '') + `</div>`
  const body = doc.blocks.map(renderBlock).join('\n')
  const footer = doc.footer ? `<div class="footer">${esc(doc.footer)}</div>` : ''
  return `<div class="report-body"><div class="container">${header}${body}${footer}</div></div>`
}
