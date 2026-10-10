#!/usr/bin/env python3
"""Grok Imagine video via Cloudflare AI Gateway /ai/run.
Usage: video.py NAME "PROMPT" [--image STILL.jpg] [--model xai/grok-imagine-video] [--duration 6] [--aspect 16:9] [--res 720p]
Writes originals/NAME.mp4 and originals/NAME.json (response without URLs' secrets)."""
import argparse, base64, json, os, sys, time, urllib.request
DIR = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument("name"); ap.add_argument("prompt")
ap.add_argument("--image"); ap.add_argument("--model", default="xai/grok-imagine-video")
ap.add_argument("--duration", type=int, default=6); ap.add_argument("--aspect", default="16:9")
ap.add_argument("--res", default="720p")
a = ap.parse_args()
tok = open(os.path.expanduser("~/.config/cloudflare/claude-api-token")).read().strip()
acct = open(os.path.expanduser("~/.config/cloudflare/account-id")).read().strip()
base = f"https://api.cloudflare.com/client/v4/accounts/{acct}"
inp = {"prompt": a.prompt, "duration": a.duration, "aspect_ratio": a.aspect, "resolution": a.res}
if a.image:
    from PIL import Image
    import io
    im = Image.open(a.image).convert("RGB"); im.thumbnail((1280, 1280))
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=88)
    inp["image"] = {"url": "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()}
def req(method, url, body=None):
    r = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json", "cf-aig-gateway-id": "default"})
    try:
        with urllib.request.urlopen(r, timeout=600) as f: return json.loads(f.read())
    except urllib.error.HTTPError as e:
        return {"_http": e.code, "_body": e.read().decode()[:2000]}
t0 = time.time()
r = req("POST", f"{base}/ai/run", {"model": a.model, "input": inp})
print("elapsed %.0fs" % (time.time() - t0), json.dumps(r)[:800], flush=True)
res = r.get("result") or {}
if isinstance(res, dict) and "result" in res and isinstance(res["result"], dict): res = res["result"]
url = res.get("video") if isinstance(res, dict) else None
if not url:
    sys.exit("no video url")
out = os.path.join(DIR, "originals", a.name.replace("/", "_") + ".mp4")
urllib.request.urlretrieve(url, out)
json.dump({"model": a.model, "input": {k: v for k, v in inp.items() if k != "image"}, "image": a.image, "elapsed_s": round(time.time()-t0)}, open(out[:-4] + ".json", "w"), indent=1)
print("saved", out, os.path.getsize(out))
