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

## Bước 7 — Gửi thử (qua Mailjet Send API v3.1)

```bash
cd backend
npm run mail:send -- minhnhat13246@gmail.com            # gửi thật
npm run mail:send -- minhnhat13246@gmail.com --sandbox  # chỉ kiểm tra payload
```

Kết quả mong đợi: `✅ Đã gửi qua api — messageId: …`

### Vì sao dùng Send API v3.1 thay SMTP

- API trả về **mã lỗi thật** (`401 mj-0001` khi tài khoản bị khoá, `mj-0002` khi
  sender chưa xác thực), SMTP thì **nhận lệnh rồi bỏ luôn thư** → báo "thành công" giả.
- Đi qua HTTPS 443, không bị chặn cổng như SMTP 587/465 trên một số host (Render).
- Hỗ trợ sẵn `Cc`, `Bcc`, `ReplyTo`, `TemplateID`, `Variables`, `CustomID`, `SandboxMode`
  — xem `buildApiMessage()` trong `backend/src/services/emailService.js`.

### Chọn đường gửi

| `MAIL_TRANSPORT` | Hành vi |
|---|---|
| `auto` (mặc định) | Có API key → dùng **Send API v3.1**; không có → dùng SMTP |
| `api` | Chỉ dùng API (báo lỗi rõ ràng nếu thiếu key) |
| `smtp` | Chỉ dùng SMTP (như trước đây) |

```env
MAIL_TRANSPORT=auto
MAILJET_API_KEY=your-mailjet-api-key        # mặc định lấy SMTP_USER
MAILJET_SECRET_KEY=your-mailjet-secret-key  # mặc định lấy SMTP_PASS
MAILJET_SANDBOX=false
```

Mã lỗi thường gặp (đã dịch sẵn trong `ERROR_HINTS` của `emailService.js`):

| Mã | Nghĩa |
|---|---|
| `mj-0001` | Tài khoản bị Mailjet tạm khoá — phải trả lời ticket (Bước 8) |
| `mj-0002` | Địa chỉ `From` chưa được xác thực trong Mailjet |
| `mj-0004` | Payload không hợp lệ (thiếu From/To/nội dung…) |

> ℹ️ Nếu `npm run mail:send` báo `401 mj-0001`, đó **không phải lỗi code** — tài khoản
> đang bị khoá ở tầng tài khoản. Xem Bước 8.

Kiểm tra cả **hộp thư đến và Spam**. Nếu vào Spam, thêm bản ghi DMARC (đã có ở Bước 2) rồi chờ.

---

## Bước 8 — Trả lời Mailjet (BẮT BUỘC, không bỏ qua)

### Tình trạng tài khoản đã kiểm chứng ngày 13/09/2026

Dù SPF + DKIM đều đã **OK** trong Mailjet và DNS, tài khoản **vẫn đang bị chặn**.
Kiểm tra trực tiếp qua API Mailjet (`POST https://api.mailjet.com/v3.1/send`):

```
HTTP 401  mj-0001
Your account has been temporarily blocked.
Please contact our support team to get assistance.
```

Và các dấu hiệu kèm theo:

| Kiểm tra | Kết quả |
|---|---|
| `GET /v3/REST/sender` — `*@mn-qronx.id.vn` | `Inactive` lúc đầu → **`Active`** sau khi sửa bản ghi TXT sở hữu |
| `GET /v3/REST/message` + `statcounters` (lifetime) | **Count = 0** — chưa từng có thư nào thực sự gửi |
| SMTP `in-v3.mailjet.com:587` | Vẫn nhận lệnh gửi (DATA → 250) nhưng **thư bị bỏ luôn**, không vào thống kê |

➡️ Vì vậy **thêm SPF/DKIM + xác minh tên miền là chưa đủ** — tài khoản vẫn bị Mailjet
khoá ở tầng tài khoản, và **chỉ trả lời ticket mới gỡ được**.
Và chỉ đổi `EMAIL_FROM` sang `no-reply@mn-qronx.id.vn` **sau khi** Mailjet đã gỡ chặn.

### Cách trả lời

