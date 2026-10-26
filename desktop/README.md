# MN-Qronx — App Windows (desktop)

Cửa sổ thật cho web MN-Qronx: **C# WinForms + WebView2** (cùng engine Edge),
đóng gói **MSIX** nộp Microsoft Store, dán lên Start/taskbar với icon riêng.

```
desktop/
├─ MN-Qronx.Window/        # dự án C# (WinForms + WebView2)
│  ├─ Program.cs           # vào app, khóa một instance/máy
│  ├─ MainWindow.cs        # cửa sổ: link ngoài mở trình duyệt, F5 reload,
│  │                       # kích thước + trang cuối lưu Registry
│  ├─ Package.appxmanifest # nhận diện gói MSIX (Identity/Publisher/Splash…)
│  ├─ MN-Qronx.Window.csproj
│  └─ Assets/
│     ├─ logo.ico          # icon exe (sinh bằng node make-ico.mjs)
│     └─ Manifest/         # bộ icon MSIX (sinh bằng make-manifest-icons.ps1)
├─ make-ico.mjs            # ico từ PNG 512
├─ make-manifest-icons.ps1 # bộ icon manifest từ public/icons
├─ package-msix.ps1        # publish + makepri + makeappx + signtool
└─ .dev-cert/              # chứng chỉ ký bản thử (git-ignored, không công khai)
```

## Build & đóng gói

```powershell
# sinh icon cho manifest (chỉ cần lại khi đổi logo)
pwsh -NoProfile -ExecutionPolicy Bypass -File make-manifest-icons.ps1

# đóng gói (mặc định: self-contained, máy khách khỏi cài .NET)
pwsh -NoProfile -ExecutionPolicy Bypass -File package-msix.ps1
```

Kết quả trong `dist\desktop\` (git-ignored):

| File | Dùng cho |
|---|---|
| `MN-Qronx-<ver>-x64.msix` | **nộp Partner Center** (không ký — Microsoft ký lúc nộp) |
| `MN-Qronx-<ver>-x64-signed.msix` | **cài thử máy mình** (`-SignForLocalTest`) |

Công cụ makeappx/makepri/signtool nằm gọn trong NuGet
`Microsoft.Windows.SDK.BuildTools` — **máy build không cần cài Windows SDK**.

## Cài thử trên máy chính (kiểm tra trước khi nộp)

```powershell
# tin chứng chỉ CN=mnqronx (chạy 1 lần, cần admin)
Import-Certificate -FilePath desktop\.dev-cert\mnqronx-local.pfx `
    -CertStoreLocation Cert:\LocalMachine\TrustedPeople

Add-AppxPackage -Path dist\desktop\MN-Qronx-1.0.0.0-x64-signed.msix
```

## Nộp Microsoft Store

1. Đăng ký tài khoản nhà phát triển ([MS Store dev account](https://developer.microsoft.com/store)).
2. Partner Center cấp **Publisher thật** (dạng `CN=ABC123…`) và quyền chọn
   **Identity Name** gói — sửa 2 dòng trong `Package.appxmanifest`:
   `Identity Name` + `Publisher`.
3. Chạy lại `package-msix.ps1` → nộp file `.msix` (bản không ký) vào phần
   Packages của submission để Microsoft ký giúp.
4. Store dễ hỏi lại app bọc web (CDA — Content Destination App): mô tả rõ
   phần app có lợi thế riêng (chuông nhắc hệ thống, mở cục bộ, đăng nhập
   đã lưu) và dùng đúng ảnh chụp thật của cửa sổ.

## Nâng phiên bản

- Đổi `Identity Version` trong `Package.appxmanifest` (vd `1.0.1.0`).
- Đổi `AssemblyVersion`/`FileVersion` trong csproj cho khớp.
- Script đọc version từ manifest → tên file tự đổi theo.
