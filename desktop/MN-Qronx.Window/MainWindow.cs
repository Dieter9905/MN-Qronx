// ─── MN-Qronx – App Windows (WinForms + WebView2) ─────────────────────
// Cửa sổ riêng cho web MN-Qronx: cùng engine Edge nhưng có icon riêng
// trên Start/Taskbar, khung cửa sổ hệ thống và đóng gói MSIX nộp Store.
// Link ngoài trang (domain khác, tải file) mở bằng trình duyệt mặc định
// của máy người dùng; trang chủ luôn chạy trong app.

using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;

namespace MNQronx.Window;

public sealed class MainWindow : Form
{
    private const string StartUrl = "https://mn-qronx.id.vn/app";
    private const string AllowedHost = "mn-qronx.id.vn";
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

            await _web.EnsureCoreWebView2Async();
            var core = _web.CoreWebView2;

            // Tiêu đề cửa sổ theo trang
            core.DocumentTitleChanged += (_, _) =>
                Text = string.IsNullOrWhiteSpace(core.DocumentTitle)
                    ? "MN-Qronx" : core.DocumentTitle;

            // Cửa sổ mới (redirect ĐK Google, tải file…) — đi ra trình duyệt
            core.NewWindowRequested += (_, e) =>
            {
                e.Handled = true;
                if (IsInternal(e.Uri))
                    core.Navigate(e.Uri);
                else
                    OpenInSystemBrowser(e.Uri);
            };

            // Điều hướng ra ngoài app? Mở bằng trình duyệt mặc định
            core.NavigationStarting += (_, e) =>
            {
                if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) &&
                    !IsInternal(uri.ToString()) &&
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
}
