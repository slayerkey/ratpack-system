param(
    [Parameter(Mandatory = $true)]
    [string]$IconPackSlug,

    [Parameter(Mandatory = $true)]
    [string]$Destination
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$GeneratedSourceRoot = Join-Path $RepoRoot "out\icon-pack-sources"

function Require-Command {
    param([string]$Name, [string]$Hint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required for local Stream Deck icon-pack kit generation. $Hint"
    }
}

function Invoke-ExternalStep {
    param([string]$Label, [scriptblock]$Command)
    Write-Host "Local Rat icon pack: $Label..." -ForegroundColor DarkGray
    & $Command | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "Local Rat icon pack failed during '$Label' with exit code $LASTEXITCODE."
    }
}

if ($IconPackSlug -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') {
    throw "Invalid Stream Deck icon-pack slug: $IconPackSlug"
}

$productPath = Join-Path $RepoRoot "products\$IconPackSlug.json"
if (-not (Test-Path $productPath)) {
    throw "Canonical product registry entry not found: $productPath"
}
$product = Get-Content $productPath -Raw | ConvertFrom-Json
if ($product.type -ne "icon_pack") {
    throw "Product '$IconPackSlug' is '$($product.type)', not a Stream Deck icon pack."
}

$factory = $product.icon_factory
if ($null -eq $factory) {
    throw "Icon pack '$IconPackSlug' does not declare icon_factory metadata."
}
$factoryRepository = ([string]$factory.repository).Trim()
$factoryCommit = ([string]$factory.commit).Trim()
$factoryProduct = ([string]$factory.product).Trim()
if (-not $factoryRepository -or -not $factoryCommit -or -not $factoryProduct) {
    throw "Icon pack '$IconPackSlug' requires icon_factory.repository, icon_factory.commit, and icon_factory.product."
}
if ($factoryCommit -notmatch '^[0-9a-fA-F]{40}$') {
    throw "icon_factory.commit must be one exact 40-character Git commit SHA. Moving branches are not accepted by Rat icon-pack kits."
}
if (-not $product.marketplace_id) {
    throw "Icon pack '$IconPackSlug' must declare marketplace_id."
}

Require-Command "git" "Install Git for Windows first."
Require-Command "python" "Install Python 3.11 or newer first."

New-Item -ItemType Directory -Force -Path $GeneratedSourceRoot | Out-Null
$factoryRoot = Join-Path $GeneratedSourceRoot $IconPackSlug
if (-not (Test-Path (Join-Path $factoryRoot ".git"))) {
    if (Test-Path $factoryRoot) { Remove-Item $factoryRoot -Recurse -Force }
    Invoke-ExternalStep "clone icon factory controller" {
        & git clone --filter=blob:none --no-checkout $factoryRepository $factoryRoot
    }
}

$origin = ((& git -C $factoryRoot remote get-url origin 2>&1) -join "`n").Trim()
if ($LASTEXITCODE -ne 0) { throw "Could not read icon-factory origin in $factoryRoot" }
if ($origin.TrimEnd('/') -ne $factoryRepository.TrimEnd('/')) {
    throw "Existing generated icon-factory checkout points to '$origin', expected '$factoryRepository'. Delete $factoryRoot and retry if this checkout is disposable."
}

# This checkout lives under ignored out/ and is exclusively a generated Rat build controller.
# Resetting and cleaning it cannot touch the user's working icon-factory checkout.
Invoke-ExternalStep "refresh exact factory commit" {
    & git -C $factoryRoot fetch --prune origin
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & git -C $factoryRoot fetch --depth=1 origin $factoryCommit
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & git -C $factoryRoot reset --hard
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & git -C $factoryRoot clean -fdx
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & git -C $factoryRoot checkout --detach $factoryCommit
}

$actualHead = ((& git -C $factoryRoot rev-parse HEAD 2>&1) -join "`n").Trim()
if ($LASTEXITCODE -ne 0 -or $actualHead -ne $factoryCommit) {
    throw "Icon factory source identity mismatch. Expected $factoryCommit, got '$actualHead'."
}

$requirements = Join-Path $factoryRoot "tools\icons\requirements.txt"
$runner = Join-Path $factoryRoot "tools\icons\rat_icons.py"
if (-not (Test-Path $requirements) -or -not (Test-Path $runner)) {
    throw "Pinned icon factory commit is missing the V2 requirements or rat_icons.py entry point."
}

Invoke-ExternalStep "install/reuse icon factory runtime" {
    & python -m pip install -r $requirements
}

