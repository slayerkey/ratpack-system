from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
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


def fit_font(draw: ImageDraw.ImageDraw, text: str, max_width: int, max_size: int, min_size: int, bold: bool = True):
    for size in range(max_size, min_size - 1, -2):
        f = font(size, bold)
        box = draw.textbbox((0, 0), text, font=f)
        if box[2] - box[0] <= max_width:
            return f
    return font(min_size, bold)


def background() -> Image.Image:
    canvas = Image.new("RGBA", (W, H), (*BG, 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse((420, 110, 1540, 1110), fill=(*ACCENT, 24))
    draw.ellipse((-450, -390, 650, 480), fill=(44, 78, 122, 20))
    draw.ellipse((1450, -300, 2250, 470), fill=(91, 69, 156, 14))
    return Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(175)))


def logo(max_size: int = 50) -> Image.Image:
    if not RAT.is_file():
        fail(f"PackRat brand mark missing: {RAT}")
    rat = Image.open(RAT).convert("RGBA")
    box = rat.getbbox()
    if box:
        rat = rat.crop(box)
    scale = min(max_size / rat.width, max_size / rat.height)
    return rat.resize((max(1, int(rat.width * scale)), max(1, int(rat.height * scale))), Image.Resampling.LANCZOS)


def top_brand(canvas: Image.Image) -> None:
    rat = logo(48)
    canvas.alpha_composite(rat, ((W - rat.width) // 2, 58 - rat.height // 2))


def hero_chrome(canvas: Image.Image, left: str, right: str = "STREAM DECK") -> None:
    draw = ImageDraw.Draw(canvas)
    top_brand(canvas)
    draw.text((72, 66), left.upper(), font=fit_font(draw, left.upper(), 650, 46, 26), fill=(*WHITE, 255), anchor="lm")
    draw.text((W - 72, 66), right.upper(), font=fit_font(draw, right.upper(), 650, 27, 18), fill=(*MUTED, 255), anchor="rm")
    draw.line((72, 118, W - 72, 118), fill=(*ACCENT, 55), width=1)


def gallery_header(canvas: Image.Image, title: str, subtitle: str = "") -> int:
    draw = ImageDraw.Draw(canvas)
    draw.text((W // 2, 68), title, font=fit_font(draw, title, 1600, 56, 34), fill=(*WHITE, 255), anchor="mm")
    y = 122
    if subtitle:
        draw.text((W // 2, y), subtitle, font=fit_font(draw, subtitle, 1560, 26, 17, False), fill=(*MUTED, 255), anchor="mm")
        y = 154
    draw.line((110, y + 10, W - 110, y + 10), fill=(*ACCENT, 56), width=1)
    return y + 35


def footer(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.line((88, 842, W - 88, 842), fill=(*ACCENT, 52), width=1)
    rat = logo(44)
    canvas.alpha_composite(rat, ((W - rat.width) // 2, 900 - rat.height // 2))


def card(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int = 28) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=(*PANEL, 245), outline=(*BORDER, 255), width=2)


def key_face(canvas: Image.Image, x: int, y: int, size: int, top: str, main: str, sub: str = "", accent=ACCENT) -> None:
    draw = ImageDraw.Draw(canvas)
    card(draw, (x, y, x + size, y + size), 20)
    draw.rounded_rectangle((x + 14, y + 13, x + 56, y + 17), radius=2, fill=(*accent, 255))
    draw.ellipse((x + size - 21, y + 12, x + size - 16, y + 17), fill=(*accent, 255))
    draw.text((x + 14, y + 30), top, font=font(max(9, int(size * .083))), fill=(*MUTED, 255))
    draw.text((x + 14, y + int(size * .45)), main, font=font(max(14, int(size * .14))), fill=(*WHITE, 255))
    if sub:
        draw.text((x + 14, y + int(size * .69)), sub, font=font(max(10, int(size * .09))), fill=(*accent, 255))


def deck_dimensions(scale: float) -> tuple[int, int, int, int, int]:
    key = int(128 * scale)
    gap = int(15 * scale)
    pad = int(27 * scale)
    width = pad * 2 + key * 5 + gap * 4
    height = pad * 2 + key * 3 + gap * 2
    return key, gap, pad, width, height


def deck(canvas: Image.Image, x: int, y: int, scale: float = 1.0) -> tuple[int, int]:
    draw = ImageDraw.Draw(canvas)
    key, gap, pad, width, height = deck_dimensions(scale)
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
    return width, height


def feature(draw: ImageDraw.ImageDraw, x: int, y: int, title: str, body: str, accent=ACCENT, max_width: int = 820) -> None:
    draw.rounded_rectangle((x, y + 7, x + 9, y + 29), radius=3, fill=(*accent, 255))
    title = title.upper()
    draw.text((x + 27, y), title, font=fit_font(draw, title, max_width - 27, 28, 21), fill=(*WHITE, 255))
    draw.text((x + 27, y + 40), body, font=fit_font(draw, body, max_width - 27, 19, 15, False), fill=(*MUTED, 255))


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
    canvas = background()
    hero_chrome(canvas, "CLAUDE QUEUE")
    scale = 1.46
    _, _, _, width, height = deck_dimensions(scale)
    x = (W - width) // 2
    y = 145 + (650 - height) // 2
    deck(canvas, x, y, scale)
    draw = ImageDraw.Draw(canvas)
    line = "Queue the next job without interrupting the current turn."
    draw.text((W // 2, 833), line, font=fit_font(draw, line, 1450, 24, 17, False), fill=(*MUTED, 255), anchor="mm")
    save(canvas, out)


def features(out: Path) -> None:
    canvas = background()
    top = gallery_header(canvas, "Keep the next step ready.", "Queue follow-up work from Stream Deck while Claude finishes what it is already doing.")
    draw = ImageDraw.Draw(canvas)
    scale = .88
    _, _, _, width, height = deck_dimensions(scale)
    dx = 76
    dy = top + max(0, (590 - height) // 2)
    deck(canvas, dx, dy, scale)
    x = 965
    y = top + 38
    feature(draw, x, y, "Queue while Claude works", "The next prompt waits locally instead of interrupting the current turn.")
    feature(draw, x, y + 128, "See when Claude needs you", "Working, finished, attention, and error states stay visible on the deck.", WARN)
    feature(draw, x, y + 256, "Control what is next", "See the next request, remove it, move it, or clear the queue.")
    feature(draw, x, y + 384, "Keep it local", "Queued prompts stay on this PC; PackRat does not upload them.")
    footer(canvas)
    save(canvas, out)


def profiles(out: Path) -> None:
    canvas = background()
    top = gallery_header(canvas, "A Claude command center from day one.", "Ready-made layouts give the queue a useful home, while every Queue Prompt key stays editable.")
    scale = 1.18
    _, _, _, width, height = deck_dimensions(scale)
    deck(canvas, (W - width) // 2, top + max(5, (585 - height) // 2), scale)
    footer(canvas)
    save(canvas, out)


def setup(out: Path) -> None:
    canvas = background()
    gallery_header(canvas, "Connect once. Then use Claude normally.", "The setup is there to establish the supported Claude Code handoff — not become part of your daily workflow.")
    draw = ImageDraw.Draw(canvas)
    card(draw, (150, 300, 880, 710), 34)
    draw.text((205, 355), "ONE-TIME SETUP", font=font(18), fill=(*ACCENT, 255))
    draw.text((205, 412), "Connect Claude Code", font=font(36), fill=(*WHITE, 255))
    draw.text((205, 500), "1   Open Setup", font=font(24), fill=(*WHITE, 255))
    draw.text((205, 552), "2   Click Connect Claude Code", font=font(24), fill=(*WHITE, 255))
    draw.text((205, 604), "3   Send one normal Claude message", font=font(24), fill=(*WHITE, 255))
    card(draw, (1015, 300, 1770, 710), 34)
    draw.text((1070, 355), "LOCAL BY DESIGN", font=font(18), fill=(*ACCENT, 255))
    draw.text((1070, 420), "Your queue stays here.", font=font(33), fill=(*WHITE, 255))
    draw.text((1070, 500), "No PackRat account", font=font(22, False), fill=(*MUTED, 255))
    draw.text((1070, 548), "No Claude credential access", font=font(22, False), fill=(*MUTED, 255))
    draw.text((1070, 596), "No prompt uploads", font=font(22, False), fill=(*MUTED, 255))
    draw.text((1070, 644), "Windows + Claude Code 2.1.163+", font=font(21, False), fill=(*MUTED, 255))
    footer(canvas)
    save(canvas, out)


def compatibility(out: Path) -> None:
    canvas = background()
    gallery_header(canvas, "Use the Stream Deck you already have.", "Included layouts cover the main Stream Deck family without changing how the plugin works.")
    draw = ImageDraw.Draw(canvas)
    devices = [("STREAM DECK", "15 keys"), ("MINI", "6 keys"), ("XL", "32 keys"), ("STREAM DECK +", "8 keys"), ("NEO", "8 keys")]
    x = 155
    for name, count in devices:
        card(draw, (x, 335, x + 290, 660), 28)
        draw.text((x + 28, 388), name, font=fit_font(draw, name, 232, 21, 16), fill=(*WHITE, 255))
        draw.text((x + 28, 431), count, font=font(18, False), fill=(*MUTED, 255))
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
    footer(canvas)
    save(canvas, out)


def contact_sheet(out_dir: Path) -> None:
    order = ["02_cover.png", "03_gallery_01.png", "04_gallery_02.png", "05_gallery_03.png", "06_gallery_04.png"]
    sheet = Image.new("RGB", (1360, 1120), (7, 9, 12))
    draw = ImageDraw.Draw(sheet)
    title = "Auto Queue for Claude Code • Marketplace Listing V2"
    draw.text((38, 35), title, font=fit_font(draw, title, 1280, 38, 23), fill=WHITE)
    positions = [(36, 100), (684, 100), (36, 440), (684, 440), (360, 780)]
    for idx, (name, (x, y)) in enumerate(zip(order, positions), start=1):
        image = Image.open(out_dir / name).convert("RGB").resize((640, 320), Image.Resampling.LANCZOS)
        sheet.paste(image, (x, y))
        draw.text((x + 4, y + 325), f"{idx}. {name}", font=font(15, False), fill=MUTED)
    sheet.save(out_dir / "contact-sheet.jpg", quality=92)


def thumbnail_sheet(out_dir: Path) -> None:
    hero_img = Image.open(out_dir / "02_cover.png").convert("RGB")
    sheet = Image.new("RGB", (1040, 720), (7, 9, 12))
    draw = ImageDraw.Draw(sheet)
    title = "Auto Queue for Claude Code • hero thumbnail gate"
    draw.text((36, 30), title, font=fit_font(draw, title, 960, 34, 22), fill=WHITE)
    y = 92
    for width, height in [(480, 240), (320, 160), (240, 120)]:
        thumb = hero_img.resize((width, height), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (36, y))
        draw.text((56 + width, y + height // 2), f"{width} × {height}", font=font(20), fill=WHITE, anchor="lm")
        y += height + 54
    sheet.save(out_dir / "thumbnail-sheet.jpg", quality=92)


def sha(path: Path) -> str:
    h = hashlib.sha256(); h.update(path.read_bytes()); return h.hexdigest()


def report(out_dir: Path) -> None:
    images = ["02_cover.png", "03_gallery_01.png", "04_gallery_02.png", "05_gallery_03.png", "06_gallery_04.png"]
    hashes = [sha(out_dir / name) for name in images]
    if len(set(hashes)) != len(hashes):
        fail("marketplace frames must be distinct")
    payload = {
        "schema_version": 1,
        "design_system": "marketplace-listing-v2",
        "image_generation": "disabled",
        "product": "claude-auto-queue",
        "marketplace_order": images,
        "thumbnail_sheet": "thumbnail-sheet.jpg",
        "contact_sheet": "contact-sheet.jpg",
        "demo_recommended": True,
        "demo_reason": "The product's core value is a state transition: queue while Claude is working, then hand off the next prompt at the turn boundary.",
        "outputs": {name: {"size": Image.open(out_dir / name).size, "sha256": sha(out_dir / name)} for name in images},
    }
    (out_dir / "rat-art-report.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


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
    contact_sheet(out)
    thumbnail_sheet(out)
    report(out)
    print(f"RAT ART PASS: {out}")


if __name__ == "__main__":
    main()
