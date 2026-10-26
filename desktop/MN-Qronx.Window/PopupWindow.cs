// ─── MN-Qronx – Cửa sổ popup con của WebView2 chính ──────────────────
// Google đăng nhập có bước sinh popup (hand-off consent). Popup ấy mang
// ngữ cảnh phiên của app; nếu bắn ra trình duyệt mặc định thì mất
// (cookie/handshake không theo) → Google 400 "malformed". Vì vậy popup
// của host thuộc app mở thành cửa sổ con có WebView2 chia sẻ chung
// environment/profile với cửa sổ chính, đi theo các host được phép.
// Khi popup cuối cùng về trang thật của app (mn-qronx), URL được
// chuyển về cửa sổ chính rồi popup tự đóng.

using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace MNQronx.Window;

internal sealed class PopupWindow : Form
{
    private readonly CoreWebView2Environment _environment;
    private readonly Func<string, bool> _shouldStayInApp;
    private readonly Func<string, bool> _isAppHost;

    // Cửa sổ chính nghe để tự navigate tới URL này khi popup đi về app
    public event EventHandler<string>? NavigateMainWindowRequested;

    public PopupWindow(
        string url,
        Func<string, bool> shouldStayInApp,
        Func<string, bool> isAppHost,
        CoreWebView2Environment environment)
    {
        _shouldStayInApp = shouldStayInApp;
        _isAppHost = isAppHost;
        _environment = environment;

        Text = "MN-Qronx";
        StartPosition = FormStartPosition.CenterParent;
        MinimizeBox = false;
        MaximizeBox = false;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        Size = new Size(640, 720);

        var web = new WebView2 { Dock = DockStyle.Fill };
        Controls.Add(web);

        Shown += async (_, _) =>
        {
            await web.EnsureCoreWebView2Async(_environment);
            var core = web.CoreWebView2;

            core.DocumentTitleChanged += (_, _) =>
                Text = string.IsNullOrWhiteSpace(core.DocumentTitle) ? "MN-Qronx" : core.DocumentTitle;

            core.NewWindowRequested += (inner, ne) =>
            {
                ne.Handled = true;
                if (!string.IsNullOrEmpty(ne.Uri) && ne.Uri != "about:blank")
                    core.Navigate(ne.Uri);   // popup mới từ popup → ở lại popup này
            };

            core.NavigationStarting += (_, ne) =>
            {
                if (Uri.TryCreate(ne.Uri, UriKind.Absolute, out var uri) &&
                    uri.Scheme is "http" or "https" &&
                    !_shouldStayInApp(ne.Uri))
                {
                    ne.Cancel = true;        // ngoài phạm vi app → chặn. Popup chỉ
                                             // làm nhiệm vụ đăng nhập; bắn ra trình
                                             // duyệt = mất phiên, Google 400
                    return;
                }

                //URL tới trang thật của app (mn-qronx…) → đưa về cửa sổ chính
                if (Uri.TryCreate(ne.Uri, UriKind.Absolute, out uri) && _isAppHost(ne.Uri))
                {
                    NavigateMainWindowRequested?.Invoke(this, ne.Uri);
                    Close();
                }
            };

            core.Navigate(url);
        };
    }
}
