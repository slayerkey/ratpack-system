#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import runpy
from io import BytesIO
from pathlib import Path

BASE = Path(__file__).with_name("rat-art.py")
ns = runpy.run_path(str(BASE), run_name="rat_art_base")
Image = ns["Image"]
ImageDraw = ns["ImageDraw"]

# Exact Discord glyph rasterized from the current 24x24 Discord SVG path.
# Source reference: simple-icons/simple-icons icons/discord.svg, whose source is
# Discord's branding page. White symbol is kept proportional and unmodified.
DISCORD_SYMBOL_B64 = "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"
DISCORD_SYMBOL = Image.open(BytesIO(base64.b64decode(DISCORD_SYMBOL_B64))).convert("RGBA")


def _paste_symbol(draw, cx, cy, diameter):
    icon = DISCORD_SYMBOL.resize((diameter, diameter), Image.Resampling.LANCZOS)
    draw._image.alpha_composite(icon, (int(cx - diameter / 2), int(cy - diameter / 2)))


def draw_avatar(draw, x, y, size, color, speaking=False, accent=None):
    # Ignore decorative mock-member colors. Every demo member uses the same
    # unmistakable Discord default treatment; state is communicated by ring/text.
    accent = ns["ACCENT"] if accent is None else accent
    cx, cy = x + ns["sc"](72, size), y + ns["sc"](59, size)
    avatar_r, ring_r = ns["sc"](31, size), ns["sc"](35, size)
    ring_color = accent if speaking else (53, 60, 74)
    ring_width = max(3, ns["sc"](6 if speaking else 3, size))
    draw.ellipse((cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r), outline=ring_color, width=ring_width)
    draw.ellipse((cx - avatar_r, cy - avatar_r, cx + avatar_r, cy + avatar_r), fill=ns["DISCORD"])
    _paste_symbol(draw, cx, cy, max(1, int(avatar_r * 1.25)))


def draw_channel(draw, x, y, size):
    cx, cy = x + ns["sc"](72, size), y + ns["sc"](55, size)
    radius = ns["sc"](30, size)
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=ns["DISCORD"])
    _paste_symbol(draw, cx, cy, max(1, int(radius * 1.22)))


# Patch the globals used by key()/deck()/hero()/dashboard()/spotlight().
ns["draw_avatar"] = draw_avatar
ns["draw_channel"] = draw_channel


def search_icon(out):
    img = Image.new("RGBA", (288, 288), (*ns["BG"], 255))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((18, 18, 270, 270), 58, fill=ns["KEY"], outline=ns["ACCENT"], width=8)
    cx, cy = 144, 118
    ring_r = 72
    d.ellipse((cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r), outline=ns["ACCENT"], width=10)
    d.ellipse((83, 57, 205, 179), fill=ns["DISCORD"])
    _paste_symbol(d, cx, cy, 92)
    d.text((144, 230), "VOICE", font=ns["font"](26, True), fill=ns["WHITE"], anchor="mm")
    img.convert("RGB").save(out / "01_search_icon.png", quality=95)


def features(out):
    img = ns["background"]()
    ns["title"](img, "The states you actually care about", "Discord is unmistakable, while speaking and voice state stay readable at a glance.")
    d = ImageDraw.Draw(img)
    examples = [
        ("CURRENT CHANNEL", {"label": "VC1", "state": "4 MEMBERS", "icon": "channel", "accent": ns["DISCORD"]}, "Know which room\nyou're in."),
        ("SPEAKER SPOTLIGHT", {"label": "ALEX", "state": "SPEAKING", "avatar": ns["DISCORD"], "speaking": True}, "Active speaker,\ninstantly obvious."),
        ("VOICE STATE", {"label": "MUGZEY", "state": "DEAFENED", "avatar": ns["DISCORD"], "active": True}, "Mute and deafen\nread instantly."),
        ("CONNECTION", {"label": "VOICE DECK", "state": "READY", "icon": "ready"}, "Discord connected\nand ready."),
    ]
    for i, (heading, spec, desc) in enumerate(examples):
        x = 125 + i * 445
        d.rounded_rectangle((x, 255, x + 390, 710), 30, fill=(*ns["PANEL"], 235), outline=(48, 57, 70), width=2)
        ns["key"](d, x + 90, 310, size=210, **spec)
        d.text((x + 195, 570), heading, font=ns["font"](21, True), fill=ns["ACCENT"] if i == 1 else ns["WHITE"], anchor="mm")
        d.multiline_text((x + 195, 618), desc, font=ns["font"](16), fill=ns["MUTED"], anchor="ma", align="center", spacing=5)
    ns["signature"](img)
    img.convert("RGB").save(out / "03_gallery_01.png", quality=95)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--destination", required=True)
    args = parser.parse_args()
    out = Path(args.destination)
    out.mkdir(parents=True, exist_ok=True)
    search_icon(out)
    ns["hero"](out)
    features(out)
    ns["dashboard"](out)
    ns["spotlight"](out)
    ns["compatibility"](out)
    required = ["01_search_icon.png", "02_cover.png", "03_gallery_01.png", "04_gallery_02.png", "05_gallery_03.png", "06_gallery_04.png"]
    for name in required:
        path = out / name
        if not path.is_file():
            raise SystemExit(f"Missing Rat Art output: {name}")
        with Image.open(path) as check:
            expected = (288, 288) if name == "01_search_icon.png" else (ns["W"], ns["H"])
            if check.size != expected:
                raise SystemExit(f"Wrong Rat Art size for {name}: {check.size} != {expected}")
    print(f"Voice Deck Rat Art ready: {out}")


if __name__ == "__main__":
    main()
