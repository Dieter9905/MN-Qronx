// ─── MN-Qronx – Lưu token của daemon (DPAPI, chỉ user này đọc được) ──
// Cửa sổ app đẩy token từ web vào qua WebView2 message → daemon đọc từ
// đây khi mở. Đèn Telegram? Không — yên lặng: file %LOCALAPPDATA%\MNQronx\Bell\tokens.json
// mã hoá bằng DPAPI (CurrentUser), lộ file cũng không đọc được token.

using System.Security.Cryptography;
using System.Text.Json;

namespace MNQronx.Window;

internal sealed record BellTokens(string? AccessToken, string? RefreshToken, string? ApiBase)
{
    public bool HasSession => !string.IsNullOrEmpty(RefreshToken);
}

internal static class TokenStore
{
    private static string Dir =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "MNQronx", "Bell");

    private static string FilePath => Path.Combine(Dir, "tokens.bin");

    public static void Save(BellTokens tokens)
    {
        try
        {
            Directory.CreateDirectory(Dir);
            var json = JsonSerializer.Serialize(tokens);
            var plain = System.Text.Encoding.UTF8.GetBytes(json);
            var protectedBytes = ProtectedData.Protect(
                plain, null, DataProtectionScope.CurrentUser);
            File.WriteAllBytes(FilePath, protectedBytes);
        }
        catch
        {
            /* ghi fail → daemon cứ chạy thiếu token, lần sau nhớ lại */
        }
    }

    public static void Clear()
    {
        try { File.Delete(FilePath); } catch { /* không có thì thôi */ }
    }

    public static BellTokens? Load()
    {
        try
        {
            if (!File.Exists(FilePath)) return null;
            var protectedBytes = File.ReadAllBytes(FilePath);
            var plain = ProtectedData.Unprotect(
                protectedBytes, null, DataProtectionScope.CurrentUser);
            return JsonSerializer.Deserialize<BellTokens>(System.Text.Encoding.UTF8.GetString(plain));
        }
        catch
        {
            return null;
        }
    }
}
