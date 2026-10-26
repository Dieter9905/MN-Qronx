# MN-Qronx — App Windows (desktop)

Cửa sổ thật cho web MN-Qronx: **C# WinForms + WebView2** (cùng engine Edge),
có icon riêng trên Start/taskbar, khung cửa sổ hệ thống.

Kênh phát hành chính: **portable ZIP** — khách tải về, giải nén, đúp chạy.

```
desktop/
├─ MN-Qronx.Window/        # dự án C# (WinForms + WebView2)
│  ├─ Program.cs           # vào app, khóa một instance/máy
│  ├─ MainWindow.cs        # cửa sổ: link ngoài mở trình duyệt, F5 reload,
│  │                       # kích thước + trang cuối lưu Registry,
│  │                       # dữ liệu web ở %LOCALAPPDATA%\MNQronx\WebView2
│  ├─ Package.appxmanifest # nhận diện MSIX (chỉ dùng nếu chọn gói MSIX)
│  ├─ MN-Qronx.Window.csproj
│  └─ Assets/
│     ├─ logo.ico          # icon exe (node make-ico.mjs)
│     └─ Manifest/         # bộ icon MSIX (make-manifest-icons.ps1)
├─ portable/               # nội dung đi kèm ZIP: hướng dẫn + script shortcut
├─ build & gói (chỉ cần PowerShell + dotnet, không cần Windows SDK)
│  ├─ make-ico.mjs
│  ├─ make-manifest-icons.ps1
│  ├─ package-portable.ps1 # ← gói ZIP phát hành
│  └─ package-msix.ps1     # ← gói MSIX (tùy chọn)
└─ .dev-cert/              # chứng chỉ ký thử (git-ignored)
```

## Gói ZIP cho khách (kênh chính)

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File package-portable.ps1
```

Xuất `dist\desktop\MN-Qronx-<ver>-win64.zip` (~85 MB, self-contained —
máy Windows 10 1809+ đúp chạy luôn, không cần cài .NET). Trong zip có:

- `MNQronx.Window.exe` + toàn bộ runtime
- `Huong-dan-chay.txt` — hướng dẫn cho người dùng
- `Tao-Shortcut-MN-Qronx.bat` — tạo shortcut Desktop + Start Menu

Đóng gói sẽ tự đóng app đang mở và mở lại sau; profile WebView2 không
bao giờ lọt vào gói (đã lọc `*.WebView2` + dữ liệu web chuyển về
`%LOCALAPPDATA%\MNQronx\WebView2`).

Việc còn lại của việc phát hành: từ destination khách tải được —
đặt file zip lên hosting (GitHub Releases / trang tải của mn-qronx.id.vn).

## Gói MSIX (tùy chọn, dùng khi muốn cài có biểu tượng + gỡ sạch)

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File package-msix.ps1 -SignForLocalTest
```

`dotnet publish → makepri → makeappx → signtool` (công cụ trong NuGet
`Microsoft.Windows.SDK.BuildTools`). Cài thử: import `desktop\.dev-cert\
mnqronx-local.pfx` vào `Cert:\LocalMachine\TrustedPeople` rồi
`Add-AppxPackage -Path dist\desktop\MN-Qronx-<ver>-x64-signed.msix`.

## Nâng phiên bản

- `Identity Version` trong `Package.appxmanifest` (vd `1.0.1.0`) — zip/
  msix tự lấy tên phiên bản từ đây.
- `AssemblyVersion`/`FileVersion` trong csproj cho khớp.
