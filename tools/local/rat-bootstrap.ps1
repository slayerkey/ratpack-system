$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Invoke-Git {
    param([string[]]$Arguments)

    # Windows PowerShell can surface normal native stderr such as Git fetch progress
    # as NativeCommandError while ErrorActionPreference=Stop. Capture the process
    # output with native errors temporarily non-terminating, then trust the exit code.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & git -C $RepoRoot @Arguments 2>&1
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
    }

    if ($output) { $output | ForEach-Object { Write-Host ([string]$_) } }
    if ($code -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $code"
    }
}

function Get-GitText {
    param([string[]]$Arguments)

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & git -C $RepoRoot @Arguments 2>&1
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
    }

    if ($code -ne 0) {
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
            if (Test-Path $index) {
                $relative = "widgets/$($_.Name)/index.html"
                $tracked = (& git -C $RepoRoot ls-files -- $relative 2>$null | Select-Object -First 1)
                if (-not $tracked) {
                    Remove-Item $index -Force -ErrorAction SilentlyContinue
                }
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
# Fetch main explicitly instead of relying on whatever remote refspec happens to be configured on
# this machine. This prevents a successful fetch from leaving origin/main stale.
Invoke-Git -Arguments @("fetch", "--prune", "origin", "+refs/heads/main:refs/remotes/origin/main")

$branch = Get-GitText -Arguments @("branch", "--show-current")
if ($branch -ne "main") {
    Invoke-Git -Arguments @("switch", "main")
}
Invoke-Git -Arguments @("merge", "--ff-only", "refs/remotes/origin/main")

$localCommit = Get-GitText -Arguments @("rev-parse", "HEAD")
$remoteCommit = Get-GitText -Arguments @("rev-parse", "refs/remotes/origin/main")
if ($localCommit -ne $remoteCommit) {
    throw "RatPack bootstrap did not land on canonical origin/main. Local: $localCommit Remote: $remoteCommit"
}

$commit = Get-GitText -Arguments @("log", "-1", "--pretty=format:%h")
Write-Host "RatPack command layer is current at $commit." -ForegroundColor DarkGray
