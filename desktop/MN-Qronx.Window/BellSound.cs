// ─── MN-Qronx – Chuôngよう của daemon: đúng melody web, autoplay thoải mái ──
// Web dùng Web Audio API (6 nốt: ring-ring-…); daemon tự sinh PCM đúng
// chuỗi nốt đó thành WAV, phát tần 22050 Hz mono 16-bit qua SoundPlayer —
// không cần file asset, không phụ thuộc máy khách.

using System.Media;

namespace MNQronx.Window;

internal static class BellSound
{
    private const int SampleRate = 22050;
    private static MemoryStream? _wav;

    // đúng nhịp web (AlarmContext.playBeeps): [tần số, bắt đầu(s), dài (s)]
    private static readonly (double Freq, double Start, double Len)[] Notes =
    {
        (880, 0.00, 0.45), (880, 0.55, 0.45),
        (1046, 1.25, 0.45), (1046, 1.80, 0.45),
        (1318, 2.60, 0.60), (1046, 3.50, 0.90),
    };

    private static MemoryStream BuildWav()
    {
        const double seconds = 4.5; // dài khối chuông
        var samples = (int)(seconds * SampleRate);
        var pcm = new short[samples];

        foreach (var (freq, start, len) in Notes)
        {
            var from = (int)(start * SampleRate);
            var noteSamples = (int)(len * SampleRate);
            for (var i = 0; i < noteSamples && from + i < samples; i++)
            {
                var t = (double)i / SampleRate;
                // nền sine như web: 0.0001 → bật 0.22 → lập lại đuôi nốt
                var envelope = Envelope(t, len);
                var value = Math.Sin(2 * Math.PI * freq * t) * 0.22 * envelope;
                pcm[from + i] = (short)Math.Clamp(
                    pcm[from + i] + value * short.MaxValue, short.MinValue, short.MaxValue);
            }
        }

        // Kết cấu WAV: RIFF/PCM 22050 mono 16-bit
        var stream = new MemoryStream();
        using var writer = new BinaryWriter(stream, System.Text.Encoding.UTF8, leaveOpen: true);
        var dataBytes = pcm.Length * 2;
        writer.Write("RIFF"u8);
        writer.Write(36 + dataBytes);
        writer.Write("WAVE"u8);
        writer.Write("fmt "u8);
        writer.Write(16);              // chunk fmt size
        writer.Write((short)1);        // PCM
        writer.Write((short)1);        // mono
        writer.Write(SampleRate);
        writer.Write(SampleRate * 2);  // byte rate
        writer.Write((short)2);        // block align
        writer.Write((short)16);       // bits/sample
        writer.Write("data"u8);
        writer.Write(dataBytes);
        foreach (var s in pcm) writer.Write(s);
        stream.Position = 0;
        return stream;
    }

    private static double Envelope(double t, double noteLen)
    {
        // mượt lên nhanh trong 20 ms, suy m’ào lũy tiến ở cuối nốt
        const double attack = 0.02;
        var progress = t / noteLen;
        var fade = progress > 0.75 ? Math.Max(0.05, 1 - (progress - 0.75) / 0.25) : 1.0;
        var on = Math.Min(1.0, t / attack);
        return on * fade;
    }

    /// Phát lặp chuỗi nốt cho đến khi tổngSeconds trôi qua (daemon sẽ dùng)
    public static void RingLoop(double totalSeconds)
    {
        try
        {
            _wav ??= BuildWav();
            var player = new SoundPlayer();
            using var source = new MemoryStream(_wav.ToArray());
            player.Stream = source;
            var started = DateTime.UtcNow;
            while ((DateTime.UtcNow - started).TotalSeconds < totalSeconds)
            {
                var remain = totalSeconds - (DateTime.UtcNow - started).TotalSeconds;
                // phát full 4.5 giây nếu còn đủ, không phát lan dung lượng dư
                if (remain >= 4.4) player.PlaySync();
                else break;
            }
        }
        catch
        {
            /* có thể máy không có loa — im lặng chứ không chết process */
        }
    }
}
