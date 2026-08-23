# Third party licenses

## ical.js 2.2.1

Calendar Panel includes ical.js 2.2.1, licensed under the Mozilla Public License 2.0.

The exact runtime was recovered from the user supplied Calendar Sync Pro project, which uses ical.js in its production calendar parser. To keep the XENEON widget self contained while avoiding unreliable large file transfers, the exact ical.js browser source is stored deterministically as gzip plus base64 chunks in `ical-pack-01.js` through `ical-pack-08.js`. `ical-loader.js` restores and executes that source locally at runtime.

Project: ical.js
License: Mozilla Public License 2.0
Upstream: Mozilla Calendar / ical.js
Version: 2.2.1
