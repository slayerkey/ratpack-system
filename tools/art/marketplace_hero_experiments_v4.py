#!/usr/bin/env python3
"""Six PackRat Marketplace Style Lab V4 hero directions.

Review-only. Uses the real PC Power Meter Pro capture for the foreground product.
Optional --backgrounds may contain owned/licensed/generated environmental images.
If none are present, deterministic synthetic desk/office scenes are used as composition mockups.
"""
from __future__ import annotations
import argparse, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import rat_art

W,H=rat_art.W,rat_art.H
DARK=(7,9,14)
WHITE=(255,255,255)

def logo(max_size=52):
    im=rat_art._logo_image(max_size)
    if im is None: rat_art.fail('PackRat logo missing')
    return im

def mark(c,x,y,s=50): c.alpha_composite(logo(s),(x,y))

def device(shot,box=(1260,560)): return rat_art.render_device(shot,box)

def fit_title(d,text,width,max_size=178,min_size=112):
    return rat_art.fit_font(d,text,width,max_size,min_size,bold=True)

def title_right(d,text,box,fill=WHITE,boxed=True,accent=(242,177,75),bottom=False):
    x1,y1,x2,y2=box
    if boxed:
        d.rounded_rectangle(box,34,fill=(7,9,14,226),outline=(*accent,170),width=3)
    f=fit_title(d,text,x2-x1-70,176,108)
    anchor='rs' if bottom else 'ra'
    x=x2-34
    y=y2-30 if bottom else y1+34
    d.text((x,y),text,font=f,fill=(*fill,255),anchor=anchor,spacing=0)

def crop_cover(im):
    im=im.convert('RGB'); scale=max(W/im.width,H/im.height)
    im=im.resize((int(im.width*scale),int(im.height*scale)),Image.Resampling.LANCZOS)
    l=(im.width-W)//2;t=(im.height-H)//2
    return im.crop((l,t,l+W,t+H)).convert('RGBA')

def env_asset(bgdir,keywords):
    if not bgdir or not bgdir.exists(): return None
    files=[]
    for ext in ('*.png','*.jpg','*.jpeg','*.webp'):
        files.extend(bgdir.rglob(ext))
    for key in keywords:
        for p in files:
            if key.lower() in p.stem.lower(): return p
    return files[0] if files else None

def photo_bg(bgdir,keywords,brightness=.65,blur=4,sat=1.08):
    p=env_asset(bgdir,keywords)
    if not p: return None
    im=crop_cover(Image.open(p))
    im=ImageEnhance.Color(im).enhance(sat)
    im=ImageEnhance.Brightness(im).enhance(brightness)
    if blur: im=im.filter(ImageFilter.GaussianBlur(blur))
    return im

def synthetic_office(mode,accent):
    c=Image.new('RGBA',(W,H),(24,27,31,255));d=ImageDraw.Draw(c)
    if mode=='day':
        d.rectangle((0,0,W,H),fill=(213,218,216,255));
        d.rectangle((0,0,680,650),fill=(185,213,226,255));d.rectangle((54,54,626,594),outline=(247,250,249,220),width=20)
        d.rectangle((0,650,W,H),fill=(146,113,82,255));d.rectangle((0,628,W,660),fill=(75,62,51,255))
        d.ellipse((1360,-240,2180,570),fill=(*accent,70))
    elif mode=='night':
        d.rectangle((0,0,W,H),fill=(9,12,20,255));d.rectangle((0,680,W,H),fill=(30,22,27,255))
        d.rectangle((130,150,800,570),fill=(17,22,33,255),outline=(92,120,180,180),width=5)
        d.rectangle((190,205,740,515),fill=(34,20,62,255));d.ellipse((1240,30,2110,800),fill=(172,55,255,45))
        d.ellipse((-220,100,760,1080),fill=(*accent,45))
    else:
        d.rectangle((0,0,W,H),fill=(35,31,29,255));d.rectangle((0,690,W,H),fill=(62,43,31,255))
        d.rectangle((90,90,720,610),fill=(18,19,22,255));d.rectangle((140,140,670,560),fill=(52,46,39,255))
        d.ellipse((1250,-150,2080,690),fill=(255,170,88,60));d.rectangle((1490,170,1540,600),fill=(255,190,108,90))
    # desk silhouettes and monitor for environmental context
    d.rounded_rectangle((150,600,1760,735),24,fill=(40,35,33,255))
    d.rounded_rectangle((330,335,960,620),18,fill=(15,17,21,255),outline=(255,255,255,35),width=3)
    d.rectangle((610,620,675,700),fill=(20,22,25,255));d.rectangle((520,695,770,715),fill=(20,22,25,255))
    return c.filter(ImageFilter.GaussianBlur(2))

