#!/usr/bin/env python3
"""Repair the Helldivers Rat Art fixture for the current query-param transport.

The installed widget intentionally avoids CORS preflight by sending the required
API client/contact values as lowercase query parameters. The older deterministic
Rat Art fixture still rejected requests unless those values arrived as headers.
This patch makes the fixture accept either transport without changing product code.
"""
from pathlib import Path

path = Path("widgets/_src/helldivers/rat-art.mjs")
text = path.read_text(encoding="utf-8")
old = """    const headers = request.headers();
    if (
      headers['x-super-client'] !== 'packrat-xeneon'
      || headers['x-super-contact'] !== 'slayerkey+ondiscord@gmail.com'
    ) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Rat Art fixture rejected API headers' }),
      });
      return;
    }

    const url = new URL(request.url());
"""
new = """    const url = new URL(request.url());
    const headers = request.headers();
    const client = headers['x-super-client'] || url.searchParams.get('x-super-client');
    const contact = headers['x-super-contact'] || url.searchParams.get('x-super-contact');
    if (
      client !== 'packrat-xeneon'
      || contact !== 'slayerkey+ondiscord@gmail.com'
    ) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Rat Art fixture rejected API identity' }),
      });
      return;
    }

"""
if old not in text:
    raise SystemExit("Helldivers Rat Art transport block not found; refusing blind patch")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("PATCH PASS: Helldivers Rat Art fixture accepts current query transport")
