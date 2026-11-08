"""Render Apple Wallet artwork (icon, logo, strip) for each event theme and write
src/lib/wallet/assets.ts with the PNGs inlined as base64.

Run: python3 scripts/wallet/artwork.py   (needs Pillow)
Also writes a preview PNG mockup of the pass to scripts/wallet/preview-<event>.png.
"""
import base64, io, math, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
FONT = os.path.join(HERE, "fonts", "PlusJakartaSans.ttf")

THEMES = {
    "bronson-masterclass": {
        "label": "LIVE MASTERCLASS",
        "headline": "MRR E-Commerce Masterclass",
        "logo_src": os.path.join(HERE, "sources", "inner-table-logo.png"),
        # crop box of the round mark inside the logo source (x0, y0, x1, y1)
        "mark_box": (395, 290, 855, 750),
        "green_top": (34, 197, 94),
        "green_bottom": (21, 128, 61),
        "ink": (15, 23, 42),
    },
    # Aval (Mind Over Market): white + gold. Source logo is a transparent PNG, so the
    # mark is cut out by its own alpha (mark_alpha) and padded to a square.
    "aval-masterclass": {
        "label": "LIVE MASTERCLASS",
        "headline": "Mind Over Market Masterclass",
        "logo_src": os.path.join(HERE, "sources", "mind-over-market-logo.png"),
        "mark_box": (8, 16, 118, 176),
        "mark_alpha": True,
        # blank out the "M" of MARKET that sits inside the crop (box relative to the crop)
        "mark_clear": (85, 112, 110, 160),
        "green_top": (217, 169, 59),
        "green_bottom": (156, 112, 12),
        "ink": (23, 23, 23),
        "preview_brand": "Mind Over Market",
        "preview_date": "Nov 8, 7:00 PM",
        "preview_accent": (156, 112, 12),
    },
}


def font(size, weight):
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_axes([weight])
    return f


