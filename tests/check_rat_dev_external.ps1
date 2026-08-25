$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Require-Text {
    param([string]$Text, [string]$Needle, [string]$Message)
    if (-not $Text.Contains($Needle)) { throw $Message }
}

$bootstrap = Get-Content (Join-Path $root "tools\local\rat-bootstrap.ps1") -Raw
$external = Get-Content (Join-Path $root "tools\local\rat-dev-external.ps1") -Raw
$dispatch = Get-Content (Join-Path $root "tools\local\rat-dev-dispatch.ps1") -Raw
$cmd = Get-Content (Join-Path $root "rat.cmd") -Raw

Require-Text $bootstrap "+refs/heads/main:refs/remotes/origin/main" "Rat bootstrap must explicitly refresh canonical origin/main."
Require-Text $bootstrap 'if ($localCommit -ne $remoteCommit)' "Rat bootstrap must verify local HEAD equals origin/main."
Require-Text $dispatch 'rat-dev-external.ps1' "Rat Dev dispatcher must route registered external Stream Deck plugins to isolated builds."
Require-Text $cmd 'rat-dev-dispatch.ps1' "rat.cmd must use the Rat Dev dispatcher."

Require-Text $external 'worktree", "add", "--force", "--detach"' "External Rat Dev must create an isolated Git worktree for each candidate build."
Require-Text $external 'Validate with official Stream Deck CLI' "External Rat Dev must validate before activation."
Require-Text $external 'Switch Stream Deck to validated build' "External Rat Dev must have an explicit activation stage."
Require-Text $external 'Attempting rollback' "External Rat Dev must attempt rollback if activation fails."
Require-Text $external 'Source commit:' "Rat Dev success output must print exact source commit."
Require-Text $external 'Source repository:' "Rat Dev success output must print source repository."
Require-Text $external 'Source branch:' "Rat Dev success output must print source branch."
Require-Text $external 'Plugin UUID:' "Rat Dev success output must print plugin UUID."
Require-Text $external 'Link:              verified' "Rat Dev success output must report link success."
Require-Text $external 'Restart:           verified' "Rat Dev success output must report restart success."
Require-Text $external 'Bundled profiles:' "Rat Dev must surface bundled profile names when present."
Require-Text $external 'Dev links do not guarantee Marketplace-style profile auto-install' "Rat Dev must distinguish dev linking from packaged profile installation."

if ($external.Contains('reset", "--hard"') -or $external.Contains('clean", "-fd')) {
    throw "External Rat Dev must never mutate the controller working tree with reset/clean while it may still be the live plugin directory."
}

$validateIndex = $external.IndexOf('Validate with official Stream Deck CLI')
$switchIndex = $external.IndexOf('Switch Stream Deck to validated build')
if ($validateIndex -lt 0 -or $switchIndex -lt 0 -or $validateIndex -ge $switchIndex) {
    throw "External Rat Dev must finish validation before stopping/unlinking the current plugin."
}

$parserFailures = @()
foreach ($relative in @(
    "tools\local\rat-bootstrap.ps1",
    "tools\local\rat-dev-preflight.ps1",
    "tools\local\rat-dev-dispatch.ps1",
    "tools\local\rat-dev-external.ps1"
)) {
    $path = Join-Path $root $relative
    $tokens = $null
    $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count) {
        $parserFailures += $relative
        $errors | ForEach-Object { Write-Host "${relative}:$($_.Extent.StartLineNumber) $($_.Message)" }
    }
}
if ($parserFailures.Count) {
    throw "PowerShell syntax failures: $($parserFailures -join ', ')"
}

Write-Host "Rat Dev external lifecycle contract PASS"
