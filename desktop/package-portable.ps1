# ─── MN-Qronx – gói bản portable (.zip tải về, giải nén là chạy) ──────
# Không cài đặt, không cần chứng chỉ số. Quy trình:
#   dotnet publish (self-contained) → dựng thư mục MN-Qronx-win64/ (kèm
#   hướng dẫn + script shortcut) → Compress-Archive → dist\desktop\.
#
#     pwsh -NoProfile -ExecutionPolicy Bypass -File package-portable.ps1
#
# Nếu app đang mở thì tự đóng rồi mở lại sau khi gói xong (không mất
# gì — temp của WebView2 ở LOCALAPPDATA).

param(
    [string]$Configuration = 'Release'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projDir    = Join-Path $PSScriptRoot 'MN-Qronx.Window'
$csproj     = Join-Path $projDir 'MN-Qronx.Window.csproj'
$manifest   = Join-Path $projDir 'Package.appxmanifest'
$portableIn = Join-Path $PSScriptRoot 'portable'
$distDir    = Join-Path (Split-Path $PSScriptRoot -Parent) 'dist\desktop'

[xml]$mx = Get-Content $manifest
$version = $mx.Package.Identity.Version
$shortVer = if ($version -match '^(\d+\.\d+\.\d+)\.\d+$') { $Matches[1] } else { $version }
$zipPath = Join-Path $distDir "MN-Qronx-$shortVer-win64.zip"

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
Write-Host "Gói portable MN-Qronx $shortVer (x64)"

# ── App đang chạy thì đóng (file exe bị publish/zip chạm vào)
$wasRunning = $false
$running = Get-Process -Name 'MNQronx.Window' -ErrorAction SilentlyContinue
if ($running) {
    $wasRunning = $true
    foreach ($p in $running) {
        Write-Host "   Đóng instance đang chạy (PID $($p.Id)) để build, mở lại sau…"
        Stop-Process -Id $p.Id -Force
    }
    Start-Sleep -Milliseconds 800
}

# ── 1/3 Publish self-contained
$publishArgs = @(
    'publish', $csproj,
    '-c', $Configuration,
    '-r', 'win-x64',
    '--self-contained', 'true',
    '--nologo', '-v', 'm'
)
Write-Host '1/3 dotnet publish'
& dotnet @publishArgs
if ($LASTEXITCODE -ne 0) { throw 'dotnet publish thất bại' }

$publishDir = Join-Path $projDir "bin\$Configuration\net8.0-windows10.0.19041.0\win-x64\publish"
if (-not (Test-Path (Join-Path $publishDir 'MNQronx.Window.exe'))) {
    throw "Không thấy MNQronx.Window.exe trong $publishDir"
}

# ── 2/3 Dựng thư mục gói: sạch pdb/xml + văn bản cho người dùng
$stage = Join-Path $projDir "obj\$Configuration\MN-Qronx-win64"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null
Write-Host '2/3 Chép nội dung publish + hướng dẫn'
Get-ChildItem $publishDir | Where-Object { $_.Extension -notin '.pdb', '.xml' -and $_.Name -notlike '*.WebView2' } | ForEach-Object {
    if ($_.PSIsContainer) {
        Copy-Item $_.FullName -Destination (Join-Path $stage $_.Name) -Recurse
    } else {
        Copy-Item $_.FullName -Destination $stage
    }
}
Copy-Item (Join-Path $portableIn 'Huong-dan-chay.txt')            -Destination $stage
Copy-Item (Join-Path $portableIn 'Tao-Shortcut-MN-Qronx.bat')    -Destination $stage
Copy-Item (Join-Path $portableIn 'Tao-Shortcut-MN-Qronx.ps1')    -Destination $stage

# ── 3/3 Nén .zip
Write-Host "3/3 Compress-Archive → $zipPath"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path $stage -DestinationPath $zipPath -CompressionLevel Optimal

# ── Xong: mở lại app nếu trước đó đang chạy (chạy từ thư mục gói)
if ($wasRunning) {
    Start-Process (Join-Path $stage 'MNQronx.Window.exe')
}

Get-childItem $zipPath |
    Select-Object Name, @{ n = 'Size (MB)'; e = { '{0:N1}' -f ($_.Length / 1MB) } } |
    Format-Table -AutoSize
Write-Host "Giao cho khách: tải $zipPath — giải nén, đúp MNQronx.Window.exe là chạy."
