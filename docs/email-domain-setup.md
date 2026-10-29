# Gửi email của MN-Qronx (SMTP / Resend)

Tài liệu này thay cho bản hướng dẫn Mailjet cũ. **Mailjet đã bị gỡ hoàn toàn khỏi dự
án** (tài khoản bị khoá gửi, API key hết hiệu lực, mọi mã `mailQuota`/`mail:status`
đã xoá). Hiện chỉ còn hai đường gửi:

| Đường gửi | Khi nào dùng | Ưu / nhược |
|---|---|---|
| **Resend** (`RESEND_API_KEY`) | Khuyến nghị cho production dài hạn | Gửi qua HTTPS, trả mã lỗi thật, log thấy trên dashboard Resend. Gói miễn phí 100 thư/ngày · 3.000/tháng; cần xác thực tên miền bằng DNS |
| **SMTP** (`SMTP_HOST` / `SMTP_USER` / `SMTP_PASS`) | Hiện production đang dùng (hộp thư Gmail, `smtp.gmail.com:465`) | Không cần tên miền riêng, chạy ngay. Nhưng SMTP có thể nhận lệnh rồi bỏ thư, và gửi từ địa chỉ `@gmail.com` thì không gắn được SPF/DKIM nên dễ vào Spam |

## 1. Chọn đường gửi

`MAIL_TRANSPORT` trong `backend/.env`:

- `auto` (mặc định): có `RESEND_API_KEY` → đi Resend; không có → đi SMTP.
- `resend` / `smtp`: ép đi đúng một đường. Ép mà thiếu cấu hình thì kết quả là `none`
  (mã xác nhận hiện thẳng ra màn hình thay vì gửi thư — chỉ chấp nhận được khi dev).

Kiểm tra nhanh:

```bash
cd backend
node scripts/send-test-email.mjs ban@example.com   # hoặc: npm run mail:test -- ban@example.com
```

Script in ra đường gửi đang dùng, địa chỉ `From`, rồi gửi thật. Nếu chưa cấu hình gì
nó báo `KHÔNG gửi thật được` và chỉ ra biến còn thiếu.

## 2. Cấu hình SMTP

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=<hộp thư gửi>
SMTP_PASS=<mật khẩu ứng dụng, không phải mật khẩu đăng nhập>
EMAIL_FROM=MN-Qronx <no-reply@mn-qronx.id.vn>
```

- Gmail bắt buộc **mật khẩu ứng dụng** (Google Account → Security → 2-Step
  Verification → App passwords); mật khẩu thường sẽ bị từ chối `535`.
- Với Gmail, `SMTP_USER` chính là địa chỉ gửi thật. Đặt `EMAIL_FROM` khác hộp thư đó
  sẽ bị Gmail ghi đè hoặc chặn.
- Nhà cung cấp khác (Zoho, Mailgun SMTP, Brevo…) dùng đúng host/port họ cấp; port 587
  thì `SMTP_SECURE=false`, port 465 thì `SMTP_SECURE=true`.
- Nên đặt `Reply-To` là hộp thư thật — code đã tự làm: khi không truyền `replyTo`,
  thư dùng `SMTP_USER`, nhờ vậy thư hệ thống không bị coi là bulk.

## 3. Cấu hình Resend (nên làm trước khi có đông khách)

1. Tạo tài khoản <https://resend.com> → **API Keys** → *Create API Key* (bắt đầu bằng
   `re_`), quyền *Sending access*.
2. **Domains** → *Add Domain* → nhập tên miền gửi (ví dụ `mn-qronx.id.vn`).
3. Resend hiện đúng các bản ghi DNS cần thêm (SPF `TXT`, `DKIM` `TXT`, `MX` cho
   subdomain, `DMARC`). Thêm tại nhà quản trị DNS của tên miền.
4. Kiểm tra bằng script của dự án — nó đối chiếu DNS thật với yêu cầu của Resend và
   chỉ ra bản ghi nào sai/thiếu:

```bash
cd backend && npm run mail:resend            # xem trạng thái
cd backend && npm run mail:resend -- --verify  # bắt Resend kiểm tra lại ngay
```

5. Khi domain `Verified`, điền:

```env
RESEND_API_KEY=re_...
RESEND_FROM=MN-Qronx <no-reply@mn-qronx.id.vn>
```

Trước khi domain được xác thực, Resend chỉ cho gửi từ `onboarding@resend.dev` tới chính
email chủ tài khoản — đủ để thử luồng đăng ký/quên mật khẩu.

## 4. DNS cho tên miền riêng (khi không dùng Resend tự động)

- **SPF** — một bản ghi `TXT` duy nhất ở gốc tên miền:
  `v=spf1 include:<nhà cung cấp> -all`. Mỗi tên miền chỉ được **một** SPF; nhiều hơn
  là hỏng cả hai.
- **DKIM** — `TXT` tại host do nhà cung cấp cấp (Resend tự sinh). Sai một ký tự là
  không xác thực được; gặp lỗi này thì **xoá hẳn** bản ghi cũ rồi thêm lại.
- **DMARC** — `TXT` tại `_dmarc.<domain>`:
  `v=DMARC1; p=none; rua=mailto:<hộp thư nhận báo cáo>` để bắt đầu, khi ổn thì nâng
  `p=quarantine`.
- Ghi thêm `MX` nếu muốn nhận thư trả về (bounce) của tên miền.

## 5. Chống thư vào Spam

- Gửi từ **tên miền riêng** đã xác thực SPF + DKIM + DMARC, không gửi từ
  `@gmail.com` (không thể gắn bản ghi cho tên miền của Google).
- Nội dung có cả bản `text` và `html`, tiêu đề rõ ràng, không viết hoa toàn bộ.
- Không gửi trùng liên tiếp: luồng mã xác nhận đã có cooldown 60 giây dùng lại mã cũ.
- Báo cáo tuần chỉ gửi một lô nhỏ mỗi lượt (4 thư) và dừng khi gặp hạn mức — xem
  `backend/src/services/weeklyReportService.js`.

## 6. Khắc phục nhanh

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| `535 Authentication failed` (SMTP) | Dùng mật khẩu đăng nhập thay vì mật khẩu ứng dụng, hoặc hộp thư chưa bật 2FA | Tạo App Password mới, cập nhật `SMTP_PASS`, restart service |
| `ETIMEDOUT` / `ECONNREFUSED` | Sai port/secure hoặc VPS chặn cổng ra 465/587 | Thử 587 + `SMTP_SECURE=false`; kiểm tra firewall của VPS |
| Resend `403 domain is not verified` | SPF/DKIM chưa đúng hoặc chưa bấm Verify | Chạy `npm run mail:resend -- --verify` và sửa đúng bản ghi được in ra |
| Resend `401 API key is invalid` | Key bị thu hồi hoặc dán thiếu | Tạo key mới, cập nhật `RESEND_API_KEY`, restart service |
| Thư gửi được mà khách không thấy | Vào Spam, hoặc tên miền chưa có DMARC | Làm mục 4 và 5; bảo khách đánh dấu "Không phải spam" một lần |
| Mã xác nhận hiện ngay trên form | Chưa cấu hình đường gửi nào (`resolveTransport()` = `none`) | Điền SMTP hoặc `RESEND_API_KEY` |

Sau khi đổi `.env` phải restart tiến trình (production: `systemctl restart mn-qronx`)
vì cấu hình chỉ đọc lúc khởi động.
