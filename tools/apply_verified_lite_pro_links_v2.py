#!/usr/bin/env python3
"""Compatibility wrapper that also updates the Work Session Lite upgrade-route QA."""
import apply_verified_lite_pro_links as base

_original_patch_xeneon_sources = base.patch_xeneon_sources


def _patch_xeneon_sources_with_qa() -> None:
    _original_patch_xeneon_sources()
    base.replace_known_url(
        "widgets/_src/work-session-tracker/session-qa.mjs",
        "https://marketplace.elgato.com/icue",
        base.EXACT["work-session-tracker-pro"][0],
    )


base.patch_xeneon_sources = _patch_xeneon_sources_with_qa

if __name__ == "__main__":
    raise SystemExit(base.main())
