@echo off
rem  Tao shortcut MN-Qronx (chay file ps1 cung thu muc)
rem  Thu PowerShell 7 truoc, khong co thi quay ve Windows PowerShell
set "HERE=%~dp0"
pwsh -NoProfile -ExecutionPolicy Bypass -File "%HERE%Tao-Shortcut-MN-Qronx.ps1"
if errorlevel 1 powershell -NoProfile -ExecutionPolicy Bypass -File "%HERE%Tao-Shortcut-MN-Qronx.ps1"
