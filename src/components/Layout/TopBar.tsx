import { Link, useLocation } from 'react-router-dom'
import { useStudent } from '../../context/StudentContext'

const NAV = [
  { to: '/', label: '看板', icon: '📊' },
  { to: '/courses', label: '课程', icon: '📚' },
  { to: '/practice', label: '练习', icon: '✏️' },
  { to: '/students', label: '学生', icon: '👤' },
]

export default function TopBar() {
  const { pathname } = useLocation()
  const { students, currentStudent, setCurrentStudentId } = useStudent()

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
      </div>
    </header>
  )
}
