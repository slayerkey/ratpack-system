#!/usr/bin/env python3
"""Canonical deterministic Rat Art renderer for PackRat marketplace art.

This tool never calls an image generation API. For XENEON widgets it consumes
real browser captures, composites them into the approved device plate, renders
marketplace banners, and writes an isolated review candidate.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

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
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
        ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    fail("required deterministic marketplace font was not found; no silent fallback is allowed")


def fit_font(draw: ImageDraw.ImageDraw, text: str, max_width: int, max_size: int, min_size: int = 18, bold: bool = True):
    for size in range(max_size, min_size - 1, -2):
        font = resolve_font(size, bold)
        box = draw.textbbox((0, 0), text, font=font)
        if box[2] - box[0] <= max_width:
            return font
    return resolve_font(min_size, bold)


def gradient_bg(accent=ACCENT) -> Image.Image:
    base = Image.new("RGBA", (W, H), (*BG, 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse((W // 2 - 760, 160, W // 2 + 760, H + 350), fill=(*accent, 26))
    d.ellipse((-350, -330, 700, 430), fill=(24, 120, 82, 20))
    d.ellipse((W - 700, -250, W + 250, 460), fill=(153, 40, 126, 18))
    return Image.alpha_composite(base, glow.filter(ImageFilter.GaussianBlur(190)))


def header(canvas: Image.Image, title: str, subtitle: str | None = None) -> int:
    d = ImageDraw.Draw(canvas)
    d.line((0, 152, W, 152), fill=(*ACCENT, 90), width=1)
    f = fit_font(d, title, 1600, 76, 42)
    d.text((W // 2, 76), title, font=f, fill=(*WHITE, 255), anchor="mm")
    if subtitle:
        sf = fit_font(d, subtitle, 1600, 34, 20, bold=False)
        d.text((W // 2, 184), subtitle, font=sf, fill=(*MUTED, 255), anchor="mm")
        return 220
    return 176


def footer(canvas: Image.Image, right_text: str = "CORSAIR XENEON EDGE") -> None:
    top = 824
    d = ImageDraw.Draw(canvas)
    d.line((0, top, W, top), fill=(*ACCENT, 110), width=1)
    d.line((0, H - 1, W, H - 1), fill=(*ACCENT, 80), width=1)
    lf = resolve_font(31, True)
    rf = fit_font(d, right_text, 600, 30, 20)
    d.text((74, 892), "iCUE WIDGET", font=lf, fill=(*WHITE, 255), anchor="lm")
    d.text((W - 74, 892), right_text, font=rf, fill=(*ACCENT, 255), anchor="rm")
    badge = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
    bd = ImageDraw.Draw(badge)
    bd.rounded_rectangle((2, 2, 97, 97), radius=17, fill=(5, 9, 12, 245), outline=(*ACCENT, 255), width=3)
    if RAT.exists():
        rat = Image.open(RAT).convert("RGBA")
        box = rat.getbbox()
        if box:
            rat = rat.crop(box)
        scale = min(64 / rat.width, 64 / rat.height)
        rat = rat.resize((max(1, int(rat.width * scale)), max(1, int(rat.height * scale))), Image.Resampling.LANCZOS)
        badge.alpha_composite(rat, ((100 - rat.width) // 2, (100 - rat.height) // 2))
    canvas.alpha_composite(badge, (W // 2 - 50, 844))


def render_device(shot_path: Path, max_box=(1740, 580)) -> Image.Image:
    if not DEVICE.exists() or not DEVICE_QUAD.exists():
        fail("approved XENEON device plate or quad is missing")
    photo = Image.open(DEVICE).convert("RGBA")
    nums = [int(float(v)) for v in DEVICE_QUAD.read_text(encoding="utf-8").replace(",", " ").split()]
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
        crop = (max(0, crop[0]-pad), max(0, crop[1]-pad), min(photo.width, crop[2]+pad), min(photo.height, crop[3]+pad))
        lit = lit.crop(crop)
    mw, mh = max_box
    scale = min(mw / lit.width, mh / lit.height)
    return lit.resize((max(1, int(lit.width * scale)), max(1, int(lit.height * scale))), Image.Resampling.LANCZOS)


def framed_shot(path: Path, max_box: tuple[int, int]) -> Image.Image:
    shot = Image.open(path).convert("RGBA")
    mw, mh = max_box
    scale = min(mw / shot.width, mh / shot.height)
    shot = shot.resize((max(1, int(shot.width * scale)), max(1, int(shot.height * scale))), Image.Resampling.LANCZOS)
    pad = 10
    panel = Image.new("RGBA", (shot.width + pad*2, shot.height + pad*2), (6, 10, 14, 240))
    pd = ImageDraw.Draw(panel)
    pd.rounded_rectangle((0,0,panel.width-1,panel.height-1), radius=18, outline=(95,110,125,125), width=2)
    panel.alpha_composite(shot, (pad,pad))
    return panel


def hero(shots: Path, out: Path, name: str) -> None:
    c = gradient_bg()
    header(c, name, "Your music, designed for the Edge.")
    panel = render_device(shots / "XL_H.png", (1760, 575))
    c.alpha_composite(panel, ((W-panel.width)//2, 220 + max(0, (590-panel.height)//2)))
    footer(c)
    c.convert("RGB").save(out / "1-hero.png", quality=96)


def showcase(shots: Path, out: Path) -> None:
    c = gradient_bg()
    header(c, "Now playing, without the alt tab.", "Song, artist and three media controls across the display.")
    panel = framed_shot(shots / "XL_H.png", (1700, 500))
    c.alpha_composite(panel, ((W-panel.width)//2, 260))
    footer(c)
    c.convert("RGB").save(out / "2-showcase.png", quality=96)


def features(shots: Path, out: Path) -> None:
    c = gradient_bg()
    header(c, "Typography is the artwork.", "Built around the media data iCUE actually exposes.")
    panel = framed_shot(shots / "M_V.png", (520, 500))
    c.alpha_composite(panel, (88, 270))
    d = ImageDraw.Draw(c)
    items = [
        ("Track first", "Huge auto fitting title and artist, with marquee only when it truly needs it."),
        ("Artist driven color", "Each artist deterministically gets its own gradient field and visual character."),
        ("Three honest controls", "Previous, play or pause, and next. Nothing the Media provider cannot actually do."),
        ("Ambient when idle", "When music stops, the panel becomes a clean clock instead of a dead rectangle."),
    ]
    x, y, maxw = 690, 285, 1090
    for title, desc in items:
        d.rounded_rectangle((x, y+12, x+10, y+32), radius=3, fill=(*ACCENT,255))
        tf = resolve_font(31, True)
        d.text((x+28, y), title, font=tf, fill=(*WHITE,255))
        df = resolve_font(22, False)
        words = desc.split(); line=""; lines=[]
        for word in words:
            trial=(line+" "+word).strip()
            if d.textbbox((0,0),trial,font=df)[2] > maxw-40 and line:
                lines.append(line); line=word
            else:
                line=trial
        if line:
            lines.append(line)
        yy=y+42
        for ln in lines[:2]:
            d.text((x+28,yy),ln,font=df,fill=(*MUTED,255)); yy+=29
        y += 118
    footer(c)
    c.convert("RGB").save(out / "3-features.png", quality=96)


def settings(shots: Path, out: Path) -> None:
    c = gradient_bg()
    header(c, "Four palettes. Still your artist.", "Every preset stays artist sensitive instead of becoming a fixed wallpaper.")
    d = ImageDraw.Draw(c)
    labels=[("Artist","PALETTE_ARTIST.png"),("Neon","PALETTE_NEON.png"),("Ember","PALETTE_EMBER.png"),("Ocean","PALETTE_OCEAN.png")]
    gap=28; boxw=390; total=boxw*4+gap*3; x=(W-total)//2
    for lab,fn in labels:
        p=framed_shot(shots/fn,(boxw,260))
        c.alpha_composite(p,(x+(boxw-p.width)//2,315))
        d.text((x+boxw//2, 610), lab, font=resolve_font(25,True), fill=(*WHITE,255), anchor="mm")
        x+=boxw+gap
    d.line((170,690,W-170,690), fill=(80,95,108,120), width=1)
    tags="Gradient motion   •   24 hour time   •   recent tracks   •   text, accent and background colors"
    d.text((W//2,740), tags, font=fit_font(d,tags,1500,23,17,bold=False), fill=(*MUTED,255), anchor="mm")
    footer(c)
    c.convert("RGB").save(out / "4-settings.png", quality=96)


def sizes(shots: Path, out: Path) -> None:
    c = gradient_bg()
    header(c, "Built for every slot.", "S, M, L and XL each get their own horizontal and vertical composition.")
    d=ImageDraw.Draw(c)
    specs=[("S slot","S_H.png",300,230),("M slot","M_V.png",255,390),("L slot","L_H.png",390,230),("XL slot","XL_H.png",450,230)]
    gap=35; widths=[s[2] for s in specs]; total=sum(widths)+gap*3; x=(W-total)//2
    base=300
    for lab,fn,mw,mh in specs:
        p=framed_shot(shots/fn,(mw,mh))
        py=base+(390-p.height)//2
        c.alpha_composite(p,(x+(mw-p.width)//2,py))
        d.text((x+mw//2, 720), lab, font=resolve_font(24,True), fill=(*WHITE,255), anchor="mm")
        x+=mw+gap
    d.text((W//2,770), "8 tuned layouts total   •   4 sizes   •   horizontal + vertical", font=resolve_font(21,False), fill=(*MUTED,255), anchor="mm")
    footer(c)
    c.convert("RGB").save(out / "5-sizes.png", quality=96)


def contact_sheet(out: Path) -> None:
    files=[out/f"{i}-{name}.png" for i,name in [(1,"hero"),(2,"showcase"),(3,"features"),(4,"settings"),(5,"sizes")]]
    thumbw, thumbh=768,384
    sheet=Image.new("RGB",(1600,1320),(7,9,12)); d=ImageDraw.Draw(sheet)
    d.text((42,38),"Now Playing Panel • Rat Art candidate",font=resolve_font(40,True),fill=WHITE)
    positions=[(32,110),(800,110),(32,520),(800,520),(416,930)]
    for path,(x,y) in zip(files,positions):
        im=Image.open(path).convert("RGB").resize((thumbw,thumbh),Image.Resampling.LANCZOS)
        sheet.paste(im,(x,y))
    sheet.save(out/"contact-sheet.jpg",quality=92)


def sha(path: Path) -> str:
    h=hashlib.sha256(); h.update(path.read_bytes()); return h.hexdigest()


def render_xeneon(slug: str, shots: Path, out: Path) -> None:
    required=[shots/f"{k}.png" for k in SLOT_ORDER] + [shots/f"PALETTE_{p}.png" for p in ["ARTIST","NEON","EMBER","OCEAN"]]
    missing=[str(p) for p in required if not p.exists()]
    if missing:
        fail("missing deterministic widget captures: " + ", ".join(missing))
    out.mkdir(parents=True, exist_ok=True)
    name="Now Playing Panel" if slug=="now-playing" else slug.replace("-"," ").title()
    hero(shots,out,name); showcase(shots,out); features(shots,out); settings(shots,out); sizes(shots,out); contact_sheet(out)
    report={"schema_version":1,"slug":slug,"image_generation":"disabled","renderer":"tools/art/rat_art.py","outputs":{p.name:{"size":Image.open(p).size,"sha256":sha(p)} for p in sorted(out.glob("*.png"))},"contact_sheet":"contact-sheet.jpg"}
    (out/"rat-art-report.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print(f"RAT ART PASS: {slug} -> {out}")


def main() -> None:
    ap=argparse.ArgumentParser()
    sub=ap.add_subparsers(dest="cmd",required=True)
    xp=sub.add_parser("xeneon")
    xp.add_argument("slug")
    xp.add_argument("--shots",required=True,type=Path)
    xp.add_argument("--out",required=True,type=Path)
    args=ap.parse_args()
    if args.cmd=="xeneon":
        render_xeneon(args.slug,args.shots,args.out)

if __name__=="__main__":
    main()
