#!/usr/bin/env python3
from __future__ import annotations

import argparse, csv, json, math, shutil, zipfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "tools" / "art"
BASE = ART / "scenes" / "warm-studio-v1" / "base.png"
PLATE = ART / "assets" / "xeneon-edge-transparent.png"
LOGO = ART / "assets" / "ratpack-icon-transparent.png"
W, H = 1920, 960
ORANGE = (244,116,0)
WHITE = (247,248,250)
MON = (430,74,1495,570)

PRODUCTS = {
    "agenda-panel": ("Calendar Panel", "CALENDAR", "PANEL"),
    "desk-notes": ("Desk Notes Lite", "DESK", "NOTES LITE"),
    "desk-notes-pro": ("Desk Notes Pro", "DESK", "NOTES PRO"),
    "discord-panel": ("Discord Voice Panel", "DISCORD", "VOICE PANEL"),
    "helldivers": ("Helldivers 2 Panel", "HELLDIVERS 2", "PANEL"),
    "net-dashboard": ("Net Dashboard", "NET", "DASHBOARD"),
    "now-playing": ("Now Playing Panel", "NOW", "PLAYING"),
    "obs-dashboard": ("OBS Dashboard", "OBS", "DASHBOARD"),
    "pc-power-meter": ("PC Power Meter Lite", "PC POWER", "METER LITE"),
    "pc-power-meter-pro": ("PC Power Meter Pro", "PC POWER", "METER PRO"),
    "rig-battery": ("Rig Battery", "RIG", "BATTERY"),
    "snake": ("Snake", "", "SNAKE"),
    "weather-timeline": ("Weather Timeline Lite", "WEATHER", "TIMELINE LITE"),
    "weather-timeline-pro": ("Weather Timeline Pro", "WEATHER", "TIMELINE PRO"),
    "work-session-tracker": ("Work Session Tracker Lite", "WORK SESSION", "TRACKER LITE"),
    "work-session-tracker-pro": ("Work Session Tracker Pro", "WORK SESSION", "TRACKER PRO"),
    "xeneon-edge-ultimate": ("XENEON EDGE Ultimate", "ULTIMATE", "BUNDLE"),
}


def fail(msg: str):
    raise SystemExit(msg)


def font_path(bold: bool) -> str:
    import os
    env = os.environ.get("RATPACK_ART_FONT_BOLD" if bold else "RATPACK_ART_FONT")
    if env and Path(env).is_file(): return env
    candidates = ([r"C:\Windows\Fonts\segoeuib.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"] if bold
                  else [r"C:\Windows\Fonts\segoeui.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"])
    for p in candidates:
        if Path(p).is_file(): return p
    fail("deterministic font missing")


def F(size: int, bold: bool=True): return ImageFont.truetype(font_path(bold), size)


def fit(d, text, maxw, maxs, mins, bold=True):
    if not text: return F(mins, bold)
    for s in range(maxs, mins-1, -2):
        f=F(s,bold); b=d.textbbox((0,0),text,font=f)
        if b[2]-b[0] <= maxw: return f
    return F(mins,bold)


def safe_logo():
    src=Image.open(LOGO).convert("RGBA")
    w,h=src.size; p=max(18,round(max(w,h)*.20))
    out=Image.new("RGBA",(w+2*p,h+2*p),(0,0,0,0)); out.alpha_composite(src,(p,p))
    out.thumbnail((82,86),Image.Resampling.LANCZOS)
    return out


