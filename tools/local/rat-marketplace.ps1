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
$MakerConsole = Join-Path $PSScriptRoot "rat-maker-console.ps1"

if (-not (Test-Path $LegacyRat)) { throw "Canonical rat.ps1 not found: $LegacyRat" }
if (-not (Test-Path $PluginKit)) { throw "Stream Deck plugin ship helper not found: $PluginKit" }
if (-not (Test-Path $MakerConsole)) { throw "Maker Console helper not found: $MakerConsole" }

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
        $isPlugin = $false
        if (Test-Path $productPath) {
            $product = Get-Content $productPath -Raw | ConvertFrom-Json
            $isPlugin = $product.type -eq "plugin"
        }

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
