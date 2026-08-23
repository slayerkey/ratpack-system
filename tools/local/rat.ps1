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

function Invoke-GitCommand {
    param([string[]]$GitArgs)
    & git @GitArgs
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArgs -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Get-GitText {
    param([string[]]$GitArgs)
    $output = & git @GitArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArgs -join ' ') failed: $($output -join ' ')"
    }
    return (($output -join "`n").Trim())
}

function Invoke-GhCommand {
    param([string[]]$GhArgs)
    Push-Location $RepoRoot
    try {
        & gh @GhArgs
        if ($LASTEXITCODE -ne 0) {
            throw "gh $($GhArgs -join ' ') failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Assert-CleanWorktree {
    $dirty = Get-GitText -GitArgs @("status", "--porcelain")
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
        Invoke-GitCommand -GitArgs @("fetch", "--prune", "origin")
        $branch = Get-GitText -GitArgs @("branch", "--show-current")
        if (-not $branch) {
            throw "The checkout is in detached HEAD state. Run: rat main"
        }
        & git rev-parse --abbrev-ref "${branch}@{upstream}" *> $null
        if ($LASTEXITCODE -eq 0) {
            Invoke-GitCommand -GitArgs @("pull", "--ff-only")
        }
        elseif ($branch -eq "main") {
            Invoke-GitCommand -GitArgs @("pull", "--ff-only", "origin", "main")
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
        Invoke-GitCommand -GitArgs @("fetch", "--prune", "origin")
        Invoke-GitCommand -GitArgs @("switch", "main")
        Invoke-GitCommand -GitArgs @("pull", "--ff-only", "origin", "main")
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
        $branch = Get-GitText -GitArgs @("branch", "--show-current")
        $commit = Get-GitText -GitArgs @("log", "-1", "--pretty=format:%h %cs %s")
        $dirty = Get-GitText -GitArgs @("status", "--porcelain")
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

function Show-Help {
    Write-Host "RatPack cheat sheet" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "NORMAL" -ForegroundColor Green
    Write-Host "  rat ship <slug>    Build, validate, package, create Rat Art, download the fresh ship kit, then open it in Explorer."
    Write-Host "  rat status         Show the local repo branch, commit, and whether local files changed."
    Write-Host "  rat help           Show this cheat sheet."
    Write-Host ""
    Write-Host "OPTIONAL" -ForegroundColor DarkGray
    Write-Host "  rat update         Pull the latest changes for the current branch."
    Write-Host "  rat main           Switch to main and pull the latest canonical RatPack."
    Write-Host "  rat stage <slug>   Get a fresh ship kit and use the optional Maker Console Playwright bridge without final submit."
    Write-Host "  rat submit <slug>  Get a fresh ship kit and use the optional authenticated Maker Console submit bridge."
    Write-Host "  rat open           Open the RatPack repo in Explorer."
    Write-Host "  rat doctor         Check Git, Node, npm, GitHub CLI, GitHub login, and repo state."
    Write-Host ""
    Write-Host "Full reference: $RepoRoot\RAT-COMMANDS.md"
}

function Get-NewShipRun {
    param([string]$WidgetSlug)
    Assert-GitHubAuth
    Push-Location $RepoRoot
    try {
        $started = (Get-Date).ToUniversalTime().AddSeconds(-10)
        Write-Host "Triggering Rat Ship for '$WidgetSlug' on GitHub Actions..." -ForegroundColor Cyan
        Invoke-GhCommand -GhArgs @("workflow", "run", "rat-ship-xeneon.yml", "--ref", "main", "-f", "slug=$WidgetSlug")

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
    finally {
        Pop-Location
    }
}

function Download-ShipKit {
    param([string]$WidgetSlug)
    Sync-Main
    Assert-GitHubAuth
    $runId = Get-NewShipRun $WidgetSlug
    Write-Host "Watching Rat Ship run $runId..." -ForegroundColor Cyan
    Invoke-GhCommand -GhArgs @("run", "watch", $runId, "--exit-status")

    $dest = Join-Path $RepoRoot "out\ship\$WidgetSlug"
    if (Test-Path $dest) {
        Remove-Item $dest -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Invoke-GhCommand -GhArgs @("run", "download", $runId, "--name", "rat-ship-$WidgetSlug", "--dir", $dest)

    $submission = Join-Path $dest "submission.json"
    $widgetPackage = Get-ChildItem -Path $dest -Filter *.icuewidget -File | Select-Object -First 1
    if (-not (Test-Path $submission) -or -not $widgetPackage) {
        throw "Rat Ship completed but the expected marketplace kit is incomplete in $dest"
    }

    Write-Host "Rat Ship kit is ready at:`n$dest" -ForegroundColor Green
    return $dest
}

function Run-Ship {
    param([string]$WidgetSlug)
    $dest = Download-ShipKit $WidgetSlug
    Start-Process explorer.exe $dest
}

function Run-Stage {
    param([string]$WidgetSlug)
    $dest = Download-ShipKit $WidgetSlug
    $script = Join-Path $dest "STAGE_ONLY.ps1"
    if (-not (Test-Path $script)) {
        throw "This ship kit does not contain the optional Maker Console staging bridge. Use rat ship and upload manually instead."
    }
    & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $script
    if ($LASTEXITCODE -ne 0) {
        throw "Maker Console staging exited with code $LASTEXITCODE"
    }
}

function Run-Submit {
    param([string]$WidgetSlug)
    $dest = Download-ShipKit $WidgetSlug
    $script = Join-Path $dest "SUBMIT_NOW.ps1"
    if (-not (Test-Path $script)) {
        throw "This ship kit does not contain the optional Maker Console submit bridge. Use rat ship and upload manually instead."
    }
    Write-Host "Launching the optional Maker Console submission bridge for $WidgetSlug..." -ForegroundColor Cyan
    & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $script
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
    "help" { Show-Help }
    "commands" { Show-Help }
    "update" { Sync-CurrentBranch }
    "main" { Sync-Main }
    "ship" { Run-Ship $Slug }
    "stage" { Run-Stage $Slug }
    "submit" { Run-Submit $Slug }
    "open" { Start-Process explorer.exe $RepoRoot }
    "doctor" { Run-Doctor }
    default {
        Show-Help
        exit 2
    }
}
