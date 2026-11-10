import type { Course, Student } from '../types'
import type { Block, ReportDoc } from './reportTemplates'

// ============================================================
// 单课 AI 外教陪练提示词生成器
//
// 与 lib/promptGen.ts 的区别：
//   promptGen.ts        —— 学生维度，聚合「最近 N 节课」的高频薄弱点，生成长期智能体人设
//   lessonPromptGen.ts  —— 课程维度，只用「这一节课」的真实语料，生成单次陪练提示词
//
// 数据来源是 english-class-analyzer 产出的结构化 block JSON（ReportDoc）。
// 纯确定性拼装：不调用任何 LLM、不需要 API Key、离线可用、同一节课结果稳定可复现。
// ============================================================

export type ReportKey = 'report' | 'vocab' | 'qa' | 'plan'

export const REPORT_KEYS: ReportKey[] = ['report', 'vocab', 'qa', 'plan']

const REPORT_LABEL: Record<ReportKey, string> = {
  report: '课程分析',
  vocab: '句式词汇',
  qa: '问答记录',
  plan: '练习计划',
}

const LIMITS = {
  patterns: 8,
  vocabGroups: 6,
  wordsPerGroup: 8,
  errorPairs: 10,
  qaErrors: 4,
  good: 3,
  weak: 6,
  practiceDays: 3,
  pairsPerDay: 2,
  checklist: 6,
} as const

export interface LessonPromptInput {
  course: Course
  /** 各 tab 的原始内容（结构化 block JSON 字符串）。缺失时自动降级。 */
  reports: Partial<Record<ReportKey, string>>
  /** 当前学生，用于姓名与年龄；缺省时回退到 course.student。 */
  student?: Pick<Student, 'name' | 'age'> | null
}

export interface LessonPromptSource {
  /** 实际用上的报告 */
  used: ReportKey[]
  patterns: number
  vocabWords: number
  errorPairs: number
  qaErrors: number
  practicePairs: number
  checklistItems: number
  /** 降级/容错说明，UI 可展示，便于判断提示词质量 */
  warnings: string[]
}

export interface LessonPromptResult {
  prompt: string
  source: LessonPromptSource
}

interface ErrorPair {
  point: string
  wrong: string
  correct: string
  tip: string
}

interface PatternItem {
  title: string
  formula: string
  example: string
}

interface VocabGroupItem {
  title: string
  words: string[]
}

interface QaErrorItem {
  q: string
  a: string
}

interface PracticePairItem {
  day: string
  q: string
  a: string
}

// ---- 基础工具 ----

function parseDoc(raw: string | undefined): ReportDoc | null {
  if (!raw || !raw.trim()) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as ReportDoc).blocks)) {
      return parsed as ReportDoc
    }
  } catch {
    // 旧版整页 HTML / 课堂笔记等纯文本，不是结构化报告
  }
  return null
}

