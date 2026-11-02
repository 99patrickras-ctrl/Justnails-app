"""Laver app-ikonerne i /public ud fra logoets skrifttyper.

Kør:  pip install pillow fonttools   og derefter   npm run icons
Har I et rigtigt logo som PNG, kan I i stedet lægge egne filer i /public med samme navne.
"""
import io
import os
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, 'node_modules', '@fontsource')
OUT = os.path.join(ROOT, 'public')
BG = (11, 10, 9, 255)
GOLD_TOP = (240, 220, 168)
GOLD_MID = (212, 175, 106)
GOLD_BOT = (169, 130, 63)


def font(path, size):
    tt = TTFont(path)  # .woff → TrueType i hukommelsen
    tt.flavor = None
    buf = io.BytesIO()
    tt.save(buf)
    buf.seek(0)
    return ImageFont.truetype(buf, size)


def gold(size):
    """Lodret guldgradient."""
    w, h = size
    g = Image.new('RGBA', size)
    px = g.load()
    for y in range(h):
        t = y / max(1, h - 1)
        if t < 0.5:
            a, b, k = GOLD_TOP, GOLD_MID, t / 0.5
        else:
            a, b, k = GOLD_MID, GOLD_BOT, (t - 0.5) / 0.5
        c = tuple(round(a[i] + (b[i] - a[i]) * k) for i in range(3)) + (255,)
        for x in range(w):
            px[x, y] = c
    return g


def heart(draw, cx, cy, s, fill):
    # to cirkler + trekant
    r = s * 0.27
    draw.ellipse([cx - s * 0.5, cy - s * 0.3, cx - s * 0.5 + 2 * r, cy - s * 0.3 + 2 * r], fill=fill)
    draw.ellipse([cx + s * 0.5 - 2 * r, cy - s * 0.3, cx + s * 0.5, cy - s * 0.3 + 2 * r], fill=fill)
    draw.polygon([(cx - s * 0.49, cy - s * 0.07), (cx + s * 0.49, cy - s * 0.07), (cx, cy + s * 0.45)], fill=fill)


def icon(size, pad=0.0, by=True):
    S = 1024  # tegnes stort og skaleres ned for skarpe kanter
    img = Image.new('RGBA', (S, S), BG)
    mask = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(mask)
    inner = S * (1 - 2 * pad)
    script = font(os.path.join(FONTS, 'great-vibes', 'files', 'great-vibes-latin-400-normal.woff'), int(inner * 0.62))
    serif = font(os.path.join(FONTS, 'cormorant-garamond', 'files', 'cormorant-garamond-latin-600-normal.woff'), int(inner * 0.11))

    text = 'Jn'
    bb = d.textbbox((0, 0), text, font=script)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    ty = S * 0.47 - th / 2 - (S * 0.04 if by else 0)
    d.text(((S - tw) / 2 - bb[0], ty - bb[1]), text, font=script, fill=255)
    heart(d, (S + tw) / 2 + inner * 0.02, ty + th * 0.12, inner * 0.11, 255)
    if by:
        label = 'BY AK'
        spacing = inner * 0.035
        widths = [d.textlength(ch, font=serif) for ch in label]
        total = sum(widths) + spacing * (len(label) - 1)
        x = (S - total) / 2
        y = ty + th + inner * 0.06
        for ch, w in zip(label, widths):
            d.text((x, y), ch, font=serif, fill=255)
            x += w + spacing
    img.paste(gold((S, S)), (0, 0), mask)
    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    icon(192, pad=0.08).save(os.path.join(OUT, 'pwa-192.png'))
    icon(512, pad=0.08).save(os.path.join(OUT, 'pwa-512.png'))
    icon(512, pad=0.18).save(os.path.join(OUT, 'pwa-maskable-512.png'))
    icon(180, pad=0.08).convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'))
    icon(64, pad=0.04, by=False).save(os.path.join(OUT, 'favicon.png'))
    print('Ikoner gemt i', OUT)


if __name__ == '__main__':
    main()
