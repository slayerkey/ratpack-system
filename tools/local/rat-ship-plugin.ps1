param(
    [Parameter(Mandatory = $true)]
    [string]$PluginSlug,

    [Parameter(Mandatory = $true)]
    [string]$Destination
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Require-Command {
    param([string]$Name, [string]$Hint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required for local Stream Deck Rat Ship. $Hint"
    }
}

function Invoke-Step {
    param([string]$Label, [scriptblock]$Command)
    Write-Host "Local Rat Ship plugin: $Label..." -ForegroundColor DarkGray
    & $Command | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "Local Rat Ship plugin failed during '$Label' with exit code $LASTEXITCODE."
    }
}

function Resolve-PluginDirectory {
    param(
        [object]$Product,
        [string]$SourceDir
    )

    # Most plugins keep exactly one checked-in *.sdPlugin folder at the source root.
    # Multi-flavor products may instead build several bundles deterministically into
    # out/. Those products declare ship_plugin_dir in products/<slug>.json so Rat
    # Ship can select the exact shipping flavor without guessing.
    if ($null -ne $Product.ship_plugin_dir -and ([string]$Product.ship_plugin_dir).Trim()) {
        $relative = ([string]$Product.ship_plugin_dir).Trim() -replace '/', '\'
        $candidate = Join-Path $SourceDir $relative
        if (-not (Test-Path $candidate -PathType Container)) {
            throw "Configured ship_plugin_dir for '$PluginSlug' does not exist after build: $candidate"
        }
        if ([System.IO.Path]::GetFileName($candidate) -notlike '*.sdPlugin') {
            throw "Configured ship_plugin_dir for '$PluginSlug' must resolve to a *.sdPlugin directory: $candidate"
        }
        return (Resolve-Path $candidate).Path
    }

    $manifestDirs = @(Get-ChildItem -Path $SourceDir -Directory -Filter *.sdPlugin)
    if ($manifestDirs.Count -ne 1) {
        throw "Expected exactly one top-level *.sdPlugin directory under $SourceDir; found $($manifestDirs.Count). Multi-flavor products must declare ship_plugin_dir in products/$PluginSlug.json."
    }
    return $manifestDirs[0].FullName
}

if ($PluginSlug -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') {
    throw "Invalid Stream Deck plugin slug: $PluginSlug"
}

$productPath = Join-Path $RepoRoot "products\$PluginSlug.json"
if (-not (Test-Path $productPath)) {
    throw "Canonical product registry entry not found: $productPath"
}
$product = Get-Content $productPath -Raw | ConvertFrom-Json
if ($product.type -ne "plugin") {
    throw "Product '$PluginSlug' is '$($product.type)', not a Stream Deck plugin."
}
if (-not $product.source) {
    throw "Product '$PluginSlug' does not declare a canonical source path."
}

$sourceDir = Join-Path $RepoRoot ([string]$product.source -replace '/', '\')
$submissionPath = Join-Path $sourceDir "submission.json"
$packageJson = Join-Path $sourceDir "package.json"
$packageLock = Join-Path $sourceDir "package-lock.json"
if (-not (Test-Path $sourceDir) -or -not (Test-Path $submissionPath) -or -not (Test-Path $packageJson)) {
    throw "Stream Deck Rat Ship cannot find canonical source, package.json, and submission.json for '$PluginSlug'."
}

$submission = Get-Content $submissionPath -Raw | ConvertFrom-Json
if ($submission.type -ne "plugin" -or $submission.slug -ne $PluginSlug) {
    throw "submission.json does not match Stream Deck plugin '$PluginSlug'."
}
if ($null -ne $product.price_usd -and $null -ne $submission.price_usd -and [decimal]$submission.price_usd -ne [decimal]$product.price_usd) {
    throw "submission.json price_usd ($($submission.price_usd)) does not match products/$PluginSlug.json ($($product.price_usd))."
}
if ($product.version -and $submission.version -and ([string]$submission.version) -ne ([string]$product.version)) {
    throw "submission.json version ($($submission.version)) does not match products/$PluginSlug.json ($($product.version))."
}

Require-Command "node" "Install Node.js 24 or newer."
Require-Command "npm" "Install Node.js 24 or newer."
Require-Command "npx" "Install Node.js 24 or newer."

if (Test-Path $Destination) { Remove-Item $Destination -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Destination | Out-Null
$packageOut = Join-Path $Destination "package"
New-Item -ItemType Directory -Force -Path $packageOut | Out-Null

Push-Location $sourceDir
try {
    if (Test-Path $packageLock) {
        Invoke-Step "install locked dependencies" { & npm ci --no-fund --no-audit }
    }
    else {
        Invoke-Step "install dependencies" { & npm install --no-fund --no-audit }
    }
    Invoke-Step "build plugin and bundled assets" { & npm run build }
    Invoke-Step "run plugin tests" { & npm test }

    $pluginDir = Resolve-PluginDirectory -Product $product -SourceDir $sourceDir
    Write-Host "Local Rat Ship plugin: selected bundle $pluginDir" -ForegroundColor DarkGray
    Invoke-Step "official Elgato validation" { & npx streamdeck validate $pluginDir --no-update-check }
    Invoke-Step "official Elgato package" { & npx streamdeck pack $pluginDir --output $packageOut --force --no-update-check --no-file-list }
}
finally {
    Pop-Location
}

$pluginPackages = @(Get-ChildItem -Path $packageOut -File -Filter *.streamDeckPlugin)
if ($pluginPackages.Count -ne 1) {
    throw "Official Elgato package command completed but expected exactly one .streamDeckPlugin file; found $($pluginPackages.Count)."
}
$canonicalPackage = Join-Path $Destination "$PluginSlug.streamDeckPlugin"
Copy-Item $pluginPackages[0].FullName $canonicalPackage -Force
Remove-Item $packageOut -Recurse -Force

Copy-Item $submissionPath (Join-Path $Destination "submission.json") -Force
Set-Content -Path (Join-Path $Destination "PASTE_description.txt") -Value ([string]$submission.description).Trim() -Encoding UTF8
Set-Content -Path (Join-Path $Destination "PASTE_release_notes.txt") -Value ([string]$submission.release_notes).Trim() -Encoding UTF8

$artScript = Join-Path $sourceDir "rat-art.ps1"
if (Test-Path $artScript) {
    & $artScript -Destination $Destination
    if ($LASTEXITCODE -ne 0) { throw "Product Rat Art failed with exit code $LASTEXITCODE." }
}
else {
    Write-Host "Local Rat Ship plugin: no product rat-art.ps1 yet; package kit created without Marketplace media." -ForegroundColor Yellow
}

$requiredMedia = @("01_search_icon.png", "02_cover.png", "03_gallery_01.png", "04_gallery_02.png", "05_gallery_03.png", "06_gallery_04.png")
$missingMedia = @($requiredMedia | Where-Object { -not (Test-Path (Join-Path $Destination $_)) })
if ($missingMedia.Count) {
    Write-Host "Plugin kit package is valid, but Marketplace media is incomplete: $($missingMedia -join ', ')" -ForegroundColor Yellow
}
else {
    Write-Host "Plugin kit media preflight passed." -ForegroundColor Green
}

if ($null -eq $submission.price_usd) {
    Write-Host "Plugin kit is ready, but Maker Console staging/submission is intentionally blocked until submission.price_usd is explicitly set." -ForegroundColor Yellow
}

Write-Host "Stream Deck plugin ship kit ready at:`n$Destination" -ForegroundColor Green
