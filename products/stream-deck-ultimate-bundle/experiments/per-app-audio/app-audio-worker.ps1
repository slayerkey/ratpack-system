param(
  [switch]$Mock
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

if (-not $Mock) {
  $source = Join-Path $PSScriptRoot "PackRatAppAudio.cs"
  if (-not ("PackRatAppAudio.Core" -as [type])) { Add-Type -Path $source }
}

$mockSessions = @(
  [pscustomobject]@{ pid = 101; process = "Discord"; displayName = "Voice"; sessionIdentifier = "mock-discord-1"; volume = 42; muted = $false; state = "Active" },
  [pscustomobject]@{ pid = 101; process = "Discord"; displayName = "Notifications"; sessionIdentifier = "mock-discord-2"; volume = 42; muted = $false; state = "Active" },
  [pscustomobject]@{ pid = 202; process = "Spotify"; displayName = "Music"; sessionIdentifier = "mock-spotify"; volume = 35; muted = $false; state = "Active" }
)

function Write-Response([object]$id, [bool]$ok, [object]$result, [string]$error = "") {
  $payload = [ordered]@{ id = $id; ok = $ok }
  if ($ok) { $payload.result = $result } else { $payload.error = $error }
  [Console]::Out.WriteLine(($payload | ConvertTo-Json -Compress -Depth 8))
  [Console]::Out.Flush()
}

function Normalize-Process([string]$value) {
  $s = [IO.Path]::GetFileName(($value -replace '/', '\'))
  if ($s.EndsWith('.exe',[StringComparison]::OrdinalIgnoreCase)) { $s = $s.Substring(0,$s.Length-4) }
  return $s.ToLowerInvariant()
}

function Get-Sessions {
  if ($Mock) { return @($mockSessions) }
  return @([PackRatAppAudio.Core]::List())
}

function Resolve-Exact([string]$match) {
  if ([string]::IsNullOrWhiteSpace($match)) { return @() }
  $pidValue = 0
  $isPid = [int]::TryParse($match, [ref]$pidValue)
  $key = Normalize-Process $match
  return @(Get-Sessions | Where-Object {
    if ($isPid) { [int]$_.pid -eq $pidValue }
    else { (Normalize-Process ([string]$_.process)) -eq $key }
  })
}

function Invoke-MockWrite([string]$action, [string]$match, [int]$value) {
  $targets = @(Resolve-Exact $match)
  if ($targets.Count -eq 0) { return [pscustomobject]@{ changed = 0; missing = $true; match = $match } }
  foreach ($target in $targets) {
    if ($action -eq 'SetVolume') { $target.volume = [Math]::Max(0,[Math]::Min(100,$value)) }
    elseif ($action -eq 'AdjustVolume') { $target.volume = [Math]::Max(0,[Math]::Min(100,([int]$target.volume + $value))) }
    elseif ($action -eq 'Mute') { $target.muted = $true }
    elseif ($action -eq 'Unmute') { $target.muted = $false }
    elseif ($action -eq 'ToggleMute') { $target.muted = -not [bool]$target.muted }
  }
  return [pscustomobject]@{ changed = $targets.Count; missing = $false; match = $match }
}

function Invoke-NativeExact([string]$action, [string]$match, [int]$value) {
  $targets = @(Resolve-Exact $match)
  if ($targets.Count -eq 0) { return [pscustomobject]@{ changed = 0; missing = $true; match = $match } }
  $pids = @($targets | ForEach-Object { [int]$_.pid } | Where-Object { $_ -gt 0 } | Select-Object -Unique)
  $changed = 0
  foreach ($pid in $pids) {
    $selector = [string]$pid
    if ($action -eq 'SetVolume') { $changed += [PackRatAppAudio.Core]::SetVolume($selector,$value) }
    elseif ($action -eq 'AdjustVolume') { $changed += [PackRatAppAudio.Core]::AdjustVolume($selector,$value) }
    elseif ($action -eq 'Mute') { $changed += [PackRatAppAudio.Core]::SetMute($selector,$true) }
    elseif ($action -eq 'Unmute') { $changed += [PackRatAppAudio.Core]::SetMute($selector,$false) }
    elseif ($action -eq 'ToggleMute') { $changed += [PackRatAppAudio.Core]::ToggleMute($selector) }
  }
  return [pscustomobject]@{ changed = $changed; missing = ($changed -eq 0); match = $match; pidCount = $pids.Count }
}

function Invoke-ExactWrite([string]$action, [string]$match, [int]$value) {
  if ($Mock) { return Invoke-MockWrite $action $match $value }
  return Invoke-NativeExact $action $match $value
}

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $request = $null
  try {
    $request = $line | ConvertFrom-Json
    $id = $request.id
    $action = [string]$request.action
    $match = [string]$request.match
    $value = if ($null -ne $request.value) { [int]$request.value } else { 0 }
    if ($action -eq 'Quit') {
      Write-Response $id $true ([pscustomobject]@{ quitting = $true })
      break
    } elseif ($action -eq 'Ping') {
      Write-Response $id $true ([pscustomobject]@{ ready = $true; mock = [bool]$Mock; type = if ($Mock) { 'mock' } else { 'PackRatAppAudio.Core' } })
    } elseif ($action -eq 'List') {
      Write-Response $id $true @(Get-Sessions)
    } elseif ($action -eq 'FindExact') {
      Write-Response $id $true @(Resolve-Exact $match)
    } elseif (@('SetVolume','AdjustVolume','Mute','Unmute','ToggleMute') -contains $action) {
      Write-Response $id $true (Invoke-ExactWrite $action $match $value)
    } else {
      throw "Unknown action: $action"
    }
  } catch {
    $id = if ($null -ne $request) { $request.id } else { $null }
    Write-Response $id $false $null ([string]$_.Exception.Message)
  }
}