def background(bgdir,mode,accent):
    keys={'day':['day','clean','desk'],'night':['night','rgb','creator'],'studio':['studio','office','warm']}[mode]
    p=photo_bg(bgdir,keys,.72 if mode=='day' else .46,3 if mode=='day' else 6,1.15)
    return p if p is not None else synthetic_office(mode,accent)

def product(c,shot,x=80,y=285,box=(1240,570),shadow=True):
    p=device(shot,box)
    if shadow:
        sh=Image.new('RGBA',(W,H),(0,0,0,0));sd=ImageDraw.Draw(sh);sd.ellipse((x+70,y+p.height-25,x+p.width-10,y+p.height+85),fill=(0,0,0,105));c.alpha_composite(sh.filter(ImageFilter.GaussianBlur(35)))
    c.alpha_composite(p,(x,y));return p

def veil(c,color=(0,0,0,70)): return Image.alpha_composite(c,Image.new('RGBA',(W,H),color))
def save(c,p): c.convert('RGB').save(p,'PNG',optimize=True)

# 1 Clean daylight desk. Photographic/environment lane, top-right.
def s1(shot,out,a,bg):
    c=background(bg,'day',a);c=veil(c,(255,255,255,18));d=ImageDraw.Draw(c)
    d.polygon([(1260,0),(W,0),(W,H),(1510,H)],fill=(245,244,239,205))
    mark(c,62,55,48);product(c,shot,70,300,(1280,565))
    title_right(d,'PC POWER\nMETER',(1240,85,1865,400),(20,22,25),False,a)
    d.rectangle((1320,420,1858,434),fill=(*a,255));save(c,out)

# 2 Creator desk at night. Environmental lane, bottom-right.
def s2(shot,out,a,bg):
    c=background(bg,'night',a);c=veil(c,(3,5,12,50));
    glow=Image.new('RGBA',(W,H),(0,0,0,0));gd=ImageDraw.Draw(glow);gd.ellipse((850,150,2150,1180),fill=(163,52,255,75));c=Image.alpha_composite(c,glow.filter(ImageFilter.GaussianBlur(110)))
    d=ImageDraw.Draw(c);mark(c,62,55,48);product(c,shot,55,235,(1320,590))
    title_right(d,'PC POWER\nMETER',(1210,555,1870,900),WHITE,True,a,True);save(c,out)

# 3 Premium studio office. Environmental lane, top-right with warm campaign lighting.
def s3(shot,out,a,bg):
    c=background(bg,'studio',a);c=veil(c,(5,4,4,78));
    light=Image.new('RGBA',(W,H),(0,0,0,0));ld=ImageDraw.Draw(light);ld.polygon([(1100,0),(1690,0),(1180,H),(620,H)],fill=(255,190,105,42));c=Image.alpha_composite(c,light.filter(ImageFilter.GaussianBlur(35)))
    d=ImageDraw.Draw(c);mark(c,62,55,48);product(c,shot,70,300,(1260,560))
    title_right(d,'PC POWER\nMETER',(1230,70,1870,395),WHITE,True,a);save(c,out)

# 4 First-party launch language. Marketplace-inspired, not copied from any listing.
def s4(shot,out,a,bg):
    c=Image.new('RGBA',(W,H),(238,241,243,255));d=ImageDraw.Draw(c)
    d.ellipse((-380,210,1050,1500),fill=(*a,220));d.rectangle((1420,0,W,H),fill=(20,23,28,255));d.polygon([(1110,0),(1510,0),(1270,H),(870,H)],fill=(255,255,255,150))
    mark(c,58,54,48);product(c,shot,60,285,(1290,570))
    title_right(d,'PC POWER\nMETER',(1220,80,1870,405),WHITE,False,a)
    d.text((1835,445),'PRO',font=rat_art.resolve_font(40,True),fill=(*a,255),anchor='ra');save(c,out)

