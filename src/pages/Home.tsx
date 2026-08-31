import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudent } from '../context/StudentContext'
import { getCoursesByStudent } from '../store/db'
import { analyzeWeakness, rateBg } from '../lib/weakness'
import type { Course } from '../types'

function TrendChart({ courses }: { courses: Course[] }) {
  const W = 680, H = 220, pad = 48, top = 16, bottom = 36
  const n = courses.length
  if (n === 0) return null
  const stepX = (W - pad * 2) / Math.max(n - 1, 1)
  const y = (v: number) => top + (1 - v / 100) * (H - top - bottom)
  const x = (i: number) => pad + i * stepX
  const pts = courses.map((c, i) => `${x(i)},${y(c.rate)}`).join(' ')
  const area = `${pts} ${x(n - 1)},${y(0)} ${x(0)},${y(0)}`
  const color = (r: number) => r >= 70 ? '#22c55e' : r >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl" xmlns="http://www.w3.org/2000/svg">
        {[0, 20, 40, 60, 80, 100].map(v => (
          <g key={v}>
            <line x1={pad} y1={y(v)} x2={W - pad} y2={y(v)} stroke="#eef0f4" />
            <text x={pad - 6} y={y(v) + 4} fill="#bbb" fontSize={10} textAnchor="end">{v}%</text>
          </g>
        ))}
        <line x1={pad} y1={y(60)} x2={W - pad} y2={y(60)} stroke="#c7d2fe" strokeDasharray="5 3" />
        <polygon points={area} fill="#6366f1" opacity={0.08} />
        <polyline points={pts} fill="none" stroke="#6366f1" strokeWidth={3} strokeLinejoin="round" />
        {courses.map((c, i) => (
          <g key={c.id}>
            <circle cx={x(i)} cy={y(c.rate)} r={5} fill={color(c.rate)} />
            <text x={x(i)} y={y(c.rate) - 9} textAnchor="middle" fontSize={11} fontWeight={700} fill={color(c.rate)}>
              {c.rate}%
            </text>
            <text x={x(i)} y={y(0) + 20} textAnchor="middle" fontSize={10} fill="#999">
              {c.date.slice(5).replace('-', '/')}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex gap-4 justify-center mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />≥70% 优秀</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />60-69% 及格</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />&lt;60% 待提升</span>
      </div>
    </div>
  )
}

export default function Home() {
  const { currentStudent } = useStudent()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!currentStudent) return
    setLoading(true)
    getCoursesByStudent(currentStudent.id).then(data => {
      setCourses(data)
      setLoading(false)
    })
  }, [currentStudent])

  if (loading || !currentStudent) {
    return <div className="flex items-center justify-center h-64 text-gray-400">加载中…</div>
  }

  if (!courses.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
        <span className="text-5xl">📭</span>
        <p>暂无课程，请在「课程」页上传数据包</p>
      </div>
    )
  }

  const avgRate = Math.round(courses.reduce((s, c) => s + c.rate, 0) / courses.length)
  const maxRate = Math.max(...courses.map(c => c.rate))
  const latest = courses[courses.length - 1]
  const weakness = analyzeWeakness(courses)
  const topGrammar = weakness.filter(w => w.count > 0).slice(0, 3)
  const teachers = [...new Set(courses.map(c => c.teacher))]

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { num: courses.length, label: '累计课时', accent: false },
          { num: teachers.length, label: '外教老师', accent: false },
          { num: `${avgRate}%`, label: '平均正确率', accent: true },
          { num: `${maxRate}%`, label: '最高正确率', accent: false },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-50">
            <div className={`text-3xl font-extrabold ${item.accent ? 'text-indigo-600' : 'text-gray-800'}`}>
              {item.num}
            </div>
            <div className="text-xs text-gray-400 mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50">
        <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>📈</span> 问答正确率趋势
        </h2>
        <TrendChart courses={courses} />
      </div>

      {/* Today focus */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Last class weaknesses */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50">
          <h3 className="text-sm font-bold text-amber-700 mb-3 flex items-center gap-1.5">
            <span>⚠️</span> 上次课待复习（{latest.date.slice(5)} · {latest.teacher}）
          </h3>
          <ul className="space-y-1.5">
            {latest.weak.map((w, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5">•</span>{w}
              </li>
            ))}
          </ul>
          <button
            onClick={() => navigate('/courses')}
            className="mt-3 text-xs text-indigo-600 hover:underline"
          >
            查看完整报告 →
          </button>
        </div>

        {/* Smart recommendations */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50">
          <h3 className="text-sm font-bold text-indigo-700 mb-3 flex items-center gap-1.5">
            <span>🎯</span> 智能推荐练习语法点
          </h3>
          {topGrammar.length ? (
            <ul className="space-y-2">
              {topGrammar.map(g => (
                <li key={g.point} className="text-sm">
                  <span className="font-medium text-gray-800">{g.point}</span>
                  <span className="text-xs text-gray-400 ml-1.5">
                    {g.courses.length} 节课出现：{g.courses.join('、')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">暂无推荐</p>
          )}
          <button
            onClick={() => navigate('/practice')}
            className="mt-3 text-xs text-indigo-600 hover:underline"
          >
            去练习中心 →
          </button>
        </div>
      </div>

      {/* Course quick view */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50">
        <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>🗂️</span> 课程速览
        </h2>
        <div className="divide-y divide-gray-50">
          {[...courses].reverse().map(c => (
            <div
              key={c.id}
              className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
              onClick={() => navigate('/courses')}
            >
              <span className="text-xs text-gray-400 w-12 shrink-0">{c.date.slice(5).replace('-', '/')}</span>
              <span className="text-sm font-medium text-gray-700 flex-1 truncate">{c.topic}</span>
              <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{c.teacher}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${rateBg(c.rate)}`}>
                {c.rate}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
