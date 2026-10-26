namespace MNQronx.Window;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        // Mỗi máy chỉ một cửa sổ MN-Qronx
        using var mutex = new Mutex(true, "MNQronx.Window.SingleInstance", out var isFirst);
        if (!isFirst) return;

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        Application.Run(new MainWindow());
        GC.KeepAlive(mutex);
    }
}
