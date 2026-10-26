# ─── MN-Qronx – sinh bộ icon cho manifest MSIX ────────────────────────
# Cắt từ PNG 512 của PWA thành đủ cỡ mà manifest khai báo. Chạy một lần
# mỗi lần đổi logo rồi commit lại kết quả (không cần chạy khi build).
#     pwsh -NoProfile -ExecutionPolicy Bypass -File make-manifest-icons.ps1
# Yêu cầu: chạy trên Windows (dùng System.Drawing), chạy từ thư mục desktop.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$webRoot  = Join-Path (Split-Path $PSScriptRoot -Parent) 'public\icons'
$outRoot  = Join-Path $PSScriptRoot 'MN-Qronx.Window\Assets\Manifest'

$srcTile  = Join-Path $webRoot 'icon-maskable-512.png'  # tile: tràn mép có vùng an toàn
$srcIcon  = Join-Path $webRoot 'icon-512.png'           # icon nhỏ: nét giữa trọn
$srcSplash = Join-Path $webRoot 'icon-maskable-512.png'
$bg       = [System.Drawing.Color]::FromArgb(0xFF, 0x0D, 0x1B, 0x2A)  # brand #0D1B2A

Add-Type -AssemblyName System.Drawing

New-Item -ItemType Directory -Force -Path $outRoot | Out-Null

function Copy-Size([string]$src, [string]$dst, [int]$side) {
    $proto = [System.Drawing.Bitmap]::FromFile($src)
    $bmp = New-Object System.Drawing.Bitmap($side, $side)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($proto, 0, 0, $side, $side)
    $g.Dispose()
    $proto.Dispose()
    $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "  tạo $(Split-Path $dst -Leaf)"
}

function New-Splash([string]$src, [string]$dst, [int]$w, [int]$h) {
    $proto = [System.Drawing.Bitmap]::FromFile($src)
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear($bg)
    $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $side = [int]($h * 0.52)                      # icon cao ~nửa màn hình chào
    $x = [int](($w - $side) / 2); $y = [int](($h - $side) / 2)
    $g.DrawImage($proto, $x, $y, $side, $side)
    $g.Dispose()
    $proto.Dispose()
    $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "  tạo $(Split-Path $dst -Leaf)"
}

Write-Host "Sinh icon manifest vào $outRoot"

# Ô vuông Start (150x150) — dùng ảnh maskable để tràn khung đẹp
foreach ($pair in @{ 'scale-100' = 150; 'scale-125' = 188; 'scale-150' = 225; 'scale-200' = 300 }.GetEnumerator()) {
    Copy-Size $srcTile (Join-Path $outRoot "Square150x150Logo.$($pair.Key).png") $pair.Value
}

# Icon app (44x44) — mọi cỡ biên ích + cỡ trên thanh taskbar (không khung)
foreach ($pair in @{ 'scale-100' = 44; 'scale-125' = 55; 'scale-150' = 66; 'scale-200' = 88 }.GetEnumerator()) {
    Copy-Size $srcIcon (Join-Path $outRoot "Square44x44Logo.$($pair.Key).png") $pair.Value
}
foreach ($side in 16, 20, 24, 30, 32, 36, 48, 60, 64, 72, 80, 96, 256) {   # plain (có nền viền)
    Copy-Size $srcTile (Join-Path $outRoot "Square44x44Logo.targetsize-$side.png") $side
}
foreach ($side in 16, 20, 24, 30, 32, 36, 48, 60, 64, 72, 80, 96, 256) {   # unplated (nền trong suốt, taskbar dùng)
    Copy-Size $srcIcon (Join-Path $outRoot "Square44x44Logo.targetsize-${side}_altform-unplated.png") $side
}

# Icon nhỏ của Store (50x50)
foreach ($pair in @{ 'scale-100' = 50; 'scale-125' = 63; 'scale-150' = 75; 'scale-200' = 100 }.GetEnumerator()) {
    Copy-Size $srcTile (Join-Path $outRoot "StoreLogo.$($pair.Key).png") $pair.Value
}

# Màn hình chào khi bấm nút mở
foreach ($pair in @{ 'scale-100' = @(620, 300); 'scale-125' = @(775, 375); 'scale-150' = @(930, 450); 'scale-200' = @(1240, 600) }.GetEnumerator()) {
    New-Splash $srcSplash (Join-Path $outRoot "SplashScreen.$($pair.Key).png") $pair.Value[0] $pair.Value[1]
}

Write-Host "Xong: $((Get-ChildItem $outRoot -Filter *.png).Count) file trong Assets\Manifest"
