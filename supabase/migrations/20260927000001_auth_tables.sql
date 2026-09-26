-- =============================================================
-- Sprout English · 登录与账号体系 · 迁移 1/2
-- 作用：新建账号体系表 + 触发器，与业务表解耦，可安全先跑
-- 执行位置：Supabase Dashboard → SQL Editor（或 supabase db push）
-- =============================================================

-- ---------- 1. 用户扩展信息（admin 标记位） ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------- 2. 邀请码 ----------
create table if not exists public.invite_codes (
  code       text primary key,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_by    uuid references auth.users(id) on delete set null,
  used_at    timestamptz
);

create index if not exists invite_codes_used_by_idx on public.invite_codes(used_by);

-- ---------- 3. 管理员操作审计 ----------
create table if not exists public.admin_audit_log (
  id             bigserial primary key,
  admin_id       uuid references auth.users(id) on delete set null,
  action         text not null,
  target_user_id uuid,
  detail         jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on public.admin_audit_log(created_at desc);

-- ---------- 4. 新用户自动建 profiles（SECURITY DEFINER，绕过 RLS） ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 5. 便捷函数：判断当前请求者是否 admin ----------
--   说明：标记 stable + security definer，避免在 RLS 策略里递归查 profiles 造成无限递归
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  );
$$;

-- ---------- 6. 新表开启 RLS ----------
alter table public.profiles        enable row level security;
alter table public.invite_codes    enable row level security;
alter table public.admin_audit_log enable row level security;

-- profiles：本人可读写自己；admin 可读写全部
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- 注意：is_admin 只能由服务端（service_role）改，普通用户更新时强制保持原值
drop policy if exists profiles_no_self_promote on public.profiles;
create policy profiles_no_self_promote on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid()));

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- invite_codes：仅 admin
drop policy if exists invite_codes_admin_only on public.invite_codes;
create policy invite_codes_admin_only on public.invite_codes
  for all using (public.is_admin()) with check (public.is_admin());

-- admin_audit_log：仅 admin 可读；写入由 Edge Function（service_role）完成
drop policy if exists audit_admin_read on public.admin_audit_log;
create policy audit_admin_read on public.admin_audit_log
  for select using (public.is_admin());

-- ---------- 7. 预置初始邀请码（可自行改字符串） ----------
insert into public.invite_codes (code, expires_at)
values ('BOOT-2026', now() + interval '30 days')
on conflict (code) do nothing;
