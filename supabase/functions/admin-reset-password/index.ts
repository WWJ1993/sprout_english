// Sprout English · 管理员重置任意用户密码
// 部署：supabase functions deploy admin-reset-password   （默认校验 JWT）
// 安全：每次调用都用调用者自带 JWT 反查身份，再校验 profiles.is_admin

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // --- 1. 用调用者自己的 token 反查身份 ---
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: userData, error: userErr } = await caller.auth.getUser()
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401)
  const adminId = userData.user.id

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // --- 2. 校验 is_admin ---
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', adminId)
    .maybeSingle()

  if (!profile?.is_admin) {
    await admin.from('admin_audit_log').insert({
      admin_id: adminId,
      action: 'reset_password_denied',
      detail: { reason: 'not_admin' },
    })
    return json({ error: 'forbidden' }, 403)
  }

  // --- 3. 解析参数 ---
  let email = ''
  let newPassword = ''
  try {
    const body = await req.json()
    email = String(body.email ?? '').trim().toLowerCase()
    newPassword = String(body.newPassword ?? '')
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  if (!email || newPassword.length < 8) return json({ error: 'bad_request' }, 400)

  // --- 4. email → uid ---
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listErr) return json({ error: 'server_error', detail: listErr.message }, 500)
  const target = list.users.find((u) => u.email?.toLowerCase() === email)
  if (!target) return json({ error: 'user_not_found' }, 404)

  // --- 5. 重置 ---
  const { error: updErr } = await admin.auth.admin.updateUserById(target.id, {
    password: newPassword,
  })
  if (updErr) return json({ error: 'reset_failed', detail: updErr.message }, 400)

  await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action: 'reset_password',
    target_user_id: target.id,
    detail: { email },
  })

  return json({ ok: true, userId: target.id })
})
