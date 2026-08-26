param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$Slug
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$registrationPath = Join-Path $RepoRoot "plugins\$Slug\rat-dev.json"
$external = $false

if (Test-Path $registrationPath -PathType Leaf) {
    try {
        $registration = Get-Content $registrationPath -Raw | ConvertFrom-Json
        $external = [bool]$registration.repository -and [string]$registration.type -eq "streamdeck-plugin"
    }
    catch {
        throw "Invalid Rat Dev registration: $registrationPath"
    }
}

if ($external) {
    & (Join-Path $PSScriptRoot "rat-dev-external.ps1") $Slug
    exit $LASTEXITCODE
}

& (Join-Path $PSScriptRoot "rat-dev.ps1") $Slug
exit $LASTEXITCODE
