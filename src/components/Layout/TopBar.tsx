import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useStudent } from '../../context/StudentContext'
import { useAuth } from '../../context/AuthContext'

const NAV = [
  { to: '/', label: '看板', icon: '📊' },
  { to: '/courses', label: '课程', icon: '📚' },
  { to: '/practice', label: '练习', icon: '✏️' },
  { to: '/students', label: '学生', icon: '👤' },
]

export default function TopBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { students, currentStudent, setCurrentStudentId } = useStudent()
  const { user, isAdmin, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const email = user?.email ?? ''
  const initial = (email[0] ?? '?').toUpperCase()

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2 font-bold text-indigo-600 text-base shrink-0">
          <span className="text-xl">🎓</span>
          <span className="hidden sm:block">WorkBuddy</span>
        </div>

        {/* Nav */}
        <nav className="flex gap-1">
          {NAV.map(n => {
            const active = pathname === n.to || (n.to !== '/' && pathname.startsWith(n.to))
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
              >
                <span>{n.icon}</span>
                <span className="hidden sm:block">{n.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Student selector */}
        {students.length > 0 && (
          <select
            value={currentStudent?.id || ''}
            onChange={e => setCurrentStudentId(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700
              focus:outline-none focus:ring-2 focus:ring-indigo-300 max-w-[120px]"
          >
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-full border border-gray-200
              hover:bg-gray-50 transition-colors"
            title={email}
          >
            <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold
              flex items-center justify-center">
              {initial}
            </span>
            <span className="hidden md:block text-xs text-gray-500 max-w-[140px] truncate">
              {email}
            </span>
            {isAdmin && (
              <span className="hidden md:block px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[10px]">
                管理员
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-gray-100
              shadow-lg py-1 text-sm z-50">
              <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-50 break-all">
                {email}
              </div>
              {isAdmin && (
                <button
                  onClick={() => {
                    setOpen(false)
                    navigate('/admin')
                  }}
                  className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-50"
                >
                  后台管理
                </button>
              )}
              <button
                onClick={() => {
                  setOpen(false)
                  navigate('/settings')
                }}
                className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-50"
              >
                设置
              </button>
              <button
                onClick={async () => {
                  setOpen(false)
                  await signOut()
                }}
                className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50"
              >
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
