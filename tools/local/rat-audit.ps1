param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$Slug,
    [Parameter(Position = 1)]
    [string]$Mode = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Worktree = Join-Path $RepoRoot "out\dev\worktrees\$Slug"
$Probe = [string]::Equals($Mode, "--probe", [System.StringComparison]::OrdinalIgnoreCase)

if ($Mode -and -not $Probe) {
    throw "Unknown Rat Audit option '$Mode'. Supported option: --probe"
}

if (-not (Test-Path $Worktree -PathType Container)) {
    throw "No Rat Dev worktree exists for '$Slug'. Run 'rat dev $Slug' first, then rerun 'rat audit $Slug'."
}

function Get-GitValue {
    param([string[]]$Arguments)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $value = (& git -C $Worktree @Arguments 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -eq 0 -and $value) { return $value }
    }
    finally {
        $ErrorActionPreference = $previous
    }
    return "unknown"
}

function Find-AuditScript {
    $preferred = @(
        (Join-Path $Worktree "plugins\$Slug\scripts\host-audit.ps1"),
        (Join-Path $Worktree "scripts\host-audit.ps1")
    )
    foreach ($path in $preferred) {
        if (Test-Path $path -PathType Leaf) { return (Resolve-Path $path).Path }
    }

    $matches = @(Get-ChildItem $Worktree -Filter "host-audit.ps1" -File -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '[\\/](node_modules|\.git)[\\/]' } |
        Sort-Object { $_.FullName.Length })
    if ($matches.Count -eq 1) { return $matches[0].FullName }
    if ($matches.Count -gt 1) {
        $paths = ($matches | Select-Object -ExpandProperty FullName) -join [Environment]::NewLine
        throw "Multiple host audit scripts were found for '$Slug'. Rat Audit will not guess:`n$paths"
    }
    throw "'$Slug' does not expose scripts/host-audit.ps1 in its Rat Dev worktree. This product does not support 'rat audit' yet."
}

function Invoke-ChildPowerShell {
    param([string]$ScriptPath)
    $engine = (Get-Process -Id $PID).Path
    $arguments = @("-NoLogo", "-NoProfile")
    if ($IsWindows -or $env:OS -eq "Windows_NT") {
        $arguments += @("-ExecutionPolicy", "Bypass")
    }
    $arguments += @("-File", $ScriptPath)
    & $engine @arguments
    $code = $LASTEXITCODE
    if ($code -ne 0) {
        throw "Host audit failed for '$Slug' (exit code $code). Keep the audit output and product logs intact before changing or reinstalling anything."
    }
}

$auditPath = Find-AuditScript
$productRoot = Split-Path (Split-Path $auditPath -Parent) -Parent
$commit = Get-GitValue @("rev-parse", "HEAD")
$branch = Get-GitValue @("branch", "--show-current")
if ($branch -eq "unknown" -or [string]::IsNullOrWhiteSpace($branch)) { $branch = "detached" }

Write-Host "Rat Audit: $Slug" -ForegroundColor Cyan
Write-Host "Source commit: $commit"
Write-Host "Source branch: $branch"
Write-Host "Product root: $productRoot"
Write-Host "Audit script: $auditPath"
Write-Host ""

Invoke-ChildPowerShell $auditPath

if ($Probe) {
    $packagePath = Join-Path $productRoot "package.json"
    if (-not (Test-Path $packagePath -PathType Leaf)) {
        throw "'$Slug' passed its host audit but has no package.json for the optional probe."
    }
    $package = Get-Content $packagePath -Raw | ConvertFrom-Json
    if (-not $package.scripts -or -not $package.scripts.'host:probe') {
        throw "'$Slug' passed its host audit but does not define an npm 'host:probe' script."
    }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw "npm is required for '$Slug' host:probe. Install Node.js/npm and retry."
    }

    Write-Host ""
    Write-Host "Running $Slug deep host probe..." -ForegroundColor Cyan
    Push-Location $productRoot
    try {
        & npm run host:probe
        if ($LASTEXITCODE -ne 0) {
            throw "Deep host probe failed for '$Slug' (exit code $LASTEXITCODE). Keep the output and product logs intact before changing or reinstalling anything."
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "Rat Audit completed for $Slug." -ForegroundColor Green
if (-not $Probe) {
    Write-Host "For a deeper product transport probe when supported: rat audit $Slug --probe" -ForegroundColor DarkGray
}
