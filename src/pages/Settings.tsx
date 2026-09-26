import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import type { Identity, InviteCode } from '../context/AuthContext'

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
    adminResetPassword,
    adminCreateInvites,
    adminListInvites,
    adminRevokeInvite,
  } = useAuth()

  const [identities, setIdentities] = useState<Identity[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  // 凭据
  const [newEmail, setNewEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')

  // 管理员
  const [targetEmail, setTargetEmail] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [inviteCount, setInviteCount] = useState(1)
  const [inviteDays, setInviteDays] = useState(30)
  const [codes, setCodes] = useState<InviteCode[]>([])

  const reload = useCallback(async () => {
    setIdentities(await listIdentities())
  }, [listIdentities])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (isAdmin) {
      adminListInvites().then(setCodes).catch(() => setCodes([]))
    }
  }, [isAdmin, adminListInvites])

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
        <Card title="管理员 · 重置用户密码" desc="邮件不可用时的兜底通道，操作会记入审计日志">
          <div className="space-y-2">
            <input
              type="email"
              value={targetEmail}
              onChange={e => setTargetEmail(e.target.value)}
              placeholder="目标用户邮箱"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <input
              type="text"
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              placeholder="设置的新密码（≥8 位，含字母和数字）"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              disabled={busy || !targetEmail.includes('@') || newPwd.length < 8}
              onClick={() =>
                run(
                  () => adminResetPassword(targetEmail.trim(), newPwd),
                  '密码已重置'
                ).then(() => {
                  setTargetEmail('')
                  setNewPwd('')
                })
              }
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium
                hover:bg-red-700 disabled:opacity-50"
            >
              重置密码
            </button>
          </div>
        </Card>
      )}

      {isAdmin && (
        <Card title="管理员 · 邀请码" desc="邀请码一次性使用，可用于注册新账号">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-gray-500">
              数量
              <input
                type="number"
                min={1}
                max={50}
                value={inviteCount}
                onChange={e => setInviteCount(Number(e.target.value))}
                className="ml-1.5 w-16 px-2 py-1.5 text-sm border border-gray-200 rounded-lg"
              />
            </label>
            <label className="text-xs text-gray-500">
              有效期（天）
              <input
                type="number"
                min={1}
                max={365}
                value={inviteDays}
                onChange={e => setInviteDays(Number(e.target.value))}
                className="ml-1.5 w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-lg"
              />
            </label>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setMsg(null)
                const { error, codes: created } = await adminCreateInvites(inviteCount, inviteDays)
                if (error) setMsg({ text: error, kind: 'err' })
                else {
                  setMsg({ text: `已生成 ${created.length} 个邀请码`, kind: 'ok' })
                  setCodes(await adminListInvites())
                }
                setBusy(false)
              }}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium
                hover:bg-indigo-700 disabled:opacity-50"
            >
              生成
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="py-1.5 font-medium">邀请码</th>
                  <th className="py-1.5 font-medium">创建时间</th>
                  <th className="py-1.5 font-medium">有效期至</th>
                  <th className="py-1.5 font-medium">状态</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {codes.map(c => {
                  const used = !!c.used_by
                  const expired = c.expires_at ? new Date(c.expires_at) < new Date() : false
                  return (
                    <tr key={c.code} className="border-b border-gray-50 last:border-0">
                      <td className="py-1.5 font-mono text-gray-700">{c.code}</td>
                      <td className="py-1.5 text-gray-400">
                        {new Date(c.created_at).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="py-1.5 text-gray-400">
                        {c.expires_at
                          ? new Date(c.expires_at).toLocaleDateString('zh-CN')
                          : '—'}
                      </td>
                      <td className="py-1.5">
                        {used ? (
                          <span className="text-gray-400">已使用</span>
                        ) : expired ? (
                          <span className="text-amber-600">已过期</span>
                        ) : (
                          <span className="text-emerald-600">可用</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right">
                        {!used && (
                          <button
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true)
                              const { error } = await adminRevokeInvite(c.code)
                              setMsg(
                                error
                                  ? { text: error, kind: 'err' }
                                  : { text: `已撤销 ${c.code}`, kind: 'ok' }
                              )
                              setCodes(await adminListInvites())
                              setBusy(false)
                            }}
                            className="text-gray-400 hover:text-red-600"
                          >
                            撤销
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {!codes.length && (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-gray-300">
                      暂无邀请码
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
