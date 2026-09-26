# Thanh toán & quyền lợi theo gói (MN-Qronx)

Tài liệu này mô tả cách app thu tiền, cách cấp gói cho người dùng, và những gì
còn phải làm để bán được gói trong app Android trên Google Play.

## 1. Một nguồn sự thật duy nhất: quyền lợi (entitlement)

- `backend/src/utils/planLimits.js` là nơi duy nhất định nghĩa **giá, giới hạn và
  tính năng** của từng gói (FREE / PLUS / PRO).
- `user.plan` + `user.planExpiresAt` là bản đã "vật chất hoá" để mọi chỗ kiểm tra
  gói cũ vẫn chạy (task, danh mục, việc con, thiết bị, âm thanh, AI…).
- Mỗi lần cấp/gia hạn gói đều ghi thêm một dòng ở bảng `subscriptions` (có
  `provider`, `providerRef`, `expiresAt`, `status`) → tra được lịch sử: gói này do
  chuyển khoản, do admin tặng, do dùng thử hay do đổi điểm.
- Gói quá hạn được hạ tự động: `downgradeExpiredPlans()` chạy trong scheduler và
  mỗi khi người dùng xem thông tin gói.

### Giá và giới hạn (tháng 9/2026)

| Gói | Tháng | Năm | Điểm khác biệt chính |
|---|---|---|---|
| Miễn phí | 0đ | 0đ | 50 việc đang mở, **có công việc lặp lại**, 3 nhắc/việc, 2 thiết bị, AI 5 lần/ngày |
| Plus | 39.000đ | 390.000đ | Không giới hạn việc/danh mục/việc con, 5 thiết bị, AI 50 lần/ngày |
| Pro | 79.000đ | 790.000đ | Không giới hạn AI + đồng bộ Google Calendar + nhắc qua Zalo + báo cáo và xuất dữ liệu + âm thanh riêng |

Trả theo năm = 10 tháng (tặng 2 tháng). Giá nằm trong `PLANS[...].priceMonthly` /
`priceYearly`, mã sản phẩm cho Play ở `PRODUCT_IDS` — **Play Console phải tạo sản
phẩm trùng đúng mã và đúng giá này**.

## 2. Bán trên web: chuyển khoản VietQR

> **Quyết định (26/09/2026): chỉ dùng chuyển khoản VietQR trên web, KHÔNG dùng cổng thẻ.**
> Lý do đã tra: Stripe không hỗ trợ doanh nghiệp đăng ký tại Việt Nam; các Merchant of
> Record (Lemon Squeezy có hỗ trợ người bán Việt Nam, Paddle…) tính khoảng
> **5% + 0,50 USD/giao dịch** và trừ tiền bằng USD; cổng nội địa có thu định kỳ
> (PayOS Auto Debit, VNPay định kỳ, OnePay) thì phải ký hợp đồng và được duyệt
> token hoá thẻ. Đổi lại, chuyển khoản **không tự gia hạn được** — nên khi cần tăng
> tỉ lệ gia hạn thì làm phần nhắc trước khi hết hạn (xem mục 3) chứ không đổi cổng.
>
> Trong app Android, gói trả phí bắt buộc dùng Google Play Billing (mục 6) — Play
> Billing tự nó đã là "nhập thẻ, tự trừ từng tháng".

Luồng hiện có:

1. Người dùng bấm mua gói → `POST /api/v1/billing/orders`
   → sinh **mã đơn** dạng `MNQ` + 8 ký tự (bảng ký tự bỏ 0/O/1/I cho dễ đọc),
   lưu đơn `PENDING` (mặc định hết hạn sau 48 giờ).
2. Giao diện hiện **mã VietQR** + số tài khoản + **nội dung chuyển khoản chính là
   mã đơn**, kèm nút copy. Trang tự hỏi lại trạng thái đơn mỗi 5 giây.
