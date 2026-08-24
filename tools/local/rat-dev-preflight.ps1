param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$Slug
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Get-StreamDeckCli {
    $cmd = Get-Command "streamdeck.cmd" -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $exe = Get-Command "streamdeck.exe" -ErrorAction SilentlyContinue
    if ($exe) { return $exe.Source }

    $generic = Get-Command "streamdeck" -ErrorAction SilentlyContinue
    if ($generic) { return $generic.Source }

    return $null
}

function Invoke-StreamDeckCli {
    param(
        [string]$Cli,
        [string[]]$Arguments
    )

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & $Cli @Arguments 2>&1
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
    }

    return [PSCustomObject]@{
        Code = $code
        Output = @($output | ForEach-Object { [string]$_ })
    }
}

function Read-JsonFromGitObject {
    param([string]$Object)

    $raw = & git -C $RepoRoot show $Object 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $raw) { return $null }

    try {
        return (($raw -join "`n") | ConvertFrom-Json)
    }
    catch {
        throw "Invalid Rat Dev registration at $Object"
    }
}

function Get-Registration {
    $productObject = "origin/product/${Slug}:plugins/${Slug}/rat-dev.json"
    $config = Read-JsonFromGitObject $productObject
    if ($config) { return $config }

    $mainObject = "origin/main:plugins/${Slug}/rat-dev.json"
    return (Read-JsonFromGitObject $mainObject)
}

function Test-PluginInstalled {
    param(
        [string]$Cli,
        [string]$Uuid
    )

    $listed = Invoke-StreamDeckCli -Cli $Cli -Arguments @("list", "--all")
    if ($listed.Code -ne 0) {
        return $null
    }

    $text = ($listed.Output -join "`n")
    return $text.IndexOf($Uuid, [StringComparison]::OrdinalIgnoreCase) -ge 0
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is required for rat dev."
}

# Refresh refs so a first-ever Rat Dev run can know the plugin UUID before
# the detached development worktree has been created.
& git -C $RepoRoot fetch --prune origin *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Could not fetch canonical RatPack refs before Rat Dev cleanup."
}

$config = Get-Registration
if (-not $config -or -not $config.plugin_uuid) {
    Write-Host "Rat Dev preflight: no plugin_uuid registration for '$Slug'; continuing without pre-cleanup." -ForegroundColor DarkGray
    exit 0
}

$uuid = [string]$config.plugin_uuid
$cli = Get-StreamDeckCli
if (-not $cli) {
    # rat-dev.ps1 will install the official CLI when needed.
    Write-Host "Rat Dev preflight: Stream Deck CLI is not installed yet; cleanup will happen after CLI setup." -ForegroundColor DarkGray
    exit 0
}

Write-Host "Preparing existing Stream Deck development copy..." -ForegroundColor DarkGray

for ($attempt = 1; $attempt -le 3; $attempt++) {
    $stop = Invoke-StreamDeckCli -Cli $cli -Arguments @("stop", $uuid)
    Start-Sleep -Milliseconds 450

    $unlink = Invoke-StreamDeckCli -Cli $cli -Arguments @("unlink", "-d", $uuid)
    Start-Sleep -Milliseconds (500 + (250 * $attempt))

    $installed = Test-PluginInstalled -Cli $cli -Uuid $uuid
    if ($installed -eq $false -or $installed -eq $null) {
        Write-Host "Previous Stream Deck copy is clear." -ForegroundColor DarkGray
        exit 0
    }

    if ($attempt -lt 3) {
        Write-Host "Windows is still releasing the old plugin. Retrying cleanup..." -ForegroundColor Yellow
    }
    else {
        Write-Host "Stream Deck still reports $uuid as installed after cleanup attempts." -ForegroundColor Yellow
        if ($unlink.Output.Count -gt 0) {
            Write-Host ($unlink.Output -join "`n") -ForegroundColor DarkGray
        }
        throw "Could not remove the previous Stream Deck development copy. Close any open plugin files and retry rat dev $Slug."
    }
}
