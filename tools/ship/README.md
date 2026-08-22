# Rat Ship browser bridge

GitHub is canonical for package, art, metadata, and ship kit generation.

`maker_console.mjs` is the authenticated Maker Console browser bridge. It uses a local persistent Chromium profile at `.playwright-profile`; never commit or upload that directory.

For XENEON widgets:

```powershell
node tools/ship/maker_console.mjs now-playing --kit="C:\path\to\SHIP_KIT" --check-kit
node tools/ship/maker_console.mjs now-playing --kit="C:\path\to\SHIP_KIT" --check
node tools/ship/maker_console.mjs now-playing --kit="C:\path\to\SHIP_KIT" --submit
```

The GitHub workflow `.github/workflows/rat-ship-xeneon.yml` proves the driver can parse and preflight the generated kit. GitHub Actions can run Playwright, but it intentionally does not receive Maker Console cookies, passwords, browser profile data, or session tokens. Final authenticated submission runs locally against the persistent browser profile.

The live Maker Console is the operational source of truth for available product types. Widget direct submission is supported and accepts `.icuewidget` packages.
