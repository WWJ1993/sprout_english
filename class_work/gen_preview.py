#!/usr/bin/env python3
"""为每节课生成可预览 HTML：读取 4 份 ReportDoc JSON，注入共享模板 preview.html。"""
import json
import pathlib
import sys

SKILL = pathlib.Path("/Users/wwj/.workbuddy/skills/english-class-analyzer/assets/preview.html")
WORK = pathlib.Path("/Users/wwj/Documents/workBuddy/sprout_english/class_work")
TEMPLATE = SKILL.read_text(encoding="utf-8")

TABS = {
    "report": "课程分析报告",
    "vocab": "句式与词汇分析",
    "qa": "问答分析",
    "plan": "三天练习计划",
}

dates = sys.argv[1:] or ["20261024", "20261027"]
for date in dates:
    reports = {}
    for tab, name in TABS.items():
        p = WORK / f"{date}-{name}.json"
        reports[tab] = json.loads(p.read_text(encoding="utf-8"))
    out = TEMPLATE.replace("/*__REPORTS__*/null", json.dumps(reports, ensure_ascii=False))
    dst = WORK / f"preview_{date}.html"
    dst.write_text(out, encoding="utf-8")
    print(f"已生成 {dst}  ({len(out)} bytes)")
