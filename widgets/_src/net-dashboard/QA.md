# Network Dashboard QA

## Product

Slug: `net-dashboard`

Branch: `product/net-dashboard`

Manifest author: `PackRat 🐀`

Version: `1.0.0`

## Completed before repository write

PASS: product logic verifier validates the 20, 30, loss, 50, 55 sequence as 7.5 ms jitter and 20 percent probe loss.

PASS: failed attempts break jitter adjacency. No jitter pair crosses a failed probe.

PASS: the latest failed verified attempt produces no current latency value.

PASS: failures before a host has ever returned successfully are classified as unobserved, not probe loss.

PASS: custom probe URLs are accepted only when HTTPS and are represented in local persistence by an eight character deterministic hash. Full configured URLs are not used as localStorage keys.

PASS: streamed download responses count actual received bytes.

PASS: upload payload preparation uses 1 MB pieces and yields between groups of pieces so the browser can repaint.

PASS: the upload uses a CORS safelisted text/plain Blob rather than adding a custom application/octet-stream request header.

PASS: normal latency probing pauses during a throughput test and resumes in the finally path.

PASS: switching the primary host loads a separate history namespace and does not mix the old primary timeline into the new host.

PASS: a latest verified failure shows `--` for current latency while retaining the prior good value only as explicitly stale secondary copy.

PASS: repeated taps while a throughput test is active do not start a second test.

PASS: an upload failure preserves the previous complete speed result and resumes latency probing.

PASS: runtime translation coverage is complete for English, German, Spanish, and French.

PASS: source JavaScript passes `node --check`.

PASS: manifest, translation, and submission JSON parse successfully.

PASS: generated shipping HTML is self contained with local CSS and JavaScript inlined, uppercase doctype, and an XML safe head.

## Eight layout browser audit

The built single file widget was rendered in headless Chromium with deterministic network fixtures at all eight official XENEON sizes:

* 840x344
* 696x416
* 840x696
* 696x840
* 1688x696
* 696x1688
* 2536x696
* 696x2536

PASS: zero document overflow at all eight sizes.

PASS: metrics, latency ribbon, side rail, and status strip remain inside the stage at all eight sizes.

PASS: ribbon and throughput touch regions remain substantially larger than fingertip targets at all eight sizes.

PASS: deterministic primary history produces visible latency bars, a high latency spike, and a distinct failed probe gap.

PASS: tapping the ribbon changes the selected time window.

PASS: mocked streaming download and upload complete through the real UI interaction path.

PASS: no page runtime errors in the eight layout run.

## API honesty

The product measures timed HTTPS fetch behavior. It does not claim ICMP RTT or true packet loss.

The aggregate is named `Probe Loss` because it represents failed verified HTTPS attempts divided by verified HTTPS attempts in the selected window.

Cloudflare throughput uses `https://speed.cloudflare.com/__down` and `https://speed.cloudflare.com/__up` only when the user taps the throughput panel.

## Pending canonical remote gates

The current repository XENEON workflows accept a manual slug but PR triggered jobs default to `now-playing`. Under this product's write boundary, the shared workflow cannot be changed here.

After the branch is written, the desired remote gates are:

1. `tools/xeneon/inline.py net-dashboard`
2. official `icuewidget-cli` validation and package on Windows
3. StreamSpell packaged widget verification across all eight presets
4. shared Rat Art after its Now Playing specific fixture assumptions are made generic
5. Rat Ship after its Now Playing specific final invariants are made metadata driven

See `NEEDS.md` for owner shared tooling and host allowlist work.
