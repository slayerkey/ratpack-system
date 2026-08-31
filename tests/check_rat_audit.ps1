$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$AuditHelper = Join-Path $RepoRoot "tools\local\rat-audit.ps1"
$RatCmd = Join-Path $RepoRoot "rat.cmd"

$Slug = "rat-audit-fixture"
$Worktree = Join-Path $RepoRoot "out\dev\worktrees\$Slug"
$ProductRoot = Join-Path $Worktree "plugins\$Slug"
$Scripts = Join-Path $ProductRoot "scripts"

$ExternalSlug = "rat-audit-external-fixture"
$ExternalRegistrationRoot = Join-Path $RepoRoot "plugins\$ExternalSlug"
$ExternalBuildBase = Join-Path $RepoRoot "out\dev\builds\$ExternalSlug"
$ExternalProductRoot = Join-Path $ExternalBuildBase "fixture-build\product"
$ExternalPluginPath = Join-Path $ExternalProductRoot "com.example.rat-audit-fixture.sdPlugin"
$ExternalScripts = Join-Path $ExternalProductRoot "scripts"
$StateRoot = Join-Path $RepoRoot "out\dev\state"
$ExternalStatePath = Join-Path $StateRoot "$ExternalSlug.json"

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
        throw "Rat Audit did not execute the internal product host audit.`n$output"
    }

    if (Test-Path $ExternalRegistrationRoot) { Remove-Item $ExternalRegistrationRoot -Recurse -Force }
    if (Test-Path $ExternalBuildBase) { Remove-Item $ExternalBuildBase -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $ExternalRegistrationRoot, $ExternalPluginPath, $ExternalScripts, $StateRoot | Out-Null

    @{
        type = "streamdeck-plugin"
        repository = "https://example.invalid/rat-audit-fixture.git"
        ref = "product/rat-audit-external-fixture"
    } | ConvertTo-Json | Set-Content (Join-Path $ExternalRegistrationRoot "rat-dev.json") -Encoding UTF8

    @{
        slug = $ExternalSlug
        repository = "https://example.invalid/rat-audit-fixture.git"
        ref = "product/rat-audit-external-fixture"
        commit = "0123456789abcdef0123456789abcdef01234567"
        plugin_uuid = "com.example.rat-audit-fixture"
        plugin_version = "1.0.0.0"
        plugin_path = $ExternalPluginPath
    } | ConvertTo-Json | Set-Content $ExternalStatePath -Encoding UTF8

    @'
Write-Output "EXTERNAL_AUDIT_FIXTURE_PASS"
exit 0
'@ | Set-Content (Join-Path $ExternalScripts "host-audit.ps1") -Encoding UTF8

    $externalOutput = (& $AuditHelper $ExternalSlug 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) {
        throw "External Rat Audit fixture returned exit code $LASTEXITCODE.`n$externalOutput"
    }
    if ($externalOutput -notmatch "EXTERNAL_AUDIT_FIXTURE_PASS") {
        throw "Rat Audit did not execute the active external build host audit.`n$externalOutput"
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
    if (Test-Path $ExternalRegistrationRoot) { Remove-Item $ExternalRegistrationRoot -Recurse -Force }
    if (Test-Path $ExternalBuildBase) { Remove-Item $ExternalBuildBase -Recurse -Force }
    if (Test-Path $ExternalStatePath) { Remove-Item $ExternalStatePath -Force }
}
