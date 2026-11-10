#!/usr/bin/env python3
"""生成视频批量上传 manifest：把 ~/Downloads 里的外教课视频按日期匹配 courses.id。

输出 manifest.json：[{"course_id":27,"video":"/abs/path.MP4","name":"course-27.mp4"}, ...]
用法：python build_manifest.py [--downloads DIR] [--out manifest.json]
依赖 Supabase 可达（读取 courses 的 date→id 映射）。
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error

SUPABASE_URL = "https://ibqfaouryxjctzvpdpgf.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_2ZXmFuIo_nmFzt2KaNDFvQ_-5iyx14o"
AUTH_EMAIL = "1042086283@qq.com"
# 密码从环境变量读取，避免明文落入 git 历史；运行前: export SUPABASE_AUTH_PASSWORD=你的密码
AUTH_PASSWORD = os.environ.get("SUPABASE_AUTH_PASSWORD")
if not AUTH_PASSWORD:
    raise SystemExit("缺少环境变量 SUPABASE_AUTH_PASSWORD（Supabase 账户密码），请先 export 后再运行 build_manifest.py。")


def _http(method, url, body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    h = dict(headers or {})
    if data is not None:
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.read().decode()


def get_token():
    st, body = _http("POST", f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                    {"email": AUTH_EMAIL, "password": AUTH_PASSWORD},
                    {"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"})
    if st != 200:
        raise RuntimeError(f"登录失败 {st}: {body}")
    return json.loads(body)["access_token"]


def get_courses(token):
    auth = {"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"}
    st, body = _http("GET", f"{SUPABASE_URL}/rest/v1/courses?select=id,date&order=date",
                     headers=auth)
    if st != 200:
        raise RuntimeError(f"读取课程失败 {st}: {body}")
    return json.loads(body)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--downloads", default=os.path.expanduser("~/Downloads"))
    ap.add_argument("--out", default="manifest.json")
    args = ap.parse_args()

    token = get_token()
    courses = get_courses(token)
    date_to_id = {}
    for c in courses:
        # date 形如 2026-10-24
        m = re.search(r"(\d{4}-\d{2}-\d{2})", c.get("date", ""))
        if m:
            date_to_id[m.group(1)] = c["id"]

    videos = []
    for fn in sorted(os.listdir(args.downloads)):
        if not fn.lower().endswith(".mp4"):
            continue
        m = re.search(r"(\d{4})(\d{2})(\d{2})", fn)
        if not m:
            print(f"  跳过（文件名无日期）: {fn}")
            continue
        y, mo, d = m.groups()
        date = f"{y}-{mo}-{d}"
        cid = date_to_id.get(date)
        if cid is None:
            print(f"  ⚠️ {fn} 在 courses 中无匹配日期（{date}），跳过")
            continue
        videos.append({"course_id": cid, "video": os.path.join(args.downloads, fn),
                       "name": f"course-{cid}.mp4"})
        print(f"  匹配: {fn} → course_id={cid}")

    json.dump(videos, open(args.out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    total = sum(os.path.getsize(v["video"]) for v in videos if os.path.exists(v["video"]))
    print(f"\n✓ 生成 {args.out}：{len(videos)} 个视频，约 {total//1024//1024} MB")


if __name__ == "__main__":
    main()
