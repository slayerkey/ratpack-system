param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$Slug
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$DevRoot = Join-Path $RepoRoot "out\dev"
$WorktreeRoot = Join-Path $DevRoot "worktrees"
$Worktree = Join-Path $WorktreeRoot $Slug

function Require-Command {
    param([string]$Name, [string]$Hint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required. $Hint"
    }
}

function Invoke-Checked {
    param(
        [string]$Command,
        [string[]]$Arguments,
        [string]$Failure
    )
    & $Command @Arguments | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "$Failure (exit code $LASTEXITCODE)"
    }
}

function Test-GitRef {
    param([string]$Ref)
    & git -C $RepoRoot rev-parse --verify --quiet $Ref *> $null
    return $LASTEXITCODE -eq 0
}

function Ensure-StreamDeckCli {
    Require-Command "node" "Install Node.js 24 or newer."
    Require-Command "npm" "Install Node.js 24 or newer."

    $majorText = (& node -p "process.versions.node.split('.')[0]" 2>$null | Select-Object -First 1)
    $major = 0
    [void][int]::TryParse([string]$majorText, [ref]$major)
    if ($major -lt 24) {
        throw "Stream Deck CLI requires Node.js 24 or newer. Current Node major version: $majorText"
    }

    if (-not (Get-Command streamdeck -ErrorAction SilentlyContinue)) {
        Write-Host "Installing the official Stream Deck CLI once..." -ForegroundColor Cyan
        Invoke-Checked -Command "npm" -Arguments @("install", "-g", "@elgato/cli@latest") -Failure "Could not install @elgato/cli"
    }

    Require-Command "streamdeck" "Install with: npm install -g @elgato/cli@latest"
}

function Get-ExistingPluginUuid {
    if (-not (Test-Path $Worktree)) { return $null }
    $root = Join-Path $Worktree "plugins\$Slug"
    if (-not (Test-Path $root)) { return $null }
    $configPath = Join-Path $root "rat-dev.json"
    $pluginDir = $null
    if (Test-Path $configPath) {
        try {
            $config = Get-Content $configPath -Raw | ConvertFrom-Json
            if ($config.plugin_dir) { $pluginDir = Join-Path $root ([string]$config.plugin_dir) }
        }
        catch { }
    }
    if (-not $pluginDir) {
        $candidate = Get-ChildItem $root -Directory -Filter "*.sdPlugin" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($candidate) { $pluginDir = $candidate.FullName }
    }
    if (-not $pluginDir) { return $null }
    $manifestPath = Join-Path $pluginDir "manifest.json"
    if (-not (Test-Path $manifestPath)) { return $null }
    try {
        $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
        return [string]$manifest.UUID
    }
    catch {
        return $null
    }
}

function Stop-ExistingLink {
    param([string]$Uuid)
    if (-not $Uuid) { return }
    if (-not (Get-Command streamdeck -ErrorAction SilentlyContinue)) { return }
    Write-Host "Stopping previous linked plugin $Uuid..." -ForegroundColor DarkGray
    & streamdeck stop $Uuid *> $null
    & streamdeck unlink -d $Uuid *> $null
}

function Resolve-SourceRef {
    Write-Host "Fetching canonical RatPack source..." -ForegroundColor Cyan
    Invoke-Checked -Command "git" -Arguments @("-C", $RepoRoot, "fetch", "--prune", "origin") -Failure "Git fetch failed"

    $productRef = "refs/remotes/origin/product/$Slug"
    if (Test-GitRef $productRef) {
        return "origin/product/$Slug"
    }

    $mainObject = "origin/main:plugins/$Slug"
    & git -C $RepoRoot cat-file -e $mainObject 2>$null
    if ($LASTEXITCODE -eq 0) {
        return "origin/main"
    }

    throw "Could not find plugins/$Slug on origin/product/$Slug or origin/main. Push the product branch first."
}

function Sync-DevWorktree {
    param([string]$Ref)

    New-Item -ItemType Directory -Force -Path $WorktreeRoot | Out-Null

    if (Test-Path $Worktree) {
        & git -C $Worktree rev-parse --is-inside-work-tree *> $null
        if ($LASTEXITCODE -eq 0) {
            Invoke-Checked -Command "git" -Arguments @("-C", $Worktree, "reset", "--hard", $Ref) -Failure "Could not update development worktree"
            Invoke-Checked -Command "git" -Arguments @("-C", $Worktree, "clean", "-fd") -Failure "Could not clean development worktree"
            return
        }
        Remove-Item $Worktree -Recurse -Force
    }

    & git -C $RepoRoot worktree prune *> $null
    Invoke-Checked -Command "git" -Arguments @("-C", $RepoRoot, "worktree", "add", "--force", "--detach", $Worktree, $Ref) -Failure "Could not create development worktree"
}

