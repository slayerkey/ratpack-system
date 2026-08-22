param(
    [Parameter(Position = 0)]
    [string]$Action = "status",

    [Parameter(Position = 1)]
    [string]$Slug = "now-playing"
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Require-Command {
    param([string]$Name, [string]$Hint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required. $Hint"
    }
}

function Invoke-Git {
    param([string[]]$Args)
    & git @Args
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Args -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Get-GitText {
    param([string[]]$Args)
    $output = & git @Args 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Args -join ' ') failed: $($output -join ' ')"
    }
    return (($output -join "`n").Trim())
}

function Invoke-Gh {
    param([string[]]$Args)
    & gh @Args
    if ($LASTEXITCODE -ne 0) {
        throw "gh $($Args -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Assert-CleanWorktree {
    $dirty = Get-GitText @("status", "--porcelain")
    if ($dirty) {
        throw "The RatPack checkout has local changes. Commit or stash them before syncing so nothing gets overwritten.`n$dirty"
    }
}

function Assert-GitHubAuth {
    Require-Command "gh" "Run setup-windows.ps1 once, or install GitHub CLI with: winget install --id GitHub.cli -e"
    & gh auth status *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "GitHub CLI needs a one-time login. Opening the browser login flow..." -ForegroundColor Yellow
        & gh auth login --web
        if ($LASTEXITCODE -ne 0) {
            throw "GitHub CLI login did not complete."
        }
    }
}

function Sync-CurrentBranch {
    Require-Command "git" "Install Git for Windows first."
    Push-Location $RepoRoot
    try {
        Assert-CleanWorktree
        Invoke-Git @("fetch", "--prune", "origin")
        $branch = Get-GitText @("branch", "--show-current")
        if (-not $branch) {
            throw "The checkout is in detached HEAD state. Run: rat main"
        }
        & git rev-parse --abbrev-ref "${branch}@{upstream}" *> $null
        if ($LASTEXITCODE -eq 0) {
            Invoke-Git @("pull", "--ff-only")
        }
        elseif ($branch -eq "main") {
            Invoke-Git @("pull", "--ff-only", "origin", "main")
        }
        else {
            Write-Host "Fetched origin. Branch '$branch' has no upstream, so it was not changed." -ForegroundColor Yellow
        }
        Write-Host "RatPack is synced on $branch." -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}

function Sync-Main {
    Require-Command "git" "Install Git for Windows first."
    Push-Location $RepoRoot
    try {
        Assert-CleanWorktree
        Invoke-Git @("fetch", "--prune", "origin")
        Invoke-Git @("switch", "main")
        Invoke-Git @("pull", "--ff-only", "origin", "main")
        Write-Host "RatPack main is current." -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}

function Show-Status {
    Require-Command "git" "Install Git for Windows first."
    Push-Location $RepoRoot
    try {
        $branch = Get-GitText @("branch", "--show-current")
        $commit = Get-GitText @("log", "-1", "--pretty=format:%h %cs %s")
        $dirty = Get-GitText @("status", "--porcelain")
        Write-Host "Repo:   $RepoRoot"
        Write-Host "Branch: $branch"
        Write-Host "Commit: $commit"
        if ($dirty) {
            Write-Host "State:  local changes present" -ForegroundColor Yellow
            Write-Host $dirty
        }
        else {
            Write-Host "State:  clean" -ForegroundColor Green
        }
    }
    finally {
        Pop-Location
    }
}

function Get-NewShipRun {
    param([string]$WidgetSlug)
    Assert-GitHubAuth
    $started = (Get-Date).ToUniversalTime().AddSeconds(-10)
    Write-Host "Triggering Rat Ship for '$WidgetSlug' on GitHub Actions..." -ForegroundColor Cyan
    Invoke-Gh @("workflow", "run", "rat-ship-xeneon.yml", "--ref", "main", "-f", "slug=$WidgetSlug")

    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 2
        $json = & gh run list --workflow rat-ship-xeneon.yml --branch main --event workflow_dispatch --limit 10 --json databaseId,createdAt,status,conclusion 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Could not list GitHub Actions runs: $($json -join ' ')"
        }
        $runs = $json | ConvertFrom-Json
        $run = $runs |
            Where-Object { ([DateTime]::Parse($_.createdAt)).ToUniversalTime() -ge $started } |
            Sort-Object { [DateTime]::Parse($_.createdAt) } -Descending |
            Select-Object -First 1
        if ($run) {
            return [string]$run.databaseId
        }
    }
    throw "GitHub accepted the workflow request, but RatPack could not find the new run. Check GitHub Actions."
}

