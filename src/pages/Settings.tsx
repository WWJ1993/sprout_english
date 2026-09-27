import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Identity } from '../context/AuthContext'

const PROVIDER_LABEL: Record<string, string> = {
  email: '邮箱密码',
  phone: '手机号',
  wechat: '微信',
  qq: 'QQ',
  google: 'Google',
  github: 'GitHub',
  apple: 'Apple',
}

function label(p: string) {
  return PROVIDER_LABEL[p] ?? p
}

function Card({
  title,
  desc,
  children,
}: {
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      {desc && <p className="mt-0.5 text-xs text-gray-400">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Toast({ text, kind }: { text: string; kind: 'ok' | 'err' }) {
  return (
    <div
      className={`text-sm rounded-lg px-3 py-2 border ${
        kind === 'ok'
          ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
          : 'text-red-600 bg-red-50 border-red-100'
      }`}
    >
      {text}
    </div>
  )
}

export default function Settings() {
  const {
    user,
    profile,
    isAdmin,
    listIdentities,
    unlinkIdentity,
    updateEmail,
    updatePassword,
  } = useAuth()

  const [identities, setIdentities] = useState<Identity[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  // 凭据
  const [newEmail, setNewEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')

  const reload = useCallback(async () => {
    setIdentities(await listIdentities())
  }, [listIdentities])

  useEffect(() => {
    reload()
  }, [reload])

  async function run(fn: () => Promise<{ error: string | null }>, okText: string) {
    setBusy(true)
    setMsg(null)
    try {
      const { error } = await fn()
      setMsg(error ? { text: error, kind: 'err' } : { text: okText, kind: 'ok' })
      if (!error) await reload()
    } finally {
      setBusy(false)
    }
  }

  const onlyOne = identities.length <= 1

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-lg font-bold text-gray-800">设置</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          管理登录凭据与安全设置{isAdmin ? ' · 管理员' : ''}
        </p>
      </div>

      {msg && <Toast text={msg.text} kind={msg.kind} />}

      <Card title="账号" desc="当前登录的家长账号">
        <dl className="text-sm space-y-1.5">
          <div className="flex gap-3">
            <dt className="w-16 text-gray-400">邮箱</dt>
            <dd className="text-gray-700">{user?.email ?? '—'}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-16 text-gray-400">UID</dt>
            <dd className="text-gray-400 font-mono text-xs break-all">{user?.id ?? '—'}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-16 text-gray-400">角色</dt>
            <dd className="text-gray-700">
              {isAdmin ? (
                <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs">
                  管理员
                </span>
              ) : (
                '普通用户'
              )}
            </dd>
          </div>
          {profile?.display_name && (
            <div className="flex gap-3">
              <dt className="w-16 text-gray-400">昵称</dt>
              <dd className="text-gray-700">{profile.display_name}</dd>
            </div>
          )}
        </dl>
      </Card>

      <Card title="登录凭据" desc="可以绑定多种登录方式，但必须至少保留一个">
        <ul className="space-y-2">
          {identities.map(i => (
            <li
              key={i.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 bg-gray-50/60"
            >
              <span className="text-sm text-gray-700 flex-1">{label(i.provider)}</span>
              {(i.identity_data?.email as string) && (
                <span className="text-xs text-gray-400">
                  {i.identity_data?.email as string}
                </span>
              )}
              <button
                disabled={onlyOne || busy}
                title={onlyOne ? '至少保留一个可用凭据' : '解绑该凭据'}
                onClick={() => run(() => unlinkIdentity(i.id), '已解绑')}
                className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-500
                  hover:text-red-600 hover:border-red-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                解绑
              </button>
            </li>
          ))}
          {!identities.length && (
            <li className="text-sm text-gray-400">读取中…</li>
          )}
        </ul>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {['手机号', '微信', 'QQ'].map(name => (
            <button
              key={name}
              disabled
              title="即将支持"
              className="px-3 py-2 rounded-lg border border-dashed border-gray-200
                text-xs text-gray-300 cursor-not-allowed"
            >
              + 绑定{name}
              <span className="block text-[10px]">即将支持</span>
            </button>
          ))}
        </div>
        {onlyOne && (
          <p className="mt-2 text-xs text-amber-600">
            当前只有一个凭据，解绑已禁用 —— 至少保留一个可用于找回账号。
          </p>
        )}
      </Card>

      <Card title="更换邮箱" desc="需在新邮箱点击确认后才会生效">
        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            placeholder="新邮箱"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            disabled={busy || !newEmail.includes('@')}
            onClick={() => run(() => updateEmail(newEmail.trim()), '确认邮件已发送，请到新邮箱点击确认')}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium
              hover:bg-indigo-700 disabled:opacity-50"
          >
            更换
          </button>
        </div>
      </Card>

      <Card title="修改密码" desc="至少 8 位，含字母和数字">
        <div className="space-y-2">
          <input
            type="password"
            value={pwd}
            onChange={e => setPwd(e.target.value)}
            placeholder="新密码"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <input
            type="password"
            value={pwd2}
            onChange={e => setPwd2(e.target.value)}
            placeholder="再输入一次"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            disabled={
              busy ||
              pwd.length < 8 ||
              !/[a-zA-Z]/.test(pwd) ||
              !/\d/.test(pwd) ||
              pwd !== pwd2
            }
            onClick={() =>
              run(() => updatePassword(pwd), '密码已更新').then(() => {
                setPwd('')
                setPwd2('')
              })
            }
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium
              hover:bg-indigo-700 disabled:opacity-50"
          >
            保存新密码
          </button>
        </div>
      </Card>

      {isAdmin && (
        <Card title="管理员" desc="用户管理、邀请码与审计日志已移至后台">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600
              text-white text-sm font-medium hover:bg-indigo-700"
          >
            进入后台管理
          </Link>
          <p className="mt-2 text-xs text-gray-400">
            可查看全部用户、重置他人密码、管理邀请码、查阅审计日志。
          </p>
        </Card>
      )}
    </div>
  )
}
