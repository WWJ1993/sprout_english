// Sprout English · 管理员生成 / 列出 / 撤销邀请码
// 部署：supabase functions deploy admin-invite   （默认校验 JWT）

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

function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉易混字符 I/O/0/1
  const part = (n: number) =>
    Array.from(crypto.getRandomValues(new Uint8Array(n)))
      .map((v) => alphabet[v % alphabet.length])
      .join('')
  return `SE-${part(4)}-${part(4)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)

  const url = Deno.env.get('SUPABASE_URL')!

  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: userData, error: userErr } = await caller.auth.getUser()
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401)
  const adminId = userData.user.id

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', adminId)
    .maybeSingle()
  if (!profile?.is_admin) return json({ error: 'forbidden' }, 403)

  let action = 'list'
  let count = 1
  let code = ''
  let days = 7
  try {
    const body = await req.json()
    action = String(body.action ?? 'list')
    count = Math.min(Math.max(Number(body.count ?? 1), 1), 50)
    code = String(body.code ?? '').trim()
    days = Math.min(Math.max(Number(body.days ?? 7), 1), 365)
  } catch {
    // 空 body 视为 list
  }

  // --- 生成 ---
  if (action === 'create') {
    const rows = Array.from({ length: count }, () => ({
      code: randomCode(),
      created_by: adminId,
      expires_at: new Date(Date.now() + days * 86400_000).toISOString(),
    }))
    const { data, error } = await admin.from('invite_codes').insert(rows).select()
    if (error) return json({ error: 'create_failed', detail: error.message }, 400)

    await admin.from('admin_audit_log').insert({
      admin_id: adminId,
      action: 'invite_create',
      detail: { count, days },
    })
    return json({ codes: data })
  }

  // --- 撤销 ---
  if (action === 'revoke') {
    if (!code) return json({ error: 'bad_request' }, 400)
    const { error } = await admin.from('invite_codes').delete().eq('code', code).is('used_by', null)
    if (error) return json({ error: 'revoke_failed', detail: error.message }, 400)

    await admin.from('admin_audit_log').insert({
      admin_id: adminId,
      action: 'invite_revoke',
      detail: { code },
    })
    return json({ ok: true })
  }

  // --- 列出 ---
  const { data, error } = await admin
    .from('invite_codes')
    .select('code, created_at, expires_at, used_by, used_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return json({ error: 'list_failed', detail: error.message }, 400)
  return json({ codes: data })
})
