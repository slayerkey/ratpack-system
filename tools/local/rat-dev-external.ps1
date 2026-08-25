param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$Slug
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$DevRoot = Join-Path $RepoRoot "out\dev"
$ControllerRoot = Join-Path $DevRoot "worktrees\$Slug"
$BuildRoot = Join-Path $DevRoot "builds\$Slug"
$StateRoot = Join-Path $DevRoot "state"
$StatePath = Join-Path $StateRoot "$Slug.json"
$RegistrationPath = Join-Path $RepoRoot "plugins\$Slug\rat-dev.json"

function Write-Stage {
    param([string]$Name)
    Write-Host ""
    Write-Host "[Rat Dev] $Name" -ForegroundColor Cyan
}

function Invoke-Native {
    param(
        [string]$Command,
        [string[]]$Arguments,
        [string]$Failure,
        [switch]$Quiet
    )

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & $Command @Arguments 2>&1
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
    }

    $lines = @($output | ForEach-Object { [string]$_ })
    if (-not $Quiet -and $lines.Count) {
        $lines | ForEach-Object { Write-Host $_ }
    }
    if ($code -ne 0) {
        $detail = if ($lines.Count) { "`n$($lines -join "`n")" } else { "" }
        throw "$Failure (exit code $code)$detail"
    }
    return $lines
}

function Get-NativeText {
    param(
        [string]$Command,
        [string[]]$Arguments,
        [string]$Failure
    )
    $lines = Invoke-Native -Command $Command -Arguments $Arguments -Failure $Failure -Quiet
    return (($lines -join "`n").Trim())
}

function Require-Command {
    param([string]$Name, [string]$Hint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required. $Hint"
    }
}

function Get-StreamDeckCli {
    foreach ($name in @("streamdeck.cmd", "streamdeck.exe", "streamdeck")) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    return $null
}

function Invoke-StreamDeckBestEffort {
    param([string]$Cli, [string[]]$Arguments)
    if (-not $Cli) { return $false }
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $Cli @Arguments *> $null
        return $LASTEXITCODE -eq 0
    }
    finally {
        $ErrorActionPreference = $previous
    }
}

function Read-State {
    if (-not (Test-Path $StatePath -PathType Leaf)) { return $null }
    try { return (Get-Content $StatePath -Raw | ConvertFrom-Json) } catch { return $null }
}

function Remove-FailedBuild {
    param([string]$BuildDir)
    if (-not $BuildDir -or -not (Test-Path $BuildDir)) { return }
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & git -C $ControllerRoot worktree remove --force $BuildDir *> $null
        if ($LASTEXITCODE -ne 0 -and (Test-Path $BuildDir)) {
            Remove-Item $BuildDir -Recurse -Force -ErrorAction SilentlyContinue
        }
        & git -C $ControllerRoot worktree prune *> $null
    }
    finally {
        $ErrorActionPreference = $previous
    }
}

if (-not (Test-Path $RegistrationPath -PathType Leaf)) {
    throw "External Rat Dev registration not found: $RegistrationPath"
}
$registration = Get-Content $RegistrationPath -Raw | ConvertFrom-Json
if (-not $registration.repository -or [string]$registration.type -ne "streamdeck-plugin") {
    throw "$Slug is not registered as an external Stream Deck plugin."
}

$repository = [string]$registration.repository
$sourceRef = if ($registration.ref) { [string]$registration.ref } else { "product/$Slug" }
$sourceRoot = if ($registration.source_root) { [string]$registration.source_root } else { "." }
$pluginDirName = if ($registration.plugin_dir) { [string]$registration.plugin_dir } else { $null }
$registeredUuid = if ($registration.plugin_uuid) { [string]$registration.plugin_uuid } else { $null }

Require-Command "git" "Install Git for Windows first."
Require-Command "node" "Install Node.js 24 or newer."
Require-Command "npm" "Install Node.js 24 or newer."

$nodeMajorText = Get-NativeText -Command "node" -Arguments @("-p", "process.versions.node.split('.')[0]") -Failure "Could not read Node.js version"
$nodeMajor = 0
[void][int]::TryParse($nodeMajorText, [ref]$nodeMajor)
if ($nodeMajor -lt 24) {
    throw "Stream Deck CLI requires Node.js 24 or newer. Current Node major version: $nodeMajorText"
}

$streamDeckCli = Get-StreamDeckCli
if (-not $streamDeckCli) {
    Write-Stage "Install official Stream Deck CLI"
    Invoke-Native -Command "npm" -Arguments @("install", "-g", "@elgato/cli@latest") -Failure "Could not install @elgato/cli"
    $streamDeckCli = Get-StreamDeckCli
}
if (-not $streamDeckCli) { throw "Official Stream Deck CLI is unavailable after installation." }

