# MN-Qronx — App Windows (desktop)

Cửa sổ thật cho web MN-Qronx: **C# WinForms + WebView2** (cùng engine Edge),
có icon riêng trên Start/taskbar, khung cửa sổ hệ thống.

Kênh phát hành chính: **portable ZIP** — khách tải về, giải nén, đúp chạy.

```
desktop/
├─ MN-Qronx.Window/        # dự án C# (WinForms + WebView2)
│  ├─ Program.cs           # vào app, khóa một instance/máy; route --bell
│  │                       # (daemon chuông nền) và --bell-test
│  ├─ MainWindow.cs        # cửa sổ: host link google.com trong app, trang
│  │                       # ngoài mở trình duyệt, popup Google chạy như
│  │                       # cửa sổ con chia sẻ profile; cầu chuông nền
│  │                       # (inject script đọc mnq:accessToken → đè TokenStore);
│  │                       # F5 reload, kích thước + trang cuối lưu Registry,
│  │                       # dữ liệu web ở %LOCALAPPDATA%\MNQronx\WebView2
│  ├─ PopupWindow.cs       # cửa sổ popup con (đăng nhập Google hand-off)
│  ├─ BellDaemon.cs        # chuông nền: hỏi /reminders/due mỗi 60s, toast +
│  │                       # chuông đúng kiểu web; tự refresh token;
│  │                       # đăng ký Run key HKCU khởi động cùng máy
│  ├─ ToastSupport.cs      # shortcut AUMID (MT.mnqronx.Window) + toast Windows
│  ├─ TokenStore.cs        # token daemon mã hoá DPAPI trong Bell\tokens.bin
│  ├─ BellSound.cs         # melody chuông 6 nốt (22050 Hz) đúng kiểu web
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

Việc còn lại của việc phát hành: đưa file zip lên VPS production để
link tải cố định trên site hoạt động (landing + banner trong app đều
trỏ tới URL này):

```bash
# trên máy dev: scp file zip đã đóng gói lên VPS
ssh root@<vps> "mkdir -p /var/www/qronx/downloads"
scp dist/desktop/MN-Qronx-<ver>-win64.zip root@<vps>:/var/www/qronx/downloads/MN-Qronx-win64.zip
```

Frontend trỏ cố định `https://mn-qronx.id.vn/downloads/MN-Qronx-win64.zip`
(tên không kèm version — mỗi lần phát hành chỉ thay file trên VPS,
hằng số nằm ở `src/lib/constants.js#DESKTOP_DOWNLOAD_URL`).

## Chuông nền (báo đến hạn dù app đóng)

Yêu cầu của khách: "chuông báo thông báo đến hạn và thông báo nhắc hẹn
phải kêu trên máy kể cả khi app không mở". Giải pháp không cần sửa gì
trên web/deploy:

- **Cầu token** — MainWindow inject một script nhỏ vào mọi trang;
  chỉ chạy trên origin `mn-qronx.id.vn`, đọc `mnq:accessToken` /
  `mnq:refreshToken` từ localStorage và gửi về host qua
  `window.chrome.webview.postMessage`. Host ghi vào TokenStore (DPAPI,
  `%LOCALAPPDATA%\MNQronx\Bell\tokens.bin`) và nhắc daemon dậy.
  Trang Google trong app bị loại — bắn null về sẽ bị hiểu nhầm thành
  đăng xuất. Đăng xuất trong web → script gửi null → file token bị xóa
  → daemon buông phiên (tắt chuông).
- **Daemon** — `MNQronx.Window.exe --bell` (singleton mutex riêng, có
  cửa sổ chính thì lui để còn web kêu đúng một nguồn). Làm y hệt
  `AlarmContext` của web: `GET /api/v1/reminders/due` mỗi 60 giây,
  access token hết hạn (401) thì tự refresh (server không rotate
  refresh token nên daemon dùng chung phiên an toàn). Có reminder đến
  hạn → toast (AUMID `MT.mnqronx.Window` qua shortcut Start Menu có
  PKEY_AppUserModel_ID, daemon tự tạo/cập nhật) + chuông 6 nốt 120 giây;
  mỗi nhắc kêu lại xa nhất 5 phút/lần.
- **Tự sống** — daemon tự ghi Run key `HKCU\...\Run\MNQronxBell`
  = `"<exe>" --bell` (cửa sổ chính ghi lại mỗi lần mở để trỏ đúng
  chỗ exe mới). Khách gỡ sạch: đăng xuất trong app rồi xóa thư mục.

Thử chuông không cần đăng nhập:

```powershell
MNQronx.Window.exe --bell-test    # toast + chuông 9 giây rồi thoát
```

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