3. Tiền vào tài khoản → gói **tự kích hoạt**, không ai phải bấm gì:
   - **Hệ thống tự kéo bằng API (mục 2b):** gọi API ngân hàng theo chu kỳ để đọc giao dịch.
     Đây là đường không phụ thuộc webhook, xem “Đọc giao dịch bằng API ngân hàng” bên dưới.
   - **Webhook đẩy về:** SePay/Casso gọi `POST /api/v1/billing/webhook/bank`.
     Hệ thống dò mã đơn trong nội dung, kiểm tra số tiền, rồi kích hoạt gói. Giao dịch
     **tiền ra** (`transferType = "out"` hoặc số tiền âm) bị bỏ qua, không bao giờ
     kích hoạt gói dù nội dung có ghi mã đơn.
   - **Dự phòng:** admin vào `/admin/orders`, thấy đơn "Chờ thanh toán", bấm
     **Xác nhận** (điền mã giao dịch ngân hàng nếu muốn) là gói được kích hoạt. Đây chỉ
     là lưới an toàn cho ca hy hữu (khách chuyển thiếu, ghi sai nội dung), **không phải
     bước bắt buộc** trong luồng thường ngày.
4. `POST /billing/orders/:code/confirm` và webhook đều **idempotent**: bấm hai lần
   hay webhook gửi lại cũng chỉ kích hoạt một lần (mỗi giao dịch được ghi vào
   `billing_events` với `external_id` duy nhất).

Quy tắc cộng dồn: đang còn hạn trả phí mà mua thêm thì kỳ mới **cộng tiếp từ ngày
hết hạn hiện tại** — người dùng không mất những ngày đã trả tiền.

### Làm sao để QR hiện tên "MN-Qronx"?

**Tên người nhận khi khách quét mã là tên pháp lý đã đăng ký của tài khoản nhận
 tiền — không đặt tuỳ ý được.** Từ **1/4/2026**, Thông tư 30/2025/NHNN yêu cầu tên
 tài khoản thanh toán phải trùng thông tin căn cước, và các ngân hàng đã **đóng cửa
 tính năng biệt danh (nickname/iNick)** (VPBank dừng iNick từ 1/4). Tham số
 `ACCOUNT_NAME` của ảnh VietQR theo tài liệu vietqr.io chỉ *"hiển thị lên file ảnh"*
 và **không nằm trong tiêu chuẩn mã**, nên app ngân hàng của người trả tiền vẫn hiển
 thị tên thật trong dữ liệu ngân hàng.

Vì vậy:

1. **Tài khoản nhận tiền phải mang tên thương hiệu bạn muốn hiển thị.** Nếu tài khoản
   đã đăng ký là tài khoản doanh nghiệp mang tên công ty (vd `CONG TY MN QRONX`) thì
   khách đã thấy đúng tên đó. Việc cần làm chỉ là điền `BANK_ACCOUNT_NAME` **y hệt**
   chuỗi ngân hàng đang hiển thị (không dấu, viết hoa) — nếu điền khác, ảnh QR và app
   ngân hàng sẽ lệch nhau, khách dễ bị cảnh báo "tên người nhận không khớp".
2. **Tài khoản cá nhân** thì khách sẽ thấy tên cá nhân của bạn, không thể đổi thành
   MN-Qronx. Muốn có tên thương hiệu thì mở **tài khoản thanh toán doanh nghiệp/hộ
   kinh doanh** mang đúng tên đó (cũng tiện cho sổ sách, hoá đơn).
3. **Muốn thương hiệu hiện ở tầng merchant (và có QR động + API đối soát):** đăng ký
   **VietQR Pay / QR đa năng của NAPAS** qua ngân hàng hoặc qua trung gian
   (Casso/payOS/SePay). Điều kiện: ĐKKD hoặc hộ kinh doanh, mã số thuế, KYC và hợp
   đồng với đơn vị cung cấp. Khi đó tên merchant là tên doanh nghiệp đã đăng ký, và
   webhook của họ cắm thẳng vào `/api/v1/billing/webhook/bank` (đã làm sẵn).

Cách tự kiểm tra nhanh: mở app ngân hàng (ACB) → xem đúng chuỗi "Tên chủ tài khoản" →
dán chuỗi đó vào **Tên chủ tài khoản** trong khung “Cài đặt nhận tiền” (`/admin/orders`) →
xem dòng "Đang nhận tiền vào …" → quét thử mã QR bằng app ngân hàng thật để chắc chắn
tên và số tiền đúng.

### Cài đặt nhận tiền ngay trong app (ACB) — không cần sửa biến môi trường

