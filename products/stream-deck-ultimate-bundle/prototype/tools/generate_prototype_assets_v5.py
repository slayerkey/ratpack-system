from pathlib import Path
import argparse, io, json, shutil, uuid, zipfile, sys
from PIL import Image, ImageDraw, ImageFont
import generate_prototype_assets_v4 as v4

BG=v4.BG; FG=v4.FG; SOFT=v4.SOFT; ACCENT=v4.ACCENT
PLUGIN="com.packrat.stream-deck-ultimate-bundle"

def save(im,p): p.parent.mkdir(parents=True,exist_ok=True); im.save(p)

def extra_icons(plugin):
    # Reuse v4's strong monochrome geometry, but give every premium system a distinct face.
    action_defaults={
      "audio":("media","AUDIO","volume-up"),
      "audio-preset":("workspace","MODE",""),
      "routine":("workspace","ROUTINE",""),
      "setup":("system","SETUP","settings"),
    }
    for name,(kind,label,variant) in action_defaults.items():
        out=plugin/"imgs"/"actions"/name; out.mkdir(parents=True,exist_ok=True)
        for size,sfx in ((20,""),(40,"@2x")): save(v4.render_action_icon(kind,variant,size),out/f"icon{sfx}.png")
        for size,sfx in ((72,""),(144,"@2x")): save(v4.render_key(kind,label,variant,size),out/f"key{sfx}.png")

    specs={
      "audio":("media","AUDIO","volume-up"),
      "output":("media","OUT","volume-up"),
      "input":("media","IN","volume-down"),
      "mic-live":("media","MIC","volume-up"),
      "mic-muted":("media","MUTED","mute"),
      "mode-work":("workspace","WORK",""),
      "mode-focus":("workspace","FOCUS",""),
      "mode-meeting":("workspace","MEET",""),
      "mode-gaming":("workspace","GAME",""),
      "focus":("workspace","FOCUS",""),
      "meeting":("app","MEET",""),
      "gaming":("app","GAME",""),
      "setup":("system","SETUP","settings"),
    }
    for name,(kind,label,variant) in specs.items():
        for size,sfx in ((72,""),(144,"@2x")): save(v4.render_key(kind,label,variant,size),plugin/"imgs"/"keys"/f"{name}{sfx}.png")
    for name,label in {"switched":"SWITCHED","applied":"APPLIED","started":"STARTED"}.items():
        for size,sfx in ((72,""),(144,"@2x")): save(v4.render_key("system",label,"settings",size),plugin/"imgs"/"status"/f"{name}{sfx}.png")

def act(slug,settings,image,display):
    return v4.action(slug,settings,image,display)

def enc(slug,settings,display):
    return {
      "ActionID":str(uuid.uuid4()),"LinkedTitle":False,"Name":display,"UUID":f"{PLUGIN}.{slug}","Settings":settings,
      "State":0,"States":[{"Title":"","ShowTitle":False,"TitleAlignment":"bottom","TitleColor":"#FFFFFF","FontFamily":"Arial","FontSize":10,"FontStyle":"Bold","FontUnderline":False}]
    }

