import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type Mode = 'signin' | 'reset'

export default function Login() {
  const { signIn, requestPasswordReset } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPwd, setShowPwd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error: err } = await signIn(email.trim(), password, remember)
        if (err) {
          setError(err)
        } else {
          navigate(from, { replace: true })
        }
      } else {
        const { error: err } = await requestPasswordReset(email.trim())
        if (err) {
          setError(err)
        } else {
          setNotice('重置邮件已发送，请到邮箱点击链接设置新密码。没收到请检查垃圾邮件箱。')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl">🎓</div>
          <h1 className="mt-2 text-xl font-bold text-gray-800">Sprout English</h1>
          <p className="mt-1 text-sm text-gray-500">
            {mode === 'signin' ? '登录后查看课程与练习记录' : '通过邮箱找回密码'}
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">邮箱</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
            />
          </div>

          {mode === 'signin' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">密码</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 pr-14 text-sm border border-gray-200 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 px-1.5 py-1"
                >
                  {showPwd ? '隐藏' : '显示'}
                </button>
              </div>
            </div>
          )}

          {mode === 'signin' && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-300"
              />
              记住我 30 天
            </label>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {notice && (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              {notice}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium
              hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? '处理中…' : mode === 'signin' ? '登录' : '发送重置邮件'}
          </button>

          <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
            {mode === 'signin' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMode('reset')
                    setError(null)
                    setNotice(null)
                  }}
                  className="hover:text-indigo-600"
                >
                  忘记密码？
                </button>
                <Link to="/register" className="hover:text-indigo-600">
                  有邀请码？去注册
                </Link>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin')
                    setError(null)
                    setNotice(null)
                  }}
                  className="hover:text-indigo-600"
                >
                  ← 返回登录
                </button>
                <span>收不到邮件？请联系管理员重置</span>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
