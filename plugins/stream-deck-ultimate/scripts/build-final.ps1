param(
  [string]$OutputRoot = "",
  [switch]$SkipOfficialValidate
)

$ErrorActionPreference = "Stop"
$ProductRoot = Split-Path -Parent $PSScriptRoot
$Authoring = Join-Path $ProductRoot "authoring"
$Prototype = Join-Path $Authoring "prototype"
$Experiment = Join-Path $Authoring "experiments\per-app-audio"
$PrototypePlugin = Join-Path $Prototype "com.packrat.stream-deck-ultimate-bundle.sdPlugin"
$FinalManifest = Join-Path $ProductRoot "release\manifest-v1.0.0.json"

if ([string]::IsNullOrWhiteSpace($OutputRoot)) { $OutputRoot = Join-Path $ProductRoot ".build" }
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
$Plugin = Join-Path $OutputRoot "com.packrat.stream-deck-ultimate-bundle.sdPlugin"
$Dist = Join-Path $ProductRoot "dist"

foreach ($required in @($PrototypePlugin, $Experiment, $FinalManifest)) {
  if (-not (Test-Path -LiteralPath $required)) { throw "Recovered Ultimate source input missing: $required" }
}

if (Test-Path -LiteralPath $OutputRoot) { Remove-Item -Recurse -Force -LiteralPath $OutputRoot }
New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
Copy-Item -Recurse -Force -LiteralPath $PrototypePlugin -Destination $Plugin

# Rebuild the v0.8/v1 App Volume helper and runtime from the recovered upstream source.
$buildJson = & (Join-Path $Experiment "build-helper.ps1")
$build = $buildJson | ConvertFrom-Json
if (-not $build.ok -or -not (Test-Path -LiteralPath $build.path)) { throw "App Volume helper build failed: $buildJson" }

$appAudio = Join-Path $Plugin "bin\app-audio"
New-Item -ItemType Directory -Force -Path $appAudio | Out-Null
foreach ($name in @(
  "action-spec.js",
  "settings-model.js",
  "session-model.js",
  "app-audio-service.js",
  "streamdeck-surface-model.js",
  "streamdeck-controller.js",
  "worker-client.js",
  "runtime-factory.js",
  "streamdeck-bridge.js",
  "app-audio-worker.ps1"
)) {
  Copy-Item -Force -LiteralPath (Join-Path $Experiment $name) -Destination (Join-Path $appAudio $name)
}
Copy-Item -Force -LiteralPath (Join-Path $Experiment "v08-app-audio-adapter.js") -Destination (Join-Path $Plugin "bin\lib-v08-app-audio.js")
Copy-Item -Force -LiteralPath (Join-Path $Experiment "plugin-v08-shadow.cjs") -Destination (Join-Path $Plugin "bin\plugin-v08.cjs")
Copy-Item -Force -LiteralPath (Join-Path $Experiment "property-inspector.html") -Destination (Join-Path $Plugin "ui\property-inspector-app-volume.html")
Copy-Item -Force -LiteralPath $build.path -Destination (Join-Path $appAudio "PackRatAppAudio.dll")

# Restore the seven files exactly as they existed in the physical hardware-accepted v1.0 runtime.
python (Join-Path $ProductRoot "scripts\apply_hardware_acceptance.py") $Plugin
if ($LASTEXITCODE -ne 0) { throw "exact hardware-acceptance payload restore failed" }

# Promote the final accepted Marketplace contract after staging the runtime.
Copy-Item -Force -LiteralPath $FinalManifest -Destination (Join-Path $Plugin "manifest.json")

# Recreate deterministic profiles/art from the recovered authoring source, then apply the
# post-acceptance key polish and the Elgato review-only white app-list icon correction.
python -m pip install -r (Join-Path $Prototype "requirements.txt") --disable-pip-version-check --quiet
if ($LASTEXITCODE -ne 0) { throw "prototype Python dependency install failed" }
python (Join-Path $Prototype "tools\generate_prototype_assets_v71.py") $Plugin
if ($LASTEXITCODE -ne 0) { throw "asset/profile generation failed" }
python (Join-Path $Prototype "tools\polish_context_art_v7.py") $Plugin
if ($LASTEXITCODE -ne 0) { throw "context art polish failed" }
python (Join-Path $ProductRoot "scripts\polish_icons.py") (Join-Path $Plugin "imgs\keys") --apply
if ($LASTEXITCODE -ne 0) { throw "accepted key-art polish failed" }
python (Join-Path $ProductRoot "scripts\whiten_manifest_icons.py") $Plugin
if ($LASTEXITCODE -ne 0) { throw "Elgato white app-list icon pass failed" }

# Fail closed if any accepted desktop fix or Marketplace icon rule disappeared.
python (Join-Path $ProductRoot "scripts\verify_hardware_fixes.py") $Plugin
if ($LASTEXITCODE -ne 0) { throw "hardware acceptance F1-F7 regression contract failed" }
python (Join-Path $ProductRoot "scripts\verify_white_icons.py") $Plugin
if ($LASTEXITCODE -ne 0) { throw "Elgato white icon verification failed" }

Push-Location $Plugin
try {
  npm ci --omit=dev --ignore-scripts --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "locked plugin dependency install failed" }
} finally {
  Pop-Location
}

$manifest = Get-Content -LiteralPath (Join-Path $Plugin "manifest.json") -Raw | ConvertFrom-Json
if ($manifest.Name -ne "Stream Deck Ultimate" -or $manifest.Version -ne "1.0.0.0" -or $manifest.SDKVersion -ne 3 -or @($manifest.Actions).Count -ne 16) {
  throw "final v1.0 manifest contract drifted"
}

if (-not $SkipOfficialValidate) {
  if (-not (Get-Command streamdeck -ErrorAction SilentlyContinue)) { throw "Elgato Stream Deck CLI is required" }
  streamdeck validate $Plugin --force-update-check
  if ($LASTEXITCODE -ne 0) { throw "streamdeck validate failed" }

  if (Test-Path -LiteralPath $Dist) { Remove-Item -Recurse -Force -LiteralPath $Dist }
  New-Item -ItemType Directory -Force -Path $Dist | Out-Null
  streamdeck pack $Plugin --output $Dist --force --no-file-list
  if ($LASTEXITCODE -ne 0) { throw "streamdeck pack failed" }
}

[pscustomobject]@{
  ok = $true
  sourceCommit = "fc314e6f42fbe3e16da82a3af7aca75bda288e4f"
  plugin = $Plugin
  version = $manifest.Version
  actions = @($manifest.Actions).Count
  hardwareFixes = "F1-F7 PASS"
  whiteIcons = "32 assets PASS"
  validated = (-not $SkipOfficialValidate)
  dist = $Dist
} | ConvertTo-Json -Compress
