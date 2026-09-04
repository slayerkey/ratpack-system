import os, argparse
from PIL import Image
BG=(7,9,12,255); LABEL_TOP=110; TARGET_MAX=80; GLYPH_CENTRE_Y=49; MAX_W,MAX_H=100,92; MAX_UPSCALE=1.35; DEADBAND=1.06

def bbox(im):
 px=im.load(); minx,miny,maxx,maxy=im.width,LABEL_TOP,-1,-1
 for y in range(LABEL_TOP):
  for x in range(im.width):
   if px[x,y]!=BG: minx=min(minx,x);maxx=max(maxx,x);miny=min(miny,y);maxy=max(maxy,y)
 return None if maxx<0 else (minx,miny,maxx,maxy)

def main():
 ap=argparse.ArgumentParser();ap.add_argument('keys_dir');ap.add_argument('--apply',action='store_true');ns=ap.parse_args();root=os.path.abspath(ns.keys_dir)
 for n in sorted(os.listdir(root)):
  if not n.endswith('.png') or '@2x' in n: continue
  f=os.path.join(root,n);im=Image.open(f).convert('RGBA')
  if im.size!=(144,144): continue
  b=bbox(im)
  if not b: continue
  minx,miny,maxx,maxy=b;gw,gh=maxx-minx+1,maxy-miny+1;scale=min(TARGET_MAX/float(max(gw,gh)),MAX_UPSCALE,MAX_W/float(gw),MAX_H/float(gh));centred=abs((miny+maxy)/2.0-GLYPH_CENTRE_Y)<=1.5
  if (1/DEADBAND)<=scale<=DEADBAND and centred: continue
  glyph=im.crop((minx,miny,maxx+1,maxy+1));nw,nh=max(1,int(round(gw*scale))),max(1,int(round(gh*scale)));glyph=glyph.resize((nw,nh),Image.Resampling.LANCZOS);out=Image.new('RGBA',(144,144),BG);out.paste(im.crop((0,LABEL_TOP,144,144)),(0,LABEL_TOP));out.paste(glyph,((144-nw)//2,int(round(GLYPH_CENTRE_Y-nh/2.0))),glyph)
  if ns.apply:
   out.save(f);tw=os.path.join(root,n.replace('.png','@2x.png'))
   if os.path.exists(tw): out.save(tw)
if __name__=='__main__':main()
