# ─── MN-Qronx – đóng gói MSIX (nộp Store + cài thử local) ─────────────
# .NET SDK không có target đóng gói MSIX, nhưng công cụ SDK nằm gọn trong
# NuGet Microsoft.Windows.SDK.BuildTools (makeappx, makepri, signtool).
# Quy trình: dotnet publish → dựng thư mục gói → makepri → makeappx → ký.
#
#     pwsh -NoProfile -ExecutionPolicy Bypass -File package-msix.ps1
#     pwsh ... package-msix.ps1 -SignForLocalTest          (+ bản ký bản thử)
#     pwsh ... package-msix.ps1 -FrameworkDependent        (mỏng hơn, nhờ .NET 8 Desktop Runtime đã có trong Store)

param(
    [switch]$FrameworkDependent,  # bản mlui (không nhét runtime .NET vào gói)
    [switch]$SignForLocalTest,    # ký thêm bản.msix bằng chứng tự ký để cài thử bằng Add-AppxPackage
    [string]$Configuration = 'Release'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projDir    = Join-Path $PSScriptRoot 'MN-Qronx.Window'
$csproj     = Join-Path $projDir 'MN-Qronx.Window.csproj'
$manifest   = Join-Path $projDir 'Package.appxmanifest'
$distDir    = Join-Path (Split-Path $PSScriptRoot -Parent) 'dist\desktop'
$buildTools = Join-Path $env:USERPROFILE '.nuget\packages\microsoft.windows.sdk.buildtools'

# ── Công cụ từ gói NuGet BuildTools (tự chọn bản mới nhất; cấu trúc thư
#    mục bên trong là bin\<phiên bản SDK>\<kiến trúc>, khác phiên bản gói)
$btVersion = (Get-ChildItem $buildTools -Directory | Sort-Object Name -Descending | Select-Object -First 1).Name
$binVersion = (Get-ChildItem (Join-Path $buildTools "$btVersion\bin") -Directory | Sort-Object Name -Descending | Select-Object -First 1).Name
$bin       = Join-Path $buildTools "$btVersion\bin\$binVersion\x64"
$makeAppx  = Join-Path $bin 'makeappx.exe'
$makePri   = Join-Path $bin 'makepri.exe'
$signtool  = Join-Path $bin 'signtool.exe'
foreach ($tool in $makeAppx, $makePri, $signtool) {
    if (-not (Test-Path $tool)) {
        throw "Thiếu công cụ: $tool — chạy 'dotnet restore' cho csproj để kéo Microsoft.Windows.SDK.BuildTools"
    }
}

# ── Đọc phiên bản + publisher từ manifest (một nguồn duy nhất)
[xml]$mx = Get-Content $manifest
$displayVersion = $mx.Package.Identity.Version
$pkgName = "MN-Qronx-$displayVersion-x64"

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
Write-Host "Đóng gói MN-Qronx $displayVersion (x64) → $distDir"

# ── 1/4 Publish
$publishArgs = @(
    'publish', $csproj,
    '-c', $Configuration,
    '-r', 'win-x64',
    '--nologo', '-v', 'm'
)
if (-not $FrameworkDependent) { $publishArgs += @('--self-contained', 'true') }
Write-Host "1/4 dotnet publish"
& dotnet @publishArgs
if ($LASTEXITCODE -ne 0) { throw 'dotnet publish thất bại' }

$publishDir = Join-Path $projDir "bin\$Configuration\net8.0-windows10.0.19041.0\win-x64\publish"
if (-not (Test-Path (Join-Path $publishDir 'MNQronx.Window.exe'))) {
    throw "Không thấy MNQronx.Window.exe trong $publishDir"
}

# ── 2/4 Dựng thư mục gói: sạch pdb + file xml tài liệu, thêm manifest
$stage = Join-Path $projDir "obj\$Configuration\msix-root"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null
Write-Host "2/4 Chép nội dung publish → thư mục gốc gói"
Get-ChildItem $publishDir | Where-Object { $_.Extension -notin '.pdb', '.xml' } | ForEach-Object {
    if ($_.PSIsContainer) {
        Copy-Item $_.FullName -Destination (Join-Path $stage $_.Name) -Recurse
    } else {
        Copy-Item $_.FullName -Destination $stage
    }
}
Copy-Item $manifest -Destination (Join-Path $stage 'AppxManifest.xml')

# ── 3/4 resources.pri rồi đóng khối .msix
$work = Join-Path $projDir "obj\$Configuration\msix-work"
New-Item -ItemType Directory -Force -Path $work | Out-Null

Write-Host '3/4 makepri: tạo cấu hình + chỉ mục tài nguyên…'
$priConfig = Join-Path $work 'pri.config.xml'
& $makePri createconfig /cf $priConfig /dq en-us /pv 10.0.0 /o | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'makepri createconfig thất bại' }
& $makePri new /pr $stage /cf $priConfig /mn (Join-Path $stage 'AppxManifest.xml') /of (Join-Path $stage 'resources.pri') /o
if ($LASTEXITCODE -ne 0) { throw 'makepri new thất bại' }

