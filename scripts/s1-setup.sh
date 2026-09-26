#!/usr/bin/env bash
# =============================================================
# Sprout English · 登录系统 · S1 服务端搭建
# 作用：建账号表 → 业务表加 owner_id 列 → 部署 3 个 Edge Function → 配 service_role
# 前置：supabase login 已完成（access token 已保存）
# =============================================================
set -euo pipefail

export PATH="/Users/wwj/.npm-global/bin:$PATH"
cd /Users/wwj/WorkBuddy/workbuddy-v2/app

echo "──────── 0/4 校验 CLI 与登录状态 ────────"
supabase --version
supabase projects list || {
  echo "未登录。请先执行：supabase login --token <dashboard 生成的 access token>"
  exit 1
}

echo "──────── 1/4 建表 + 加 owner_id 列（迁移 01、02）────────"
supabase db push --yes

echo "──────── 2/4 部署 Edge Function ────────"
supabase functions deploy signup-with-invite --no-verify-jwt
supabase functions deploy admin-reset-password
supabase functions deploy admin-invite

echo "──────── 3/4 配置 service_role 密钥 ────────"
printf '粘贴 service_role key（不回显，回车确认）: '
read -rs SRK
echo
if [ -z "$SRK" ]; then
  echo "密钥为空，跳过。稍后单独执行：supabase secrets set SERVICE_ROLE_KEY=<key>"
else
  supabase secrets set SERVICE_ROLE_KEY="$SRK"
fi

echo "──────── 4/4 校验 ────────"
supabase secrets list
supabase functions list

echo
echo "S1 完成。下一步：到线上 https://sprout-english.pages.dev/#/register 用邀请码 BOOT-2026 注册主账号"
echo "（若线上还没发布 feat/auth，可先本地 npx vite preview 访问 http://127.0.0.1:4173/#/register ）"
