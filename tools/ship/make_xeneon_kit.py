"""Build a self-contained Maker Console SHIP_KIT for one XENEON widget."""
import argparse, json, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

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
    if not pkg.is_file(): fail(f"missing official package: {pkg}")
    if not meta_path.is_file(): fail(f"missing structured submission metadata: {meta_path}")
    if not manifest_path.is_file(): fail(f"missing widget manifest: {manifest_path}")
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

1. Product type: **Widget**
2. Upload `{pkg.name}`
3. Name: **{meta['name']}**
4. Price: **${meta['price_usd']:.2f}**
5. Category: **{', '.join(meta['marketplace_category'])}**
6. Dashboard sizes: **{', '.join(meta['marketplace_dashboard_sizes'])}**
7. Language: **{', '.join(meta['marketplace_language'])}**
8. Upload media in numeric filename order.
9. Verify version **{meta['version']}**, auto publish policy, gallery order, and price immediately before Submit.

Use `node tools/ship/maker_console.mjs {slug} --kit=<this folder> --check-kit` before opening Maker Console.
Use `--submit` only after the owner has explicitly approved final submission.
""", encoding="utf-8")
    print(f"RAT SHIP KIT PASS: {out}")

if __name__ == "__main__":
    main()
