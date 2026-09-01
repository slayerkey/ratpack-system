#!/usr/bin/env python3
"""Apply direct PackRat Marketplace URLs verified from Elgato's live public API.

This helper is intentionally idempotent. It updates only known commercial
relationships and the four XENEON Lite packages whose source is present in this
repository. It never invents a Marketplace URL.
"""
from __future__ import annotations

import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]

EXACT = {
    "better-hotkeys": ("https://marketplace.elgato.com/product/better-hotkeys-mouse-72b719b0-d0ce-4c0d-9d0e-a2a49cce735d", "72b719b0-d0ce-4c0d-9d0e-a2a49cce735d"),
    "better-hotkeys-pro": ("https://marketplace.elgato.com/product/better-hotkeys-mouse-pro-d1c3b3f3-1589-4884-b729-6d5eaa457c24", "d1c3b3f3-1589-4884-b729-6d5eaa457c24"),
    "davinci-resolve-lite": ("https://marketplace.elgato.com/product/davinci-resolve-lite-f76cfeae-614a-4381-ab7a-a8e8d6298285", "f76cfeae-614a-4381-ab7a-a8e8d6298285"),
    "davinci-resolve-pro": ("https://marketplace.elgato.com/product/davinci-resolve-pro-b703cfa1-1e25-4c62-b26d-30a70ab33933", "b703cfa1-1e25-4c62-b26d-30a70ab33933"),
    "window-manager": ("https://marketplace.elgato.com/product/window-manager-lite-a7693b4c-4afd-4dce-925a-262fd23b1f23", "a7693b4c-4afd-4dce-925a-262fd23b1f23"),
    "window-manager-pro": ("https://marketplace.elgato.com/product/window-manager-pro-f3ed6217-0282-419d-a71d-4b1548147b11", "f3ed6217-0282-419d-a71d-4b1548147b11"),
    "workflow-automation": ("https://marketplace.elgato.com/product/workflow-automation-lite-30b588ab-57c8-410a-834a-8e3367d0500e", "30b588ab-57c8-410a-834a-8e3367d0500e"),
    "workflow-automation-pro": ("https://marketplace.elgato.com/product/workflow-automation-pro-4da0b55c-edaa-4da3-a109-3f809bd48101", "4da0b55c-edaa-4da3-a109-3f809bd48101"),
    "calendar": ("https://marketplace.elgato.com/product/calendar-sync-lite-d6571598-f294-4187-bb2e-bdc64e398ca2", "d6571598-f294-4187-bb2e-bdc64e398ca2"),
    "calendar-pro": ("https://marketplace.elgato.com/product/calendar-sync-pro-d957868e-d1a0-4c3b-8fe4-8291951a5170", "d957868e-d1a0-4c3b-8fe4-8291951a5170"),
    "epic-pen": ("https://marketplace.elgato.com/product/epic-pen-profile-c3174c65-cf54-4f84-be2a-eb6f2f061def", "c3174c65-cf54-4f84-be2a-eb6f2f061def"),
    "epic-pen-pro": ("https://marketplace.elgato.com/product/epic-pen-pro-profile-083267a3-f437-4de6-9788-a6454b47f1af", "083267a3-f437-4de6-9788-a6454b47f1af"),
    "api-spend": ("https://marketplace.elgato.com/product/claude-codex-cost-lite-28b415aa-1f74-435a-ba57-d3dfc681af9b", "28b415aa-1f74-435a-ba57-d3dfc681af9b"),
    "api-spend-pro": ("https://marketplace.elgato.com/product/claude-codex-cost-pro-16445ae9-3baf-4967-bc0a-f142ae6894d3", "16445ae9-3baf-4967-bc0a-f142ae6894d3"),
    "weather-timeline": ("https://marketplace.elgato.com/product/weather-timeline-lite-418f836f-b5fb-4456-b412-9b7fe9295aa0", "418f836f-b5fb-4456-b412-9b7fe9295aa0"),
    "weather-timeline-pro": ("https://marketplace.elgato.com/product/weather-timeline-pro-160c8019-ce77-49d8-a306-8ef1764a70c5", "160c8019-ce77-49d8-a306-8ef1764a70c5"),
    "work-session-tracker": ("https://marketplace.elgato.com/product/work-session-tracker-lite-e11e003d-5ca3-4c2d-ba94-f37fca8dabc7", "e11e003d-5ca3-4c2d-ba94-f37fca8dabc7"),
    "work-session-tracker-pro": ("https://marketplace.elgato.com/product/work-session-tracker-pro-f8e12d94-4354-41ca-b6da-beb2297fb9e2", "f8e12d94-4354-41ca-b6da-beb2297fb9e2"),
    "desk-notes": ("https://marketplace.elgato.com/product/desk-notes-lite-3926a6a3-5860-4e11-a01b-7e90f8a4c900", "3926a6a3-5860-4e11-a01b-7e90f8a4c900"),
    "desk-notes-pro": ("https://marketplace.elgato.com/product/desk-notes-pro-3d7e3110-68be-4774-a351-755c12c95268", "3d7e3110-68be-4774-a351-755c12c95268"),
    "pc-power-meter": ("https://marketplace.elgato.com/product/pc-power-meter-lite-113488ed-3043-48b5-96d0-67c2130cc1ed", "113488ed-3043-48b5-96d0-67c2130cc1ed"),
    "pc-power-meter-pro": ("https://marketplace.elgato.com/product/pc-power-meter-pro-53e57034-588b-498f-9882-12b4a8837098", "53e57034-588b-498f-9882-12b4a8837098"),
    "clipboard-manager": ("https://marketplace.elgato.com/product/clipboard-manager-ad33db33-8278-42b0-ad81-c11b53ec41e7", "ad33db33-8278-42b0-ad81-c11b53ec41e7"),
    "clipboard-manager-pro": ("https://marketplace.elgato.com/product/clipboard-manager-pro-da242369-a59b-4cb5-b841-6d1ccb4dd2d0", "da242369-a59b-4cb5-b841-6d1ccb4dd2d0"),
}

