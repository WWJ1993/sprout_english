import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { AdminUser, InviteCode } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const ACTION_LABEL: Record<string, string> = {
  signup: '注册账号',
  reset_password: '重置密码',
  reset_password_denied: '重置密码（被拒）',
  invite_create: '生成邀请码',
  invite_revoke: '撤销邀请码',
  list_users: '查看用户列表',
  list_users_denied: '查看用户列表（被拒）',
}

function actLabel(a: string) {
  return ACTION_LABEL[a] ?? a
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
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        {desc && <p className="text-xs text-gray-400">{desc}</p>}
      </div>
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

interface AuditRow {
  id: number
  admin_id: string | null
  action: string
  target_user_id: string | null
  detail: Record<string, unknown> | null
  created_at: string
}

function short(id: string | null) {
  return id ? `${id.slice(0, 8)}…` : '—'
}

function when(iso: string | null) {
  if (!iso) return '从未登录'
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Admin() {
  const {
    isAdmin,
    adminListUsers,
    adminResetPassword,
    adminCreateInvites,
    adminListInvites,
    adminRevokeInvite,
  } = useAuth()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersErr, setUsersErr] = useState<string | null>(null)
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [codes, setCodes] = useState<InviteCode[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  // 重置密码
  const [targetEmail, setTargetEmail] = useState('')
  const [newPwd, setNewPwd] = useState('')
  // 邀请码
  const [inviteCount, setInviteCount] = useState(1)
  const [inviteDays, setInviteDays] = useState(30)

  const reloadUsers = useCallback(async () => {
    const { error, users: list } = await adminListUsers()
    setUsersErr(error)
    setUsers(list)
  }, [adminListUsers])

  const reloadCodes = useCallback(async () => {
    setCodes(await adminListInvites().catch(() => []))
  }, [adminListInvites])

  const reloadAudit = useCallback(async () => {
    const { data } = await supabase
      .from('admin_audit_log')
      .select('id, admin_id, action, target_user_id, detail, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    setAudit((data as AuditRow[]) ?? [])
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    void reloadUsers()
    void reloadCodes()
    void reloadAudit()
  }, [isAdmin, reloadUsers, reloadCodes, reloadAudit])

  if (!isAdmin) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-lg font-bold text-gray-800">后台管理</h1>
        <p className="mt-2 text-sm text-gray-500">当前账号没有管理员权限。</p>
        <Link to="/" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">
          返回首页
        </Link>
      </div>
    )
  }

  async function run(fn: () => Promise<{ error: string | null }>, okText: string) {
    setBusy(true)
    setMsg(null)
    try {
      const { error } = await fn()
      setMsg(error ? { text: error, kind: 'err' } : { text: okText, kind: 'ok' })
      if (!error) {
        await reloadAudit()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-lg font-bold text-gray-800">后台管理</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          用户、邀请码与安全审计 · 所有敏感操作均记入审计日志
        </p>
      </div>

      {msg && <Toast text={msg.text} kind={msg.kind} />}

      <Card title={`用户（${users.length}）`} desc="按注册时间倒序">
        {usersErr && (
          <p className="text-xs text-amber-600 mb-2">
            {usersErr}
            {!users.length && (
              <>
                {' '}
                —— 需要部署后台函数：
                <code className="font-mono">supabase functions deploy admin-users</code>
              </>
            )}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="py-1.5 font-medium">邮箱</th>
                <th className="py-1.5 font-medium">角色</th>
                <th className="py-1.5 font-medium">课程</th>
                <th className="py-1.5 font-medium">练习</th>
                <th className="py-1.5 font-medium">注册时间</th>
                <th className="py-1.5 font-medium">最后登录</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 pr-2">
                    <div className="text-gray-700">{u.email}</div>
                    {u.display_name && (
                      <div className="text-[11px] text-gray-400">{u.display_name}</div>
                    )}
                    {!u.email_confirmed && (
                      <span className="text-[11px] text-amber-600">邮箱未验证</span>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {u.is_admin ? (
                      <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                        管理员
                      </span>
                    ) : (
                      <span className="text-gray-400">普通</span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-gray-600">{u.courses}</td>
                  <td className="py-2 pr-2 text-gray-600">{u.practice}</td>
                  <td className="py-2 pr-2 text-gray-400">
                    {new Date(u.created_at).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="py-2 text-gray-400">{when(u.last_sign_in_at)}</td>
                </tr>
              ))}
              {!users.length && !usersErr && (
                <tr>
                  <td colSpan={6} className="py-3 text-center text-gray-300">
                    读取中…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="重置用户密码" desc="邮件不可用时的兜底通道，记入审计日志">
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            value={targetEmail}
            onChange={e => setTargetEmail(e.target.value)}
            placeholder="目标用户邮箱"
            className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-gray-200 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <input
            type="text"
            value={newPwd}
            onChange={e => setNewPwd(e.target.value)}
            placeholder="新密码（≥8 位）"
            className="flex-1 min-w-[160px] px-3 py-2 text-sm border border-gray-200 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            disabled={busy || !targetEmail.includes('@') || newPwd.length < 8}
            onClick={() =>
              run(() => adminResetPassword(targetEmail.trim(), newPwd), '密码已重置').then(
                () => {
                  setTargetEmail('')
                  setNewPwd('')
                }
              )
            }
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium
              hover:bg-red-700 disabled:opacity-50"
          >
            重置
          </button>
        </div>
      </Card>

      <Card title="邀请码" desc="一次性使用，可用于注册新账号">
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
              else setMsg({ text: `已生成 ${created.length} 个邀请码`, kind: 'ok' })
              await reloadCodes()
              await reloadAudit()
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
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString('zh-CN') : '—'}
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
                            await reloadCodes()
                            await reloadAudit()
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

      <Card title="审计日志" desc="最近 50 条敏感操作">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="py-1.5 font-medium">时间</th>
                <th className="py-1.5 font-medium">操作</th>
                <th className="py-1.5 font-medium">操作者</th>
                <th className="py-1.5 font-medium">目标</th>
                <th className="py-1.5 font-medium">详情</th>
              </tr>
            </thead>
            <tbody>
              {audit.map(a => (
                <tr key={a.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-1.5 pr-2 text-gray-400 whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-1.5 pr-2">
                    <span
                      className={
                        a.action.includes('denied')
                          ? 'text-red-600'
                          : 'text-gray-700'
                      }
                    >
                      {actLabel(a.action)}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2 font-mono text-gray-400">{short(a.admin_id)}</td>
                  <td className="py-1.5 pr-2 font-mono text-gray-400">
                    {short(a.target_user_id)}
                  </td>
                  <td className="py-1.5 text-gray-400 break-all">
                    {a.detail ? JSON.stringify(a.detail) : '—'}
                  </td>
                </tr>
              ))}
              {!audit.length && (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-gray-300">
                    暂无记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
