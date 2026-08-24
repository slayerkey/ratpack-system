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

function Stop-ExistingLink {
    param([string]$Uuid)
    if (-not $Uuid) { return }
    if (-not (Get-Command streamdeck -ErrorAction SilentlyContinue)) { return }
    Write-Host "Stopping previous linked plugin $Uuid..." -ForegroundColor DarkGray
    & streamdeck stop $Uuid *> $null
    & streamdeck unlink -d $Uuid *> $null
}

function Read-OriginMainRegistration {
    $configObject = "origin/main:plugins/$Slug/rat-dev.json"
    $raw = & git -C $RepoRoot show $configObject 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $raw) {
        return $null
    }
    try {
        return (($raw -join "`n") | ConvertFrom-Json)
    }
    catch {
        throw "Invalid rat-dev.json registration for $Slug on origin/main."
    }
}

function Resolve-Source {
    Write-Host "Fetching canonical RatPack source..." -ForegroundColor Cyan
    Invoke-Checked -Command "git" -Arguments @("-C", $RepoRoot, "fetch", "--prune", "origin") -Failure "Git fetch failed"

    $productRef = "refs/remotes/origin/product/$Slug"
    if (Test-GitRef $productRef) {
        return [PSCustomObject]@{
            Kind = "ratpack"
            Ref = "origin/product/$Slug"
            Config = $null
            SourceRoot = "plugins\$Slug"
            Display = "origin/product/$Slug"
        }
    }

    $registration = Read-OriginMainRegistration
    if ($registration -and $registration.repository) {
        $externalRef = if ($registration.ref) { [string]$registration.ref } else { "product/$Slug" }
        $sourceRoot = if ($registration.source_root) { [string]$registration.source_root } else { "." }
        return [PSCustomObject]@{
            Kind = "external"
            Repository = [string]$registration.repository
            Ref = $externalRef
            Config = $registration
            SourceRoot = $sourceRoot
            Display = "$($registration.repository) @ $externalRef"
        }
    }

    $mainObject = "origin/main:plugins/$Slug"
    & git -C $RepoRoot cat-file -e $mainObject 2>$null
    if ($LASTEXITCODE -eq 0) {
        return [PSCustomObject]@{
            Kind = "ratpack"
            Ref = "origin/main"
            Config = $null
            SourceRoot = "plugins\$Slug"
            Display = "origin/main"
        }
    }

    throw "Could not find $Slug in RatPack or an external rat-dev registration on origin/main."
}

function Remove-ExistingCheckout {
    # The dev slot can be either a real RatPack git worktree or a standalone clone
    # for an externally registered product. Calling `git worktree remove` on the
    # standalone clone aborts PowerShell under ErrorActionPreference=Stop, so clear
    # the filesystem checkout first and let `worktree prune` discard any stale
    # RatPack worktree metadata afterward.
    if (Test-Path $Worktree) {
        Write-Host "Clearing stale local development checkout..." -ForegroundColor DarkGray
        Remove-Item $Worktree -Recurse -Force
    }

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & git -C $RepoRoot worktree prune *> $null
    }
    finally {
        $ErrorActionPreference = $previous
    }
}

function Sync-RatPackWorktree {
    param([string]$Ref)

    New-Item -ItemType Directory -Force -Path $WorktreeRoot | Out-Null

    $gitMarker = Join-Path $Worktree ".git"
    if ((Test-Path $Worktree) -and (Test-Path $gitMarker -PathType Leaf)) {
        Invoke-Checked -Command "git" -Arguments @("-C", $Worktree, "reset", "--hard", $Ref) -Failure "Could not update development worktree"
        Invoke-Checked -Command "git" -Arguments @("-C", $Worktree, "clean", "-fd") -Failure "Could not clean development worktree"
        return
    }

    if (Test-Path $Worktree) {
        Remove-ExistingCheckout
    }

    Invoke-Checked -Command "git" -Arguments @("-C", $RepoRoot, "worktree", "add", "--force", "--detach", $Worktree, $Ref) -Failure "Could not create development worktree"
}

function Resolve-ExternalTarget {
    param([string]$Ref)

    $remoteTarget = "origin/$Ref"
    & git -C $Worktree rev-parse --verify --quiet $remoteTarget *> $null
    if ($LASTEXITCODE -eq 0) {
        return $remoteTarget
    }

    & git -C $Worktree rev-parse --verify --quiet $Ref *> $null
    if ($LASTEXITCODE -eq 0) {
        return $Ref
    }

    throw "Could not resolve external development ref '$Ref' for $Slug."
}