Write-Host "3/4 makeappx: đóng gói .msix…"
$msixPath = Join-Path $distDir "$pkgName.msix"
& $makeAppx pack /o /d $stage /p $msixPath
if ($LASTEXITCODE -ne 0) {
    throw 'makeappx pack thất bại — xem thông báo lỗi phía trên (thường do manifest thiếu file icon được khai báo)'
}

# ── 4/4 (tùy chọn) ký bản cài thử
$signedPath = $null
if ($SignForLocalTest) {
    Write-Host '4/4 Ký chứng tự ký cho bản cài thử…'
    $certDir = Join-Path $PSScriptRoot '.dev-cert'
    New-Item -ItemType Directory -Force -Path $certDir | Out-Null
    $pfx     = Join-Path $certDir 'mnqronx-local.pfx'
    $pfxPass = 'MNQronx-local-cert'

    if (-not (Test-Path $pfx)) {
        # Publisher trong manifest (CN=mnqronx) phải khớp Subject chứng chỉ
        $cert = New-SelfSignedCertificate `
            -Type Custom `
            -Subject 'CN=mnqronx' `
            -KeyUsage DigitalSignature `
            -FriendlyName 'MN-Qronx mac thu cai thu' `
            -CertStoreLocation 'Cert:\CurrentUser\My' `
            -NotAfter (Get-Date).AddYears(3) `
            -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}')
        $plainPass = ConvertTo-SecureString -String $pfxPass -Force -AsPlainText
        Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $plainPass | Out-Null
        Write-Host "    Tạo chứng chỉ CN=mnqronx ($($cert.Thumbprint)) → $pfx"
    }

    $signedPath = Join-Path $distDir "$pkgName-signed.msix"
    Copy-Item $msixPath $signedPath -Force
    & $signtool sign /fd SHA256 /td SHA256 /a /f $pfx /p $pfxPass $signedPath
    if ($LASTEXITCODE -ne 0) { throw 'signtool ký thất bại' }
}

# ── Hoàn tất
Write-Host ''
Get-ChildItem $distDir -Filter '*.msix' |
    Select-Object Name, @{ n = 'Size (MB)'; e = { '{0:N1}' -f ($_.Length / 1MB) } } |
    Format-Table -AutoSize
if ($SignForLocalTest) {
    Write-Host 'Cài thử bản ký (cần quyền admin một lần để tin chứng chỉ):'
    Write-Host "    Import-Certificate -FilePath $certDir\mnqronx-local.pfx -CertStoreLocation Cert:\LocalMachine\TrustedPeople"
    Write-Host "    Add-AppxPackage -Path $signedPath"
}
Write-Host 'Nộp Store: tải file .msix (bản KHÔNG ký) lên Partner Center và chọn để Microsoft ký giúp.'
