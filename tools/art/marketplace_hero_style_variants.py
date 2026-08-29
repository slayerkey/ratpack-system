#!/usr/bin/env python3
"""Render six premium Marketplace hero style directions using real product capture.

Review-only experiment. The product identity/layout is fixed to the selected
header direction: PackRat upper-left, full product name centered, empty upper-right.
Only the visual staging/background changes so the owner can pick a style.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

import rat_art

W, H = rat_art.W, rat_art.H
WHITE = rat_art.WHITE
MUTED = rat_art.MUTED

STYLE_NAMES = [
    "Clean Spotlight",
    "Context Blur",
    "Technical Grid",
    "Glass Stage",
    "Cinematic Split",
    "Premium Launch",
]


def logo(max_size: int = 48) -> Image.Image:
    mark = rat_art._logo_image(max_size)
    if mark is None:
        rat_art.fail("PackRat logo is required for hero style variants")
    return mark


def place_logo(canvas: Image.Image, x: int = 72, y: int = 66, max_size: int = 48) -> None:
    mark = logo(max_size)
    canvas.alpha_composite(mark, (x, y - mark.height // 2))


def cover_image(path: Path, size: tuple[int, int]) -> Image.Image:
    img = Image.open(path).convert("RGBA")
    ratio = max(size[0] / img.width, size[1] / img.height)
    resized = img.resize((max(1, int(img.width * ratio)), max(1, int(img.height * ratio))), Image.Resampling.LANCZOS)
    left = max(0, (resized.width - size[0]) // 2)
    top = max(0, (resized.height - size[1]) // 2)
    return resized.crop((left, top, left + size[0], top + size[1]))


def darken(img: Image.Image, factor: float) -> Image.Image:
    rgb = ImageEnhance.Brightness(img.convert("RGB")).enhance(factor)
    return rgb.convert("RGBA")


def radial_glow(canvas: Image.Image, box: tuple[int, int, int, int], color: tuple[int, int, int], alpha: int, blur: int) -> None:
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.ellipse(box, fill=(*color, alpha))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))


def vignette(canvas: Image.Image, strength: int = 145) -> None:
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    steps = 12
    for i in range(steps):
        inset_x = int((W * 0.20) * i / steps)
        inset_y = int((H * 0.20) * i / steps)
        a = int(strength * (1 - i / steps) ** 2)
        draw.rounded_rectangle((inset_x, inset_y, W - inset_x, H - inset_y), radius=80, outline=(0, 0, 0, a), width=45)
    canvas.alpha_composite(layer)


def header(canvas: Image.Image, accent: tuple[int, int, int]) -> None:
    # High-contrast scrim keeps the product name readable even over contextual art.
    scrim = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(scrim)
    for y in range(0, 142):
        alpha = int(220 * (1 - y / 165))
        sd.line((0, y, W, y), fill=(4, 7, 10, max(0, alpha)))
    canvas.alpha_composite(scrim)
    draw = ImageDraw.Draw(canvas)
    place_logo(canvas)
    title = "PC POWER METER"
    font = rat_art.fit_font(draw, title, 1120, 52, 30, bold=True)
    # Tiny shadow improves recognition at Marketplace-card scale without looking outlined.
    draw.text((W // 2 + 1, 67 + 2), title, font=font, fill=(0, 0, 0, 170), anchor="mm")
    draw.text((W // 2, 67), title, font=font, fill=(*WHITE, 255), anchor="mm")
    draw.line((72, 124, W - 72, 124), fill=(*accent, 70), width=1)


def device_layer(shot: Path, max_box: tuple[int, int] = (1730, 635)) -> Image.Image:
    return rat_art.render_device(shot, max_box)


def add_device(canvas: Image.Image, shot: Path, y_center: int = 500, max_box: tuple[int, int] = (1730, 635), reflection: bool = False) -> None:
    panel = device_layer(shot, max_box)
    x = (W - panel.width) // 2
    y = y_center - panel.height // 2

    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    mask = panel.getchannel("A")
    shadow_patch = Image.new("RGBA", panel.size, (0, 0, 0, 185))
    shadow_patch.putalpha(mask)
    shadow.alpha_composite(shadow_patch, (x, y + 18))
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    canvas.alpha_composite(shadow)

    if reflection:
        refl = ImageOps.flip(panel).copy()
        fade = Image.new("L", refl.size, 0)
        fd = ImageDraw.Draw(fade)
        for yy in range(refl.height):
            a = int(48 * max(0.0, 1 - yy / max(1, refl.height * 0.55)))
            fd.line((0, yy, refl.width, yy), fill=a)
        refl.putalpha(ImageChops_multiply(refl.getchannel("A"), fade))
        refl = refl.filter(ImageFilter.GaussianBlur(1.2))
        canvas.alpha_composite(refl, (x, y + panel.height - 5))

    canvas.alpha_composite(panel, (x, y))


def ImageChops_multiply(a: Image.Image, b: Image.Image) -> Image.Image:
    # Keep dependency surface small while multiplying two L masks.
    return Image.eval(Image.merge("RGB", (a, b, b)), lambda p: p).split()[0].point(lambda _: 0) if False else Image.frombytes(
        "L", a.size, bytes((x * y) // 255 for x, y in zip(a.tobytes(), b.tobytes()))
    )


def clean_spotlight(shot: Path, accent: tuple[int, int, int]) -> Image.Image:
    canvas = rat_art.gradient_bg_v2(accent)
    radial_glow(canvas, (260, 150, 1660, 970), accent, 72, 110)
    radial_glow(canvas, (620, 260, 1300, 840), (255, 255, 255), 22, 85)
    grid = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for x in range(0, W, 120):
        gd.line((x, 140, x, H), fill=(255, 255, 255, 8), width=1)
    for y in range(160, H, 96):
        gd.line((0, y, W, y), fill=(255, 255, 255, 6), width=1)
    canvas.alpha_composite(grid)
    header(canvas, accent)
    add_device(canvas, shot)
    vignette(canvas, 95)
    return canvas


def context_blur(shot: Path, accent: tuple[int, int, int]) -> Image.Image:
    bg = cover_image(shot, (W, H)).filter(ImageFilter.GaussianBlur(30))
    bg = darken(bg, 0.38)
    bg = ImageEnhance.Color(bg.convert("RGB")).enhance(0.72).convert("RGBA")
    canvas = bg
    overlay = Image.new("RGBA", (W, H), (3, 7, 11, 138))
    canvas = Image.alpha_composite(canvas, overlay)
    radial_glow(canvas, (360, 170, 1560, 930), accent, 52, 120)
    header(canvas, accent)
    add_device(canvas, shot)
    vignette(canvas, 165)
    return canvas


def technical_grid(shot: Path, accent: tuple[int, int, int]) -> Image.Image:
    canvas = rat_art.gradient_bg_v2(accent)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    horizon = 720
    for x in range(-600, W + 700, 110):
        d.line((W // 2, 315, x, H), fill=(*accent, 25), width=1)
    for y in [420, 500, 575, 645, 705, 760, 815, 865, 915]:
        alpha = 34 if y < horizon else 18
        d.line((80, y, W - 80, y), fill=(*accent, alpha), width=1)
    for r in (220, 360, 520, 700):
        d.ellipse((W // 2 - r, 500 - r // 2, W // 2 + r, 500 + r // 2), outline=(*accent, 18), width=1)
    # Small power-wave accent; decorative only, not UI data.
    pts = []
    for x in range(120, W - 120, 18):
        y = 760 + int(14 * __import__("math").sin((x - 120) / 72))
        pts.append((x, y))
    d.line(pts, fill=(*accent, 54), width=2)
    canvas.alpha_composite(layer)
    radial_glow(canvas, (520, 230, 1400, 830), accent, 38, 85)
    header(canvas, accent)
    add_device(canvas, shot)
    vignette(canvas, 120)
    return canvas


def glass_stage(shot: Path, accent: tuple[int, int, int]) -> Image.Image:
    canvas = rat_art.gradient_bg_v2(accent)
    radial_glow(canvas, (220, 140, 1700, 980), accent, 45, 150)
    panel = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    pd = ImageDraw.Draw(panel)
    pd.rounded_rectangle((92, 178, W - 92, 836), radius=42, fill=(12, 18, 24, 138), outline=(*accent, 68), width=2)
    pd.rounded_rectangle((116, 202, W - 116, 812), radius=36, outline=(255, 255, 255, 18), width=1)
    canvas.alpha_composite(panel.filter(ImageFilter.GaussianBlur(0.4)))
    header(canvas, accent)
    add_device(canvas, shot, y_center=505, max_box=(1660, 610))
    vignette(canvas, 110)
    return canvas


def cinematic_split(shot: Path, accent: tuple[int, int, int]) -> Image.Image:
    canvas = rat_art.gradient_bg_v2(accent)
    context = cover_image(shot, (W, H)).filter(ImageFilter.GaussianBlur(13))
    context = darken(context, 0.46)
    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    md.polygon([(980, 130), (W, 130), (W, H), (760, H)], fill=150)
    context.putalpha(mask)
    canvas.alpha_composite(context)
    split = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(split)
    sd.polygon([(1035, 130), (1080, 130), (860, H), (815, H)], fill=(*accent, 38))
    canvas.alpha_composite(split.filter(ImageFilter.GaussianBlur(12)))
    radial_glow(canvas, (180, 190, 1280, 920), accent, 42, 130)
    header(canvas, accent)
    add_device(canvas, shot)
    vignette(canvas, 155)
    return canvas


def premium_launch(shot: Path, accent: tuple[int, int, int]) -> Image.Image:
    base = cover_image(shot, (W, H)).filter(ImageFilter.GaussianBlur(18))
    base = ImageEnhance.Color(base.convert("RGB")).enhance(0.55).convert("RGBA")
    base = darken(base, 0.28)
    canvas = Image.alpha_composite(base, Image.new("RGBA", (W, H), (3, 6, 10, 135)))
    radial_glow(canvas, (180, 100, 1740, 990), accent, 78, 150)
    radial_glow(canvas, (560, 220, 1360, 820), (255, 255, 255), 28, 90)

    # Layered translucent architecture gives a polished campaign-art feel.
    stage = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(stage)
    sd.rounded_rectangle((110, 190, W - 110, 818), radius=48, fill=(7, 11, 16, 92), outline=(255, 255, 255, 16), width=1)
    sd.rounded_rectangle((148, 225, W - 148, 790), radius=38, outline=(*accent, 42), width=2)
    canvas.alpha_composite(stage)

    header(canvas, accent)
    add_device(canvas, shot, y_center=495, max_box=(1710, 625), reflection=True)
    vignette(canvas, 180)
    return canvas


def save(canvas: Image.Image, path: Path) -> None:
    canvas.convert("RGB").save(path, "PNG", optimize=True)


def contact_sheet(paths: list[Path], out: Path) -> None:
    thumb_w, thumb_h = 720, 360
    gap, margin, header_h, label_h = 34, 44, 92, 58
    cols, rows = 2, 3
    sheet = Image.new("RGB", (margin * 2 + cols * thumb_w + gap, header_h + margin + rows * (thumb_h + label_h) + (rows - 1) * gap + margin), (8, 10, 14))
    draw = ImageDraw.Draw(sheet)
    title_font = rat_art.resolve_font(32, True)
    num_font = rat_art.resolve_font(22, True)
    name_font = rat_art.resolve_font(18, False)
    draw.text((margin, 30), "PackRat Hero Style Directions — choose 1–6", font=title_font, fill=(*WHITE, 255))
    for i, path in enumerate(paths):
        img = Image.open(path).convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        row, col = divmod(i, cols)
        x = margin + col * (thumb_w + gap)
        y = header_h + margin + row * (thumb_h + label_h + gap)
        sheet.paste(img, (x, y))
        draw.text((x, y + thumb_h + 10), str(i + 1), font=num_font, fill=(*WHITE, 255))
        draw.text((x + 34, y + thumb_h + 12), STYLE_NAMES[i], font=name_font, fill=(*MUTED, 255))
    sheet.save(out, "JPEG", quality=95)


def thumbnail_sheet(paths: list[Path], out: Path) -> None:
    target = (320, 160)
    margin, gap, label_h = 34, 22, 34
    cols, rows = 3, 2
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
    sheet.save(out, "JPEG", quality=95)


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
    renderers = [clean_spotlight, context_blur, technical_grid, glass_stage, cinematic_split, premium_launch]
    outputs: list[Path] = []
    for i, fn in enumerate(renderers, 1):
        path = args.out / f"{i:02d}.png"
        save(fn(shot, accent), path)
        outputs.append(path)

    contact_sheet(outputs, args.out / "contact-sheet.jpg")
    thumbnail_sheet(outputs, args.out / "thumbnail-sheet.jpg")
    print(f"Rendered {len(outputs)} PackRat hero style variants to {args.out}")


if __name__ == "__main__":
    main()