function Sync-ExternalCheckout {
    param($Source)

    New-Item -ItemType Directory -Force -Path $WorktreeRoot | Out-Null
    $gitDir = Join-Path $Worktree ".git"
    $canReuse = $false

    if ((Test-Path $Worktree) -and (Test-Path $gitDir -PathType Container)) {
        $remoteUrl = (& git -C $Worktree remote get-url origin 2>$null | Select-Object -First 1)
        if ($LASTEXITCODE -eq 0 -and [string]$remoteUrl -eq [string]$Source.Repository) {
            $canReuse = $true
        }
    }

    if (-not $canReuse) {
        if (Test-Path $Worktree) {
            Remove-ExistingCheckout
        }
        Write-Host "Cloning external product source..." -ForegroundColor Cyan
        Invoke-Checked -Command "git" -Arguments @("clone", "--no-checkout", [string]$Source.Repository, $Worktree) -Failure "Could not clone external development repository"
    }

    Write-Host "Fetching external product updates..." -ForegroundColor Cyan
    Invoke-Checked -Command "git" -Arguments @("-C", $Worktree, "fetch", "--prune", "origin") -Failure "External product fetch failed"
    $target = Resolve-ExternalTarget ([string]$Source.Ref)
    Invoke-Checked -Command "git" -Arguments @("-C", $Worktree, "reset", "--hard", $target) -Failure "Could not update external development checkout"
    Invoke-Checked -Command "git" -Arguments @("-C", $Worktree, "clean", "-fd") -Failure "Could not clean external development checkout"
}

function Get-PluginRoot {
    param($Source)
    return (Join-Path $Worktree ([string]$Source.SourceRoot))
}

function Get-ExistingPluginUuid {
    param($Source)

    if ($Source.Config -and $Source.Config.plugin_uuid) {
        return [string]$Source.Config.plugin_uuid
    }
    if (-not (Test-Path $Worktree)) { return $null }

    $root = Get-PluginRoot $Source
    if (-not (Test-Path $root)) { return $null }

    $config = $Source.Config
    if (-not $config) {
        $configPath = Join-Path $root "rat-dev.json"
        if (Test-Path $configPath) {
            try { $config = Get-Content $configPath -Raw | ConvertFrom-Json } catch { }
        }
    }

    $pluginDir = $null
    if ($config -and $config.plugin_dir) {
        $pluginDir = Join-Path $root ([string]$config.plugin_dir)
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

function Build-And-TestPlugin {
    param(
        [string]$PluginRoot,
        $RegistrationConfig
    )

    if (-not (Test-Path $PluginRoot)) {
        throw "Plugin source not found after sync: $PluginRoot"
    }

    $config = $RegistrationConfig
    if (-not $config) {
        $configPath = Join-Path $PluginRoot "rat-dev.json"
        if (Test-Path $configPath) {
            $config = Get-Content $configPath -Raw | ConvertFrom-Json
        }
    }
    if ($config -and $config.type -and [string]$config.type -ne "streamdeck-plugin") {
        throw "rat dev currently supports streamdeck-plugin products. $Slug declares type '$($config.type)'."
    }

    $packagePath = Join-Path $PluginRoot "package.json"
    if (Test-Path $packagePath) {
        $package = Get-Content $packagePath -Raw | ConvertFrom-Json
        $nodeModules = Join-Path $PluginRoot "node_modules"
        Push-Location $PluginRoot
        try {
            if (-not (Test-Path $nodeModules) -and (Test-Path (Join-Path $PluginRoot "package-lock.json"))) {
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
        $pluginDir = Join-Path $PluginRoot ([string]$config.plugin_dir)
    }
    else {
        $candidate = Get-ChildItem $PluginRoot -Directory -Filter "*.sdPlugin" | Select-Object -First 1
        if ($candidate) { $pluginDir = $candidate.FullName }
    }

    if (-not $pluginDir -or -not (Test-Path $pluginDir)) {
        throw "Could not locate the built .sdPlugin directory under $PluginRoot"
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
        Root = $PluginRoot
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
$source = Resolve-Source
Write-Host "Using $($source.Display)" -ForegroundColor DarkGray
$oldUuid = Get-ExistingPluginUuid $source
Stop-ExistingLink $oldUuid

if ($source.Kind -eq "external") {
    Sync-ExternalCheckout $source
}
else {
    Sync-RatPackWorktree ([string]$source.Ref)
}

$pluginRoot = Get-PluginRoot $source
$plugin = Build-And-TestPlugin -PluginRoot $pluginRoot -RegistrationConfig $source.Config
Install-DevPlugin $plugin
