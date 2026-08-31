#!/usr/bin/env python3
from __future__ import annotations

import argparse
import runpy
from pathlib import Path

BASE = Path(__file__).with_name("rat-art.py")
ns = runpy.run_path(str(BASE), run_name="rat_art_base")
Image = ns["Image"]
ImageDraw = ns["ImageDraw"]


def features(out):
    img = ns["background"]()
    ns["title"](img, "The states you actually care about", "A dashboard that changes with the call instead of a wall of generic member dots.")
    d = ImageDraw.Draw(img)
    examples = [
        ("CURRENT CHANNEL", {"label": "VC1", "state": "4 MEMBERS", "icon": "channel", "accent": ns["DISCORD"]}, "Know which room\nyou're in."),
        ("SPEAKER SPOTLIGHT", {"label": "ALEX", "state": "SPEAKING", "avatar": ns["AVATAR_COLORS"][0], "speaking": True}, "Active speaker,\ninstantly obvious."),
        ("VOICE STATE", {"label": "MUGZEY", "state": "DEAFENED", "avatar": ns["AVATAR_COLORS"][3], "active": True}, "Mute and deafen\nread instantly."),
        ("CONNECTION", {"label": "VOICE DECK", "state": "READY", "icon": "ready"}, "Discord connected\nand ready."),
    ]
    for i, (heading, spec, desc) in enumerate(examples):
        x = 125 + i * 445
        d.rounded_rectangle((x, 255, x + 390, 710), 30, fill=(*ns["PANEL"], 235), outline=(48, 57, 70), width=2)
        ns["key"](d, x + 90, 310, size=210, **spec)
        d.text((x + 195, 570), heading, font=ns["font"](21, True), fill=ns["ACCENT"] if i == 1 else ns["WHITE"], anchor="mm")
        d.multiline_text((x + 195, 618), desc, font=ns["font"](16), fill=ns["MUTED"], anchor="ma", align="center", spacing=5)
    ns["signature"](img)
    img.convert("RGB").save(out / "03_gallery_01.png", quality=95)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--destination", required=True)
    args = parser.parse_args()
    out = Path(args.destination)
    out.mkdir(parents=True, exist_ok=True)
    ns["search_icon"](out)
    ns["hero"](out)
    features(out)
    ns["dashboard"](out)
    ns["spotlight"](out)
    ns["compatibility"](out)
    required = ["01_search_icon.png", "02_cover.png", "03_gallery_01.png", "04_gallery_02.png", "05_gallery_03.png", "06_gallery_04.png"]
    for name in required:
        path = out / name
        if not path.is_file():
            raise SystemExit(f"Missing Rat Art output: {name}")
        with Image.open(path) as check:
            expected = (288, 288) if name == "01_search_icon.png" else (ns["W"], ns["H"])
            if check.size != expected:
                raise SystemExit(f"Wrong Rat Art size for {name}: {check.size} != {expected}")
    print(f"Voice Deck Rat Art ready: {out}")


if __name__ == "__main__":
    main()
