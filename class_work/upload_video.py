#!/usr/bin/env python3
"""上传课程视频到 Supabase Storage（公开桶 class-videos），并回写 courses.video_url。

支持两种用法：
  单节：
    python upload_video.py --course-id 27 --video "/Users/wwj/Downloads/20261031-1730-Bibi J.MP4"
  批量（13 节全传）：
    python upload_video.py --manifest manifest.json
    # manifest.json: [{"course_id":27,"video":"/path/A.MP4"}, ...]

上传走 TUS 分片（Supabase /storage/v1/upload/resumable），单文件不受 50MB 限制，
可传 150MB 原画质；分片 6MB，断点续传友好。
公开桶：视频 URL 无需鉴权，前端 <video> 直接播放。
"""
import argparse
import base64
import json
import os
import sys
import time
import urllib.request
import urllib.error

SUPABASE_URL = "https://ibqfaouryxjctzvpdpgf.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_2ZXmFuIo_nmFzt2KaNDFvQ_-5iyx14o"
BUCKET = "class-videos"
CHUNK = 6 * 1024 * 1024  # 6MB 分片
AUTH_EMAIL = "1042086283@qq.com"
AUTH_PASSWORD = "xl20180827"


def _http(method, url, body=None, headers=None, binary=False, timeout=300):
    h = dict(headers or {})
    data = body
    if body is not None and not binary:
        data = json.dumps(body).encode("utf-8")
        h.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, dict(resp.headers), resp.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


def get_token():
    st, _, body = _http("POST", f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                        {"email": AUTH_EMAIL, "password": AUTH_PASSWORD},
                        {"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"})
    if st != 200:
        raise RuntimeError(f"登录失败 HTTP {st}: {body.decode('utf-8','replace')}")
    return json.loads(body)["access_token"]


def _b64(s):
    return base64.b64encode(s.encode("utf-8")).decode("ascii")


def tus_upload(token, path, data, content_type):
    """TUS 分片上传到 Supabase Storage，返回公开 URL。"""
    size = len(data)
    auth = {"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"}

    # 1) 创建上传会话
    meta = ",".join([
        f"bucket {_b64(BUCKET)}",
        f"key {_b64(path)}",
        f"name {_b64(os.path.basename(path))}",
        f"content-type {_b64(content_type)}",
    ])
    st, hdrs, _ = _http("POST", f"{SUPABASE_URL}/storage/v1/upload/resumable", binary=True,
                       headers={
                           **auth, "tus-resumable": "1.0.0", "upload-length": str(size),
                           "upload-offset": "0", "upload-metadata": meta,
                       })
    loc = hdrs.get("location") or hdrs.get("Location")
    if not loc:
        raise RuntimeError(f"创建 TUS 会话失败 HTTP {st}，无 location 头")
    if loc.startswith("/"):
        loc = SUPABASE_URL + loc
    offset = 0
    while offset < size:
        end = min(offset + CHUNK, size)
        chunk = data[offset:end]
        st, hdrs, _ = _http("PATCH", loc, body=chunk, binary=True, timeout=600, headers={
            **auth, "tus-resumable": "1.0.0", "upload-offset": str(offset),
            "content-type": "application/offset+octet-stream",
            "content-length": str(len(chunk)),
        })
        nxt = hdrs.get("upload-offset") or hdrs.get("Upload-Offset")
        if nxt is not None:
            offset = int(nxt)
        else:
            offset = end
        pct = offset / size * 100
        print(f"    上传进度 {pct:.0f}% ({offset//1024//1024}/{size//1024//1024} MB)")
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"


def patch_video_url(token, course_id, url):
    st, _, body = _http("PATCH", f"{SUPABASE_URL}/rest/v1/courses?id=eq.{course_id}",
                        {"video_url": url},
                        {"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}",
                         "Prefer": "return=representation"})
    if st not in (200, 201, 204):
        raise RuntimeError(f"回写 video_url 失败 HTTP {st}: {body.decode('utf-8','replace')}")


def upload_one(token, course_id, video, name=None):
    if not os.path.exists(video):
        print(f"  ✗ 视频不存在: {video}")
        return False
    name = name or f"course-{course_id}.mp4"
    print(f"  → 读取 {video} ({os.path.getsize(video)//1024//1024} MB)")
    with open(video, "rb") as f:
        data = f.read()
    url = tus_upload(token, name, data, "video/mp4")
    print(f"  ✓ 上传成功: {url}")
    patch_video_url(token, course_id, url)
    print(f"  ✓ 已回写 courses.video_url (course_id={course_id})")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--course-id", type=int, help="单节模式：课程 id")
    ap.add_argument("--video", help="单节模式：视频文件路径")
    ap.add_argument("--manifest", help="批量模式：JSON 文件 [{course_id, video, name?}]")
    ap.add_argument("--name", help="单节模式：存储文件名（默认 course-<id>.mp4）")
    args = ap.parse_args()

    token = get_token()
    print("✓ 已登录")

    jobs = []
    if args.manifest:
        jobs = json.load(open(args.manifest, encoding="utf-8"))
    elif args.course_id and args.video:
        jobs = [{"course_id": args.course_id, "video": args.video, "name": args.name}]
    else:
        print("用法: --manifest file.json  |  --course-id N --video /path.MP4")
        sys.exit(1)

    ok = 0
    for j in jobs:
        cid = j["course_id"]
        print(f"\n=== 课程 id={cid} ===")
        if upload_one(token, cid, j["video"], j.get("name")):
            ok += 1
    print(f"\n完成：{ok}/{len(jobs)} 成功。")


if __name__ == "__main__":
    main()
