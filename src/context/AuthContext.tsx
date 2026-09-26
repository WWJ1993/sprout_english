import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, setRemember } from '../lib/supabase'

// ---- types ----

export interface Profile {
  id: string
  display_name: string | null
  is_admin: boolean
  created_at?: string
}

export interface Identity {
  id: string
  provider: string
  identity_data?: Record<string, unknown>
  last_sign_in_at?: string
  created_at?: string
}

export interface InviteCode {
  code: string
  created_at: string
  expires_at: string | null
  used_by: string | null
  used_at: string | null
}

export interface AuthResult {
  error: string | null
}

// ---- error mapping ----

const FN_ERRORS: Record<string, string> = {
  bad_request: '请求参数有误',
  weak_password: '密码太弱：至少 8 位，且包含字母和数字',
  weak_password_short: '密码太短，至少 8 位',
  invite_invalid: '邀请码无效',
  invite_used: '邀请码已被使用',
  invite_expired: '邀请码已过期',
  email_exists: '该邮箱已注册，请直接登录',
  email_taken: '该邮箱已注册，请直接登录（或用忘记密码重置）',
  create_failed: '创建账号失败，请稍后重试',
  revoke_failed: '撤销失败',
  list_failed: '读取邀请码列表失败',
  unauthorized: '登录状态已失效，请重新登录',
  forbidden: '只有管理员可以执行此操作',
  user_not_found: '该邮箱未注册',
  method_not_allowed: '请求方式错误',
}

export function mapAuthError(msg: string | undefined): string {
  if (!msg) return '操作失败，请稍后重试'
  if (FN_ERRORS[msg]) return FN_ERRORS[msg]
  if (msg.includes('Invalid login credentials')) return '邮箱或密码错误'
  if (msg.includes('Email not confirmed')) return '请先到邮箱完成验证后再登录'
  if (msg.includes('Email rate limit')) return '邮件发送太频繁，请稍后再试'
  if (msg.includes('Password should be')) return '密码强度不足，至少 8 位'
  return msg
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

async function callFn<T>(
  name: string,
  body: unknown,
  withAuth = true
): Promise<{ data: T | null; error: string | null }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: ANON_KEY,
  }
  if (withAuth) {
    const { data } = await supabase.auth.getSession()
    headers.Authorization = data.session
      ? `Bearer ${data.session.access_token}`
      : `Bearer ${ANON_KEY}`
  } else {
    headers.Authorization = `Bearer ${ANON_KEY}`
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {}),
    })
    const text = await res.text()
    let json: unknown = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    if (!res.ok) {
      const code = (json as { error?: string } | null)?.error
      return { data: null, error: mapAuthError(code ?? `请求失败（${res.status}）`) }
    }
    return { data: json as T, error: null }
  } catch {
    return { data: null, error: '网络异常，请检查连接后重试' }
  }
}

// ---- context ----

interface AuthCtx {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string, remember: boolean) => Promise<AuthResult>
  signOut: () => Promise<void>
  signUpWithInvite: (email: string, password: string, code: string) => Promise<AuthResult>
  requestPasswordReset: (email: string) => Promise<AuthResult>
  refreshProfile: () => Promise<void>
  listIdentities: () => Promise<Identity[]>
  unlinkIdentity: (identityId: string) => Promise<AuthResult>
  updateEmail: (email: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
  adminResetPassword: (email: string, password: string) => Promise<AuthResult>
  adminCreateInvites: (count: number, days: number) => Promise<{ error: string | null; codes: InviteCode[] }>
  adminListInvites: () => Promise<InviteCode[]>
  adminRevokeInvite: (code: string) => Promise<AuthResult>
}

const Ctx = createContext<AuthCtx>({} as AuthCtx)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, is_admin, created_at')
      .eq('id', uid)
      .maybeSingle()
    setProfile((data as Profile | null) ?? null)
  }, [])

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      if (data.session?.user) {
        await loadProfile(data.session.user.id)
      }
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next)
      if (next?.user) {
        await loadProfile(next.user.id)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(
    async (email: string, password: string, remember: boolean): Promise<AuthResult> => {
      setRemember(remember)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error: mapAuthError(error.message) }
      return { error: null }
    },
    []
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const signUpWithInvite = useCallback(
    async (email: string, password: string, code: string): Promise<AuthResult> => {
      const { error } = await callFn<{ userId: string }>(
        'signup-with-invite',
        { email, password, inviteCode: code },
        false
      )
      return { error }
    },
    []
  )

  const requestPasswordReset = useCallback(
    async (email: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${window.location.pathname}#/login`,
      })
      if (error) return { error: mapAuthError(error.message) }
      return { error: null }
    },
    []
  )

  const listIdentities = useCallback(async (): Promise<Identity[]> => {
    const { data, error } = await supabase.auth.getUserIdentities()
    if (error || !data) return []
    return (data.identities ?? []) as unknown as Identity[]
  }, [])

  const unlinkIdentity = useCallback(
    async (identityId: string): Promise<AuthResult> => {
      const list = await listIdentities()
      const target = list.find(i => i.id === identityId)
      if (!target) return { error: '凭据不存在' }
      if (list.length <= 1) return { error: '至少保留一个可用凭据' }
      const { error } = await supabase.auth.unlinkIdentity(
        target as unknown as Parameters<typeof supabase.auth.unlinkIdentity>[0]
      )
      if (error) return { error: mapAuthError(error.message) }
      return { error: null }
    },
    [listIdentities]
  )

  const updateEmail = useCallback(
    async (email: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.updateUser({ email })
      if (error) return { error: mapAuthError(error.message) }
      return { error: null }
    },
    []
  )

  const updatePassword = useCallback(
    async (password: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) return { error: mapAuthError(error.message) }
      return { error: null }
    },
    []
  )

  const adminResetPassword = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { error } = await callFn('admin-reset-password', { email, password })
      return { error }
    },
    []
  )

  const adminCreateInvites = useCallback(
    async (count: number, days: number) => {
      const { data, error } = await callFn<{ codes: InviteCode[] }>(
        'admin-invite',
        { action: 'create', count, days }
      )
      return { error, codes: data?.codes ?? [] }
    },
    []
  )

  const adminListInvites = useCallback(async (): Promise<InviteCode[]> => {
    const { data } = await callFn<{ codes: InviteCode[] }>('admin-invite', { action: 'list' })
    return data?.codes ?? []
  }, [])

  const adminRevokeInvite = useCallback(
    async (code: string): Promise<AuthResult> => {
      const { error } = await callFn('admin-invite', { action: 'revoke', code })
      return { error }
    },
    []
  )

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isAdmin: !!profile?.is_admin,
      signIn,
      signOut,
      signUpWithInvite,
      requestPasswordReset,
      refreshProfile: async () => {
        if (session?.user) await loadProfile(session.user.id)
      },
      listIdentities,
      unlinkIdentity,
      updateEmail,
      updatePassword,
      adminResetPassword,
      adminCreateInvites,
      adminListInvites,
      adminRevokeInvite,
    }),
    [
      session,
      profile,
      loading,
      signIn,
      signOut,
      signUpWithInvite,
      requestPasswordReset,
      loadProfile,
      listIdentities,
      unlinkIdentity,
      updateEmail,
      updatePassword,
      adminResetPassword,
      adminCreateInvites,
      adminListInvites,
      adminRevokeInvite,
    ]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  return useContext(Ctx)
}
