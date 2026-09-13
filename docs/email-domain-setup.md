# Xác thực tên miền gửi email (Mailjet) — dùng `no-reply@mn-qronx.id.vn`

Mailjet từ chối duyệt tài khoản vì app đang gửi thư bằng **địa chỉ Gmail miễn phí**
(`EMAIL_FROM=MN-Qronx <minhnhat13246@gmail.com>`). Bạn không sở hữu `gmail.com`
nên không thể gắn bản ghi SPF/DKIM → thư dễ vào spam hoặc bị chặn.

Bạn **đã sở hữu `mn-qronx.id.vn`** → chỉ cần xác thực tên miền này với Mailjet là xong.

| | |
|---|---|
| Tên miền gửi | `mn-qronx.id.vn` |
| DNS đang quản lý tại | **PA Vietnam** (`ns1.pavietnam.vn`) |
| Địa chỉ gửi sẽ dùng | `no-reply@mn-qronx.id.vn` |

---

## Bước 1 — Thêm tên miền vào Mailjet

1. Đăng nhập [app.mailjet.com](https://app.mailjet.com)
2. Menu trái → **Account settings** (bánh răng) → **Sender domains & addresses**
3. Bấm **Add a domain** → nhập `mn-qronx.id.vn`
4. Mailjet hiện **bảng bản ghi DNS cần thêm** — để tab này mở, sang bước 2

> Mailjet sẽ cấp các bản ghi dạng:
> - `TXT` trên `@` → `v=spf1 include:spf.mailjet.com ?all`
> - `TXT` trên `mailjet._domainkey` → `k=rsa; p=MIGfMA0GCS…` (khoá riêng của tài khoản bạn)
> - (tuỳ chọn) `TXT` trên `_dmarc` → `v=DMARC1; p=none;`
>
> ⚠️ Giá trị DKIM **chỉ có trong Mailjet**, đừng chép ở tài liệu khác.

---

## Bước 2 — Xác nhận quyền sở hữu tên miền

Ngay sau khi thêm tên miền, Mailjet mở trang **Validate your domain** với 2 lựa chọn.
**Chọn Option 2 — Create a DNS record** (không cần upload file lên hosting):

| Loại | Host / Tên | Giá trị |
|---|---|---|
| TXT | `mailjet_93f3b17d` | `93f3b17d242007cf108f86340854ad1` |

> ⚠️ Giá trị này **riêng cho tài khoản bạn** — luôn copy đúng từ trang Mailjet
> (Option 2). Nếu Mailjet hiện số khác thì dùng số của Mailjet, không dùng số trong tài liệu này.
>
> Bản ghi này được thêm tại **cùng chỗ với bước 3** (PA Vietnam → access.pavietnam.vn),
> xem chi tiết đường đi bên dưới.

Chờ 5–30 phút cho DNS lan truyền rồi quay lại bấm **Validate my domain**.
Chỉ sau khi xác thực xong Mailjet mới cho bạn sang bước thêm SPF/DKIM.

*(Nếu host yêu cầu nhập tên đầy đủ, dùng `mailjet_93f3b17d.mn-qronx.id.vn`.)*

---

## Bước 3 — Thêm bản ghi DNS tại PA Vietnam

### 3a. Đường đi chính xác trong trang quản trị PA Vietnam

1. Đăng nhập <https://support.pavietnam.vn> (mã khách hàng `PA-905971`)
2. Menu trái → **Quản lý dịch vụ** (bấm để mở dropdown) → **Danh sách dịch vụ**
3. Lọc/chọn tên miền **`mn-qronx.id.vn`** trong danh sách
4. Ở trang tổng quan tên miền → bấm icon **Bảng điều khiển**
   → hệ thống chuyển sang <https://access.pavietnam.vn> (bảng quản trị DNS thật)
5. Tại đó: **Tổng quan → DNS → Cấu hình bản ghi tên miền → Thêm bản ghi**
6. Nhập bản ghi → bấm **Lưu cấu hình** (nhớ bấm lưu, nếu không sẽ mất)

> 💡 Nếu bước 4 yêu cầu đăng nhập lại (không auto-login), tài khoản cần **bật 2FA**
> trên support.pavietnam.vn. Không bật thì hệ thống sẽ hỏi thông tin quản trị —
> hoặc vào thẳng <https://access.pavietnam.vn/login.php> bằng thông tin domain.

### 3b. Thêm các bản ghi

Thêm **từng bản ghi** đúng như Mailjet hiển thị:

| Loại | Host / Tên | Giá trị | TTL |
|---|---|---|---|
| TXT | `mailjet_93f3b17d` | `93f3b17d242007cf108f86340854ad1` *(Bước 2 — xác nhận sở hữu)* | 3600 |
| TXT | `@` (hoặc để trống) | `v=spf1 include:spf.mailjet.com ?all` | 3600 |
| TXT | `mailjet._domainkey` | `k=rsa; p=…` (dán từ Mailjet) | 3600 |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | 3600 |

**Lưu ý quan trọng:**
- Mỗi tên miền **chỉ được có 1 bản ghi SPF**. Hiện tại domain chưa có SPF nào nên thêm mới là an toàn.
- Nếu sau này bạn **cũng gửi thư bằng hộp thư `maychuemail.net`** (MX hiện tại), gộp chung vào 1 dòng:
  `v=spf1 include:spf.mailjet.com include:maychuemail.net ~all`
- DKIM `mailjet._domainkey` là **subdomain**, không phải bản ghi trên `@`.
- Không đụng vào bản ghi **MX** đang nhận thư.

---

## Bước 4 — Kiểm tra DNS đã đúng chưa

Trong thư mục `backend`:

```bash
cd backend
node scripts/check-mail-dns.mjs
```

Kết quả mong đợi:

```
✅ Xác nhận sở hữu (mailjet_93f3b17d): 93f3b17d242007cf108f86340854ad1
✅ SPF: v=spf1 include:spf.mailjet.com ?all
✅ DKIM (mailjet._domainkey): k=rsa; p=MIGfMA0GCS…
✅ DMARC (_dmarc): v=DMARC1; p=none;
Kết quả: DNS ĐÃ ĐỦ để Mailjet xác thực domain ✅
```

DNS có thể mất **5 phút – vài giờ** để lan truyền. Chưa thấy thì chờ rồi chạy lại.

---

## Bước 5 — Xác thực SPF/DKIM trong Mailjet

Sau khi đã xác nhận sở hữu, Mailjet hiện bảng bản ghi **SPF + DKIM** cho domain
`mn-qronx.id.vn` → thêm vào DNS như Bước 3, chờ lan truyền rồi bấm **Check / Validate**.
Khi cả SPF và DKIM hiện ✅ là xong.

Sau đó bấm **Add a sender address** → thêm `no-reply@mn-qronx.id.vn`.

---

## Bước 6 — Đổi địa chỉ gửi sang tên miền riêng

### 6a. Máy local — `backend/.env`

```env
EMAIL_FROM=MN-Qronx <no-reply@mn-qronx.id.vn>
```

Giữ nguyên `SMTP_HOST=in-v3.mailjet.com`, `SMTP_USER` (API key), `SMTP_PASS` (secret key).

### 6b. Production — Render → **taskalarm-api** → Environment

Thêm/sửa:

```
EMAIL_FROM = MN-Qronx <no-reply@mn-qronx.id.vn>
```

Render tự redeploy (~2 phút).

---

## Bước 7 — Gửi thử

```bash
cd backend
node scripts/send-test-email.mjs minhnhat13246@gmail.com
```

Kết quả mong đợi: `✅ Đã gửi qua api — messageId: …`

Kiểm tra cả **hộp thư đến và Spam**. Nếu vào Spam, thêm bản ghi DMARC (đã có ở Bước 2) rồi chờ.

---

## Bước 8 — Trả lời Mailjet

Mailjet đã hỏi: *"Could you tell us if you have a custom domain…?"* — trả lời vào ticket
[#4264560](https://app.mailjet.com/support/ticket/4264560) bằng đoạn sau:

```
Hello Sunidhi,

Thank you for your reply. We do have a custom domain: mn-qronx.id.vn

We have completed the domain validation and added the required SPF and DKIM
records for this domain in our account. All transactional emails (signup
verification codes, password resets) are sent from no-reply@mn-qronx.id.vn.

Our website is live at https://mn-qronx.id.vn — please let us know if any
further changes are required to lift the sending restriction.

Best regards,
MN-Qronx Team
```

---

## Nếu không sửa được DNS tại PA Vietnam

Bạn có thể chuyển quản lý DNS sang **Cloudflare** (miễn phí, giao diện dễ hơn):
1. Tạo tài khoản Cloudflare → **Add site** → `mn-qronx.id.vn`
2. Cloudflare cấp 2 nameserver mới → vào PA Vietnam đổi nameserver sang Cloudflare
3. Thêm lại các bản ghi tại Cloudflare: A `@` → Vercel, CNAME `www` → `d67508365e943361.vercel-dns-017.com`
   (nhớ bật "DNS only" cho các bản ghi mail), MX hiện tại, rồi thêm SPF/DKIM của Mailjet.

> ⚠️ Đổi nameserver ảnh hưởng toàn bộ email đang nhận qua MX `maychuemail.net` — nếu không chắc thì giữ DNS ở PA Vietnam và làm Bước 2.
