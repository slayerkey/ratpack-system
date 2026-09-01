#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from tools.art.rat_art import (  # noqa: E402
    ACCENT,
    MUTED,
    WHITE,
    fit_font,
    gradient_bg,
    packrat_signature,
    resolve_font,
)

OUT = Path(__file__).resolve().parent / "out"
OUT.mkdir(parents=True, exist_ok=True)

PANEL = (16, 23, 19)
BORDER = (39, 51, 44)
LABEL = (147, 163, 155)
WARN = (242, 201, 76)


def text(draw: ImageDraw.ImageDraw, xy, value, size, fill=WHITE, bold=True, anchor=None):
    draw.text(xy, value, font=resolve_font(size, bold), fill=(*fill, 255), anchor=anchor)


def header(canvas: Image.Image, title: str, subtitle: str):
    draw = ImageDraw.Draw(canvas)
    text(draw, (160, 72), "STREAM DECK PLUGIN", 20, ACCENT)
    title_font = fit_font(draw, title, 1540, 64, 42)
    draw.text((160, 118), title, font=title_font, fill=(*WHITE, 255))
    text(draw, (160, 194), subtitle, 25, MUTED, False)


def footer(canvas: Image.Image):
    packrat_signature(canvas, 906)


def rounded(draw, box, radius=24, fill=PANEL, outline=BORDER, width=2):
    draw.rounded_rectangle(box, radius=radius, fill=(*fill, 255), outline=(*outline, 255), width=width)


def key(draw, x, y, size, label, value, subtitle="", tone=ACCENT):
    rounded(draw, (x, y, x + size, y + size), radius=22, fill=(11, 15, 13), outline=(29, 42, 35), width=2)
    inset = 12
    rounded(draw, (x + inset, y + inset, x + size - inset, y + size - inset), radius=17, fill=PANEL, outline=(29, 42, 35), width=2)
    draw.rounded_rectangle((x + 24, y + 24, x + 58, y + 29), radius=3, fill=(*tone, 255))
    text(draw, (x + 24, y + 48), label.upper(), 14, LABEL)
    value_font = fit_font(draw, value, size - 42, 45, 23)
    draw.text((x + size / 2, y + size * 0.62), value, font=value_font, fill=(*WHITE, 255), anchor="mm")
    if subtitle:
        sub = fit_font(draw, subtitle, size - 42, 13, 10)
        draw.text((x + size / 2, y + size - 27), subtitle, font=sub, fill=(*tone, 255), anchor="mm")


def deck(canvas, keys):
    draw = ImageDraw.Draw(canvas)
    box = (330, 284, 1590, 794)
    rounded(draw, box, radius=44, fill=(8, 11, 10), outline=(48, 61, 53), width=3)
    text(draw, (375, 326), "CS2 LIVE MATCH", 17, MUTED)
    text(draw, (1540, 326), "LOCAL GSI", 15, ACCENT, anchor="ra")
    size = 190
    gap_x = 37
    gap_y = 28
    start_x = 385
    start_y = 370
    for i, item in enumerate(keys):
        row, col = divmod(i, 5)
        key(draw, start_x + col * (size + gap_x), start_y + row * (size + gap_y), size, *item)


def hero():
    canvas = gradient_bg()
    header(canvas, "CS2 Competitive Dashboard Pro", "The premium physical dashboard for serious CS2 players")
    deck(canvas, [
        ("SCORE", "8-6", "LIVE", ACCENT),
        ("HEALTH", "73", "HP", ACCENT),
        ("MONEY", "$4.9K", "CURRENT", ACCENT),
        ("MAP", "MIRAGE", "DE_MIRAGE", ACCENT),
        ("WEAPON", "AK-47", "24 / 90", ACCENT),
        ("K/D", "1.42", "SESSION", ACCENT),
        ("ADR", "86.7", "SESSION", ACCENT),
        ("HS%", "48%", "SESSION", ACCENT),
        ("RECORD", "3W 1L", "SESSION", ACCENT),
        ("STATUS", "LIVE", "CONNECTED", ACCENT),
    ])
    footer(canvas)
    return canvas


