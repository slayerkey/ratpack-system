#!/usr/bin/env python3
"""Canonical deterministic Rat Art renderer for PackRat marketplace art.

This tool never calls an image generation API. Product-specific copy and capture
choices live beside each product. The shared renderer owns deterministic device
plates, composition, contact sheets, and V2 thumbnail review.

Schema v1 is intentionally preserved for already-approved products. Marketplace
Listing V2 is opt-in via rat-art.json schema_version 2.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
W, H = 1920, 960
BG = (5, 8, 11)
WHITE = (246, 249, 252)
MUTED = (184, 193, 207)
ACCENT = (43, 232, 106)
ASSET_DIR = Path(__file__).resolve().parent / "assets"
DEVICE = ASSET_DIR / "xeneon-edge-straight.png"
DEVICE_QUAD = ASSET_DIR / "xeneon-edge-straight.quad"
RAT = ASSET_DIR / "ratpack-icon-transparent.png"
SLOT_ORDER = ["S_H", "S_V", "M_H", "M_V", "L_H", "L_V", "XL_H", "XL_V"]
CONTENT_DIVIDER_Y = 690
CONTENT_FOOTER_TEXT_Y = 744
V1_MARKETPLACE_ORDER = ["1-hero.png", "3-features.png", "2-showcase.png", "4-settings.png", "5-sizes.png"]
V2_DEFAULT_ORDER = ["1-hero.png", "3-features.png", "2-showcase.png", "4-settings.png", "5-sizes.png"]


def fail(msg: str) -> None:
    raise SystemExit(f"RAT ART FAIL: {msg}")


def resolve_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    env = os.getenv("RATPACK_ART_FONT_BOLD" if bold else "RATPACK_ART_FONT")
    candidates = [env] if env else []
    if os.name == "nt":
        candidates += [
            r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\bahnschrift.ttf",
            r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        ]
    else:
        candidates += [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
            if bold
            else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"
            if bold
            else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
        ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    fail("required deterministic marketplace font was not found; no silent fallback is allowed")


def fit_font(
    draw: ImageDraw.ImageDraw,
    text: str,
    max_width: int,
    max_size: int,
    min_size: int = 18,
    bold: bool = True,
) -> ImageFont.FreeTypeFont:
    for size in range(max_size, min_size - 1, -2):
        font = resolve_font(size, bold)
        box = draw.textbbox((0, 0), text, font=font)
        if box[2] - box[0] <= max_width:
            return font
    return resolve_font(min_size, bold)


def wrapped_lines(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    max_width: int,
    max_lines: int,
) -> list[str]:
    words = str(text).split()
    lines: list[str] = []
    line = ""
    for word in words:
        trial = f"{line} {word}".strip()
        if draw.textbbox((0, 0), trial, font=font)[2] > max_width and line:
            lines.append(line)
            line = word
            if len(lines) >= max_lines:
                break
        else:
            line = trial
    if line and len(lines) < max_lines:
        lines.append(line)
    return lines


def require_text(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        fail(f"Rat Art config missing {label}")
    return value.strip()


def optional_text(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def parse_accent(value: Any) -> tuple[int, int, int]:
    if value is None:
        return ACCENT
    if isinstance(value, str):
        raw = value.strip().lstrip("#")
        if len(raw) == 6:
            try:
                return tuple(int(raw[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]
            except ValueError:
                pass
    if isinstance(value, list) and len(value) == 3 and all(isinstance(v, int) and 0 <= v <= 255 for v in value):
        return tuple(value)  # type: ignore[return-value]
    fail("accent must be a #RRGGBB string or [r,g,b]")


def load_product(slug: str) -> tuple[dict[str, Any], dict[str, Any], Path]:
    src = ROOT / "widgets" / "_src" / slug
    submission_path = src / "submission.json"
    config_path = src / "rat-art.json"
    if not submission_path.is_file():
        fail(f"missing submission metadata: {submission_path}")
    if not config_path.is_file():
        fail(f"missing product Rat Art config: {config_path}")
    submission = json.loads(submission_path.read_text(encoding="utf-8"))
    config = json.loads(config_path.read_text(encoding="utf-8"))
    if submission.get("slug") != slug:
        fail("submission.json slug mismatch")
    if config.get("schema_version") not in (1, 2):
        fail("rat-art.json schema_version must be 1 or 2")
    require_text(submission.get("name"), "submission name")
    return submission, config, config_path


def gradient_bg(accent: tuple[int, int, int] = ACCENT) -> Image.Image:
    base = Image.new("RGBA", (W, H), (*BG, 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse((W // 2 - 760, 160, W // 2 + 760, H + 350), fill=(*accent, 26))
    draw.ellipse((-350, -330, 700, 430), fill=(24, 120, 82, 20))
    draw.ellipse((W - 700, -250, W + 250, 460), fill=(153, 40, 126, 18))
    return Image.alpha_composite(base, glow.filter(ImageFilter.GaussianBlur(190)))


def gradient_bg_v2(accent: tuple[int, int, int]) -> Image.Image:
    base = Image.new("RGBA", (W, H), (7, 9, 12, 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse((W // 2 - 720, 210, W // 2 + 720, 1000), fill=(*accent, 32))
    draw.ellipse((-420, -430, 620, 410), fill=(*accent, 10))
    draw.ellipse((W - 600, -380, W + 320, 390), fill=(70, 82, 100, 14))
    canvas = Image.alpha_composite(base, glow.filter(ImageFilter.GaussianBlur(180)))
    vignette = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vignette)
    vd.rectangle((0, 0, W, H), outline=(0, 0, 0, 0))
    vd.rectangle((0, 0, W, 36), fill=(0, 0, 0, 34))
    vd.rectangle((0, H - 60, W, H), fill=(0, 0, 0, 42))
    return Image.alpha_composite(canvas, vignette.filter(ImageFilter.GaussianBlur(28)))


def header(canvas: Image.Image, title: str, subtitle: str | None = None) -> int:
    """Legacy v1 header. Keep unchanged for approved schema-v1 output."""
    draw = ImageDraw.Draw(canvas)
    draw.line((0, 152, W, 152), fill=(*ACCENT, 90), width=1)
    font = fit_font(draw, title, 1600, 76, 42)
    draw.text((W // 2, 76), title, font=font, fill=(*WHITE, 255), anchor="mm")
    if subtitle:
        sub_font = fit_font(draw, subtitle, 1600, 34, 20, bold=False)
        draw.text((W // 2, 184), subtitle, font=sub_font, fill=(*MUTED, 255), anchor="mm")
        return 220
    return 176


def compact_header_v2(
    canvas: Image.Image,
    title: str,
    subtitle: str | None,
    accent: tuple[int, int, int],
) -> int:
    draw = ImageDraw.Draw(canvas)
    font = fit_font(draw, title, 1540, 58, 36)
    draw.text((W // 2, 70), title, font=font, fill=(*WHITE, 255), anchor="mm")
    y = 122
    if subtitle:
        sub_font = fit_font(draw, subtitle, 1540, 27, 18, bold=False)
        draw.text((W // 2, y), subtitle, font=sub_font, fill=(*MUTED, 255), anchor="mm")
        y = 154
    draw.line((120, y + 8, W - 120, y + 8), fill=(*accent, 62), width=1)
    return y + 28


def draw_content_divider(canvas: Image.Image) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.line((170, CONTENT_DIVIDER_Y, W - 170, CONTENT_DIVIDER_Y), fill=(80, 95, 108, 120), width=1)


def _logo_image(max_size: int) -> Image.Image | None:
    if not RAT.exists():
        return None
    rat = Image.open(RAT).convert("RGBA")
    box = rat.getbbox()
    if box:
        rat = rat.crop(box)
    scale = min(max_size / rat.width, max_size / rat.height)
    return rat.resize(
        (max(1, int(rat.width * scale)), max(1, int(rat.height * scale))),
        Image.Resampling.LANCZOS,
    )


def packrat_signature(canvas: Image.Image, y: int = 892) -> None:
    """Legacy/footer PackRat icon treatment."""
    draw = ImageDraw.Draw(canvas)
    icon_size = 46
    x = (W - icon_size) // 2

    rat = _logo_image(icon_size)
    if rat:
        glow = Image.new("RGBA", (76, 76), (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow)
        glow_draw.ellipse((10, 10, 66, 66), fill=(*ACCENT, 24))
        canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(12)), (W // 2 - 38, y - 38))
        canvas.alpha_composite(rat, ((W - rat.width) // 2, y - rat.height // 2))
    else:
        draw.ellipse((x + 10, y - 13, x + 36, y + 13), fill=(*ACCENT, 180))


def packrat_mark_top_v2(canvas: Image.Image, accent: tuple[int, int, int], y: int = 58) -> None:
    rat = _logo_image(50)
    if not rat:
        fail("PackRat logo is required for Marketplace Listing V2")
    glow = Image.new("RGBA", (90, 70), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((14, 4, 76, 66), fill=(*accent, 17))
    canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(14)), (W // 2 - 45, y - 35))
    canvas.alpha_composite(rat, ((W - rat.width) // 2, y - rat.height // 2))


def footer(
    canvas: Image.Image,
    platform_labels: bool = False,
    right_text: str = "CORSAIR XENEON EDGE",
) -> None:
    """Legacy v1 footer. Keep unchanged for approved schema-v1 output."""
    top = 824
    draw = ImageDraw.Draw(canvas)
    draw.line((0, top, W, top), fill=(*ACCENT, 82), width=1)
    draw.line((0, H - 1, W, H - 1), fill=(*ACCENT, 46), width=1)
    if platform_labels:
        left_font = resolve_font(31, True)
        right_font = fit_font(draw, right_text, 600, 30, 20)
        draw.text((74, 892), "iCUE WIDGET", font=left_font, fill=(*WHITE, 255), anchor="lm")
        draw.text((W - 74, 892), right_text, font=right_font, fill=(*ACCENT, 255), anchor="rm")
    packrat_signature(canvas, 892)


def footer_v2(canvas: Image.Image, accent: tuple[int, int, int]) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.line((84, 838, W - 84, 838), fill=(*accent, 52), width=1)
    packrat_signature(canvas, 900)


def render_device(shot_path: Path, max_box=(1740, 580)) -> Image.Image:
    if not DEVICE.exists() or not DEVICE_QUAD.exists():
        fail("approved XENEON device plate or quad is missing")
    photo = Image.open(DEVICE).convert("RGBA")
    nums = [
        int(float(value))
        for value in DEVICE_QUAD.read_text(encoding="utf-8").replace(",", " ").split()
    ]
    if len(nums) != 8:
        fail("XENEON device quad must contain exactly eight numbers")
    x1, y1, x2, y2, x3, y3, x4, y4 = nums
    left, top = min(x1, x4), min(y1, y2)
    right, bottom = max(x2, x3), max(y3, y4)
    shot = Image.open(shot_path).convert("RGBA")
    shot = ImageEnhance.Brightness(shot).enhance(1.10)
    shot = ImageEnhance.Contrast(shot).enhance(1.06)
    shot = shot.resize((right - left, bottom - top), Image.Resampling.LANCZOS)
    under = Image.new("RGBA", photo.size, (0, 0, 0, 0))
    under.alpha_composite(shot, (left, top))
    lit = Image.alpha_composite(under, photo)
    crop = photo.getbbox()
    if crop:
        pad = 28
        crop = (
            max(0, crop[0] - pad),
            max(0, crop[1] - pad),
            min(photo.width, crop[2] + pad),
            min(photo.height, crop[3] + pad),
        )
        lit = lit.crop(crop)
    max_width, max_height = max_box
    scale = min(max_width / lit.width, max_height / lit.height)
    return lit.resize(
        (max(1, int(lit.width * scale)), max(1, int(lit.height * scale))),
        Image.Resampling.LANCZOS,
    )


def framed_shot(path: Path, max_box: tuple[int, int]) -> Image.Image:
    shot = Image.open(path).convert("RGBA")
    max_width, max_height = max_box
    scale = min(max_width / shot.width, max_height / shot.height)
    shot = shot.resize(
        (max(1, int(shot.width * scale)), max(1, int(shot.height * scale))),
        Image.Resampling.LANCZOS,
    )
    pad = 10
    panel = Image.new("RGBA", (shot.width + pad * 2, shot.height + pad * 2), (6, 10, 14, 240))
    draw = ImageDraw.Draw(panel)
    draw.rounded_rectangle(
        (0, 0, panel.width - 1, panel.height - 1),
        radius=18,
        outline=(95, 110, 125, 125),
        width=2,
    )
    panel.alpha_composite(shot, (pad, pad))
    return panel


def hero(shots: Path, out: Path, name: str, section: dict[str, Any]) -> None:
    """Legacy schema-v1 hero."""
    canvas = gradient_bg()
    subtitle = require_text(section.get("subtitle"), "hero.subtitle")
    header(canvas, name, subtitle)
    panel = render_device(shots / "XL_H.png", (1760, 575))
    canvas.alpha_composite(panel, ((W - panel.width) // 2, 220 + max(0, (590 - panel.height) // 2)))
    footer(canvas, platform_labels=True)
    canvas.convert("RGB").save(out / "1-hero.png", quality=96)


def hero_v2(
    shots: Path,
    out: Path,
    name: str,
    section: dict[str, Any],
    accent: tuple[int, int, int],
) -> None:
    canvas = gradient_bg_v2(accent)
    draw = ImageDraw.Draw(canvas)
    packrat_mark_top_v2(canvas, accent)

    label_mode = optional_text(section.get("title_mode")) or "use_case"
    label = optional_text(section.get("label"))
    if label_mode == "product":
        label = name
    elif label_mode == "none":
        label = None
    elif label_mode != "use_case":
        fail("hero.title_mode must be none, use_case, or product")

    if label:
        label = label.upper()
        label_font = fit_font(draw, label, 650, 48, 28)
        draw.text((72, 66), label, font=label_font, fill=(*WHITE, 255), anchor="lm")

    right_parts = []
    edition = optional_text(section.get("edition"))
    platform = optional_text(section.get("platform_label")) or "XENEON EDGE"
    if edition:
        right_parts.append(edition.upper())
    if platform:
        right_parts.append(platform.upper())
    right_text = "  •  ".join(right_parts)
    if right_text:
        right_font = fit_font(draw, right_text, 650, 28, 18)
        draw.text((W - 72, 66), right_text, font=right_font, fill=(*MUTED, 255), anchor="rm")

    draw.line((72, 118, W - 72, 118), fill=(*accent, 54), width=1)

    shot_name = optional_text(section.get("shot")) or "XL_H.png"
    panel = render_device(shots / shot_name, (1810, 650))
    product_band_top = 145
    product_band_height = 665
    py = product_band_top + max(0, (product_band_height - panel.height) // 2)
    canvas.alpha_composite(panel, ((W - panel.width) // 2, py))

    supporting = optional_text(section.get("supporting_line"))
    if supporting:
        support_font = fit_font(draw, supporting, 1250, 24, 17, bold=False)
        draw.text((W // 2, 825), supporting, font=support_font, fill=(*MUTED, 255), anchor="mm")

    canvas.convert("RGB").save(out / "1-hero.png", quality=96)


def showcase(shots: Path, out: Path, section: dict[str, Any]) -> None:
    canvas = gradient_bg()
    title = require_text(section.get("title"), "showcase.title")
    subtitle = require_text(section.get("subtitle"), "showcase.subtitle")
    shot_name = require_text(section.get("shot", "XL_H.png"), "showcase.shot")
    header(canvas, title, subtitle)
    panel = framed_shot(shots / shot_name, (1700, 500))
    canvas.alpha_composite(panel, ((W - panel.width) // 2, 260))
    footer(canvas)
    canvas.convert("RGB").save(out / "2-showcase.png", quality=96)


def showcase_v2(
    shots: Path,
    out: Path,
    section: dict[str, Any],
    accent: tuple[int, int, int],
) -> None:
    canvas = gradient_bg_v2(accent)
    title = require_text(section.get("title"), "showcase.title")
    subtitle = optional_text(section.get("subtitle"))
    shot_name = require_text(section.get("shot", "XL_H.png"), "showcase.shot")
    top = compact_header_v2(canvas, title, subtitle, accent)
    panel = framed_shot(shots / shot_name, (1780, 565))
    band_height = 630
    py = top + max(0, (band_height - panel.height) // 2)
    canvas.alpha_composite(panel, ((W - panel.width) // 2, py))
    footer_v2(canvas, accent)
    canvas.convert("RGB").save(out / "2-showcase.png", quality=96)


def features(shots: Path, out: Path, section: dict[str, Any]) -> None:
    canvas = gradient_bg()
    title = require_text(section.get("title"), "features.title")
    subtitle = require_text(section.get("subtitle"), "features.subtitle")
    shot_name = require_text(section.get("shot", "M_V.png"), "features.shot")
    items = section.get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= 4:
        fail("features.items must contain between one and four entries")
    header(canvas, title, subtitle)
    panel = framed_shot(shots / shot_name, (520, 500))
    canvas.alpha_composite(panel, (88, 270))
    draw = ImageDraw.Draw(canvas)
    x, y, max_width = 690, 285, 1090
    spacing = 472 // max(1, len(items))
    for item in items:
        if not isinstance(item, list) or len(item) != 2:
            fail("each features.items entry must be [title, description]")
        item_title = require_text(item[0], "feature title")
        description = require_text(item[1], "feature description")
        draw.rounded_rectangle((x, y + 12, x + 10, y + 32), radius=3, fill=(*ACCENT, 255))
        title_font = resolve_font(31, True)
        draw.text((x + 28, y), item_title, font=title_font, fill=(*WHITE, 255))
        desc_font = resolve_font(22, False)
        yy = y + 42
        for line in wrapped_lines(draw, description, desc_font, max_width - 40, 2):
            draw.text((x + 28, yy), line, font=desc_font, fill=(*MUTED, 255))
            yy += 29
        y += spacing
    footer(canvas)
    canvas.convert("RGB").save(out / "3-features.png", quality=96)


def features_v2(
    shots: Path,
    out: Path,
    section: dict[str, Any],
    accent: tuple[int, int, int],
) -> None:
    canvas = gradient_bg_v2(accent)
    title = require_text(section.get("title"), "features.title")
    subtitle = optional_text(section.get("subtitle"))
    shot_name = require_text(section.get("shot", "M_V.png"), "features.shot")
    items = section.get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= 4:
        fail("features.items must contain between one and four entries")
    top = compact_header_v2(canvas, title, subtitle, accent)
    panel = framed_shot(shots / shot_name, (650, 520))
    panel_x = 76
    panel_y = top + max(6, (600 - panel.height) // 2)
    canvas.alpha_composite(panel, (panel_x, panel_y))

    draw = ImageDraw.Draw(canvas)
    x = 790
    max_width = 1040
    content_top = top + 30
    content_height = 560
    spacing = content_height // len(items)
    y = content_top
    for item in items:
        if not isinstance(item, list) or len(item) != 2:
            fail("each features.items entry must be [title, description]")
        item_title = require_text(item[0], "feature title")
        description = require_text(item[1], "feature description")
        draw.rounded_rectangle((x, y + 10, x + 8, y + 30), radius=3, fill=(*accent, 255))
        title_font = fit_font(draw, item_title.upper(), max_width - 32, 30, 22)
        draw.text((x + 26, y), item_title.upper(), font=title_font, fill=(*WHITE, 255))
        desc_font = resolve_font(20, False)
        yy = y + 39
        for line in wrapped_lines(draw, description, desc_font, max_width - 38, 2):
            draw.text((x + 26, yy), line, font=desc_font, fill=(*MUTED, 255))
            yy += 27
        y += spacing

    footer_v2(canvas, accent)
    canvas.convert("RGB").save(out / "3-features.png", quality=96)


def settings(shots: Path, out: Path, section: dict[str, Any]) -> None:
    canvas = gradient_bg()
    title = require_text(section.get("title"), "settings.title")
    subtitle = require_text(section.get("subtitle"), "settings.subtitle")
    panels = section.get("panels")
    if not isinstance(panels, list) or not 1 <= len(panels) <= 4:
        fail("settings.panels must contain between one and four entries")
    header(canvas, title, subtitle)
    draw = ImageDraw.Draw(canvas)
    gap = 28
    box_width = min(390, (1640 - gap * (len(panels) - 1)) // len(panels))
    total = box_width * len(panels) + gap * (len(panels) - 1)
    x = (W - total) // 2
    panel_top = 285
    label_y = 610
    for panel_meta in panels:
        if not isinstance(panel_meta, dict):
            fail("each settings.panels entry must be an object")
        label = require_text(panel_meta.get("label"), "settings panel label")
        file_name = require_text(panel_meta.get("file"), "settings panel file")
        panel = framed_shot(shots / file_name, (box_width, 250))
        canvas.alpha_composite(panel, (x + (box_width - panel.width) // 2, panel_top))
        draw.text(
            (x + box_width // 2, label_y),
            label,
            font=resolve_font(25, True),
            fill=(*WHITE, 255),
            anchor="mm",
        )
        x += box_width + gap
    draw_content_divider(canvas)
    tags = section.get("tags")
    if isinstance(tags, str) and tags.strip():
        tag_font = fit_font(draw, tags, 1500, 23, 17, bold=False)
        draw.text((W // 2, CONTENT_FOOTER_TEXT_Y), tags, font=tag_font, fill=(*MUTED, 255), anchor="mm")
    footer(canvas)
    canvas.convert("RGB").save(out / "4-settings.png", quality=96)


def settings_v2(
    shots: Path,
    out: Path,
    section: dict[str, Any],
    accent: tuple[int, int, int],
) -> None:
    canvas = gradient_bg_v2(accent)
    title = require_text(section.get("title"), "settings.title")
    subtitle = optional_text(section.get("subtitle"))
    panels = section.get("panels")
    if not isinstance(panels, list) or not 1 <= len(panels) <= 4:
        fail("settings.panels must contain between one and four entries")
    top = compact_header_v2(canvas, title, subtitle, accent)
    draw = ImageDraw.Draw(canvas)
    gap = 26
    box_width = min(410, (1710 - gap * (len(panels) - 1)) // len(panels))
    total = box_width * len(panels) + gap * (len(panels) - 1)
    x = (W - total) // 2
    panel_top = top + 55
    label_y = 650
    for panel_meta in panels:
        if not isinstance(panel_meta, dict):
            fail("each settings.panels entry must be an object")
        label = require_text(panel_meta.get("label"), "settings panel label")
        file_name = require_text(panel_meta.get("file"), "settings panel file")
        panel = framed_shot(shots / file_name, (box_width, 290))
        canvas.alpha_composite(panel, (x + (box_width - panel.width) // 2, panel_top + max(0, (310 - panel.height) // 2)))
        label_font = fit_font(draw, label, box_width, 23, 18)
        draw.text((x + box_width // 2, label_y), label, font=label_font, fill=(*WHITE, 255), anchor="mm")
        x += box_width + gap
    tags = optional_text(section.get("tags"))
    if tags:
        tag_font = fit_font(draw, tags, 1560, 21, 16, bold=False)
        draw.text((W // 2, 746), tags, font=tag_font, fill=(*MUTED, 255), anchor="mm")
    footer_v2(canvas, accent)
    canvas.convert("RGB").save(out / "4-settings.png", quality=96)


def sizes(shots: Path, out: Path, section: dict[str, Any]) -> None:
    canvas = gradient_bg()
    title = require_text(section.get("title"), "sizes.title")
    subtitle = require_text(section.get("subtitle"), "sizes.subtitle")
    footer_text = require_text(section.get("footer"), "sizes.footer")
    header(canvas, title, subtitle)
    draw = ImageDraw.Draw(canvas)
    specs = [
        ("S slot", "S_H.png", 300, 210),
        ("M slot", "M_V.png", 255, 300),
        ("L slot", "L_H.png", 390, 210),
        ("XL slot", "XL_H.png", 450, 210),
    ]
    gap = 35
    widths = [spec[2] for spec in specs]
    total = sum(widths) + gap * 3
    x = (W - total) // 2
    base = 285
    visual_band = 300
    label_y = 640
    for label, file_name, max_width, max_height in specs:
        panel = framed_shot(shots / file_name, (max_width, max_height))
        py = base + (visual_band - panel.height) // 2
        canvas.alpha_composite(panel, (x + (max_width - panel.width) // 2, py))
        draw.text(
            (x + max_width // 2, label_y),
            label,
            font=resolve_font(24, True),
            fill=(*WHITE, 255),
            anchor="mm",
        )
        x += max_width + gap
    draw_content_divider(canvas)
    footer_font = fit_font(draw, footer_text, 1500, 21, 16, bold=False)
    draw.text((W // 2, CONTENT_FOOTER_TEXT_Y), footer_text, font=footer_font, fill=(*MUTED, 255), anchor="mm")
    footer(canvas)
    canvas.convert("RGB").save(out / "5-sizes.png", quality=96)


def sizes_v2(
    shots: Path,
    out: Path,
    section: dict[str, Any],
    accent: tuple[int, int, int],
) -> None:
    canvas = gradient_bg_v2(accent)
    title = require_text(section.get("title"), "sizes.title")
    subtitle = optional_text(section.get("subtitle"))
    footer_text = require_text(section.get("footer"), "sizes.footer")
    top = compact_header_v2(canvas, title, subtitle, accent)
    draw = ImageDraw.Draw(canvas)
    specs = [
        ("S", "S_H.png", 320, 220),
        ("M", "M_V.png", 270, 320),
        ("L", "L_H.png", 410, 230),
        ("XL", "XL_H.png", 470, 230),
    ]
    gap = 36
    total = sum(spec[2] for spec in specs) + gap * 3
    x = (W - total) // 2
    base = top + 58
    visual_band = 340
    label_y = 650
    for label, file_name, max_width, max_height in specs:
        panel = framed_shot(shots / file_name, (max_width, max_height))
        py = base + (visual_band - panel.height) // 2
        canvas.alpha_composite(panel, (x + (max_width - panel.width) // 2, py))
        draw.text((x + max_width // 2, label_y), label, font=resolve_font(22, True), fill=(*WHITE, 255), anchor="mm")
        x += max_width + gap
    footer_font = fit_font(draw, footer_text, 1540, 20, 15, bold=False)
    draw.text((W // 2, 744), footer_text, font=footer_font, fill=(*MUTED, 255), anchor="mm")
    footer_v2(canvas, accent)
    canvas.convert("RGB").save(out / "5-sizes.png", quality=96)


def contact_sheet_v1(out: Path, name: str) -> None:
    files = [out / file_name for file_name in V1_MARKETPLACE_ORDER]
    thumb_width, thumb_height = 768, 384
    sheet = Image.new("RGB", (1600, 1320), (7, 9, 12))
    draw = ImageDraw.Draw(sheet)
    title = f"{name} • Rat Art candidate"
    draw.text((42, 38), title, font=fit_font(draw, title, 1500, 40, 24), fill=WHITE)
    positions = [(32, 110), (800, 110), (32, 520), (800, 520), (416, 930)]
    for image_path, (x, y) in zip(files, positions):
        image = Image.open(image_path).convert("RGB").resize((thumb_width, thumb_height), Image.Resampling.LANCZOS)
        sheet.paste(image, (x, y))
    sheet.save(out / "contact-sheet.jpg", quality=92)


def resolve_marketplace_order(config: dict[str, Any]) -> list[str]:
    requested = config.get("marketplace_order")
    allowed = set(V2_DEFAULT_ORDER)
    if requested is None:
        return list(V2_DEFAULT_ORDER)
    if not isinstance(requested, list) or len(requested) != 5:
        fail("marketplace_order must contain exactly the five generated image file names")
    order = [require_text(item, "marketplace_order item") for item in requested]
    if set(order) != allowed:
        fail("marketplace_order must contain each generated marketplace image exactly once")
    return order


def contact_sheet_v2(out: Path, name: str, marketplace_order: list[str]) -> None:
    files = [out / file_name for file_name in marketplace_order]
    thumb_width, thumb_height = 640, 320
    sheet = Image.new("RGB", (1360, 1120), (7, 9, 12))
    draw = ImageDraw.Draw(sheet)
    title = f"{name} • Marketplace Listing V2"
    draw.text((40, 34), title, font=fit_font(draw, title, 1280, 38, 24), fill=WHITE)
    positions = [(36, 100), (684, 100), (36, 440), (684, 440), (360, 780)]
    for idx, (image_path, (x, y)) in enumerate(zip(files, positions), start=1):
        image = Image.open(image_path).convert("RGB").resize((thumb_width, thumb_height), Image.Resampling.LANCZOS)
        sheet.paste(image, (x, y))
        draw.text((x + 4, y + thumb_height + 5), f"{idx}. {image_path.name}", font=resolve_font(16, False), fill=MUTED)
    sheet.save(out / "contact-sheet.jpg", quality=92)


def thumbnail_sheet_v2(out: Path, name: str) -> None:
    hero_path = out / "1-hero.png"
    hero_image = Image.open(hero_path).convert("RGB")
    sizes_to_review = [(480, 240), (320, 160), (240, 120)]
    sheet = Image.new("RGB", (1040, 720), (7, 9, 12))
    draw = ImageDraw.Draw(sheet)
    title = f"{name} • hero thumbnail gate"
    draw.text((36, 30), title, font=fit_font(draw, title, 960, 34, 22), fill=WHITE)
    y = 92
    for width, height in sizes_to_review:
        thumb = hero_image.resize((width, height), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (36, y))
        label = f"{width} × {height}"
        draw.text((56 + width, y + height // 2), label, font=resolve_font(20, True), fill=WHITE, anchor="lm")
        y += height + 54
    sheet.save(out / "thumbnail-sheet.jpg", quality=92)


def sha(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def verify_distinct_outputs(out: Path, marketplace_order: list[str]) -> None:
    hashes: dict[str, str] = {}
    for file_name in marketplace_order:
        digest = sha(out / file_name)
        if digest in hashes:
            fail(f"duplicate marketplace images: {hashes[digest]} and {file_name}")
        hashes[digest] = file_name


def referenced_shots(config: dict[str, Any]) -> set[str]:
    result = {f"{name}.png" for name in SLOT_ORDER}
    hero_cfg = config.get("hero") or {}
    showcase_cfg = config.get("showcase") or {}
    features_cfg = config.get("features") or {}
    if isinstance(hero_cfg, dict) and isinstance(hero_cfg.get("shot"), str):
        result.add(hero_cfg["shot"])
    if isinstance(showcase_cfg, dict) and isinstance(showcase_cfg.get("shot"), str):
        result.add(showcase_cfg["shot"])
    if isinstance(features_cfg, dict) and isinstance(features_cfg.get("shot"), str):
        result.add(features_cfg["shot"])
    settings_cfg = config.get("settings") or {}
    if isinstance(settings_cfg, dict):
        for panel in settings_cfg.get("panels") or []:
            if isinstance(panel, dict) and isinstance(panel.get("file"), str):
                result.add(panel["file"])
    return result


def render_xeneon(slug: str, shots: Path, out: Path) -> None:
    submission, config, config_path = load_product(slug)
    required = [shots / name for name in sorted(referenced_shots(config))]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        fail("missing deterministic widget captures: " + ", ".join(missing))
    for section in ("hero", "showcase", "features", "settings", "sizes"):
        if not isinstance(config.get(section), dict):
            fail(f"rat-art.json missing {section} section")

    out.mkdir(parents=True, exist_ok=True)
    name = require_text(submission.get("name"), "submission name")
    schema_version = int(config["schema_version"])

    if schema_version == 1:
        hero(shots, out, name, config["hero"])
        showcase(shots, out, config["showcase"])
        features(shots, out, config["features"])
        settings(shots, out, config["settings"])
        sizes(shots, out, config["sizes"])
        contact_sheet_v1(out, name)
        marketplace_order = list(V1_MARKETPLACE_ORDER)
        report_schema = 3
        design_system = "legacy-v1"
    else:
        accent = parse_accent(config.get("accent"))
        hero_v2(shots, out, name, config["hero"], accent)
        showcase_v2(shots, out, config["showcase"], accent)
        features_v2(shots, out, config["features"], accent)
        settings_v2(shots, out, config["settings"], accent)
        sizes_v2(shots, out, config["sizes"], accent)
        marketplace_order = resolve_marketplace_order(config)
        verify_distinct_outputs(out, marketplace_order)
        contact_sheet_v2(out, name, marketplace_order)
        thumbnail_sheet_v2(out, name)
        report_schema = 4
        design_system = "marketplace-listing-v2"

    demo_cfg = config.get("demo") if isinstance(config.get("demo"), dict) else {}
    report = {
        "schema_version": report_schema,
        "slug": slug,
        "image_generation": "disabled",
        "renderer": "tools/art/rat_art.py",
        "design_system": design_system,
        "product_config": str(config_path.relative_to(ROOT)).replace("\\", "/"),
        "product_config_sha256": sha(config_path),
        "marketplace_order": marketplace_order,
        "footer_branding": "logo-only" if schema_version == 1 else "hero-top-mark-gallery-footer-mark",
        "demo_recommended": bool(demo_cfg.get("recommended", False)),
        "outputs": {
            path.name: {"size": Image.open(path).size, "sha256": sha(path)}
            for path in sorted(out.glob("*.png"))
        },
        "contact_sheet": "contact-sheet.jpg",
    }
    if schema_version == 2:
        report["thumbnail_sheet"] = "thumbnail-sheet.jpg"

    (out / "rat-art-report.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"RAT ART PASS: {slug} -> {out}")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    xeneon = sub.add_parser("xeneon")
    xeneon.add_argument("slug")
    xeneon.add_argument("--shots", required=True, type=Path)
    xeneon.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    if args.cmd == "xeneon":
        render_xeneon(args.slug, args.shots, args.out)


if __name__ == "__main__":
    main()
