// ─── MN-Qronx – App Windows (WinForms + WebView2) ─────────────────────
// Cửa sổ riêng cho web MN-Qronx: cùng engine Edge nhưng có icon riêng
// trên Start/Taskbar, khung cửa sổ hệ thống và đóng gói MSIX nộp Store.
// Link ngoài trang (domain khác, tải file) mở bằng trình duyệt mặc định
// của máy người dùng; trang chủ luôn chạy trong app.

using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using System.Text.Json;

namespace MNQronx.Window;

public sealed class MainWindow : Form
{
    private const string StartUrl = "https://mn-qronx.id.vn/app";
    private const string AllowedHost = "mn-qronx.id.vn";

    // Dịch vụ đăng nhập chạy NGAY TRONG app: flow Google OAuth đi qua
    // mn-qronx → accounts.google.com → chọn tài khoản → hand-off consent
    // (cookie signed part=…) → callback về mn-qronx. Google có thể dùng
    // bất kỳ host con nào của mình trong flow; nếu chặn gượng thì trang
    // hand-off bị bắn ra trình duyệt không带回cookie phiên → Google 400.
    // Cả họ google.com coi như "trong app"; URL ngoài họ này nhưng
    // không phải trang app vẫn mở bằng trình duyệt như cũ.
    private const string RegistryKey = @"Software\MNQronx\Window";

    private Microsoft.Web.WebView2.WinForms.WebView2? _web;

