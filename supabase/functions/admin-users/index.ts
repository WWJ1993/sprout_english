// Sprout English · 管理员：列出所有用户
// 部署：supabase functions deploy admin-users   （默认校验 JWT）
// 安全：用调用者自带 JWT 反查身份 → 校验 profiles.is_admin → 才用 service_role 查全量
// 说明：auth.users 与他人的业务数据在 RLS 下对前端不可见，只能走这里

import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

interface Row {
  id: string
  email: string
  display_name: string | null
  is_admin: boolean
  created_at: string
  last_sign_in_at: string | null
  email_confirmed: boolean
  courses: number
  practice: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // --- 1. 调用者身份 ---
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
      action: 'list_users_denied',
      detail: { reason: 'not_admin' },
    })
    return json({ error: 'forbidden' }, 403)
  }

  // --- 3. 列用户 ---
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listErr) return json({ error: 'server_error', detail: listErr.message }, 500)

  // --- 4. profile 表补全（display_name / is_admin） ---
  const { data: profiles } = await admin.from('profiles').select('id, display_name, is_admin')
  const pmap = new Map<string, { display_name: string | null; is_admin: boolean }>(
    (profiles ?? []).map((p: { id: string; display_name: string | null; is_admin: boolean }) => [
      p.id,
      p,
    ]),
  )

  // --- 5. 各用户的课程数 / 练习数（RLS 下前端查不到别人的，只能这里统计） ---
  const { data: courseRows } = await admin.from('courses').select('owner_id')
  const { data: practiceRows } = await admin.from('practice').select('owner_id')
  const tally = (rows: { owner_id: string | null }[] | null) => {
    const m = new Map<string, number>()
    for (const r of rows ?? []) {
      if (!r.owner_id) continue
      m.set(r.owner_id, (m.get(r.owner_id) ?? 0) + 1)
    }
    return m
  }
  const courseMap = tally(courseRows)
  const practiceMap = tally(practiceRows)

  const users: Row[] = list.users.map((u) => {
    const p = pmap.get(u.id)
    return {
      id: u.id,
      email: u.email ?? '—',
      display_name: p?.display_name ?? null,
      is_admin: p?.is_admin ?? false,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      email_confirmed: !!u.email_confirmed_at,
      courses: courseMap.get(u.id) ?? 0,
      practice: practiceMap.get(u.id) ?? 0,
    }
  })

  users.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  await admin.from('admin_audit_log').insert({
    admin_id: adminId,
    action: 'list_users',
    detail: { count: users.length },
  })

  return json({ users })
})
