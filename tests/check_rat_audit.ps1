$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$AuditHelper = Join-Path $RepoRoot "tools\local\rat-audit.ps1"
$RatCmd = Join-Path $RepoRoot "rat.cmd"
$Slug = "rat-audit-fixture"
$Worktree = Join-Path $RepoRoot "out\dev\worktrees\$Slug"
$ProductRoot = Join-Path $Worktree "plugins\$Slug"
$Scripts = Join-Path $ProductRoot "scripts"

try {
    if (Test-Path $Worktree) { Remove-Item $Worktree -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $Scripts | Out-Null

    @'
Write-Output "AUDIT_FIXTURE_PASS"
exit 0
'@ | Set-Content (Join-Path $Scripts "host-audit.ps1") -Encoding UTF8

    $output = (& $AuditHelper $Slug 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) {
        throw "Rat Audit fixture returned exit code $LASTEXITCODE.`n$output"
    }
    if ($output -notmatch "AUDIT_FIXTURE_PASS") {
        throw "Rat Audit did not execute the product host audit.`n$output"
    }

    $missingFailed = $false
    try {
        & $AuditHelper "rat-audit-missing-fixture" *> $null
    }
    catch {
        $missingFailed = $_.Exception.Message -match "Run 'rat dev rat-audit-missing-fixture' first"
    }
    if (-not $missingFailed) {
        throw "Rat Audit must fail clearly when no Rat Dev worktree exists."
    }

    $unknownModeFailed = $false
    try {
        & $AuditHelper $Slug "--not-a-real-mode" *> $null
    }
    catch {
        $unknownModeFailed = $_.Exception.Message -match "Unknown Rat Audit option"
    }
    if (-not $unknownModeFailed) {
        throw "Rat Audit must fail closed on unknown options."
    }

    $cmd = Get-Content $RatCmd -Raw
    if ($cmd -notmatch 'for %%A in \(dev audit ship') {
        throw "rat.cmd does not bootstrap the audit command."
    }
    if ($cmd -notmatch 'if /I "%~1"=="audit"') {
        throw "rat.cmd does not route the audit command."
    }
    if ($cmd -notmatch 'rat-audit\.ps1') {
        throw "rat.cmd does not invoke rat-audit.ps1."
    }

    Write-Host "RAT AUDIT REGRESSION PASS"
}
finally {
    if (Test-Path $Worktree) { Remove-Item $Worktree -Recurse -Force }
}
