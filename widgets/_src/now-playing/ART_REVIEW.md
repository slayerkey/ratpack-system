# Now Playing Panel Rat Art review

Status: `APPROVED`

Version: `1.0.0`

Price: `$9.99`

The corrected deterministic Rat Art candidate is approved for shipping.

## Final correction

The rejected pre-fix candidate clipped the lowercase `g` descender in the large track title because `#trackTitle` used `line-height: 0.91` inside an intentional clipping viewport.

The canonical widget source now uses descender-safe `line-height: 1.04`. The shipping HTML is regenerated from canonical source before validation, package, capture, art, and shipping.

The corrected real widget capture was reviewed and the `g` descender is fully visible.

A thin fragmented-looking detail remains along the top XENEON device bezel in the marketplace composite. Review confirmed that detail belongs to the approved device plate rather than the widget capture and it is accepted as nonblocking for this release.

## Approved marketplace media

The final Rat Ship workflow reproduced the corrected deterministic art and copied the exact approved files into the Maker Console SHIP_KIT.

| Ship kit file | Marketplace role | Size | SHA256 |
| --- | --- | --- | --- |
| `01_search_icon.png` | Search icon | 288×288 | `b2243212dd56158120e70a3e900eead205dc137214b2db87af2ca398ecc8a875` |
| `02_cover.png` | Cover | 1920×960 | `3734209838fe1070f700dde0cc2ed011771e8da83f2daa8190c2391b131095d4` |
| `03_gallery_01.png` | Gallery 1 | 1920×960 | `5daf43337f7f775acd4508b98c7ceac1ba6386d733e8bad2f6294e482e2a24f8` |
| `04_gallery_02.png` | Gallery 2 | 1920×960 | `b7f57ee90d577b0621abab2e1509daaf21fea86d860f962beb5f01aa3e57dc5e` |
| `05_gallery_03.png` | Gallery 3 | 1920×960 | `23c3d22c16012b83f4dc5b59e2a7da925beefa2e324c7f637661867f734db793` |
| `06_gallery_04.png` | Gallery 4 | 1920×960 | `9f104801ea4d3dbd116be1f9fd90bed61920c1c36c34e6a36f289903f32e42c3` |

Final official widget package SHA256: `07a5d7325fb72affceaaa61beb43eac57670953467d3bacb54cfbc4e983bc8a1`.

Final Rat Ship GitHub Actions run: `32600062724`.

Final Rat Ship artifact: `rat-ship-now-playing`, artifact ID `9482646380`, artifact digest `sha256:bd31b9bd2cca2d39b3a24299b0560d77c3b1085e396ae7c1a532704ff279f2bd`.

## Provenance

All customer facing widget imagery comes from deterministic Playwright captures of the canonical Now Playing widget with fictional track and artist fixtures.

The marketplace compositor uses the approved calibrated XENEON Edge device plate and repository Rat Art tooling.

Image generation is disabled for Rat Art. No DALL-E, ImageGen, image API, or other generative image provider is part of the production art path.

No generated album art, progress bar, seek state, fabricated playback state, or third party music branding is present.

## Shipping approval

The exact files above are approved for the Now Playing Panel 1.0.0 Maker Console submission kit.

Any future change to widget source, art tooling, device mapping, price, package, or marketplace media invalidates these hashes and requires the relevant RatPack gate to rerun.
