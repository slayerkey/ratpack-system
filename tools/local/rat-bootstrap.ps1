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

function Remove-KnownGeneratedArtifacts {
    $widgetsRoot = Join-Path $RepoRoot "widgets"
    if (-not (Test-Path $widgetsRoot)) { return }

    Get-ChildItem -Path $widgetsRoot -Filter *.icuewidget -File -ErrorAction SilentlyContinue |
        Remove-Item -Force -ErrorAction SilentlyContinue

    Get-ChildItem -Path $widgetsRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne "_src" -and $_.Name -notlike "_*" } |
        ForEach-Object {
            $index = Join-Path $_.FullName "index.html"
            if (-not (Test-Path $index)) { return }

            $relative = "widgets/$($_.Name)/index.html"
            & git -C $RepoRoot ls-files --error-unmatch -- $relative *> $null
            if ($LASTEXITCODE -ne 0) {
                Remove-Item $index -Force -ErrorAction SilentlyContinue
            }
        }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is required for RatPack commands."
}

# Local XENEON build/package outputs are disposable and must never block a
# self-updating Rat command. Only known generated paths are cleaned here.
Remove-KnownGeneratedArtifacts

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
