param(
    [switch]$StaticOnly,
    [switch]$Json
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PluginDir = Join-Path $Root "com.packrat.voice-deck.sdPlugin"
$ManifestPath = Join-Path $PluginDir "manifest.json"
$ReportPath = Join-Path $Root "HOST_AUDIT_LATEST.txt"
$results = New-Object System.Collections.Generic.List[object]

function Add-Check {
    param(
        [string]$Name,
        [ValidateSet("PASS","WARN","FAIL")]
        [string]$Status,
        [string]$Detail
    )
    $results.Add([PSCustomObject]@{ name = $Name; status = $Status; detail = $Detail })
}

function Get-GitValue {
    param([string[]]$Arguments)
    try {
        $text = (& git -C $Root @Arguments 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -eq 0) { return $text }
    }
    catch { }
    return "unknown"
}

function Find-LatestFile {
    param([string[]]$Directories, [string]$Filter)
    $files = @()
    foreach ($dir in $Directories) {
        if ($dir -and (Test-Path $dir -PathType Container)) {
            $files += Get-ChildItem $dir -Filter $Filter -File -ErrorAction SilentlyContinue
        }
    }
    return $files | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

if (-not (Test-Path $ManifestPath -PathType Leaf)) {
    throw "Voice Deck manifest not found: $ManifestPath"
}

$manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$commit = Get-GitValue @("rev-parse", "HEAD")
$branch = Get-GitValue @("branch", "--show-current")
if (-not $branch) { $branch = "detached" }

Add-Check "manifest UUID" $(if ($manifest.UUID -eq "com.packrat.voice-deck") { "PASS" } else { "FAIL" }) ([string]$manifest.UUID)
Add-Check "manifest version" $(if ($manifest.Version -eq "1.0.0.0") { "PASS" } else { "WARN" }) ([string]$manifest.Version)
Add-Check "action count" $(if (@($manifest.Actions).Count -eq 12) { "PASS" } else { "FAIL" }) ("{0} actions" -f @($manifest.Actions).Count)

$profiles = @(Get-ChildItem (Join-Path $PluginDir "profiles") -Filter *.streamDeckProfile -File -ErrorAction SilentlyContinue)
Add-Check "bundled profiles" $(if ($profiles.Count -eq 4) { "PASS" } else { "FAIL" }) ("{0} profiles" -f $profiles.Count)

$bundle = Join-Path $PluginDir "bin\plugin.js"
Add-Check "built runtime" $(if (Test-Path $bundle -PathType Leaf) { "PASS" } else { "FAIL" }) $bundle

foreach ($piFile in @("ui\inspector.html", "ui\inspector.js", "ui\inspector.css")) {
    $path = Join-Path $PluginDir $piFile
    Add-Check ("property inspector {0}" -f (Split-Path $piFile -Leaf)) $(if (Test-Path $path -PathType Leaf) { "PASS" } else { "FAIL" }) $path
}

if (-not $StaticOnly) {
    if ($env:OS -ne "Windows_NT") {
        Add-Check "Windows runtime" "FAIL" "Voice Deck host audit must run on Windows."
    }
    else {
        $discord = @(Get-Process -Name Discord,DiscordCanary,DiscordPTB -ErrorAction SilentlyContinue)
        Add-Check "Discord Desktop process" $(if ($discord.Count) { "PASS" } else { "FAIL" }) $(if ($discord.Count) { ($discord.ProcessName | Sort-Object -Unique) -join ", " } else { "Discord Desktop not running" })

        $streamDeck = @(Get-Process -Name StreamDeck -ErrorAction SilentlyContinue)
        Add-Check "Stream Deck process" $(if ($streamDeck.Count) { "PASS" } else { "FAIL" }) $(if ($streamDeck.Count) { "StreamDeck.exe running" } else { "StreamDeck.exe not running" })

        $pipes = @()
        try {
            $pipes = @(Get-ChildItem "\\.\pipe\" -ErrorAction Stop | Where-Object { $_.Name -match '^discord-ipc-\d+$' } | Select-Object -ExpandProperty Name)
        }
        catch { }
        Add-Check "Discord IPC pipe" $(if ($pipes.Count) { "PASS" } else { "FAIL" }) $(if ($pipes.Count) { ($pipes | Sort-Object) -join ", " } else { "No discord-ipc-* named pipe found" })

        $devLogDir = Join-Path $PluginDir "logs"
        $installedLogDir = if ($env:APPDATA) { Join-Path $env:APPDATA "Elgato\StreamDeck\Plugins\com.packrat.voice-deck.sdPlugin\logs" } else { $null }
        $pluginLog = Find-LatestFile @($devLogDir, $installedLogDir) "com.packrat.voice-deck*.log"
        if ($pluginLog) {
            $tail = @(Get-Content $pluginLog.FullName -Tail 400 -ErrorAction SilentlyContinue)
            $errorLines = @($tail | Where-Object { $_ -match '(?i)\b(ERROR|FATAL)\b|uncaught|unhandled|ECONN|EPIPE|ETIMEDOUT|Discord Desktop IPC was not found' })
            Add-Check "Voice Deck plugin log" "PASS" $pluginLog.FullName
            Add-Check "recent plugin errors" $(if ($errorLines.Count) { "WARN" } else { "PASS" }) $(if ($errorLines.Count) { "{0} matching lines in latest 400" -f $errorLines.Count } else { "No matching failure lines in latest 400" })
        }
        else {
            Add-Check "Voice Deck plugin log" "WARN" "No plugin log found yet. Start/restart Voice Deck in Stream Deck first."
        }

        $streamDeckLogDir = if ($env:APPDATA) { Join-Path $env:APPDATA "Elgato\StreamDeck\logs" } else { $null }
        $hostLog = Find-LatestFile @($streamDeckLogDir) "StreamDeck*.log"
        if ($hostLog) {
            $hostTail = @(Get-Content $hostLog.FullName -Tail 2500 -ErrorAction SilentlyContinue)
            $mentions = @($hostTail | Where-Object { $_ -match 'com\.packrat\.voice-deck' })
            Add-Check "Stream Deck host log" "PASS" $hostLog.FullName
            Add-Check "host sees Voice Deck" $(if ($mentions.Count) { "PASS" } else { "WARN" }) $(if ($mentions.Count) { "{0} recent references" -f $mentions.Count } else { "No recent UUID reference in Stream Deck host log tail" })
        }
        else {
            Add-Check "Stream Deck host log" "WARN" "No Stream Deck host log found at %APPDATA%\Elgato\StreamDeck\logs."
        }
    }
}

$failed = @($results | Where-Object status -eq "FAIL")
$warned = @($results | Where-Object status -eq "WARN")
$overall = if ($failed.Count) { "FAIL" } elseif ($warned.Count) { "WARN" } else { "PASS" }

$report = [PSCustomObject]@{
    product = "PackRat Voice Deck"
    generated_at = [DateTime]::Now.ToString("o")
    overall = $overall
    static_only = [bool]$StaticOnly
    commit = $commit
    branch = $branch
    plugin_uuid = [string]$manifest.UUID
    version = [string]$manifest.Version
    checks = @($results)
    manual_evidence = if ($StaticOnly) { @() } else { @(
        "Confirm a real Discord voice channel populates member keys.",
        "Confirm speaking state lights the correct member key.",
        "Confirm Stream Deck mute changes Discord and Discord mute changes Stream Deck.",
        "Confirm Stream Deck deafen changes Discord and Discord deafen changes Stream Deck.",
        "Switch voice channels and confirm the roster repopulates.",
        "Restart Discord, then Stream Deck, and confirm automatic recovery."
    ) }
}

if ($Json) {
    $report | ConvertTo-Json -Depth 6
}
else {
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("PACKRAT VOICE DECK HOST AUDIT")
    $lines.Add("Overall: $overall")
    $lines.Add("Time: $($report.generated_at)")
    $lines.Add("Commit: $commit")
    $lines.Add("Branch: $branch")
    $lines.Add("UUID: $($report.plugin_uuid)")
    $lines.Add("Version: $($report.version)")
    $lines.Add("")
    foreach ($check in $results) {
        $lines.Add(("[{0}] {1}: {2}" -f $check.status, $check.name, $check.detail))
    }
    if (-not $StaticOnly) {
        $lines.Add("")
        $lines.Add("MANUAL EVIDENCE STILL REQUIRED")
        foreach ($item in $report.manual_evidence) { $lines.Add("[ ] $item") }
        $lines.Add("")
        $lines.Add("If anything fails, share this one report plus one sentence describing what you saw. Do not reinstall first; plugin logs disappear on uninstall.")
    }
    $text = $lines -join [Environment]::NewLine
    $text | Write-Host
    Set-Content -Path $ReportPath -Value $text -Encoding UTF8
    if (-not $StaticOnly) { Write-Host "`nSaved shareable report: $ReportPath" -ForegroundColor Cyan }
}

if ($failed.Count) { exit 1 }
exit 0
