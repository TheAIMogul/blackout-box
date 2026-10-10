#!/usr/bin/env python3
"""Turn originals/*.jpg (Grok output) into web assets under web/public/media + web/public/icons,
shrink originals for storage, and rebuild web/public/media/manifest.json from what exists.
Run with: python3 -I web/scripts/media/process.py"""
import io, json, os, glob
from PIL import Image, ImageStat
HERE = os.path.dirname(os.path.abspath(__file__))
ORIG = os.path.join(HERE, "originals")
WEB = os.path.abspath(os.path.join(HERE, "..", ".."))
PUB = os.path.join(WEB, "public")
MEDIA = os.path.join(PUB, "media")

def load(p):
    try:
        im = Image.open(p); im.load(); return im.convert("RGB")
    except Exception as e:
        print("not ready", os.path.basename(p), e); return None

def webp(im, out, size, max_bytes, q=80):
    im = im.copy()
    if size: im = im.resize(size, Image.LANCZOS) if im.size != size else im
    while True:
        buf = io.BytesIO(); im.save(buf, "WEBP", quality=q, method=6)
        if buf.tell() <= max_bytes or q <= 40: break
        q -= 6
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "wb").write(buf.getvalue())
    return q

def cover(im, w, h):
    sw, sh = im.size; r = max(w / sw, h / sh)
    im = im.resize((round(sw * r), round(sh * r)), Image.LANCZOS)
    l = (im.width - w) // 2; t = (im.height - h) // 2
    return im.crop((l, t, l + w, t + h))

def shrink_original(p, im, maxdim):
    if max(im.size) > maxdim or os.path.getsize(p) > 900_000:
        im2 = im.copy(); im2.thumbnail((maxdim, maxdim), Image.LANCZOS)
        im2.save(p, "JPEG", quality=82, optimize=True)

