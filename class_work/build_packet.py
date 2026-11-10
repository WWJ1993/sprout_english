#!/usr/bin/env python3
"""组装课程数据包：读取 4 份 ReportDoc JSON + 转录 + 元数据，输出可上传的 packet.json。

用法:
  python build_packet.py <date> <workdir> <meta_json>

其中:
  - <workdir>/<date>-课程分析报告.json    -> tab report
  - <workdir>/<date>-句式与词汇分析.json  -> tab vocab
  - <workdir>/<date>-问答分析.json        -> tab qa
  - <workdir>/<date>-三天练习计划.json    -> tab plan
  - <workdir>/<date>_transcript_full.txt        -> transcript
  - <workdir>/<date>_transcript_timestamped.txt -> transcript_ts
  - meta_json: {"id","date","teacher","student","topic","duration","rate","good":[],"weak":[]}

输出: <workdir>/<date>-packet.json
"""
import json
import sys


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def main():
    if len(sys.argv) < 4:
        print("用法: python build_packet.py <date> <workdir> <meta_json>")
        sys.exit(1)
    date, workdir, meta_path = sys.argv[1], sys.argv[2], sys.argv[3]
    meta = json.load(open(meta_path, encoding="utf-8"))

    tabs = {
        "report": f"{date}-课程分析报告.json",
        "vocab": f"{date}-句式与词汇分析.json",
        "qa": f"{date}-问答分析.json",
        "plan": f"{date}-三天练习计划.json",
    }
    reports = {}
    for t, fname in tabs.items():
        p = f"{workdir}/{fname}"
        reports[t] = read(p).strip()

    packet = {
        "id": meta["id"],
        "date": meta["date"],
        "teacher": meta["teacher"],
        "student": meta.get("student", "Mera"),
        "topic": meta["topic"],
        "duration": meta["duration"],
        "rate": meta["rate"],
        "good": meta.get("good", []),
        "weak": meta.get("weak", []),
        "transcript": read(f"{workdir}/{date}_transcript_full.txt").strip(),
        "transcript_ts": read(f"{workdir}/{date}_transcript_timestamped.txt").strip(),
        "reports": reports,
    }

    out = f"{workdir}/{date}-packet.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(packet, f, ensure_ascii=False, indent=2)
    print(f"已生成 {out}")


if __name__ == "__main__":
    main()
