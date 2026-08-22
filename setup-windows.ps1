$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path $PSScriptRoot).Path

function Refresh-Path {
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
}

function Ensure-GitHubCli {
    if (Get-Command gh -ErrorAction SilentlyContinue) {
        return
    }
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "GitHub CLI is required for one-command Rat Ship downloads. Install it from https://cli.github.com/ and rerun this script."
    }
    Write-Host "Installing GitHub CLI..." -ForegroundColor Cyan
    & winget install --id GitHub.cli -e --source winget --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub CLI installation failed."
    }
    Refresh-Path
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        $candidate = "C:\Program Files\GitHub CLI\gh.exe"
        if (Test-Path $candidate) {
            $env:Path = "$(Split-Path $candidate);$env:Path"
        }
        else {
            throw "GitHub CLI installed but is not visible in this terminal yet. Open a new terminal and rerun setup-windows.ps1."
        }
    }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git for Windows is required. Install Git, clone ratpack-system, then rerun setup-windows.ps1."
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js is not installed. RatPack source sync will work, but Maker Console submission requires Node.js." -ForegroundColor Yellow
}

$origin = & git -C $RepoRoot remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0 -or -not $origin) {
    throw "$RepoRoot is not a Git checkout with an origin remote."
}

Ensure-GitHubCli
& gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "One-time GitHub CLI login required. Opening browser login..." -ForegroundColor Yellow
    & gh auth login --web
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub CLI authentication did not complete."
    }
}

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$parts = @($userPath -split ';' | Where-Object { $_ })
if ($parts -notcontains $RepoRoot) {
    $newPath = (($parts + $RepoRoot) -join ';')
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "Added $RepoRoot to your user PATH." -ForegroundColor Green
}
else {
    Write-Host "RatPack is already on your user PATH." -ForegroundColor Green
}

New-Item -ItemType Directory -Force -Path (Join-Path $RepoRoot "out") | Out-Null
Refresh-Path
if ($env:Path -notlike "*$RepoRoot*") {
    $env:Path = "$RepoRoot;$env:Path"
}

Write-Host ""
Write-Host "RatPack local workspace is ready." -ForegroundColor Green
Write-Host "Repo: $RepoRoot"
Write-Host ""
Write-Host "Open a new terminal and use:" -ForegroundColor Cyan
Write-Host "  rat status"
Write-Host "  rat update"
Write-Host "  rat ship now-playing"
Write-Host "  rat stage now-playing"
Write-Host "  rat submit now-playing"
Write-Host "  rat open"
Write-Host "  rat doctor"
Write-Host ""
Write-Host "Generated local files stay under $RepoRoot\out and do not go into Downloads."
