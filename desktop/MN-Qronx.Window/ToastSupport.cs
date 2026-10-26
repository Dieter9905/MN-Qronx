// ─── MN-Qronx – Toast Windows cho app ngoài Store + đăng ký AUMID ────
// Windows chỉ hiện toast của app khi nó có nhận diện AppUserModelID vững:
// với app ngoài Store, đủ điều kiện bằng một shortcut trong Start Menu
// mang property AppUserModel_ID. Daemon tự tạo/cập nhật shortcut ấy mỗi
// lần chạy, rồi gửi toast bằng cùng AUMID.

using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace MNQronx.Window;

internal static class ToastSupport
{
    public const string AppUserModelId = "MT.mnqronx.Window";

    private static string StartMenuPrograms =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Microsoft", "Windows", "Start Menu", "Programs");

    private static string ShortcutPath => Path.Combine(StartMenuPrograms, "MN-Qronx.lnk");

    // ── Đăng ký AUMID ───────────────────────────────────────────────
    public static void EnsureAppIdShortcut(string exePath)
    {
        try
        {
            Directory.CreateDirectory(StartMenuPrograms);
            CreateShortcutWithAppId(exePath, ShortcutPath, AppUserModelId);
        }
        catch
        {
            // Thiếu shortcut chỉ làm toast không hiện — không làm hỏng chuông
        }
    }

    private static void CreateShortcutWithAppId(string exePath, string lnkPath, string appId)
    {
        // Qua CLSID + Activator (runtime QueryInterface), tránh ép kiểu COM
        // tĩnh mà trình biên dịch nhắm từ chối.
        var clsid = Type.GetTypeFromCLSID(new Guid("00021401-0000-0000-C000-000000000046"));
        var instance = Activator.CreateInstance(clsid!)!;
        var shellLink = (IShellLinkW)instance;
        shellLink.SetPath(exePath);
        shellLink.SetWorkingDirectory(Path.GetDirectoryName(exePath) ?? exePath);
        shellLink.SetIconLocation(exePath, 0);

        // Ghi property AppUserModel_ID vào shortcut
        var store = (IPropertyStore)shellLink;
        var key = new PropertyKey(
            new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DECE608"), 5); // PKEY_AppUserModel_ID
        var value = new PropVariant(appId);
        store.SetValue(ref key, ref value);
        store.Commit();

        var persistFile = (IPersistFile)shellLink;
        persistFile.Save(lnkPath, true);
        Marshal.ReleaseComObject(instance);
    }

    // ── Gửi toast ──────────────────────────────────────────────────
    public static void Notify(string title, string body)
    {
        try
        {
            var xml = $"""
                <toast launch="open-app">
                  <visual><binding template="ToastGeneric">
                    <text>{Escape(title)}</text><text>{Escape(body)}</text>
                  </binding></visual>
                  <audio silent="true"/>
                </toast>
                """;
            var doc = new Windows.Data.Xml.Dom.XmlDocument();
            doc.LoadXml(xml);
            var toast = new Windows.UI.Notifications.ToastNotification(doc);
            Windows.UI.Notifications.ToastNotificationManager
                .CreateToastNotifier(AppUserModelId)
                .Show(toast);
        }
        catch
        {
            // Windows không hiện toast (thiếu AUMID/quyền) — âm thanh vẫn báo
        }
    }

    private static string Escape(string s) => s is null ? "" : s
        .Replace("&", "&amp;").Replace("<", "&lt;")
        .Replace(">", "&gt;").Replace("\"", "&quot;");
}

// ─── COM interop tối thiểu để ghi AUMID vào .lnk ─────────────────────
[ComImport, Guid("00021401-0000-0000-C000-000000000046")]
internal sealed class CShellLink { }

[ComImport, Guid("000214F9-0000-0000-C000-000000000046"),
 InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IShellLinkW
{
    void GetPath([Out] char[] pszFile, int cch, IntPtr pfd, uint fFlags);
    void GetIDList(out IntPtr ppidl);
    void SetIDList(IntPtr pidl);
    void GetDescription([Out] char[] pszName, int cch);
    void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
    void GetWorkingDirectory([Out] char[] pszDir, int cch);
    void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
    void GetArguments([Out] char[] pszArgs, int cch);
    void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
    void GetHotkey(out short pkHotkey);
    void SetHotkey(short wHotkey);
    void GetShowCmd(out int piShowCmd);
    void SetShowCmd(int iShowCmd);
    void GetIconLocation([Out] char[] pszIconPath, int cch, out int piIcon);
    int SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
    void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, uint dwReserved);
    void Resolve(IntPtr hwnd, uint fFlags);
    void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
}

[ComImport, Guid("0000010b-0000-0000-C000-000000000046"),
 InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IPersistFile
{
    void GetClassID(out Guid pClassID);
    void IsDirty();
    void Load([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, uint dwMode);
    void Save([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, [MarshalAs(UnmanagedType.Bool)] bool fRemember);
    void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string pszFileName);
    void GetCurFile([Out] [MarshalAs(UnmanagedType.LPWStr)] out string ppszFileName);
}

[ComImport, Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"),
 InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IPropertyStore
{
    void GetCount(out uint cProps);
    void GetAt(uint iProp, out PropertyKey pkey);
    void GetValue(ref PropertyKey key, out PropVariant pv);
    void SetValue(ref PropertyKey key, ref PropVariant pv);
    void Commit();
}

[StructLayout(LayoutKind.Sequential)]
internal struct PropertyKey
{
    public Guid FormatId;
    public int Pid;
    public PropertyKey(Guid formatId, int pid) { FormatId = formatId; Pid = pid; }
}

[StructLayout(LayoutKind.Explicit)]
internal struct PropVariant
{
    [FieldOffset(0)] public short VariantType;      // VT_LPWSTR = 31
    [FieldOffset(8)] public IntPtr PointerValue;

    public PropVariant(string value) : this()
    {
        VariantType = 31; // VT_LPWSTR
        PointerValue = Marshal.StringToCoTaskMemUni(value);
    }
}
