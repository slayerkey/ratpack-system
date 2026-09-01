#!/usr/bin/env python3
"""Eight bold PackRat Marketplace hero campaign directions.
Review-only. Deterministic compositing from the real PC Power Meter Pro capture.
Hierarchy is intentionally fixed: huge product name -> real product -> secondary PackRat mark.
"""
from __future__ import annotations
import argparse, math, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import rat_art

W,H=rat_art.W,rat_art.H
WHITE=rat_art.WHITE
DARK=(8,10,14)

def logo(max_size=50):
    m=rat_art._logo_image(max_size)
    if m is None: rat_art.fail('PackRat logo missing')
    return m

def mark(c,x,y,s=48): c.alpha_composite(logo(s),(x,y))

def fit_title(d,text,width,max_size=168,min_size=100):
    return rat_art.fit_font(d,text,width,max_size,min_size,bold=True)

def big_title(d,text,y,fill=(255,255,255),width=1640,max_size=168,stroke=0,stroke_fill=None):
    f=fit_title(d,text,width,max_size,96)
    d.text((W//2,y),text,font=f,fill=(*fill,255),anchor='mm',stroke_width=stroke,stroke_fill=stroke_fill)

def device(shot,box=(1760,570)): return rat_art.render_device(shot,box)

def context(shot,brightness=.38,blur=30,sat=1.25):
    im=Image.open(shot).convert('RGB'); scale=max(W/im.width,H/im.height)
    im=im.resize((int(im.width*scale),int(im.height*scale)),Image.Resampling.LANCZOS)
    l=(im.width-W)//2;t=(im.height-H)//2;im=im.crop((l,t,l+W,t+H))
    im=ImageEnhance.Color(im).enhance(sat); im=ImageEnhance.Brightness(im).enhance(brightness)
    return im.filter(ImageFilter.GaussianBlur(blur)).convert('RGBA')

def glow(c,box,color,blur=80):
    g=Image.new('RGBA',(W,H),(0,0,0,0)); gd=ImageDraw.Draw(g);gd.ellipse(box,fill=color)
    c.alpha_composite(g.filter(ImageFilter.GaussianBlur(blur)))

def save(c,p): c.convert('RGB').save(p,'PNG',optimize=True)

def place_product(c,shot,y=330,box=(1760,570),xoff=0):
    p=device(shot,box); c.alpha_composite(p,((W-p.width)//2+xoff,y)); return p

# 1: Bright editorial color field. Evolves prior #4 but actually uses the page as graphic design.
def s1(shot,out,a):
    c=Image.new('RGBA',(W,H),(244,241,235,255));d=ImageDraw.Draw(c)
    d.ellipse((-260,80,770,1110),fill=(*a,235)); d.ellipse((1430,-310,2200,470),fill=(255,185,82,230))
    d.polygon([(1050,0),(W,0),(W,H),(1500,H)],fill=(226,220,255,255))
    d.rounded_rectangle((255,34,1665,232),32,fill=(248,247,244,238))
    mark(c,68,58,50); big_title(d,'PC POWER METER',132,(20,21,25),1540,160)
    place_product(c,shot,315,(1690,575)); save(c,out)

# 2: Cinematic neon environment. Evolves prior #5 with real atmospheric depth.
def s2(shot,out,a):
    c=context(shot,.26,42,1.65); d=ImageDraw.Draw(c)
    glow(c,(-250,160,900,1250),(*a,165),105); glow(c,(1220,-260,2300,760),(255,75,170,120),120)
    veil=Image.new('RGBA',(W,H),(4,5,9,72));c=Image.alpha_composite(c,veil);d=ImageDraw.Draw(c)
    d.rounded_rectangle((210,28,1710,238),36,fill=(5,7,11,218),outline=(255,255,255,38),width=2)
    mark(c,66,61,48); big_title(d,'PC POWER METER',132,(255,255,255),1450,158)
    place_product(c,shot,318,(1740,585)); save(c,out)

# 3: Saturated gradient campaign with bloom and concentric energy rings.
def s3(shot,out,a):
    c=Image.new('RGBA',(W,H),(17,8,35,255));d=ImageDraw.Draw(c)
    for i in range(13,-1,-1):
        pad=i*65; alpha=max(12,105-i*6); d.ellipse((180-pad,130-pad,1740+pad,1040+pad),outline=(*a,alpha),width=22)
    glow(c,(-300,-260,1050,1050),(*a,170),130);glow(c,(1050,80,2350,1280),(255,54,154,135),140)
    d=ImageDraw.Draw(c);mark(c,65,55,50);big_title(d,'PC POWER METER',132,(255,255,255),1580,166,2,(25,10,45,220))
    place_product(c,shot,330,(1710,570));save(c,out)

# 4: Swiss/editorial graphic poster with oversized cropped typography and color blocks.
def s4(shot,out,a):
    c=Image.new('RGBA',(W,H),(238,239,232,255));d=ImageDraw.Draw(c)
    d.rectangle((0,0,410,H),fill=(*a,255));d.rectangle((410,0,W,260),fill=(23,24,28,255))
    ghost=rat_art.resolve_font(310,True);d.text((W+50,760),'POWER',font=ghost,fill=(25,26,30,24),anchor='rs')
    mark(c,55,52,48);big_title(d,'PC POWER METER',130,(255,255,255),1390,164)
    place_product(c,shot,320,(1660,565),75);save(c,out)

# 5: Studio stage, physical-feeling floor, spotlights, rim light.
def s5(shot,out,a):
    c=Image.new('RGBA',(W,H),(7,8,12,255));d=ImageDraw.Draw(c)
    # back wall / floor seam
    d.rectangle((0,700,W,H),fill=(13,14,19,255));d.line((0,700,W,700),fill=(*a,85),width=3)
    glow(c,(280,-520,1050,880),(*a,125),105);glow(c,(950,-500,1710,870),(255,190,95,85),115)
    d=ImageDraw.Draw(c);d.ellipse((270,745,1650,1010),fill=(*a,38));mark(c,64,55,48)
    big_title(d,'PC POWER METER',135,(255,255,255),1580,166)
    place_product(c,shot,330,(1710,565));save(c,out)

# 6: Layered glass atmosphere, large translucent shapes and refracted color.
def s6(shot,out,a):
    c=context(shot,.32,50,1.45)
    glass=Image.new('RGBA',(W,H),(0,0,0,0));g=ImageDraw.Draw(glass)
    g.rounded_rectangle((-180,80,770,1080),90,fill=(*a,92),outline=(255,255,255,60),width=3)
    g.rounded_rectangle((1250,-120,2080,720),100,fill=(255,92,170,70),outline=(255,255,255,52),width=3)
    g.polygon([(760,0),(1180,0),(1540,H),(1110,H)],fill=(255,255,255,22))
    c=Image.alpha_composite(c,glass.filter(ImageFilter.GaussianBlur(1)));d=ImageDraw.Draw(c)
    d.rounded_rectangle((185,28,1735,240),38,fill=(7,9,14,205),outline=(255,255,255,55),width=2)
    mark(c,63,61,48);big_title(d,'PC POWER METER',134,(255,255,255),1480,160)
    place_product(c,shot,325,(1710,575));save(c,out)

# 7: Bold geometric packaging, intentionally unlike a header template.
def s7(shot,out,a):
    c=Image.new('RGBA',(W,H),(250,196,74,255));d=ImageDraw.Draw(c)
    d.polygon([(0,0),(1190,0),(760,H),(0,H)],fill=(18,20,27,255))
    d.polygon([(1420,0),(W,0),(W,H),(1110,H)],fill=(*a,255))
    d.ellipse((1360,110,2060,810),outline=(255,255,255,105),width=26)
    d.rounded_rectangle((165,34,1690,240),24,fill=(7,9,13,245))
    mark(c,65,62,48);big_title(d,'PC POWER METER',136,(255,255,255),1450,160)
    place_product(c,shot,330,(1690,570));save(c,out)

# 8: Unexpected premium campaign: giant outlined title behind product + color horizon.
def s8(shot,out,a):
    c=Image.new('RGBA',(W,H),(9,10,15,255));d=ImageDraw.Draw(c)
    # colorful horizon
    for y in range(310,H):
        t=(y-310)/(H-310); col=(int(a[0]*(1-t)+35*t),int(a[1]*(1-t)+16*t),int(a[2]*(1-t)+58*t),255);d.line((0,y,W,y),fill=col)
    huge=rat_art.fit_font(d,'POWER',1840,330,240,bold=True)
    d.text((W//2,530),'POWER',font=huge,fill=(0,0,0,0),stroke_width=5,stroke_fill=(255,255,255,55),anchor='mm')
    d.rectangle((0,0,W,258),fill=(9,10,15,255));mark(c,65,58,50);big_title(d,'PC POWER METER',135,(255,255,255),1580,170)
    place_product(c,shot,335,(1700,570));save(c,out)

def contact(paths,out):
    tw,th=720,360;cols=2;gap=28;m=34;lh=40;head=72;rows=4
    s=Image.new('RGB',(m*2+cols*tw+gap,head+m+rows*(th+lh)+(rows-1)*gap+m),DARK);d=ImageDraw.Draw(s)
    d.text((m,22),'PackRat Marketplace — bold campaign directions',font=rat_art.resolve_font(30,True),fill=WHITE)
    for i,p in enumerate(paths):
        im=Image.open(p).convert('RGB').resize((tw,th),Image.Resampling.LANCZOS);r,col=divmod(i,cols);x=m+col*(tw+gap);y=head+m+r*(th+lh+gap);s.paste(im,(x,y));d.text((x,y+th+7),str(i+1),font=rat_art.resolve_font(20,True),fill=WHITE)
    s.save(out,'JPEG',quality=95)

def scale_sheet(paths,out,tw=288,th=144):
    cols=4;gap=20;m=28;lh=31;rows=2;s=Image.new('RGB',(m*2+cols*tw+(cols-1)*gap,m*2+rows*(th+lh)+(rows-1)*gap),DARK);d=ImageDraw.Draw(s)
    for i,p in enumerate(paths):
        im=Image.open(p).convert('RGB').resize((tw,th),Image.Resampling.LANCZOS);r,col=divmod(i,cols);x=m+col*(tw+gap);y=m+r*(th+lh+gap);s.paste(im,(x,y));d.text((x,y+th+6),str(i+1),font=rat_art.resolve_font(17,True),fill=WHITE)
    s.save(out,'JPEG',quality=96)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--shots',type=Path,required=True);ap.add_argument('--out',type=Path,required=True);x=ap.parse_args();x.out.mkdir(parents=True,exist_ok=True)
    shot=x.shots/'XL_H.png'
    if not shot.is_file(): rat_art.fail(f'missing real capture: {shot}')
    _,cfg,_=rat_art.load_product('pc-power-meter-pro');a=rat_art.parse_accent(cfg.get('accent'))
    funcs=[s1,s2,s3,s4,s5,s6,s7,s8];paths=[]
    for i,f in enumerate(funcs,1):
        p=x.out/f'{i:02d}.png';f(shot,p,a);paths.append(p)
    contact(paths,x.out/'contact-sheet.jpg');scale_sheet(paths,x.out/'fifteen-percent-sheet.jpg')
    print('Rendered 8 bold campaign directions')
if __name__=='__main__': main()
