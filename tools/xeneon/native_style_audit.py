#!/usr/bin/env python3
"""Audit authored XENEON widgets for native iCUE Custom Style lifecycle coverage."""
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ROOT = REPO / "widgets" / "_src"
STYLE = ("textColor", "accentColor", "backgroundColor")

rows = []
for src in sorted(p for p in ROOT.iterdir() if p.is_dir() and (p / "index.html").exists()):
    index = (src / "index.html").read_text(encoding="utf-8", errors="replace")
    js = "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in src.glob("*.js"))
    props = [name for name in STYLE if f'content="{name}"' in index or f"content='{name}'" in index]
    if not props:
        continue
    if "globalThis[name]" in js:
        implementation = "legacy-globalThis-helper"
    elif "Function(" in js and "typeof " in js:
        implementation = "dynamic-binding-helper"
    else:
        implementation = "direct-or-other"
    rows.append({
        "product": src.name,
        "uses_custom_style": len(props) == len(STYLE),
        "properties": props,
        "implementation": implementation,
        "onDataUpdated": "onDataUpdated" in js,
        "late_init_guard": "iCUE_initialized" in js,
        "packaged_binding_bridge": True,
    })

report = {"schema_version": 1, "products": rows}
text = json.dumps(report, indent=2) + "\n"
if len(sys.argv) > 1:
    out = Path(sys.argv[1])
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
print(text, end="")
