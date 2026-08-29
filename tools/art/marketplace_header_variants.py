#!/usr/bin/env python3
"""Render six isolated Marketplace Listing V2 hero-header variations.

These are review-only comparison assets. They reuse the canonical Rat Art
background, calibrated XENEON device plate, and a real product capture. Nothing
here changes the default marketplace renderer until an owner selects a variant.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

import rat_art

W, H = rat_art.W, rat_art.H
WHITE = rat_art.WHITE
MUTED = rat_art.MUTED


def logo(max_size: int) -> Image.Image:
    mark = rat_art._logo_image(max_size)
    if mark is None:
        rat_art.fail("PackRat logo is required for header variants")
    return mark


def place_logo(canvas: Image.Image, x: int, y: int, max_size: int) -> None:
    mark = logo(max_size)
    canvas.alpha_composite(mark, (x, y - mark.height // 2))


def centered(draw: ImageDraw.ImageDraw, text: str, y: int, max_width: int, max_size: int, min_size: int, fill=WHITE, bold: bool = True) -> None:
    font = rat_art.fit_font(draw, text, max_width, max_size, min_size, bold=bold)
    draw.text((W // 2, y), text, font=font, fill=(*fill, 255), anchor="mm")


def supporting(draw: ImageDraw.ImageDraw, text: str, y: int, max_width: int = 900) -> None:
    font = rat_art.fit_font(draw, text, max_width, 21, 15, bold=False)
    draw.text((W // 2, y), text, font=font, fill=(*MUTED, 255), anchor="mm")


def base_canvas(accent: tuple[int, int, int]) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    canvas = rat_art.gradient_bg_v2(accent)
    return canvas, ImageDraw.Draw(canvas)


def add_device(canvas: Image.Image, shot: Path) -> None:
    panel = rat_art.render_device(shot, (1810, 650))
    top = 150
    band_h = 670
    py = top + max(0, (band_h - panel.height) // 2)
    canvas.alpha_composite(panel, ((W - panel.width) // 2, py))


def divider(draw: ImageDraw.ImageDraw, accent: tuple[int, int, int], y: int = 122) -> None:
    draw.line((72, y, W - 72, y), fill=(*accent, 54), width=1)


def save(canvas: Image.Image, out: Path) -> None:
    canvas.convert("RGB").save(out, "PNG", optimize=True)


def variant_1(shot: Path, out: Path, accent: tuple[int, int, int]) -> None:
    canvas, draw = base_canvas(accent)
    place_logo(canvas, 72, 64, 48)
    centered(draw, "PC POWER", 65, 950, 48, 30)
    divider(draw, accent)
    add_device(canvas, shot)
    save(canvas, out)


def variant_2(shot: Path, out: Path, accent: tuple[int, int, int]) -> None:
    canvas, draw = base_canvas(accent)
    place_logo(canvas, 48, 54, 36)
    centered(draw, "PC POWER", 65, 950, 50, 30)
    divider(draw, accent)
    add_device(canvas, shot)
    save(canvas, out)


def variant_3(shot: Path, out: Path, accent: tuple[int, int, int]) -> None:
    canvas, draw = base_canvas(accent)
    place_logo(canvas, 72, 64, 48)
    centered(draw, "PC POWER", 53, 950, 45, 28)
    centered(draw, "PRO", 91, 420, 19, 15, fill=MUTED)
    divider(draw, accent, 126)
    add_device(canvas, shot)
    save(canvas, out)


def variant_4(shot: Path, out: Path, accent: tuple[int, int, int]) -> None:
    canvas, draw = base_canvas(accent)
    place_logo(canvas, 72, 64, 48)
    centered(draw, "PC POWER METER", 65, 1100, 46, 27)
    divider(draw, accent)
    add_device(canvas, shot)
    save(canvas, out)


def variant_5(shot: Path, out: Path, accent: tuple[int, int, int]) -> None:
    canvas, draw = base_canvas(accent)
    place_logo(canvas, 72, 64, 48)
    centered(draw, "PC POWER", 51, 950, 43, 27)
    centered(draw, "Power Meter Pro", 91, 760, 20, 15, fill=MUTED, bold=False)
    divider(draw, accent, 126)
    add_device(canvas, shot)
    save(canvas, out)


def variant_6(shot: Path, out: Path, accent: tuple[int, int, int]) -> None:
    canvas, draw = base_canvas(accent)
    place_logo(canvas, 72, 50, 42)
    label_font = rat_art.fit_font(draw, "XENEON EDGE", 330, 18, 14, bold=False)
    draw.text((72, 91), "XENEON EDGE", font=label_font, fill=(*MUTED, 255), anchor="lm")
    centered(draw, "PC POWER METER", 65, 1100, 46, 27)
    divider(draw, accent, 126)
    add_device(canvas, shot)
    save(canvas, out)


def contact_sheet(paths: list[Path], out: Path) -> None:
    thumb_w, thumb_h = 720, 360
    gap = 34
    margin = 44
    header_h = 88
    label_h = 42
    cols = 2
    rows = 3
    sheet = Image.new("RGB", (margin * 2 + cols * thumb_w + gap, header_h + margin + rows * (thumb_h + label_h) + (rows - 1) * gap + margin), (8, 10, 14))
    draw = ImageDraw.Draw(sheet)
    title_font = rat_art.resolve_font(32, True)
    label_font = rat_art.resolve_font(21, True)
    draw.text((margin, 30), "PackRat Header Variations — choose 1–6", font=title_font, fill=(*WHITE, 255))
    for i, path in enumerate(paths):
        img = Image.open(path).convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        row, col = divmod(i, cols)
        x = margin + col * (thumb_w + gap)
        y = header_h + margin + row * (thumb_h + label_h + gap)
        sheet.paste(img, (x, y))
        draw.text((x, y + thumb_h + 10), str(i + 1), font=label_font, fill=(*WHITE, 255))
    sheet.save(out, "JPEG", quality=94)


def thumbnail_sheet(paths: list[Path], out: Path) -> None:
    target = (320, 160)
    margin = 34
    gap = 22
    label_h = 34
    cols = 3
    rows = 2
    sheet = Image.new("RGB", (margin * 2 + cols * target[0] + (cols - 1) * gap, margin * 2 + rows * (target[1] + label_h) + (rows - 1) * gap), (8, 10, 14))
    draw = ImageDraw.Draw(sheet)
    f = rat_art.resolve_font(18, True)
    for i, path in enumerate(paths):
        img = Image.open(path).convert("RGB").resize(target, Image.Resampling.LANCZOS)
        row, col = divmod(i, cols)
        x = margin + col * (target[0] + gap)
        y = margin + row * (target[1] + label_h + gap)
        sheet.paste(img, (x, y))
        draw.text((x, y + target[1] + 8), str(i + 1), font=f, fill=(*WHITE, 255))
    sheet.save(out, "JPEG", quality=94)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--shots", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    shot = args.shots / "XL_H.png"
    if not shot.is_file():
        rat_art.fail(f"missing real PC Power Meter Pro capture: {shot}")

    _, config, _ = rat_art.load_product("pc-power-meter-pro")
    accent = rat_art.parse_accent(config.get("accent"))
    renderers = [variant_1, variant_2, variant_3, variant_4, variant_5, variant_6]
    outputs: list[Path] = []
    for i, fn in enumerate(renderers, 1):
        path = args.out / f"{i:02d}.png"
        fn(shot, path, accent)
        outputs.append(path)

    contact_sheet(outputs, args.out / "contact-sheet.jpg")
    thumbnail_sheet(outputs, args.out / "thumbnail-sheet.jpg")
    print(f"Rendered {len(outputs)} PackRat header variants to {args.out}")


if __name__ == "__main__":
    main()