def mark(theme, size, color):
    """The round logo mark, recoloured to a single colour on transparent."""
    src = Image.open(theme["logo_src"]).convert("RGBA").crop(theme["mark_box"])
    if theme.get("mark_alpha"):
        if theme.get("mark_clear"):
            ImageDraw.Draw(src).rectangle(theme["mark_clear"], fill=(0, 0, 0, 0))
        side = max(src.size)
        sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        sq.alpha_composite(src, ((side - src.width) // 2, (side - src.height) // 2))
        solid = Image.new("RGBA", (side, side), color + (255,))
        solid.putalpha(sq.getchannel("A"))
        return solid.resize((size, size), Image.LANCZOS)
    gray = src.convert("L")
    # dark or green strokes -> opaque; near-white background -> transparent
    alpha = gray.point(lambda v: 0 if v > 235 else min(255, int((235 - v) * 2.4)))
    out = Image.new("RGBA", src.size, color + (0,))
    out.putalpha(alpha)
    solid = Image.new("RGBA", src.size, color + (255,))
    solid.putalpha(alpha)
    return solid.resize((size, size), Image.LANCZOS)


def icon(theme, px):
    img = Image.new("RGBA", (px, px), theme["green_bottom"] + (255,))
    grad = Image.new("RGBA", (px, px))
    d = ImageDraw.Draw(grad)
    for y in range(px):
        t = y / max(1, px - 1)
        c = tuple(int(theme["green_top"][i] * (1 - t) + theme["green_bottom"][i] * t) for i in range(3))
        d.line([(0, y), (px, y)], fill=c + (255,))
    img.alpha_composite(grad)
    m = mark(theme, int(px * 0.78), (255, 255, 255))
    img.alpha_composite(m, ((px - m.width) // 2, (px - m.height) // 2))
    return img


def logo(theme, scale):
    w, h = 50 * scale, 50 * scale
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    m = mark(theme, int(h * 0.92), theme["ink"])
    img.alpha_composite(m, (0, (h - m.height) // 2))
    return img


def strip(theme, scale):
    W, H = 375 * scale, 98 * scale
    img = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(img)
    for x in range(W):
        t = x / (W - 1)
        c = tuple(int(theme["green_top"][i] * (1 - t * 0.85) + theme["green_bottom"][i] * t * 0.85) for i in range(3))
        d.line([(x, 0), (x, H)], fill=c + (255,))
    # faint diagonal streaks, like the site's hero band
    streaks = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(streaks)
    step = 46 * scale
    for x0 in range(-H, W + H, step):
        sd.line([(x0, H), (x0 + H * 0.55, 0)], fill=(255, 255, 255, 34), width=max(1, scale))
    img.alpha_composite(streaks)
    # soft glow top-left
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([-W * 0.2, -H * 1.2, W * 0.55, H * 0.9], fill=(255, 255, 255, 40))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(18 * scale)))

    # logo mark on the right
    m = mark(theme, int(H * 0.74), (255, 255, 255))
    m.putalpha(m.getchannel("A").point(lambda a: int(a * 0.92)))
    img.alpha_composite(m, (W - m.width - 16 * scale, (H - m.height) // 2))

    # label pill + headline on the left
    pad = 16 * scale
    lf = font(9 * scale, 800)
    label = theme["label"]
    tw = d.textlength(label, font=lf) + len(label) * 1.2 * scale
    pill_h = 17 * scale
    py = 16 * scale
    pill = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(pill).rounded_rectangle([pad, py, pad + tw + 18 * scale, py + pill_h], radius=pill_h // 2, fill=(255, 255, 255, 235))
    img.alpha_composite(pill)
    # red live dot + letter-spaced label
    dd = ImageDraw.Draw(img)
    cx, cy = pad + 9 * scale, py + pill_h / 2
    r = 2.6 * scale
    dd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(239, 68, 68, 255))
    x = pad + 15 * scale
    for ch in label:
        dd.text((x, py + pill_h / 2), ch, font=lf, fill=theme["green_bottom"] + (255,), anchor="lm")
        x += dd.textlength(ch, font=lf) + 1.2 * scale

    max_w = W - m.width - pad - 30 * scale
    head = theme["headline"]
    size = 21 * scale
    while size > 12 * scale:
        hf = font(size, 800)
        if dd.textlength(head, font=hf) <= max_w:
            lines = [head]
            break
        words = head.split()
        best = None
        for i in range(1, len(words)):
            a, b = " ".join(words[:i]), " ".join(words[i:])
            if dd.textlength(a, font=hf) <= max_w and dd.textlength(b, font=hf) <= max_w:
                best = [a, b]
                break
        if best:
            lines = best
            break
        size -= scale
    hf = font(size, 800)
    top = py + pill_h + 8 * scale
    line_h = int(size * 1.12)
    for i, line in enumerate(lines):
        dd.text((pad, top + i * line_h), line, font=hf, fill=(255, 255, 255, 255))
    return img


def png_bytes(img):
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def preview(theme, files, name):
    """Rough mockup of the front of the pass, to check the design without a phone."""
    S = 2
    W, H = 375 * S, 470 * S
    card = Image.new("RGBA", (W, H), (252, 253, 252, 255))
    d = ImageDraw.Draw(card)
    lg = Image.open(io.BytesIO(files["logo@2x.png"]))
    card.alpha_composite(lg, (14 * S, 12 * S))
    d.text((14 * S + lg.width + 8 * S, 12 * S + lg.height / 2), theme.get("preview_brand", "The Inner Table"), font=font(15 * S, 700), fill=theme["ink"], anchor="lm")
    d.text((W - 14 * S, 14 * S), "STARTS", font=font(9 * S, 700), fill=theme.get("preview_accent", (22, 163, 74)), anchor="ra")
    d.text((W - 14 * S, 27 * S), theme.get("preview_date", "Nov 18, 7:00 PM"), font=font(14 * S, 600), fill=theme["ink"], anchor="ra")
    st = Image.open(io.BytesIO(files["strip@2x.png"]))
    card.alpha_composite(st, (0, 62 * S))
    y = 62 * S + st.height + 14 * S
    for (lx, la, va, al) in [(14, "YOUR SEAT", "Reserved", "la"), (361, "ACCESS", "Live Only", "ra")]:
        d.text((lx * S, y), la, font=font(9 * S, 700), fill=theme.get("preview_accent", (22, 163, 74)), anchor=al)
        d.text((lx * S, y + 13 * S), va, font=font(15 * S, 600), fill=theme["ink"], anchor=al)
    y += 44 * S
    for (lx, la, va, al) in [(14, "JOIN LINK", "event.webinarjam.com", "la"), (361, "STATUS", "Confirmed", "ra")]:
        d.text((lx * S, y), la, font=font(9 * S, 700), fill=theme.get("preview_accent", (22, 163, 74)), anchor=al)
        d.text((lx * S, y + 13 * S), va, font=font(14 * S, 600), fill=theme["ink"], anchor=al)
    qy = y + 48 * S
    q = 120 * S
    d.rounded_rectangle([(W - q) / 2 - 8 * S, qy - 8 * S, (W + q) / 2 + 8 * S, qy + q + 8 * S], radius=8 * S, fill=(255, 255, 255, 255), outline=(226, 232, 240, 255))
    d.rectangle([(W - q) / 2, qy, (W + q) / 2, qy + q], fill=(15, 23, 42, 255))
    d.text((W / 2, qy + q / 2), "QR", font=font(18 * S, 800), fill=(255, 255, 255), anchor="mm")
    out = Image.new("RGBA", (W + 40 * S, H + 40 * S), (230, 234, 238, 255))
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, W, H], radius=14 * S, fill=255)
    out.paste(card, (20 * S, 20 * S), mask)
    out.save(os.path.join(HERE, f"preview-{name}.png"))


def main():
    lines = [
        "// Generated by scripts/wallet/artwork.py. Do not edit by hand.",
        "export const WALLET_ASSETS: Record<string, Record<string, string>> = {",
    ]
    for name, theme in THEMES.items():
        files = {}
        for s, suffix in [(1, ""), (2, "@2x"), (3, "@3x")]:
            files[f"icon{suffix}.png"] = png_bytes(icon(theme, 29 * s))
            files[f"logo{suffix}.png"] = png_bytes(logo(theme, s))
            files[f"strip{suffix}.png"] = png_bytes(strip(theme, s))
        lines.append(f'  "{name}": {{')
        for fn, data in files.items():
            lines.append(f'    "{fn}": "{base64.b64encode(data).decode()}",')
        lines.append("  },")
        preview(theme, files, name)
    lines.append("};")
    out = os.path.join(ROOT, "src", "lib", "wallet", "assets.ts")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as f:
        f.write("\n".join(lines) + "\n")
    print("wrote", out)


if __name__ == "__main__":
    main()