# 5 Bold marketplace promo card. Strong graphic design and bottom-right hierarchy.
def s5(shot,out,a,bg):
    c=Image.new('RGBA',(W,H),(*a,255));d=ImageDraw.Draw(c)
    d.polygon([(0,0),(1250,0),(820,H),(0,H)],fill=(10,12,17,255));d.ellipse((1190,-300,2260,780),fill=(255,82,168,205));d.ellipse((1370,420,2180,1230),fill=(255,211,82,225))
    d.rounded_rectangle((1170,525,1880,910),45,fill=(7,9,14,238),outline=(255,255,255,80),width=3)
    mark(c,62,55,48);product(c,shot,45,240,(1300,585))
    title_right(d,'PC POWER\nMETER',(1200,555,1845,880),WHITE,False,a,True);save(c,out)

# 6 Editorial product campaign. Photo/graphic hybrid with large top-right type.
def s6(shot,out,a,bg):
    base=background(bg,'day',a);base=ImageEnhance.Color(base).enhance(.55);base=veil(base,(235,225,215,40));c=base;d=ImageDraw.Draw(c)
    d.rectangle((0,0,W,185),fill=(18,20,24,235));d.rectangle((1510,185,W,H),fill=(*a,205));d.polygon([(1070,185),(1510,185),(1250,H),(790,H)],fill=(255,255,255,150))
    huge=rat_art.fit_font(d,'POWER',1800,300,210,bold=True);d.text((1880,910),'POWER',font=huge,fill=(18,20,24,28),anchor='rs')
    mark(c,58,55,48);product(c,shot,45,295,(1280,565))
    title_right(d,'PC POWER\nMETER',(1210,220,1870,535),(18,20,24),False,a);save(c,out)

def contact(paths,out):
    tw,th=720,360;cols=2;gap=28;m=34;lh=44;head=72;rows=3
    s=Image.new('RGB',(m*2+cols*tw+gap,head+m+rows*(th+lh)+(rows-1)*gap+m),DARK);d=ImageDraw.Draw(s)
    d.text((m,22),'PackRat Marketplace Style Lab V4 — environment + marketplace inspiration',font=rat_art.resolve_font(28,True),fill=WHITE)
    names=['Daylight Desk','Creator Night Desk','Premium Studio Office','First-party Launch','Bold Promo Card','Editorial Campaign']
    for i,p in enumerate(paths):
        im=Image.open(p).convert('RGB').resize((tw,th),Image.Resampling.LANCZOS);r,col=divmod(i,cols);x=m+col*(tw+gap);y=head+m+r*(th+lh+gap);s.paste(im,(x,y));d.text((x,y+th+7),f'{i+1}. {names[i]}',font=rat_art.resolve_font(18,True),fill=WHITE)
    s.save(out,'JPEG',quality=95)

def scale_sheet(paths,out):
    tw,th=288,144;cols=3;gap=24;m=30;lh=32;rows=2
    s=Image.new('RGB',(m*2+cols*tw+(cols-1)*gap,m*2+rows*(th+lh)+(rows-1)*gap),DARK);d=ImageDraw.Draw(s)
    for i,p in enumerate(paths):
        im=Image.open(p).convert('RGB').resize((tw,th),Image.Resampling.LANCZOS);r,col=divmod(i,cols);x=m+col*(tw+gap);y=m+r*(th+lh+gap);s.paste(im,(x,y));d.text((x,y+th+6),str(i+1),font=rat_art.resolve_font(17,True),fill=WHITE)
    s.save(out,'JPEG',quality=96)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--shots',type=Path,required=True);ap.add_argument('--out',type=Path,required=True);ap.add_argument('--backgrounds',type=Path);x=ap.parse_args();x.out.mkdir(parents=True,exist_ok=True)
    shot=x.shots/'XL_H.png'
    if not shot.is_file(): rat_art.fail(f'missing real capture: {shot}')
    _,cfg,_=rat_art.load_product('pc-power-meter-pro');a=rat_art.parse_accent(cfg.get('accent'))
    funcs=[s1,s2,s3,s4,s5,s6];paths=[]
    for i,f in enumerate(funcs,1):
        p=x.out/f'{i:02d}.png';f(shot,p,a,x.backgrounds);paths.append(p)
    contact(paths,x.out/'contact-sheet.jpg');scale_sheet(paths,x.out/'fifteen-percent-sheet.jpg')
    print('Rendered 6 Marketplace Style Lab V4 directions')
if __name__=='__main__': main()
