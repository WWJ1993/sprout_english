#!/usr/bin/env python3
"""S3：把主账号 UID 回填到业务表，并校验条数不变、无 NULL。

用法：
    python3 scripts/backfill_owner.py <主账号UID> [--apply] [--uid-only]

默认只做校验（dry-run），加 --apply 才真正写入。
说明：此刻 RLS 尚未开启，anon key 即可写入；脚本用 .env 里的 VITE_SUPABASE_ANON_KEY。
"""
import json
import sys
import urllib.error
import urllib.request

APP = "/Users/wwj/WorkBuddy/workbuddy-v2/app"
ENV = f"{APP}/.env"

TABLES = ["students", "courses", "practice"]
BASELINE = {"students": 1, "courses": 13, "practice": 107}


def load_env():
    cfg = {}
    with open(ENV) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip()
    return cfg


cfg = load_env()
URL = cfg["VITE_SUPABASE_URL"]
KEY = cfg["VITE_SUPABASE_ANON_KEY"]
HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
}

args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = {a for a in sys.argv[1:] if a.startswith("--")}
if not args:
    sys.exit("用法: python3 scripts/backfill_owner.py <主账号UID> [--apply]")
UID = args[0]
if len(UID) != 36:
    print(f"警告: UID 长度 {len(UID)}，通常应是 36 位 UUID，请确认")


def count(table, filt=""):
    """返回行数；列不存在时返回 None。"""
    url = f"{URL}/rest/v1/{table}?select=*{filt}"
    req = urllib.request.Request(url, headers={**HEADERS, "Prefer": "count=exact"})
    req.get_method = lambda: "HEAD"
    try:
        with urllib.request.urlopen(req) as r:
            cr = r.headers.get("content-range")
    except urllib.error.HTTPError as e:
        # 400 = 列不存在或过滤语法问题（owner_id 列尚未建立时就是这个）
        if e.code == 400:
            return None
        raise
    return int(cr.split("/")[-1]) if cr else 0


print("─── 迁移前条数 ───")
for t in TABLES:
    n = count(t)
    flag = "" if n == BASELINE[t] else f"  ⚠️ 基线是 {BASELINE[t]}"
    print(f"  {t:10s} {n:5d}{flag}")

print("\n─── 待回填（owner_id is null）───")
todo = {}
for t in TABLES:
    n = count(t, "&owner_id=is.null")
    if n is None:
        sys.exit("  owner_id 列不存在 —— 请先跑 S1（bash scripts/s1-setup.sh）再回填")
    todo[t] = n
    print(f"  {t:10s} {n:5d}")

if "--apply" not in flags:
    print("\n[dry-run] 未写入。确认无误后加 --apply 执行回填。")
    sys.exit(0)

print(f"\n─── 回填 owner_id = {UID} ───")
for t in TABLES:
    url = f"{URL}/rest/v1/{t}?owner_id=is.null"
    body = json.dumps({"owner_id": UID}).encode()
    req = urllib.request.Request(
        url, data=body, method="PATCH",
        headers={**HEADERS, "Prefer": "return=minimal"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            r.read()
        print(f"  {t:10s} 回填 {todo[t]} 行 ✓")
    except urllib.error.HTTPError as e:
        print(f"  {t:10s} 失败 {e.code}: {e.read().decode()[:300]}")
        sys.exit(1)

print("\n─── 回填后校验 ───")
ok = True
for t in TABLES:
    n = count(t)
    nulls = count(t, "&owner_id=is.null")
    good = n == BASELINE[t] and nulls == 0
    ok = ok and good
    print(f"  {t:10s} 总数 {n:5d} (基线 {BASELINE[t]:5d})  空 owner {nulls}  {'✓' if good else '✗'}")

print("\n结果:", "全部正常，可以开 RLS 了" if ok else "有问题，先别开 RLS")
sys.exit(0 if ok else 1)
