#!/usr/bin/env python3
"""Compatibility wrapper for verified live Marketplace relationships."""
import apply_verified_lite_pro_links as base

_original_patch_xeneon_sources = base.patch_xeneon_sources
_original_patch_product_index = base.patch_product_index


def _patch_xeneon_sources_with_qa() -> None:
    _original_patch_xeneon_sources()
    base.replace_known_url(
        "widgets/_src/work-session-tracker/session-qa.mjs",
        "https://marketplace.elgato.com/icue",
        base.EXACT["work-session-tracker-pro"][0],
    )


def _patch_product_index_with_live_clipboard_pro() -> None:
    _original_patch_product_index()
    path = base.ROOT / "products" / "index.json"
    text = path.read_text(encoding="utf-8")
    lite_submitted = '{"id":"clipboard-manager","name":"Clipboard Manager","type":"plugin","status":"submitted","price_usd":0,"version":"1.0.0.0"},'
    lite_published = '{"id":"clipboard-manager","name":"Clipboard Manager","type":"plugin","status":"published","price_usd":0,"version":"1.0.0.0"},'
    pro_record = '{"id":"clipboard-manager-pro","name":"Clipboard Manager Pro","type":"plugin","status":"published","price_usd":6.99,"version":null},'

    if lite_submitted in text:
        text = text.replace(lite_submitted, lite_published)
    if pro_record not in text:
        if lite_published not in text:
            raise RuntimeError("Clipboard Manager canonical record not found")
        text = text.replace(lite_published, lite_published + "\n    " + pro_record)
    path.write_text(text, encoding="utf-8")


base.patch_xeneon_sources = _patch_xeneon_sources_with_qa
base.patch_product_index = _patch_product_index_with_live_clipboard_pro

if __name__ == "__main__":
    raise SystemExit(base.main())
