"""Blackout Box app icons (run: python3 -I web/scripts/make_icons.py).

Rounded-square night gradient (deep night blue -> black) with one bright Rausch (#FF385C)
activity-ring clock glyph and a soft glow. Writes web/public/icons/:
  apple-touch-icon-180.png  full-bleed square (iOS applies its own mask)
  icon-192.png, icon-512.png  rounded square, transparent corners (manifest "any")
  icon-maskable-512.png  full-bleed, glyph inside the 80% safe zone (manifest "maskable")
  favicon-32.png
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'icons')
S = 2048  # supersampled canvas
RAUSCH = (255, 56, 92)
TOP = (16, 30, 66)  # deep night blue
BOTTOM = (0, 0, 0)


def gradient(size):
    """Vertical-diagonal gradient night blue -> black."""
    img = Image.new('RGB', (size, size), BOTTOM)
    px = img.load()
    for y in range(size):
        for x in range(0, size, 1):
            t = min(1.0, max(0.0, (0.75 * y + 0.25 * x) / size))
            t = t ** 0.9
            px[x, y] = tuple(int(TOP[i] * (1 - t) + BOTTOM[i] * t) for i in range(3))
    return img


def glyph(size, scale):
    """RGBA layer: dim full track, bright 270 deg arc with round caps, centre dot, glow."""
    layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    c = size / 2
    r = size * 0.30 * scale
    w = size * 0.085 * scale
    box = [c - r, c - r, c + r, c + r]
    d.ellipse(box, outline=RAUSCH + (60,), width=int(w))
    start, end = -90, 180  # 12 o'clock clockwise to 9 o'clock
    d.arc(box, start=start, end=end, fill=RAUSCH + (255,), width=int(w))
    rm = r - w / 2
    for ang in (start, end):
        a = math.radians(ang)
        x, y = c + rm * math.cos(a), c + rm * math.sin(a)
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=RAUSCH + (255,))
    # clock hands: minute to 12, hour to 4 (the 4-hour rule)
    hw = w * 0.42
    d.line([c, c, c, c - r * 0.58], fill=RAUSCH + (255,), width=int(hw))
    a = math.radians(-90 + 120)
    d.line([c, c, c + r * 0.42 * math.cos(a), c + r * 0.42 * math.sin(a)], fill=RAUSCH + (255,), width=int(hw))
    for (x, y) in ((c, c - r * 0.58), (c + r * 0.42 * math.cos(a), c + r * 0.42 * math.sin(a)), (c, c)):
        k = hw * (0.9 if (x, y) == (c, c) else 0.5)
        d.ellipse([x - k, y - k, x + k, y + k], fill=RAUSCH + (255,))
    glow = layer.filter(ImageFilter.GaussianBlur(size * 0.035))
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.alpha_composite(glow)
    out.alpha_composite(glow)
    out.alpha_composite(layer)
    return out


def compose(scale, rounded):
    base = gradient(S).convert('RGBA')
    base.alpha_composite(glyph(S, scale))
    if rounded:
        mask = Image.new('L', (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.225), fill=255)
        base.putalpha(mask)
    return base


def save(img, size, name, rgb=False):
    im = img.resize((size, size), Image.LANCZOS)
    if rgb:
        im = im.convert('RGB')
    path = os.path.join(OUT, name)
    im.save(path, optimize=True)
    print(name, size, os.path.getsize(path), 'bytes')


def main():
    os.makedirs(OUT, exist_ok=True)
    full = compose(1.0, rounded=False)
    rounded = compose(1.0, rounded=True)
    maskable = compose(0.78, rounded=False)  # glyph well inside the 80% safe circle
    save(full, 180, 'apple-touch-icon-180.png', rgb=True)
    save(rounded, 192, 'icon-192.png')
    save(rounded, 512, 'icon-512.png')
    save(maskable, 512, 'icon-maskable-512.png', rgb=True)
    save(rounded, 32, 'favicon-32.png')
    return 0


if __name__ == '__main__':
    sys.exit(main())
