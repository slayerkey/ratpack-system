#!/usr/bin/env python3
"""Audit PackRat marketplace registry entries against canonical repository source.

This tool does not decide whether the registry equals the live Elgato catalog.
It answers a narrower safety question: for each registry product, does this
repository currently contain a plausible canonical source directory that can be
inspected before regenerating marketplace media?

Use a Maker Console Published export separately to reconcile the live catalog.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "products" / "index.json"

SOURCE_CANDIDATES: dict[str, tuple[str, ...]] = {
    "widget": ("widgets/_src/{id}",),
    "plugin": ("plugins/{id}",),
    "profile": ("profiles/{id}", "products/profiles/{id}"),
    "icons": ("icons/{id}", "icon-packs/{id}", "products/icons/{id}"),
    "screensaver": ("screensavers/{id}", "products/screensavers/{id}"),
}


def load_index() -> dict[str, Any]:
    if not INDEX.is_file():
        raise SystemExit(f"missing product registry: {INDEX}")
    payload = json.loads(INDEX.read_text(encoding="utf-8"))
    if not isinstance(payload.get("products"), list):
        raise SystemExit("products/index.json must contain a products array")
    return payload


def candidate_paths(product: dict[str, Any]) -> list[Path]:
    product_id = str(product.get("id") or "").strip()
    product_type = str(product.get("type") or "").strip()
    patterns = SOURCE_CANDIDATES.get(product_type, ())
    return [ROOT / pattern.format(id=product_id) for pattern in patterns]


def inspect(product: dict[str, Any]) -> dict[str, Any]:
    candidates = candidate_paths(product)
    existing = [path for path in candidates if path.is_dir()]
    source_status = "SOURCE_AVAILABLE" if existing else "SOURCE_REQUIRED"
    if not candidates:
        source_status = "SOURCE_RULE_UNKNOWN"
    return {
        "id": product.get("id"),
        "name": product.get("name"),
        "type": product.get("type"),
        "registry_status": product.get("status"),
        "price_usd": product.get("price_usd"),
        "version": product.get("version"),
        "source_status": source_status,
        "source_path": str(existing[0].relative_to(ROOT)).replace("\\", "/") if existing else None,
        "checked_paths": [str(path.relative_to(ROOT)).replace("\\", "/") for path in candidates],
    }


def markdown(rows: list[dict[str, Any]], title: str) -> str:
    counts: dict[str, int] = {}
    for row in rows:
        counts[row["source_status"]] = counts.get(row["source_status"], 0) + 1
    lines = [
        f"# {title}",
        "",
        "This report checks registry entries against source directories in the current repository.",
        "It does **not** prove that `products/index.json` matches the live Elgato Maker Console catalog.",
        "Live-catalog reconciliation is a separate required gate before declaring a full marketplace rollout complete.",
        "",
        "## Summary",
        "",
    ]
    for key in ("SOURCE_AVAILABLE", "SOURCE_REQUIRED", "SOURCE_RULE_UNKNOWN"):
        if key in counts:
            lines.append(f"- `{key}`: {counts[key]}")
    lines += [
        "",
        "## Products",
        "",
        "| Product | Type | Registry | Source status | Canonical source |",
        "| --- | --- | --- | --- | --- |",
    ]
    for row in rows:
        source = f"`{row['source_path']}`" if row["source_path"] else "—"
        lines.append(
            f"| {row['name']} | {row['type']} | {row['registry_status']} | `{row['source_status']}` | {source} |"
        )
    lines += [
        "",
        "## Interpretation",
        "",
        "- `SOURCE_AVAILABLE` means the repository contains a plausible product source directory. It still must be inspected for current captures, claims, and marketing assets before V2 migration.",
        "- `SOURCE_REQUIRED` means marketplace media must not be regenerated from memory. Migrate or mount the real product source first.",
        "- `SOURCE_RULE_UNKNOWN` means this product type needs an explicit canonical source mapping before automation can make a safety decision.",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--status", action="append", help="registry status to include; may be repeated")
    parser.add_argument("--json-out", type=Path)
    parser.add_argument("--md-out", type=Path)
    args = parser.parse_args()

    payload = load_index()
    wanted = set(args.status or [])
    products = [p for p in payload["products"] if isinstance(p, dict)]
    if wanted:
        products = [p for p in products if p.get("status") in wanted]
    products.sort(key=lambda p: (str(p.get("type")), str(p.get("name"))))
    rows = [inspect(product) for product in products]

    report = {
        "schema_version": 1,
        "registry": "products/index.json",
        "live_catalog_reconciled": False,
        "warning": "This source audit does not prove the registry equals the live Elgato Maker Console catalog.",
        "filters": {"status": sorted(wanted)},
        "products": rows,
    }

    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if args.md_out:
        args.md_out.parent.mkdir(parents=True, exist_ok=True)
        label = "PackRat Marketplace Source Audit"
        if wanted:
            label += " — " + ", ".join(sorted(wanted))
        args.md_out.write_text(markdown(rows, label), encoding="utf-8")

    counts: dict[str, int] = {}
    for row in rows:
        counts[row["source_status"]] = counts.get(row["source_status"], 0) + 1
    print(json.dumps({"products": len(rows), "source_status": counts}, indent=2))


if __name__ == "__main__":
    main()
