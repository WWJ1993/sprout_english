#!/usr/bin/env python3
"""上传课程数据包到 Supabase（直写 REST API，使用账户会话 token 认证）。

读取 skill 生成的课程数据包（单 JSON 对象），分别写入：
  - courses 表（主记录）
  - course_reports 表（4 份报告，按 (course_id, tab) upsert）

数据包格式（见 english-class-analyzer SKILL.md）：
{
  "id": 25, "date": "2026-10-24", "teacher": "Bibi", "student": "Mera",
  "topic": "...", "duration": 26, "rate": 88,
  "good": [...], "weak": [...],
  "transcript": "...", "transcript_ts": "...",
  "reports": { "report": "{...}", "vocab": "{...}", "qa": "{...}", "plan": "{...}" }
}
reports 的值是 ReportDoc 的 JSON 字符串（二次序列化）。
"""
import json
import os
import sys
import time
import urllib.request

SUPABASE_URL = "https://ibqfaouryxjctzvpdpgf.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_2ZXmFuIo_nmFzt2KaNDFvQ_-5iyx14o"
STUDENT_ID = "mera"

# 账户凭据（用于获取会话 token，认证写入）
AUTH_EMAIL = "1042086283@qq.com"
# 密码从环境变量读取，避免明文落入 git 历史；运行前: export SUPABASE_AUTH_PASSWORD=你的密码
AUTH_PASSWORD = os.environ.get("SUPABASE_AUTH_PASSWORD")
if not AUTH_PASSWORD:
    raise SystemExit("缺少环境变量 SUPABASE_AUTH_PASSWORD（Supabase 账户密码），请先 export 后再运行。")


def _request(method, url, body=None, headers=None, prefer=None):
    h = dict(headers or {})
    if prefer:
        h["Prefer"] = prefer
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        h.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")


def get_session_token():
    """用邮箱密码登录，返回 access_token。"""
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    headers = {"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"}
    status, body = _request(
        "POST", url,
        {"email": AUTH_EMAIL, "password": AUTH_PASSWORD},
        headers=headers,
    )
    if status != 200:
        raise RuntimeError(f"登录失败 HTTP {status}: {body}")
    return json.loads(body)["access_token"]


def main():
    if len(sys.argv) < 2:
        print("用法: python upload_packet.py <packet.json> [packet2.json ...]")
        sys.exit(1)

    token = get_session_token()
    print("✓ 已登录，获得会话 token")

    auth_headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token}",
    }

    for path in sys.argv[1:]:
        pkt = json.load(open(path, encoding="utf-8"))
        cid = pkt["id"]
        print(f"\n=== 上传课程 id={cid} ({pkt.get('date')} {pkt.get('teacher')}) ===")

        # 1) courses 主记录
        course_row = {
            "id": cid,
            "student_id": STUDENT_ID,
            "date": pkt["date"],
            "teacher": pkt["teacher"],
            "student": pkt.get("student", "Mera"),
            "topic": pkt["topic"],
            "duration": pkt["duration"],
            "rate": pkt["rate"],
            "good": pkt.get("good", []),
            "weak": pkt.get("weak", []),
            "transcript": pkt.get("transcript", ""),
            "transcript_ts": pkt.get("transcript_ts", ""),
            "uploaded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        st, body = _request(
            "POST", f"{SUPABASE_URL}/rest/v1/courses?on_conflict=id",
            course_row, headers=auth_headers,
            prefer="resolution=merge-duplicates,return=representation",
        )
        print(f"  courses: HTTP {st}  {'OK' if st in (200,201) else body}")

        # 2) course_reports 4 份
        tabs = ["report", "vocab", "qa", "plan"]
        rows = []
        for t in tabs:
            content = pkt["reports"].get(t)
            if content is None:
                print(f"  跳过 {t}（无内容）")
                continue
            if not isinstance(content, str):
                content = json.dumps(content, ensure_ascii=False)
            rows.append({"course_id": cid, "tab": t, "content": content})

        if rows:
            st, body = _request(
                "POST",
                f"{SUPABASE_URL}/rest/v1/course_reports?on_conflict=course_id,tab",
                rows, headers=auth_headers,
                prefer="resolution=merge-duplicates",
            )
            print(f"  course_reports: HTTP {st}  {'OK' if st in (200,201) else body}")

        print(f"=== id={cid} 上传完成 ===")


if __name__ == "__main__":
    main()
