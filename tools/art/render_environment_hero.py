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

ROOT = Path(__file__).resolve().parents[2]
SCENES = Path(__file__).resolve().parent / "scenes"
W, H = rat_art.W, rat_art.H
WHITE = (247, 249, 252)
ORANGE = (242, 121, 0)
MUTED = (214, 218, 224)


def fail(message: str) -> None:
    rat_art.fail(message)


def load_scene(name: str) -> tuple[Path, dict[str, Any], Image.Image]:
    scene_dir = SCENES / name
    geometry_path = scene_dir / "geometry.json"
    if not geometry_path.is_file():
        fail(f"environment scene geometry missing: {geometry_path}")
    geometry = json.loads(geometry_path.read_text(encoding="utf-8"))
    if geometry.get("canvas") != [W, H]:
        fail(f"environment scene must use {W}x{H}: {geometry_path}")
    base_path = scene_dir / str(geometry.get("base") or "base.png")
    if not base_path.is_file():
        fail(f"environment scene base missing: {base_path}")
    base = Image.open(base_path).convert("RGBA")
    if base.size != (W, H):
        fail(f"environment scene base must be exactly {W}x{H}: {base_path}")
    return scene_dir, geometry, base


def rect(value: Any, label: str) -> tuple[int, int, int, int]:
    if not isinstance(value, list) or len(value) != 4 or not all(isinstance(v, int) for v in value):
        fail(f"{label} must be [x1,y1,x2,y2]")
    x1, y1, x2, y2 = value
    if not (0 <= x1 < x2 <= W and 0 <= y1 < y2 <= H):
        fail(f"invalid {label}: {value}")
    return x1, y1, x2, y2


def monitor_art(width: int, height: int, title: str, accent_title: str, subtitle: str, accent: tuple[int, int, int]) -> Image.Image:
    panel = Image.new("RGBA", (width, height), (5, 7, 10, 255))
    draw = ImageDraw.Draw(panel)

    # Deterministic warm launch texture: subtle curves and dots, never product UI.
    for band in range(5):
        points = []
        amplitude = 20 + band * 9
        baseline = int(height * (0.72 + band * 0.035))
        phase = band * 0.55
        for x in range(-20, width + 21, 12):
            y = baseline + int(math.sin((x / max(1, width)) * math.pi * 2.15 + phase) * amplitude)
            points.append((x, y))
        draw.line(points, fill=(*accent, max(32, 92 - band * 12)), width=max(1, 3 - band // 2))

    for x in range(int(width * 0.78), width, 10):
        for y in range(22, int(height * 0.58), 10):
            distance = ((x - width * 0.84) ** 2 + (y - height * 0.28) ** 2) ** 0.5
            alpha = max(0, int(48 - distance / 10))
            if alpha > 3:
                draw.ellipse((x, y, x + 2, y + 2), fill=(*accent, alpha))

    title = title.strip().upper()
    accent_title = accent_title.strip().upper()
    subtitle = subtitle.strip()

    top_font = rat_art.fit_font(draw, title, int(width * 0.86), int(height * 0.23), 54, True)
    accent_font = rat_art.fit_font(draw, accent_title, int(width * 0.86), int(height * 0.25), 58, True)
    draw.text((width // 2, int(height * 0.23)), title, font=top_font, fill=(*WHITE, 255), anchor="mm")
    draw.text((width // 2, int(height * 0.49)), accent_title, font=accent_font, fill=(*accent, 255), anchor="mm")

    if subtitle:
        sub_font = rat_art.fit_font(draw, subtitle, int(width * 0.78), int(height * 0.095), 28, False)
        draw.text((width // 2, int(height * 0.70)), subtitle, font=sub_font, fill=(*MUTED, 255), anchor="mm")

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

    # Small natural grounding shadow. Hardware/UI itself remains untouched.
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
    _, geometry, canvas = load_scene(scene)

    mx1, my1, mx2, my2 = rect(geometry.get("monitor_screen"), "monitor_screen")
    monitor = monitor_art(mx2 - mx1, my2 - my1, title, accent_title, subtitle, accent)
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
