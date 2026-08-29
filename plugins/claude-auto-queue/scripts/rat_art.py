from __future__ import annotations

import argparse
from pathlib import Path
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[3]
RAT = ROOT / "tools" / "art" / "assets" / "ratpack-icon-transparent.png"
W, H = 1920, 960
BG = (7, 10, 14)
PANEL = (16, 20, 26)
BORDER = (43, 50, 61)
WHITE = (247, 249, 251)
MUTED = (169, 179, 192)
ACCENT = (43, 232, 106)
WARN = (243, 184, 74)
RED = (255, 90, 103)


def fail(message: str) -> None:
    raise SystemExit(f"RAT ART FAIL: {message}")


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    env = os.getenv("RATPACK_ART_FONT_BOLD" if bold else "RATPACK_ART_FONT")
    candidates = [env] if env else []
    if os.name == "nt":
        candidates += [
            r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        ]
    else:
        candidates += [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return ImageFont.truetype(candidate, size)
    fail("required deterministic font was not found")


def background() -> Image.Image:
    canvas = Image.new("RGBA", (W, H), (*BG, 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse((720, 80, 1900, 1120), fill=(*ACCENT, 24))
    draw.ellipse((-400, -350, 700, 520), fill=(44, 78, 122, 24))
    return Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(170)))


def signature(canvas: Image.Image) -> None:
    if not RAT.is_file():
        fail(f"PackRat brand mark missing: {RAT}")
    rat = Image.open(RAT).convert("RGBA")
    box = rat.getbbox()
    if box:
        rat = rat.crop(box)
    scale = min(46 / rat.width, 46 / rat.height)
    rat = rat.resize((max(1, int(rat.width * scale)), max(1, int(rat.height * scale))), Image.Resampling.LANCZOS)
    canvas.alpha_composite(rat, ((W - rat.width) // 2, 884 - rat.height // 2))


def footer(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.line((0, 824, W, 824), fill=(*ACCENT, 68), width=1)
    signature(canvas)


def header(canvas: Image.Image, title: str, subtitle: str) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.text((110, 90), "AUTO QUEUE FOR CLAUDE CODE", font=font(23), fill=(*ACCENT, 255))
    draw.text((110, 132), title, font=font(60), fill=(*WHITE, 255))
    draw.text((112, 214), subtitle, font=font(27, False), fill=(*MUTED, 255))


def card(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int = 28) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=(*PANEL, 245), outline=(*BORDER, 255), width=2)


def key_face(canvas: Image.Image, x: int, y: int, size: int, top: str, main: str, sub: str = "", accent=ACCENT) -> None:
    draw = ImageDraw.Draw(canvas)
    card(draw, (x, y, x + size, y + size), 20)
    draw.rounded_rectangle((x + 14, y + 13, x + 56, y + 17), radius=2, fill=(*accent, 255))
    draw.ellipse((x + size - 21, y + 12, x + size - 16, y + 17), fill=(*accent, 255))
    draw.text((x + 14, y + 30), top, font=font(11), fill=(*MUTED, 255))
    draw.text((x + 14, y + 58), main, font=font(18), fill=(*WHITE, 255))
    if sub:
        draw.text((x + 14, y + 87), sub, font=font(12), fill=(*accent, 255))


def deck(canvas: Image.Image, x: int, y: int, scale: float = 1.0) -> None:
    draw = ImageDraw.Draw(canvas)
    key = int(128 * scale)
    gap = int(15 * scale)
    pad = int(27 * scale)
    width = pad * 2 + key * 5 + gap * 4
    height = pad * 2 + key * 3 + gap * 2
    draw.rounded_rectangle((x, y, x + width, y + height), radius=int(42 * scale), fill=(5, 7, 10, 255), outline=(48, 56, 67, 255), width=max(2, int(3 * scale)))
    labels = [
        ("CLAUDE", "WORKING", "2:14", ACCENT),
        ("AUTO QUEUE", "RUN TESTS", "QUEUE NEXT", ACCENT),
        ("AUTO QUEUE", "FIX ERRORS", "QUEUE NEXT", ACCENT),
        ("AUTO QUEUE", "REVIEW CODE", "QUEUE NEXT", ACCENT),
        ("AUTO QUEUE", "CONTINUE", "QUEUE NEXT", ACCENT),
        ("NEXT IN QUEUE", "UP NEXT", "Run tests…", ACCENT),
        ("AUTO QUEUE", "DOCUMENT", "QUEUE NEXT", ACCENT),
        ("AUTO QUEUE", "COMMIT LOCAL", "QUEUE NEXT", ACCENT),
        ("AUTO QUEUE", "VERIFY", "QUEUE NEXT", ACCENT),
        ("AUTO QUEUE", "PLAN NEXT", "QUEUE NEXT", ACCENT),
        ("QUEUE CONTROL", "REMOVE", "NEXT", WARN),
        ("QUEUE CONTROL", "MOVE NEXT", "TO END", WARN),
        ("QUEUE CONTROL", "CLEAR", "QUEUE", RED),
        ("AUTO QUEUE", "SUMMARIZE", "QUEUE NEXT", ACCENT),
        ("AUTO QUEUE", "FINISH TASK", "QUEUE NEXT", ACCENT),
    ]
    for index, (top, main, sub, accent) in enumerate(labels):
        col, row = index % 5, index // 5
        key_face(canvas, x + pad + col * (key + gap), y + pad + row * (key + gap), key, top, main, sub, accent)


def feature(draw: ImageDraw.ImageDraw, x: int, y: int, title: str, body: str, accent=ACCENT) -> None:
    draw.ellipse((x, y + 5, x + 14, y + 19), fill=(*accent, 255))
    draw.text((x + 31, y), title, font=font(26), fill=(*WHITE, 255))
    draw.text((x + 31, y + 40), body, font=font(20, False), fill=(*MUTED, 255))


def save(canvas: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(path, "PNG", optimize=True)


def render_icon(out: Path) -> None:
    size = 512
    canvas = Image.new("RGBA", (size, size), (8, 11, 15, 255))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((8, 8, size - 8, size - 8), radius=92, fill=(14, 18, 24, 255), outline=(47, 56, 68, 255), width=8)
    for y, alpha in [(144, 255), (218, 205), (292, 155)]:
        draw.rounded_rectangle((102, y, 332, y + 30), radius=15, fill=(*ACCENT, alpha))
    draw.line((362, 194, 362, 314), fill=(*ACCENT, 255), width=20)
    draw.line((302, 254, 422, 254), fill=(*ACCENT, 255), width=20)
    canvas.save(out, "PNG", optimize=True)


def hero(out: Path) -> None:
    canvas = background(); header(canvas, "Keep Claude working.", "Queue the next job from Stream Deck while Claude finishes the current one.")
    deck(canvas, 700, 300, .83)
    draw = ImageDraw.Draw(canvas)
    draw.text((110, 370), "WORKING", font=font(33), fill=(*ACCENT, 255))
    draw.text((110, 424), "Queue follow-up work", font=font(32), fill=(*WHITE, 255))
    draw.text((110, 468), "without interrupting Claude.", font=font(32), fill=(*WHITE, 255))
    draw.text((110, 548), "Then watch it continue", font=font(23, False), fill=(*MUTED, 255))
    draw.text((110, 583), "in the same conversation.", font=font(23, False), fill=(*MUTED, 255))
    footer(canvas); save(canvas, out)


def features(out: Path) -> None:
    canvas = background(); header(canvas, "Queue work. Stay in flow.", "A physical Claude control center that keeps the next step ready.")
    draw = ImageDraw.Draw(canvas)
    feature(draw, 150, 350, "Queue while Claude works", "Add the next request without interrupting the current turn.")
    feature(draw, 150, 475, "Know when Claude needs you", "Working, finished, permission and error states stay visible.", WARN)
    feature(draw, 150, 600, "Control the queue", "See what is next, remove it, move it, or clear everything.")
    feature(draw, 1010, 350, "Auto follows your active chat", "Use Claude normally. Bind a key only when you want a fixed chat.")
    feature(draw, 1010, 475, "Persistent and local", "Queued prompts survive plugin restarts and stay on this computer.")
    feature(draw, 1010, 600, "Ready-made profiles included", "Standard, Mini, XL, Plus and Neo layouts are ready to install.")
    footer(canvas); save(canvas, out)


def profiles(out: Path) -> None:
    canvas = background(); header(canvas, "A complete Claude command center.", "Useful defaults on day one. Every Queue Prompt key is editable.")
    deck(canvas, 360, 300, .93)
    footer(canvas); save(canvas, out)


def setup(out: Path) -> None:
    canvas = background(); header(canvas, "Connect once. Then use Claude normally.", "Supported Claude Code hooks power active-chat detection and same-chat handoff.")
    draw = ImageDraw.Draw(canvas)
    card(draw, (170, 330, 840, 700), 34)
    draw.text((220, 385), "ONE TIME SETUP", font=font(18), fill=(*ACCENT, 255))
    draw.text((220, 435), "Connect Claude Code", font=font(36), fill=(*WHITE, 255))
    draw.text((220, 505), "1  Open Setup", font=font(24), fill=(*WHITE, 255))
    draw.text((220, 555), "2  Click Connect Claude Code", font=font(24), fill=(*WHITE, 255))
    draw.text((220, 605), "3  Use Claude normally", font=font(24), fill=(*WHITE, 255))
    card(draw, (1010, 330, 1750, 700), 34)
    draw.text((1065, 385), "LOCAL BY DESIGN", font=font(18), fill=(*ACCENT, 255))
    draw.text((1065, 447), "Prompts stay on this PC", font=font(29), fill=(*WHITE, 255))
    draw.text((1065, 505), "No PackRat account", font=font(22, False), fill=(*MUTED, 255))
    draw.text((1065, 548), "No credential access", font=font(22, False), fill=(*MUTED, 255))
    draw.text((1065, 591), "No prompt uploads", font=font(22, False), fill=(*MUTED, 255))
    draw.text((1065, 634), "Windows + Claude Code 2.1.163+", font=font(22, False), fill=(*MUTED, 255))
    footer(canvas); save(canvas, out)


def compatibility(out: Path) -> None:
    canvas = background(); header(canvas, "Built for the Stream Deck family.", "One plugin. Ready-made layouts for the decks most people use.")
    draw = ImageDraw.Draw(canvas)
    devices = [("STREAM DECK", "15 keys"), ("MINI", "6 keys"), ("XL", "32 keys"), ("STREAM DECK +", "8 keys"), ("NEO", "8 keys")]
    x = 155
    for name, count in devices:
        card(draw, (x, 350, x + 290, 650), 28)
        draw.text((x + 28, 402), name, font=font(21), fill=(*WHITE, 255))
        draw.text((x + 28, 445), count, font=font(18, False), fill=(*MUTED, 255))
        cols = 3 if name == "MINI" else 4
        rows = 2 if name in {"MINI", "STREAM DECK +", "NEO"} else 3
        cell = 39
        gap = 10
        for row in range(rows):
            for col in range(cols):
                xx = x + 31 + col * (cell + gap)
                yy = 510 + row * (cell + gap)
                draw.rounded_rectangle((xx, yy, xx + cell, yy + cell), radius=7, fill=(20, 25, 32), outline=(*BORDER, 255), width=1)
        x += 330
    footer(canvas); save(canvas, out)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    out = Path(args.out).resolve(); out.mkdir(parents=True, exist_ok=True)
    render_icon(out / "01_search_icon.png")
    hero(out / "02_cover.png")
    features(out / "03_gallery_01.png")
    profiles(out / "04_gallery_02.png")
    setup(out / "05_gallery_03.png")
    compatibility(out / "06_gallery_04.png")
    print(f"RAT ART PASS: {out}")


if __name__ == "__main__":
    main()
