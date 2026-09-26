import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Login from '../../pages/Login'
import Register from '../../pages/Register'

function Splash() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <div className="text-sm">正在验证登录状态…</div>
      </div>
    </div>
  )
}

/**
 * 路由守卫：
 *  - 鉴权未就绪 → 骨架屏
 *  - 未登录 → 只渲染 /login、/register，其余一律跳登录页并记住回跳目标
 *  - 已登录 → 渲染 children（受保护的主体应用）
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const path = location.pathname

  if (loading) return <Splash />

  if (!user) {
    if (path === '/login') return <Login />
    if (path === '/register') return <Register />
    return <Navigate to="/login" state={{ from: path }} replace />
  }

  return <>{children}</>
}
