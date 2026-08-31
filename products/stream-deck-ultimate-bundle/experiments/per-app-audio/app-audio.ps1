param(
  [ValidateSet("List","Find","SetVolume","AdjustVolume","Mute","Unmute","ToggleMute","Compile")]
  [string]$Action = "List",
  [string]$Match = "",
  [int]$Value = 0
)

$ErrorActionPreference = "Stop"
$source = Join-Path $PSScriptRoot "PackRatAppAudio.cs"
if (-not ("PackRatAppAudio.Core" -as [type])) {
  Add-Type -Path $source
}

if ($Action -eq "Compile") {
  [pscustomobject]@{ ok = $true; type = "PackRatAppAudio.Core" } | ConvertTo-Json -Compress
  exit 0
}

switch ($Action) {
  "List" {
    [PackRatAppAudio.Core]::List() | ConvertTo-Json -Compress -Depth 5
  }
  "Find" {
    if (-not $Match) { throw "Match is required" }
    [PackRatAppAudio.Core]::Find($Match) | ConvertTo-Json -Compress -Depth 5
  }
  "SetVolume" {
    if (-not $Match) { throw "Match is required" }
    [pscustomobject]@{ changed = [PackRatAppAudio.Core]::SetVolume($Match, $Value); match = $Match; volume = [Math]::Max(0,[Math]::Min(100,$Value)) } | ConvertTo-Json -Compress
  }
  "AdjustVolume" {
    if (-not $Match) { throw "Match is required" }
    [pscustomobject]@{ changed = [PackRatAppAudio.Core]::AdjustVolume($Match, $Value); match = $Match; delta = $Value } | ConvertTo-Json -Compress
  }
  "Mute" {
    if (-not $Match) { throw "Match is required" }
    [pscustomobject]@{ changed = [PackRatAppAudio.Core]::SetMute($Match, $true); match = $Match; muted = $true } | ConvertTo-Json -Compress
  }
  "Unmute" {
    if (-not $Match) { throw "Match is required" }
    [pscustomobject]@{ changed = [PackRatAppAudio.Core]::SetMute($Match, $false); match = $Match; muted = $false } | ConvertTo-Json -Compress
  }
  "ToggleMute" {
    if (-not $Match) { throw "Match is required" }
    [pscustomobject]@{ changed = [PackRatAppAudio.Core]::ToggleMute($Match); match = $Match } | ConvertTo-Json -Compress
  }
}
