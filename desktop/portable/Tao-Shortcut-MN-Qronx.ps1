#  Tao-Shortcut-MN-Qronx.ps1 — tạo shortcut cho bản MN-Qronx giải nén
#  Chạy CÙNG THƯ MỤC với MNQronx.Window.exe: tạo 1 shortcut trên Desktop
#  và 1 shortcut trong Start Menu → app có icon riêng như app thật.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$dir = $PSScriptRoot
$exe = Join-Path $dir 'MNQronx.Window.exe'
if (-not (Test-Path $exe)) { throw "Không thấy MNQronx.Window.exe cạnh file này ($dir)" }

$shell = New-Object -ComObject WScript.Shell

function New-Lnk([string]$lnkPath) {
    $lnk = $shell.CreateShortcut($lnkPath)
    $lnk.TargetPath = $exe
    $lnk.IconLocation = "$exe,0"
    $lnk.Description = 'MN-Qronx — Nhắc việc & quản lý thời gian'
    $lnk.WorkingDirectory = $dir
    $lnk.Save()
    Write-Host "  tạo $lnkPath"
}

# 1) Desktop
$desktopPath = [Environment]::GetFolderPath('Desktop')
New-Lnk (Join-Path $desktopPath 'MN-Qronx.lnk')

# 2) Start Menu (của riêng user — không cần quyền admin)
$startMenuPrograms = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
New-Lnk (Join-Path $startMenuPrograms 'MN-Qronx.lnk')

Write-Host ''
Write-Host 'Xong! Đã tạo shortcut MN-Qronx ở Desktop và Start Menu.'
Read-Host 'Bấm Enter để đóng'
