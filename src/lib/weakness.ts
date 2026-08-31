import type { Course, WeaknessStats } from '../types'
import { QUESTION_BANK } from '../data/questions'

function fmtDate(d: string) {
  return d.replace(/-/g, '/').slice(5)
}

export function analyzeWeakness(courses: Course[]): WeaknessStats[] {
  const stats: Record<string, { count: number; level: string; keywords: string[]; courses: string[] }> = {}
  QUESTION_BANK.forEach(pt => {
    stats[pt.point] = { count: 0, level: pt.level, keywords: pt.keywords, courses: [] }
  })
  courses.forEach(c => {
    const weakText = (c.weak || []).join(' ').toLowerCase()
    QUESTION_BANK.forEach(pt => {
      if (pt.keywords.some(k => weakText.includes(k.toLowerCase()))) {
        stats[pt.point].count++
        stats[pt.point].courses.push(fmtDate(c.date))
      }
    })
  })
  return Object.entries(stats)
    .map(([point, s]) => ({ point, ...s }))
    .sort((a, b) => b.count - a.count)
}

export function rateColor(rate: number): string {
  if (rate >= 70) return 'text-green-600'
  if (rate >= 60) return 'text-amber-600'
  return 'text-red-500'
}

export function rateBg(rate: number): string {
  if (rate >= 70) return 'bg-green-50 text-green-700'
  if (rate >= 60) return 'bg-amber-50 text-amber-700'
  return 'bg-red-50 text-red-600'
}
