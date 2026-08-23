param(
    [Parameter(Position = 0)]
    [string]$Action = "status",

    [Parameter(Position = 1)]
    [string]$Slug = "now-playing"
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ShipToolRoot = Join-Path $RepoRoot "tools\ship"
$MakerProfile = Join-Path $env:LOCALAPPDATA "PackRat\maker-console-profile"

function Require-Command {
    param([string]$Name, [string]$Hint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required. $Hint"
    }
}

function Invoke-GitCommand {
    param([string[]]$GitArgs)
    & git @GitArgs | Out-Host
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
        & gh @GhArgs | Out-Host
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
    Write-Host "  rat ship <slug>    Build, validate, package, create Rat Art, download the fresh kit, fill Maker Console, and submit."
    Write-Host "  rat status         Show the local repo branch, commit, and whether local files changed."
    Write-Host "  rat help           Show this cheat sheet."
    Write-Host ""
    Write-Host "OPTIONAL" -ForegroundColor DarkGray
    Write-Host "  rat kit <slug>     Build and download the fresh ship kit without opening Maker Console."
    Write-Host "  rat stage <slug>   Build and fill Maker Console, but stop before final Submit."
    Write-Host "  rat submit <slug>  Alias for rat ship."
    Write-Host "  rat update         Pull the latest changes for the current branch."
    Write-Host "  rat main           Switch to main and pull the latest canonical RatPack."
    Write-Host "  rat open           Open the RatPack repo in Explorer."
    Write-Host "  rat doctor         Check Git, Node, npm, GitHub CLI, GitHub login, and repo state."
    Write-Host ""
    Write-Host "Maker Console login persists at: $MakerProfile"
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

function Wait-RatShipRun {
    param([string]$RunId)

    Push-Location $RepoRoot
    try {
        $lastLabel = $null
        while ($true) {
            $json = & gh run view $RunId --json status,conclusion,jobs 2>&1
            if ($LASTEXITCODE -ne 0) {
                throw "Could not read Rat Ship run ${RunId}: $($json -join ' ')"
            }

            $run = $json | ConvertFrom-Json
            if ($run.status -eq "completed") {
                if ($run.conclusion -eq "success") {
                    Write-Host "Rat Ship workflow completed successfully." -ForegroundColor Green
                    return
                }

                Write-Host "Rat Ship workflow failed. Showing failed logs..." -ForegroundColor Red
                & gh run view $RunId --log-failed | Out-Host
                throw "Rat Ship run $RunId finished with conclusion '$($run.conclusion)'."
            }

            $label = "Waiting for GitHub runner"
            $activeJob = $run.jobs | Where-Object { $_.status -eq "in_progress" } | Select-Object -Last 1
            if ($activeJob) {
                $activeStep = $activeJob.steps | Where-Object { $_.status -eq "in_progress" } | Select-Object -Last 1
                if ($activeStep) {
                    $label = $activeStep.name
                }
                else {
                    $label = $activeJob.name
                }
            }

            if ($label -ne $lastLabel) {
                Write-Host "Rat Ship: $label..." -ForegroundColor DarkGray
                $lastLabel = $label
            }
            Start-Sleep -Seconds 4
        }
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
    Wait-RatShipRun -RunId $runId

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

function Ensure-MakerConsoleRuntime {
    Require-Command "node" "Install Node.js first."
    Require-Command "npm" "Install Node.js first."

    $playwrightModule = Join-Path $ShipToolRoot "node_modules\playwright"
    Push-Location $ShipToolRoot
    try {
        if (-not (Test-Path $playwrightModule)) {
            Write-Host "Installing the Rat Ship browser runtime once..." -ForegroundColor Cyan
            & npm install --no-fund --no-audit | Out-Host
            if ($LASTEXITCODE -ne 0) {
                throw "Could not install the Rat Ship browser runtime."
            }
        }

        & node -e "import('playwright').then(({chromium})=>process.exit(require('fs').existsSync(chromium.executablePath())?0:2)).catch(()=>process.exit(3))" *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Installing Chromium for the Rat Ship browser runtime once..." -ForegroundColor Cyan
            & npx playwright install chromium | Out-Host
            if ($LASTEXITCODE -ne 0) {
                throw "Could not install Chromium for Rat Ship."
            }
        }
    }
    finally {
        Pop-Location
    }
}

function Invoke-MakerConsoleBridge {
    param(
        [string]$WidgetSlug,
        [string]$Kit,
        [switch]$Submit,
        [switch]$Resume
    )

    Ensure-MakerConsoleRuntime
    $driver = Join-Path $ShipToolRoot "maker_console.mjs"
    if (-not (Test-Path $driver)) {
        throw "Maker Console driver not found: $driver"
    }

    $nodeArgs = @($driver, $WidgetSlug, "--kit=$Kit", "--profile=$MakerProfile")
    if ($Resume) { $nodeArgs += "--resume" }
    if ($Submit) { $nodeArgs += "--submit" }

    Push-Location $RepoRoot
    try {
        & node @nodeArgs | Out-Host
        return $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
}

function Run-MakerConsole {
    param(
        [string]$WidgetSlug,
        [string]$Kit,
        [switch]$Submit
    )

    for ($attempt = 1; $attempt -le 3; $attempt++) {
        $resume = $attempt -gt 1
        if ($attempt -eq 1) {
            Write-Host "Launching Maker Console for '$WidgetSlug'..." -ForegroundColor Cyan
            Write-Host "Your local Maker Console login is reused automatically. If Elgato asks you to sign in, complete it once in the opened browser and Rat Ship will continue." -ForegroundColor Yellow
        }
        else {
            Write-Host "Maker Console attempt $($attempt - 1) stopped unexpectedly. Restarting the browser and resuming the same draft..." -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        }

        $code = Invoke-MakerConsoleBridge -WidgetSlug $WidgetSlug -Kit $Kit -Submit:$Submit -Resume:$resume
        if ($code -eq 0) {
            if ($Submit) {
                Write-Host "Rat Ship submitted '$WidgetSlug' to Maker Console." -ForegroundColor Green
            }
            else {
                Write-Host "Rat Ship staged '$WidgetSlug' in Maker Console without submitting." -ForegroundColor Green
            }
            return
        }
    }

    $logDir = Join-Path $Kit "log"
    throw "Maker Console failed after three attempts. The ship kit is still safe at $Kit. Recovery screenshots and state, when available, are in $logDir"
}

function Run-Kit {
    param([string]$WidgetSlug)
    $dest = Download-ShipKit $WidgetSlug
    Start-Process explorer.exe $dest
}

function Run-Ship {
    param([string]$WidgetSlug)
    $dest = Download-ShipKit $WidgetSlug
    Run-MakerConsole -WidgetSlug $WidgetSlug -Kit $dest -Submit
}

function Run-Stage {
    param([string]$WidgetSlug)
    $dest = Download-ShipKit $WidgetSlug
    Run-MakerConsole -WidgetSlug $WidgetSlug -Kit $dest
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
    Write-Host "Maker Console profile: $MakerProfile"
    if (Test-Path $MakerProfile) {
        Write-Host "Maker Console profile exists." -ForegroundColor Green
    }
    else {
        Write-Host "Maker Console profile has not been created yet. The first rat ship run will create it." -ForegroundColor Yellow
    }
}

switch ($Action.ToLowerInvariant()) {
    "status" { Show-Status }
    "help" { Show-Help }
    "commands" { Show-Help }
    "update" { Sync-CurrentBranch }
    "main" { Sync-Main }
    "ship" { Run-Ship $Slug }
    "submit" { Run-Ship $Slug }
    "kit" { Run-Kit $Slug }
    "stage" { Run-Stage $Slug }
    "open" { Start-Process explorer.exe $RepoRoot }
    "doctor" { Run-Doctor }
    default {
        Show-Help
        exit 2
    }
}