Vào **`/admin/orders` → khung “Cài đặt nhận tiền”** (API: `GET/PUT /api/v1/admin/billing/settings`,
`POST /api/v1/admin/billing/settings/rotate-secret`):

| Trường | Giá trị cho ACB |
|---|---|
| Ngân hàng | **Ngân hàng TMCP Á Châu (ACB)** — BIN `970416` (ACB đứng đầu danh sách chọn) |
| Số tài khoản | số tài khoản ACB nhận tiền (6–25 chữ số) |
| Tên chủ tài khoản | **KHÔNG DẤU, viết hoa, đúng như ACB đang hiển thị** |
| Mẫu mã QR | `compact2` (kèm số tiền + nội dung) |

Khối đó còn có **URL webhook** và **mã xác thực** kèm nút copy — dán thẳng vào SePay.
Cấu hình lưu trong bảng `billing_settings` (**một dòng duy nhất**) và **đè lên** biến
môi trường, nên đổi ngân hàng/số tài khoản là **ăn liền, không phải deploy lại**.
Biến môi trường chỉ còn là giá trị dự phòng lúc chưa cài gì trong app.

### Nối ACB với SePay để tiền vào là gói tự bật

**SePay là đối tác chính thức của ACB** và có gói miễn phí 0đ/tháng, nên đây là đường
ngắn nhất (Casso cũng hỗ trợ ACB):

1. Tạo tài khoản SePay → **Liên kết tài khoản ACB** (chỉ cần đăng nhập ngân hàng một lần).
2. Vào **Webhooks → Thêm**:
   - URL: `https://taskalarm-api.onrender.com/api/v1/billing/webhook/bank`
     (lấy đúng URL từ khung “Cài đặt nhận tiền” cho khỏi sai).
   - Loại giao dịch: **Tiền vào** (`transferType = in`).
   - Xác thực: **Apikey** với **mã xác thực** trong khung cài đặt (Sepay gửi ở header
     `Authorization: Apikey …`; hệ thống cũng nhận `secure-token`, `x-webhook-secret`
     hoặc `?token=`).
3. Bấm **Kiểm tra / Gửi thử** của SePay. Một đơn thử đúng nội dung sẽ được kích hoạt
   ngay trong vài giây.
4. Tự kiểm chứng thật: bấm mua gói nhỏ nhất → quét mã QR bằng app ACB → chuyển đúng
   **số tiền** và **nội dung** → trang Gói tự chuyển sang gói mới (< 1 phút).

Mã xác thực có thể **sinh lại bất cứ lúc nào** (nút “Sinh mã mới”); mã cũ hết hiệu lực
ngay, nên nhớ dán lại vào SePay. Chưa có mã thì endpoint webhook **từ chối mọi request**
để không ai tự kích hoạt gói miễn phí.

### Đọc giao dịch bằng API ngân hàng (không cần webhook, không cần ai xác nhận)

Webhook là **ngân hàng/SePay đẩy về**; còn mục này là **hệ thống chủ động gọi API ngân hàng**
theo chu kỳ để đọc giao dịch tiền vào. Đường này không phụ thuộc việc webhook có tới hay
không, và **không cần ai mở sao kê rồi bấm xác nhận**. Hai đường dùng **cùng một lõi xử lý**
(`processBankTransaction`) nên chống trùng, chống nhầm tiền ra, lưới an toàn “gán tay”
đều giống nhau — bật cả hai thì càng chắc.

**Cách dùng:** `/admin/orders` → khung “Cài đặt nhận tiền” → mục
**“3. Tự phát hiện tiền vào bằng API ngân hàng”** → chọn nhà cung cấp → điền thông số →
**Kiểm tra kết nối** (chỉ đọc thử 5 giao dịch, KHÔNG kích hoạt gói) → **Đồng bộ ngay** →
bật **Tự đồng bộ theo chu kỳ** (mặc định 5 phút).