    public MainWindow()
    {
        Text = "MN-Qronx — Nhắc việc & quản lý thời gian";
        Icon = new Icon(Path.Combine(AppContext.BaseDirectory, "Assets", "logo.ico"));
        MinimizeBox = true;
        LoadWindowBounds();

        Shown += async (_, _) =>
        {
            _web = new Microsoft.Web.WebView2.WinForms.WebView2
            {
                Dock = DockStyle.Fill,
            };
            Controls.Add(_web);

            // Dữ liệu web của app để trong %LOCALAPPDATA%\MNQronx\WebView2
            // — không rải profile lên thư mục exe (nhớ đăng nhập giữa các
            // phiên nhưng gọn gàng khi phát hành bản tải về)
            var userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "MNQronx", "WebView2");
            var environment = await Microsoft.Web.WebView2.Core.CoreWebView2Environment
                .CreateAsync(null, userDataFolder);
            await _web.EnsureCoreWebView2Async(environment);
            var core = _web.CoreWebView2;

            // ── Cầu chuông nền ───────────────────────────────────────────
            // Inject script nhỏ vào từng trang để đưa token đăng nhập từ
            // localStorage của web về host app. Daemon (--bell, tự chạy cùng
            // Windows) dùng token này để hỏi server "nhắc nhở đến hạn" kể cả
            // khi cửa sổ app đóng. CHỈ trang mn-qronx mới đẩy: trang Google
            // chạy trong app không có token — bắn null về sẽ bị hiểu nhầm
            // thành "đăng xuất" và xóa nhầm phiên của daemon.
            await core.AddScriptToExecuteOnDocumentCreatedAsync($$"""
                (function () {
                  try {
                    if (!window.chrome || !window.chrome.webview) return;
                    if (location.origin !== 'https://{{AllowedHost}}') return;
                    window.chrome.webview.postMessage(JSON.stringify({
                      t: 'mnqronxBell',
                      accessToken: localStorage.getItem('mnq:accessToken'),
                      refreshToken: localStorage.getItem('mnq:refreshToken'),
                    }));
                  } catch (e) { /* trang chặn script — bỏ */ }
                })()
                """);
            core.WebMessageReceived += (_, e) =>
            {
                try
                {
                    using var doc = JsonDocument.Parse(e.WebMessageAsJson);
                    if (!doc.RootElement.TryGetProperty("t", out var tEl) ||
                        tEl.GetString() != "mnqronxBell")
                        return;
                    string? access = doc.RootElement.TryGetProperty("accessToken", out var a) &&
                                     a.ValueKind == JsonValueKind.String ? a.GetString() : null;
                    string? refresh = doc.RootElement.TryGetProperty("refreshToken", out var rv) &&
                                      rv.ValueKind == JsonValueKind.String ? rv.GetString() : null;
                    if (access is null && refresh is null)
                    {
                        TokenStore.Clear();          // khách đăng xuất → dừng chuông nền
                        return;                      // daemon đọc được sự kiện này, khỏi đẻ thêm
                    }
                    TokenStore.Save(new BellTokens(access, refresh, null));
                    BellDaemonEnsureRunning();       // token mới → daemon sẵn sàng
                }
                catch
                {
                    /* tin nhắn lạ bỏ qua */
                }
            };

            EnsureBellDaemonRegistered();

            // Tiêu đề cửa sổ theo trang
            core.DocumentTitleChanged += (_, _) =>
                Text = string.IsNullOrWhiteSpace(core.DocumentTitle)
                    ? "MN-Qronx" : core.DocumentTitle;

            // Cửa sổ mới (popup): popup của host trong app (Google hand-off
            // consent…) mở thành cửa sổ con THẬT dùng chung profile — giữ
            // đúng ngữ cảnh phiên; ngoài phạm vi thì mới ra trình duyệt.
            // Popup không có URI (about:blank) → không làm gì cả (chặn bỏ
            // thẳng, tránh mở chỗ trống).
            core.NewWindowRequested += (_, e) =>
            {
                e.Handled = true;
                if (string.IsNullOrEmpty(e.Uri) || e.Uri == "about:blank")
                    return;
                if (ShouldStayInApp(e.Uri))
                {
                    var popup = new PopupWindow(e.Uri, ShouldStayInApp, IsInternal, environment);
                    popup.NavigateMainWindowRequested += (_, url) => core.Navigate(url);
                    popup.Show(this);
                }
                else
                {
                    OpenInSystemBrowser(e.Uri);
                }
            };

            // Điều hướng ra ngoài app (không phải host chính và không phải
            // dịch vụ đăng nhập)? Mở bằng trình duyệt mặc định
            core.NavigationStarting += (_, e) =>
            {
                if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) &&
                    !ShouldStayInApp(uri.ToString()) &&
                    uri.Scheme is "http" or "https")
                {
                    e.Cancel = true;
                    OpenInSystemBrowser(uri.ToString());
                }
            };

            // Tải file về: bắn link ra trình duyệt để lưu Downloads hệ thống
            core.DownloadStarting += (_, e) =>
            {
                e.Handled = true;
                OpenInSystemBrowser(e.DownloadOperation.Uri);
            };

            // F5 = tải lại; Ctrl+Home = về trang chủ
            KeyPreview = true;
            KeyDown += (_, e) =>
            {
                if (e.KeyCode == Keys.F5) core.Reload();
                if (e.Control && e.KeyCode == Keys.Home) core.Navigate(StartUrl);
            };

            core.Navigate(LastUrlOr(StartUrl));
        };

        FormClosing += (_, _) =>
        {
            SaveWindowBounds();
        };
    }

    private static bool IsInternal(string? url)
    {
        return Uri.TryCreate(url, UriKind.Absolute, out var uri)
            && (uri.Host == AllowedHost || uri.Host.EndsWith($".{AllowedHost}"));
    }

    // Họ google.com: mọi bước của flow OAuth Google (accounts, consent,
    // myaccount…) đều nằm trong app, tránhhand-off mất phiên
    private static bool IsGoogleHost(string? url)
    {
        return Uri.TryCreate(url, UriKind.Absolute, out var uri)
            && (uri.Host == "google.com"
                || uri.Host.EndsWith(".google.com")
                || uri.Host == "accounts.youtube.com");
    }

    private static bool ShouldStayInApp(string? url) =>
        IsInternal(url) || IsGoogleHost(url);

    private static string LastUrlOr(string fallback)
    {
        using var key = Registry.CurrentUser.OpenSubKey(RegistryKey);
        return (key?.GetValue("LastUrl") as string) ?? fallback;
    }

    private void LoadWindowBounds()
    {
        using var key = Registry.CurrentUser.OpenSubKey(RegistryKey);
        if (key is null) return;

        var x = Convert.ToInt32(key.GetValue("X", 80));
        var y = Convert.ToInt32(key.GetValue("Y", 40));
        var w = Convert.ToInt32(key.GetValue("W", 1280));
        var h = Convert.ToInt32(key.GetValue("H", 820));

        if (w >= 420 && h >= 320)
        {
            StartPosition = FormStartPosition.Manual;
            WindowState = FormWindowState.Normal;
            Bounds = new Rectangle(x, y, w, h);
        }
    }

    private void SaveWindowBounds()
    {
        var bounds = WindowState == FormWindowState.Normal
            ? Bounds
            : RestoreBounds;
        using (var key = Registry.CurrentUser.CreateSubKey(RegistryKey))
        {
            key.SetValue("X", bounds.X);
            key.SetValue("Y", bounds.Y);
            key.SetValue("W", bounds.Width);
            key.SetValue("H", bounds.Height);
            if (_web?.CoreWebView2?.Source is { } source)
                key.SetValue("LastUrl", source);
        }
    }

    private static void OpenInSystemBrowser(string? url)
    {
        if (string.IsNullOrEmpty(url)) return;
        try
        {
            System.Diagnostics.Process.Start(
                new System.Diagnostics.ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch
        {
            /* bỏ qua */
        }
    }

    // ── Chuông nền (daemon) ──────────────────────────────────────────
    // Đăng ký chạy cùng Windows: Run key HKCU trỏ exe --bell. Daemon tự
    // làm lại mỗi lần chạy nên chỉ cửa sổ app "khớp lại" giá trị.
    private static void EnsureBellDaemonRegistered()
    {
        try
        {
            var exePath = Environment.ProcessPath;
            if (exePath is null) return;
            using var key = Registry.CurrentUser.CreateSubKey(
                @"Software\Microsoft\Windows\CurrentVersion\Run");
            key.SetValue("MNQronxBell", $"\"{exePath}\" --bell");
        }
        catch
        {
            /* không ghi được — daemon vẫn sống trong phiên này */
        }
    }

    private static void BellDaemonEnsureRunning()
    {
        try
        {
            // Daemon đang sống (đang giữ mutex riêng)? thì khỏi đẻ process
            // thêm — script bridge bắn mỗi lần trang tạo document, không
            // lọc sẽ spam spawn. Race nhỏ lúc daemon khởi động lần đầu:
            // process dư thừa tự thoát bởi mutex singleton của nó.
            if (Mutex.TryOpenExisting("MNQronx.BellDaemon", out var daemonmutex))
            {
                daemonmutex.Dispose();
                return;
            }
            var exePath = Environment.ProcessPath;
            if (exePath is null) return;
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(exePath, "--bell")
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden,
            });
        }
        catch
        {
            /* bỏ qua */
        }
    }
}