def standard_specs():
    home={
      "0,0":act("routine",{"mode":"work"},"work","Work"),
      "1,0":act("smart-app",{"role":"browser","behavior":"focus"},"web","Web"),
      "2,0":act("smart-app",{"role":"discord","behavior":"focus"},"discord","Discord"),
      "3,0":act("smart-app",{"role":"spotify","behavior":"focus"},"spotify","Spotify"),
      "4,0":act("capture",{"mode":"region"},"shot","Capture"),
      "0,1":act("routine",{"mode":"focus"},"focus","Focus"),
      "1,1":act("routine",{"mode":"meeting"},"meeting","Meeting"),
      "2,1":act("audio",{"mode":"mic-toggle"},"mic-live","Mic"),
      "3,1":act("audio",{"mode":"output-cycle"},"output","Output"),
      "4,1":act("navigation",{"profile":"profiles/Stream Deck Ultimate - Audio & Modes"},"audio","Audio"),
      "0,2":act("clipboard",{"mode":"slot","slot":1},"clip1","Clipboard"),
      "1,2":act("media",{"mode":"play-pause"},"play","Play Pause"),
      "2,2":act("navigation",{"profile":"profiles/Stream Deck Ultimate - Windows"},"windows","Windows"),
      "3,2":act("navigation",{"profile":"profiles/Stream Deck Ultimate - Utilities"},"utilities","Utilities"),
      "4,2":act("setup",{},"setup","Setup"),
    }
    windows={
      "0,0":act("window",{"mode":"left"},"left","Left"),"1,0":act("window",{"mode":"right"},"right","Right"),"2,0":act("window",{"mode":"maximize"},"max","Max"),"3,0":act("window",{"mode":"restore"},"restore","Restore"),"4,0":act("navigation",{"profile":"profiles/Stream Deck Ultimate - Home"},"home","Home"),
      "0,1":act("window",{"mode":"top-left"},"top-left","Top Left"),"1,1":act("window",{"mode":"top-right"},"top-right","Top Right"),"2,1":act("window",{"mode":"center"},"center","Center"),"3,1":act("window",{"mode":"bottom-left"},"bottom-left","Bottom Left"),"4,1":act("window",{"mode":"bottom-right"},"bottom-right","Bottom Right"),
      "0,2":act("window",{"mode":"minimize"},"minimize","Minimize"),"1,2":act("window",{"mode":"topmost"},"topmost","Always On Top"),"2,2":act("window",{"mode":"next-monitor"},"screen","Next Screen"),"3,2":act("routine",{"mode":"work"},"work","Work"),"4,2":act("navigation",{"profile":"profiles/Stream Deck Ultimate - Audio & Modes"},"audio","Audio")
    }
    utilities={
      "0,0":act("capture",{"mode":"region"},"shot","Region"),"1,0":act("capture",{"mode":"full"},"shot-full","Full Screen"),"2,0":act("capture",{"mode":"window"},"shot-window","Active Window"),"3,0":act("capture",{"mode":"folder"},"shots-folder","Screenshots"),"4,0":act("navigation",{"profile":"profiles/Stream Deck Ultimate - Home"},"home","Home"),
      "0,1":act("clipboard",{"mode":"slot","slot":1},"clip1","Clip 1"),"1,1":act("clipboard",{"mode":"slot","slot":2},"clip2","Clip 2"),"2,1":act("clipboard",{"mode":"slot","slot":3},"clip3","Clip 3"),"3,1":act("clipboard",{"mode":"slot","slot":4},"clip4","Clip 4"),"4,1":act("clipboard",{"mode":"clear"},"clip-clear","Clear Clipboard"),
      "0,2":act("snippet",{"text":"","restoreClipboard":True},"snippet","Snippet"),"1,2":act("media",{"mode":"previous"},"previous","Previous"),"2,2":act("media",{"mode":"play-pause"},"play","Play Pause"),"3,2":act("media",{"mode":"next"},"next","Next"),"4,2":act("system",{"mode":"desktop"},"desktop","Desktop")
    }
    audio={
      "0,0":act("audio",{"mode":"mic-toggle"},"mic-live","Mic"),"1,0":act("audio",{"mode":"output-cycle"},"output","Output"),"2,0":act("audio",{"mode":"input-cycle"},"input","Input"),"3,0":act("media",{"mode":"volume-down"},"vol-down","Volume Down"),"4,0":act("media",{"mode":"volume-up"},"vol-up","Volume Up"),
      "0,1":act("audio-preset",{"mode":"work"},"mode-work","Work Audio"),"1,1":act("audio-preset",{"mode":"focus"},"mode-focus","Focus Audio"),"2,1":act("audio-preset",{"mode":"meeting"},"mode-meeting","Meeting Audio"),"3,1":act("audio-preset",{"mode":"gaming"},"mode-gaming","Gaming Audio"),"4,1":act("setup",{},"setup","Setup"),
      "0,2":act("routine",{"mode":"work"},"work","Work"),"1,2":act("routine",{"mode":"focus"},"focus","Focus"),"2,2":act("routine",{"mode":"meeting"},"meeting","Meeting"),"3,2":act("routine",{"mode":"gaming"},"gaming","Gaming"),"4,2":act("navigation",{"profile":"profiles/Stream Deck Ultimate - Home"},"home","Home")
    }
    return [
      ("Stream Deck Ultimate - Home",home,5,3,0),
      ("Stream Deck Ultimate - Windows",windows,5,3,0),
      ("Stream Deck Ultimate - Utilities",utilities,5,3,0),
      ("Stream Deck Ultimate - Audio & Modes",audio,5,3,0),
    ]

