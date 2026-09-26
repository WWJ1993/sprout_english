-- =============================================================
-- Sprout English · 登录与账号体系 · 迁移 3/3
-- 作用：开启 RLS，让数据按 owner 隔离
-- ！！！执行前提（缺一不可，否则会导致数据全部不可见）！！！
--   1. 主账号已注册，且 owner_id 已回填到每一行
--   2. 已确认 select count(*) from public.courses where owner_id is null 结果为 0
--   3. 前端 feat/auth 已合并发布（用户能登录）
-- =============================================================

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

-- course_reports 无 owner_id，经 course_id 关联 courses 鉴权
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

-- 回滚（真出问题时用，执行后回到「所有人可见」的旧状态）：
-- alter table public.students       disable row level security;
-- alter table public.courses        disable row level security;
-- alter table public.practice       disable row level security;
-- alter table public.course_reports disable row level security;
