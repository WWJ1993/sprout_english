import { useState, useEffect, useCallback } from 'react'
import { useStudent } from '../context/StudentContext'
import { getCoursesByStudent, savePractice } from '../store/db'
import { analyzeWeakness } from '../lib/weakness'
import { QUESTION_BANK } from '../data/questions'
import type { Course, Question, PracticeRecord } from '../types'

type Mode = 'smart' | 'random'

interface QWithMeta extends Question {
  point: string
  level: string
}

function pickQuestion(courses: Course[], mode: Mode): QWithMeta {
  const weakness = analyzeWeakness(courses)
  let pool: QWithMeta[] = []

  if (mode === 'smart') {
    const ordered = weakness.filter(w => w.count > 0)
    if (ordered.length) {
      ordered.forEach(w => {
        const pt = QUESTION_BANK.find(p => p.point === w.point)
        if (pt) pt.questions.forEach(q => pool.push({ ...q, point: pt.point, level: pt.level }))
      })
      QUESTION_BANK.forEach(pt => {
        if (!ordered.find(w => w.point === pt.point))
          pt.questions.forEach(q => pool.push({ ...q, point: pt.point, level: pt.level }))
      })
    }
  }

  if (!pool.length) {
    QUESTION_BANK.forEach(pt => pt.questions.forEach(q => pool.push({ ...q, point: pt.point, level: pt.level })))
  }

  return pool[Math.floor(Math.random() * pool.length)]
}

function formatQ(q: string) {
  return q.replace(/\b___\b/g, '<span class="inline-block w-12 h-0.5 bg-gray-400 align-middle mx-1 relative -top-0.5" />')
}

export default function Practice() {
  const { currentStudent } = useStudent()
  const [courses, setCourses] = useState<Course[]>([])
  const [mode, setMode] = useState<Mode>('smart')
  const [current, setCurrent] = useState<QWithMeta | null>(null)
  const [answered, setAnswered] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [fillValue, setFillValue] = useState('')
  const [fillResult, setFillResult] = useState<boolean | null>(null)
  const [session, setSession] = useState({ correct: 0, wrong: 0, total: 0 })

  useEffect(() => {
    if (!currentStudent) return
    getCoursesByStudent(currentStudent.id).then(data => {
      setCourses(data)
      setCurrent(pickQuestion(data, mode))
    })
  }, [currentStudent, mode])

  const next = useCallback(() => {
    setCurrent(pickQuestion(courses, mode))
    setAnswered(false)
    setSelected(null)
    setFillValue('')
    setFillResult(null)
  }, [courses, mode])

  function handleChoice(i: number) {
    if (answered) return
    const correct = i === (current!.answer as number)
    setSelected(i)
    setAnswered(true)
    setSession(s => ({ correct: s.correct + (correct ? 1 : 0), wrong: s.wrong + (correct ? 0 : 1), total: s.total + 1 }))
    if (currentStudent) {
      const rec: PracticeRecord = { ts: Date.now(), correct, point: current!.point, mode, studentId: currentStudent.id }
      savePractice(rec)
    }
  }

  function handleFill() {
    if (answered || !fillValue.trim()) return
    const ans = current!.answer as string
    const accept = [ans.toLowerCase(), ...(current!.accept || []).map(a => a.toLowerCase())]
    const correct = accept.includes(fillValue.trim().toLowerCase())
    setFillResult(correct)
    setAnswered(true)
    setSession(s => ({ correct: s.correct + (correct ? 1 : 0), wrong: s.wrong + (correct ? 0 : 1), total: s.total + 1 }))
    if (currentStudent) {
      const rec: PracticeRecord = { ts: Date.now(), correct, point: current!.point, mode, studentId: currentStudent.id }
      savePractice(rec)
    }
  }

  if (!current) return <div className="flex items-center justify-center h-64 text-gray-400">加载中…</div>

  const isHot = current.level === '高频错误'
  const accuracy = session.total > 0 ? Math.round((session.correct / session.total) * 100) : null

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex items-center gap-3 flex-wrap">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-1.5"><span>✏️</span>练习中心</h1>
        {/* Mode switch */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 ml-auto">
          {(['smart', 'random'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 text-sm font-medium transition-colors
                ${mode === m ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {m === 'smart' ? '🎯 智能定向' : '🎲 随机'}
            </button>
          ))}
        </div>
        {/* Session stats */}
        <div className="flex gap-3 text-sm ml-auto sm:ml-0">
          <span className="text-green-600 font-bold">{session.correct} 对</span>
          <span className="text-red-500 font-bold">{session.wrong} 错</span>
          <span className="text-gray-400">{session.total} 共答</span>
          {accuracy !== null && <span className="text-indigo-600 font-bold">{accuracy}%</span>}
        </div>
      </div>

      {/* Question card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-50 space-y-5">
        {/* Point tag */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full
            ${isHot ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
            {isHot ? '🔥' : '📌'} {current.point}
            {isHot && <span className="ml-1 opacity-70">· 高频薄弱</span>}
          </span>
        </div>

        {/* Question text */}
        <p
          className="text-base font-medium text-gray-800 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: formatQ(current.q) }}
        />

        {/* Options / Fill */}
        {current.type === 'choice' ? (
          <div className="space-y-2.5">
            {(current.options || []).map((opt, i) => {
              let cls = 'border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/50'
              if (answered) {
                if (i === (current.answer as number)) cls = 'border-green-400 bg-green-50 text-green-800'
                else if (i === selected) cls = 'border-red-400 bg-red-50 text-red-700'
                else cls = 'border-gray-100 text-gray-400'
              }
              return (
                <button
                  key={i}
                  onClick={() => handleChoice(i)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all ${cls}`}
                >
                  <span className="font-semibold mr-2 text-gray-400">{String.fromCharCode(65 + i)}.</span>
                  {opt}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={fillValue}
              onChange={e => setFillValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFill()}
              disabled={answered}
              placeholder="输入答案后按回车…"
              autoFocus
              className={`flex-1 px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none transition-colors
                ${answered
                  ? fillResult ? 'border-green-400 bg-green-50 text-green-800' : 'border-red-400 bg-red-50 text-red-700'
                  : 'border-gray-200 focus:border-indigo-400'
                }`}
            />
            {!answered && (
              <button
                onClick={handleFill}
                className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
              >
                提交
              </button>
            )}
          </div>
        )}

        {/* Feedback */}
        {answered && (
          <div className={`rounded-xl p-4 ${
            (current.type === 'choice' ? selected === (current.answer as number) : fillResult)
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <p className="text-sm font-bold mb-1">
              {(current.type === 'choice' ? selected === (current.answer as number) : fillResult)
                ? '✅ 正确！'
                : `❌ 答错了${current.type === 'fill' ? `，正确答案：${current.answer}` : ''}`
              }
            </p>
            {current.explain && <p className="text-sm text-gray-600">{current.explain}</p>}
          </div>
        )}

        {/* Next button */}
        {answered && (
          <button
            onClick={next}
            className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            下一题 →
          </button>
        )}
      </div>
    </div>
  )
}