| Nhà cung cấp | Cần gì | Dùng được khi nào |
|---|---|---|
| **SEPAY** — API Giao dịch | API Token (`my.sepay.vn` → Cấu hình Công ty → API Access) | **Ngay bây giờ**. Tài liệu: <https://developer.sepay.vn/vi/sepay-api/v1/api-giao-dich> |
| **ACB** — ACB ONE CONNECT (Open API của ACB) | Token URL (OAuth2), Client ID, Client secret, đường dẫn lịch sử giao dịch, Base URL | Khi đã có **hợp đồng với ACB**: đăng ký tại <https://developer.acb.com.vn/acb/open/vi/getting-started> → tạo ứng dụng để nhận Client ID/Secret ID → đăng ký sản phẩm “Thông tin tài khoản / lịch sử giao dịch” → sau khi ký hợp đồng, ACB gửi thông số kỹ thuật để dán vào |

Vì sao phải có cả hai: **Open API của ACB là API thật của ngân hàng**, nhưng môi trường
production của ACB yêu cầu “Mã hợp đồng đã ký với ACB” khi nộp *Phiếu triển khai dịch vụ* —
không thể tự đăng ký rồi dùng ngay. SePay (đối tác chính thức của ACB) cho phép đọc **đúng
tài khoản ACB của bạn** qua API của họ trong lúc chờ hợp đồng, và SePay vẫn là một kết nối
API thật, không phải nhập tay.

**Thông số cần điền (ACB):**

| Trường | Ghi chú |
|---|---|
| Token URL | Endpoint OAuth2 lấy token; hệ thống gọi `grant_type=client_credentials` kèm Client ID/Secret (cả Basic header lẫn body) |
| Client ID / Client secret | ACB cấp cho ứng dụng của bạn |
| Đường dẫn lịch sử giao dịch | Dùng được các chỗ giữ: `{account}`, `{from}`, `{to}`, `{limit}` — ví dụ `/accounts/{account}/transactions?fromDate={from}&toDate={to}&limit={limit}` |
| Base URL | Chỉ cần khi đường dẫn ở trên là đường dẫn tương đối |
| Số tài khoản gửi lên API | Để trống thì dùng đúng số tài khoản nhận tiền ở mục 1 |

**Cách hệ thống xử lý:** gọi API → chuẩn hoá giao dịch (nhận cả `amount_in/amount_out` của
SePay lẫn `creditDebitIndicator` + `creditAmount/debitAmount` của ACB) → tìm mã đơn trong
nội dung → kiểm tra số tiền → kích hoạt gói. Giao dịch **tiền ra** (`DBIT`/`amount_out`) bị bỏ
qua tuyệt đối. Con trỏ `since_id` **chỉ tiến**, nên không đọc lại giao dịch cũ để trừ tiền
lần hai; mọi bản ghi vẫn đi qua `billing_events` với `external_id` duy nhất.

**Chạy theo lịch:** `backend/src/schedulers/bankSyncScheduler.js` kiểm tra mỗi phút và gọi API
khi đã qua chu kỳ. Vì Render free **ngủ** thì cron không chạy, `/health` (endpoint mà dịch vụ
keep-alive gọi đều đặn) cũng được gắn để **kiểm tra đồng bộ ngay khi máy chủ tỉnh** — xem
`onHealthPing` trong `server.js`.

**Endpoint quản trị:**

| Endpoint | Việc |
|---|---|
| `GET /api/v1/admin/billing/settings` | Tài khoản nhận tiền + URL/mã webhook + trạng thái đồng bộ API |
| `PUT /api/v1/admin/billing/settings` | Lưu tài khoản nhận tiền và/hoặc thông số API (bí mật gửi rỗng = giữ nguyên) |
| `POST /api/v1/admin/billing/test-connection` | Gọi thử API ngân hàng, chỉ đọc |
| `POST /api/v1/admin/billing/sync` | Đồng bộ ngay |
| `POST /api/v1/admin/billing/settings/rotate-secret` | Sinh lại mã xác thực webhook |

### Mã QR: hệ thống tự sinh, không phụ thuộc dịch vụ ngoài

Mã QR thanh toán do **chính backend sinh** (`backend/src/services/vietQrService.js`), theo chuẩn
EMVCo mà NAPAS ban hành cho VietQR — không còn phụ thuộc ảnh từ `img.vietqr.io` (ảnh đó vẫn
được giữ làm phương án dự phòng cuối khi chưa nhận diện được BIN ngân hàng).