def feature_card(draw, x, title_value, body, tag, tone=ACCENT):
    y, w, h = 302, 380, 390
    rounded(draw, (x, y, x + w, y + h), radius=28, fill=PANEL, outline=BORDER, width=2)
    draw.rounded_rectangle((x + 30, y + 30, x + 78, y + 36), radius=3, fill=(*tone, 255))
    text(draw, (x + 30, y + 66), tag, 15, tone)
    title_font = fit_font(draw, title_value, w - 60, 37, 24)
    draw.text((x + 30, y + 118), title_value, font=title_font, fill=(*WHITE, 255))
    words = body.split()
    lines, line = [], ""
    body_font = resolve_font(20, False)
    for word in words:
        trial = f"{line} {word}".strip()
        if draw.textbbox((0, 0), trial, font=body_font)[2] > w - 60 and line:
            lines.append(line)
            line = word
        else:
            line = trial
    if line:
        lines.append(line)
    for i, line in enumerate(lines[:5]):
        draw.text((x + 30, y + 188 + i * 34), line, font=body_font, fill=(*MUTED, 255))


def features():
    canvas = gradient_bg()
    header(canvas, "One plugin. Four competitive views.", "Live match state, session performance, Valve ranks, and FACEIT in one system")
    draw = ImageDraw.Draw(canvas)
    feature_card(draw, 120, "Live CS2", "Score, player state, money, equipment, weapon, ammo, map and team from local GSI.", "01", ACCENT)
    feature_card(draw, 520, "Session", "Track K/D, ADR, headshot percentage, matches and your current session record.", "02", ACCENT)
    feature_card(draw, 920, "Competitive", "Premier rating, map ranks, recent results and competitive form through your Leetify key.", "03", WARN)
    feature_card(draw, 1320, "FACEIT", "Elo, level, K/D, headshot percentage, win rate and recent form through your FACEIT key.", "04", WARN)
    rounded(draw, (520, 725, 1400, 780), radius=14, fill=(10, 15, 12), outline=BORDER, width=1)
    text(draw, (960, 752), "ONLINE SOURCES: DATA PROVIDED BY LEETIFY  |  FACEIT DATA API", 16, MUTED, False, anchor="mm")
    footer(canvas)
    return canvas


def setup():
    canvas = gradient_bg()
    header(canvas, "Live CS2 setup is automatic.", "Install the plugin, launch CS2, and your local dashboard connects itself")
    draw = ImageDraw.Draw(canvas)
    rounded(draw, (150, 272, 970, 802), radius=30, fill=PANEL, outline=BORDER, width=2)
    text(draw, (195, 312), "PACKRAT", 14, ACCENT)
    text(draw, (195, 342), "CS2 Competitive Dashboard Pro", 28, WHITE)

    text(draw, (195, 400), "LIVE CS2 TRACKING", 15, LABEL)
    rounded(draw, (195, 430, 925, 505), radius=12, fill=(13, 19, 15), outline=(51, 66, 57), width=2)
    text(draw, (220, 447), "AUTO CONFIGURED", 13, ACCENT)
    text(draw, (220, 472), "Steam + CS2 detected • Local GSI listener ready", 17, MUTED, False)
    text(draw, (195, 528), "NO ENABLE BUTTON. NO LIVE API KEY.", 15, ACCENT)
    text(draw, (195, 558), "If CS2 was open during first install, relaunch it once.", 15, MUTED, False)

    text(draw, (195, 612), "OPTIONAL COMPETITIVE ACCOUNT", 15, LABEL)
    rounded(draw, (195, 642, 925, 700), radius=12, fill=(13, 19, 15), outline=(51, 66, 57), width=2)
    text(draw, (220, 661), "Steam profile URL or SteamID", 17, MUTED, False)

    rounded(draw, (195, 720, 542, 775), radius=12, fill=(13, 19, 15), outline=(67, 59, 30), width=2)
    text(draw, (220, 735), "LEETIFY", 13, WARN)
    text(draw, (220, 754), "PREMIER + COMPETITIVE", 12, WHITE)
    rounded(draw, (578, 720, 925, 775), radius=12, fill=(13, 19, 15), outline=(67, 59, 30), width=2)
    text(draw, (603, 735), "FACEIT", 13, WARN)
    text(draw, (603, 754), "ELO + PERFORMANCE", 12, WHITE)

    steps = [
        ("1", "Install", "RatPack configures the local CS2 GSI path automatically."),
        ("2", "Play", "Launch CS2 and the dashboard switches to live data."),
        ("3", "Go deeper", "Add your own provider keys only for online competitive views."),
    ]
    for i, (n, title_value, body) in enumerate(steps):
        y = 322 + i * 154
        draw.ellipse((1055, y, 1105, y + 50), fill=(*ACCENT, 255))
        text(draw, (1080, y + 25), n, 18, (7, 16, 10), anchor="mm")
        text(draw, (1140, y - 2), title_value, 28, WHITE)
        body_font = fit_font(draw, body, 575, 19, 15)
        draw.text((1140, y + 42), body, font=body_font, fill=(*MUTED, 255))
    text(draw, (1055, 746), "Provider requests go directly from the plugin to each provider.", 17, WARN, False)
    footer(canvas)
    return canvas


