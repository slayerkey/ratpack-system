#!/usr/bin/env python3
from __future__ import annotations

from PIL import ImageDraw

from render import ACCENT, BORDER, LABEL, MUTED, OUT, PANEL, WARN, WHITE, footer, gradient_bg, header, rounded, text


def mini_key(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, label: str, value: str, tone=ACCENT):
    rounded(draw, (x, y, x + w, y + h), radius=15, fill=(10, 15, 12), outline=(39, 51, 44), width=2)
    draw.rounded_rectangle((x + 15, y + 14, x + 43, y + 18), radius=2, fill=(*tone, 255))
    text(draw, (x + 15, y + 29), label.upper(), 10, LABEL)
    value_size = 22 if len(value) <= 8 else 17 if len(value) <= 12 else 14
    text(draw, (x + w / 2, y + h * 0.64), value, value_size, WHITE, True, "mm")


def profile_panel(draw: ImageDraw.ImageDraw, x: int, title_value: str, subtitle: str, keys, tone=ACCENT):
    y, w, h = 284, 785, 540
    rounded(draw, (x, y, x + w, y + h), radius=34, fill=PANEL, outline=BORDER, width=2)
    text(draw, (x + 38, y + 34), title_value, 27, WHITE)
    text(draw, (x + 38, y + 75), subtitle, 16, MUTED, False)
    text(draw, (x + w - 38, y + 37), "READY TO USE", 13, tone, True, "ra")

    key_w, key_h = 128, 108
    gap_x, gap_y = 14, 14
    start_x, start_y = x + 38, y + 118
    for index, (label, value, key_tone) in enumerate(keys):
        row, col = divmod(index, 5)
        mini_key(
            draw,
            start_x + col * (key_w + gap_x),
            start_y + row * (key_h + gap_y),
            key_w,
            key_h,
            label,
            value,
            key_tone,
        )

    text(draw, (x + 38, y + h - 31), "Editable • Auto installed • Does not hijack your active profile", 12, MUTED, False)


def profiles():
    canvas = gradient_bg()
    header(canvas, "Two complete profiles. Zero key-by-key setup.", "Start with Competitive or Live Match, then edit anything you want")
    draw = ImageDraw.Draw(canvas)

    competitive = [
        ("Premier", "14,832", WARN),
        ("Map Rank", "GN MASTER", WARN),
        ("Best Map", "MG II", WARN),
        ("Recent", "WIN", WARN),
        ("Win Rate", "54%", WARN),
        ("FACEIT Elo", "1,743", WARN),
        ("FACEIT", "LEVEL 8", WARN),
        ("FACEIT K/D", "1.21", WARN),
        ("FACEIT HS", "52%", WARN),
        ("FACEIT Form", "3W 2L", WARN),
        ("Session", "3W 1L", ACCENT),
        ("Session K/D", "1.42", ACCENT),
        ("Session ADR", "86.7", ACCENT),
        ("Session HS", "48%", ACCENT),
        ("Status", "READY", ACCENT),
    ]

    live = [
        ("Score", "8-6", ACCENT),
        ("Round", "15", ACCENT),
        ("Kills", "17", ACCENT),
        ("Deaths", "12", ACCENT),
        ("K/D", "1.42", ACCENT),
        ("Health", "73", ACCENT),
        ("Armor", "86", ACCENT),
        ("Money", "$4.9K", ACCENT),
        ("Weapon", "AK-47", ACCENT),
        ("Ammo", "24 / 90", ACCENT),
        ("ADR", "86.7", ACCENT),
        ("HS%", "48%", ACCENT),
        ("Bomb", "PLANTED", ACCENT),
        ("Map", "MIRAGE", ACCENT),
        ("Status", "LIVE", ACCENT),
    ]

    profile_panel(draw, 145, "COMPETITIVE", "Premier • map ranks • FACEIT • session", competitive, WARN)
    profile_panel(draw, 990, "LIVE MATCH", "Local GSI • live state • session performance", live, ACCENT)
    footer(canvas)
    return canvas


if __name__ == "__main__":
    target = OUT / "5-profiles.png"
    profiles().convert("RGB").save(target, "PNG", optimize=True)
    print(target)