Trong email của Mailjet có 3 nút trả lời nhanh ở cuối — bấm **`Yes, I have!`**
(ý nghĩa: *"chúng tôi có tên miền riêng"*).
Sau đó **viết thêm nội dung** vào ticket
[#4264560](https://app.mailjet.com/support/ticket/4264560) bằng đoạn sau:

```
Hello Sunidhi,

Thank you for your reply. Yes, we have a custom domain: mn-qronx.id.vn

We have completed the domain validation for mn-qronx.id.vn and added the
required SPF and DKIM records. In our Mailjet account both SPF and DKIM now
show status OK, and the sender *@mn-qronx.id.vn shows as Active. Our website
is live at https://mn-qronx.id.vn

All transactional emails (signup verification codes, password resets) will be
sent from no-reply@mn-qronx.id.vn.

However, our account still seems to be blocked at account level: both SMTP and
POST https://api.mailjet.com/v3.1/send return
"Your account has been temporarily blocked. Please contact our support team
to get assistance." (StatusCode 401, ErrorCode mj-0001).

Could you please review our account and lift the sending restriction, or let
us know what else is required from our side?

Best regards,
MN-Qronx Team
```

---

## Khắc phục khi Status vẫn là `Pending` — ĐÃ XỬ LÝ XONG 13/09/2026

> ✅ **Kết quả cuối:** sau khi sửa tên host thành `mailjet._93f3b17d`, sender `*@mn-qronx.id.vn`
> chuyển từ `Inactive` → **`Active`** — tên miền đã xác minh. Điều duy nhất còn chặn gửi thư
> là **tài khoản Mailjet bị khoá** (lỗi `mj-0001`), phải trả lời ticket (xem Bước 8).
>
> Hai công cụ dùng trong quá trình này:
> - `npm run mail:check` — đối chiếu DNS với yêu cầu thật của Mailjet API
> - `npm run mail:verify` — gọi API kích hoạt xác minh tên miền, tự thử lại nhiều lần


Trạng thái `Pending` ở mục **Domains** là **xác nhận quyền sở hữu**, khác hoàn toàn với
SPF/DKIM (hai ô đó có thể đã `OK` mà quyền sở hữu vẫn `Pending`).

Ngày 13/09/2026 đã gặp đúng ca này. Nguyên nhân tìm ra bằng cách gọi thẳng API Mailjet
rồi so với DNS — **không phải do cache**, mà do 2 lỗi trong bản ghi TXT:

| | Bản ghi đang có trong DNS | Mailjet yêu cầu (API `GET /v3/REST/dns`) |
|---|---|---|
| Tên host | `mailjet_93f3b17d` ❌ (dùng dấu `_`) | **`mailjet._93f3b17d`** ✅ (có **dấu chấm** rồi mới tới `_`) |
| Giá trị | `93f3b17d242007cf108f86340854ad1` (31 ký tự) ❌ | **`93f3b17d242007cf1081f86340854ad1`** (32 ký tự) ✅ |

Giá trị đúng có thêm **một chữ `1`** (`…2007cf108` **1** `f863…)`. Đây là kiểu lỗi
nhìn ảnh chụp màn hình không thấy được — nên dùng script để so tự động:

```bash
cd backend && npm run mail:check
```

Script sẽ in ra đúng tên host + giá trị cần có, kèm vị trí ký tự khác nhau đầu tiên.

### Cách sửa tại PA Vietnam

1. **Xoá** bản ghi cũ `mailjet_93f3b17d` (thùng rác cuối dòng)
2. **Thêm bản ghi mới** bằng hàng nhập trên cùng: loại **TXT**, host `mailjet._93f3b17d`,
   value `93f3b17d242007cf1081f86340854ad1`, TTL 3600 → bấm lưu
3. Kiểm tra DNS thật (hỏi thẳng máy chủ quản trị, không qua cache):
   ```bash
   nslookup -type=TXT mailjet._93f3b17d.mn-qronx.id.vn ns1.pavietnam.vn
   ```
   Phải trả về đúng chuỗi **32 ký tự**. Nếu vẫn là bản ghi cũ 31 ký tự → chưa lưu được.
4. `npm run mail:check` phải thấy dòng xác nhận sở hữu ✅
5. Kích hoạt xác minh: `npm run mail:verify` (tự thử lại nhiều lần,
   thành công khi sender chuyển sang `Active`)

> ⚠️ **Đúc kết kinh nghiệm 13/09/2026:** sửa giá trị một bản ghi có sẵn ở panel PA Vietnam
> **không có tác dụng** (báo "Lưu thành công" nhưng DNS không đổi — kiểm tra bằng cách hỏi
> thẳng `ns1.pavietnam.vn`). Cách chắc chắn là **xoá rồi thêm lại**. Và tên host phải có
> **dấu chấm**: `mailjet._93f3b17d` — dùng `mailjet_93f3b17d` thì Mailjet báo
> *"no TXT record for that ownership token was found"*.

> ⚠️ Nếu panel PA Vietnam **không cho** host có dấu `_` ở giữa (`mailjet._93f3b17d`),
> dùng **Option 1 — Upload a file** của Mailjet: tạo file `93f3b17d242007cf1081f86340854ad1.txt`
> (nội dung là chính tên file) trong thư mục `public/` của repo frontend rồi push —
> Vercel sẽ phục vụ tại `https://www.mn-qronx.id.vn/93f3b17d242007cf108f86340854ad1.txt`,
> sau đó bấm Validate lại.

---

## Nếu không sửa được DNS tại PA Vietnam

Bạn có thể chuyển quản lý DNS sang **Cloudflare** (miễn phí, giao diện dễ hơn):
1. Tạo tài khoản Cloudflare → **Add site** → `mn-qronx.id.vn`
2. Cloudflare cấp 2 nameserver mới → vào PA Vietnam đổi nameserver sang Cloudflare
3. Thêm lại các bản ghi tại Cloudflare: A `@` → Vercel, CNAME `www` → `d67508365e943361.vercel-dns-017.com`
   (nhớ bật "DNS only" cho các bản ghi mail), MX hiện tại, rồi thêm SPF/DKIM của Mailjet.

> ⚠️ Đổi nameserver ảnh hưởng toàn bộ email đang nhận qua MX `maychuemail.net` — nếu không chắc thì giữ DNS ở PA Vietnam và làm Bước 2.
