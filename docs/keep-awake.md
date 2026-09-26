# Giữ backend luôn thức (Render gói free)

Web service gói free của Render **ngủ sau 15 phút** không có request. Lần truy cập
kế tiếp phải chờ khởi động **30–60 giây** — đây là lý do "mỗi lần vào app load lâu"
dù frontend rất nhẹ (trang tĩnh ~70 ms, bundle ~200 KB nén, API khi ấm ~230 ms).

App đã tự xử lý phần *cảm nhận* (xem `src/lib/useCachedQuery.js`: hiện dữ liệu lưu
sẵn ngay, làm mới ngầm, tự thử lại 2 lần khi gặp 502/503), nhưng muốn không phải
chờ lần nào thì cần một monitor ngoài ping định kỳ.

## Vì sao KHÔNG dùng GitHub Actions cron

`.github/workflows/keep-alive.yml` từng đặt `*/5 * * * *`. Repo này là **private**:

| Mục | Số |
|---|---|
| GitHub Free cho repo private | 2.000 phút Actions/tháng |
| Mỗi lần chạy scheduled bị tính tối thiểu | 1 phút |
| `*/5 * * * *` | 288 lần/ngày ≈ **8.600 phút/tháng** |

⇒ Hết quota sau ~7 ngày, GitHub **tắt toàn bộ Actions** cho tới khi reset chu kỳ ⇒
ping dừng ⇒ máy chủ ngủ lại. Vì vậy workflow đó nay chỉ còn `workflow_dispatch`
(bấm tay khi cần đánh thức ngay), việc định kỳ giao cho monitor ngoài.

Kiểm tra: GitHub → repo → **Actions** (workflow còn chạy không) và **Settings →
Billing → Actions minutes used** (có chạm trần 2.000 không).

## Cách dựng monitor miễn phí (2–3 phút)

URL cần ping (đúng `healthCheckPath` trong `render.yaml`):

```
https://taskalarm-api.onrender.com/api/v1/health
```

Phương án A — cron-job.org:

1. Đăng ký tại https://cron-job.org (miễn phí).
2. **Create cronjob** → Title: `MN-Qronx API`.
3. URL: dán URL trên.
4. Schedule: **Every 5 minutes**.
5. Execution: bật *Save responses in job history* (để xem log), Timeout 60 s.
6. Save. Kiểm tra lại sau 10 phút: cột *Last execution* phải là 200.

Phương án B — UptimeRobot:

1. Đăng ký tại https://uptimerobot.com (miễn phí 50 monitor).
2. **Add New Monitor** → Monitor Type: `HTTP(s)`.
3. Friendly Name: `MN-Qronx API`; URL: dán URL trên.
4. Monitoring Interval: **5 minutes** (mức thấp nhất của gói free).
5. Bật cảnh báo email nếu muốn biết khi API sập.
6. Save.

Cả hai đều ping từ ngoài nên **không tốn phút Actions** nào. Nhịp 5 phút < 15 phút
nên máy chủ không bao giờ ngủ.

## Phương án khác

- **Cloudflare Worker + Cron Trigger** (miễn phí, 100.000 request/ngày): phù hợp vì
  tên miền đã dùng Cloudflare; cần `wrangler deploy` một worker nhỏ gọi `fetch`.
- **Render Starter ($7/tháng)**: bỏ hẳn cơ chế ngủ, không cần monitor. Khi đó nên
  xoá luôn workflow này.

## Lưu ý về giờ chạy của gói free

Render free cho 750 giờ instance/tháng. Giữ thức 24/7 là ~744 giờ ⇒ vừa đủ cho **một**
web service free. Nếu sau này thêm service free thứ hai (ví dụ AI service) thì phải
tính lại, nếu không một trong hai sẽ bị treo giữa tháng.
