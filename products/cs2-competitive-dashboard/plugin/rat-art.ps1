param(
    [Parameter(Mandatory = $true)]
    [string]$Destination
)

$ErrorActionPreference = "Stop"
$PluginRoot = $PSScriptRoot
$ProductRoot = (Resolve-Path (Join-Path $PluginRoot "..")).Path
$RenderScript = Join-Path $ProductRoot "art\render.py"
$RenderOut = Join-Path $ProductRoot "art\out"

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python is required to generate CS2 Competitive Dashboard Rat Art."
}
if (-not (Test-Path $RenderScript)) {
    throw "CS2 Rat Art renderer not found: $RenderScript"
}

Write-Host "CS2 Rat Art: rendering deterministic Marketplace media..." -ForegroundColor DarkGray
& python $RenderScript | Out-Host
if ($LASTEXITCODE -ne 0) {
    throw "CS2 Rat Art renderer failed with exit code $LASTEXITCODE."
}

New-Item -ItemType Directory -Force -Path $Destination | Out-Null
$mapping = [ordered]@{
    "0-app-icon-288.png" = "01_search_icon.png"
    "1-hero.png"         = "02_cover.png"
    "2-features.png"     = "03_gallery_01.png"
    "5-profiles.png"     = "04_gallery_02.png"
    "3-setup.png"        = "05_gallery_03.png"
    "4-privacy.png"      = "06_gallery_04.png"
}

foreach ($sourceName in $mapping.Keys) {
    $source = Join-Path $RenderOut $sourceName
    if (-not (Test-Path $source -PathType Leaf)) {
        throw "CS2 Rat Art output missing: $source"
    }
    Copy-Item $source (Join-Path $Destination $mapping[$sourceName]) -Force
}

Write-Host "CS2 Rat Art: Marketplace media copied to $Destination" -ForegroundColor Green