PAIR_KEYS = {
    "better-hotkeys": "better-hotkeys-pro",
    "davinci-resolve-lite": "davinci-resolve-pro",
    "window-manager": "window-manager-pro",
    "workflow-automation": "workflow-automation-pro",
    "calendar": "calendar-pro",
    "epic-pen": "epic-pen-pro",
    "api-spend": "api-spend-pro",
    "weather-timeline": "weather-timeline-pro",
    "work-session-tracker": "work-session-tracker-pro",
    "desk-notes": "desk-notes-pro",
    "pc-power-meter": "pc-power-meter-pro",
    "clipboard-manager": "clipboard-manager-pro",
}

REPLACEMENTS = {
    "widgets/_src/weather-timeline/index.html": (
        "https://marketplace.elgato.com/search?q=Weather%20Timeline%20Pro",
        EXACT["weather-timeline-pro"][0],
    ),
    "widgets/_shared/weather-timeline/weather-core-01.js": (
        "https://marketplace.elgato.com/product/REPLACE_WITH_WEATHER_TIMELINE_PRO",
        EXACT["weather-timeline-pro"][0],
    ),
    "widgets/_src/desk-notes/index.html": (
        "https://marketplace.elgato.com/@packrat",
        EXACT["desk-notes-pro"][0],
    ),
    "widgets/_src/work-session-tracker/session-core-1.js": (
        "https://marketplace.elgato.com/icue",
        EXACT["work-session-tracker-pro"][0],
    ),
    "widgets/_src/pc-power-meter/edition.js": (
        "https://marketplace.elgato.com/search?q=PC%20Power%20Meter%20Pro",
        EXACT["pc-power-meter-pro"][0],
    ),
}


def replace_known_url(rel: str, old: str, new: str) -> None:
    path = ROOT / rel
    text = path.read_text(encoding="utf-8")
    if old in text:
        path.write_text(text.replace(old, new), encoding="utf-8")
    elif new not in text:
        raise RuntimeError(f"Neither old nor verified URL is present in {rel}")


