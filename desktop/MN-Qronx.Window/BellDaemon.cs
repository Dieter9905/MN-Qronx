// ─── MN-Qronx – Chuông nền (chạy dù cửa sổ app đóng) ─────────────────
// NỔ: server MN-Qronx đã có cron tính "nhắc nhở đến hạn" mỗi phút; daemon
// chỉ cần làm Y HỆT AlarmContext của web: hỏi GET /reminders/due mỗi 60
// giây, ra kết quả là RỒNG thông báo Windows + chuông. Token từ cửa sổ
// app đẩy về qua WebView2 message (script inject); access token hết hạn
// thì tự refresh bằng refresh token (server không rotate → an toàn, dùng
// chung với web không giết phiên ai).
//
// Daemon tôn trọng cửa sổ app khi mở: cửa sổ đang chạy (mutex tồn tại) =
// web đã có chuông trên màn hình, daemon im lặng + lui lại vòng sau.

using System.Text.Json;
using Microsoft.Win32;

namespace MNQronx.Window;

internal static class BellDaemon
{
    private const string ApiBase = "https://mn-qronx.id.vn/api/v1";
    private const string InstanceMutexName = "MNQronx.BellDaemon";

    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(15) };
    private static string? _access;
    private static string? _refresh;
    private static readonly Dictionary<string, DateTime> LastRing = new();

    public static int Run(bool selfTest)
    {
        // chỉ một daemon mỗi máy
        using var instance = new Mutex(true, InstanceMutexName, out var isFirst);
        if (!isFirst) return 0;

        var exePath = Environment.ProcessPath;
        if (exePath is not null)
        {
            // Xác định AUMID (để toast hiện) + đăng ký khởi động cùng máy
            ToastSupport.EnsureAppIdShortcut(exePath);
            RegisterRunAtStartup(exePath);
        }

        if (selfTest)
        {
            ToastSupport.Notify(
                "Chuông MN-Qronx đã sẵn sàng",
                "Đây là thử trực tiếp: nhắc nhở đến hạn sẽ báo như vậy, kể cả khi app đóng.");
            BellSound.RingLoop(9);
            return 0;
        }

        RunForever();
        return 0;
    }

    private static void RunForever()
    {
        while (true)
        {
            try
            {
                var interval = TimeSpan.FromSeconds(60);

                if (IsMainWindowOpen()) { Thread.Sleep(interval); continue; }

                ReloadTokens();
                if (_refresh is null) { Thread.Sleep(interval); continue; }

                var due = FetchDueReminders();
                if (due is null || due.Count == 0) { Thread.Sleep(interval); continue; }

                // gần nhất kêu trước
                var reminder = due[0];
                if (LastRing.TryGetValue(reminder.Id, out var last) &&
                    (DateTime.UtcNow - last).TotalMinutes < 5)
                {
                    Thread.Sleep(interval);   // vừa kêu xong, nằm nghỉ 5 phút
                    continue;
                }
                LastRing[reminder.Id] = DateTime.UtcNow;

                ToastSupport.Notify(
                    BuildTitle(reminder),
                    BuildBody(reminder.RemindAt));
                BellSound.RingLoop(120);      // klinewidth 2 phút: có tiếng báo vững, không vặn tai v tiener
            }
            catch (Exception ex)
            {
                LogQuiet(ex);
                Thread.Sleep(TimeSpan.FromSeconds(60));
            }
        }
    }

    private static string BuildTitle(DueReminder r) =>
        r.Task?.CategoryName is { } cat && r.Task?.Title is { } title
            ? $"{title} • {cat}"
            : r.Task?.Title ?? "Việc đến hạn";

    private static string BuildBody(string? remindAt) =>
        DateTime.TryParse(remindAt, out var at)
            ? $"Đến hạn lúc {at:HH:mm} — bấm vào để xử lý"
            : "Bấm vào app để xử lý";

    private static bool IsMainWindowOpen()
    {
        if (Mutex.TryOpenExisting("MNQronx.Window.SingleInstance", out var mutex))
        {
            mutex.Dispose();
            return true;
        }
        return false;
    }

    // ── Token & HTTP ────────────────────────────────────────────────
    private static void ReloadTokens()
    {
        var tokens = TokenStore.Load();
        if (tokens is null)
        {
            // File token biến mất (khách đăng xuất trong app) → daemon
            // buông phiên luôn, không tiếp tục gõ server bằng token cũ
            // trong RAM. Khách đăng nhập lại sau thì chuông tự sống.
            _access = null;
            _refresh = null;
            return;
        }
        if (!string.IsNullOrEmpty(tokens.AccessToken)) _access = tokens.AccessToken;
        if (!string.IsNullOrEmpty(tokens.RefreshToken)) _refresh = tokens.RefreshToken;
    }

    private sealed class DueReminder
    {
        public string Id { get; set; } = "";
        public string? RemindAt { get; set; }
        public TaskInfo? Task { get; set; }
    }

    private sealed class TaskInfo
    {
        public string Title { get; set; } = "";
        public string? CategoryName { get; set; }
        public string? DueAt { get; set; }
    }

    private static List<DueReminder>? FetchDueReminders()
    {
        if (_access is null) _access = RefreshAccessToken();
        if (_access is null) return null;

        var response = SendDueRequest();
        if (response is null) return null;

        if ((int)response.StatusCode == 401)
        {
            _access = RefreshAccessToken();
            if (_access is null) return null;
            response = SendDueRequest();
            if (response is null) return null;
        }

        using var stream = response.Content.ReadAsStream();
        using var doc = JsonDocument.Parse(stream);
        if (!doc.RootElement.TryGetProperty("data", out var items)) return null;

        var nowUtc = DateTime.UtcNow;
        var list = new List<DueReminder>();
        foreach (var item in items.EnumerateArray())
        {
            var status = item.TryGetProperty("status", out var st) ? st.GetString() : null;
            if (status != "SCHEDULED") continue;

            var remindAt = item.TryGetProperty("remindAt", out var ra) ? ra.GetString() : null;
            if (string.IsNullOrEmpty(remindAt)) continue;

            var id = item.TryGetProperty("id", out var idEl)
                ? (idEl.ValueKind == JsonValueKind.String ? idEl.GetString() ?? "" : idEl.GetRawText())
                : "";
            if (id.Length == 0) continue;

            // giống web: việc quá hạn quá 1 ngày không chuông nữa
            var taskDue = item.TryGetProperty("task", out var taskEl) &&
                          taskEl.ValueKind == JsonValueKind.Object &&
                          taskEl.TryGetProperty("dueAt", out var dueEl)
                ? dueEl.GetString() : null;

            // giống web (MAX_OVERDUE_DAYS = 1): quá hạn hơn 1 ngày thì
            // im — cả lọc theo remindAt lẫn dueAt, không sót kiểu nào
            if (DateTime.TryParse(remindAt, out var remindAtTime) &&
                remindAtTime < nowUtc - TimeSpan.FromDays(1))
                continue;

            var r = new DueReminder
            {
                Id = id,
                RemindAt = remindAt,
                Task = item.TryGetProperty("task", out var tk) && tk.ValueKind == JsonValueKind.Object
                    ? new TaskInfo
                    {
                        Title = tk.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "",
                        CategoryName = tk.TryGetProperty("category", out var c) &&
                                       c.ValueKind == JsonValueKind.Object &&
                                       c.TryGetProperty("name", out var cn) ? cn.GetString() : null,
                        DueAt = taskDue,
                    }
                    : null,
            };

            if (DateTime.TryParse(taskDue, out var due)) 
            {
                if (due < nowUtc - TimeSpan.FromDays(1)) continue;
            }

            list.Add(r);
        }

        return list
            .OrderBy(r => DateTime.TryParse(r.RemindAt, out var x) ? x : DateTime.MaxValue)
            .ToList();
    }

    private static HttpResponseMessage? SendDueRequest()
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"{ApiBase}/reminders/due");
            request.Headers.Authorization = new("Bearer", _access);
            return Http.SendAsync(request).Result;
        }
        catch
        {
            return null;
        }
    }

    private static string? RefreshAccessToken()
    {
        try
        {
            if (_refresh is null) return null;
            var content = new StringContent(
                JsonSerializer.Serialize(new { refreshToken = _refresh }),
                System.Text.Encoding.UTF8, "application/json");
            var res = Http.PostAsync($"{ApiBase}/auth/refresh-token", content).Result;
            if (!res.IsSuccessStatusCode) return null;

            using var stream = res.Content.ReadAsStream();
            using var doc = JsonDocument.Parse(stream);
            var data = doc.RootElement.GetProperty("data");
            return data.TryGetProperty("accessToken", out var a) ? a.GetString()
                 : data.TryGetProperty("token", out var t) ? t.GetString()
                 : null;
        }
        catch
        {
            return null; // mạng rớt / hết phiên → vòng sau thử lại
        }
    }

    // ── hỗ trợ: đăng ký khởi động cùng Windows ─────────────────────
    private static void RegisterRunAtStartup(string exePath)
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(
                @"Software\Microsoft\Windows\CurrentVersion\Run");
            key.SetValue("MNQronxBell", $"\"{exePath}\" --bell");
        }
        catch
        {
            /* không đăng ký được thì chuông chỉ sống khi app mở trước đó */
        }
    }

    private static void LogQuiet(Exception ex)
    {
        try
        {
            var dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "MNQronx", "Bell");
            Directory.CreateDirectory(dir);
            File.AppendAllText(
                Path.Combine(dir, "daemon.log"),
                $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {ex.Message}\n");
        }
        catch
        {
            /* nhỏ xíu thôi */
        }
    }
}