def xl_spec():
    s={}
    entries=[
      ("routine",{"mode":"work"},"work","WORK"),("smart-app",{"role":"browser"},"web","WEB"),("smart-app",{"role":"discord"},"discord","DISCORD"),("smart-app",{"role":"spotify"},"spotify","SPOTIFY"),("capture",{"mode":"region"},"shot","SHOT"),("clipboard",{"mode":"slot","slot":1},"clip1","CLIP 1"),("media",{"mode":"play-pause"},"play","PLAY"),("setup",{},"setup","SETUP"),
      ("routine",{"mode":"focus"},"focus","FOCUS"),("routine",{"mode":"meeting"},"meeting","MEET"),("audio",{"mode":"mic-toggle"},"mic-live","MIC"),("audio",{"mode":"output-cycle"},"output","OUTPUT"),("audio",{"mode":"input-cycle"},"input","INPUT"),("audio-preset",{"mode":"work"},"mode-work","WORK MODE"),("audio-preset",{"mode":"meeting"},"mode-meeting","MEET MODE"),("audio-preset",{"mode":"gaming"},"mode-gaming","GAME MODE"),
      ("window",{"mode":"left"},"left","LEFT"),("window",{"mode":"right"},"right","RIGHT"),("window",{"mode":"maximize"},"max","MAX"),("window",{"mode":"restore"},"restore","RESTORE"),("window",{"mode":"center"},"center","CENTER"),("window",{"mode":"next-monitor"},"screen","SCREEN"),("window",{"mode":"minimize"},"minimize","MIN"),("window",{"mode":"topmost"},"topmost","PIN"),
      ("clipboard",{"mode":"slot","slot":2},"clip2","CLIP 2"),("clipboard",{"mode":"slot","slot":3},"clip3","CLIP 3"),("clipboard",{"mode":"slot","slot":4},"clip4","CLIP 4"),("clipboard",{"mode":"clear"},"clip-clear","CLEAR"),("snippet",{"text":"","restoreClipboard":True},"snippet","SNIP"),("system",{"mode":"desktop"},"desktop","DESKTOP"),("system",{"mode":"task"},"task","TASK"),("system",{"mode":"settings"},"settings","SETTINGS")
    ]
    for i,(slug,settings,img,name) in enumerate(entries): s[f"{i%8},{i//8}"]=act(slug,settings,img,name)
    return ("Stream Deck Ultimate - XL",s,8,4,2)

def plus_spec():
    keys={
      "0,0":act("routine",{"mode":"work"},"work","Work"),"1,0":act("routine",{"mode":"focus"},"focus","Focus"),"2,0":act("routine",{"mode":"meeting"},"meeting","Meeting"),"3,0":act("audio",{"mode":"mic-toggle"},"mic-live","Mic"),
      "0,1":act("smart-app",{"role":"browser"},"web","Web"),"1,1":act("clipboard",{"mode":"slot","slot":1},"clip1","Clipboard"),"2,1":act("capture",{"mode":"region"},"shot","Capture"),"3,1":act("setup",{},"setup","Setup")
    }
    encoders={
      "0,0":enc("audio",{"mode":"volume-dial"},"Master Volume"),
      "1,0":enc("audio",{"mode":"output-cycle"},"Output Device"),
      "2,0":enc("audio",{"mode":"input-cycle"},"Input Device"),
      "3,0":enc("audio",{"mode":"mic-volume-dial"},"Mic Level"),
    }
    return ("Stream Deck Ultimate - Plus",keys,4,2,7,encoders)

def neo_spec():
    keys={
      "0,0":act("routine",{"mode":"work"},"work","Work"),"1,0":act("routine",{"mode":"focus"},"focus","Focus"),"2,0":act("routine",{"mode":"meeting"},"meeting","Meeting"),"3,0":act("audio",{"mode":"mic-toggle"},"mic-live","Mic"),
      "0,1":act("smart-app",{"role":"browser"},"web","Web"),"1,1":act("audio",{"mode":"output-cycle"},"output","Output"),"2,1":act("clipboard",{"mode":"slot","slot":1},"clip1","Clipboard"),"3,1":act("setup",{},"setup","Setup")
    }
    return ("Stream Deck Ultimate - Neo",keys,4,2,9)

