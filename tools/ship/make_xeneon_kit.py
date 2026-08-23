"""Build a self-contained Maker Console SHIP_KIT for one XENEON widget."""
import argparse, json, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLAYWRIGHT_VERSION = "1.62.1"

def fail(msg):
    raise SystemExit(f"RAT SHIP FAIL: {msg}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--package", required=True)
    ap.add_argument("--art", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    slug = args.slug
    pkg = Path(args.package)
    art = Path(args.art)
    out = Path(args.out)
    meta_path = ROOT / "widgets" / "_src" / slug / "submission.json"
    manifest_path = ROOT / "widgets" / slug / "manifest.json"
    driver_path = ROOT / "tools" / "ship" / "maker_console.mjs"
    if not pkg.is_file(): fail(f"missing official package: {pkg}")
    if not meta_path.is_file(): fail(f"missing structured submission metadata: {meta_path}")
    if not manifest_path.is_file(): fail(f"missing widget manifest: {manifest_path}")
    if not driver_path.is_file(): fail(f"missing Maker Console driver: {driver_path}")
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if meta.get("slug") != slug: fail("submission.json slug mismatch")
    if meta.get("type") != "widget": fail("submission.json type must be widget")
    for key in ("name","version","price_usd","marketplace_category","marketplace_dashboard_sizes","marketplace_language","description","release_notes"):
        if key not in meta or meta[key] in (None, "", []): fail(f"submission.json missing {key}")
    if meta["name"] != manifest.get("name") or meta["version"] != manifest.get("version"):
        fail("submission metadata disagrees with manifest name/version")
    required_art = ["1-hero.png","2-showcase.png","3-features.png","4-settings.png","5-sizes.png","icon-288x288.png"]
    missing = [x for x in required_art if not (art / x).is_file()]
    if missing: fail("missing Rat Art output: " + ", ".join(missing))
    if out.exists(): shutil.rmtree(out)
    out.mkdir(parents=True)
    shutil.copy2(pkg, out / pkg.name)
    mapping = {
        "icon-288x288.png": "01_search_icon.png",
        "1-hero.png": "02_cover.png",
        "2-showcase.png": "03_gallery_01.png",
        "3-features.png": "04_gallery_02.png",
        "4-settings.png": "05_gallery_03.png",
        "5-sizes.png": "06_gallery_04.png",
    }
    for src, dst in mapping.items(): shutil.copy2(art / src, out / dst)
    (out / "PASTE_description.txt").write_text(meta["description"].strip() + "\n", encoding="utf-8")
    (out / "PASTE_release_notes.txt").write_text(meta["release_notes"].strip() + "\n", encoding="utf-8")
    public = {k: v for k, v in meta.items() if k not in ("description", "release_notes")}
    (out / "submission.json").write_text(json.dumps(public, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (out / "PASTE_metadata.txt").write_text(
        f"Name: {meta['name']}\nType: Widget\nPrice USD: {meta['price_usd']}\nVersion: {meta['version']}\n"
        f"Category: {', '.join(meta['marketplace_category'])}\n"
        f"Dashboard Sizes: {', '.join(meta['marketplace_dashboard_sizes'])}\n"
        f"Language: {', '.join(meta['marketplace_language'])}\n"
        f"Author: {manifest.get('author')}\nWidget ID: {manifest.get('id')}\nOS: Windows\n",
        encoding="utf-8")
    (out / "CHECKLIST.md").write_text(f"""# {meta['name']} Maker Console kit

Canonical Rat Ship kit.

Normal release path: run `rat ship {slug}`. Rat Ship builds this kit and then submits it through the persistent local Maker Console browser profile.

Manual fallback contents:

1. Product type: **Widget**
2. Upload `{pkg.name}`
3. Name: **{meta['name']}**
4. Price: **${meta['price_usd']:.2f}**
5. Category: **{', '.join(meta['marketplace_category'])}**
6. Dashboard sizes: **{', '.join(meta['marketplace_dashboard_sizes'])}**
7. Language: **{', '.join(meta['marketplace_language'])}**
8. Upload media in numeric filename order.
9. Verify version **{meta['version']}**, auto publish policy, gallery order, and price immediately before Submit.

`SUBMIT_NOW.cmd` is a double click friendly portable fallback. `SUBMIT_NOW.ps1` contains the same fallback logic for PowerShell. The normal `rat ship` command is faster because it reuses the repository level browser runtime instead of installing dependencies inside every generated kit.
""", encoding="utf-8")

    # Portable authenticated fallback. Normal local shipping uses the shared
    # repository runtime through `rat ship`, so repeated releases do not reinstall
    # Playwright inside every generated kit.
    shutil.copy2(driver_path, out / "maker_console.mjs")
    (out / "package.json").write_text(json.dumps({
        "name": "ratpack-maker-console-bridge",
        "private": True,
        "type": "module",
        "devDependencies": {"playwright": PLAYWRIGHT_VERSION}
    }, indent=2) + "\n", encoding="utf-8")
    (out / "SUBMIT_NOW.ps1").write_text(f'''$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {{ throw "Node.js is required" }}
if (-not (Test-Path .\\node_modules\\playwright)) {{ npm install --no-fund --no-audit }}
if ($LASTEXITCODE -ne 0) {{ throw "Could not install Playwright" }}
npx playwright install chromium
if ($LASTEXITCODE -ne 0) {{ throw "Could not install Chromium" }}
$Profile = Join-Path $env:LOCALAPPDATA "PackRat\\maker-console-profile"
node .\\maker_console.mjs {slug} "--kit=$PSScriptRoot" "--profile=$Profile" --submit
if ($LASTEXITCODE -ne 0) {{ exit $LASTEXITCODE }}
''', encoding="utf-8")
    (out / "STAGE_ONLY.ps1").write_text(f'''$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Test-Path .\\node_modules\\playwright)) {{ npm install --no-fund --no-audit }}
if ($LASTEXITCODE -ne 0) {{ throw "Could not install Playwright" }}
npx playwright install chromium
if ($LASTEXITCODE -ne 0) {{ throw "Could not install Chromium" }}
$Profile = Join-Path $env:LOCALAPPDATA "PackRat\\maker-console-profile"
node .\\maker_console.mjs {slug} "--kit=$PSScriptRoot" "--profile=$Profile"
if ($LASTEXITCODE -ne 0) {{ exit $LASTEXITCODE }}
''', encoding="utf-8")
    (out / "SUBMIT_NOW.cmd").write_text('''@echo off\r\npowershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0SUBMIT_NOW.ps1"\r\nif errorlevel 1 pause\r\n''', encoding="utf-8")
    (out / "STAGE_ONLY.cmd").write_text('''@echo off\r\npowershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0STAGE_ONLY.ps1"\r\nif errorlevel 1 pause\r\n''', encoding="utf-8")
    print(f"RAT SHIP KIT PASS: {out}")

if __name__ == "__main__":
    main()
