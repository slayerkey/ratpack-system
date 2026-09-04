param(
  [string]$OutputRoot = "",
  [switch]$SkipOfficialValidate
)

$ErrorActionPreference = "Stop"
$ProductRoot = Split-Path -Parent $PSScriptRoot
$Reference = Join-Path $ProductRoot "reference\Stream-Deck-Ultimate-v1.0.0-white-icons.streamDeckPlugin"
if (-not (Test-Path -LiteralPath $Reference)) { throw "Canonical v1.0 reference package missing: $Reference" }

if ([string]::IsNullOrWhiteSpace($OutputRoot)) { $OutputRoot = Join-Path $ProductRoot ".build" }
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
$Plugin = Join-Path $OutputRoot "com.packrat.stream-deck-ultimate-bundle.sdPlugin"
$Dist = Join-Path $ProductRoot "dist"

if (Test-Path -LiteralPath $OutputRoot) { Remove-Item -Recurse -Force -LiteralPath $OutputRoot }
New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

# The exact hardware-accepted + Marketplace-corrected package is the immutable release baseline.
# Do not regenerate v1 from the older prototype: that was the failure mode that lost the seven
# desktop hardware fixes. Extracting the known-good package materializes every JS/HTML/PS1 asset,
# profile, native helper and image exactly as accepted.
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($Reference, $OutputRoot)
if (-not (Test-Path -LiteralPath $Plugin)) { throw "Reference package did not contain the expected .sdPlugin root" }

python (Join-Path $ProductRoot "scripts\verify_white_icons.py") $Plugin
if ($LASTEXITCODE -ne 0) { throw "Elgato white icon verification failed" }

$manifest = Get-Content -LiteralPath (Join-Path $Plugin "manifest.json") -Raw | ConvertFrom-Json
if ($manifest.Name -ne "Stream Deck Ultimate" -or $manifest.Version -ne "1.0.0.0" -or $manifest.SDKVersion -ne 3 -or @($manifest.Actions).Count -ne 16) {
  throw "Final v1.0 manifest contract drifted"
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
  source = $Reference
  plugin = $Plugin
  version = $manifest.Version
  actions = @($manifest.Actions).Count
  validated = (-not $SkipOfficialValidate)
  dist = $Dist
} | ConvertTo-Json -Compress