Mã là một chuỗi EMVCo, mỗi “đối tượng dữ liệu” gồm ID 2 ký tự + độ dài 2 ký tự + dữ liệu:

| Tag | Nội dung | Giá trị dùng cho MN-Qronx |
|---|---|---|
| `00` | Phiên bản dữ liệu | `01` |
| `01` | Phương thức khởi tạo | `12` = quét một lần (đơn hàng) |
| `38` | Tài khoản thụ hưởng | `00` = `A000000727` (NAPAS) · `01` = `00` BIN + `01` số TK · `02` = `QRIBFTTA` |
| `53` | Tiền tệ | `704` (VND) |
| `54` | Số tiền | số tiền của đơn |
| `58` | Mã quốc gia | `VN` |
| `59` | Tên người thụ hưởng | đúng tên chủ tài khoản đã đăng ký |
| `62` → `08` | **Nội dung chuyển khoản** | **chính là mã đơn** (`MNQ…`) để đối soát |
| `63` | Mã kiểm tra | `6304` + CRC-16/CCITT-FALSE |

Nhờ tag `62` → `08`, khách quét mã là app ngân hàng **điền sẵn số tiền và đúng mã đơn** — không
cần khách tự gõ nội dung, và bộ đối soát (webhook hoặc API) khớp đúng đơn ngay.

**Dữ liệu trả cho giao diện/app** trong `payment` của đơn hàng:

| Trường | Ý nghĩa |
|---|---|
| `qrPayload` | Chuỗi EMVCo đầy đủ (đã gồm CRC) — app Android đọc trường này để tự vẽ QR |
| `qrImageDataUrl` | Ảnh QR (PNG dạng data URL do backend sinh, hoặc URL ảnh do ngân hàng trả về) |
| `qrSource` | `SYSTEM` = hệ thống tự sinh · `BANK` = do ngân hàng tạo qua API |
| `vietQrUrl` | Ảnh dự phòng từ dịch vụ vietqr.io (chỉ dùng khi thiếu BIN) |

**Mã QR do ngân hàng tạo (QR động):** sản phẩm “QR động” của ACB trả về một mã riêng cho từng
đơn và báo thanh toán thành công về phần mềm của doanh nghiệp. Điền **đường dẫn tạo QR động**
(`bankApiQrPath`, dùng được `{account}`, `{amount}`, `{content}`, `{orderCode}`) trong khung cài
đặt; khi tạo đơn, hệ thống gọi API ngân hàng (Bearer token OAuth2, POST JSON), lưu mã vào đơn và
**hiển thị mã đó** thay vì mã tự sinh. Ngân hàng lỗi thì đơn **vẫn chạy** với mã tự sinh —
không bao giờ chặn khách mua gói.

**Cách tự kiểm chứng:** `backend/tests/billing.test.js` so mã do hệ thống sinh với **mã VietQR
thật đã công bố** (`00020101021138540010A00000072701240006970423011000999999990208QRIBFTTA53037045802VN6304CBB4`)
— phải trùng từng ký tự; `crc16Ccitt('123456789')` phải ra `29B1`; ảnh trả về phải là PNG thật.
Lần đầu bật nhận tiền, hãy quét thử một đơn bằng app ngân hàng thật để thấy tên người nhận,
số tiền và nội dung đúng như mong đợi.

### Biến môi trường cần đặt (cả máy và Render)

```
BANK_ID=970416                 # ACB. Hoặc dùng khung “Cài đặt nhận tiền” trong app
BANK_ACCOUNT=0123456789
BANK_ACCOUNT_NAME=CONG TY MN QRONX   # KHÔNG DẤU, viết hoa
VIETQR_TEMPLATE=compact2
ORDER_TTL_HOURS=48
TRIAL_DAYS=7                   # 0 = tắt dùng thử
BILLING_WEBHOOK_SECRET=<chuỗi ngẫu nhiên dài>   # hoặc sinh trong app
PUBLIC_API_URL=                # bỏ trống thì tự suy ra từ request
SUPPORT_EMAIL=support@mn-qronx.id.vn

# Đọc giao dịch bằng API (dự phòng cho cấu hình trong app)
BANK_API_PROVIDER=             # SEPAY | ACB
BANK_API_TOKEN=                # SePay API token
BANK_API_BASE_URL=             # vd https://my.sepay.vn/userapi
BANK_API_CLIENT_ID=            # ACB ONE CONNECT
BANK_API_CLIENT_SECRET=
BANK_API_TOKEN_URL=
BANK_API_HISTORY_PATH=
BANK_API_QR_PATH=              # đường dẫn tạo QR động của ngân hàng; trống = tự sinh mã VietQR
BANK_API_ACCOUNT=              # mặc định = BANK_ACCOUNT
BANK_SYNC_INTERVAL_MINUTES=5   # 1–1440
```