Push-Location $factoryRoot
try {
    Invoke-ExternalStep "factory preflight" { & python tools/icons/rat_icons.py doctor $factoryProduct }
    Invoke-ExternalStep "prefetch pinned icon sources" { & python tools/icons/rat_icons.py sources $factoryProduct --prefetch }
    Invoke-ExternalStep "build all static icons" { & python tools/icons/rat_icons.py build $factoryProduct --force }
    Invoke-ExternalStep "build semantic animations" { & python tools/icons/rat_icons.py animate $factoryProduct }
    Invoke-ExternalStep "run animated QA" { & python tools/icons/rat_icons.py qa $factoryProduct --animated }
    Invoke-ExternalStep "build factory marketing handoff" { & python tools/icons/rat_icons.py marketing $factoryProduct }
    Invoke-ExternalStep "stage package and local dev installer" { & python tools/icons/rat_icons.py package $factoryProduct --animated }
}
finally {
    Pop-Location
}

$factoryOut = Join-Path $factoryRoot "out\icons\$factoryProduct"
$qaPath = Join-Path $factoryOut "qa\qa-report.json"
$handoffPath = Join-Path $factoryOut "marketing\rat-art-icons.json"
$stage = Join-Path $factoryOut "package-staging"
$packageNotePath = Join-Path $stage "PACKAGING-NOTE.json"
$stagedIconsPath = Join-Path $stage "icons.json"
if (-not (Test-Path $qaPath) -or -not (Test-Path $handoffPath) -or -not (Test-Path $packageNotePath) -or -not (Test-Path $stagedIconsPath)) {
    throw "Factory completed but the deterministic QA/marketing/package handoff is incomplete under $factoryOut"
}

$qa = Get-Content $qaPath -Raw | ConvertFrom-Json
if (-not $qa.pass -or $qa.summary.failures -ne 0 -or $qa.summary.warnings -ne 0) {
    throw "Icon pack QA is not release-clean: failures=$($qa.summary.failures), warnings=$($qa.summary.warnings)."
}
$handoff = Get-Content $handoffPath -Raw | ConvertFrom-Json
$packageNote = Get-Content $packageNotePath -Raw | ConvertFrom-Json
$stagedEntries = @(Get-Content $stagedIconsPath -Raw | ConvertFrom-Json)

if ([string]$packageNote.identifier -ne [string]$product.marketplace_id) {
    throw "Staged production identifier '$($packageNote.identifier)' does not match RatPack product marketplace_id '$($product.marketplace_id)'."
}
if ($null -ne $product.expected_static_icons -and [int]$handoff.actual_icon_count -ne [int]$product.expected_static_icons) {
    throw "Static icon count drift: expected $($product.expected_static_icons), factory produced $($handoff.actual_icon_count)."
}
if ($null -ne $product.expected_animated_icons -and [int]$handoff.animated_icon_count -ne [int]$product.expected_animated_icons) {
    throw "Animated icon count drift: expected $($product.expected_animated_icons), factory produced $($handoff.animated_icon_count)."
}
if ($null -ne $product.expected_picker_entries -and $stagedEntries.Count -ne [int]$product.expected_picker_entries) {
    throw "Picker-entry count drift: expected $($product.expected_picker_entries), staging contains $($stagedEntries.Count)."
}
$duplicateNames = @($stagedEntries | Group-Object { ([string]$_.name).Trim().ToLowerInvariant() } | Where-Object Count -gt 1)
$duplicatePaths = @($stagedEntries | Group-Object { ([string]$_.path).Trim().ToLowerInvariant() } | Where-Object Count -gt 1)
if ($duplicateNames.Count -or $duplicatePaths.Count) {
    throw "Icon-pack staging contains duplicate picker names or paths. Names=$($duplicateNames.Count), paths=$($duplicatePaths.Count)."
}

