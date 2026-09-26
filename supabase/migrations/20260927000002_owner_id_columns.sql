-- =============================================================
-- Sprout English · 登录与账号体系 · 迁移 2/3
-- 作用：业务表加 owner_id 列（只加列，不影响现有访问）
-- 安全性：加了列但没开 RLS，线上站点完全不受影响，可随时执行
-- =============================================================

alter table public.students add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.courses  add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.practice add column if not exists owner_id uuid references auth.users(id) on delete cascade;

-- 后续写入自动带上当前登录用户
alter table public.students alter column owner_id set default auth.uid();
alter table public.courses  alter column owner_id set default auth.uid();
alter table public.practice alter column owner_id set default auth.uid();

create index if not exists students_owner_idx on public.students(owner_id);
create index if not exists courses_owner_idx  on public.courses(owner_id);
create index if not exists practice_owner_idx on public.practice(owner_id);

-- 回滚（如需）：
-- alter table public.students drop column if exists owner_id;
-- alter table public.courses  drop column if exists owner_id;
-- alter table public.practice drop column if exists owner_id;
