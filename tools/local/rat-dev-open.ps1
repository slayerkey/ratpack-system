param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$Slug
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Worktree = Join-Path $RepoRoot "out\dev\worktrees\$Slug"
$Preferred = Join-Path $Worktree "plugins\$Slug"

if (Test-Path $Preferred) {
    Start-Process explorer.exe $Preferred
    Write-Host "Opened Rat Dev folder: $Preferred" -ForegroundColor Green
    exit 0
}

if (Test-Path $Worktree) {
    Start-Process explorer.exe $Worktree
    Write-Host "Opened Rat Dev worktree: $Worktree" -ForegroundColor Green
    exit 0
}

Write-Host "No local Rat Dev worktree exists yet for '$Slug'. Run: rat dev $Slug" -ForegroundColor Yellow
exit 1
