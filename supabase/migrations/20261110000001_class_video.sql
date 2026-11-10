-- =============================================================
-- Sprout English · 课程视频字段 · 迁移
-- 作用：courses 表增加 video_url 列；创建公开存储桶 class-videos（网页 <video> 直接播放）
-- 安全性：仅加列 + 建桶 + 存储策略，不影响现有访问；可随时执行
-- 执行方式：在 Supabase 控制台 SQL Editor 粘贴运行，或 supabase db push
-- =============================================================

alter table public.courses add column if not exists video_url text;

create index if not exists courses_video_idx on public.courses(video_url) where video_url is not null;

-- 公开存储桶：课程视频（网页 <video> 直接播放，无需鉴权）
insert into storage.buckets (id, name, public)
values ('class-videos', 'class-videos', true)
on conflict (id) do nothing;

-- 允许已登录用户向 class-videos 桶写入/更新（读取对所有人公开，无需策略）
drop policy if exists "class-videos insert" on storage.objects;
create policy "class-videos insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'class-videos');
drop policy if exists "class-videos update" on storage.objects;
create policy "class-videos update" on storage.objects
  for update to authenticated with check (bucket_id = 'class-videos');

-- 回滚（如需）：
-- alter table public.courses drop column if exists video_url;
-- delete from storage.buckets where id = 'class-videos';
-- drop policy if exists "class-videos insert" on storage.objects;
-- drop policy if exists "class-videos update" on storage.objects;
