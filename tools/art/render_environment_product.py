#!/usr/bin/env python3
"""Render a complete XENEON Rat Art set with an optional environment hero.

This is the integration layer between existing deterministic Rat Art and the
warm-studio environment scene system. It intentionally does not generate any
imagery.

Flow:
1. Run the existing canonical XENEON Rat Art renderer.
2. Read `environment_hero` from the product's `rat-art.json`.
3. Replace only `1-hero.png` using the fixed scene plate, deterministic monitor
   typography, the real captured widget screenshot, and the calibrated XENEON
   hardware plate.
4. Rebuild V2 contact/thumbnail sheets and update the Rat Art report so all
   hashes match the final output.

This keeps the ordinary gallery renderer backward compatible while making the
new hero style product-configurable and CI-friendly.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from PIL import Image

import rat_art
import render_environment_hero

ROOT = Path(__file__).resolve().parents[2]
SCENES = Path(__file__).resolve().parent / "scenes"


def fail(message: str) -> None:
    rat_art.fail(message)


def require_text(value: Any, label: str) -> str:
    return rat_art.require_text(value, label)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def load_environment_config(config: dict[str, Any]) -> dict[str, Any] | None:
    value = config.get("environment_hero")
    if value is None:
        return None
    if not isinstance(value, dict):
        fail("environment_hero must be an object")
    if value.get("enabled") is False:
        return None
    return value


def validate_scene(scene_name: str) -> tuple[Path, Path, Path]:
    scene = SCENES / scene_name
    base = scene / "base.png"
    geometry = scene / "geometry.json"
    title_style = scene / "title-style.json"
    for path in (base, geometry, title_style):
        if not path.is_file():
            fail(f"environment hero scene asset missing: {path}")
    with Image.open(base) as image:
        if image.size != (rat_art.W, rat_art.H):
            fail(f"environment hero base must be exactly {rat_art.W}x{rat_art.H}: {base}")
    return base, geometry, title_style


def render_xeneon(slug: str, shots: Path, out: Path) -> None:
    submission, config, config_path = rat_art.load_product(slug)
    env = load_environment_config(config)

    # Always start from the ordinary canonical output. This preserves every
    # non-hero gallery frame and all existing product/source validation.
    rat_art.render_xeneon(slug, shots, out)

    if env is None:
        print(f"ENVIRONMENT HERO SKIP: {slug} has no enabled environment_hero config")
        return
    if int(config.get("schema_version") or 0) != 2:
        fail("environment_hero currently requires rat-art schema_version 2")

    scene_name = require_text(env.get("scene") or "warm-studio-v1", "environment_hero.scene")
    shot_name = require_text(env.get("shot") or (config.get("hero") or {}).get("shot") or "XL_H.png", "environment_hero.shot")
    title = require_text(env.get("title"), "environment_hero.title")
    accent_title = require_text(env.get("accent_title"), "environment_hero.accent_title")
    subtitle = require_text(env.get("subtitle") or "for XENEON Edge", "environment_hero.subtitle")

    base, geometry, title_style = validate_scene(scene_name)
    shot_path = shots / shot_name
    if not shot_path.is_file():
        fail(f"real XENEON capture missing for environment hero: {shot_path}")

    accent_value = env.get("accent") if env.get("accent") is not None else config.get("accent")
    accent = rat_art.parse_accent(accent_value)

    hero_path = out / "1-hero.png"
    render_environment_hero.render(
        scene_name,
        shot_path,
        hero_path,
        title,
        accent_title,
        subtitle,
        accent,
        bool(env.get("brand", True)),
    )

    # Rebuild sheets because the canonical Rat Art run created them before the
    # environment hero replaced 1-hero.png.
    name = require_text(submission.get("name"), "submission name")
    marketplace_order = rat_art.resolve_marketplace_order(config)
    rat_art.verify_distinct_outputs(out, marketplace_order)
    rat_art.contact_sheet_v2(out, name, marketplace_order)
    rat_art.thumbnail_sheet_v2(out, name)

    report_path = out / "rat-art-report.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    report["design_system"] = f"marketplace-listing-v2+environment:{scene_name}"
    report["footer_branding"] = "environment-scene-anchor"
    report["environment_hero"] = {
        "enabled": True,
        "scene": scene_name,
        "base": str(base.relative_to(ROOT)).replace("\\", "/"),
        "base_sha256": sha256(base),
        "geometry": str(geometry.relative_to(ROOT)).replace("\\", "/"),
        "geometry_sha256": sha256(geometry),
        "title_style": str(title_style.relative_to(ROOT)).replace("\\", "/"),
        "title_style_sha256": sha256(title_style),
        "shot": shot_name,
        "shot_sha256": sha256(shot_path),
        "title": title,
        "accent_title": accent_title,
        "subtitle": subtitle,
        "product_config_sha256": sha256(config_path),
        "image_generation": "disabled",
    }
    report["outputs"] = {
        path.name: {"size": Image.open(path).size, "sha256": sha256(path)}
        for path in sorted(out.glob("*.png"))
    }
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"ENVIRONMENT RAT ART PASS: {slug} -> {hero_path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    xeneon = sub.add_parser("xeneon")
    xeneon.add_argument("slug")
    xeneon.add_argument("--shots", required=True, type=Path)
    xeneon.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    if args.cmd == "xeneon":
        render_xeneon(args.slug, args.shots, args.out)


if __name__ == "__main__":
    main()