Danh sách mã ngân hàng: <https://api.vietqr.io/v2/banks>.

**Bảo mật:** mã xác thực webhook là bắt buộc nếu dùng webhook — chưa có (cả trong app
lẫn biến môi trường) thì endpoint **từ chối mọi request** (500) để không ai tự kích hoạt
gói miễn phí. Giá trị đặt trong app **đè** `BILLING_WEBHOOK_SECRET`. Casso gửi mã này ở
header `secure-token`; Sepay dùng `Authorization: Apikey …`.
Cách cấu hình phía Casso: *Casso → Webhook → thêm URL*
`https://taskalarm-api.onrender.com/api/v1/billing/webhook/bank` + secure token.

### Vài tình huống thường gặp

| Tình huống | Hệ thống xử lý |
|---|---|
| Chuyển đúng tiền, đúng nội dung | Webhook khớp mã đơn → kích hoạt gói ngay |
| Nội dung có thêm tên chủ tài khoản ("CT DEN: MN QRONX MNQ…") | Vẫn khớp: mã được dò bằng bảng ký tự thật rồi đối chiếu với đơn trong DB |
| Chuyển thiếu tiền | Webhook ghi lại lý do "Chuyển thiếu", KHÔNG kích hoạt; admin đối soát tay |
| Chuyển sai nội dung (không có mã đơn) | Webhook ghi "không có mã đơn"; admin tìm đơn trong `/admin/orders` rồi xác nhận tay |
| Người dùng bấm huỷ đơn / đơn hết hạn | Đơn chuyển `CANCELLED` / `EXPIRED`, không thể xác nhận |
| Khách bắn tiền **ra** mà nội dung có mã đơn | Bỏ qua (`BANK_TRANSFER_OUT`), không kích hoạt gói |
| Khách không gõ nội dung mà chỉ quét mã | Mã đã nhúng sẵn nội dung = mã đơn nên vẫn khớp đúng đơn |
| Ngân hàng không tạo được QR động | Đơn dùng mã do hệ thống tự sinh, khách vẫn thanh toán bình thường |
| Webhook gửi lại cùng giao dịch | Bỏ qua nhờ `external_id` duy nhất, không cộng thêm ngày |
| Webhook không tới (mất mạng, dịch vụ chết) | Bộ đồng bộ API đọc lại giao dịch đó ở chu kỳ sau và kích hoạt gói |
| API ngân hàng trả lỗi (sai token, hết hạn) | Trạng thái đồng bộ ghi `ERROR` kèm lý do ở khung cài đặt; giao dịch chưa mất, chỉ chờ lần sau |
| Hoàn tiền | Chưa có luồng tự động: admin đổi gói người dùng về FREE ở `/admin/users` (được ghi vào `subscriptions` với `provider = ADMIN`) |

## 3. Dùng thử 7 ngày

`POST /api/v1/billing/trial` mở gói **Pro 7 ngày**, mỗi tài khoản **một lần**
(`user.trial_started_at`), và chỉ khi chưa từng trả tiền. Việc đánh dấu đã dùng
thử và cấp gói nằm trong cùng một transaction nên không thể lách bằng cách bấm
liên tục.

## 3b. Gia hạn khi không có tự động trừ tiền

Với chuyển khoản, người dùng phải tự mua lại kỳ mới. Vì vậy cần (chưa làm):

- Hiển thị rõ số ngày còn lại trên Dashboard khi còn ≤ 7 ngày (đã có trên trang Gói).
- Nhắc trước 3 ngày qua email + thông báo trong app, kèm nút "Gia hạn ngay" mở sẵn
  khung thanh toán của gói đang dùng.