function Download-ShipKit {
    param([string]$WidgetSlug)
    Sync-Main
    Assert-GitHubAuth
    $runId = Get-NewShipRun $WidgetSlug
    Write-Host "Watching Rat Ship run $runId..." -ForegroundColor Cyan
    Invoke-Gh @("run", "watch", $runId, "--exit-status")

    $dest = Join-Path $RepoRoot "out\ship\$WidgetSlug"
    if (Test-Path $dest) {
        Remove-Item $dest -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Invoke-Gh @("run", "download", $runId, "--name", "rat-ship-$WidgetSlug", "--dir", $dest)

    $submit = Join-Path $dest "SUBMIT_NOW.ps1"
    $stage = Join-Path $dest "STAGE_ONLY.ps1"
    if (-not (Test-Path $submit) -or -not (Test-Path $stage)) {
        throw "Rat Ship completed but the local bridge scripts are missing from $dest"
    }
    Write-Host "Rat Ship kit is ready at:`n$dest" -ForegroundColor Green
    return $dest
}

function Run-Stage {
    param([string]$WidgetSlug)
    $dest = Download-ShipKit $WidgetSlug
    & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $dest "STAGE_ONLY.ps1")
    if ($LASTEXITCODE -ne 0) {
        throw "Maker Console staging exited with code $LASTEXITCODE"
    }
}

function Run-Submit {
    param([string]$WidgetSlug)
    $dest = Download-ShipKit $WidgetSlug
    Write-Host "Launching the explicit Maker Console submission bridge for $WidgetSlug..." -ForegroundColor Cyan
    & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $dest "SUBMIT_NOW.ps1")
    if ($LASTEXITCODE -ne 0) {
        throw "Maker Console submission exited with code $LASTEXITCODE"
    }
}

function Run-Doctor {
    Write-Host "RatPack local doctor" -ForegroundColor Cyan
    Write-Host "Repo: $RepoRoot"
    foreach ($cmd in @("git", "node", "npm", "gh")) {
        $found = Get-Command $cmd -ErrorAction SilentlyContinue
        if ($found) {
            Write-Host ("{0,-5} OK  {1}" -f $cmd, $found.Source) -ForegroundColor Green
        }
        else {
            Write-Host ("{0,-5} MISSING" -f $cmd) -ForegroundColor Red
        }
    }
    if (Get-Command gh -ErrorAction SilentlyContinue) {
        & gh auth status
    }
    if (Test-Path (Join-Path $RepoRoot ".git")) {
        Show-Status
    }
    else {
        Write-Host "Git checkout not found." -ForegroundColor Red
    }
}

switch ($Action.ToLowerInvariant()) {
    "status" { Show-Status }
    "update" { Sync-CurrentBranch }
    "main" { Sync-Main }
    "ship" { Download-ShipKit $Slug | Out-Null }
    "stage" { Run-Stage $Slug }
    "submit" { Run-Submit $Slug }
    "open" { Start-Process explorer.exe $RepoRoot }
    "doctor" { Run-Doctor }
    default {
        Write-Host "RatPack commands:" -ForegroundColor Cyan
        Write-Host "  rat status"
        Write-Host "  rat update"
        Write-Host "  rat main"
        Write-Host "  rat ship <slug>"
        Write-Host "  rat stage <slug>"
        Write-Host "  rat submit <slug>"
        Write-Host "  rat open"
        Write-Host "  rat doctor"
        exit 2
    }
}
