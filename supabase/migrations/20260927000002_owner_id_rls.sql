-- =============================================================
-- Sprout English · 登录与账号体系 · 迁移 2/2
-- 作用：业务表加 owner_id + 开启 RLS
-- ！！！执行前提：主账号已注册，<主账号UID> 必须替换成真实 UUID
-- ！！！执行前必须先备份 students / courses / course_reports / practice
-- =============================================================

-- ---------- 0. 备份（在 SQL Editor 里执行一次，生成快照表） ----------
-- create table backup_students_20260927      as table public.students;
-- create table backup_courses_20260927       as table public.courses;
-- create table backup_course_reports_20260927 as table public.course_reports;
-- create table backup_practice_20260927      as table public.practice;

-- ---------- 1. 迁移前条数（记下来，迁移后要一模一样） ----------
-- 学生 1 · 课程 13 · 报告 53 · 练习 107
-- select 'students', count(*) from public.students
-- union all select 'courses', count(*) from public.courses
-- union all select 'course_reports', count(*) from public.course_reports
-- union all select 'practice', count(*) from public.practice;

-- ---------- 2. 加列 ----------
alter table public.students add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.courses  add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.practice add column if not exists owner_id uuid references auth.users(id) on delete cascade;

-- ---------- 3. 回填（把下面这一行替换成真实 UID 后再跑） ----------
-- update public.students set owner_id = '<主账号UID>' where owner_id is null;
-- update public.courses  set owner_id = '<主账号UID>' where owner_id is null;
-- update public.practice set owner_id = '<主账号UID>' where owner_id is null;

-- ---------- 4. 后续写入自动带 owner ----------
alter table public.students alter column owner_id set default auth.uid();
alter table public.courses  alter column owner_id set default auth.uid();
alter table public.practice alter column owner_id set default auth.uid();

create index if not exists students_owner_idx on public.students(owner_id);
create index if not exists courses_owner_idx  on public.courses(owner_id);
create index if not exists practice_owner_idx on public.practice(owner_id);

-- ---------- 5. 开启 RLS（执行后，未登录/owner 不匹配的行立刻不可见） ----------
alter table public.students       enable row level security;
alter table public.courses        enable row level security;
alter table public.practice       enable row level security;
alter table public.course_reports enable row level security;

-- 直属于 owner 的三张表
drop policy if exists own_rows on public.students;
create policy own_rows on public.students
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists own_rows on public.courses;
create policy own_rows on public.courses
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists own_rows on public.practice;
create policy own_rows on public.practice
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- course_reports 无 owner_id，经 course_id 关联鉴权
drop policy if exists own_rows_via_course on public.course_reports;
create policy own_rows_via_course on public.course_reports
  for all to authenticated
  using (
    exists (select 1 from public.courses c
            where c.id = course_reports.course_id and c.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.courses c
            where c.id = course_reports.course_id and c.owner_id = auth.uid())
  );

-- ---------- 6. 迁移后核对（必须与步骤 1 的数字一致，且 NULL 数为 0） ----------
-- select 'students', count(*) from public.students
-- union all select 'courses', count(*) from public.courses
-- union all select 'course_reports', count(*) from public.course_reports
-- union all select 'practice', count(*) from public.practice;
-- select count(*) as null_owner from public.courses where owner_id is null;

-- ---------- 7. 回滚（真出问题时用） ----------
-- alter table public.students       disable row level security;
-- alter table public.courses        disable row level security;
-- alter table public.practice       disable row level security;
-- alter table public.course_reports disable row level security;
