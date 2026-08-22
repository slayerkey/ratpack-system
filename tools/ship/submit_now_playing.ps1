param(
  [Parameter(Mandatory=$true)]
  [string]$Kit,
  [string]$Profile = ""
)

$ErrorActionPreference = 'Stop'
$ShipDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = Resolve-Path (Join-Path $ShipDir '..\..')
$KitPath = Resolve-Path $Kit

if ($KitPath.Path.ToLower().EndsWith('.zip')) {
  $Target = Join-Path $env:TEMP 'ratpack-now-playing-ship'
  if (Test-Path $Target) { Remove-Item -Recurse -Force $Target }
  Expand-Archive -Path $KitPath.Path -DestinationPath $Target -Force
  $Submission = Get-ChildItem -Path $Target -Filter submission.json -Recurse | Select-Object -First 1
  if (-not $Submission) { throw 'No submission.json found inside the ship kit archive' }
  $KitDir = $Submission.Directory.FullName
} else {
  $KitDir = $KitPath.Path
}

Push-Location $ShipDir
try {
  npm install
  npx playwright install chromium
} finally {
  Pop-Location
}

$Args = @(
  (Join-Path $ShipDir 'maker_console.mjs'),
  'now-playing',
  "--kit=$KitDir",
  '--submit'
)
if ($Profile) { $Args += "--profile=$Profile" }

Write-Host "Rat Ship: opening Maker Console for Now Playing Panel"
Write-Host "Kit: $KitDir"
node @Args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
