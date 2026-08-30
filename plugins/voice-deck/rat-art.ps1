param(
    [Parameter(Mandatory = $true)]
    [string]$Destination
)

$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Script = Join-Path $Here "scripts\rat-art.py"
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python is required for Voice Deck Rat Art."
}
python $Script --destination $Destination
if ($LASTEXITCODE -ne 0) { throw "Voice Deck Rat Art failed with exit code $LASTEXITCODE." }
