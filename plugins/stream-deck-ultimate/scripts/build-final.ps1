param(
  [string]$OutputRoot = "",
  [switch]$SkipOfficialValidate
)

$ErrorActionPreference = "Stop"
$ProductRoot = Split-Path -Parent $PSScriptRoot
$Authoring = Join-Path $ProductRoot "authoring"
$Prototype = Join-Path $Authoring "prototype"
$Experiment = Join-Path $Authoring "experiments\per-app-audio"
$Overrides = Join-Path $ProductRoot "runtime-overrides"
if ([string]::IsNullOrWhiteSpace($OutputRoot)) { $OutputRoot = Join-Path $ProductRoot ".build" }
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
$Plugin = Join-Path $OutputRoot "com.packrat.stream-deck-ultimate-bundle.sdPlugin"
$Dist = Join-Path $ProductRoot "dist"
if (Test-Path -LiteralPath $OutputRoot) { Remove-Item -Recurse -Force -LiteralPath $OutputRoot }
New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
Copy-Item -Recurse -Force -LiteralPath (Join-Path $Prototype "com.packrat.stream-deck-ultimate-bundle.sdPlugin") -Destination $Plugin
$buildJson = & (Join-Path $Experiment "build-helper.ps1")
$build = $buildJson | ConvertFrom-Json
if (-not $build.ok -or -not (Test-Path -LiteralPath $build.path)) { throw "App Volume helper build failed: $buildJson" }
$appAudio = Join-Path $Plugin "bin\app-audio"
New-Item -ItemType Directory -Force -Path $appAudio | Out-Null
foreach ($name in @("action-spec.js","settings-model.js","session-model.js","app-audio-service.js","streamdeck-surface-model.js","streamdeck-controller.js","worker-client.js","runtime-factory.js","streamdeck-bridge.js","app-audio-worker.ps1")) { Copy-Item -Force -LiteralPath (Join-Path $Experiment $name) -Destination (Join-Path $appAudio $name) }
Copy-Item -Force -LiteralPath (Join-Path $Experiment "v08-app-audio-adapter.js") -Destination (Join-Path $Plugin "bin\lib-v08-app-audio.js")
Copy-Item -Force -LiteralPath (Join-Path $Experiment "plugin-v08-shadow.cjs") -Destination (Join-Path $Plugin "bin\plugin-v08.cjs")
Copy-Item -Force -LiteralPath (Join-Path $Experiment "property-inspector.html") -Destination (Join-Path $Plugin "ui\property-inspector-app-volume.html")
Copy-Item -Force -LiteralPath $build.path -Destination (Join-Path $appAudio "PackRatAppAudio.dll")
# Exact accepted overrides win over historical authoring source.
Get-ChildItem -Recurse -File -LiteralPath $Overrides | ForEach-Object { $relative=$_.FullName.Substring($Overrides.Length).TrimStart('\','/'); $dest=Join-Path $Plugin $relative; New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest)|Out-Null; Copy-Item -Force -LiteralPath $_.FullName -Destination $dest }
Copy-Item -Force -LiteralPath (Join-Path $ProductRoot "release\manifest-v1.0.0.json") -Destination (Join-Path $Plugin "manifest.json")
python (Join-Path $Prototype "tools\generate_prototype_assets_v71.py") $Plugin; if ($LASTEXITCODE -ne 0) { throw "asset generation failed" }
python (Join-Path $Prototype "tools\polish_context_art_v7.py") $Plugin; if ($LASTEXITCODE -ne 0) { throw "context art polish failed" }
python (Join-Path $ProductRoot "scripts\polish_icons.py") (Join-Path $Plugin "imgs\keys") --apply; if ($LASTEXITCODE -ne 0) { throw "key art polish failed" }
python (Join-Path $ProductRoot "scripts\whiten_manifest_icons.py") $Plugin; if ($LASTEXITCODE -ne 0) { throw "white icon pass failed" }
python (Join-Path $ProductRoot "scripts\verify_white_icons.py") $Plugin; if ($LASTEXITCODE -ne 0) { throw "white icon verification failed" }
Push-Location $Plugin
try { npm ci --omit=dev --ignore-scripts --no-audit --no-fund } finally { Pop-Location }
$m=Get-Content -LiteralPath (Join-Path $Plugin "manifest.json") -Raw|ConvertFrom-Json
if ($m.Name -ne "Stream Deck Ultimate" -or $m.Version -ne "1.0.0.0" -or $m.SDKVersion -ne 3 -or @($m.Actions).Count -ne 16) { throw "final manifest contract drifted" }
if (-not $SkipOfficialValidate) { if (-not (Get-Command streamdeck -ErrorAction SilentlyContinue)) { throw "Elgato Stream Deck CLI is required" }; streamdeck validate $Plugin --force-update-check; if($LASTEXITCODE-ne 0){throw "streamdeck validate failed"}; if(Test-Path $Dist){Remove-Item -Recurse -Force $Dist}; New-Item -ItemType Directory -Force $Dist|Out-Null; streamdeck pack $Plugin --output $Dist --force --no-file-list; if($LASTEXITCODE-ne 0){throw "streamdeck pack failed"} }
[pscustomobject]@{ok=$true;plugin=$Plugin;version=$m.Version;actions=@($m.Actions).Count;validated=(-not $SkipOfficialValidate);dist=$Dist}|ConvertTo-Json -Compress
