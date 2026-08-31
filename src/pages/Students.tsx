import { useState } from 'react'
import { Dialog } from '@headlessui/react'
import { useStudent } from '../context/StudentContext'
import { getCoursesByStudent } from '../store/db'
import { generatePrompt } from '../lib/promptGen'
import type { Student } from '../types'

function StudentModal({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean
  onClose: () => void
  initial?: Student
  onSave: (data: { name: string; age: number }) => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [age, setAge] = useState(initial?.age?.toString() || '')

  function submit() {
    if (!name.trim() || !age) return
    onSave({ name: name.trim(), age: parseInt(age) })
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
          <Dialog.Title className="text-base font-bold text-gray-800 mb-4">
            {initial ? '编辑学生' : '新增学生'}
          </Dialog.Title>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">姓名</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="例如：Mera"
                autoFocus
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">年龄</label>
              <input
                value={age}
                onChange={e => setAge(e.target.value)}
                type="number"
                min={3}
                max={18}
                placeholder="7"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button
              onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={submit}
              className="flex-1 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              保存
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}

function PromptModal({ open, onClose, content }: { open: boolean; onClose: () => void; content: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-bold text-gray-800">AI 陪练提示词</Dialog.Title>
            <button
              onClick={copy}
              className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors
                ${copied ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
            >
              {copied ? '✅ 已复制' : '📋 一键复制'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl p-4 font-mono">
              {content}
            </pre>
          </div>
          <p className="text-xs text-gray-400 mt-3">复制后粘贴到豆包「创建智能体 → 系统提示词」即可</p>
          <button
            onClick={onClose}
            className="mt-3 w-full py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            关闭
          </button>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}

export default function Students() {
  const { students, currentStudent, setCurrentStudentId, addStudent, updateStudent, deleteStudent } = useStudent()
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Student | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Student | null>(null)
  const [promptContent, setPromptContent] = useState('')
  const [promptOpen, setPromptOpen] = useState(false)
  const [courseCounts, setCourseCounts] = useState<Record<string, number>>({})

  // Load course counts per student
  useState(() => {
    students.forEach(async s => {
      const courses = await getCoursesByStudent(s.id)
      setCourseCounts(prev => ({ ...prev, [s.id]: courses.length }))
    })
  })

  async function handleGenPrompt(s: Student) {
    const courses = await getCoursesByStudent(s.id)
    const content = generatePrompt(s, courses)
    setPromptContent(content)
    setPromptOpen(true)
  }

  async function handleDelete(s: Student) {
    await deleteStudent(s.id)
    setDeleteConfirm(null)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">👤 学生管理</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          + 新增学生
        </button>
      </div>

      <div className="space-y-3">
        {students.map(s => (
          <div
            key={s.id}
            className={`bg-white rounded-2xl p-5 shadow-sm border transition-colors
              ${currentStudent?.id === s.id ? 'border-indigo-200' : 'border-gray-50'}`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-lg font-bold shrink-0">
                {s.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-gray-800">{s.name}</h3>
                  <span className="text-xs text-gray-400">{s.age} 岁</span>
                  {currentStudent?.id === s.id && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">当前</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {courseCounts[s.id] ?? '–'} 节课 · 加入于 {s.createdAt?.slice(0, 10) || '–'}
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-4 flex-wrap">
              {currentStudent?.id !== s.id && (
                <button
                  onClick={() => setCurrentStudentId(s.id)}
                  className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
                >
                  切换到此学生
                </button>
              )}
              <button
                onClick={() => handleGenPrompt(s)}
                className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors font-medium"
              >
                🤖 生成 AI 陪练提示词
              </button>
              <button
                onClick={() => setEditTarget(s)}
                className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
              >
                编辑
              </button>
              {students.length > 1 && (
                <button
                  onClick={() => setDeleteConfirm(s)}
                  className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                >
                  删除
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add modal */}
      <StudentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={data => addStudent(data)}
      />

      {/* Edit modal */}
      {editTarget && (
        <StudentModal
          open
          onClose={() => setEditTarget(null)}
          initial={editTarget}
          onSave={data => updateStudent({ ...editTarget, ...data })}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <Dialog open onClose={() => setDeleteConfirm(null)} className="relative z-50">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
              <Dialog.Title className="text-base font-bold text-gray-800 mb-2">确认删除</Dialog.Title>
              <p className="text-sm text-gray-600">
                删除学生「{deleteConfirm.name}」将同时删除其所有课程数据，无法恢复。确定继续吗？
              </p>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700"
                >
                  确认删除
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}

      {/* Prompt modal */}
      <PromptModal open={promptOpen} onClose={() => setPromptOpen(false)} content={promptContent} />
    </div>
  )
}
