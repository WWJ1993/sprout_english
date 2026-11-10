// 单课 AI 陪练提示词 · 真实数据预览
// 用法：node class_work/gen_prompt_preview.mjs
// 产物：class_work/prompt_preview/*.md 与 index.html（4 节课并排切换）
//
// 直接用 esbuild 把 TS 模块编到内存再 import，不改动项目源码、不依赖构建产物。

import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ts from 'typescript'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const OUT = path.join(HERE, 'prompt_preview')
mkdirSync(OUT, { recursive: true })

// 生成模块的所有 import 都是 type-only，转译后是零依赖的纯 ESM，可直接 data: import
const source = readFileSync(path.join(ROOT, 'src/lib/lessonPromptGen.ts'), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { generateLessonPrompt } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
)

const packets = readdirSync(HERE)
  .filter(f => /^\d{8}-packet\.json$/.test(f))
  .sort()

const items = []
for (const file of packets) {
  const course = JSON.parse(readFileSync(path.join(HERE, file), 'utf8'))
  const { prompt, source } = generateLessonPrompt({
    course,
    reports: course.reports,
    student: { name: course.student || 'Mera', age: 7 },
  })
  const mdName = `${course.date}-AI陪练提示词.md`
  writeFileSync(path.join(OUT, mdName), prompt, 'utf8')
  items.push({ date: course.date, teacher: course.teacher, topic: course.topic, rate: course.rate, prompt, source, mdName })
  console.log(
    `${course.date} ${course.teacher} | ${prompt.length} 字符 | 句型 ${source.patterns} / 词汇 ${source.vocabWords} / 纠错对 ${source.errorPairs} / 错误问答 ${source.qaErrors} / 脚本 ${source.practicePairs}` +
    (source.warnings.length ? ` | ⚠ ${source.warnings.join('；')}` : '')
  )
}

// 内容统一用 textContent 写入，避免 HTML 转义；这里只需防 </script> 提前闭合
const payload = JSON.stringify(items).replace(/</g, '\\u003c')

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>单课 AI 外教陪练提示词 · 预览</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; background:#f5f7fa; color:#1f2937; font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif; }
  .wrap { max-width:1080px; margin:0 auto; padding:28px 20px 60px; }
  h1 { font-size:20px; margin:0 0 6px; }
  .lead { font-size:13px; color:#6b7280; margin:0 0 20px; line-height:1.7; }
  .tabs { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
  .tab { border:1px solid #e5e7eb; background:#fff; color:#4b5563; border-radius:10px; padding:8px 14px; font-size:13px; cursor:pointer; transition:.15s; }
  .tab:hover { border-color:#a5b4fc; }
  .tab.on { background:#4f46e5; border-color:#4f46e5; color:#fff; font-weight:600; }
  .card { background:#fff; border:1px solid #eceef2; border-radius:16px; box-shadow:0 1px 3px rgba(0,0,0,.04); overflow:hidden; }
  .head { padding:18px 20px; border-bottom:1px solid #f0f1f4; }
  .head h2 { font-size:15px; margin:0 0 6px; line-height:1.5; }
  .head p { font-size:12px; color:#9ca3af; margin:0; }
  .badges { display:flex; gap:8px; flex-wrap:wrap; padding:12px 20px; background:#fafbfe; border-bottom:1px solid #f0f1f4; }
  .badge { font-size:11px; color:#4338ca; background:#eef2ff; border-radius:999px; padding:4px 10px; }
  .badge.warn { color:#b45309; background:#fffbeb; }
  .bar { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 20px; border-bottom:1px solid #f0f1f4; }
  .bar span { font-size:12px; color:#9ca3af; }
  .copy { border:0; background:#4f46e5; color:#fff; border-radius:9px; padding:8px 16px; font-size:12px; font-weight:600; cursor:pointer; }
  .copy.ok { background:#059669; }
  pre { margin:0; padding:20px; max-height:62vh; overflow:auto; font-size:12.5px; line-height:1.8; white-space:pre-wrap; word-break:break-word;
        font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; color:#374151; background:#fff; }
  .foot { font-size:12px; color:#9ca3af; margin-top:14px; line-height:1.7; }
</style>
</head>
<body>
<div class="wrap">
  <h1>单课 AI 外教陪练提示词 · 真实数据预览</h1>
  <p class="lead">基于 4 节课的结构化报告自动生成，纯规则拼装、不调用 AI 接口。切换 tab 看每节课的提示词；内容会随课程数据变化，同一节课结果稳定可复现。</p>
  <div class="tabs" id="tabs"></div>
  <div class="card">
    <div class="head"><h2 id="title"></h2><p id="sub"></p></div>
    <div class="badges" id="badges"></div>
    <div class="bar"><span id="usage"></span><button class="copy" id="copy">📋 复制提示词</button></div>
    <pre id="body"></pre>
  </div>
  <p class="foot">素材来源：句式词汇报告（句型 / 词汇 / 纠错对照表）、课程分析报告（复习速查卡）、问答分析（真实错误问答）、三天练习计划（问答脚本）。缺报告时自动降级并在上方标出。</p>
</div>
<script>
const DATA = ${payload};
let idx = 0;
const tabs = document.getElementById('tabs');
DATA.forEach((d, i) => {
  const b = document.createElement('button');
  b.className = 'tab' + (i === 0 ? ' on' : '');
  b.textContent = d.date + ' · ' + d.teacher;
  b.onclick = () => { idx = i; render(); };
  tabs.appendChild(b);
});
function render() {
  const d = DATA[idx];
  [...tabs.children].forEach((b, i) => b.className = 'tab' + (i === idx ? ' on' : ''));
  document.getElementById('title').textContent = d.date + ' · ' + d.topic;
  document.getElementById('sub').textContent = '外教 ' + d.teacher + ' · 课堂正确率 ' + d.rate + '% · 提示词 ' + d.prompt.length + ' 字符';
  const s = d.source;
  const parts = [
    '使用报告 ' + s.used.length + '/4', '目标句型 ' + s.patterns, '目标词汇 ' + s.vocabWords,
    '纠错对照 ' + s.errorPairs, '真实错误问答 ' + s.qaErrors, '练习脚本 ' + s.practicePairs
  ].map(t => '<span class="badge">' + t + '</span>');
  s.warnings.forEach(w => parts.push('<span class="badge warn">⚠ ' + w.replace(/</g,'&lt;') + '</span>'));
  document.getElementById('badges').innerHTML = parts.join('');
  document.getElementById('usage').textContent = '复制后粘贴到豆包 / ChatGPT / Claude 的自定义指令或新对话首条消息';
  document.getElementById('body').textContent = d.prompt;
  const btn = document.getElementById('copy');
  btn.textContent = '📋 复制提示词'; btn.className = 'copy';
}
document.getElementById('copy').onclick = async () => {
  const btn = document.getElementById('copy');
  try {
    await navigator.clipboard.writeText(DATA[idx].prompt);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = DATA[idx].prompt; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
  btn.textContent = '✅ 已复制'; btn.className = 'copy ok';
  setTimeout(() => { btn.textContent = '📋 复制提示词'; btn.className = 'copy'; }, 1800);
};
render();
</script>
</body>
</html>`

writeFileSync(path.join(OUT, 'index.html'), html, 'utf8')
console.log(`\n✅ 已生成 ${items.length} 份提示词 + index.html → ${OUT}`)
