#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO = Path(__file__).resolve().parents[3]
W, H = 1920, 960
BG = (6, 8, 12)
PANEL = (13, 16, 23)
KEY = (18, 22, 30)
WHITE = (247, 249, 252)
MUTED = (165, 176, 192)
ACCENT = (43, 232, 106)
DANGER = (255, 91, 109)
DISCORD = (88, 101, 242)
RAT = REPO / "tools" / "art" / "assets" / "ratpack-icon-transparent.png"


def font(size: int, bold: bool = False):
    candidates = [
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    raise SystemExit("Voice Deck Rat Art requires a deterministic UI font")


def background():
    img = Image.new("RGBA", (W, H), (*BG, 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse((420, 240, 1500, 1320), fill=(*ACCENT, 22))
    d.ellipse((1180, -420, 2200, 620), fill=(*DISCORD, 25))
    return Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(170)))


def signature(img):
    if RAT.exists():
        rat = Image.open(RAT).convert("RGBA")
        box = rat.getbbox()
        if box:
            rat = rat.crop(box)
        scale = min(46 / rat.width, 46 / rat.height)
        rat = rat.resize((max(1, int(rat.width * scale)), max(1, int(rat.height * scale))), Image.Resampling.LANCZOS)
        img.alpha_composite(rat, ((W - rat.width) // 2, 896 - rat.height // 2))
    else:
        d = ImageDraw.Draw(img)
        d.ellipse((W // 2 - 14, 882, W // 2 + 14, 910), fill=ACCENT)


def title(img, headline, sub=""):
    d = ImageDraw.Draw(img)
    d.text((96, 74), headline, font=font(58, True), fill=WHITE)
    if sub:
        d.text((98, 146), sub, font=font(25), fill=MUTED)


def key(draw, x, y, label, state="", accent=ACCENT, avatar=None, speaking=False, icon=None, size=126):
    r = 24
    draw.rounded_rectangle((x, y, x + size, y + size), r, fill=KEY, outline=accent if speaking else (46, 54, 67), width=6 if speaking else 2)
    if avatar:
        draw.ellipse((x + 31, y + 18, x + 95, y + 82), fill=avatar)
        if speaking:
            draw.ellipse((x + 27, y + 14, x + 99, y + 86), outline=accent, width=5)
    elif icon == "mute":
        draw.ellipse((x + 46, y + 26, x + 80, y + 60), outline=accent, width=5)
        draw.line((x + 63, y + 59, x + 63, y + 77), fill=accent, width=5)
        draw.line((x + 48, y + 77, x + 78, y + 77), fill=accent, width=5)
    elif icon == "deafen":
        draw.arc((x + 38, y + 24, x + 88, y + 76), 190, 350, fill=accent, width=6)
        draw.rounded_rectangle((x + 35, y + 52, x + 48, y + 76), 5, fill=accent)
        draw.rounded_rectangle((x + 78, y + 52, x + 91, y + 76), 5, fill=accent)
    elif icon == "channel":
        draw.ellipse((x + 51, y + 36, x + 75, y + 60), fill=DISCORD)
        draw.ellipse((x + 35, y + 44, x + 54, y + 63), fill=DISCORD)
        draw.ellipse((x + 72, y + 44, x + 91, y + 63), fill=DISCORD)
    else:
        draw.ellipse((x + 48, y + 25, x + 78, y + 55), fill=accent)
    f = font(15, True)
    draw.text((x + size / 2, y + 95), label, font=f, fill=WHITE, anchor="mm")
    if state:
        draw.text((x + size / 2, y + 114), state, font=font(11), fill=accent if speaking else MUTED, anchor="mm")


def deck(img, x=715, y=248, cols=5, rows=3, keys=None, key_size=126, gap=18):
    keys = keys or []
    pad = 30
    width = pad * 2 + cols * key_size + (cols - 1) * gap
    height = pad * 2 + rows * key_size + (rows - 1) * gap
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((x, y, x + width, y + height), 42, fill=(20, 23, 29), outline=(55, 61, 73), width=3)
    d.rounded_rectangle((x + 12, y + 12, x + width - 12, y + height - 12), 34, outline=(5, 6, 9), width=3)
    for idx in range(cols * rows):
        row, col = divmod(idx, cols)
        spec = keys[idx] if idx < len(keys) else {"label": ""}
        key(d, x + pad + col * (key_size + gap), y + pad + row * (key_size + gap), size=key_size, **spec)


def hero(out):
    img = background()
    title(img, "Your Discord voice room. On Stream Deck.", "Live members, speaking state, mute, deafen and automatic channel following.")
    keys = [
        {"label":"General","state":"5 IN VOICE","icon":"channel","accent":DISCORD},
        {"label":"Mute","state":"LIVE","icon":"mute"},
        {"label":"Deafen","state":"LISTENING","icon":"deafen"},
        {"label":"Avery","state":"SPEAKING","avatar":(124,94,225),"speaking":True},
        {"label":"Ready","state":"DISCORD","accent":ACCENT},
        {"label":"Mika","state":"LISTENING","avatar":(76,148,209)},
        {"label":"Jules","state":"MUTED","avatar":(203,117,91)},
        {"label":"Noah","state":"LISTENING","avatar":(81,173,130)},
        {"label":"Sam","state":"LISTENING","avatar":(204,95,154)},
        {"label":"Kai","state":"LISTENING","avatar":(146,130,224)},
        {"label":"Rin","state":"LISTENING","avatar":(72,156,166)},
        {"label":"Eli","state":"LISTENING","avatar":(185,132,75)},
        {"label":"Zoe","state":"LISTENING","avatar":(92,130,214)},
        {"label":"Ivy","state":"LISTENING","avatar":(187,91,131)},
        {"label":"Max","state":"LISTENING","avatar":(92,163,104)},
    ]
    deck(img, x=905, y=258, keys=keys, key_size=112, gap=14)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((96, 278, 770, 720), 36, fill=(*PANEL, 235), outline=(50,59,72), width=2)
    d.text((142, 330), "VOICE DECK", font=font(21, True), fill=ACCENT)
    d.text((142, 380), "SEE WHO'S IN VOICE", font=font(33, True), fill=WHITE)
    d.text((142, 432), "SEE WHO'S TALKING", font=font(33, True), fill=WHITE)
    d.text((142, 484), "MUTE + DEAFEN", font=font(33, True), fill=WHITE)
    d.text((142, 536), "FOLLOW CHANNELS", font=font(33, True), fill=WHITE)
    d.text((142, 618), "$9.99  ONE TIME", font=font(23, True), fill=DISCORD)
    d.line((80, 850, 1840, 850), fill=(59,69,84), width=1)
    signature(img)
    img.convert("RGB").save(out / "02_cover.png", quality=95)


def features(out):
    img = background(); title(img, "One voice console. Twelve focused actions.", "Built around what you actually need while Discord stays in the background.")
    d=ImageDraw.Draw(img)
    items=[("Live Members","Dynamic participant keys follow your current voice channel."),("Speaking State","A thick illuminated ring reads instantly at key size."),("Mute + Deafen","Dedicated keys plus a configurable combined control."),("Automatic Channels","Switch voice rooms and the dashboard repopulates itself."),("Local Discord","Discord Desktop RPC only. No user token scraping.")]
    for i,(h,s) in enumerate(items):
        y=245+i*110
        d.rounded_rectangle((120,y,1800,y+82),24,fill=(*PANEL,235),outline=(45,53,66),width=2)
        d.ellipse((150,y+24,184,y+58),fill=ACCENT if i!=4 else DISCORD)
        d.text((220,y+18),h,font=font(25,True),fill=WHITE)
        d.text((220,y+49),s,font=font(18),fill=MUTED)
    signature(img); img.convert("RGB").save(out/"03_gallery_01.png",quality=95)


def dashboard(out):
    img=background(); title(img,"A full Discord voice dashboard","Purpose-built layouts instead of filler profiles.")
    keys=[
        {"label":"General","state":"8 IN VOICE","icon":"channel","accent":DISCORD},{"label":"Mute","state":"LIVE","icon":"mute"},{"label":"Deafen","state":"LISTENING","icon":"deafen"},{"label":"Mika","state":"SPEAKING","avatar":(76,148,209),"speaking":True},{"label":"Ready","state":"DISCORD"},
    ]
    for name,color in [("Jules",(203,117,91)),("Noah",(81,173,130)),("Sam",(204,95,154)),("Kai",(146,130,224)),("Rin",(72,156,166)),("Eli",(185,132,75)),("Zoe",(92,130,214)),("Ivy",(187,91,131)),("Max",(92,163,104)),("Avery",(124,94,225))]: keys.append({"label":name,"state":"LISTENING","avatar":color})
    deck(img,x=440,y=245,keys=keys,key_size=130,gap=20)
    d=ImageDraw.Draw(img); d.text((960,790),"VOICE DASHBOARD  •  MK.2 / 15 KEY",font=font(23,True),fill=MUTED,anchor="mm")
    signature(img); img.convert("RGB").save(out/"04_gallery_02.png",quality=95)


def spotlight(out):
    img=background(); title(img,"Speaking should be obvious","Stable roster keys plus a dedicated speaker spotlight. No constant key shuffling.")
    d=ImageDraw.Draw(img)
    key(d,250,290,"Avery","SPEAKING",avatar=(124,94,225),speaking=True,size=230)
    d.text((365,565),"SPEAKER SPOTLIGHT",font=font(22,True),fill=ACCENT,anchor="mm")
    d.text((365,610),"Most recent active speaker\nwith a short hold to prevent flicker.",font=font(18),fill=MUTED,anchor="ma",spacing=8,align="center")
    for i,(name,color,state) in enumerate([("Mika",(76,148,209),"LISTENING"),("Jules",(203,117,91),"MUTED"),("Noah",(81,173,130),"LISTENING"),("Sam",(204,95,154),"LISTENING")]):
        key(d,720+i*245,330,name,state,avatar=color,size=185)
    d.text((1190,570),"DYNAMIC MEMBER SLOTS",font=font(22,True),fill=WHITE,anchor="mm")
    d.text((1190,610),"Members stay in a predictable physical order.\nSpeaking state changes the key, not its position.",font=font(18),fill=MUTED,anchor="ma",spacing=8,align="center")
    signature(img); img.convert("RGB").save(out/"05_gallery_03.png",quality=95)


def compatibility(out):
    img=background(); title(img,"Built for your Stream Deck","Four device-specific profiles plus flexible individual actions.")
    d=ImageDraw.Draw(img)
    cards=[("MK.2 / 15 KEY","Full 10-member dashboard","5 × 3"),("STREAM DECK XL","24 live member slots","8 × 4"),("STREAM DECK +","Keys + Voice Navigator dial","4 × 2 + dial"),("STREAM DECK NEO","Compact essentials","4 × 2")]
    for i,(name,desc,shape) in enumerate(cards):
        col=i%2; row=i//2; x=150+col*840; y=250+row*250
        d.rounded_rectangle((x,y,x+730,y+190),32,fill=(*PANEL,235),outline=(51,60,73),width=2)
        d.text((x+42,y+42),name,font=font(28,True),fill=WHITE)
        d.text((x+42,y+89),desc,font=font(20),fill=MUTED)
        d.text((x+42,y+136),shape,font=font(18,True),fill=ACCENT if i!=2 else DISCORD)
    signature(img); img.convert("RGB").save(out/"06_gallery_04.png",quality=95)


def search_icon(out):
    img=Image.new("RGBA",(288,288),(*BG,255)); d=ImageDraw.Draw(img)
    d.rounded_rectangle((18,18,270,270),58,fill=KEY,outline=ACCENT,width=8)
    for cx,cy,color in [(96,104,DISCORD),(144,83,ACCENT),(192,104,DISCORD)]:
        d.ellipse((cx-30,cy-30,cx+30,cy+30),fill=color)
    d.arc((75,110,213,228),15,165,fill=WHITE,width=13)
    d.text((144,238),"VOICE",font=font(27,True),fill=WHITE,anchor="mm")
    img.convert("RGB").save(out/"01_search_icon.png",quality=95)


def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--destination",required=True); args=parser.parse_args()
    out=Path(args.destination); out.mkdir(parents=True,exist_ok=True)
    search_icon(out); hero(out); features(out); dashboard(out); spotlight(out); compatibility(out)
    required=["01_search_icon.png","02_cover.png","03_gallery_01.png","04_gallery_02.png","05_gallery_03.png","06_gallery_04.png"]
    for name in required:
        path=out/name
        if not path.is_file(): raise SystemExit(f"Missing Rat Art output: {name}")
    print(f"Voice Deck Rat Art ready: {out}")

if __name__ == "__main__": main()
