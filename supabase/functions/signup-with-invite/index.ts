// Sprout English · 邀请码注册
// 部署：supabase functions deploy signup-with-invite --no-verify-jwt
// 说明：注册者此时还没有账号，所以本身不能带 JWT，用 --no-verify-jwt 部署；
//       安全靠「邀请码一次性 + 服务端校验」保证。

import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let email = ''
  let password = ''
  let inviteCode = ''
  try {
    const body = await req.json()
    email = String(body.email ?? '').trim().toLowerCase()
    password = String(body.password ?? '')
    inviteCode = String(body.inviteCode ?? '').trim()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }

  if (!EMAIL_RE.test(email)) return json({ error: 'invalid_email' }, 400)
  if (password.length < 8) return json({ error: 'weak_password' }, 400)
  if (!inviteCode) return json({ error: 'invite_required' }, 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  // --- 1. 校验邀请码 ---
  const { data: invite, error: inviteErr } = await admin
    .from('invite_codes')
    .select('code, expires_at, used_by')
    .eq('code', inviteCode)
    .maybeSingle()

  if (inviteErr) return json({ error: 'server_error', detail: inviteErr.message }, 500)
  if (!invite) return json({ error: 'invite_invalid' }, 400)
  if (invite.used_by) return json({ error: 'invite_used' }, 400)
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return json({ error: 'invite_expired' }, 400)
  }

  // --- 2. 创建用户（未确认邮箱，需点邮件链接） ---
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  })

  if (createErr) {
    // 邮箱已存在：不对外暴露，统一提示
    const msg = String(createErr.message ?? '')
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      return json({ error: 'email_taken' }, 409)
    }
    return json({ error: 'signup_failed', detail: msg }, 400)
  }

  const userId = created.user.id

  // --- 3. 首个注册者自动成为 admin ---
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_admin', true)

  const becomeAdmin = (count ?? 0) === 0
  if (becomeAdmin) {
    await admin.from('profiles').update({ is_admin: true }).eq('id', userId)
  }

  // --- 4. 标记邀请码已用 ---
  await admin
    .from('invite_codes')
    .update({ used_by: userId, used_at: new Date().toISOString() })
    .eq('code', inviteCode)

  // --- 5. 审计 ---
  await admin.from('admin_audit_log').insert({
    admin_id: userId,
    action: 'signup',
    target_user_id: userId,
    detail: { email, inviteCode, isAdmin: becomeAdmin },
  })

  return json({ userId, isAdmin: becomeAdmin, needEmailConfirm: true })
})