if (Test-Path $Destination) { Remove-Item $Destination -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Destination | Out-Null
Copy-Item $stage (Join-Path $Destination "package-staging") -Recurse -Force
Copy-Item $handoffPath (Join-Path $Destination "rat-art-icons.json") -Force

$devCandidate = Get-ChildItem -Path $factoryOut -File -Filter "*-DEV.streamDeckIconPack" | Select-Object -First 1
$auditZip = Get-ChildItem -Path $factoryOut -File -Filter "*-iconpack-audit.zip" | Select-Object -First 1
if (-not $devCandidate -or -not $auditZip) {
    throw "Factory package command did not produce the expected development installer and audit ZIP."
}
Copy-Item $devCandidate.FullName (Join-Path $Destination $devCandidate.Name) -Force
Copy-Item $auditZip.FullName (Join-Path $Destination $auditZip.Name) -Force

$submission = [ordered]@{
    slug = $IconPackSlug
    type = "icon_pack"
    name = [string]$product.name
    version = [string]$product.version
    price_usd = $product.price_usd
    marketplace_id = [string]$product.marketplace_id
    description = [string]$product.description
    release_notes = [string]$product.release_notes
    static_icon_count = [int]$handoff.actual_icon_count
    animated_icon_count = [int]$handoff.animated_icon_count
    picker_entry_count = $stagedEntries.Count
}
$submission | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $Destination "submission.json") -Encoding UTF8
Set-Content -Path (Join-Path $Destination "PASTE_description.txt") -Value ([string]$product.description).Trim() -Encoding UTF8
Set-Content -Path (Join-Path $Destination "PASTE_release_notes.txt") -Value ([string]$product.release_notes).Trim() -Encoding UTF8

$identity = [ordered]@{
    schema_version = 1
    ratpack_product = $IconPackSlug
    factory_repository = $factoryRepository
    factory_commit = $factoryCommit
    verified_factory_head = $actualHead
    factory_product = $factoryProduct
    marketplace_id = [string]$product.marketplace_id
    static_icons = [int]$handoff.actual_icon_count
    animated_icons = [int]$handoff.animated_icon_count
    picker_entries = $stagedEntries.Count
    qa_failures = [int]$qa.summary.failures
    qa_warnings = [int]$qa.summary.warnings
}
$identity | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $Destination "SOURCE-IDENTITY.json") -Encoding UTF8

$ratArt = Join-Path $RepoRoot "tools\art\rat_art_icon_pack.py"
$ratAsset = Join-Path $RepoRoot "tools\art\assets\ratpack-icon-transparent.png"
if (-not (Test-Path $ratArt)) { throw "Canonical icon-pack Rat Art renderer missing: $ratArt" }
Invoke-ExternalStep "render deterministic Marketplace media" {
    & python $ratArt --factory-out $factoryOut --out $Destination --rat-asset $ratAsset
}

$iconPackManNote = @"
OFFICIAL MARKETPLACE PACKAGE BOUNDARY

This Rat kit intentionally does not rename or treat the development-ID ZIP as a Marketplace package.

Verified source staging is in:
  package-staging\

Local physical-test installer only:
  $($devCandidate.Name)

Current Elgato icon-pack guidance uses Icon Pack Man for the final Marketplace .streamDeckIconPack package. RatPack does not automate that official packaging step yet.

Production identifier:
  $($product.marketplace_id)

After the physical Stream Deck review passes, use this exact staging directory in the official Icon Pack Man workflow. Do not submit the -DEV package.
"@
Set-Content -Path (Join-Path $Destination "ICON_PACK_MAN_NEXT.txt") -Value $iconPackManNote.Trim() -Encoding UTF8

$physicalNote = @"
PHYSICAL STREAM DECK RELEASE CHECK

1. Install the -DEV.streamDeckIconPack candidate in this kit.
2. Confirm instant glance recognition at normal desk distance with mixed neighboring keys.
3. Check brightness, glare, and color intensity at the normal device brightness.
4. Leave an animated page visible for 5 to 10 minutes and confirm motion does not become distracting or fatiguing.
5. If the physical review passes, keep the factory commit in SOURCE-IDENTITY.json frozen while producing the final Icon Pack Man package and Marketplace listing art.
"@
Set-Content -Path (Join-Path $Destination "PHYSICAL-TEST.txt") -Value $physicalNote.Trim() -Encoding UTF8

$requiredMedia = @(
    "01_search_icon.png",
    "02_cover.png",
    "03_gallery_01.png",
    "04_gallery_02.png",
    "05_gallery_03.png",
    "06_gallery_04.png"
)
$missingMedia = @($requiredMedia | Where-Object { -not (Test-Path (Join-Path $Destination $_)) })
if ($missingMedia.Count) {
    throw "Icon-pack Rat Art is incomplete: $($missingMedia -join ', ')"
}

Write-Host "Stream Deck icon-pack review kit ready at:`n$Destination" -ForegroundColor Green
Write-Host "Pinned factory: $factoryCommit" -ForegroundColor Green
Write-Host "Counts: $($handoff.actual_icon_count) static + $($handoff.animated_icon_count) animated = $($stagedEntries.Count) picker entries" -ForegroundColor Green
Write-Host "Public stage/ship remains intentionally unsupported until Icon Pack Man and Maker Console icon-pack automation are validated." -ForegroundColor Yellow