def monitor(img, line1, line2):
    x1,y1,x2,y2=MON; w=x2-x1; h=y2-y1
    p=Image.new("RGBA",(w,h),(4,6,8,255)); d=ImageDraw.Draw(p)
    glow=Image.new("RGBA",(w,h),(0,0,0,0)); gd=ImageDraw.Draw(glow)
    gd.ellipse((-120,int(h*.60),w+140,int(h*1.26)),fill=(*ORANGE,30))
    p.alpha_composite(glow.filter(ImageFilter.GaussianBlur(42)))
    for band in range(6):
        pts=[]; yy=int(h*.88)+band*3
        for xx in range(-20,w+20,8):
            pts.append((xx,yy+int(math.sin(xx/w*math.pi*2+band*.18)*(4+band))))
        d.line(pts,fill=(*ORANGE,max(7,27-band*3)),width=1)
    for xx in range(int(w*.81),w-28,10):
        for yy in range(22,122,10): d.ellipse((xx,yy,xx+2,yy+2),fill=(*ORANGE,25))
    f1=fit(d,line1,int(w*.84),116,50); f2=fit(d,line2,int(w*.88),126,48); fs=fit(d,"for XENEON Edge",int(w*.58),46,29)
    def center(text,fnt,cy,col):
        if not text: return
        b=d.textbbox((0,0),text,font=fnt); tw,th=b[2]-b[0],b[3]-b[1]; tx=(w-tw)//2; ty=int(cy-th/2-b[1])
        sh=Image.new("RGBA",(w,h),(0,0,0,0)); sd=ImageDraw.Draw(sh); sd.text((tx+2,ty+4),text,font=fnt,fill=(0,0,0,175)); p.alpha_composite(sh.filter(ImageFilter.GaussianBlur(4)))
        d.text((tx,ty),text,font=fnt,fill=(*col,255))
    if line1:
        center(line1,f1,h*.10,WHITE); center(line2,f2,h*.31,ORANGE); center("for XENEON Edge",fs,h*.49,WHITE)
    else:
        center(line2,f2,h*.22,ORANGE); center("for XENEON Edge",fs,h*.48,WHITE)
    img.alpha_composite(p,(x1,y1))


def device_geometry():
    plate=Image.open(PLATE).convert("RGBA")
    bbox=plate.getchannel("A").getbbox(); pad=10
    cx1=max(0,bbox[0]-pad); cy1=max(0,bbox[1]-pad); cx2=min(plate.width,bbox[2]+pad); cy2=min(plate.height,bbox[3]+pad)
    crop=plate.crop((cx1,cy1,cx2,cy2)); screen=(243-cx1,465-cy1,1658-cx1,848-cy1)
    tw=1890; scale=tw/crop.width; th=round(crop.height*scale); x=(W-tw)//2; y=H-th-8
    dev=crop.resize((tw,th),Image.Resampling.LANCZOS); sx1,sy1,sx2,sy2=[round(v*scale) for v in screen]
    return dev,x,y,(sx1,sy1,sx2,sy2)


def prep_ui(path: Path, size):
    ui=Image.open(path).convert("RGBA").resize(size,Image.Resampling.LANCZOS)
    ui=ImageEnhance.Contrast(ui).enhance(1.055); ui=ImageEnhance.Sharpness(ui).enhance(1.32)
    return ui.filter(ImageFilter.UnsharpMask(radius=.75,percent=115,threshold=2))


def render_one(slug: str, shot: Path, out: Path):
    if slug not in PRODUCTS: fail(f"unknown XENEON slug: {slug}")
    if not shot.is_file(): fail(f"missing real XL_H capture: {shot}")
    if not BASE.is_file() or not PLATE.is_file() or not LOGO.is_file(): fail("approved environment assets missing")
    name,l1,l2=PRODUCTS[slug]; img=Image.open(BASE).convert("RGBA"); monitor(img,l1,l2)
    dev,x,y,s=device_geometry(); sx1,sy1,sx2,sy2=s; ui=prep_ui(shot,(sx2-sx1,sy2-sy1))
    shadow=Image.new("RGBA",img.size,(0,0,0,0)); a=dev.getchannel("A").filter(ImageFilter.GaussianBlur(15)); ss=Image.new("RGBA",dev.size,(0,0,0,84)); ss.putalpha(a); shadow.alpha_composite(ss,(x+4,y+10)); img.alpha_composite(shadow)
    layer=Image.new("RGBA",img.size,(0,0,0,0)); layer.alpha_composite(ui,(x+sx1,y+sy1)); layer.alpha_composite(dev,(x,y)); img.alpha_composite(layer)
    lg=safe_logo(); img.alpha_composite(lg,(W-58-lg.width,24))
    out.parent.mkdir(parents=True,exist_ok=True); img.convert("RGB").save(out,"PNG",optimize=True)
    meta=out.with_suffix(".json"); meta.write_text(json.dumps({"slug":slug,"name":name,"title":[l1,l2],"source_capture":str(shot)},indent=2),encoding="utf-8")
    print(f"PASS {slug}: {out}")


