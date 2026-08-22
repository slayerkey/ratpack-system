from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []

required = [
    "RATPACK.md",
    "skills/rat/SKILL.md",
    "skills/rat-validate/SKILL.md",
    "skills/rat-build/SKILL.md",
    "skills/rat-art/SKILL.md",
    "skills/rat-qa/SKILL.md",
    "skills/rat-ship/SKILL.md",
    "skills/icue-widget-builder/SKILL.md",
    "platforms/streamdeck.md",
    "platforms/icue-xeneon.md",
    "standards/product-state.md",
]
for rel in required:
    if not (ROOT / rel).is_file():
        errors.append(f"missing required file: {rel}")

for f in ROOT.rglob("*"):
    if not f.is_file():
        continue
    if f.suffix.lower() in {".ttf", ".otf", ".woff", ".woff2"}:
        errors.append(f"font binary must not be distributed: {f.relative_to(ROOT)}")
    if f.name in {".env", ".env.local"}:
        errors.append(f"credential file must not be distributed: {f.relative_to(ROOT)}")

secret_patterns = [
    re.compile(r"BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY"),
    re.compile(r"gh[pousr]_[A-Za-z0-9_]{20,}"),
    re.compile(r"sk-[A-Za-z0-9]{20,}"),
]
for f in ROOT.rglob("*"):
    if not f.is_file() or f.suffix.lower() not in {".md", ".json", ".yaml", ".yml", ".py", ".txt"}:
        continue
    text = f.read_text(encoding="utf-8", errors="ignore")
    for pattern in secret_patterns:
        if pattern.search(text):
            errors.append(f"possible secret in {f.relative_to(ROOT)}: {pattern.pattern}")

if errors:
    print("FAIL")
    for error in errors:
        print(error)
    sys.exit(1)

print("PASS")
print(f"root={ROOT}")
print(f"files={sum(1 for p in ROOT.rglob('*') if p.is_file())}")
