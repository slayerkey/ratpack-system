param(
    [Parameter(Mandatory = $true)]
    [string]$WidgetSlug,

    [Parameter(Mandatory = $true)]
    [string]$Destination
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ToolsRoot = Join-Path $RepoRoot "tools"
$ShipToolRoot = Join-Path $ToolsRoot "ship"
$WorkRoot = Join-Path $RepoRoot "out\ship-local\$WidgetSlug"

function Require-LocalCommand {
    param([string]$Name, [string]$Hint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required for local Rat Ship. $Hint"
    }
}

function Invoke-LocalStep {
    param(
        [string]$Label,
        [scriptblock]$Command
    )
    Write-Host "Local Rat Ship: $Label..." -ForegroundColor DarkGray
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Local Rat Ship failed during '$Label' with exit code $LASTEXITCODE."
    }
}

function Ensure-LocalDependencies {
    Require-LocalCommand "python" "Install Python 3.13 or a compatible Python 3 release."
    Require-LocalCommand "node" "Install Node.js."
    Require-LocalCommand "npm" "Install Node.js."
    Require-LocalCommand "npx" "Install Node.js."

    & python -c "import PIL,sys; sys.exit(0 if PIL.__version__ == '12.3.0' else 1)" *> $null
    if ($LASTEXITCODE -ne 0) {
        Invoke-LocalStep "install Pillow 12.3.0" { & python -m pip install --disable-pip-version-check Pillow==12.3.0 }
    }

    $playwrightModule = Join-Path $ToolsRoot "node_modules\playwright"
    if (-not (Test-Path $playwrightModule)) {
        Invoke-LocalStep "install Playwright 1.62.1" { & npm install --prefix $ToolsRoot --no-save --package-lock=false --no-fund --no-audit playwright@1.62.1 }
    }

    $playwrightCmd = Join-Path $ToolsRoot "node_modules\.bin\playwright.cmd"
    if (-not (Test-Path $playwrightCmd)) {
        throw "Playwright installed without its command shim at $playwrightCmd"
    }
    Invoke-LocalStep "ensure Chromium runtime" { & $playwrightCmd install chromium }
}

if ($WidgetSlug -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') {
    throw "Invalid XENEON widget slug: $WidgetSlug"
}

$sourceDir = Join-Path $RepoRoot "widgets\_src\$WidgetSlug"
$shippingDir = Join-Path $RepoRoot "widgets\$WidgetSlug"
$submissionSource = Join-Path $sourceDir "submission.json"
if (-not (Test-Path $sourceDir) -or -not (Test-Path $shippingDir) -or -not (Test-Path $submissionSource)) {
    throw "Local Rat Ship cannot find the canonical source/shipping files for '$WidgetSlug'."
}

Ensure-LocalDependencies

if (Test-Path $WorkRoot) { Remove-Item $WorkRoot -Recurse -Force }
if (Test-Path $Destination) { Remove-Item $Destination -Recurse -Force }
New-Item -ItemType Directory -Force -Path $WorkRoot | Out-Null
New-Item -ItemType Directory -Force -Path $Destination | Out-Null

$shots = Join-Path $WorkRoot "shots"
$review = Join-Path $WorkRoot "review"
$packageDir = Join-Path $WorkRoot "package"
New-Item -ItemType Directory -Force -Path $packageDir | Out-Null

Push-Location $RepoRoot
try {
    Invoke-LocalStep "build canonical shipping widget" { & python tools/xeneon/inline.py $WidgetSlug }

    & git diff --quiet -- "widgets/$WidgetSlug"
    if ($LASTEXITCODE -ne 0) {
        throw "Canonical local build changed tracked widgets/$WidgetSlug files. Commit the generated shipping output before Rat Ship so the local fallback cannot ship uncommitted drift."
    }

    Invoke-LocalStep "official CORSAIR validation" { & npx --yes icuewidget-cli@0.4.47 validate "widgets/$WidgetSlug" }

    $packageStarted = Get-Date
    Invoke-LocalStep "official CORSAIR package" { & npx --yes icuewidget-cli@0.4.47 package "widgets/$WidgetSlug" }
    $pkg = Get-ChildItem -Path (Join-Path $RepoRoot "widgets") -Filter *.icuewidget -File |
        Where-Object { $_.LastWriteTime -ge $packageStarted.AddSeconds(-2) } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $pkg) {
        throw "Official CORSAIR package command completed but no fresh .icuewidget package was found."
    }
    $canonicalPackage = Join-Path $packageDir "$WidgetSlug.icuewidget"
    Copy-Item $pkg.FullName $canonicalPackage -Force

    Invoke-LocalStep "capture real widget for Rat Art" { & node tools/art/capture_xeneon.mjs $WidgetSlug $shots }

    $oldFont = $env:RATPACK_ART_FONT
    $oldFontBold = $env:RATPACK_ART_FONT_BOLD
    try {
        $env:RATPACK_ART_FONT = Join-Path $env:WINDIR "Fonts\segoeui.ttf"
        $env:RATPACK_ART_FONT_BOLD = Join-Path $env:WINDIR "Fonts\segoeuib.ttf"
        Invoke-LocalStep "render deterministic Rat Art" { & python tools/art/rat_art.py xeneon $WidgetSlug --shots $shots --out $review }
    }
    finally {
        $env:RATPACK_ART_FONT = $oldFont
        $env:RATPACK_ART_FONT_BOLD = $oldFontBold
    }

    Invoke-LocalStep "render canonical search icon" { & node tools/ship/render_svg_icon.mjs "widgets/$WidgetSlug/resources/icon.svg" (Join-Path $review "icon-288x288.png") }

    Invoke-LocalStep "build Maker Console SHIP_KIT" { & python tools/ship/make_xeneon_kit.py $WidgetSlug --package $canonicalPackage --art $review --out $Destination }

    Invoke-LocalStep "Playwright driver kit preflight" { & node tools/ship/maker_console.mjs $WidgetSlug "--kit=$Destination" --check-kit }

    $source = Get-Content $submissionSource -Raw | ConvertFrom-Json
    $subPath = Join-Path $Destination "submission.json"
    if (-not (Test-Path $subPath)) { throw "Local SHIP_KIT is missing submission.json" }
    $sub = Get-Content $subPath -Raw | ConvertFrom-Json
    if ($source.type -ne 'widget' -or $sub.type -ne 'widget') { throw "Local SHIP_KIT submission type must be widget" }
    if ($sub.slug -ne $WidgetSlug) { throw "Local SHIP_KIT submission slug mismatch" }
    if ($sub.name -ne $source.name) { throw "Local SHIP_KIT submission name mismatch" }
    if ([decimal]$sub.price_usd -ne [decimal]$source.price_usd) { throw "Local SHIP_KIT submission price mismatch" }
    if ($sub.version -ne $source.version) { throw "Local SHIP_KIT submission version mismatch" }

    if (-not (Test-Path (Join-Path $Destination "$WidgetSlug.icuewidget"))) {
        throw "Local SHIP_KIT is missing the official widget package"
    }
    foreach ($file in @('01_search_icon.png','02_cover.png','03_gallery_01.png','04_gallery_02.png','05_gallery_03.png','06_gallery_04.png')) {
        if (-not (Test-Path (Join-Path $Destination $file))) {
            throw "Local SHIP_KIT is missing $file"
        }
    }
}
finally {
    Pop-Location
}

Write-Host "Local Rat Ship kit is ready at:`n$Destination" -ForegroundColor Green