- Admin xem danh sách "sắp hết hạn trong 7 ngày" ở `/admin/orders` để chủ động nhắc.
- Mọi gói đã hết hạn vẫn giữ nguyên dữ liệu, chỉ tụt giới hạn về gói Miễn phí.

## 4. Hạn mức AI theo ngày

AI **không còn chỉ dành cho gói Pro**: mọi gói đều dùng được, giới hạn theo ngày
(FREE 5 lần, Plus 50 lần, Pro không giới hạn) — xem `backend/src/services/aiQuotaService.js`.

- Lượt được trừ **sau khi AI trả kết quả thành công**, nên lỗi mạng không làm
  người dùng mất lượt.
- Ngày tính theo múi giờ `MAIL_QUOTA_TZ` (mặc định `Asia/Ho_Chi_Minh`).
- Hết lượt → HTTP 429 kèm gợi ý nâng cấp (`ApiError.tooManyRequests`).
- `GET /api/v1/ai/quota` trả số lượt đã dùng / còn lại để giao diện hiển thị.

## 5. App Android & Google Play (đợt tiếp theo)

Chính sách Play yêu cầu: bán **nội dung số trong app** phải dùng **Google Play
Billing**. Chương trình "Billing Choice" (cho phép dùng cổng thanh toán riêng
hoặc link ra web) hiện mới áp cho người dùng **UK/EEA** (cộng các chương trình
riêng ở Mỹ) — **Việt Nam chưa có**, nên trong app Android **không được** mời
người dùng ra web để trả tiền.

Vì vậy kiến trúc đã chuẩn bị sẵn hai cổng nạp tiền cùng ghi vào một bảng
`subscriptions`:

| Cổng | Nơi bán | Trạng thái |
|---|---|---|
| VietQR + webhook Casso/Sepay | Web | ✅ đã chạy |
| Google Play Billing | App Android | ⏳ chưa nối (cần tài khoản Play Console) |

Kế hoạch khi có tài khoản Play Console:

1. Tạo 4 sản phẩm đăng ký trong Play Console với **đúng mã** trong `PRODUCT_IDS`
   (`mnq_plus_monthly`, `mnq_plus_yearly`, `mnq_pro_monthly`, `mnq_pro_yearly`) và
   đúng giá như bảng trên.
2. Bọc web hiện tại bằng **Capacitor**, thêm plugin RevenueCat (`@revenuecat/purchases-capacitor`).
3. Backend nhận webhook RevenueCat/Play → gọi `applyPlanChange({ provider: 'PLAY', providerRef: purchaseToken })`
   để cấp đúng gói (không tin `plan` do client gửi lên).
4. Đảm bảo **không** có nút/link dẫn người dùng ra web thanh toán trong app Android.
5. Play Billing Library 8+ là bắt buộc (mốc 31/8/2026), Billing Choice cần 9.1.

Ngoài ra, để nộp app cần thêm: **trang Privacy Policy**, khai **Data safety**, và
**xoá tài khoản trong app + URL xoá trên web** (Play bắt buộc với app có tài
khoản) — hiện app chưa có chức năng xoá tài khoản cho người dùng.

## 6. Ghi chú kỹ thuật

- Bảng liên quan: `subscriptions`, `payment_orders`, `billing_events`, `ai_usage`
  (+ cột `app_users.trial_started_at`).
- Endpoint người dùng: `GET /billing/products` (công khai), `GET /billing/me`,
  `POST /billing/orders`, `GET /billing/orders/:code`, `POST /billing/orders/:code/cancel`,
  `POST /billing/trial`, `GET /ai/quota`.
- Endpoint quản trị: `GET /admin/orders`, `POST /admin/orders/:code/confirm`,
  `POST /admin/orders/:code/cancel`.
- **Đã gỡ bỏ** nâng cấp mô phỏng (`PUT /plans/upgrade`) — trước đây ai bấm nút
  cũng thành Pro miễn phí.
- Kiểm thử: `cd backend && npx vitest run tests/billing.test.js`
  (đơn hàng, webhook kể cả nội dung có tên chủ tài khoản, chống trùng, dùng thử,
  hạn mức AI).
