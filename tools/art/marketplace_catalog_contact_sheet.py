#!/usr/bin/env python3
"""Build a deterministic cross-catalog hero contact sheet.

Input is deliberately explicit: each item is `slug=path/to/hero.png`. This keeps
judgment-driven product selection outside the renderer while making the final
catalog consistency check repeatable.
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BG = (7, 9, 12)
WHITE = (246, 249, 252)
MUTED = (175, 185, 198)


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).is_file():
            return ImageFont.truetype(candidate, size)
    raise SystemExit("required deterministic contact-sheet font was not found")


def parse_item(raw: str) -> tuple[str, Path]:
    if "=" not in raw:
        raise argparse.ArgumentTypeError("hero item must be slug=path")
    slug, path = raw.split("=", 1)
    slug = slug.strip()
    if not slug:
        raise argparse.ArgumentTypeError("hero slug cannot be empty")
    file_path = Path(path).expanduser().resolve()
    if not file_path.is_file():
        raise argparse.ArgumentTypeError(f"hero file does not exist: {file_path}")
    return slug, file_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--hero", action="append", required=True, type=parse_item, help="slug=path/to/hero.png")
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--title", default="PackRat Marketplace Listing V2 — Catalog Heroes")
    parser.add_argument("--columns", type=int, default=3)
    args = parser.parse_args()

    if not 1 <= args.columns <= 6:
        raise SystemExit("--columns must be between 1 and 6")

    items = args.hero
    thumb_w, thumb_h = 560, 280
    label_h = 42
    gap = 26
    margin = 34
    header_h = 88
    rows = math.ceil(len(items) / args.columns)
    width = margin * 2 + args.columns * thumb_w + (args.columns - 1) * gap
    height = header_h + margin + rows * (thumb_h + label_h) + max(0, rows - 1) * gap + margin

    sheet = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(sheet)
    draw.text((margin, 30), args.title, font=font(30), fill=WHITE)

    for index, (slug, path) in enumerate(items):
        row, col = divmod(index, args.columns)
        x = margin + col * (thumb_w + gap)
        y = header_h + margin + row * (thumb_h + label_h + gap)
        image = Image.open(path).convert("RGB")
        if image.size != (1920, 960):
            raise SystemExit(f"hero must be 1920x960: {slug} is {image.size}")
        image = image.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.paste(image, (x, y))
        draw.text((x + 3, y + thumb_h + 10), slug, font=font(18, False), fill=MUTED)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.out, quality=93)
    print(f"CATALOG CONTACT SHEET PASS: {len(items)} heroes -> {args.out}")


if __name__ == "__main__":
    main()
