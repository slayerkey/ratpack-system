$ErrorActionPreference = "Stop"

function Invoke-RatWorktreeGit {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [switch]$Quiet
    )

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & git -C $RepoRoot @Arguments 2>&1
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
    }

    if (-not $Quiet -and $output) {
        $output | ForEach-Object { Write-Host ([string]$_) }
    }
    if ($code -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $code"
    }
    return @($output)
}

function Assert-RatCanonicalClean {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [string]$Context = "Rat operation"
    )

    $dirty = ((Invoke-RatWorktreeGit -RepoRoot $RepoRoot -Arguments @("status", "--porcelain") -Quiet) -join "`n").Trim()
    if ($dirty) {
        throw "$Context changed the canonical RatPack checkout. Isolated build invariant violated.`n$dirty"
    }
}

function New-RatDisposableWorktree {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$Label
    )

    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        throw "Git is required for isolated Rat builds."
    }

    Assert-RatCanonicalClean -RepoRoot $RepoRoot -Context "Isolated Rat build preflight"

    $safeLabel = ($Label -replace '[^A-Za-z0-9._-]+', '-').Trim('-')
    if (-not $safeLabel) { $safeLabel = "build" }

    $base = Join-Path ([System.IO.Path]::GetTempPath()) "PackRat\worktrees"
    New-Item -ItemType Directory -Force -Path $base | Out-Null
    $leaf = "{0}-{1}-{2}" -f $safeLabel, $PID, ([Guid]::NewGuid().ToString('N').Substring(0, 10))
    $path = Join-Path $base $leaf

    Invoke-RatWorktreeGit -RepoRoot $RepoRoot -Arguments @("worktree", "prune") -Quiet | Out-Null
    $head = ((Invoke-RatWorktreeGit -RepoRoot $RepoRoot -Arguments @("rev-parse", "HEAD") -Quiet) -join "`n").Trim()
    if (-not $head) { throw "Could not resolve canonical HEAD for isolated Rat build." }

    Write-Host "Preparing isolated Rat build worktree at $path" -ForegroundColor DarkGray
    Invoke-RatWorktreeGit -RepoRoot $RepoRoot -Arguments @("worktree", "add", "--detach", "--force", $path, $head) -Quiet | Out-Null

    return $path
}

function Add-RatSharedNodeModulesJunction {
    param(
        [Parameter(Mandatory = $true)][string]$WorktreeRoot,
        [Parameter(Mandatory = $true)][string]$SharedNodeModules
    )

    if (-not (Test-Path $SharedNodeModules)) { return $null }

    $toolsRoot = Join-Path $WorktreeRoot "tools"
    if (-not (Test-Path $toolsRoot)) {
        throw "Isolated Rat worktree is missing tools/: $toolsRoot"
    }

    $link = Join-Path $toolsRoot "node_modules"
    if (Test-Path $link) { return $link }

    Write-Host "Reusing shared Rat Ship Node dependencies in isolated worktree." -ForegroundColor DarkGray
    New-Item -ItemType Junction -Path $link -Target $SharedNodeModules | Out-Null
    return $link
}

function Remove-RatDisposableWorktree {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$WorktreeRoot
    )

    if (-not $WorktreeRoot) { return }

    # Remove a shared node_modules junction explicitly before deleting the worktree.
    # This removes only the reparse point and never the shared dependency target.
    $nodeModules = Join-Path $WorktreeRoot "tools\node_modules"
    if (Test-Path $nodeModules) {
        try {
            $item = Get-Item -LiteralPath $nodeModules -Force
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                & cmd.exe /d /c "rmdir `"$nodeModules`"" *> $null
            }
        }
        catch {
            Write-Warning "Could not remove isolated node_modules junction before worktree cleanup: $($_.Exception.Message)"
        }
    }

    try {
        Invoke-RatWorktreeGit -RepoRoot $RepoRoot -Arguments @("worktree", "remove", "--force", $WorktreeRoot) -Quiet | Out-Null
    }
    catch {
        Write-Warning "Git worktree cleanup needed a filesystem fallback: $($_.Exception.Message)"
    }

    if (Test-Path $WorktreeRoot) {
        Remove-Item -LiteralPath $WorktreeRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
    try {
        Invoke-RatWorktreeGit -RepoRoot $RepoRoot -Arguments @("worktree", "prune") -Quiet | Out-Null
    }
    catch {
        Write-Warning "Could not prune stale Rat worktree metadata: $($_.Exception.Message)"
    }
}
