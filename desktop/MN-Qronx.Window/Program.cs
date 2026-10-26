namespace MNQronx.Window;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Contains("--bell-test"))
        {
            // gói chẩn đoán: toast + chuông thử rồi thoát
            return BellDaemon.Run(selfTest: true);
        }
        if (args.Contains("--bell"))
        {
            // chạy nền: chờ nhắc nhở đến hạn và báo dù app đóng
            return BellDaemon.Run(selfTest: false);
        }

        // Mỗi máy chỉ một cửa sổ MN-Qronx
        using var mutex = new Mutex(true, "MNQronx.Window.SingleInstance", out var isFirst);
        if (!isFirst) return 0;

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        Application.Run(new MainWindow());
        GC.KeepAlive(mutex);
        return 0;
    }
}