def patch_xeneon_sources() -> None:
    for rel, (old, new) in REPLACEMENTS.items():
        replace_known_url(rel, old, new)

    for slug in ("weather-timeline", "work-session-tracker", "desk-notes", "pc-power-meter"):
        manifest_path = ROOT / "widgets" / slug / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("version") == "1.0.0":
            manifest["version"] = "1.0.1"
            manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        elif manifest.get("version") != "1.0.1":
            raise RuntimeError(f"Unexpected {slug} version {manifest.get('version')}")

        submission_path = ROOT / "widgets" / "_src" / slug / "submission.json"
        if submission_path.exists():
            submission = json.loads(submission_path.read_text(encoding="utf-8"))
            submission["version"] = "1.0.1"
            submission["release_notes"] = (
                "Updated the Lite edition to use the verified direct Pro Marketplace listing "
                "and refreshed package validation."
            )
            submission_path.write_text(
                json.dumps(submission, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
            )


def patch_relationship_map() -> None:
    path = ROOT / "products" / "lite-pro-map.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["updated_at"] = "2026-09-01"
    data["notes"] = (
        "Commercial edition relationships. Direct URLs and Marketplace IDs below were verified "
        "against the live public Elgato Marketplace API for PackRat on 2026-09-01; no search, "
        "creator, generic, or placeholder URLs are accepted."
    )
    data["pairs"] = [p for p in data["pairs"] if p.get("lite_id") != "cs2-lite"]
    by_lite = {p.get("lite_id"): p for p in data["pairs"]}

    for lite, pro in PAIR_KEYS.items():
        pair = by_lite.get(lite)
        if pair is None:
            raise RuntimeError(f"Missing relationship-map pair: {lite}")
        pair["pro_id"] = pro
        pair["classification"] = "lite_to_pro"
        pair["lite_marketplace_url"] = EXACT[lite][0]
        pair["pro_marketplace_url"] = EXACT[pro][0]
        pair["lite_marketplace_product_id"] = EXACT[lite][1]
        pair["pro_marketplace_product_id"] = EXACT[pro][1]

    by_lite["pc-power-meter"]["source_status"] = "shared_core_verified_marketplace_live"
    by_lite["pc-power-meter"]["notes"] = (
        "PC Power Meter Pro source and live paid Marketplace listing are both verified."
    )
    by_lite["clipboard-manager"]["source_status"] = "marketplace_verified_source_local_only"
    by_lite["clipboard-manager"]["notes"] = (
        "Live Lite and Pro listings verified. Shipping source is not present in the connected "
        "RatPack GitHub tree and must be updated from the local product source."
    )
    by_lite["api-spend"]["notes"] = (
        "Live Marketplace names are Claude & Codex Cost Lite / Pro; canonical internal IDs remain "
        "api-spend / api-spend-pro until the local source is synchronized."
    )

    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def patch_product_index() -> None:
    path = ROOT / "products" / "index.json"
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()

    lite_versions = {
        "weather-timeline": "1.0.1",
        "work-session-tracker": "1.0.1",
        "desk-notes": "1.0.1",
        "pc-power-meter": "1.0.1",
    }
    xeneon_pro_ids = {"weather-timeline-pro", "work-session-tracker-pro", "desk-notes-pro"}
    seen = set()
    out = []
    pc_pro_exists = '"id":"pc-power-meter-pro"' in text

    for line in lines:
        match = re.search(r'\{"id":"([^"]+)"', line)
        product_id = match.group(1) if match else None
        if product_id in lite_versions:
            seen.add(product_id)
            line = re.sub(r'"status":"[^"]+"', '"status":"published"', line)
            line = re.sub(r'"version":"[^"]+"', f'"version":"{lite_versions[product_id]}"', line)
        elif product_id in xeneon_pro_ids:
            seen.add(product_id)
            line = re.sub(r'"status":"[^"]+"', '"status":"published"', line)
        out.append(line)
        if product_id == "pc-power-meter" and not pc_pro_exists:
            out.append(
                '    {"id":"pc-power-meter-pro","name":"PC Power Meter Pro","type":"widget",'
                '"status":"published","price_usd":7.99,"version":"1.0.0"},'
            )

    expected = set(lite_versions) | xeneon_pro_ids
    missing = expected - seen
    if missing:
        raise RuntimeError(f"Expected XENEON catalog entries missing: {sorted(missing)}")

    path.write_text("\n".join(out) + "\n", encoding="utf-8")


def assert_no_bad_targets() -> None:
    bad = (
        "REPLACE_WITH_WEATHER_TIMELINE_PRO",
        "marketplace.elgato.com/search?q=Weather%20Timeline%20Pro",
        "marketplace.elgato.com/@packrat",
        "marketplace.elgato.com/icue",
        "marketplace.elgato.com/search?q=PC%20Power%20Meter%20Pro",
    )
    roots = (
        ROOT / "widgets/_src/weather-timeline",
        ROOT / "widgets/_shared/weather-timeline",
        ROOT / "widgets/_src/work-session-tracker",
        ROOT / "widgets/_src/desk-notes",
        ROOT / "widgets/_src/desk-notes-common",
        ROOT / "widgets/_src/pc-power-meter",
        ROOT / "widgets/_shared/pc-power-meter",
    )
    for source_root in roots:
        for path in source_root.rglob("*"):
            if not path.is_file():
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            for marker in bad:
                if marker in text:
                    raise RuntimeError(f"Invalid Marketplace target remains in {path}: {marker}")


def main() -> int:
    patch_xeneon_sources()
    patch_relationship_map()
    patch_product_index()
    assert_no_bad_targets()
    print("Applied verified direct Marketplace URLs and XENEON Lite 1.0.1 revisions.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
