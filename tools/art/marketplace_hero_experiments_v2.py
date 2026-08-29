#!/usr/bin/env python3
"""Render radically distinct PackRat marketplace hero directions.

Review-only. Uses real product capture + canonical PackRat/XENEON assets.
Non-negotiables: huge readable product name, obvious real product, secondary PackRat mark.
Everything else is intentionally allowed to vary.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import rat_art

W, H = rat_art.W, rat_art.H
WHITE = rat_art.WHITE
MUTED = rat_art.MUTED
BG = (8, 10, 14)


def logo(max_size: int) -> Image.Image:
    mark = rat_art._logo_image(max_size)
    if mark is None:
        rat_art.fail("PackRat logo missing")
    return mark


def place_logo(canvas: Image.Image, x: int, y: int, max_size: int = 54) -> None:
    mark = logo(max_size)
    canvas.alpha_composite(mark, (x, y))


def title(draw: ImageDraw.ImageDraw, text: str, x: int, y: int, width: int, max_size: int = 96, min_size: int = 54, anchor: str = "mm", fill=WHITE) -> None:
    f = rat_art.fit_font(draw, text, width, max_size, min_size, bold=True)
    draw.text((x, y), text, font=f, fill=(*fill, 255), anchor=anchor)


def product(shot: Path, max_box=(1780, 610)) -> Image.Image:
    return rat_art.render_device(shot, max_box)


def save(canvas: Image.Image, path: Path) -> None:
    canvas.convert("RGB").save(path, "PNG", optimize=True)


def blurred_context(shot: Path, accent: tuple[int, int, int], brightness=0.55, blur=24) -> Image.Image:
    raw = Image.open(shot).convert("RGB")
    scale = max(W / raw.width, H / raw.height)
    raw = raw.resize((int(raw.width * scale), int(raw.height * scale)), Image.Resampling.LANCZOS)
    l = (raw.width - W) // 2
    t = (raw.height - H) // 2
    raw = raw.crop((l, t, l + W, t + H))
    raw = ImageEnhance.Brightness(raw).enhance(brightness)
    raw = raw.filter(ImageFilter.GaussianBlur(blur)).convert("RGBA")
    tint = Image.new("RGBA", (W, H), (*accent, 32))
    return Image.alpha_composite(raw, tint)


def style_1(shot: Path, out: Path, accent):
    # Ultra-clean official hardware launch: huge title, spotlight, no ornament.
    c = Image.new("RGBA", (W, H), (6, 8, 12, 255)); d = ImageDraw.Draw(c)
    glow = Image.new("RGBA", (W, H), (0,0,0,0)); gd = ImageDraw.Draw(glow)
    gd.ellipse((250, 180, 1670, 1020), fill=(*accent, 80))
    c = Image.alpha_composite(c, glow.filter(ImageFilter.GaussianBlur(120))); d = ImageDraw.Draw(c)
    place_logo(c, 60, 52, 48)
    title(d, "PC POWER METER", W//2, 102, 1540, 104, 62)
    p = product(shot, (1810, 650)); c.alpha_composite(p, ((W-p.width)//2, 250))
    save(c, out)


def style_2(shot: Path, out: Path, accent):
    # Oversized typography poster: title becomes part of the design.
    c = Image.new("RGBA", (W,H), (12,13,17,255)); d = ImageDraw.Draw(c)
    d.rectangle((0,0,W,208), fill=(*accent, 255))
    place_logo(c, 62, 58, 50)
    title(d, "PC POWER METER", W//2, 108, 1580, 108, 64, fill=(10,12,16))
    # huge ghost word behind product
    ghost = rat_art.fit_font(d, "POWER", 1800, 250, 150, bold=True)
    d.text((W//2, 600), "POWER", font=ghost, fill=(*accent, 26), anchor="mm")
    p = product(shot, (1760, 610)); c.alpha_composite(p, ((W-p.width)//2, 286))
    save(c, out)


def style_3(shot: Path, out: Path, accent):
    # Technical dashboard / measurement grid.
    c = Image.new("RGBA", (W,H), (5,10,14,255)); d = ImageDraw.Draw(c)
    for x in range(0,W,80): d.line((x,0,x,H), fill=(*accent,18), width=1)
    for y in range(0,H,80): d.line((0,y,W,y), fill=(*accent,18), width=1)
    for x in (180, 1740): d.line((x,0,x,H), fill=(*accent,70), width=2)
    d.rectangle((0,0,W,190), fill=(5,10,14,235))
    place_logo(c, 60, 48, 50)
    title(d, "PC POWER METER", W//2, 96, 1540, 102, 60)
    p = product(shot, (1720, 590)); c.alpha_composite(p, ((W-p.width)//2, 270))
    # sparse measurement ticks
    for x in range(260,1661,140): d.line((x,850,x,870), fill=(*accent,120), width=2)
    save(c, out)


def style_4(shot: Path, out: Path, accent):
    # Bright editorial / premium white campaign.
    c = Image.new("RGBA", (W,H), (238,240,244,255)); d = ImageDraw.Draw(c)
    d.polygon([(0,0),(880,0),(530,H),(0,H)], fill=(222,225,231,255))
    d.polygon([(1360,0),(W,0),(W,H),(1510,H)], fill=(*accent, 50))
    place_logo(c, 58, 48, 52)
    title(d, "PC POWER METER", W//2, 100, 1540, 100, 58, fill=(18,20,24))
    p = product(shot, (1700, 590));
    shadow = Image.new("RGBA", (p.width+100,p.height+100),(0,0,0,0)); sd=ImageDraw.Draw(shadow)
    sd.ellipse((100,p.height-5,p.width, p.height+70), fill=(0,0,0,45))
    shadow=shadow.filter(ImageFilter.GaussianBlur(30)); c.alpha_composite(shadow, ((W-shadow.width)//2,275))
    c.alpha_composite(p, ((W-p.width)//2, 275))
    save(c, out)


def style_5(shot: Path, out: Path, accent):
    # Cinematic real-product context with hard readable title plaque.
    c = blurred_context(shot, accent, 0.44, 28)
    d = ImageDraw.Draw(c)
    d.rectangle((0,0,W,205), fill=(4,6,9,232))
    d.rectangle((0,205,W,214), fill=(*accent,255))
    place_logo(c, 60, 52, 48)
    title(d, "PC POWER METER", W//2, 102, 1540, 104, 62)
    p = product(shot, (1780, 610)); c.alpha_composite(p, ((W-p.width)//2, 270))
    save(c, out)


def style_6(shot: Path, out: Path, accent):
    # Asymmetric industrial / diagonal energy composition.
    c = Image.new("RGBA", (W,H), (7,8,11,255)); d = ImageDraw.Draw(c)
    d.polygon([(0,0),(740,0),(430,H),(0,H)], fill=(*accent,210))
    d.polygon([(W-390,0),(W,0),(W,H),(W-650,H)], fill=(18,20,26,255))
    d.polygon([(900,0),(990,0),(650,H),(560,H)], fill=(*accent,45))
    place_logo(c, 56, 48, 50)
    # left-aligned enormous title on dark plaque spanning center
    d.rounded_rectangle((420,36,1685,188), radius=18, fill=(5,7,10,232))
    title(d, "PC POWER METER", 1050, 112, 1180, 96, 58)
    p = product(shot, (1680, 580)); c.alpha_composite(p, ((W-p.width)//2+55, 300))
    save(c, out)


def style_7(shot: Path, out: Path, accent):
    # Glass poster / framed product card with extreme contrast.
    c = blurred_context(shot, accent, 0.28, 46)
    d = ImageDraw.Draw(c)
    # giant translucent card
    card = Image.new("RGBA", (1710,760),(10,13,18,195)); cd=ImageDraw.Draw(card)
    cd.rounded_rectangle((0,0,1709,759), radius=42, fill=(10,13,18,202), outline=(*accent,130), width=3)
    card=card.filter(ImageFilter.GaussianBlur(0.2)); c.alpha_composite(card,(105,155)); d=ImageDraw.Draw(c)
    place_logo(c, 138, 186, 48)
    title(d, "PC POWER METER", W//2, 230, 1450, 98, 58)
    p = product(shot,(1560,520)); c.alpha_composite(p,((W-p.width)//2,340))
    save(c,out)


def style_8(shot: Path, out: Path, accent):
    # Full launch-campaign look: split light, contextual texture, foreground stage.
    c = blurred_context(shot, accent, 0.32, 34)
    d = ImageDraw.Draw(c)
    # dramatic light wedges
    overlay = Image.new("RGBA",(W,H),(0,0,0,0)); od=ImageDraw.Draw(overlay)
    od.polygon([(0,0),(820,0),(1250,H),(0,H)], fill=(*accent,54))
    od.polygon([(W,0),(1500,0),(980,H),(W,H)], fill=(255,255,255,18))
    c=Image.alpha_composite(c,overlay); d=ImageDraw.Draw(c)
    # title slab floating above product
    d.rounded_rectangle((290,38,1630,196), radius=24, fill=(4,6,9,226), outline=(255,255,255,34), width=2)
    place_logo(c, 58, 54, 50)
    title(d, "PC POWER METER", W//2, 118, 1250, 100, 60)
    # stage shadow + product
    p = product(shot,(1740,595)); py=286
    sh=Image.new("RGBA",(1500,180),(0,0,0,0)); sd=ImageDraw.Draw(sh); sd.ellipse((50,35,1450,150),fill=(0,0,0,145)); sh=sh.filter(ImageFilter.GaussianBlur(38)); c.alpha_composite(sh,((W-sh.width)//2,760))
    c.alpha_composite(p,((W-p.width)//2,py))
    save(c,out)


def contact(paths, out, title_text, thumb=(720,360), cols=2):
    gap=30; margin=36; label_h=40; rows=(len(paths)+cols-1)//cols; head=78
    sheet=Image.new("RGB",(margin*2+cols*thumb[0]+(cols-1)*gap, head+margin+rows*(thumb[1]+label_h)+(rows-1)*gap+margin),(8,10,14))
    d=ImageDraw.Draw(sheet); d.text((margin,25),title_text,font=rat_art.resolve_font(30,True),fill=(*WHITE,255))
    for i,pth in enumerate(paths):
        img=Image.open(pth).convert("RGB").resize(thumb,Image.Resampling.LANCZOS); r,col=divmod(i,cols); x=margin+col*(thumb[0]+gap); y=head+margin+r*(thumb[1]+label_h+gap); sheet.paste(img,(x,y)); d.text((x,y+thumb[1]+8),str(i+1),font=rat_art.resolve_font(20,True),fill=(*WHITE,255))
    sheet.save(out,"JPEG",quality=94)


def small_sheet(paths,out):
    # explicit ~15% test of 1920x960 => 288x144
    tw,th=288,144; cols=4; rows=2; gap=20; m=28; lh=32
    sheet=Image.new("RGB",(m*2+cols*tw+(cols-1)*gap,m*2+rows*(th+lh)+(rows-1)*gap),(8,10,14)); d=ImageDraw.Draw(sheet)
    for i,p in enumerate(paths):
        img=Image.open(p).convert("RGB").resize((tw,th),Image.Resampling.LANCZOS); r,c=divmod(i,cols); x=m+c*(tw+gap); y=m+r*(th+lh+gap); sheet.paste(img,(x,y)); d.text((x,y+th+7),str(i+1),font=rat_art.resolve_font(17,True),fill=(*WHITE,255))
    sheet.save(out,"JPEG",quality=95)


def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--shots",type=Path,required=True); ap.add_argument("--out",type=Path,required=True); a=ap.parse_args(); a.out.mkdir(parents=True,exist_ok=True)
    shot=a.shots/"XL_H.png"
    if not shot.is_file(): rat_art.fail(f"missing real capture: {shot}")
    _, cfg, _ = rat_art.load_product("pc-power-meter-pro"); accent=rat_art.parse_accent(cfg.get("accent"))
    styles=[style_1,style_2,style_3,style_4,style_5,style_6,style_7,style_8]; paths=[]
    for i,fn in enumerate(styles,1):
        p=a.out/f"{i:02d}.png"; fn(shot,p,accent); paths.append(p)
    contact(paths,a.out/"contact-sheet.jpg","PackRat Marketplace — radically different hero directions")
    small_sheet(paths,a.out/"fifteen-percent-sheet.jpg")
    print(f"Rendered {len(paths)} experimental hero directions")

if __name__=="__main__": main()