def architecture():
    canvas = gradient_bg()
    header(canvas, "Live data stays local. Provider keys stay yours.", "CS2 telemetry stays on your PC while optional account lookups go straight to each provider")
    draw = ImageDraw.Draw(canvas)
    boxes = [
        (170, "CS2", "Game State Integration", ACCENT),
        (650, "STREAM DECK", "Local plugin runtime", ACCENT),
        (1130, "LEETIFY + FACEIT", "Direct HTTPS requests", WARN),
    ]
    for x, title_value, sub, tone in boxes:
        rounded(draw, (x, 360, x + 390, 590), radius=28, fill=PANEL, outline=BORDER, width=2)
        draw.rounded_rectangle((x + 32, 396, x + 92, 402), radius=3, fill=(*tone, 255))
        title_font = fit_font(draw, title_value, 325, 29, 21)
        draw.text((x + 32, 438), title_value, font=title_font, fill=(*WHITE, 255))
        text(draw, (x + 32, 490), sub, 19, MUTED, False)
    draw.line((560, 475, 650, 475), fill=(*ACCENT, 255), width=4)
    draw.polygon([(642, 465), (660, 475), (642, 485)], fill=(*ACCENT, 255))
    draw.line((1040, 475, 1130, 475), fill=(*WARN, 255), width=4)
    draw.polygon([(1122, 465), (1140, 475), (1122, 485)], fill=(*WARN, 255))
    text(draw, (365, 652), "LOCALHOST ONLY", 16, ACCENT, anchor="mm")
    text(draw, (845, 652), "RAW GSI NEVER LEAVES YOUR PC", 16, ACCENT, anchor="mm")
    text(draw, (1325, 652), "CUSTOMER OWNED API KEYS", 16, WARN, anchor="mm")
    text(draw, (960, 724), "No PackRat provider gateway. No shared provider quota.", 19, MUTED, False, anchor="mm")
    footer(canvas)
    return canvas


def app_icon():
    size = 288
    image = Image.new("RGBA", (size, size), (11, 15, 13, 255))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((18, 18, 270, 270), radius=48, fill=(16, 23, 19, 255), outline=(39, 51, 44, 255), width=4)
    draw.ellipse((82, 82, 206, 206), outline=(*ACCENT, 255), width=10)
    draw.line((144, 48, 144, 103), fill=(*ACCENT, 255), width=10)
    draw.line((144, 185, 144, 240), fill=(*ACCENT, 255), width=10)
    draw.line((48, 144, 103, 144), fill=(*ACCENT, 255), width=10)
    draw.line((185, 144, 240, 144), fill=(*ACCENT, 255), width=10)
    draw.ellipse((131, 131, 157, 157), fill=(*ACCENT, 255))
    return image


if __name__ == "__main__":
    outputs = {
        "0-app-icon-288.png": app_icon(),
        "1-hero.png": hero(),
        "2-features.png": features(),
        "3-setup.png": setup(),
        "4-privacy.png": architecture(),
    }
    for name, image in outputs.items():
        target = OUT / name
        image.convert("RGB").save(target, "PNG", optimize=True)
        print(target)
