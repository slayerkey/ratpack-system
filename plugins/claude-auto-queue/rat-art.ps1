param(
    [Parameter(Mandatory = $true)]
    [string]$Destination
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Renderer = Join-Path $Root "scripts\rat_art.py"

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python is required for deterministic Rat Art."
}

python $Renderer --out $Destination
if ($LASTEXITCODE -ne 0) {
    throw "Auto Queue Rat Art failed with exit code $LASTEXITCODE."
}

$required = @(
    "01_search_icon.png",
    "02_cover.png",
    "03_gallery_01.png",
    "04_gallery_02.png",
    "05_gallery_03.png",
    "06_gallery_04.png"
)
foreach ($file in $required) {
    $path = Join-Path $Destination $file
    if (-not (Test-Path $path)) { throw "Rat Art output missing: $file" }
}
Write-Host "Auto Queue Rat Art complete: $Destination" -ForegroundColor Green
