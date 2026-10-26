# ─── MN-Qronx Extension – đóng gói ZIP nộp Chrome/Edge Web Store ──────
# Quy tắc sống còn của Store: manifest.json PHẢI nằm ở THƯ MỤC GỐC của zip
# và đường dẫn entry dùng '/' (không '\'). Những zip nén tay bằng Explorer
# hoặc Compress-Archive cũ dễ sinh entry phân cách '\' hoặc thư mục bọc
# ngoài (extension/manifest.json) → Store báo "Gói không hợp lệ".
#
# Script này chạy trên pwsh (.NET mới dùng '/' chuẩn), tự đọc version trong
# manifest.json, xuất sang dist\extension\ và TỰ KIỂM TRA sau khi nén.
#
#   pwsh -NoProfile -ExecutionPolicy Bypass -File package-extension.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression.FileSystem

$src    = $PSScriptRoot
$root   = Split-Path $PSScriptRoot -Parent
$outDir = Join-Path $root 'dist\extension'

$manifestPath = Join-Path $src 'manifest.json'
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version  = $manifest.version
if (-not $version) { throw 'manifest.json không đọc được version' }

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$zipPath = Join-Path $outDir "mn-qronx-extension-$version.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

# Staging sạch: chép đúng các file cần nén, loại script đóng gói + rác Windows.
# Không nén trực tiếp thư mục extension để zip không lẫn tooling nội bộ.
$staging = Join-Path ([System.IO.Path]::GetTempPath()) "mnqext-$version"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Force -Path $staging | Out-Null
Get-ChildItem $src -Recurse -File | Where-Object {
    # loại: tooling nội bộ, rác Windows, và thư mục store/ (ảnh chụp + icon
    # listing dùng cho dashboard — không thuộc gói runtime)
    $_.Extension -notin '.ps1', '.md' -and
    $_.Name -notin 'Thumbs.db', 'desktop.ini' -and
    $_.FullName.Substring($src.Length + 1) -notmatch '^store\\'
} | ForEach-Object {
    $rel = $_.FullName.Substring($src.Length + 1)
    $dstFile = Join-Path $staging $rel
    New-Item -ItemType Directory -Force -Path (Split-Path $dstFile -Parent) | Out-Null
    Copy-Item $_.FullName $dstFile
}

# includeBaseDirectory = $false → entry tính từ gốc staging:
# manifest.json, background.js, popup/... (thư mục bọc ngoài KHÔNG tồn tại)
[System.IO.Compression.ZipFile]::CreateFromDirectory(
    $staging, $zipPath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false,
    $null)
Remove-Item $staging -Recurse -Force

# ── Tự kiểm tra: mọi entry dùng '/', manifest.json ở gốc ─────────────
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $bad = @($zip.Entries | Where-Object { $_.FullName -like '*\*' })
    if ($bad.Count -gt 0) { throw "Có entry dùng '\': $($bad.FullName -join ', ')" }
    if (-not ($zip.Entries | Where-Object { $_.FullName -eq 'manifest.json' })) {
        throw 'manifest.json KHỔNG ở gốc zip'
    }
    Write-Host ("Đóng gói OK: {0}" -f $zipPath)
    Write-Host ("  • {0} entry, {1:N0} KB nén" -f $zip.Entries.Count, ((Get-Item $zipPath).Length / 1KB))
    Write-Host "  • Danh sách:"
    $zip.Entries | ForEach-Object { Write-Host ("     " + $_.FullName) }
}
finally { $zip.Dispose() }