for p in sorted(glob.glob(os.path.join(ORIG, "*.jpg"))):
    name = os.path.basename(p)[:-4]
    if os.path.exists(p + ".err") or os.path.getsize(p) == 0: continue
    if name.startswith("test_"): continue
    group, _, key = name.partition("_")
    if group == "now":
        out = os.path.join(MEDIA, "now", key + ".webp")
        if os.path.exists(out): continue
        im = load(p)
        if not im: continue
        phone = key.endswith("-phone")
        size = (1080, 1920) if phone else (1920, 1080)
        q = webp(cover(im, *size), out, None, 250_000, 80)
        # poster for video (JPEG <=120KB)
        if not phone:
            pim = cover(im, 1280, 720); qq = 80
            while True:
                buf = io.BytesIO(); pim.save(buf, "JPEG", quality=qq, optimize=True, progressive=True)
                if buf.tell() <= 120_000 or qq <= 40: break
                qq -= 6
            open(os.path.join(MEDIA, "now", key + "-poster.jpg"), "wb").write(buf.getvalue())
        shrink_original(p, im, 1920); print("now", key, "q", q)
    elif group == "icons3d":
        out = os.path.join(MEDIA, "icons3d", key + ".webp")
        if os.path.exists(out): continue
        im = load(p)
        if not im: continue
        q = webp(cover(im, 512, 512), out, None, 60_000, 82)
        shrink_original(p, im, 1024); print("icon", key, "q", q)
    elif group == "empty":
        out = os.path.join(MEDIA, "empty", key + ".webp")
        if os.path.exists(out): continue
        im = load(p)
        if not im: continue
        q = webp(cover(im, 1200, 900), out, None, 150_000, 80)
        shrink_original(p, im, 1600); print("empty", key, "q", q)
    elif name == "app_icon" and os.path.exists(os.path.join(ORIG, "app_icon_fullbleed.jpg")):
        continue  # superseded by the full-bleed edit below
    elif name in ("app_icon", "app_icon_fullbleed"):
        icons = os.path.join(PUB, "icons")
        marker = os.path.join(HERE, ".app-icon-done")
        if os.path.exists(marker): continue
        im = load(p)
        if not im: continue
        sq = cover(im, min(im.size), min(im.size))
        for fn, s in [("apple-touch-icon-180.png", 180), ("icon-192.png", 192), ("icon-512.png", 512), ("favicon-32.png", 32)]:
            sq.resize((s, s), Image.LANCZOS).save(os.path.join(icons, fn), "PNG", optimize=True)
        # maskable: art scaled to 76% (12% safe padding each side) on solid #0B0F17
        can = Image.new("RGB", (512, 512), (0x0B, 0x0F, 0x17))
        inner = sq.resize((390, 390), Image.LANCZOS)
        can.paste(inner, ((512 - 390) // 2, (512 - 390) // 2))
        can.save(os.path.join(icons, "icon-maskable-512.png"), "PNG", optimize=True)
        webp(sq, os.path.join(MEDIA, "app-icon.webp"), (512, 512), 60_000, 85)
        open(marker, "w").write("1")
        shrink_original(p, im, 1024); print("app icon done")

# ---------- manifest ----------
ALT = {
 "day": "Sunny afternoon over Biscayne Bay with the Brickell skyline and palms",
 "night": "Miami skyline at blue hour with city lights reflected in the bay",
 "blackout": "Miami skyline dark during a power outage under a full moon, a few candle-lit windows",
 "storm": "Tropical storm clouds and rain curtains rolling over Biscayne Bay toward the skyline",
 "heat": "Hot hazy afternoon over the Brickell skyline with heat shimmer",
 "kingtide": "Sunny-day king tide flooding a Miami Beach street lined with palms and Art Deco buildings",
 "all": "All items", "fridge": "Refrigerator", "freezer": "Freezer", "medicine": "Medicine", "pantry": "Pantry",
 "heat_icon": "Heat", "uv": "UV index", "wind": "Wind", "rain": "Rain", "air": "Air quality", "tide": "Tide",
 "daylight": "Daylight", "zone": "Evacuation zone", "clock": "Clock", "bag": "Go-bag", "chat": "Ask", "map": "Map",
 "clocks": "An open fridge glowing softly with a few items inside",
 "prep": "An emergency go-bag with flashlight, water and first aid kit",
 "ask": "A warm lantern next to a phone",
 "offline": "A candle-lit kitchen table with a phone showing a glowing ring",
}
def color(path):
    im = Image.open(path).convert("RGB").resize((16, 16))
    r, g, b = [int(x) for x in ImageStat.Stat(im).mean]
    return "#%02x%02x%02x" % (r, g, b)
def rel(p): return "/" + os.path.relpath(p, PUB).replace(os.sep, "/")
items = []
for key in ["day", "night", "blackout", "storm", "heat", "kingtide"]:
    src = os.path.join(MEDIA, "now", key + ".webp")
    if not os.path.exists(src): continue
    e = {"id": "now-" + key, "use": "now.hero." + key, "kind": "image", "src": rel(src)}
    ph = os.path.join(MEDIA, "now", key + "-phone.webp")
    if os.path.exists(ph): e["srcPhone"] = rel(ph)
    mp4 = os.path.join(MEDIA, "now", key + ".mp4")
    if os.path.exists(mp4):
        e["kind"] = "video"; e["video"] = rel(mp4); e["still"] = e["src"]; e["src"] = rel(mp4)
        wm = os.path.join(MEDIA, "now", key + ".webm")
        if os.path.exists(wm): e["webm"] = rel(wm)
        mp4p = os.path.join(MEDIA, "now", key + "-phone.mp4")
        if os.path.exists(mp4p): e["videoPhone"] = rel(mp4p)
    po = os.path.join(MEDIA, "now", key + "-poster.jpg")
    if os.path.exists(po): e["poster"] = rel(po)
    w, h = Image.open(src).size
    e.update({"width": w, "height": h, "alt": ALT[key], "color": color(src),
              "bytes": os.path.getsize(os.path.join(PUB, e["src"].lstrip("/")))})
    items.append(e)
# Lights-out transition: Grok edit of the night still into the same scene with the power out,
# tweened locally (ffmpeg blend with a flicker curve, 4 s, plays once). First frame = night, last = lightsout.
lo = os.path.join(MEDIA, "now", "lightsout.mp4")
if os.path.exists(lo):
    st = os.path.join(MEDIA, "now", "lightsout.webp")
    e = {"id": "now-lightsout", "use": "now.transition.lightsout", "kind": "video", "src": rel(lo), "loop": False,
         "durationSec": 4, "from": "now.hero.night", "still": rel(st), "poster": "/media/now/night-poster.jpg"}
    lp = os.path.join(MEDIA, "now", "lightsout-phone.mp4")
    if os.path.exists(lp): e["videoPhone"] = rel(lp)
    sp = os.path.join(MEDIA, "now", "lightsout-phone.webp")
    if os.path.exists(sp): e["stillPhone"] = rel(sp)
    e.update({"width": 1280, "height": 720, "alt": "The Miami skyline at night as the power goes out, lights flickering then going dark",
              "color": color(st), "bytes": os.path.getsize(lo)})
    items.append(e)
for p in sorted(glob.glob(os.path.join(MEDIA, "icons3d", "*.webp"))):
    k = os.path.basename(p)[:-5]; w, h = Image.open(p).size
    items.append({"id": "icon-" + k, "use": "icon." + k, "kind": "image", "src": rel(p), "width": w, "height": h,
                  "alt": ALT.get(k + "_icon" if k == "heat" else k, k), "color": color(p), "bytes": os.path.getsize(p)})
for p in sorted(glob.glob(os.path.join(MEDIA, "empty", "*.webp"))):
    k = os.path.basename(p)[:-5]; w, h = Image.open(p).size
    items.append({"id": "empty-" + k, "use": "empty." + k, "kind": "image", "src": rel(p), "width": w, "height": h,
                  "alt": ALT.get(k, k), "color": color(p), "bytes": os.path.getsize(p)})
ai = os.path.join(MEDIA, "app-icon.webp")
if os.path.exists(ai):
    items.append({"id": "app-icon", "use": "app.icon", "kind": "image", "src": rel(ai), "width": 512, "height": 512,
                  "alt": "Blackout Box app icon", "bytes": os.path.getsize(ai),
                  "pngs": ["/icons/apple-touch-icon-180.png", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png", "/icons/favicon-32.png"]})
json.dump(items, open(os.path.join(MEDIA, "manifest.json"), "w"), indent=1)
print("manifest:", len(items), "entries")
