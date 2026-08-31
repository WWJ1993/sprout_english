export interface Student {
  id: string
  name: string
  age: number
  createdAt: string
}

export interface CourseReports {
  report: string
  vocab: string
  qa: string
  plan: string
  [key: string]: string
}

export interface Course {
  id: number
  studentId: string
  date: string
  teacher: string
  student: string
  topic: string
  duration: number
  rate: number
  good: string[]
  weak: string[]
  reports: CourseReports
  transcript?: string
  transcriptTs?: string
  uploadedAt: string | null
}

export interface PracticeRecord {
  ts: number
  correct: boolean
  point: string
  mode: 'smart' | 'random'
  studentId: string
}

export interface Question {
  type: 'choice' | 'fill'
  q: string
  options?: string[]
  answer: number | string
  accept?: string[]
  explain?: string
}

export interface GrammarPoint {
  point: string
  keywords: string[]
  level: '高频错误' | '巩固' | '进阶'
  questions: Question[]
}

export interface WeaknessStats {
  point: string
  count: number
  level: string
  keywords: string[]
  courses: string[]
}