Write-Stage "Resolve external source"
New-Item -ItemType Directory -Force -Path (Split-Path $ControllerRoot -Parent) | Out-Null
if (-not (Test-Path $ControllerRoot -PathType Container)) {
    Invoke-Native -Command "git" -Arguments @("clone", "--branch", $sourceRef, "--single-branch", $repository, $ControllerRoot) -Failure "Could not clone external product source"
}
else {
    $gitDir = Join-Path $ControllerRoot ".git"
    if (-not (Test-Path $gitDir -PathType Container)) {
        throw "Existing Rat Dev controller is not a Git checkout: $ControllerRoot"
    }
    $origin = Get-NativeText -Command "git" -Arguments @("-C", $ControllerRoot, "remote", "get-url", "origin") -Failure "Could not read external product origin"
    if ($origin -ne $repository) {
        throw "Rat Dev controller origin mismatch. Expected '$repository' but found '$origin'."
    }
}

# Fetching changes only Git metadata. The controller working tree may still be the directory an
# older Stream Deck development link is running from, so never reset, clean or delete it here.
Invoke-Native -Command "git" -Arguments @(
    "-C", $ControllerRoot,
    "fetch", "--prune", "origin",
    "+refs/heads/${sourceRef}:refs/remotes/origin/${sourceRef}"
) -Failure "External product fetch failed"

$targetRef = "refs/remotes/origin/$sourceRef"
$sourceCommit = Get-NativeText -Command "git" -Arguments @("-C", $ControllerRoot, "rev-parse", $targetRef) -Failure "Could not resolve external product commit"
$shortCommit = $sourceCommit.Substring(0, [Math]::Min(12, $sourceCommit.Length))
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmssfff")
$buildDir = Join-Path $BuildRoot "$shortCommit-$stamp"
New-Item -ItemType Directory -Force -Path $BuildRoot | Out-Null

Write-Stage "Create isolated build $shortCommit"
Invoke-Native -Command "git" -Arguments @("-C", $ControllerRoot, "worktree", "add", "--force", "--detach", $buildDir, $targetRef) -Failure "Could not create isolated external build checkout"