/** 报告块里允许内嵌简单 HTML（<b>/<span>/<br>），提示词里要还原成纯文本。 */
function stripHtml(input: string): string {
  if (!input) return ''
  return input
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Markdown 表格单元格：竖线会破坏表格结构，必须转义。 */
function cell(input: string): string {
  return stripHtml(input).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function blocksOf(doc: ReportDoc | undefined, type: Block['t']): Block[] {
  if (!doc) return []
  return doc.blocks.filter(b => b.t === type)
}

// ---- 结构化素材抽取 ----

/**
 * 纠错对照表。四节课的表头并不统一，例如：
 *   ['难点','错误用法（课中）','正确形式','记忆点']
 *   ['难点','课中现象','规范形式','建议']
 *   ['想表达','课中正确形式','课中误说','要点']
 * 因此按「列名的语义」定位列，而不是按列下标；不匹配的表（如单复数变化规则表）自动跳过。
 */
const COL_CORRECT = /正确形式|规范形式|课中正确|正确说法/
const COL_WRONG = /误说|错误用法|课中现象|错误形式|课中误用/
const COL_TIP = /要点|记忆点|建议|提示|说明/
const COL_LABEL = /难点|想表达|场景|语法点|知识点/

function extractErrorPairs(docs: Partial<Record<ReportKey, ReportDoc>>): ErrorPair[] {
  const out: ErrorPair[] = []
  const seen = new Set<string>()

  for (const key of REPORT_KEYS) {
    const doc = docs[key]
    if (!doc) continue
    for (const b of blocksOf(doc, 'table')) {
      if (b.t !== 'table') continue
      const ci = b.columns.findIndex(c => COL_CORRECT.test(c))
      const wi = b.columns.findIndex(c => COL_WRONG.test(c))
      if (ci < 0 || wi < 0 || ci === wi) continue
      const ti = b.columns.findIndex(c => COL_TIP.test(c))
      const li = b.columns.findIndex(c => COL_LABEL.test(c))

      for (const row of b.rows) {
        const correct = stripHtml(row[ci] ?? '')
        const wrong = stripHtml(row[wi] ?? '')
        if (!correct || !wrong || correct === wrong) continue
        // 源表格里偶尔混入「已对 / ✓」这类正确示范行，不是错误语料，剔除
        if (/已对|正确示范|^✓/.test(wrong) || correct.includes('✓')) continue
        // 同一组「误说 → 正确形式」可能重复出现在多张表中，按组合去重
        const dedupeKey = `${correct}|${wrong}`.toLowerCase().replace(/[^a-z0-9 |]/g, '').trim()
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)
        out.push({
          point: li >= 0 ? stripHtml(row[li] ?? '') : '',
          wrong,
          correct,
          tip: ti >= 0 ? stripHtml(row[ti] ?? '') : '',
        })
      }
    }
  }
  return out.slice(0, LIMITS.errorPairs)
}

function extractPatterns(doc: ReportDoc | undefined): PatternItem[] {
  if (!doc) return []
  const out: PatternItem[] = []
  for (const b of doc.blocks) {
    if (b.t !== 'pattern') continue
    out.push({
      title: stripHtml(b.title),
      formula: stripHtml(b.formula),
      example: stripHtml(b.examples?.[0] ?? ''),
    })
    if (out.length >= LIMITS.patterns) break
  }
  return out
}

function extractVocab(doc: ReportDoc | undefined): VocabGroupItem[] {
  if (!doc) return []
  const out: VocabGroupItem[] = []
  for (const b of doc.blocks) {
    if (b.t !== 'vocabGroup') continue
    const words = b.words
      .map(w => stripHtml(w.en))
      .filter(Boolean)
      .slice(0, LIMITS.wordsPerGroup)
    if (words.length) out.push({ title: stripHtml(b.title), words })
    if (out.length >= LIMITS.vocabGroups) break
  }
  return out
}

/** 复习速查卡：must=已掌握（热身素材），improve=待巩固（优先级提示）。 */
function extractReview(docs: Partial<Record<ReportKey, ReportDoc>>): { must: string[]; improve: string[] } {
  const must: string[] = []
  const improve: string[] = []
  const seen = new Set<string>()
  const push = (arr: string[], text: string) => {
    const t = stripHtml(text)
    if (!t || seen.has(t)) return
    seen.add(t)
    arr.push(t)
  }
  // 只取「课程分析」里的三档复习卡：句式词汇报告另有一张速查卡，语义高度重复，
  // 全部合并会让提示词出现同义条目堆叠，反而稀释重点。
  const doc = docs.report
  if (doc) {
    for (const b of doc.blocks) {
      if (b.t !== 'reviewGrid') continue
      for (const c of b.cards) {
        for (const item of c.items) {
          if (c.cls === 'must') push(must, item)
          else if (c.cls === 'improve') push(improve, item)
        }
      }
    }
  }
  return { must: must.slice(0, LIMITS.good), improve: improve.slice(0, 4) }
}

/** 课堂真实错误问答：优先取「有纠正过程」的（学生答案里带 →）。 */
function extractQaErrors(doc: ReportDoc | undefined): QaErrorItem[] {
  if (!doc) return []
  const items: { q: string; a: string; hasFix: boolean }[] = []
  for (const b of doc.blocks) {
    if (b.t !== 'qaGroup') continue
    for (const it of b.items) {
      if (!it.correct || it.correct === 'correct') continue
      const q = stripHtml(it.lines.find(l => l.role === 'teacher')?.text ?? '')
      const a = stripHtml(it.lines.find(l => l.role === 'student')?.text ?? '')
      if (!q && !a) continue
      items.push({ q, a, hasFix: a.includes('→') || a.includes('->') })
    }
  }
  items.sort((x, y) => Number(y.hasFix) - Number(x.hasFix))
  return items.slice(0, LIMITS.qaErrors)
}

/** 三天练习计划：每天取前 2 组问答，保证覆盖三天而不是全挤在 Day1。 */
function extractPractice(doc: ReportDoc | undefined): { pairs: PracticePairItem[]; checklist: string[]; days: string[] } {
  if (!doc) return { pairs: [], checklist: [], days: [] }
  const pairs: PracticePairItem[] = []
  const checklist: string[] = []
  const days: string[] = []
  let dayCount = 0
  for (const b of doc.blocks) {
    if (b.t !== 'practice' || dayCount >= LIMITS.practiceDays) continue
    dayCount++
    const day = stripHtml(b.title)
    days.push(day)
    for (const p of b.pairs.slice(0, LIMITS.pairsPerDay)) {
      pairs.push({ day, q: stripHtml(p.q), a: stripHtml(p.a) })
    }
    for (const c of b.checklist) {
      if (checklist.length < LIMITS.checklist) checklist.push(stripHtml(c))
    }
  }
  return { pairs, checklist, days }
}

// ---- 提示词拼装 ----

function buildPrompt(args: {
  name: string
  age: number | null
  course: Course
  patterns: PatternItem[]
  vocab: VocabGroupItem[]
  errorPairs: ErrorPair[]
  review: { must: string[]; improve: string[] }
  qaErrors: QaErrorItem[]
  practice: { pairs: PracticePairItem[]; checklist: string[] }
}): string {
  const { name, age, course, patterns, vocab, errorPairs, review, qaErrors, practice } = args
  const ageText = age ? `${age} 岁` : ''
  const lines: string[] = []

  lines.push(`# AI 外教陪练提示词 · ${course.date} 单课定制`)
  lines.push('')
  lines.push(`> 课程：${course.date} · 外教 ${course.teacher} · ${course.topic}`)
  lines.push(`> 学生：${name}${ageText ? `（${ageText}）` : ''} · 课堂综合正确率 ${course.rate}% · ${course.duration} 分钟`)
  lines.push('> 用法：复制以下全部内容，粘贴到豆包 / ChatGPT / Claude 的自定义指令或新对话第一条消息。单次陪练 10–15 分钟。')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 1. 你是谁')
  lines.push('')
  lines.push(`你是 Buddy，${name}${ageText ? `（${ageText}的中国孩子）` : ''}的英语外教陪练伙伴。今天只陪练下面这一节课的内容。`)
  lines.push('')
  lines.push('- 全程以英语为主；只有孩子明显听不懂时，才用一句中文点一下，然后立刻回到英语')
  lines.push('- 每次回复 2–4 句，句子短、语速慢，多给鼓励')
  lines.push('- 你是聊天的小伙伴，不是考官：不打分、不考试、不向孩子罗列知识点清单')
  lines.push('')

  lines.push('## 2. 今天这节课讲了什么（只在这些内容里出题）')
  lines.push('')
  if (patterns.length) {
    lines.push('### 本节目标句型')
    lines.push('')
    patterns.forEach((p, i) => {
      lines.push(`${i + 1}. **${p.title}**：\`${p.formula}\``)
      if (p.example) lines.push(`   课上原句：${p.example}`)
    })
    lines.push('')
  }
  if (vocab.length) {
    lines.push('### 本节目标词汇')
    lines.push('')
    vocab.forEach(g => lines.push(`- ${g.title}：${g.words.join(' / ')}`))
    lines.push('')
  }
  const mastered = review.must.length ? review.must : course.good.slice(0, LIMITS.good)
  if (mastered.length) {
    lines.push('### 孩子这节课已经掌握得很好（只用来热身开口，不要再教一遍）')
    lines.push('')
    mastered.forEach(g => lines.push(`- ${stripHtml(g)}`))
    lines.push('')
  }

  lines.push('## 3. 孩子这节课真实的错误（本提示词的核心，优先级最高）')
  lines.push('')
  lines.push('下面是孩子课上真实说错的话。不要泛泛讲语法规则，要围绕这些句子设计提问，让孩子自己说出正确版本。')
  lines.push('')
  lines.push('**重要**：左列错误句只用于你识别问题，绝不要在对话里复述、朗读或示范这些错误句；你嘴里只能出现右列的正确句子。')
  lines.push('')
  if (errorPairs.length) {
    lines.push('| # | 孩子课上说的（仅供识别） | 请引导孩子说成 | 要点 |')
    lines.push('| --- | --- | --- | --- |')
    errorPairs.forEach((e, i) => {
      const note = [e.point, e.tip].filter(Boolean).filter((v, idx, arr) => arr.indexOf(v) === idx).join(' · ')
      lines.push(`| ${i + 1} | ${cell(e.wrong)} | ${cell(e.correct)} | ${cell(note)} |`)
    })
    lines.push('')
  }
  const weakPoints = course.weak.slice(0, LIMITS.weak)
  if (weakPoints.length) {
    lines.push('**薄弱点归纳（按优先级练，一次只挑 1–2 条）：**')
    lines.push('')
    weakPoints.forEach((w, i) => lines.push(`${i + 1}. ${stripHtml(w)}`))
    lines.push('')
  }
  if (review.improve.length) {
    lines.push('**报告里标注的「待巩固」项：**')
    lines.push('')
    review.improve.forEach(i => lines.push(`- ${i}`))
    lines.push('')
  }
  if (qaErrors.length) {
    lines.push('**课堂真实问答（可直接改写成提问素材）：**')
    lines.push('')
    qaErrors.forEach(it => {
      lines.push(`- 老师问 "${it.q}" → 孩子答 "${it.a}"`)
    })
    lines.push('')
  }
  if (!errorPairs.length && !weakPoints.length && !qaErrors.length) {
    lines.push('（本课报告未提供错误明细，请依据上面的目标句型做开放式对话练习。）')
    lines.push('')
  }

  lines.push('## 4. 怎么练（10–15 分钟）')
  lines.push('')
  lines.push('1. **热身 2 分钟**：用「已掌握」的内容问 2 个简单问题，让孩子先开口说对，建立信心')
  lines.push('2. **专项 6–8 分钟**：从上面的错误表里挑 1–2 条，用选择疑问句（A or B?）和同一句架替换词语的方式反复练')
  lines.push('3. **综合 3 分钟**：设一个本课情景，让孩子用目标句型连说 3 句以上（例如复述课文、计划一次出门）')
  lines.push('4. **收尾 1 分钟**：只说孩子今天做对了什么，给一句具体表扬，不重提错误')
  if (practice.pairs.length) {
    lines.push('')
    lines.push('**可直接使用的问答脚本**（取自本课三天练习计划，例句全部来自课堂真实语料）：')
    lines.push('')
    practice.pairs.forEach(p => lines.push(`- Q: ${p.q} → A: ${p.a}`))
  }
  if (practice.checklist.length) {
    lines.push('')
    lines.push('本课打卡目标（你心里有数即可，不要念给孩子听）：')
    lines.push('')
    practice.checklist.forEach(c => lines.push(`- ${c}`))
  }
  lines.push('')

  lines.push('## 5. 纠错规则（严格执行）')
  lines.push('')
  lines.push('- 孩子答错时，不说 "wrong" / "no"，也不逐词解释规则；把正确句子慢速完整重说一遍，请孩子跟读一次，再回到对话 —— 这是课上外教的做法')
  lines.push('- 同一个错误最多纠 2 次，第 3 次直接换话题，别让孩子受挫')
  lines.push('- 连续 3 次答不上来就降难度：改成 "A or B?"，或给出句架让孩子只补最后一个词')
  lines.push('- 一次只聚焦 1–2 个错误点，不要连着抛多个问题')
  lines.push('- 孩子用中文回答时，用英语把孩子的意思复述一遍，请孩子跟着说一次')
  lines.push('')

  lines.push('## 6. 边界')
  lines.push('')
  lines.push('- 只用上面列出的句型和词汇，不引入本课之外的新单词、新语法')
  lines.push('- 不主动聊无关话题；孩子跑题时用一句英语把话题拉回本课场景')
  lines.push('- 不替孩子把话说完，问完留一次停顿等孩子开口')
  lines.push('- 不用中文讲语法规则（语法讲解由家长看中文报告负责）')
  lines.push('')

  lines.push('## 7. 开场与课后反馈')
  lines.push('')
  lines.push('第一句请严格这样说：')
  lines.push('')
  lines.push(`"Hi ${name}! I'm Buddy, your English friend. I'm so happy to see you today! Are you ready to talk with me?"`)
  lines.push('')
  lines.push('第二句起，用本节第 1 个目标句型问一个关于孩子真实生活的问题（可改写课上原句），然后进入第 4 节的流程。')
  lines.push('')
  lines.push('陪练结束时，用中文给家长 3 行反馈：① 今天主要练了哪个错误点 ② 孩子能独立说对几次 ③ 下次建议继续练什么。')
  lines.push('')

  return lines.join('\n')
}

export function generateLessonPrompt(input: LessonPromptInput): LessonPromptResult {
  const { course, reports, student } = input
  const warnings: string[] = []
  const docs: Partial<Record<ReportKey, ReportDoc>> = {}
  const used: ReportKey[] = []

  for (const key of REPORT_KEYS) {
    const raw = reports[key]
    if (!raw || !raw.trim()) continue
    const doc = parseDoc(raw)
    if (doc) {
      docs[key] = doc
      used.push(key)
    } else {
      warnings.push(`${REPORT_LABEL[key]}报告不是结构化 JSON（旧版 HTML 或纯文本），已跳过该部分素材`)
    }
  }

  if (!docs.vocab && !docs.report) {
    warnings.push('缺少「句式词汇 / 课程分析」报告，提示词仅基于课程元数据生成，针对性会明显下降')
  }
  if (!docs.qa) warnings.push('缺少「问答记录」报告，未附课堂真实错误问答')
  if (!docs.plan) warnings.push('缺少「练习计划」报告，未附可直接使用的问答脚本')

  const patterns = extractPatterns(docs.vocab)
  const vocab = extractVocab(docs.vocab)
  const errorPairs = extractErrorPairs(docs)
  const review = extractReview(docs)
  const qaErrors = extractQaErrors(docs.qa)
  const practice = extractPractice(docs.plan)

  if (!errorPairs.length && docs.vocab) {
    warnings.push('未从报告表格中解析出「误说 → 正确形式」对照，已改用课程薄弱点清单')
  }

  const name = (student?.name || course.student || 'the child').trim()
  const age = student?.age && student.age > 0 ? student.age : null

  const prompt = buildPrompt({ name, age, course, patterns, vocab, errorPairs, review, qaErrors, practice })

  return {
    prompt,
    source: {
      used,
      patterns: patterns.length,
      vocabWords: vocab.reduce((n, g) => n + g.words.length, 0),
      errorPairs: errorPairs.length,
      qaErrors: qaErrors.length,
      practicePairs: practice.pairs.length,
      checklistItems: practice.checklist.length,
      warnings,
    },
  }
}
