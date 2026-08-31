import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import type { Student } from '../types'
import {
  getAllStudents,
  saveStudent,
  deleteStudent as dbDeleteStudent,
  countCourses,
  getAllCourses,
  saveCourse,
} from '../store/db'

const SEED_VERSION_KEY = '__wbSeedVersion'
const SEED_VERSION = 'v1'
const CURRENT_STUDENT_KEY = '__wbCurrentStudentId'

interface StudentCtx {
  students: Student[]
  currentStudent: Student | null
  setCurrentStudentId: (id: string) => void
  addStudent: (s: Omit<Student, 'id' | 'createdAt'>) => Promise<Student>
  updateStudent: (s: Student) => Promise<void>
  deleteStudent: (id: string) => Promise<void>
  loading: boolean
}

const Ctx = createContext<StudentCtx>({} as StudentCtx)

export function StudentProvider({ children }: { children: React.ReactNode }) {
  const [students, setStudents] = useState<Student[]>([])
  const [currentId, setCurrentId] = useState<string>(
    () => localStorage.getItem(CURRENT_STUDENT_KEY) || ''
  )
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const list = await getAllStudents()
    setStudents(list)
    return list
  }, [])

  useEffect(() => {
    async function boot() {
      // 确保有默认学生 Mera
      let list = await getAllStudents()
      if (!list.length) {
        const mera: Student = {
          id: 'mera',
          name: 'Mera',
          age: 7,
          createdAt: '2026-07-15T00:00:00.000Z',
        }
        await saveStudent(mera)
        list = [mera]
      }

      // 加载种子数据
      const savedVer = localStorage.getItem(SEED_VERSION_KEY)
      const count = await countCourses()
      if (savedVer !== SEED_VERSION || count === 0) {
        try {
          const resp = await fetch('./courses.json')
          if (resp.ok) {
            const data = await resp.json()
            for (const c of data) await saveCourse(c)
            localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION)
          }
        } catch {
          // ignore — might be running without seed
        }
      }

      setStudents(list)
      if (!currentId || !list.find(s => s.id === currentId)) {
        const id = list[0]?.id || ''
        setCurrentId(id)
        localStorage.setItem(CURRENT_STUDENT_KEY, id)
      }
      setLoading(false)
    }
    boot()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setCurrentStudentId = useCallback((id: string) => {
    setCurrentId(id)
    localStorage.setItem(CURRENT_STUDENT_KEY, id)
  }, [])

  const addStudent = useCallback(
    async (data: Omit<Student, 'id' | 'createdAt'>) => {
      const s: Student = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }
      await saveStudent(s)
      await refresh()
      return s
    },
    [refresh]
  )

  const updateStudent = useCallback(
    async (s: Student) => {
      await saveStudent(s)
      await refresh()
    },
    [refresh]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await dbDeleteStudent(id)
      const list = await refresh()
      if (currentId === id) {
        const next = list[0]?.id || ''
        setCurrentId(next)
        localStorage.setItem(CURRENT_STUDENT_KEY, next)
      }
    },
    [currentId, refresh]
  )

  // 同步种子课程的 studentId（旧数据可能没有）
  useEffect(() => {
    async function fixSeed() {
      const all = await getAllCourses()
      const toFix = all.filter(c => !c.studentId)
      for (const c of toFix) {
        await saveCourse({ ...c, studentId: 'mera' })
      }
    }
    if (!loading) fixSeed()
  }, [loading])

  const currentStudent = students.find(s => s.id === currentId) || students[0] || null

  return (
    <Ctx.Provider
      value={{
        students,
        currentStudent,
        setCurrentStudentId,
        addStudent,
        updateStudent,
        deleteStudent: handleDelete,
        loading,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useStudent() {
  return useContext(Ctx)
}
