#!/usr/bin/env python3
"""Inventory authored XENEON widgets that use browser networking transports."""
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ROOT = REPO / "widgets" / "_src"
URL_RE = re.compile(r"(?:https?|wss?)://[^\"'`\s)]+", re.I)
rows = []

for src in sorted(p for p in ROOT.iterdir() if p.is_dir() and (p / "index.html").exists()):
    files = list(src.glob("*.js")) + list(src.glob("*.mjs")) + [src / "index.html"]
    text = "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in files if p.exists())
    uses_fetch = "fetch(" in text
    uses_ws = "new WebSocket" in text or "WebSocket(" in text
    loopback = "127.0.0.1" in text or "localhost" in text
    urls = sorted(set(URL_RE.findall(text)))
    if not uses_fetch and not uses_ws and not urls:
        continue
    rows.append({
        "product": src.name,
        "http_fetch": uses_fetch,
        "websocket": uses_ws,
        "loopback": loopback,
        "external_urls": urls,
        "packaged_network_smoke": (src / "marketplace-network-smoke.mjs").exists() or (src / "network-smoke.mjs").exists(),
    })

report = {"schema_version": 1, "products": rows}
text = json.dumps(report, indent=2) + "\n"
if len(sys.argv) > 1:
    out = Path(sys.argv[1])
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
print(text, end="")
