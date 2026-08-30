# XENEON Marketplace Recovery Addendum — 2026-08-27

This addendum records three additional Version 1 Marketplace rejections that were discovered after the original seven-product recovery batch: Snake, Network Dashboard, and PC Power Meter Pro.

Recovery PR: `#94 — Recover missed XENEON Marketplace rejections`

Merged commit: `41d4e19e4734f215a855398e46724d173fbb8212`

Passing recovery workflow: `XENEON Missed Rejection Recovery`

Passing run: `33141503920`

Artifact: `xeneon-missed-rejections-resubmission`, artifact ID `9674125384`

All three submission records remain `1.0.0`, matching the rejected Maker Console Version 1 revision requirement.

## Snake

Reviewer feedback: color customization could not be made to work during review.

The relevant Snake customization is its `themePreset` control, not the native three-color Custom Style triplet. Available presets are Matrix, Ice, Ember, and Mono.

Recovery evidence:

- exact freshly packaged Version 1 widget
- official CORSAIR validation and packaging
- archive integrity and root-file checks
- dedicated document-level lexical iCUE settings regression
- `icueEvents.onDataUpdated` lifecycle verified
- exact package changes `themePreset` from `matrix` to `ember`
- exact package changes touch guides from enabled to disabled in the same iCUE update lifecycle
- rendered widget changes from `data-theme=matrix` to `data-theme=ember`
- no page errors
- Corsair Labs exact-package host smoke passes

Final resubmission file: `snake.icuewidget`

SHA256: `7f266d42046799272db76d83f7ca629bfb019537806d9dc868c23ac3188aa463`

## Network Dashboard

Reviewer feedback:

1. Custom Style could not be seen working in iCUE.
2. Widget functionality could not be verified, so Marketplace requested a short demo video at `maker@elgato.com`.

Recovery evidence:

- exact freshly packaged Version 1 widget
- official CORSAIR validation and packaging
- archive integrity and root-file checks
- strict document-level lexical Custom Style regression verifies `textColor`, `accentColor`, and `backgroundColor` all update through `icueEvents.onDataUpdated`
- Corsair Labs exact-package host and Custom Style smoke passes
- deterministic reviewer demo proves latency ribbon data, visible probe-loss state, three hosts, latency, adjacent-sample jitter, probe loss, stored throughput, and 30-minute to 120-minute interaction
- demo has no page errors

Deterministic demo captured state:

- latency: `19 ms`
- jitter: `4.5 ms`
- probe loss: `1.9%`
- download: `842 Mbps`
- upload: `117 Mbps`
- hosts: `3`
- time-window interaction: `30 MIN` to `120 MIN`

Disclosure: the reviewer video uses deterministic HTTPS probe and throughput fixtures with the exact packaged widget. It demonstrates widget logic and interaction but is not represented as a live network measurement.

Final resubmission file: `net-dashboard.icuewidget`

SHA256: `78d815b5435c0d735d604c79a4a69531268de12b8bc7f4bc6531106b5fbc2ace`

Reviewer video: `net-dashboard-review-demo.mp4` in the local clean resubmission kit.

## PC Power Meter Pro

Reviewer feedback: installation reported the file as unsupported or corrupted.

Recovery findings:

- the current issue does not reproduce using the fresh canonical package path
- exact Version 1 package passes official CORSAIR validation and packaging
- package is ZIP-compatible and passes archive integrity checks
- root `index.html` and `manifest.json` are present
- exact package extracts successfully
- strict lexical Custom Style regression passes
- Corsair Labs exact-package host loading passes
- no page or console errors in host evidence

As with Weather Timeline's earlier installation rejection, the safe revision action is to upload the newly generated official package and never reuse the previously rejected artifact.

Final resubmission file: `pc-power-meter-pro.icuewidget`

SHA256: `890c997a2f1e83d17b490e85cbb239608402146f071ef5b34e5ca28017c76e28`

## QA lesson

The earlier generic 8/8 public regression audit was valuable but insufficient to resolve Snake's reviewer complaint because Snake does not use the native Custom Style triplet. The additional product-specific Snake theme regression is now the authoritative evidence for that rejection class.

The second recovery batch therefore reinforces the policy that a Marketplace complaint must be covered by a product-specific assertion when the generic host/style gate does not exercise the exact rejected behavior.
