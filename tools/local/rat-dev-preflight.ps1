param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$Slug
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Worktree = Join-Path $RepoRoot "out\dev\worktrees\$Slug"

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

    return [pscustomobject]@{
        Output = @($output)
        ExitCode = $code
    }
}

function Get-Registration {
    $object = "origin/product/$Slug`:products/$Slug/rat-dev.json"
    $raw = $null

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $raw = & git -C $RepoRoot show $object 2>$null
    }
    finally {
        $ErrorActionPreference = $previous
    }

    if ($LASTEXITCODE -eq 0 -and $raw) {
        try { return (($raw -join "`n") | ConvertFrom-Json) } catch { }
    }

    $external = Join-Path $RepoRoot "products\external\$Slug.json"
    if (Test-Path $external) {
        try { return (Get-Content -Raw $external | ConvertFrom-Json) } catch { }
    }

    return $null
}

function Test-ReusableCheckout {
    param($Config)

    if (-not (Test-Path $Worktree)) { return $false }

    $gitDir = Join-Path $Worktree ".git"
    if (-not (Test-Path $gitDir)) { return $false }

    $pluginPath = $null
    if ($Config -and $Config.plugin_path) {
        $pluginPath = Join-Path $Worktree ([string]$Config.plugin_path)
    }

    if ($pluginPath) {
        $manifest = Join-Path $pluginPath "manifest.json"
        if (-not (Test-Path $manifest)) { return $false }
    }

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & git -C $Worktree rev-parse --is-inside-work-tree *> $null
        $valid = $LASTEXITCODE -eq 0
    }
    finally {
        $ErrorActionPreference = $previous
    }

    return $valid
}

function Stop-LinkedPlugin {
    param([string]$Uuid)

    if (-not $Uuid) { return }
    $cli = Get-StreamDeckCli
    if (-not $cli) { return }

    Write-Host "Stopping previous linked plugin $Uuid..." -ForegroundColor DarkGray
    $restart = Invoke-StreamDeckCli -Cli $cli -Arguments @("restart", $Uuid)
    if ($restart.ExitCode -ne 0) {
        # restart may fail when the stale checkout is already partially gone. That is safe here.
        Write-Host "Previous plugin process was already unavailable." -ForegroundColor DarkGray
    }

    $unlink = Invoke-StreamDeckCli -Cli $cli -Arguments @("unlink", $Uuid)
    if ($unlink.ExitCode -ne 0) {
        Write-Host "Previous development link was already clear." -ForegroundColor DarkGray
    }
}

function Restart-StreamDeckApp {
    $processes = Get-Process -ErrorAction SilentlyContinue | Where-Object {
        $_.ProcessName -match "^(StreamDeck|Stream Deck)$"
    }

    $exe = $null
    foreach ($process in $processes) {
        try {
            if (-not $exe -and $process.Path) { $exe = $process.Path }
        } catch { }
    }

    if (-not $exe) {
        $candidates = @(
            (Join-Path $env:ProgramFiles "Elgato\StreamDeck\StreamDeck.exe"),
            (Join-Path ${env:ProgramFiles(x86)} "Elgato\StreamDeck\StreamDeck.exe")
        ) | Where-Object { $_ -and (Test-Path $_) }
        if ($candidates.Count -gt 0) { $exe = $candidates[0] }
    }

    foreach ($process in $processes) {
        try { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue } catch { }
    }

    if ($processes.Count -gt 0) { Start-Sleep -Milliseconds 900 }
    return $exe
}

function Clear-StaleCheckout {
    param([string]$Uuid)

    if (-not (Test-Path $Worktree)) { return }

    Write-Host "Rat Dev found a stale local checkout. Releasing it before rebuilding..." -ForegroundColor DarkGray
    Stop-LinkedPlugin -Uuid $Uuid

    $lastError = $null
    for ($attempt = 1; $attempt -le 5; $attempt++) {
        try {
            Remove-Item $Worktree -Recurse -Force -ErrorAction Stop
            $lastError = $null
            break
        }
        catch {
            $lastError = $_
            if ($attempt -lt 5) {
                Write-Host "Windows is still releasing the old development folder. Retrying..." -ForegroundColor DarkGray
                Start-Sleep -Milliseconds (350 * $attempt)
            }
        }
    }

    if ($lastError -and (Test-Path $Worktree)) {
        Write-Host "The stale plugin is still locked. Restarting the Stream Deck app once to release it..." -ForegroundColor Yellow
        $streamDeckExe = Restart-StreamDeckApp
        Start-Sleep -Milliseconds 900
        try {
            Remove-Item $Worktree -Recurse -Force -ErrorAction Stop
            $lastError = $null
        }
        catch {
            $lastError = $_
        }

        if ($streamDeckExe) {
            try { Start-Process -FilePath $streamDeckExe | Out-Null } catch { }
        }
    }

    if ($lastError -and (Test-Path $Worktree)) {
        throw "Could not release the stale Rat Dev folder for '$Slug'. Close Stream Deck and any Explorer window opened inside '$Worktree', then retry: rat dev $Slug"
    }

    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & git -C $RepoRoot worktree prune *> $null
    }
    finally {
        $ErrorActionPreference = $previous
    }

    Write-Host "Stale Rat Dev checkout cleared." -ForegroundColor DarkGray
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is required for rat dev."
}

# Refresh refs so a first ever Rat Dev run can resolve external registrations
# and product metadata before the local development checkout exists. Git writes
# normal fetch progress such as "From https://..." to stderr, which Windows
# PowerShell can promote to a terminating NativeCommandError while the script is
# running with ErrorActionPreference=Stop. Capture only the real process exit code.
$previous = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    & git -C $RepoRoot fetch --prune origin 1>$null 2>$null
    $fetchExitCode = $LASTEXITCODE
}
finally {
    $ErrorActionPreference = $previous
}
if ($fetchExitCode -ne 0) {
    throw "Could not fetch canonical RatPack refs before Rat Dev preflight."
}

$config = Get-Registration

if (-not (Test-Path $Worktree)) {
    Write-Host "Preparing Stream Deck development copy..." -ForegroundColor DarkGray
    exit 0
}

# A healthy checkout may currently be the directory Stream Deck is running from.
# Do not stop or unlink it before the replacement has built and validated. rat-dev.ps1
# will switch the link only at the end of a successful update.
if (Test-ReusableCheckout -Config $config) {
    Write-Host "Existing Rat Dev checkout is reusable. Keeping the current plugin live during the update." -ForegroundColor DarkGray
    exit 0
}

$uuid = if ($config -and $config.plugin_uuid) { [string]$config.plugin_uuid } else { $null }
Clear-StaleCheckout -Uuid $uuid
Write-Host "Preparing Stream Deck development copy..." -ForegroundColor DarkGray
