$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Invoke-Git {
    param([string[]]$Arguments)
    & git -C $RepoRoot @Arguments | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Get-GitText {
    param([string[]]$Arguments)
    $output = & git -C $RepoRoot @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed: $($output -join ' ')"
    }
    return (($output -join "`n").Trim())
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is required for RatPack commands."
}

$dirty = Get-GitText -Arguments @("status", "--porcelain")
if ($dirty) {
    throw "The canonical RatPack checkout has local changes. Commit or stash them before running a self-updating Rat command.`n$dirty"
}

Write-Host "Refreshing RatPack command layer..." -ForegroundColor DarkGray
Invoke-Git -Arguments @("fetch", "--prune", "origin")

$branch = Get-GitText -Arguments @("branch", "--show-current")
if ($branch -ne "main") {
    Invoke-Git -Arguments @("switch", "main")
}
Invoke-Git -Arguments @("pull", "--ff-only", "origin", "main")

$commit = Get-GitText -Arguments @("log", "-1", "--pretty=format:%h")
Write-Host "RatPack command layer is current at $commit." -ForegroundColor DarkGray
