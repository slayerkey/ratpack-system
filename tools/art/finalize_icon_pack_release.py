#!/usr/bin/env python3
"""Finalize and audit a deterministic PackRat Stream Deck icon-pack review kit.

This runs after the pinned external icon factory has completed its normal build,
QA, marketing, and package-staging steps. It deliberately re-checks the release
properties RatPack depends on instead of trusting historical CI alone:

* exact rendered RGBA duplicates
* the factory's reviewed structural-reuse report
* exact expected product counts
* zero-warning/zero-failure QA
* package icon provenance
* Marketplace search icon provenance

The finalizer writes FACTORY-RELEASE-AUDIT.json into the Rat kit and replaces the
Marketplace search icon with a deterministic 512px raster of the staged product
icon.svg. The staged SVG remains the source of truth.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from collections import defaultdict
from pathlib import Path
from typing import Any

from PIL import Image


def fail(message: str) -> None:
    raise SystemExit(f"RAT ICON RELEASE AUDIT FAIL: {message}")


def read_json(path: Path) -> Any:
    if not path.is_file():
        fail(f"missing required JSON: {path}")
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        fail(f"invalid JSON in {path}: {exc}")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def exact_visual_duplicate_groups(static_dir: Path) -> list[list[str]]:
    if not static_dir.is_dir():
        fail(f"missing static output directory: {static_dir}")
    groups: dict[str, list[str]] = defaultdict(list)
    for path in sorted(static_dir.glob("*.png")):
        with Image.open(path) as image:
            digest = sha256_bytes(image.convert("RGBA").tobytes())
        groups[digest].append(path.stem)
    return sorted(sorted(ids) for ids in groups.values() if len(ids) > 1)


def rasterize_product_icon(svg_path: Path, destination: Path) -> dict[str, Any]:
    if not svg_path.is_file():
        fail(f"staged product icon is missing: {svg_path}")
    svg_bytes = svg_path.read_bytes()
    try:
        import resvg_py
    except ImportError as exc:  # pragma: no cover - factory requirements provide it
        raise SystemExit("RAT ICON RELEASE AUDIT FAIL: resvg_py is required to rasterize the product icon") from exc

    try:
        png_bytes = bytes(
            resvg_py.svg_to_bytes(
                svg_string=svg_bytes.decode("utf-8"),
                width=512,
                height=512,
            )
        )
    except Exception as exc:
        fail(f"could not rasterize staged product icon.svg: {exc}")

    try:
        with Image.open(io.BytesIO(png_bytes)) as image:
            rendered = image.convert("RGBA")
            if rendered.size != (512, 512):
                fail(f"product search icon rendered at {rendered.size}, expected 512x512")
            if rendered.getbbox() is None:
                fail("product search icon rendered completely transparent")
            destination.parent.mkdir(parents=True, exist_ok=True)
            rendered.save(destination, "PNG", optimize=True)
    except OSError as exc:
        fail(f"rasterized product icon is not a valid PNG: {exc}")

    return {
        "source": "package-staging/icon.svg",
        "source_sha256": sha256_bytes(svg_bytes),
        "output": destination.name,
        "output_sha256": sha256_bytes(destination.read_bytes()),
        "width": 512,
        "height": 512,
    }


def expected_int(product: dict[str, Any], key: str) -> int:
    value = product.get(key)
    if isinstance(value, bool) or not isinstance(value, int):
        fail(f"RatPack product spec requires integer {key}")
    return value


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--factory-root", required=True)
    parser.add_argument("--factory-out", required=True)
    parser.add_argument("--product-spec", required=True)
    parser.add_argument("--kit", required=True)
    args = parser.parse_args()

    factory_root = Path(args.factory_root).resolve()
    factory_out = Path(args.factory_out).resolve()
    product_spec_path = Path(args.product_spec).resolve()
    kit = Path(args.kit).resolve()

    product = read_json(product_spec_path)
    slug = str(product.get("id") or "").strip()
    factory_meta = product.get("icon_factory") or {}
    factory_product = str(factory_meta.get("product") or "").strip()
    if product.get("type") != "icon_pack" or not slug or not factory_product:
        fail("product spec is not a complete icon_pack registration")

    expected_static = expected_int(product, "expected_static_icons")
    expected_animated = expected_int(product, "expected_animated_icons")
    expected_picker = expected_int(product, "expected_picker_entries")
    expected_unique = expected_int(product, "expected_unique_glyphs")
    expected_reuse = expected_int(product, "expected_reuse_groups")
    expected_visual_dupes = expected_int(product, "expected_exact_visual_duplicate_groups")

    qa = read_json(factory_out / "qa" / "qa-report.json")
    qa_summary = qa.get("summary") or {}
    qa_failures = int(qa_summary.get("failures", -1))
    qa_warnings = int(qa_summary.get("warnings", -1))
    if not qa.get("pass") or qa_failures != 0 or qa_warnings != 0:
        fail(f"factory QA is not clean: failures={qa_failures}, warnings={qa_warnings}")

    structural = read_json(factory_out / "qa" / "structural-reuse-report.json")
    structural_summary = structural.get("summary") or {}
    selected_count = int(structural_summary.get("selected_count", -1))
    unique_glyphs = int(structural_summary.get("unique_glyphs", -1))
    reuse_groups = int(structural_summary.get("reuse_groups", -1))
    unexpected_groups = int(structural_summary.get("unexpected_groups", -1))
    if not structural.get("pass") or unexpected_groups != 0:
        fail(f"factory structural reuse audit is not clean: unexpected_groups={unexpected_groups}")
    if selected_count != expected_static:
        fail(f"structural selected count drift: expected {expected_static}, got {selected_count}")
    if unique_glyphs != expected_unique:
        fail(f"distinct glyph count drift: expected {expected_unique}, got {unique_glyphs}")
    if reuse_groups != expected_reuse:
        fail(f"structural reuse group drift: expected {expected_reuse}, got {reuse_groups}")

    duplicate_groups = exact_visual_duplicate_groups(factory_out / "static")
    if len(duplicate_groups) != expected_visual_dupes:
        for ids in duplicate_groups:
            print("EXACT VISUAL DUPLICATE:", ", ".join(ids))
        fail(
            "exact RGBA visual duplicate group drift: "
            f"expected {expected_visual_dupes}, got {len(duplicate_groups)}"
        )

    handoff = read_json(factory_out / "marketing" / "rat-art-icons.json")
    static_count = int(handoff.get("actual_icon_count", -1))
    animated_count = int(handoff.get("animated_icon_count", -1))
    staged_entries = read_json(factory_out / "package-staging" / "icons.json")
    if not isinstance(staged_entries, list):
        fail("package-staging/icons.json must contain a list")
    if static_count != expected_static:
        fail(f"static icon count drift: expected {expected_static}, got {static_count}")
    if animated_count != expected_animated:
        fail(f"animated icon count drift: expected {expected_animated}, got {animated_count}")
    if len(staged_entries) != expected_picker:
        fail(f"picker-entry count drift: expected {expected_picker}, got {len(staged_entries)}")

    names = [str(entry.get("name", "")).strip().casefold() for entry in staged_entries]
    paths = [str(entry.get("path", "")).strip().casefold() for entry in staged_entries]
    if len(names) != len(set(names)) or len(paths) != len(set(paths)):
        fail("package staging contains duplicate picker names or paths")

    source_icon = factory_root / "icon-products" / factory_product / "icon.svg"
    staged_icon = factory_out / "package-staging" / "icon.svg"
    if not source_icon.is_file() or not staged_icon.is_file():
        fail("product source icon.svg or staged icon.svg is missing")
    source_icon_bytes = source_icon.read_bytes()
    staged_icon_bytes = staged_icon.read_bytes()
    if source_icon_bytes != staged_icon_bytes:
        fail("staged icon.svg does not match the pinned product source icon.svg")

    search_icon = rasterize_product_icon(staged_icon, kit / "01_search_icon.png")

    result = {
        "schema_version": 1,
        "ratpack_product": slug,
        "factory_product": factory_product,
        "pass": True,
        "counts": {
            "static_icons": static_count,
            "animated_icons": animated_count,
            "picker_entries": len(staged_entries),
        },
        "qa": {
            "failures": qa_failures,
            "warnings": qa_warnings,
        },
        "structural_reuse": {
            "selected_count": selected_count,
            "unique_glyphs": unique_glyphs,
            "reuse_groups": reuse_groups,
            "unexpected_groups": unexpected_groups,
        },
        "exact_visual_duplicates": {
            "groups": len(duplicate_groups),
            "ids": duplicate_groups,
        },
        "package_icon": {
            "source": f"icon-products/{factory_product}/icon.svg",
            "source_sha256": sha256_bytes(source_icon_bytes),
            "staged_sha256": sha256_bytes(staged_icon_bytes),
            "provenance_match": True,
        },
        "search_icon": search_icon,
    }
    output = kit / "FACTORY-RELEASE-AUDIT.json"
    output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        "Icon-pack release audit PASS:",
        f"{static_count} static + {animated_count} animated = {len(staged_entries)} picker entries;",
        f"{unique_glyphs} distinct glyphs; {reuse_groups} reviewed reuse groups;",
        f"{unexpected_groups} unexpected structural groups; {len(duplicate_groups)} exact RGBA duplicate groups",
    )


if __name__ == "__main__":
    main()
