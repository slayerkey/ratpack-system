param(
    [Parameter(Mandatory = $true)]
    [string]$Destination
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$PluginRoot = Join-Path $Root "com.packrat.discord-bridge.sdPlugin"
$IconPath = Join-Path $PluginRoot "imgs\plugin\icon.png"

Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $Destination | Out-Null

$bg = [System.Drawing.Color]::FromArgb(9, 11, 16)
$panel = [System.Drawing.Color]::FromArgb(18, 22, 30)
$panel2 = [System.Drawing.Color]::FromArgb(25, 31, 42)
$white = [System.Drawing.Color]::FromArgb(244, 246, 248)
$muted = [System.Drawing.Color]::FromArgb(166, 176, 192)
$accent = [System.Drawing.Color]::FromArgb(43, 232, 106)
$discord = [System.Drawing.Color]::FromArgb(88, 101, 242)

function New-Font([float]$size, [System.Drawing.FontStyle]$style = [System.Drawing.FontStyle]::Regular) {
    return New-Object System.Drawing.Font("Segoe UI", $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}

function New-Canvas([int]$width, [int]$height) {
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear($bg)
    return @($bmp, $g)
}

function Draw-Text($g, [string]$text, [float]$x, [float]$y, [float]$size, $color, [bool]$bold = $false, [float]$maxWidth = 1600) {
    $style = if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $font = New-Font $size $style
    $brush = New-Object System.Drawing.SolidBrush($color)
    $format = New-Object System.Drawing.StringFormat
    $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
    $rect = New-Object System.Drawing.RectangleF($x, $y, $maxWidth, 220)
    $g.DrawString($text, $font, $brush, $rect, $format)
    $format.Dispose(); $brush.Dispose(); $font.Dispose()
}

function Draw-Panel($g, [float]$x, [float]$y, [float]$w, [float]$h, $fill = $panel) {
    $brush = New-Object System.Drawing.SolidBrush($fill)
    $g.FillRectangle($brush, $x, $y, $w, $h)
    $brush.Dispose()
}

function Draw-Pill($g, [string]$text, [float]$x, [float]$y, [float]$w, $fill, $textColor) {
    $brush = New-Object System.Drawing.SolidBrush($fill)
    $g.FillRectangle($brush, $x, $y, $w, 52)
    $brush.Dispose()
    Draw-Text $g $text ($x + 18) ($y + 8) 25 $textColor $true ($w - 36)
}

function Draw-Icon($g, [float]$x, [float]$y, [float]$size) {
    if (Test-Path $IconPath) {
        $img = [System.Drawing.Image]::FromFile($IconPath)
        $g.DrawImage($img, $x, $y, $size, $size)
        $img.Dispose()
    } else {
        $brush = New-Object System.Drawing.SolidBrush($discord)
        $g.FillEllipse($brush, $x, $y, $size, $size)
        $brush.Dispose()
    }
}

function Draw-Footer($g) {
    Draw-Text $g "PACKRAT" 846 892 23 $muted $true 230
}

function Save-Canvas($canvas, [string]$name) {
    $bmp = $canvas[0]; $g = $canvas[1]
    $path = Join-Path $Destination $name
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
}

# Marketplace search icon: exact product icon centered on the PackRat dark field.
$search = New-Canvas 512 512
Draw-Icon $search[1] 48 48 416
$search[0].Save((Join-Path $Destination "01_search_icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$search[1].Dispose(); $search[0].Dispose()

# Cover
$c = New-Canvas 1920 960
Draw-Pill $c[1] "FREE STREAM DECK COMPANION" 110 92 420 $accent $bg
Draw-Text $c[1] "PackRat Discord Bridge" 110 185 76 $white $true 1030
Draw-Text $c[1] "Connect Discord Voice Panel to your current Discord voice channel." 112 300 38 $muted $false 1030
Draw-Text $c[1] "Local voice roster  •  speaking state  •  mute + deafen" 112 395 30 $white $false 1000
Draw-Panel $c[1] 1260 160 470 470 $panel
Draw-Icon $c[1] 1335 235 320
Draw-Pill $c[1] "DISCORD READY" 1325 655 340 $discord $white
Draw-Footer $c[1]
Save-Canvas $c "02_cover.png"

# Gallery 1
$c = New-Canvas 1920 960
Draw-Text $c[1] "One bridge. One status key." 110 90 66 $white $true 1200
Draw-Text $c[1] "The free companion tells you exactly what Discord needs." 112 180 34 $muted $false 1250
$states = @(
    @{y=320; title="OPEN DISCORD"; body="Start Discord Desktop and the bridge reconnects automatically."; color=$panel2},
    @{y=475; title="PRESS TO AUTHORIZE"; body="Authorize Discord when the local RPC session needs permission."; color=$discord},
    @{y=630; title="DISCORD READY"; body="Your current voice channel is available to the XENEON panel."; color=$accent}
)
foreach ($state in $states) {
    Draw-Panel $c[1] 110 $state.y 1180 118 $state.color
    Draw-Text $c[1] $state.title 145 ($state.y + 18) 30 $white $true 380
    Draw-Text $c[1] $state.body 530 ($state.y + 23) 25 $white $false 710
}
Draw-Panel $c[1] 1395 310 360 360 $panel
Draw-Icon $c[1] 1455 370 240
Draw-Footer $c[1]
Save-Canvas $c "03_gallery_01.png"

# Gallery 2
$c = New-Canvas 1920 960
Draw-Text $c[1] "Discord stays local." 110 90 66 $white $true 1200
Draw-Text $c[1] "The XENEON widget never receives your Discord access token." 112 180 34 $muted $false 1300
$items = @(
    @{x=110; title="DISCORD DESKTOP"; sub="Native local IPC"; color=$discord},
    @{x=660; title="PACKRAT BRIDGE"; sub="Normalizes voice state"; color=$accent},
    @{x=1210; title="XENEON PANEL"; sub="127.0.0.1 only"; color=$panel2}
)
foreach ($item in $items) {
    Draw-Panel $c[1] $item.x 350 430 250 $item.color
    Draw-Text $c[1] $item.title ($item.x + 34) 405 31 $white $true 360
    Draw-Text $c[1] $item.sub ($item.x + 34) 475 25 $white $false 360
}
Draw-Text $c[1] "→" 565 425 70 $muted $true 80
Draw-Text $c[1] "→" 1115 425 70 $muted $true 80
Draw-Pill $c[1] "NO CLOUD SYNC   •   NO USER TOKEN   •   MEMORY ONLY CREDENTIALS" 360 690 1200 $panel2 $white
Draw-Footer $c[1]
Save-Canvas $c "04_gallery_02.png"

# Gallery 3
$c = New-Canvas 1920 960
Draw-Text $c[1] "Everything the voice panel needs." 110 90 66 $white $true 1400
Draw-Text $c[1] "The bridge handles Discord. XENEON stays focused on the interface." 112 180 34 $muted $false 1450
$features = @(
    "Automatically follow the current voice channel",
    "Live member roster and speaking events",
    "Read real mute and deafen state",
    "Apply touch Mute and Deafen changes",
    "Reconnect when Discord returns"
)
$y = 315
foreach ($feature in $features) {
    Draw-Panel $c[1] 190 $y 1540 90 $panel
    Draw-Text $c[1] "✓" 230 ($y + 13) 38 $accent $true 60
    Draw-Text $c[1] $feature 310 ($y + 18) 30 $white $false 1320
    $y += 108
}
Draw-Footer $c[1]
Save-Canvas $c "05_gallery_03.png"

# Gallery 4
$c = New-Canvas 1920 960
Draw-Text $c[1] "Built for Discord Voice Panel." 110 90 66 $white $true 1400
Draw-Text $c[1] "Install the free bridge once, then let XENEON follow the conversation." 112 180 34 $muted $false 1500
$steps = @(
    @{n="1"; title="Install PackRat Discord Bridge"; body="Free from the Stream Deck Marketplace."},
    @{n="2"; title="Open Discord Desktop"; body="Use the Bridge Status action if authorization is requested."},
    @{n="3"; title="Open Discord Voice Panel"; body="Join any voice channel. The XENEON panel follows automatically."}
)
$y = 330
foreach ($step in $steps) {
    Draw-Pill $c[1] $step.n 135 $y 72 $accent $bg
    Draw-Text $c[1] $step.title 250 ($y - 1) 34 $white $true 1200
    Draw-Text $c[1] $step.body 250 ($y + 49) 27 $muted $false 1320
    $y += 180
}
Draw-Footer $c[1]
Save-Canvas $c "06_gallery_04.png"

$required = @(
    "01_search_icon.png",
    "02_cover.png",
    "03_gallery_01.png",
    "04_gallery_02.png",
    "05_gallery_03.png",
    "06_gallery_04.png"
)
foreach ($file in $required) {
    $path = Join-Path $Destination $file
    if (-not (Test-Path $path)) { throw "Discord Bridge Rat Art output missing: $file" }
    $image = [System.Drawing.Image]::FromFile($path)
    try {
        $expected = if ($file -eq "01_search_icon.png") { @(512, 512) } else { @(1920, 960) }
        if ($image.Width -ne $expected[0] -or $image.Height -ne $expected[1]) {
            throw "Discord Bridge Rat Art wrong dimensions for $file: $($image.Width)x$($image.Height)"
        }
    } finally { $image.Dispose() }
}

Write-Host "Discord Bridge Rat Art complete: $Destination" -ForegroundColor Green