function Build-And-TestPlugin {
    $pluginRoot = Join-Path $Worktree "plugins\$Slug"
    if (-not (Test-Path $pluginRoot)) {
        throw "Plugin source not found after sync: $pluginRoot"
    }

    $configPath = Join-Path $pluginRoot "rat-dev.json"
    $config = $null
    if (Test-Path $configPath) {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        if ($config.type -and [string]$config.type -ne "streamdeck-plugin") {
            throw "rat dev currently supports streamdeck-plugin products. $Slug declares type '$($config.type)'."
        }
    }

    $packagePath = Join-Path $pluginRoot "package.json"
    if (Test-Path $packagePath) {
        $package = Get-Content $packagePath -Raw | ConvertFrom-Json
        $nodeModules = Join-Path $pluginRoot "node_modules"
        Push-Location $pluginRoot
        try {
            if (-not (Test-Path $nodeModules) -and (Test-Path (Join-Path $pluginRoot "package-lock.json"))) {
                Write-Host "Installing plugin dependencies..." -ForegroundColor Cyan
                Invoke-Checked -Command "npm" -Arguments @("ci", "--no-fund", "--no-audit") -Failure "npm ci failed"
            }
            elseif (-not (Test-Path $nodeModules) -and $package.dependencies) {
                Write-Host "Installing plugin dependencies..." -ForegroundColor Cyan
                Invoke-Checked -Command "npm" -Arguments @("install", "--no-fund", "--no-audit") -Failure "npm install failed"
            }

            if ($package.scripts.build) {
                Write-Host "Building $Slug..." -ForegroundColor Cyan
                Invoke-Checked -Command "npm" -Arguments @("run", "build") -Failure "Plugin build failed"
            }
            if ($package.scripts.test) {
                Write-Host "Testing $Slug..." -ForegroundColor Cyan
                Invoke-Checked -Command "npm" -Arguments @("test") -Failure "Plugin tests failed"
            }
        }
        finally {
            Pop-Location
        }
    }

    $pluginDir = $null
    if ($config -and $config.plugin_dir) {
        $pluginDir = Join-Path $pluginRoot ([string]$config.plugin_dir)
    }
    else {
        $candidate = Get-ChildItem $pluginRoot -Directory -Filter "*.sdPlugin" | Select-Object -First 1
        if ($candidate) { $pluginDir = $candidate.FullName }
    }

    if (-not $pluginDir -or -not (Test-Path $pluginDir)) {
        throw "Could not locate the built .sdPlugin directory under $pluginRoot"
    }

    $manifestPath = Join-Path $pluginDir "manifest.json"
    if (-not (Test-Path $manifestPath)) {
        throw "Stream Deck manifest not found: $manifestPath"
    }
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    if (-not $manifest.UUID) {
        throw "Stream Deck manifest is missing UUID."
    }

    Write-Host "Validating with the official Stream Deck CLI..." -ForegroundColor Cyan
    Invoke-Checked -Command "streamdeck" -Arguments @("validate", $pluginDir) -Failure "Stream Deck validation failed"

    return [PSCustomObject]@{
        Root = $pluginRoot
        PluginDir = $pluginDir
        Uuid = [string]$manifest.UUID
        Version = [string]$manifest.Version
        OpenUrl = if ($config -and $config.open_url) { [string]$config.open_url } else { $null }
    }
}

function Install-DevPlugin {
    param($Plugin)

    Write-Host "Enabling Stream Deck developer mode..." -ForegroundColor DarkGray
    & streamdeck dev *> $null

    Write-Host "Linking $($Plugin.Uuid) into Stream Deck..." -ForegroundColor Cyan
    & streamdeck unlink -d $Plugin.Uuid *> $null
    Invoke-Checked -Command "streamdeck" -Arguments @("link", $Plugin.PluginDir) -Failure "Stream Deck link failed"
    Invoke-Checked -Command "streamdeck" -Arguments @("restart", $Plugin.Uuid) -Failure "Stream Deck restart failed"

    Write-Host ""
    Write-Host "Rat Dev updated $Slug." -ForegroundColor Green
    Write-Host "Version: $($Plugin.Version)"
    Write-Host "Source:  $($Plugin.Root)"
    Write-Host "Plugin:  $($Plugin.PluginDir)"

    if ($Plugin.OpenUrl) {
        Start-Sleep -Seconds 2
        Write-Host "Opening local status page: $($Plugin.OpenUrl)" -ForegroundColor DarkGray
        Start-Process $Plugin.OpenUrl
    }
}

Require-Command "git" "Install Git for Windows first."
Ensure-StreamDeckCli
$oldUuid = Get-ExistingPluginUuid
Stop-ExistingLink $oldUuid
$sourceRef = Resolve-SourceRef
Write-Host "Using $sourceRef" -ForegroundColor DarkGray
Sync-DevWorktree $sourceRef
$plugin = Build-And-TestPlugin
Install-DevPlugin $plugin
