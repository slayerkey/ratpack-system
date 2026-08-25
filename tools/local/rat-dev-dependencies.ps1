function Get-RatDevDependencyFingerprint {
    param([string]$PluginRoot)

    $packagePath = Join-Path $PluginRoot "package.json"
    $lockPath = Join-Path $PluginRoot "package-lock.json"
    if (-not (Test-Path $packagePath -PathType Leaf) -or -not (Test-Path $lockPath -PathType Leaf)) {
        return $null
    }

    $packageHash = (Get-FileHash -Path $packagePath -Algorithm SHA256).Hash
    $lockHash = (Get-FileHash -Path $lockPath -Algorithm SHA256).Hash
    return "$packageHash|$lockHash"
}

function Get-RatDevDependencyState {
    param([string]$PluginRoot)

    $fingerprint = Get-RatDevDependencyFingerprint -PluginRoot $PluginRoot
    $nodeModules = Join-Path $PluginRoot "node_modules"
    $markerPath = Join-Path $nodeModules ".ratpack-dependency-fingerprint"

    if (-not $fingerprint) {
        return [PSCustomObject]@{
            Locked = $false
            Current = $false
            Fingerprint = $null
            MarkerPath = $markerPath
        }
    }

    $installedFingerprint = $null
    if (Test-Path $markerPath -PathType Leaf) {
        $installedFingerprint = ([string](Get-Content $markerPath -Raw)).Trim()
    }

    return [PSCustomObject]@{
        Locked = $true
        Current = (Test-Path $nodeModules -PathType Container) -and $installedFingerprint -eq $fingerprint
        Fingerprint = $fingerprint
        MarkerPath = $markerPath
    }
}

function Set-RatDevDependencyState {
    param([string]$PluginRoot)

    $state = Get-RatDevDependencyState -PluginRoot $PluginRoot
    if (-not $state.Locked -or -not $state.Fingerprint) {
        throw "Cannot record Rat Dev dependency state without package.json and package-lock.json."
    }

    $nodeModules = Join-Path $PluginRoot "node_modules"
    if (-not (Test-Path $nodeModules -PathType Container)) {
        throw "Cannot record Rat Dev dependency state before node_modules exists."
    }

    Set-Content -Path $state.MarkerPath -Value $state.Fingerprint -NoNewline -Encoding ascii
}
