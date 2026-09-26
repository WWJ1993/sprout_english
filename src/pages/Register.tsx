import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { signUpWithInvite, signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setError('密码至少 8 位，且需同时包含字母和数字')
      return
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致')
      return
    }

    setBusy(true)
    try {
      const { error: err } = await signUpWithInvite(email.trim(), password, code.trim())
      if (err) {
        setError(err)
        return
      }
      // 若后台未开启邮箱确认，直接自动登录
      const { error: loginErr } = await signIn(email.trim(), password, true)
      if (loginErr) {
        setDone('注册成功！请先到邮箱点击确认链接，然后回到登录页登录。')
      } else {
        navigate('/', { replace: true })
      }
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
          <div className="text-4xl">📬</div>
          <p className="mt-3 text-sm text-gray-700">{done}</p>
          <Link
            to="/login"
            className="inline-block mt-5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            返回登录页
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl">🌱</div>
          <h1 className="mt-2 text-xl font-bold text-gray-800">注册账号</h1>
          <p className="mt-1 text-sm text-gray-500">需持有邀请码才能注册</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">邀请码</label>
            <input
              required
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="BOOT-2026"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono tracking-wide
                focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
            />
          </div>

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

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">密码</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="至少 8 位，含字母和数字"
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

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">确认密码</label>
            <input
              type={showPwd ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="再输入一次"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium
              hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? '注册中…' : '注册'}
          </button>

          <div className="text-center text-xs text-gray-500 pt-1">
            已有账号？
            <Link to="/login" className="ml-1 text-indigo-600 hover:text-indigo-700">
              去登录
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