$buildSucceeded = $false
try {
    $pluginRoot = Join-Path $buildDir $sourceRoot
    if (-not (Test-Path $pluginRoot -PathType Container)) {
        throw "External source root not found in isolated build: $pluginRoot"
    }

    $packagePath = Join-Path $pluginRoot "package.json"
    if (Test-Path $packagePath -PathType Leaf) {
        $package = Get-Content $packagePath -Raw | ConvertFrom-Json
        Push-Location $pluginRoot
        try {
            if (Test-Path (Join-Path $pluginRoot "package-lock.json") -PathType Leaf) {
                Write-Stage "Install locked dependencies"
                Invoke-Native -Command "npm" -Arguments @("ci", "--no-fund", "--no-audit") -Failure "npm ci failed"
            }
            elseif ($package.dependencies -or $package.devDependencies) {
                Write-Stage "Install dependencies"
                Invoke-Native -Command "npm" -Arguments @("install", "--no-fund", "--no-audit") -Failure "npm install failed"
            }

            if ($package.scripts.build) {
                Write-Stage "Build $Slug"
                Invoke-Native -Command "npm" -Arguments @("run", "build") -Failure "Plugin build failed"
            }
            if ($package.scripts.test) {
                Write-Stage "Run product tests"
                Invoke-Native -Command "npm" -Arguments @("test") -Failure "Plugin tests failed"
            }
        }
        finally {
            Pop-Location
        }
    }

    $pythonScripts = @(
        "scripts\build_profiles.py",
        "scripts\profile_qa.py",
        "scripts\valorant_qa.py"
    )
    $existingPythonScripts = @($pythonScripts | Where-Object { Test-Path (Join-Path $pluginRoot $_) -PathType Leaf })
    if ($existingPythonScripts.Count) {
        Require-Command "python" "Install Python 3.13 or newer for this product's local QA."
        Push-Location $pluginRoot
        try {
            foreach ($script in $existingPythonScripts) {
                Write-Stage "Run $script"
                Invoke-Native -Command "python" -Arguments @($script) -Failure "$script failed"
            }
        }
        finally {
            Pop-Location
        }
    }

    if ($pluginDirName) {
        $pluginDir = Join-Path $pluginRoot $pluginDirName
    }
    else {
        $candidate = Get-ChildItem $pluginRoot -Directory -Filter "*.sdPlugin" | Select-Object -First 1
        if (-not $candidate) { throw "Could not locate a built .sdPlugin directory under $pluginRoot" }
        $pluginDir = $candidate.FullName
    }

    $manifestPath = Join-Path $pluginDir "manifest.json"
    if (-not (Test-Path $manifestPath -PathType Leaf)) {
        throw "Stream Deck manifest not found: $manifestPath"
    }
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $pluginUuid = [string]$manifest.UUID
    $pluginVersion = [string]$manifest.Version
    if (-not $pluginUuid) { throw "Stream Deck manifest is missing UUID." }
    if ($registeredUuid -and $registeredUuid -ne $pluginUuid) {
        throw "Registered plugin UUID '$registeredUuid' does not match manifest UUID '$pluginUuid'."
    }

    Write-Stage "Validate with official Stream Deck CLI"
    Invoke-Native -Command $streamDeckCli -Arguments @("validate", $pluginDir) -Failure "Stream Deck validation failed"
    $buildSucceeded = $true

    $previousState = Read-State
    $previousPluginPath = $null
    if ($previousState -and $previousState.plugin_path -and (Test-Path ([string]$previousState.plugin_path) -PathType Container)) {
        $previousPluginPath = [string]$previousState.plugin_path
    }
    else {
        $legacyRoot = Join-Path $ControllerRoot $sourceRoot
        $legacyPath = if ($pluginDirName) { Join-Path $legacyRoot $pluginDirName } else { $null }
        if ($legacyPath -and (Test-Path $legacyPath -PathType Container)) {
            $previousPluginPath = $legacyPath
        }
    }

    Write-Stage "Switch Stream Deck to validated build"
    Invoke-Native -Command $streamDeckCli -Arguments @("dev") -Failure "Could not enable Stream Deck developer mode" -Quiet | Out-Null
    [void](Invoke-StreamDeckBestEffort -Cli $streamDeckCli -Arguments @("stop", $pluginUuid))
    [void](Invoke-StreamDeckBestEffort -Cli $streamDeckCli -Arguments @("unlink", "-d", $pluginUuid))

    try {
        Invoke-Native -Command $streamDeckCli -Arguments @("link", $pluginDir) -Failure "Stream Deck link failed"
        Invoke-Native -Command $streamDeckCli -Arguments @("restart", $pluginUuid) -Failure "Stream Deck restart failed"
    }
    catch {
        $switchError = $_
        Write-Host "Validated build could not be activated. Attempting rollback..." -ForegroundColor Yellow
        [void](Invoke-StreamDeckBestEffort -Cli $streamDeckCli -Arguments @("stop", $pluginUuid))
        [void](Invoke-StreamDeckBestEffort -Cli $streamDeckCli -Arguments @("unlink", "-d", $pluginUuid))
        if ($previousPluginPath -and (Test-Path $previousPluginPath -PathType Container)) {
            try {
                Invoke-Native -Command $streamDeckCli -Arguments @("link", $previousPluginPath) -Failure "Rollback link failed" -Quiet | Out-Null
                Invoke-Native -Command $streamDeckCli -Arguments @("restart", $pluginUuid) -Failure "Rollback restart failed" -Quiet | Out-Null
                Write-Host "Previous development build restored." -ForegroundColor Yellow
            }
            catch {
                Write-Host "Automatic rollback also failed. Previous files were not deleted: $previousPluginPath" -ForegroundColor Red
            }
        }
        throw $switchError
    }

    New-Item -ItemType Directory -Force -Path $StateRoot | Out-Null
    [PSCustomObject]@{
        slug = $Slug
        repository = $repository
        ref = $sourceRef
        commit = $sourceCommit
        plugin_uuid = $pluginUuid
        plugin_version = $pluginVersion
        plugin_path = $pluginDir
        updated_at = (Get-Date).ToUniversalTime().ToString("o")
    } | ConvertTo-Json | Set-Content -Path $StatePath -Encoding UTF8

    $profilesPath = Join-Path $pluginDir "profiles"
    $profiles = @()
    if (Test-Path $profilesPath -PathType Container) {
        $profiles = @(Get-ChildItem $profilesPath -Filter "*.streamDeckProfile" -File | Sort-Object Name)
    }

    Write-Host ""
    Write-Host "Rat Dev updated $Slug." -ForegroundColor Green
    Write-Host "Product version:   $pluginVersion"
    Write-Host "Source repository: $repository"
    Write-Host "Source branch:     $sourceRef"
    Write-Host "Source commit:     $sourceCommit"
    Write-Host "Plugin UUID:       $pluginUuid"
    Write-Host "Plugin path:       $pluginDir"
    Write-Host "Link:              verified (CLI success)" -ForegroundColor Green
    Write-Host "Restart:           verified (CLI success)" -ForegroundColor Green
    if ($profiles.Count) {
        Write-Host "Bundled profiles:"
        foreach ($profile in $profiles) {
            Write-Host "  $($profile.BaseName)"
        }
        Write-Host "Profile folder:    $profilesPath"
        Write-Host "Dev links do not guarantee Marketplace-style profile auto-install; packaged installs use the manifest AutoInstall setting." -ForegroundColor DarkGray
    }
}
finally {
    if (-not $buildSucceeded) {
        Remove-FailedBuild -BuildDir $buildDir
    }
}
