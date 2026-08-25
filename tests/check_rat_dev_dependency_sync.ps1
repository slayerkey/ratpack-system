$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "..\tools\local\rat-dev-dependencies.ps1")

$root = Join-Path ([System.IO.Path]::GetTempPath()) ("rat-dev-deps-" + [guid]::NewGuid().ToString("N"))
try {
    New-Item -ItemType Directory -Force -Path $root | Out-Null
    $packagePath = Join-Path $root "package.json"
    $lockPath = Join-Path $root "package-lock.json"
    Set-Content -Path $packagePath -NoNewline -Encoding utf8 -Value '{"name":"fixture","version":"1.0.0"}'
    Set-Content -Path $lockPath -NoNewline -Encoding utf8 -Value '{"name":"fixture","lockfileVersion":3}'

    $missing = Get-RatDevDependencyState -PluginRoot $root
    if (-not $missing.Locked -or $missing.Current) {
        throw "A locked project without node_modules must require npm ci."
    }

    New-Item -ItemType Directory -Force -Path (Join-Path $root "node_modules") | Out-Null
    Set-RatDevDependencyState -PluginRoot $root
    $current = Get-RatDevDependencyState -PluginRoot $root
    if (-not $current.Current) {
        throw "Recorded dependency state should be current."
    }

    Set-Content -Path $packagePath -NoNewline -Encoding utf8 -Value '{"name":"fixture","version":"1.0.1"}'
    if ((Get-RatDevDependencyState -PluginRoot $root).Current) {
        throw "Changing package.json must invalidate the dependency marker."
    }

    Set-RatDevDependencyState -PluginRoot $root
    Set-Content -Path $lockPath -NoNewline -Encoding utf8 -Value '{"name":"fixture","lockfileVersion":3,"changed":true}'
    if ((Get-RatDevDependencyState -PluginRoot $root).Current) {
        throw "Changing package-lock.json must invalidate the dependency marker."
    }

    Remove-Item $lockPath -Force
    $unlocked = Get-RatDevDependencyState -PluginRoot $root
    if ($unlocked.Locked) {
        throw "Projects without package-lock.json must remain on the legacy npm install path."
    }

    Write-Host "Rat Dev dependency fingerprint checks passed."
}
finally {
    Remove-Item $root -Recurse -Force -ErrorAction SilentlyContinue
}
