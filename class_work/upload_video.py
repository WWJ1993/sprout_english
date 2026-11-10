#!/usr/bin/env python3
"""上传课程视频到 Supabase Storage（公开桶 class-videos），并回写 courses.video_url。

用法:
  python upload_video.py --course-id 27 --video "/path/to/20261031-1730-Bibi.MP4"
  python upload_video.py --course-id 27 --video "...MP4" --no-transcode   # 已是 <50MB 的小文件时

说明:
  - Supabase Storage 标准上传单文件上限 50MB，故默认用 ffmpeg 转码为 ~360p 小体积 MP4（约 40MB）。
  - 转码后若仍 >50MB 会报错提示；可手动调低码率或改用 --no-transcode 上传小文件。
  - 公开桶: 视频 URL 无需鉴权，前端 <video> 直接播放。
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request
import urllib.error

SUPABASE_URL = "https://ibqfaouryxjctzvpdpgf.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_2ZXmFuIo_nmFzt2KaNDFvQ_-5iyx14o"
BUCKET = "class-videos"
AUTH_EMAIL = "1042086283@qq.com"
AUTH_PASSWORD = "xl20180827"


def _find_ffmpeg():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


def _http(method, url, body=None, headers=None, binary=False, timeout=120):
    h = dict(headers or {})
    data = body
    if body is not None and not binary:
        data = json.dumps(body).encode("utf-8")
        h.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            return resp.status, raw.decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")


def get_token():
    st, body = _http("POST", f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                     {"email": AUTH_EMAIL, "password": AUTH_PASSWORD},
                     {"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"})
    if st != 200:
        raise RuntimeError(f"登录失败 HTTP {st}: {body}")
    return json.loads(body)["access_token"]


def transcode(src, dst):
    ff = _find_ffmpeg()
    # ~360p，目标 ~40MB/26min（码率约 180k video + 48k audio）
    cmd = [ff, "-y", "-i", src, "-vf", "scale=-2:360", "-c:v", "libx264",
           "-b:v", "180k", "-maxrate", "220k", "-bufsize", "400k",
           "-c:a", "aac", "-b:a", "48k", "-movflags", "+faststart", dst]
    print("  转码中:", " ".join(cmd[:6]), "...")
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def upload_object(token, path, data, content_type):
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}"
    st, body = _http("POST", url, body=data, binary=True, timeout=300, headers={
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": content_type,
        "x-upsert": "true",
        "cache-control": "31536000",
    })
    if st not in (200, 201):
        raise RuntimeError(f"Storage 上传失败 HTTP {st}: {body}")
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"


def patch_video_url(token, course_id, url):
    headers = {"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}",
               "Prefer": "return=representation"}
    st, body = _http("PATCH", f"{SUPABASE_URL}/rest/v1/courses?id=eq.{course_id}",
                     {"video_url": url}, headers=headers)
    if st not in (200, 201, 204):
        raise RuntimeError(f"回写 video_url 失败 HTTP {st}: {body}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--course-id", type=int, required=True)
    ap.add_argument("--video", required=True)
    ap.add_argument("--no-transcode", action="store_true")
    ap.add_argument("--name", default=None, help="存储路径文件名（默认用课程日期）")
    args = ap.parse_args()

    if not os.path.exists(args.video):
        print(f"视频文件不存在: {args.video}")
        sys.exit(1)

    token = get_token()
    print("✓ 已登录")

    tmp = None
    src = args.video
    if not args.no_transcode:
        tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False).name
        transcode(src, tmp)
        src = tmp
        size = os.path.getsize(src)
        print(f"  转码后大小: {size/1024/1024:.1f} MB")
        if size > 49 * 1024 * 1024:
            print("  ⚠️ 仍超过 50MB 限制，请调低码率或分段；本次中止以免上传失败。")
            os.unlink(src)
            sys.exit(1)

    name = args.name or f"course-{args.course_id}.mp4"
    with open(src, "rb") as f:
        data = f.read()
    url = upload_object(token, name, data, "video/mp4")
    print(f"  ✓ 上传成功: {url}")
    patch_video_url(token, args.course_id, url)
    print(f"  ✓ 已回写 courses.video_url (course_id={args.course_id})")
    if tmp:
        os.unlink(tmp)
    print("完成。")


if __name__ == "__main__":
    main()
