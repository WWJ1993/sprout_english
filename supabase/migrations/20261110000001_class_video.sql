-- =============================================================
-- Sprout English · 课程视频字段 · 迁移
-- 作用：courses 表增加 video_url 列；创建公开存储桶 class-videos 存放课程视频
-- 安全性：仅加列 + 建桶，不影响现有访问；可随时执行
-- =============================================================

alter table public.courses add column if not exists video_url text;

create index if not exists courses_video_idx on public.courses(video_url) where video_url is not null;

-- 公开存储桶：课程视频（网页 <video> 直接播放，无需鉴权）
-- 注意：在 Supabase 控制台 Storage 中创建桶 class-videos（Public），或执行以下 SQL 通过 API 创建：
-- insert into storage.buckets (id, name, public) values ('class-videos', 'class-videos', true)
-- on conflict (id) do nothing;

-- 回滚（如需）：
-- alter table public.courses drop column if exists video_url;
-- delete from storage.buckets where id = 'class-videos';