def bundle(inp: Path, outdir: Path):
    outdir.mkdir(parents=True,exist_ok=True); heroes=outdir/"heroes"; heroes.mkdir(exist_ok=True)
    rows=[]
    for slug,(name,_,_) in PRODUCTS.items():
        p=inp/f"{slug}.png"; m=inp/f"{slug}.json"
        if p.is_file(): shutil.copy2(p,heroes/p.name); rows.append((slug,name,"RENDERED",p))
        else: rows.append((slug,name,"MISSING",""))
        if m.is_file(): shutil.copy2(m,heroes/m.name)
    rendered=[r for r in rows if r[2]=="RENDERED"]
    cols=4; tilew,tileh=480,280; nrows=math.ceil(len(rendered)/cols)
    contact=Image.new("RGB",(cols*tilew,nrows*tileh),(12,12,14)); d=ImageDraw.Draw(contact); lf=F(20,True)
    small=Image.new("RGB",(cols*288,nrows*144),(12,12,14))
    for i,(slug,name,_,p) in enumerate(rendered):
        c,r=i%cols,i//cols; im=Image.open(p).convert("RGB"); contact.paste(im.resize((480,240),Image.Resampling.LANCZOS),(c*tilew,r*tileh)); d.rectangle((c*tilew,r*tileh+240,c*tilew+tilew,r*tileh+tileh),fill=(16,17,20)); d.text((c*tilew+12,r*tileh+249),name,font=lf,fill=(245,246,248)); small.paste(im.resize((288,144),Image.Resampling.LANCZOS),(c*288,r*144))
    contact.save(outdir/"contact-sheet.jpg",quality=94); small.save(outdir/"15-percent-sheet.jpg",quality=96)
    with (outdir/"manifest.csv").open("w",newline="",encoding="utf-8") as f:
        w=csv.writer(f); w.writerow(["slug","product","status"]); [w.writerow(r[:3]) for r in rows]
    (outdir/"README.md").write_text(f"# PackRat XENEON all-hero batch\n\nRendered {len(rendered)}/{len(PRODUCTS)} current XENEON source products with real XL_H captures and the approved warm-studio hero system.\n",encoding="utf-8")
    zip_path=outdir.parent/"packrat-xeneon-all-heroes.zip"
    if zip_path.exists(): zip_path.unlink()
    with zipfile.ZipFile(zip_path,"w",zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in sorted(outdir.rglob("*")):
            if p.is_file(): z.write(p,p.relative_to(outdir))
    print(f"BUNDLE {len(rendered)}/{len(PRODUCTS)}: {zip_path}")
    if len(rendered)!=len(PRODUCTS): fail("batch incomplete; see manifest.csv")


def main():
    ap=argparse.ArgumentParser(); sub=ap.add_subparsers(dest="cmd",required=True)
    r=sub.add_parser("render"); r.add_argument("--slug",required=True); r.add_argument("--shot",type=Path,required=True); r.add_argument("--out",type=Path,required=True)
    b=sub.add_parser("bundle"); b.add_argument("--input",type=Path,required=True); b.add_argument("--out-dir",type=Path,required=True)
    a=ap.parse_args(); render_one(a.slug,a.shot,a.out) if a.cmd=="render" else bundle(a.input,a.out_dir)

if __name__=="__main__": main()