def build_profile(plugin,name,key_spec,cols,rows,device_type,encoder_spec=None):
    root_id=str(uuid.uuid4()).upper();page_id=str(uuid.uuid4());folder_id=v4.profile_folder_id(page_id);root=f"{root_id}.sdProfile"
    key_actions={};images={}
    for coord,item in key_spec.items():
        item=dict(item);image=item.pop("_image");key_actions[coord]=item;images[coord]=Image.open(plugin/"imgs"/"keys"/f"{image}.png").convert("RGBA")
    controllers=[{"Actions":key_actions,"Type":"Keypad"}]
    if encoder_spec: controllers.append({"Actions":encoder_spec,"Type":"Encoder"})
    top={"Name":name,"Pages":{"Current":page_id,"Pages":[page_id]},"Version":"2.0"}
    page={"Controllers":controllers}
    target=plugin/"profiles"/f"{name}.streamDeckProfile"
    with zipfile.ZipFile(target,"w",zipfile.ZIP_DEFLATED) as z:
        z.writestr(f"{root}/manifest.json",json.dumps(top,separators=(",",":")))
        z.writestr(f"{root}/Profiles/{folder_id}/manifest.json",json.dumps(page,separators=(",",":")))
        for coord,im in images.items():
            b=io.BytesIO();im.save(b,"PNG");z.writestr(f"{root}/Profiles/{folder_id}/{coord}/CustomImages/state0.png",b.getvalue())
    validate(target,page_id,folder_id,len(key_spec),len(encoder_spec or {}))
    return target

def validate(target,page_id,folder_id,key_count,encoder_count=0):
    with zipfile.ZipFile(target) as z:
        names=z.namelist();root=next(iter({n.split("/")[0] for n in names if "/" in n}))
        top=json.loads(z.read(f"{root}/manifest.json"));assert top["Pages"]["Current"]==page_id and top["Version"]=="2.0"
        page=json.loads(z.read(f"{root}/Profiles/{folder_id}/manifest.json"));kp=next(c for c in page["Controllers"] if c["Type"]=="Keypad");assert len(kp["Actions"])==key_count
        if encoder_count: en=next(c for c in page["Controllers"] if c["Type"]=="Encoder");assert len(en["Actions"])==encoder_count
        for coord in kp["Actions"]: assert f"{root}/Profiles/{folder_id}/{coord}/CustomImages/state0.png" in names

def preview(plugin,name,spec,cols,rows,out):
    gap=12;cell=144;canvas=Image.new("RGBA",(cols*cell+(cols-1)*gap,rows*cell+(rows-1)*gap),(24,26,30,255))
    for coord,item in spec.items():
        x,y=map(int,coord.split(","));img=Image.open(plugin/"imgs"/"keys"/f"{item['_image']}.png").convert("RGBA").resize((cell,cell),Image.Resampling.LANCZOS);canvas.alpha_composite(img,(x*(cell+gap),y*(cell+gap)))
    out.parent.mkdir(parents=True,exist_ok=True);canvas.save(out)

def main():
    ap=argparse.ArgumentParser();ap.add_argument("plugin",type=Path);ns=ap.parse_args();plugin=ns.plugin.resolve()
    v4.generate_icons(plugin);extra_icons(plugin)
    profiles=plugin/"profiles";shutil.rmtree(profiles,ignore_errors=True);profiles.mkdir(parents=True,exist_ok=True)
    prev=plugin.parent/"previews";shutil.rmtree(prev,ignore_errors=True);prev.mkdir(parents=True,exist_ok=True)
    all_specs=list(standard_specs())+[xl_spec(),plus_spec(),neo_spec()]
    for spec in all_specs:
        name,key_spec,cols,rows,device_type,*rest=spec;encoders=rest[0] if rest else None
        build_profile(plugin,name,key_spec,cols,rows,device_type,encoders)
        preview(plugin,name,key_spec,cols,rows,prev/(name.lower().replace(" ","-").replace("&","and")+".png"))
    print(f"generated {len(all_specs)} premium profiles: standard x4, XL, Plus, Neo")

if __name__=="__main__":main()
