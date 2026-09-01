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
    "06_gallery_04.png",
    "contact-sheet.jpg",
    "thumbnail-sheet.jpg",
    "rat-art-report.json"
)
foreach ($file in $required) {
    $path = Join-Path $Destination $file
    if (-not (Test-Path $path)) { throw "Rat Art output missing: $file" }
}

$report = Get-Content (Join-Path $Destination "rat-art-report.json") -Raw | ConvertFrom-Json
if ($report.image_generation -ne "disabled") { throw "Image generation must stay disabled." }
if ($report.design_system -ne "marketplace-listing-v2") { throw "Marketplace Listing V2 renderer was not used." }

Write-Host "Auto Queue Rat Art V2 complete: $Destination" -ForegroundColor Green
