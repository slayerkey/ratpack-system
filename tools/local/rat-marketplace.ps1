param(
    [Parameter(Position = 0, Mandatory = $true)]
    [ValidateSet("ship","submit","stage","kit")]
    [string]$Action,

    [Parameter(Position = 1, Mandatory = $true)]
    [string]$Slug,

    [Parameter(Position = 2, ValueFromRemainingArguments = $true)]
    [string[]]$AdditionalSlugs = @()
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$LegacyRat = Join-Path $PSScriptRoot "rat.ps1"
$PluginKit = Join-Path $PSScriptRoot "rat-ship-plugin.ps1"
$IconPackKit = Join-Path $PSScriptRoot "rat-ship-icon-pack.ps1"
$MakerConsole = Join-Path $PSScriptRoot "rat-maker-console.ps1"

if (-not (Test-Path $LegacyRat)) { throw "Canonical rat.ps1 not found: $LegacyRat" }
if (-not (Test-Path $PluginKit)) { throw "Stream Deck plugin ship helper not found: $PluginKit" }
if (-not (Test-Path $IconPackKit)) { throw "Stream Deck icon-pack kit helper not found: $IconPackKit" }
if (-not (Test-Path $MakerConsole)) { throw "Maker Console helper not found: $MakerConsole" }

function Get-UnmergedProductDetails {
    param([string]$ProductSlug)

    $candidateRefs = @(
        "refs/remotes/origin/product/$ProductSlug",
        "refs/heads/product/$ProductSlug"
    )

    foreach ($candidateRef in $candidateRefs) {
        & git -C $RepoRoot rev-parse --verify --quiet $candidateRef *> $null
        if ($LASTEXITCODE -ne 0) { continue }

        $productSpec = "{0}:products/{1}.json" -f $candidateRef, $ProductSlug
        $productRaw = (& git -C $RepoRoot show $productSpec 2>$null | Out-String).Trim()
        if (-not $productRaw) { continue }

        try {
            $product = $productRaw | ConvertFrom-Json
        }
        catch {
            continue
        }

        $submission = $null
        if ($product.source) {
            $source = ([string]$product.source).TrimEnd('/')
            $submissionSpec = "{0}:{1}/submission.json" -f $candidateRef, $source
            $submissionRaw = (& git -C $RepoRoot show $submissionSpec 2>$null | Out-String).Trim()
            if ($submissionRaw) {
                try { $submission = $submissionRaw | ConvertFrom-Json } catch { $submission = $null }
            }
        }

        return [PSCustomObject]@{
            Ref = $candidateRef
            Product = $product
            Submission = $submission
        }
    }

    return $null
}

function Assert-ProductReleaseState {
    param(
        [object]$Product,
        [string]$ProductSlug,
        [string]$RequestedAction
    )

    # Non-public preparation remains available while a product is blocked. Rat Ship
    # and Rat Submit advance into authenticated Marketplace submission, so they fail
    # closed until the canonical product workflow state is no longer blocked.
    if ($RequestedAction -notin @("ship", "submit")) { return }

    $state = if ($null -ne $Product.workflow_state) { ([string]$Product.workflow_state).Trim() } else { "" }
    $isBlocked = $state.Equals("BLOCKED", [System.StringComparison]::OrdinalIgnoreCase) -or
        $state.StartsWith("BLOCKED_", [System.StringComparison]::OrdinalIgnoreCase)
    if (-not $isBlocked) { return }

    $blocker = if ($null -ne $Product.blocker) { ([string]$Product.blocker).Trim() } else { "" }
    $boundary = if ($null -ne $Product.final_boundary) { ([string]$Product.final_boundary).Trim() } else { "" }
    $message = "Product '$ProductSlug' is marked '$state' on canonical main. Rat $RequestedAction will not submit a blocked release to Marketplace."
    if ($blocker) {
        $message += " Blocker: $blocker."
    }
    elseif ($boundary) {
        $message += " Required boundary: $boundary."
    }
    $message += " Resolve the blocker and move products/$ProductSlug.json to READY_TO_SHIP before shipping."
    if ($Product.type -eq "icon_pack") {
        $message += " You can still run 'rat kit $ProductSlug' for non-public review preparation."
    }
    else {
        $message += " You can still run 'rat kit $ProductSlug' or 'rat stage $ProductSlug' for non-public preparation."
    }
    throw $message
}

$queue = @(@($Slug) + @($AdditionalSlugs) | ForEach-Object { if ($_ -and $_.Trim()) { $_.Trim() } })
if (-not $queue.Count) { throw "rat $Action needs at least one product slug." }

# Preserve the canonical shipping invariant: Marketplace operations always ship
# committed main, never an arbitrary product branch or dirty local candidate.
& $LegacyRat main
if ($LASTEXITCODE -ne 0) { throw "Could not sync canonical main before Rat Ship." }

Write-Host "Rat $Action queue: $($queue -join ', ')" -ForegroundColor Cyan
$completed = @()
$failures = @()

for ($i = 0; $i -lt $queue.Count; $i++) {
    $item = $queue[$i]
    Write-Host ""
    Write-Host "[$($i + 1)/$($queue.Count)] $Action $item" -ForegroundColor Cyan

    try {
        $productPath = Join-Path $RepoRoot "products\$item.json"

        if (-not (Test-Path $productPath)) {
            $unmerged = Get-UnmergedProductDetails -ProductSlug $item
            if ($null -ne $unmerged) {
                $branchName = "product/$item"
                $message = "Product '$item' exists on canonical branch '$branchName' but is not merged into main. Rat $Action ships committed main only and will not package or submit an unmerged release candidate."

                if ($null -ne $unmerged.Submission -and $null -eq $unmerged.Submission.price_usd) {
                    $message += " Its Marketplace price is also unset, so stage/ship would still be blocked after merge until submission.price_usd is explicitly approved."
                }

                $message += " Finish the product release gate, merge '$branchName' into main, then rerun: rat $Action $item"
                throw $message
            }

            throw "Product '$item' is not registered on canonical main. Expected: products/$item.json"
        }

        $product = Get-Content $productPath -Raw | ConvertFrom-Json
        Assert-ProductReleaseState -Product $product -ProductSlug $item -RequestedAction $Action

        $isIconPack = $product.type -eq "icon_pack"
        if ($isIconPack) {
            if ($Action -ne "kit") {
                throw "Stream Deck icon packs currently support 'rat kit' only. Rat $Action will not create or modify a Maker Console draft until the official Icon Pack Man package flow and the Maker Console Icon Pack product route are validated end to end. Build the review kit with: rat kit $item"
            }

            $dest = Join-Path $RepoRoot "out\ship\$item"
            & $IconPackKit -IconPackSlug $item -Destination $dest
            if ($LASTEXITCODE -ne 0) { throw "Stream Deck icon-pack review-kit build failed for '$item'." }
            Start-Process explorer.exe $dest
            $completed += $item
            continue
        }

        $isPlugin = $product.type -eq "plugin"
        if (-not $isPlugin) {
            # Existing XENEON/widget products stay on the proven legacy pipeline.
            & $LegacyRat $Action $item
            if ($LASTEXITCODE -ne 0) { throw "Legacy Rat $Action failed for '$item'." }
            $completed += $item
            continue
        }

        $dest = Join-Path $RepoRoot "out\ship\$item"
        & $PluginKit -PluginSlug $item -Destination $dest
        if ($LASTEXITCODE -ne 0) { throw "Stream Deck plugin ship-kit build failed for '$item'." }

        if ($Action -eq "kit") {
            Start-Process explorer.exe $dest
            $completed += $item
            continue
        }

        $submit = $Action -in @("ship","submit")
        & $MakerConsole -Slug $item -Kit $dest -Submit:$submit
        if ($LASTEXITCODE -ne 0) { throw "Maker Console failed for '$item'." }
        $completed += $item
    }
    catch {
        $failures += [PSCustomObject]@{ Slug = $item; Message = $_.Exception.Message }
        Write-Host "Rat $Action failed for '$item'. Continuing the remaining queue." -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Rat $Action queue finished." -ForegroundColor Cyan
if ($completed.Count) { Write-Host "Completed: $($completed -join ', ')" -ForegroundColor Green }
if ($failures.Count) {
    Write-Host "Failed:" -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host "  $($failure.Slug): $($failure.Message)" -ForegroundColor Red
    }
    throw "Rat $Action finished with $($failures.Count) failed product(s)."
}
