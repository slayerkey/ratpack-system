#!/usr/bin/env python3
"""Deterministic PackRat environment hero compositor.

This renderer keeps product proof deterministic:
- environment plate is a fixed repository asset
- monitor typography is drawn by Pillow with PackRat's deterministic fonts
- XENEON UI comes from a real capture
- XENEON hardware comes from the approved calibrated device plate

No image generation occurs in this script.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFilter

import rat_art

SCENES = Path(__file__).resolve().parent / "scenes"
W, H = rat_art.W, rat_art.H


def fail(message: str) -> None:
    rat_art.fail(message)


def parse_hex(value: str, fallback: tuple[int, int, int]) -> tuple[int, int, int]:
    text = str(value or "").strip().lstrip("#")
    if len(text) != 6:
        return fallback
    try:
        return tuple(int(text[i : i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return fallback


def load_scene(name: str) -> tuple[Path, dict[str, Any], dict[str, Any], Image.Image]:
    scene_dir = SCENES / name
    geometry_path = scene_dir / "geometry.json"
    if not geometry_path.is_file():
        fail(f"environment scene geometry missing: {geometry_path}")
    geometry = json.loads(geometry_path.read_text(encoding="utf-8"))
    if geometry.get("canvas") != [W, H]:
        fail(f"environment scene must use {W}x{H}: {geometry_path}")

    style_path = scene_dir / "title-style.json"
    style = json.loads(style_path.read_text(encoding="utf-8")) if style_path.is_file() else {}

    base_path = scene_dir / str(geometry.get("base") or "base.png")
    if not base_path.is_file():
        fail(f"environment scene base missing: {base_path}")
    base = Image.open(base_path).convert("RGBA")
    if base.size != (W, H):
        fail(f"environment scene base must be exactly {W}x{H}: {base_path}")
    return scene_dir, geometry, style, base


def rect(value: Any, label: str) -> tuple[int, int, int, int]:
    if not isinstance(value, list) or len(value) != 4 or not all(isinstance(v, int) for v in value):
        fail(f"{label} must be [x1,y1,x2,y2]")
    x1, y1, x2, y2 = value
    if not (0 <= x1 < x2 <= W and 0 <= y1 < y2 <= H):
        fail(f"invalid {label}: {value}")
    return x1, y1, x2, y2


def draw_launch_texture(panel: Image.Image, accent: tuple[int, int, int]) -> None:
    """Reference-inspired orange wave/dot treatment; decorative only, never product UI."""
    width, height = panel.size
    layer = Image.new("RGBA", panel.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    # Broad low orange glow concentrated along the lower monitor edge.
    glow = Image.new("RGBA", panel.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-int(width * 0.18), int(height * 0.50), int(width * 1.18), int(height * 1.28)), fill=(*accent, 32))
    panel.alpha_composite(glow.filter(ImageFilter.GaussianBlur(max(16, height // 12))))

    # Fine flowing launch lines like the approved reference monitor art.
    for band in range(14):
        points: list[tuple[int, int]] = []
        amplitude = 17 + band * 2
        baseline = int(height * (0.73 + band * 0.008))
        phase = band * 0.22
        for x in range(-24, width + 25, 7):
            wave = math.sin((x / max(1, width)) * math.pi * 2.1 + phase)
            wave += 0.30 * math.sin((x / max(1, width)) * math.pi * 4.4 + phase * 0.55)
            y = baseline + int(wave * amplitude)
            points.append((x, y))
        draw.line(points, fill=(*accent, max(14, 82 - band * 4)), width=1)

    # Small orange dot field at upper-right, fading into the screen.
    dot_x0 = int(width * 0.77)
    dot_y0 = int(height * 0.05)
    dot_x1 = int(width * 0.98)
    dot_y1 = int(height * 0.50)
    for x in range(dot_x0, dot_x1, 8):
        for y in range(dot_y0, dot_y1, 8):
            dx = (x - dot_x1) / max(1, dot_x1 - dot_x0)
            dy = (y - dot_y0) / max(1, dot_y1 - dot_y0)
            alpha = int(56 * max(0.0, min(1.0, (1.0 + dx) * (1.0 - dy))))
            if alpha >= 5:
                draw.ellipse((x, y, x + 2, y + 2), fill=(*accent, alpha))

    panel.alpha_composite(layer)


def draw_mixed_subtitle(
    draw: ImageDraw.ImageDraw,
    width: int,
    y: int,
    subtitle: str,
    max_width: int,
    max_size: int,
    min_size: int,
    fill: tuple[int, int, int],
) -> None:
    """Draw `for X` with regular `for` and bold product/platform name like the approved reference."""
    subtitle = subtitle.strip()
    if not subtitle:
        return

    prefix = ""
    emphasis = subtitle
    if subtitle.lower().startswith("for "):
        prefix = subtitle[:4]
        emphasis = subtitle[4:]

    for size in range(max_size, min_size - 1, -2):
        regular = rat_art.resolve_font(size, False)
        bold = rat_art.resolve_font(size, True)
        pbox = draw.textbbox((0, 0), prefix, font=regular) if prefix else (0, 0, 0, 0)
        ebox = draw.textbbox((0, 0), emphasis, font=bold)
        pw = pbox[2] - pbox[0]
        ew = ebox[2] - ebox[0]
        gap = max(0, int(size * 0.08)) if prefix else 0
        if pw + gap + ew <= max_width:
            total = pw + gap + ew
            x = (width - total) // 2
            if prefix:
                draw.text((x, y), prefix, font=regular, fill=(*fill, 255), anchor="lm")
            draw.text((x + pw + gap, y), emphasis, font=bold, fill=(*fill, 255), anchor="lm")
            return

    # Safe fallback at minimum size.
    regular = rat_art.resolve_font(min_size, False)
    bold = rat_art.resolve_font(min_size, True)
    pbox = draw.textbbox((0, 0), prefix, font=regular) if prefix else (0, 0, 0, 0)
    ebox = draw.textbbox((0, 0), emphasis, font=bold)
    pw = pbox[2] - pbox[0]
    ew = ebox[2] - ebox[0]
    gap = max(0, int(min_size * 0.08)) if prefix else 0
    x = (width - (pw + gap + ew)) // 2
    if prefix:
        draw.text((x, y), prefix, font=regular, fill=(*fill, 255), anchor="lm")
    draw.text((x + pw + gap, y), emphasis, font=bold, fill=(*fill, 255), anchor="lm")


def monitor_art(
    width: int,
    height: int,
    title: str,
    accent_title: str,
    subtitle: str,
    accent: tuple[int, int, int],
    style: dict[str, Any],
) -> Image.Image:
    colors = style.get("colors") if isinstance(style.get("colors"), dict) else {}
    layout = style.get("layout") if isinstance(style.get("layout"), dict) else {}
    type_style = style.get("type") if isinstance(style.get("type"), dict) else {}

    screen = parse_hex((style.get("background") or {}).get("screen", "#05070A") if isinstance(style.get("background"), dict) else "#05070A", (5, 7, 10))
    title_color = parse_hex(colors.get("title", "#F7F9FC"), (247, 249, 252))
    subtitle_color = parse_hex(colors.get("subtitle", "#F2F3F5"), (242, 243, 245))

    panel = Image.new("RGBA", (width, height), (*screen, 255))
    draw_launch_texture(panel, accent)
    draw = ImageDraw.Draw(panel)

    title = title.strip().upper()
    accent_title = accent_title.strip().upper()
    subtitle = subtitle.strip()

    top_y = float(layout.get("title_top_y", 0.19))
    accent_y = float(layout.get("accent_title_y", 0.46))
    subtitle_y = float(layout.get("subtitle_y", 0.70))
    top_width = float(layout.get("title_max_width", 0.82))
    accent_width = float(layout.get("accent_title_max_width", 0.82))
    subtitle_width = float(layout.get("subtitle_max_width", 0.64))

    top_height = float(type_style.get("title_max_height", 0.22))
    accent_height = float(type_style.get("accent_title_max_height", 0.25))
    subtitle_height = float(type_style.get("subtitle_max_height", 0.09))

    top_font = rat_art.fit_font(draw, title, int(width * top_width), int(height * top_height), 52, True)
    accent_font = rat_art.fit_font(draw, accent_title, int(width * accent_width), int(height * accent_height), 56, True)

    draw.text((width // 2, int(height * top_y)), title, font=top_font, fill=(*title_color, 255), anchor="mm")
    draw.text((width // 2, int(height * accent_y)), accent_title, font=accent_font, fill=(*accent, 255), anchor="mm")

    if subtitle:
        draw_mixed_subtitle(
            draw,
            width,
            int(height * subtitle_y),
            subtitle,
            int(width * subtitle_width),
            int(height * subtitle_height),
            26,
            subtitle_color,
        )

    return panel


def add_brand(canvas: Image.Image, geometry: dict[str, Any]) -> None:
    anchor = geometry.get("brand_anchor")
    if not isinstance(anchor, list) or len(anchor) != 2:
        fail("brand_anchor must be [x,y]")
    x, y = int(anchor[0]), int(anchor[1])
    max_size = int(geometry.get("brand_max_size") or 60)
    logo = rat_art._logo_image(max_size)
    if logo is None:
        fail("PackRat logo missing")
    canvas.alpha_composite(logo, (x - logo.width // 2, y - logo.height // 2))


def add_product(canvas: Image.Image, geometry: dict[str, Any], shot_path: Path) -> None:
    x1, y1, x2, y2 = rect(geometry.get("product_box"), "product_box")
    panel = rat_art.render_device(shot_path, (x2 - x1, y2 - y1))
    px = x1 + ((x2 - x1) - panel.width) // 2
    py = y1 + ((y2 - y1) - panel.height) // 2

    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    shadow_y = min(H - 20, py + panel.height - 8)
    sd.ellipse(
        (px + int(panel.width * 0.05), shadow_y - 10, px + int(panel.width * 0.95), shadow_y + 52),
        fill=(0, 0, 0, 92),
    )
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(28)))
    canvas.alpha_composite(panel, (px, py))


def render(
    scene: str,
    shot_path: Path,
    out: Path,
    title: str,
    accent_title: str,
    subtitle: str,
    accent: tuple[int, int, int],
    brand: bool,
) -> None:
    _, geometry, style, canvas = load_scene(scene)

    mx1, my1, mx2, my2 = rect(geometry.get("monitor_screen"), "monitor_screen")
    monitor = monitor_art(mx2 - mx1, my2 - my1, title, accent_title, subtitle, accent, style)
    canvas.alpha_composite(monitor, (mx1, my1))

    if brand:
        add_brand(canvas, geometry)

    add_product(canvas, geometry, shot_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out, "PNG", optimize=True)
    print(f"ENVIRONMENT HERO PASS: {out}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scene", default="warm-studio-v1")
    parser.add_argument("--shots", type=Path, required=True)
    parser.add_argument("--shot", default="XL_H.png")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--accent-title", required=True)
    parser.add_argument("--subtitle", default="for XENEON Edge")
    parser.add_argument("--accent", default="#F27900")
    parser.add_argument("--no-brand", action="store_true")
    args = parser.parse_args()

    shot_path = args.shots / args.shot
    if not shot_path.is_file():
        fail(f"real XENEON capture missing: {shot_path}")
    accent = rat_art.parse_accent(args.accent)
    render(
        args.scene,
        shot_path,
        args.out,
        args.title,
        args.accent_title,
        args.subtitle,
        accent,
        not args.no_brand,
    )


if __name__ == "__main__":
    main()
