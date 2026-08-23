"""Resolve the XENEON widget slug a CI run should validate."""
from __future__ import annotations

import argparse
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def fail(message: str) -> None:
    raise SystemExit(f"XENEON SLUG RESOLUTION FAIL: {message}")


def validate_slug(slug: str) -> str:
    value = (slug or "").strip()
    if not SLUG_RE.fullmatch(value):
        fail(f"invalid widget slug: {value!r}")
    if not (ROOT / "widgets" / "_src" / value).is_dir():
        fail(f"missing authored widget directory: widgets/_src/{value}")
    if not (ROOT / "widgets" / value).is_dir():
        fail(f"missing shipping widget directory: widgets/{value}")
    return value


def changed_paths(base: str, head: str) -> list[str]:
    command = ["git", "diff", "--name-only", f"{base}...{head}"]
    result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
    if result.returncode != 0:
        fail(f"git diff failed: {result.stderr.strip() or result.stdout.strip()}")
    return [line.strip().replace("\\", "/") for line in result.stdout.splitlines() if line.strip()]


def slugs_from_paths(paths: list[str]) -> set[str]:
    slugs: set[str] = set()
    for raw in paths:
        parts = raw.split("/")
        if len(parts) >= 3 and parts[0] == "widgets":
            if parts[1] == "_src" and len(parts) >= 4:
                slug = parts[2]
            elif not parts[1].startswith("_"):
                slug = parts[1]
            else:
                continue
            if SLUG_RE.fullmatch(slug):
                slugs.add(slug)
    return slugs


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", help="Explicit slug, normally from workflow_dispatch")
    parser.add_argument("--base", help="Base commit or ref for pull request diff")
    parser.add_argument("--head", default="HEAD", help="Head commit or ref for pull request diff")
    parser.add_argument("--fallback", default="now-playing", help="Smoke-test slug when only shared files changed")
    args = parser.parse_args()

    if args.slug:
        print(validate_slug(args.slug))
        return

    if not args.base:
        fail("--base is required when --slug is not provided")

    slugs = slugs_from_paths(changed_paths(args.base, args.head))
    if len(slugs) == 1:
        print(validate_slug(next(iter(slugs))))
        return
    if len(slugs) > 1:
        fail("multiple widget slugs changed in one pull request: " + ", ".join(sorted(slugs)))

    print(validate_slug(args.fallback))


if __name__ == "__main__":
    main()
