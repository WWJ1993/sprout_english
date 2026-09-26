# Sprout English — 部署与数据库维护手册

## 项目概览

| 项目 | 地址 |
|---|---|
| 线上应用 | https://sprout-english.pages.dev |
| GitHub 仓库 | https://github.com/WWJ1993/sprout_english |
| Supabase 控制台 | https://supabase.com/dashboard/project/ibqfaouryxjctzvpdpgf |
| Cloudflare Pages | https://dash.cloudflare.com → Workers & Pages → sprout-english |

---

## 技术栈

- **前端**：React + Vite + TypeScript + Tailwind CSS v4
- **数据库**：Supabase（PostgreSQL，东京节点 ap-northeast-1）
- **托管**：Cloudflare Pages（静态文件，全球 CDN）
- **CI/CD**：GitHub push → Cloudflare Pages 自动构建部署

---

## 数据库结构

### `students` 表

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 主键，如 `mera` |
| name | text | 学生姓名 |
| age | integer | 年龄 |
| created_at | timestamptz | 创建时间 |

### `courses` 表

| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigint | 主键 |
| student_id | text | 关联 students.id（级联删除）|
| date | text | 上课日期，如 `2026-08-25` |
| teacher | text | 外教姓名 |
| student | text | 学生姓名（冗余存储）|
| topic | text | 课程主题 |
| duration | integer | 时长（分钟）|
| rate | integer | 正确率（0-100）|
| good | jsonb | 亮点数组 |
| weak | jsonb | 薄弱点数组 |
| transcript | text | 纯文本转录（可为空）|
| transcript_ts | text | 带时间戳转录，格式 `[MM:SS - MM:SS] text` |
| uploaded_at | timestamptz | 上传时间 |

### `course_reports` 表

| 字段 | 类型 | 说明 |
|---|---|---|
| course_id | bigint | 关联 courses.id（级联删除）|
| tab | text | 报告类型：`report` / `vocab` / `qa` / `plan` |
| content | text | 报告内容。**新报告为结构化 JSON**（由前端 `src/lib/reportTemplates.ts` 的 `renderReport` 按模板渲染，CSS 统一定义在 `src/lib/report.css`）；**旧报告为完整 HTML 字符串**（前端回退为 iframe 展示）。两种格式 `ReportRenderer` 均兼容。|

> 主键为 (course_id, tab)。reports 从 courses 表拆出独立存储，按 tab 按需加载，避免一次拉取 ~85KB 数据。
> 数据驱动渲染：模板只写一份，content 仅存结构化数据，单课 4 份报告体积从 ~85KB(HTML) 降至 ~36KB(JSON)。

### `practice` 表

| 字段 | 类型 | 说明 |
|---|---|---|
| ts | bigint | 主键，Unix 时间戳（毫秒）|
| student_id | text | 关联 students.id（级联删除）|
| correct | boolean | 是否答对 |
| point | text | 语法点名称 |
| mode | text | `smart` 或 `random` |

### RLS 说明

所有表均**禁用 Row Level Security**（纯内网工具，无需行级权限）。如需启用请在 Supabase 控制台 Authentication → Policies 配置。

---

## 环境变量

| 变量名 | 说明 |
|---|---|
| `VITE_SUPABASE_URL` | `https://ibqfaouryxjctzvpdpgf.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_2ZXmFuIo_nmFzt2KaNDFvQ_-5iyx14o` |

- 本地开发：写在 `app/.env`（已加入 `.gitignore`，不会提交）
- 生产环境：在 Cloudflare Pages → Settings → Environment Variables 中配置

---

## 本地开发

```bash
cd app
npm install
npm run dev      # 启动开发服务器 http://localhost:5173
npm run build    # 构建生产包到 dist/
```

---

## 部署流程

### 自动部署（推荐）

```bash
git add -A
git commit -m "your message"
git push
```

push 到 `main` 分支后，Cloudflare Pages 自动触发构建和部署，约 1-2 分钟完成。

### 手动触发

Cloudflare Pages 控制台 → sprout-english → Deployments → Create deployment。

---

## 数据维护

### 新增课程

在应用内上传 `.json` 数据包（由 claude skill 生成），格式见 `skill/SKILL.md`。

### 数据库备份

Supabase 免费版提供 7 天自动备份。手动导出：
```sql
-- 在 Supabase SQL Editor 执行
copy (select * from courses) to stdout with csv header;
```

### 免费版限制

- 数据库超过 **7 天不活跃**会自动暂停，首次请求需等待唤醒（5-15 秒）
- 存储上限：500MB
- 如需避免暂停，升级至 Pro（$25/月）或设置定期 ping

### 种子数据

首次打开应用时，从 `public/courses.json` 自动导入 8 节示例课程（归属学生 Mera）。已导入后通过 `localStorage.__wbSeedVersion = 'v1'` 标记，不会重复导入。

---

## 常见问题

**Q: 页面一直显示"加载中"**
A: Supabase 冷启动，等待 10-15 秒后刷新。

**Q: 上传课程数据失败**
A: 检查 JSON 格式是否包含 `date` 字段，以及是否符合 skill 输出的数据包格式。

**Q: Cloudflare 没有自动部署**
A: 检查 GitHub 连接：Cloudflare Pages → Settings → Git repository → 重新授权。
