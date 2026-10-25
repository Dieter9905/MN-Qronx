# Tài liệu Business Analysis – MN-Qronx

> **Plan. Do. On Time.** — Ứng dụng quản lý thời gian & công việc cá nhân với nhắc nhở kiểu báo thức.
>
> Tài liệu này thay thế bản `01_TaskAlarm_Business_Analysis.md` trước đây. Sản phẩm đã đổi tên thành **MN-Qronx** và đã mở rộng ra ngoài phạm vi MVP ban đầu (gói trả phí, trợ lý AI, giao việc, gói Pro Doanh nghiệp, chăm sóc khách hàng). Mọi mục dưới đây phản ánh **hệ thống đang chạy thật** trong mã nguồn, không còn là bản phác thảo.

## 1. Giới thiệu dự án

### 1.1. Giới thiệu

MN-Qronx là ứng dụng quản lý thời gian và công việc cá nhân, hoạt động trên **Website (PWA)**, kèm **tiện ích trình duyệt Chrome/Edge** (chuông nhắc việc chạy nền) và dự kiến có **ứng dụng Android/iOS**, giúp người dùng lên kế hoạch, theo dõi và hoàn thành công việc đúng hạn. Điểm khác biệt cốt lõi so với các ứng dụng to-do thông thường là cơ chế **nhắc nhở kiểu báo thức**: khi đến thời điểm đã hẹn, hệ thống **đổ chuông, rung và hiển thị màn hình nhắc nhở toàn màn hình**, buộc người dùng chủ động **Hoãn (Snooze)** hoặc **Tắt (Dismiss)** để xác nhận đã nhận biết công việc.

Sản phẩm đã phát triển thành một ứng dụng freemium hoàn chỉnh: người dùng có thể nâng cấp lên các **gói Plus / Pro / Pro Doanh nghiệp** thanh toán bằng chuyển khoản VietQR hoặc Google Play Billing, tích điểm đổi gói, nhờ người khác làm hộ công việc, dùng **trợ lý AI** nhập việc bằng câu nói tự nhiên, và chat trực tiếp với bộ phận hỗ trợ.

### 1.2. Mục tiêu

- Giúp người dùng tạo, sắp xếp và theo dõi công việc theo ngày/tuần/tháng một cách trực quan.
- Đảm bảo người dùng **không bỏ lỡ** công việc quan trọng nhờ nhắc nhở dạng báo thức (âm thanh, rung, thông báo hệ thống kể cả khi đã đóng trình duyệt).
- **Nhắc dai (nag)**: việc quan trọng chưa xác nhận xong thì chuông kêu lại theo chu kỳ, thay vì chỉ nhắc một lần.
- Đồng bộ dữ liệu công việc giữa các thiết bị của cùng một tài khoản; xuất việc sang Google Calendar/Outlook qua tệp `.ics`.
- Cho phép người dùng **nhờ người khác làm** một công việc và luân phiên người chịu trách nhiệm theo kỳ.
- Giúp nhóm người dùng (thí dụ nhóm doanh nghiệp nhỏ) dùng chung một gói trả phí (`Pro Doanh nghiệp`).
- Biến dữ liệu sử dụng thành **báo cáo năng suất** và **kế hoạch tuần** có ích cho người dùng trả phí.
- Duy trì mô hình kinh doanh freemium: gói miễn phí đủ dùng, gói trả phí mở ra giá trị rõ ràng (nhắc dai, báo cáo, kế hoạch tuần, giao việc, giới hạn AI).
- Cung cấp kênh chăm sóc khách hàng (chat người dùng ↔ admin) và công cụ đối soát thanh toán cho quản trị viên.

### 1.3. Phạm vi hệ thống

| Nhóm người dùng | Phạm vi chức năng |
|---|---|
| Guest | Xem trang giới thiệu và bảng giá; đăng ký (có xác thực email), đăng nhập (mật khẩu hoặc Google), quên/đặt lại mật khẩu. |
| User (gói Miễn phí) | Quản lý hồ sơ, mật khẩu; danh mục; tạo/sửa/xóa (có thùng rác) công việc và việc con; lặp lại Hằng ngày/Hằng tuần (chọn thứ)/Hằng tháng; thêm nhắc nhở và nhận báo thức (âm thanh, rung, snooze/dismiss); lịch; dashboard; lịch sử thông báo; cài đặt thông báo; quản lý thiết bị + Web Push; xuất lịch `.ics`; trợ lý AI (có hạn mức ngày); tích điểm thưởng và dùng mã mời; xem bảng giá, kích hoạt dùng thử, mua gói; chat hỗ trợ; nhận việc người khác giao cho mình. |
| User (Plus) | Thêm: không giới hạn công việc/danh mục/việc con, 5 nhắc nhở mỗi việc, 5 thiết bị, hạn mức AI 50 lượt/ngày, toàn bộ âm thanh báo thức có sẵn, hỗ trợ ưu tiên. |
| User (Pro / Pro Doanh nghiệp) | Thêm: nhắc dai tới khi xác nhận; báo cáo năng suất 7/30/90 ngày + xuất file; kế hoạch tuần; báo cáo tuần qua email; giao việc cho người khác và luân phiên người làm; không giới hạn thiết bị & AI; âm thanh báo thức tự tải lên. Chủ gói Pro Doanh nghiệp dùng chung quyền Pro cho tối đa 9 tài khoản khác (tổng 10 ghế). |
| Admin | Đăng nhập quản trị; dashboard hệ thống; quản lý tài khoản (tạo, khóa/mở, đổi gói, xóa vĩnh viễn); đối soát đơn thanh toán (xác nhận/hủy, gán giao dịch ngân hàng, cấu hình nhận tiền, webhook, test kết nối, đồng bộ ngân hàng); quản lý hội thoại hỗ trợ (trả lời, đánh dấu đã đọc, đổi trạng thái). |

### 1.4. Ngoài phạm vi

Các mục dưới đây **cố ý** không nằm trong phiên bản hiện tại:

- **Đồng bộ hai chiều với lịch bên thứ ba**: hiện chỉ có chiều **ứng dụng → lịch** (xuất `.ics`). Chiều ngược lại (đọc sự kiện Google/Outlook vào MN-Qronx) nằm trong danh sách "Sắp có" của gói Pro.
- **Ứng dụng native Android/iOS**: mã nguồn hiện có sẵn tích hợp FCM và schema `Device` cho app di động, nhưng bản phát hành chính là **Web PWA**. Notifee/local notification và full-screen intent là kế hoạch, chưa nằm trong phạm vi đã kiểm thử.
- **Nhắc qua Zalo OA**: đã bỏ khỏi danh sách bán (thông báo đẩy đã đủ; Zalo chỉ còn là kênh dự phòng cho máy chặn thông báo nền — để sau).
- **Trợ lý AI biết lập kế hoạch/đàm thoại tổng quát**: dịch vụ AI riêng của dự án (`ai/`) là **model phân tích câu thành công việc**, không phải LLM đa dụng. Mọi tính năng "xếp việc" đều làm bằng luật (`plannerService`), không dùng AI.
- **Quy tắc lặp lại phức tạp kiểu RRULE** (thí dụ "thứ Ba thứ 2 của mỗi tháng"); chỉ hỗ trợ NONE/DAILY/WEEKLY (chọn nhiều thứ trong tuần)/MONTHLY.
- **Chế độ offline đầy đủ**: PWA có cache app shell và hiển thị dữ liệu đã tải trước đó, nhưng tạo/sửa dữ liệu cần mạng.
- **Hạ tầng nâng cao**: microservice, message queue, event sourcing, Kubernetes.

### 1.5. Đối tượng sử dụng

| Đối tượng | Nhu cầu chính |
|---|---|
| Khách vãng lai (Guest) | Tìm hiểu ứng dụng, so sánh gói, tạo tài khoản để bắt đầu. |
| Người dùng cá nhân | Quản lý công việc, không bỏ lỡ deadline, được nhắc đúng lúc và rõ ràng. |
| Người dùng trả phí | Muốn được nhắc tới khi xác nhận, muốn thấy số liệu năng suất, muốn nhờ người khác làm hộ. |
| Nhóm dùng chung (doanh nghiệp, đội nhóm) | Nhiều người cùng dùng một khoản trả phí, mỗi người vẫn có tài khoản và dữ liệu riêng. |
| Quản trị viên (Admin) | Giám sát tài khoản, đối soát thanh toán, hỗ trợ khách hàng. |

### 1.6. Stakeholder

| Stakeholder | Vai trò/Mối quan tâm |
|---|---|
| Chủ sở hữu sản phẩm | Doanh thu từ gói Plus/Pro/Pro Doanh nghiệp; giữ chân người dùng bằng giá trị cảm nhận được. |
| Người dùng | Quản lý công việc đơn giản, được nhắc chắc chắn, không bị bỏ sót. |
| Quản trị viên | Công cụ theo dõi tài khoản, xác nhận thanh toán, trả lời khách. |
| Nhóm thực hiện đồ án | Tài liệu nghiệp vụ thống nhất để thiết kế, phát triển và kiểm thử. |
| Giảng viên/Hội đồng đánh giá | Đánh giá tính hợp lý, đầy đủ và nhất quán của phân tích nghiệp vụ. |

### 1.7. Giả định

- Mỗi tài khoản dùng một email duy nhất, dùng chung cho Website và app di động. Đăng ký **bắt buộc** xác thực email bằng mã 6 số gửi qua email.
- Một công việc thuộc về **đúng một chủ sở hữu** (`Task.userId`). "Giao việc" chỉ tạo bản ghi chia sẻ; người được giao **không** có quyền sửa/xóa công việc.
- Thời gian hiển thị và tính toán theo **múi giờ Việt Nam (Asia/Ho_Chi_Minh)**; máy chủ lưu UTC.
- Người dùng có thể đăng ký nhận thông báo trên nhiều thiết bị. Web Push cần HTTPS (hoặc localhost) và sự cho phép của người dùng.
- Nếu người dùng từ chối quyền thông báo, hệ thống chỉ hiển thị nhắc nhở trong ứng dụng khi tab đang mở.
- Admin là vai trò quản trị duy nhất, tạo bằng seed data hoặc do admin hiện có tạo thêm.
- Khoá VAPID (Web Push) có thể cấu hình qua biến môi trường; nếu thiếu, hệ thống **tự sinh và lưu trong bảng `app_settings`**.
- Việc gửi email dùng **Gmail SMTP** (`smtp.gmail.com:465`, App Password của tài khoản Gmail chủ dự án) để thư xác thực vào hộp chính; đường Resend/Mailjet chỉ còn là đường dự phòng. Hàm kiểm tra hạn mức gửi chỉ áp dụng cho Mailjet (10 thư/ngày) — không có tác dụng khi đi qua Gmail SMTP.
- Giao dịch ngân hàng được đối soát tự động (webhook SePay/Casso hoặc API ngân hàng) và/hoặc xác nhận thủ công bởi admin.
- Hạ tầng chạy trên **VPS riêng (Ubuntu 24.04, 103.77.209.154)** 24/7: systemd service `mn-qronx` cho backend, Nginx + Certbot cho HTTPS tại `mn-qronx.id.vn`, PostgreSQL 16 cài trên chính VPS. Đã bỏ Render/Vercel; móc làm việc định kỳ theo nhịp `/health` được giữ lại làm cơ chế dự phòng cho cron trong cùng tiến trình.

### 1.8. Thuật ngữ

| Thuật ngữ | Diễn giải |
|---|---|
| Guest | Người truy cập ứng dụng nhưng chưa đăng nhập. |
| User | Người dùng đã đăng ký, đăng nhập và quản lý công việc cá nhân. |
| Admin | Người dùng có quyền quản trị hệ thống. |
| Công việc (Task) | Mục công việc/nhiệm vụ có thời hạn (`dueAt`). |
| Danh mục (Category) | Nhóm phân loại công việc theo lĩnh vực, có màu hiển thị. |
| Việc con (Subtask) | Checklist item nằm trong một công việc. |
| Nhắc nhở (Reminder) | Một thời điểm được hẹn trước để hệ thống thông báo. |
| Báo thức (Alarm) | Trạng thái khi Reminder được kích hoạt: âm thanh, rung, màn hình nhắc nhở toàn màn hình. |
| Hoãn (Snooze) | Dời thời điểm báo thức sang một khoảng sau; tối đa 3 lần liên tiếp. |
| Tắt (Dismiss) | Tắt hẳn báo thức đang kêu. |
| Nhắc dai (Nag) | Chế độ của gói Pro: việc chưa xong thì chuông kêu lại mỗi N phút (1–30), tối đa 10 lần. |
| Công việc lặp lại | Task tự sinh bản kế tiếp theo chu kỳ NONE/DAILY/WEEKLY/MONTHLY. |
| Thùng rác | Công việc bị xóa được giữ 30 ngày (soft delete) rồi mới xóa thật; có thể khôi phục. |
| Thiết bị (Device) | Trình duyệt hoặc điện thoại đã đăng ký nhận thông báo đẩy. |
| Web Push Subscription | Đăng ký của trình duyệt (endpoint + p256dh + auth) để nhận thông báo khi tab đã đóng. |
| Gói (Plan) | Mức dịch vụ: Miễn phí / Plus / Pro / Pro Doanh nghiệp. |
| Đơn hàng (PaymentOrder) | Một lượt mua gói, có mã đơn (`MNQ…`) làm nội dung chuyển khoản. |
| Gói đăng ký (Subscription) | Lịch sử quyền lợi theo gói (nguồn sự thật về hạn dùng). |
| Dùng thử (Trial) | 7 ngày Pro, mỗi tài khoản chỉ dùng một lần. |
| Điểm thưởng (Points) | Điểm tích lũy đăng nhập/chuỗi ngày/mời bạn, đổi được ngày dùng gói. |
| Mã mời (Invite Code) | Mã 6 ký tự của mỗi người dùng để rủ bạn bè. |
| Giao việc (Task Share) | Chủ việc nhờ một tài khoản khác làm hộ (quyền lợi gói Pro của chủ việc). |
| Luân phiên (Rotation) | Việc lặp lại mà mỗi kỳ một người khác chịu trách nhiệm, xoay theo thứ tự giao việc. |
| Pro Doanh nghiệp | Gói mua một lần cho tối đa 10 tài khoản (chủ gói + 9 người dùng dùng ké), quyền lợi y hệt Pro; 349.000đ/tháng hoặc 3.490.000đ/năm. |
| Trợ lý AI | Dịch vụ AI riêng của MN-Qronx phân tích câu tiếng Việt thành công việc. |
| VietQR | Chuẩn mã QR chuyển khoản ngân hàng Việt Nam dùng để thu tiền. |
| CSKH / Support | Hội thoại hỗ trợ giữa người dùng và admin ngay trong ứng dụng. |
| Quá hạn (Overdue) | Trạng thái hiển thị cho công việc đã qua hạn nhưng chưa hoàn thành (không lưu trong DB). |
| Dashboard | Màn hình tổng quan số liệu cho người dùng hoặc admin. |

## 2. Phân tích nghiệp vụ

### 2.1. Quy trình đăng ký và xác thực

1. Guest chọn **Đăng ký**, nhập họ tên, email, mật khẩu.
2. Hệ thống kiểm tra email chưa tồn tại, gửi **mã xác nhận 6 số** qua email (hiệu lực ngắn, dùng một lần). Mỗi email chỉ được yêu cầu lại sau một khoảng chờ.
3. Guest nhập mã; nếu hợp lệ, hệ thống tạo tài khoản (gói Miễn phí) và bản ghi `NotificationSetting` mặc định.
4. Guest đăng nhập bằng email/mật khẩu hoặc **Google OAuth**. Hệ thống trả `accessToken` (JWT, ~1 giờ) + `refreshToken` (lưu DB, ~7 ngày).
5. Khi access token hết hạn, client tự gọi `POST /auth/refresh-token` để lấy token mới. Đăng xuất hoặc đổi mật khẩu sẽ thu hồi refresh token.
6. Quên mật khẩu: người dùng nhập email → hệ thống gửi email chứa `resetToken` → đặt mật khẩu mới và thu hồi mọi phiên.
7. Mỗi lần đăng nhập thành công, hệ thống cộng **điểm đăng nhập hằng ngày** và cập nhật chuỗi đăng nhập.

### 2.2. Quy trình tạo và quản lý công việc

1. Người dùng tạo danh mục (tùy chọn) để nhóm công việc.
2. Người dùng tạo công việc với tiêu đề (bắt buộc), mô tả, danh mục, mức ưu tiên và thời hạn `dueAt` (bắt buộc).
3. Có thể thêm **việc con** (checklist) ngay khi tạo hoặc sau đó.
4. Có thể chọn **quy tắc lặp lại**: Không lặp / Hằng ngày / Hằng tuần (chọn các thứ trong tuần) / Hằng tháng.
5. Có thể thiết lập **một hoặc nhiều nhắc nhở**, số lượng tối đa theo gói (Miễn phí 3, các gói khác 5); mỗi `remindAt` phải ≤ `dueAt`.
6. Gói Pro có thể bật **nhắc dai** (`nagEveryMinutes`), và **luân phiên người làm** (`rotateEnabled`) khi công việc đã giao cho nhiều người.
7. Người dùng xem công việc theo danh sách (lọc/tìm kiếm/phân trang), theo lịch, hoặc qua kế hoạch tuần.
8. Đánh dấu hoàn thành ⇒ reminder chưa kích hoạt bị hủy; nếu là việc lặp lại, hệ thống sinh bản kế tiếp. Có thể **mở lại** việc đã hoàn thành/hủy.
9. Xóa việc ⇒ đưa vào **thùng rác** 30 ngày (khôi phục được), sau đó tự xóa vĩnh viễn.

### 2.3. Quy trình nhắc nhở & báo thức

1. Hệ thống có **scheduler chạy mỗi 1 phút**, quét các Reminder `SCHEDULED` đã đến hạn.
2. Khi đến giờ, hệ thống đánh dấu `TRIGGERED`, rồi:
   - Gửi **Web Push** tới mọi subscription đang hoạt động (chuông kêu kể cả khi đã đóng trình duyệt).
   - Gửi **FCM** tới các thiết bị di động (nếu có).
   - Ghi **NotificationLog** (`action = SENT`) cho từng thiết bị.
3. Nếu tab đang mở, client hiển thị **màn hình báo thức toàn màn hình** (màu theo mức ưu tiên) kèm âm thanh, rung, và hai lựa chọn **Hoãn** / **Tắt**.
4. **Hoãn**: hệ thống dời `remindAt = hiện tại + số phút hoãn` và tăng `snoozeCount`. Tối đa **3 lần** liên tiếp; đã đủ 3 lần thì chỉ còn Tắt.
5. **Tắt**: `status = DISMISSED`, ghi log tương ứng.
6. **Nhắc dai (Pro)**: nếu việc chưa xong, người dùng còn quyền Pro và chưa quá 10 lần nhắc lại, hệ thống tự đặt lại chính reminder đó kêu sau N phút. Hoàn thành/hủy việc ⇒ mọi reminder bị hủy, chuông tự im.
7. Mọi lần gửi/hoãn/tắt đều được ghi vào lịch sử thông báo để tra cứu.

### 2.4. Quy trình công việc lặp lại

1. Khi tạo việc, chọn chu kỳ; với Hằng tuần chọn các thứ (ISO 1–7).
2. Việc lặp giữ nguyên danh mục, mức ưu tiên và cấu hình nhắc nhở.
3. Khi một lần lặp được đánh dấu Hoàn thành, hệ thống tạo **bản ghi Task mới** với `parentTaskId` trỏ về bản vừa xong và `dueAt` tính theo chu kỳ.
4. Người dùng có thể dừng lặp bằng cách sửa quy tắc; các lần lặp trước không bị ảnh hưởng.

### 2.5. Quy trình giao việc và luân phiên (gói Pro)

1. Chủ việc (gói Pro) mở một công việc đang mở của mình và chọn **Giao việc** theo email của người nhận (người nhận không cần gói trả phí).
2. Hệ thống tạo `TaskShare`; người nhận thấy việc trong mục **Việc được giao** và cũng nhận chuông nhắc.
3. Người nhận chỉ có thể đánh dấu **"Xong phần của tôi"** (`doneAt`); quyền sửa/xóa vẫn thuộc chủ việc.
4. Chủ việc nhận thông báo khi người được giao xong; công việc chỉ hoàn thành khi chủ việc bấm xong.
5. Nếu bật **luân phiên**, mỗi kỳ một người chịu trách nhiệm theo thứ tự giao việc; khi việc xong, người đến lượt kỳ sau được tính lại.
6. Giới hạn: tối đa **5 người nhận** mỗi việc, tối đa **50 việc đang giao đi** mỗi tài khoản.

### 2.6. Quy trình gói Pro Doanh nghiệp

1. Chủ gói mua **Pro Doanh nghiệp** (dùng chung cho tối đa 10 ghế).
2. Chủ gói mời thành viên bằng email (người được mời phải đã có tài khoản MN-Qronx).
3. Hệ thống **vật chất hóa** quyền Pro của người trong nhà trên chính `users.plan` (cùng hạn với chủ gói), nên mọi cổng kiểm tra quyền lợi chạy đúng mà không phải sửa gì.
4. Người trong nhà có thể **tự tắt chia sẻ tiến độ** (`shareProgress`), hoặc **tự rời nhóm**.
5. Chủ gói hết hạn ⇒ cả nhà cùng hết quyền, dòng thành viên bị xóa; khi chủ mua lại phải **mời lại**.
6. Một người chỉ nằm trong đúng **một** gói Doanh nghiệp.

### 2.7. Quy trình mua gói và thanh toán

1. Người dùng xem bảng giá (công khai) và chọn gói + kỳ (tháng/năm; năm tặng 2 tháng).
2. Có thể **dùng thử Pro 7 ngày** một lần duy nhất.
3. Tạo **đơn hàng** (`PaymentOrder`) → hệ thống sinh mã đơn (`MNQ…`) và mã QR VietQR (hoặc QR do API ngân hàng tạo).
4. Người dùng chuyển khoản với nội dung là mã đơn. Hệ thống xác nhận theo một trong ba đường:
   - **Webhook** ngân hàng (SePay/Casso) gửi về, xác thực bằng mã bí mật webhook (chống xử lý trùng bằng `BillingEvent.externalId`).
   - **API ngân hàng** (SePay/ACB) — scheduler đồng bộ định kỳ; cũng chạy ngay khi người dùng bấm "Tôi đã chuyển" hoặc theo nhịp `/health`.
   - **Admin xác nhận thủ công** trong trang Quản lý đơn.
5. Khi khớp tiền, hệ thống ghi `Subscription` (ACTIVE) và cập nhật `users.plan` + hạn dùng. Nếu đang còn hạn cùng gói thì **cộng dồn** thời gian.
6. Trước khi hết hạn, hệ thống gửi email nhắc gia hạn (mỗi kỳ tối đa một lần). Quá hạn ⇒ scheduler tự hạ gói về Miễn phí và đưa âm thanh tùy chỉnh về chuông mặc định.

### 2.8. Quy trình điểm thưởng và mời bạn bè

1. Đăng nhập mỗi ngày: **+10 điểm** (mỗi ngày một lần). Chuỗi 7 ngày liên tiếp: **+50 điểm**.
2. Mời bạn: khi người được mời **đăng nhập lần đầu**, người mời nhận **+100 điểm**. Chống lạm dụng: cùng người mời + cùng IP + cùng thiết bị chỉ tính một tài khoản.
3. Điểm đổi được ngày dùng gói: 7/30 ngày Plus (200/500 điểm) và 7/30 ngày Pro (800/1500 điểm). Đổi điểm đi qua đúng luồng cấp gói nên có `Subscription` và luật cộng dồn như mua bằng tiền.
4. Nếu người đổi đang là chủ gói **Pro Doanh nghiệp** còn hạn, việc đổi điểm được hiểu là **gia hạn** (không hạ gói).

### 2.9. Quy trình trợ lý AI

1. Người dùng gõ (hoặc nói qua Web Speech API) một câu như *"Nhắc tôi nộp báo cáo thứ Sáu 5h chiều, ưu tiên cao"*.
2. Ứng dụng gửi văn bản tới backend → backend chuyển tiếp tới **AI inference server riêng** (`POST /parse`), làm sạch kết quả theo đúng cấu trúc form tạo việc.
3. Người dùng xem trước và xác nhận tạo công việc. Mỗi lần thành công **trừ một lượt** trong hạn mức ngày (Miễn phí 5, Plus 50, Pro không giới hạn).
4. Nếu AI không kết nối được, ứng dụng **fallback về parser cục bộ** để vẫn tạo được việc.

### 2.10. Quy trình báo cáo và kế hoạch tuần (gói Pro)

1. **Kế hoạch tuần**: người dùng chọn số việc mỗi ngày (3/5/8/10). Hệ thống xếp việc đang mở vào 7 ngày theo luật (quá hạn lâu nhất trước → hạn gần nhất → ưu tiên), và chỉ rõ những việc **sẽ trễ** (`atRisk`) để người dùng dời hạn.
2. **Báo cáo năng suất**: khoảng 7/30/90 ngày; số việc xong theo ngày/thứ/giờ, tỉ lệ xong đúng hạn, việc tồn đọng lâu nhất, thống kê theo danh mục, số việc được "nhắc dai" cứu. Xuất được file CSV (giới hạn 2.000 dòng).
3. **Báo cáo tuần qua email**: gửi tự động vào **sáng thứ Hai**; người dùng bật/tắt được và có nút gửi thử cho chính mình.

### 2.11. Quy trình chăm sóc khách hàng

1. Người dùng mở mục **Hỗ trợ** và gửi tin nhắn (kèm tối đa 3 ảnh).
2. Mỗi người dùng có đúng một hội thoại (`SupportConversation`); hội thoại có trạng thái **Đang xử lý / Đã xong**.
3. Admin thấy danh sách hội thoại, số tin chưa trả lời, xem và trả lời, đánh dấu đã đọc, đổi trạng thái.
4. Hai bên đều có bộ đếm chưa đọc để không bỏ sót tin.

### 2.12. Giá trị hệ thống mang lại

| Đối tượng | Giá trị |
|---|---|
| Người dùng miễn phí | Quản lý công việc và nhắc nhở chắc chắn, không mất phí, không quảng cáo. |
| Người dùng trả phí | Nhắc dai tới khi xác nhận; báo cáo và kế hoạch giúp nhìn thấy tiến bộ; giao việc mở ra việc trước đây không làm được. |
| Chủ gói Pro Doanh nghiệp | Một khoản trả cho cả nhóm, mỗi người vẫn riêng tư và có dữ liệu của mình. |
| Admin | Đối soát thanh toán và hỗ trợ khách trong cùng một công cụ. |
| Nhóm phát triển | Quy trình nghiệp vụ và yêu cầu thống nhất làm căn cứ thiết kế, xây dựng, kiểm thử. |

## 3. Actor

### 3.1. Guest

| Nội dung | Mô tả |
|---|---|
| Vai trò | Người truy cập chưa đăng nhập. |
| Quyền hạn | Xem nội dung công khai và thực hiện các chức năng xác thực cơ bản. |
| Mục tiêu | Hiểu ứng dụng, chọn gói, tạo/đăng nhập tài khoản. |
| Chức năng chính | Xem trang giới thiệu; xem bảng giá; đăng ký (có xác thực email); đăng nhập (mật khẩu/Google); quên & đặt lại mật khẩu. |

### 3.2. User

| Nội dung | Mô tả |
|---|---|
| Vai trò | Người dùng đã đăng ký và đăng nhập. |
| Quyền hạn | Toàn bộ chức năng của gói hiện tại (Miễn phí/Plus/Pro/Pro Doanh nghiệp) và quyền nhận việc được giao. |
| Mục tiêu | Hoàn thành công việc đúng hạn, không bỏ sót, thấy được tiến bộ, có thể nhờ người khác làm hộ. |
| Chức năng chính | Hồ sơ, mật khẩu; danh mục; công việc + việc con + nhắc nhở + lặp lại + nhắc dai + thùng rác; lịch; dashboard; lịch sử thông báo; cài đặt thông báo & âm thanh; thiết bị & Web Push; xuất `.ics`; trợ lý AI; báo cáo; kế hoạch tuần; điểm thưởng & mã mời; gói & thanh toán; việc được giao; gói Doanh nghiệp; hỗ trợ. |

### 3.3. Admin

| Nội dung | Mô tả |
|---|---|
| Vai trò | Người quản trị vận hành hệ thống. |
| Quyền hạn | Truy cập khu vực quản trị. |
| Mục tiêu | Giữ hệ thống ổn định, kiểm soát tài khoản, thu đúng tiền, trả lời khách. |
| Chức năng chính | Dashboard hệ thống; quản lý người dùng (tạo, khóa/mở, đổi gói, xóa); đối soát đơn & cấu hình nhận tiền; quản lý hội thoại hỗ trợ. **Không** được xem nội dung công việc cá nhân của người dùng. |

## 4. Functional Requirements

### 4.1. Xác thực & tài khoản

| ID | Chức năng | Mô tả | Actor |
|---|---|---|---|
| FR-01 | Xem trang giới thiệu | Hiển thị giới thiệu tổng quan và tính năng nổi bật của MN-Qronx. | Guest |
| FR-02 | Xem bảng giá | Xem 4 gói, giá theo tháng/năm, quyền lợi và hạn mức từng gói. | Guest, User |
| FR-03 | Gửi mã xác nhận email | Gửi mã 6 số tới email để xác thực khi đăng ký (1 email = 1 tài khoản). | Guest |
| FR-04 | Đăng ký | Tạo tài khoản User sau khi mã xác nhận hợp lệ. | Guest |
| FR-05 | Đăng nhập | Đăng nhập bằng email/mật khẩu; trả access + refresh token. | Guest, User, Admin |
| FR-06 | Đăng nhập bằng Google | Đăng nhập/đăng ký qua Google OAuth, nhận token qua callback. | Guest, User |
| FR-07 | Làm mới token | Cấp lại access token từ refresh token hợp lệ. | User, Admin |
| FR-08 | Đăng xuất | Thu hồi refresh token của phiên hiện tại. | User, Admin |
| FR-09 | Quên mật khẩu | Gửi email chứa reset token (không tiết lộ email có tồn tại hay không). | Guest, User |
| FR-10 | Đặt lại mật khẩu | Đặt mật khẩu mới bằng reset token hợp lệ; thu hồi mọi phiên. | Guest, User |
| FR-11 | Xem/cập nhật hồ sơ | Xem và cập nhật họ tên, số điện thoại, ảnh đại diện. | User |
| FR-12 | Đổi mật khẩu | Đổi mật khẩu sau khi xác thực mật khẩu hiện tại. | User |
| FR-13 | Xem thống kê cá nhân | Xem số liệu nhanh (hôm nay, quá hạn, hoàn thành, danh mục, thiết bị). | User |
| FR-14 | Xem hoạt động gần đây | Xem 5 thông báo gần nhất trong hồ sơ. | User |

### 4.2. Danh mục

| ID | Chức năng | Mô tả | Actor |
|---|---|---|---|
| FR-15 | Quản lý danh mục | Thêm, sửa, chọn màu, ẩn/hiện danh mục (tên không trùng trong cùng tài khoản). | User |

### 4.3. Công việc, việc con, lặp lại, thùng rác

| ID | Chức năng | Mô tả | Actor |
|---|---|---|---|
| FR-16 | Tạo công việc | Tạo việc với tiêu đề, mô tả, danh mục, ưu tiên, `dueAt`, quy tắc lặp, nhắc dai. | User |
| FR-17 | Xem danh sách công việc | Xem theo trạng thái/ưu tiên/danh mục/khoảng thời gian/từ khóa, có phân trang & sắp xếp. | User |
| FR-18 | Xem chi tiết công việc | Xem đầy đủ thông tin, việc con, nhắc nhở, người được giao. | User |
| FR-19 | Cập nhật công việc | Chỉnh sửa việc thuộc sở hữu của mình. | User |
| FR-20 | Đánh dấu hoàn thành | Chuyển sang Hoàn thành; hủy reminder chưa kích hoạt; sinh việc lặp kế tiếp nếu có. | User |
| FR-21 | Mở lại công việc | Đưa việc đã Hoàn thành/Đã hủy về Chưa làm. | User |
| FR-22 | Hủy công việc | Chuyển sang Đã hủy; hủy reminder chưa kích hoạt. | User |
| FR-23 | Xóa công việc | Đưa việc vào thùng rác (30 ngày). | User |
| FR-24 | Thùng rác | Xem danh sách việc đã xóa; **khôi phục** hoặc **dọn sạch** thùng rác. | User |
| FR-25 | Quản lý việc con | Thêm, sửa nội dung, đánh dấu hoàn thành, xóa việc con trong một công việc. | User |
| FR-26 | Thiết lập lặp lại | Chọn Không lặp/Hằng ngày/Hằng tuần (chọn nhiều thứ)/Hằng tháng. | User |

### 4.4. Nhắc nhở, báo thức, nhắc dai

| ID | Chức năng | Mô tả | Actor |
|---|---|---|---|
| FR-27 | Thiết lập nhắc nhở | Thêm/sửa/xóa nhắc nhở (số lượng theo giới hạn gói), `remindAt ≤ dueAt`. | User |
| FR-28 | Kích hoạt báo thức | Scheduler quét mỗi phút và gửi thông báo kèm âm thanh/rung đúng giờ. | Hệ thống |
| FR-29 | Hiển thị màn hình nhắc nhở | Màn hình báo thức toàn màn hình khi tab đang mở. | Hệ thống |
| FR-30 | Hoãn báo thức | Dời nhắc nhở sang sau (tối đa 3 lần liên tiếp). | User |
| FR-31 | Tắt báo thức | Tắt hẳn báo thức đang kêu, ghi lịch sử. | User |
| FR-32 | Reminder đến hạn (dự phòng) | Trả về các reminder đã đến hạn cho client vừa online lại. | Hệ thống |
| FR-33 | Nhắc dai | Việc chưa xong thì chuông kêu lại mỗi 1–30 phút, tối đa 10 lần (gói Pro). | User, Hệ thống |

### 4.5. Thiết bị, thông báo, âm thanh

| ID | Chức năng | Mô tả | Actor |
|---|---|---|---|
| FR-34 | Đăng ký thiết bị | Lưu token thiết bị (Web/Android/iOS) để gửi thông báo đẩy. | Hệ thống |
| FR-35 | Quản lý thiết bị | Xem và gỡ thiết bị (soft delete để giữ lịch sử). | User |
| FR-36 | Đăng ký Web Push | Đăng ký/hủy subscription trình duyệt để chuông kêu khi đã đóng tab. | User |
| FR-37 | Cài đặt thông báo | Chọn âm thanh báo thức, thời gian hoãn mặc định, bật/tắt rung. | User |
| FR-38 | Âm thanh báo thức tự tải lên | Nhập/xóa/xem trước file âm thanh riêng (Plus/Pro). | User |
| FR-39 | Xem lịch sử thông báo | Xem lại các thông báo đã gửi/hoãn/tắt, có lọc thời gian & phân trang. | User |

### 4.6. Lịch và tổng quan

| ID | Chức năng | Mô tả | Actor |
|---|---|---|---|
| FR-40 | Xem lịch | Xem công việc theo lịch ngày/tuần/tháng. | User |
| FR-41 | Xuất lịch `.ics` | Lấy URL `.ics` có khóa riêng để dán vào Google Calendar/Outlook; có thể tạo lại khóa. | User |
| FR-42 | Xem dashboard cá nhân | Số việc hôm nay, quá hạn, hoàn thành, sắp tới. | User |
| FR-43 | Xem dashboard hệ thống | Số liệu tổng quan hệ thống (người dùng, công việc, thông báo hôm nay). | Admin |

### 4.7. Trợ lý AI

| ID | Chức năng | Mô tả | Actor |
|---|---|---|---|
| FR-44 | Nhập việc bằng câu tự nhiên | Phân tích câu tiếng Việt thành danh sách công việc (tiêu đề, hạn, ưu tiên, lặp, nhắc, danh mục). | User |
| FR-45 | Nhập việc bằng giọng nói | Dùng Web Speech API để đổ câu nói vào ô nhập (không tốn lượt AI). | User |
| FR-46 | Xem hạn mức AI | Xem số lượt AI còn lại hôm nay theo gói. | User |

### 4.8. Gói, thanh toán, điểm thưởng

| ID | Chức năng | Mô tả | Actor |
|---|---|---|---|
| FR-47 | Xem gói hiện tại | Xem gói, hạn dùng, lịch sử quyền lợi. | User |
| FR-48 | Dùng thử Pro | Kích hoạt 7 ngày Pro, mỗi tài khoản một lần. | User |
| FR-49 | Tạo đơn mua gói | Tạo đơn (mã `MNQ…`), sinh mã QR VietQR để chuyển khoản. | User |
| FR-50 | Kiểm tra đơn của tôi | Kiểm tra lại đơn và kéo giao dịch ngân hàng ngay. | User |
| FR-51 | Hủy đơn chưa thanh toán | Hủy đơn PENDING của chính mình. | User |
| FR-52 | Xác nhận thanh toán | Kích hoạt gói khi tiền về (webhook/API ngân hàng/admin xác nhận). | Hệ thống, Admin |
| FR-53 | Quản lý đơn hàng | Xem/lọc đơn, xác nhận, hủy, gán giao dịch ngân hàng chưa khớp. | Admin |
| FR-54 | Cấu hình nhận tiền | Đặt ngân hàng/số tài khoản, xoay mã xác thực webhook, test webhook, test kết nối, đồng bộ ngay. | Admin |
| FR-55 | Điểm thưởng | Tích điểm đăng nhập/chuỗi ngày/mời bạn; xem lịch sử điểm. | User |
| FR-56 | Mã mời bạn bè | Có mã mời riêng; nhận điểm khi người được mời đăng nhập lần đầu. | User |
| FR-57 | Đổi điểm lấy gói | Đổi điểm thành ngày dùng Plus/Pro. | User |
| FR-58 | Báo cáo tuần qua email | Bật/tắt và gửi thử báo cáo tuần (quyền lợi gói Pro). | User |

### 4.9. Giao việc, luân phiên, gói Doanh nghiệp

| ID | Chức năng | Mô tả | Actor |
|---|---|---|---|
| FR-59 | Giao việc cho người khác | Nhờ một tài khoản khác làm hộ việc (tối đa 5 người/việc) — quyền lợi Pro. | User |
| FR-60 | Thu hồi giao việc | Gỡ người được giao khỏi công việc. | User |
| FR-61 | Xem việc được giao | Xem danh sách việc người khác nhờ mình làm. | User |
| FR-62 | Đánh dấu xong phần của tôi | Người được giao đánh dấu hoàn thành phần của mình. | User |
| FR-63 | Bật/tắt luân phiên | Xoay người chịu trách nhiệm mỗi kỳ theo thứ tự giao việc. | User |
| FR-64 | Quản lý gói Doanh nghiệp | Mời/gỡ thành viên (tối đa 10 ghế), tự rời nhóm, xem bảng tiến độ cả nhà. | User |
| FR-65 | Chia sẻ tiến độ | Người trong nhà tự bật/tắt việc chủ gói xem được tiến độ của mình. | User |

### 4.10. Báo cáo & kế hoạch tuần

| ID | Chức năng | Mô tả | Actor |
|---|---|---|---|
| FR-66 | Xem báo cáo năng suất | Số liệu 7/30/90 ngày: việc xong, đúng hạn, theo giờ/thứ/danh mục, tồn đọng. | User |
| FR-67 | Xuất báo cáo | Xuất nội dung file CSV (tối đa 2.000 dòng). | User |
| FR-68 | Xem kế hoạch tuần | Xếp việc vào 7 ngày tới theo năng lực mỗi ngày, cảnh báo việc sẽ trễ. | User |

### 4.11. Hỗ trợ & quản trị

| ID | Chức năng | Mô tả | Actor |
|---|---|---|---|
| FR-69 | Chat hỗ trợ | Người dùng gửi tin nhắn (kèm tối đa 3 ảnh) cho admin; xem lịch sử hội thoại. | User |
| FR-70 | Trả lời hỗ trợ | Admin xem danh sách hội thoại, trả lời, đánh dấu đã đọc, đổi trạng thái. | Admin |
| FR-71 | Quản lý người dùng | Xem/tìm kiếm người dùng; khóa/mở khóa; đổi gói; xóa tài khoản. | Admin |

## 5. Non-functional Requirements

| Nhóm | ID | Yêu cầu |
|---|---|---|
| Security | NFR-01 | Mật khẩu lưu dưới dạng băm (bcrypt); không lưu mật khẩu gốc. |
| Security | NFR-02 | Phân quyền theo vai trò: Guest/User/Admin chỉ truy cập chức năng được cấp. |
| Security | NFR-03 | Người dùng chỉ xem/sửa/xóa dữ liệu thuộc sở hữu của mình (việc, danh mục, nhắc nhở, thiết bị). |
| Security | NFR-04 | Admin bắt buộc đăng nhập mới vào được khu vực quản trị. |
| Security | NFR-05 | Dữ liệu đầu vào được kiểm tra hợp lệ (express-validator) trước khi lưu. |
| Security | NFR-06 | Webhook thanh toán phải xác thực bằng mã bí mật và chống xử lý trùng. |
| Security | NFR-07 | Khoá lịch `.ics`, refresh token và mã xác thực webhook là dữ liệu nhạy cảm, phải xoay được. |
| Security | NFR-08 | Email thông báo/quên mật khẩu phải gửi từ tên miền riêng đã xác thực SPF/DKIM. |
| Reliability | NFR-09 | Nhắc nhở phải kích hoạt đúng thời điểm (sai lệch ≤ 1 phút trong điều kiện bình thường). |
| Reliability | NFR-10 | Nếu thiết bị mất kết nối tại thời điểm nhắc, hệ thống phải hiển thị lại khi thiết bị online (endpoint reminder đến hạn). |
| Reliability | NFR-11 | Scheduler và các việc định kỳ phải chạy lại được sau khi máy chủ ngủ (qua nhịp `/health`). |
| Reliability | NFR-12 | Hạn mức gửi email của dịch vụ ngoài phải được kiểm tra trước khi gửi. |
| Performance | NFR-13 | Danh sách công việc, lịch và dashboard phản hồi trong vài giây ở điều kiện bình thường. |
| Performance | NFR-14 | Danh sách và lịch sử thông báo hỗ trợ phân trang/tải theo khoảng thời gian. |
| Performance | NFR-15 | Báo cáo và xuất file giới hạn số dòng để tránh tải quá nhiều dữ liệu. |
| Availability | NFR-16 | Hệ thống hoạt động ổn định trong thời gian trình diễn và kiểm thử. |
| Availability | NFR-17 | Khi lỗi, hệ thống trả thông báo thân thiện và không để người dùng tiếp tục thao tác trên dữ liệu không hợp lệ. |
| Maintainability | NFR-18 | Mã nguồn chia theo module nghiệp vụ rõ ràng (layered: route → controller → service → repository). |
| Maintainability | NFR-19 | Thuật ngữ trạng thái, thông báo và quy tắc nghiệp vụ nhất quán giữa Web và app di động. |
| Maintainability | NFR-20 | Toàn bộ cấu hình gói (giá, hạn mức) tập trung một nơi để web và app không lệch nhau. |
| Usability | NFR-21 | Giao diện dùng được trên máy tính, máy tính bảng và điện thoại; có chế độ tối và song ngữ Việt/Anh. |
| Usability | NFR-22 | Thao tác quan trọng (tạo việc, thiết lập nhắc nhở, hoãn/tắt báo thức) dễ làm trên màn hình nhỏ. |
| Backup | NFR-23 | Dữ liệu nghiệp vụ quan trọng được sao lưu định kỳ bằng công cụ có sẵn (`db:dump`/`db:restore`). |
| Logging | NFR-24 | Hệ thống ghi nhận lỗi, lịch sử gửi thông báo, sự kiện thanh toán và hoạt động đối soát. |

## 6. Use Case List

### 6.1. Guest

| ID | Use Case | Mô tả ngắn |
|---|---|---|
| UC-G-01 | Xem trang giới thiệu | Xem nội dung tổng quan. |
| UC-G-02 | Xem bảng giá | Xem 4 gói và quyền lợi. |
| UC-G-03 | Đăng ký (xác thực email) | Nhận mã và tạo tài khoản. |
| UC-G-04 | Đăng nhập | Đăng nhập bằng mật khẩu hoặc Google. |
| UC-G-05 | Quên/Đặt lại mật khẩu | Lấy lại quyền truy cập. |

### 6.2. User

| ID | Use Case | Mô tả ngắn |
|---|---|---|
| UC-U-01 | Xem/cập nhật hồ sơ | Xem và sửa thông tin cá nhân. |
| UC-U-02 | Đổi mật khẩu | Đổi mật khẩu tài khoản. |
| UC-U-03 | Quản lý danh mục | Thêm, sửa, ẩn/hiện danh mục. |
| UC-U-04 | Tạo công việc | Tạo việc kèm hạn, danh mục, ưu tiên. |
| UC-U-05 | Xem danh sách/chi tiết công việc | Xem theo nhiều tiêu chí. |
| UC-U-06 | Cập nhật công việc | Sửa thông tin việc. |
| UC-U-07 | Đánh dấu hoàn thành / Mở lại | Chuyển trạng thái việc. |
| UC-U-08 | Hủy / Xóa / Khôi phục công việc | Hủy, xóa vào thùng rác, khôi phục. |
| UC-U-09 | Dọn thùng rác | Xóa vĩnh viễn việc trong thùng rác. |
| UC-U-10 | Quản lý việc con | Thêm, sửa, toggle, xóa việc con. |
| UC-U-11 | Thiết lập lặp lại | Chọn chu kỳ lặp. |
| UC-U-12 | Thiết lập nhắc nhở | Thêm, sửa, xóa nhắc nhở. |
| UC-U-13 | Nhận báo thức | Nhận chuông/rung/màn hình báo thức. |
| UC-U-14 | Hoãn báo thức | Dời nhắc nhở sang sau. |
| UC-U-15 | Tắt báo thức | Tắt hẳn báo thức. |
| UC-U-16 | Bật nhắc dai | Bật chế độ nhắc lại tới khi xác nhận (Pro). |
| UC-U-17 | Cài đặt thông báo & âm thanh | Chọn âm thanh, hoãn mặc định, rung, âm thanh riêng. |
| UC-U-18 | Quản lý thiết bị & Web Push | Đăng ký/gỡ thiết bị và subscription trình duyệt. |
| UC-U-19 | Xem lịch sử thông báo | Xem lại thông báo đã gửi/hoãn/tắt. |
| UC-U-20 | Tìm kiếm/lọc công việc | Tìm và lọc theo nhiều tiêu chí. |
| UC-U-21 | Xem lịch | Xem lịch ngày/tuần/tháng. |
| UC-U-22 | Xuất lịch `.ics` | Lấy URL lịch cho Google/Outlook. |
| UC-U-23 | Xem dashboard cá nhân | Xem số liệu tổng quan. |
| UC-U-24 | Dùng trợ lý AI | Nhập việc bằng câu/giọng nói. |
| UC-U-25 | Xem kế hoạch tuần (Pro) | Xem việc nên làm mỗi ngày trong tuần. |
| UC-U-26 | Xem báo cáo năng suất (Pro) | Xem và xuất số liệu năng suất. |
| UC-U-27 | Giao việc cho người khác (Pro) | Nhờ người khác làm hộ. |
| UC-U-28 | Xem việc được giao | Xem và đánh dấu xong phần của mình. |
| UC-U-29 | Bật luân phiên người làm (Pro) | Xoay người chịu trách nhiệm mỗi kỳ. |
| UC-U-30 | Quản lý gói Pro Doanh nghiệp | Mời, gỡ, rời nhóm, xem bảng cả nhà. |
| UC-U-31 | Mua gói / dùng thử | Tạo đơn, thanh toán, kích hoạt, hủy đơn. |
| UC-U-32 | Tích & đổi điểm thưởng | Xem điểm, mã mời, đổi thưởng. |
| UC-U-33 | Bật/tắt báo cáo tuần | Bật/tắt và gửi thử email báo cáo tuần. |
| UC-U-34 | Chat hỗ trợ | Gửi tin nhắn cho admin. |

### 6.3. Admin

| ID | Use Case | Mô tả ngắn |
|---|---|---|
| UC-A-01 | Đăng nhập quản trị | Đăng nhập vào khu vực quản trị. |
| UC-A-02 | Xem dashboard hệ thống | Xem số liệu tổng quan. |
| UC-A-03 | Quản lý người dùng | Tạo, khóa/mở, đổi gói, xóa tài khoản. |
| UC-A-04 | Quản lý đơn hàng | Xem/lọc, xác nhận, hủy đơn, gán giao dịch ngân hàng. |
| UC-A-05 | Cấu hình thanh toán | Đặt tài khoản nhận tiền, xoay mã webhook, test, đồng bộ ngân hàng. |
| UC-A-06 | Quản lý hỗ trợ | Xem, trả lời hội thoại, đánh dấu đã đọc, đổi trạng thái. |

## 7. User Story

### 7.1. Guest

| ID | User Story |
|---|---|
| US-G-01 | As a Guest, I want to xem giới thiệu và bảng giá, so that I can quyết định có nên dùng MN-Qronx. |
| US-G-02 | As a Guest, I want to đăng ký có xác thực email, so that tài khoản của tôi gắn với email thật. |
| US-G-03 | As a Guest, I want to đăng nhập bằng Google, so that tôi vào app nhanh không phải nhớ mật khẩu. |
| US-G-04 | As a Guest, I want to đặt lại mật khẩu, so that tôi lấy lại được quyền truy cập khi quên. |

### 7.2. User

| ID | User Story |
|---|---|
| US-U-01 | As a User, I want to tạo việc kèm thời hạn, so that tôi không quên việc cần làm. |
| US-U-02 | As a User, I want to phân loại việc theo danh mục, so that tôi theo dõi từng mảng công việc. |
| US-U-03 | As a User, I want to thiết lập nhiều nhắc nhở, so that tôi có thời gian chuẩn bị trước hạn. |
| US-U-04 | As a User, I want to được báo thức bằng âm thanh và rung kể cả khi đã đóng trình duyệt, so that tôi không bỏ lỡ việc quan trọng. |
| US-U-05 | As a User, I want to hoãn hoặc tắt báo thức, so that app không làm phiền tôi sai lúc. |
| US-U-06 | As a Pro user, I want to bật nhắc dai, so that việc quan trọng chưa xong thì app còn nhắc tôi. |
| US-U-07 | As a User, I want to thiết lập việc lặp lại, so that tôi không phải tạo lại việc định kỳ. |
| US-U-08 | As a User, I want to xóa nhầm và khôi phục được việc, so that tôi không mất dữ liệu. |
| US-U-09 | As a User, I want to nhập việc bằng một câu nói, so that tôi tạo việc nhanh hơn. |
| US-U-10 | As a User, I want to xuất lịch sang Google Calendar, so that việc của tôi hiện chung với lịch khác. |
| US-U-11 | As a Pro user, I want to xem báo cáo năng suất, so that tôi biết mình làm tốt tới đâu. |
| US-U-12 | As a Pro user, I want to xem kế hoạch tuần, so that tôi biết hôm nay nên làm gì và khi nào tuần quá tải. |
| US-U-13 | As a Pro user, I want to nhờ người khác làm một việc, so that việc chung không bị bỏ quên. |
| US-U-14 | As a User, I want to thấy việc người khác nhờ tôi và đánh dấu xong, so that tôi biết mình cần làm gì. |
| US-U-15 | As a User, I want to xem trạng thái đơn và hạn gói, so that tôi biết khi nào cần gia hạn. |
| US-U-16 | As a User, I want to tích điểm và đổi thành ngày dùng Pro, so that tôi được dùng thử tính năng trả phí. |
| US-U-17 | As a User, I want to chat với hỗ trợ ngay trong app, so that tôi không phải rời app để hỏi. |
| US-U-18 | As a Pro family owner, I want to mời người nhà dùng chung gói, so that cả nhà đều có quyền Pro. |

### 7.3. Admin

| ID | User Story |
|---|---|
| US-A-01 | As an Admin, I want to xem dashboard hệ thống, so that tôi nắm tình hình chung. |
| US-A-02 | As an Admin, I want to quản lý tài khoản người dùng, so that tôi khóa được tài khoản bất thường. |
| US-A-03 | As an Admin, I want to đối soát đơn và xác nhận thanh toán, so that khách được mở gói đúng lúc. |
| US-A-04 | As an Admin, I want to cấu hình tài khoản nhận tiền và webhook ngay trong app, so that đổi ngân hàng không cần deploy. |
| US-A-05 | As an Admin, I want to trả lời hội thoại hỗ trợ, so that khách được giúp kịp thời. |

## 8. Business Rules

### 8.1. Tài khoản & xác thực

| ID | Business Rule |
|---|---|
| BR-01 | Mỗi tài khoản phải có một email duy nhất; email đăng ký phải đúng định dạng. |
| BR-02 | Đăng ký chỉ thành công khi mã xác nhận email còn hiệu lực và chưa dùng. |
| BR-03 | Mật khẩu không được lưu dạng gốc; phải băm bằng bcrypt. |
| BR-04 | Tài khoản bị khóa (`isActive = false`) không được đăng nhập hoặc nhận thông báo mới. |
| BR-05 | Đổi mật khẩu hoặc đăng xuất phải thu hồi refresh token tương ứng. |
| BR-06 | Guest phải đăng nhập thành công trước khi tạo/quản lý việc, danh mục, nhắc nhở. |

### 8.2. Công việc

| ID | Business Rule |
|---|---|
| BR-07 | Người dùng chỉ xem/sửa/xóa dữ liệu thuộc sở hữu của chính mình. |
| BR-08 | Tiêu đề công việc không được để trống; thời hạn `dueAt` là bắt buộc. |
| BR-09 | Trạng thái công việc chỉ nhận: `TODO`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`. |
| BR-10 | Mức ưu tiên chỉ nhận: `LOW`, `MEDIUM`, `HIGH`, `URGENT`. |
| BR-11 | Quy tắc lặp chỉ nhận: `NONE`, `DAILY`, `WEEKLY`, `MONTHLY`; `WEEKLY` có thể kèm danh sách thứ (ISO 1–7). |
| BR-12 | "Quá hạn" là trạng thái hiển thị, tính từ `dueAt < hiện tại` và trạng thái khác Hoàn thành/Đã hủy; không lưu trong dữ liệu. |
| BR-13 | Xóa công việc là **soft delete**: đặt `deletedAt`, giữ 30 ngày, sau đó scheduler xóa vĩnh viễn. |
| BR-14 | Công việc trong thùng rác không xuất hiện ở danh sách, dashboard, báo cáo và kế hoạch tuần. |
| BR-15 | Khi công việc chuyển sang Hoàn thành/Đã hủy, mọi nhắc nhở chưa kích hoạt của việc đó phải bị hủy. |
| BR-16 | Khi việc lặp lại được đánh dấu Hoàn thành, hệ thống tạo bản ghi kế tiếp với `parentTaskId` trỏ về bản vừa xong, giữ nguyên danh mục, ưu tiên, quy tắc lặp và cấu hình nhắc nhở theo hạn mới. |
| BR-17 | Việc có `parentTaskId` phải thuộc cùng chủ sở hữu với việc cha. |
| BR-18 | Người dùng có thể sửa giới hạn tạo việc theo gói; vượt giới hạn thì báo lỗi kèm chỉ dẫn nâng cấp. |

### 8.3. Nhắc nhở & báo thức

| ID | Business Rule |
|---|---|
| BR-19 | `remindAt` phải ≤ `dueAt` của công việc. |
| BR-20 | Số nhắc nhở mỗi việc theo gói: Miễn phí 3, Plus/Pro/Pro Doanh nghiệp 5. |
| BR-21 | Trạng thái nhắc nhở chỉ nhận: `SCHEDULED`, `TRIGGERED`, `SNOOZED`, `DISMISSED`, `CANCELLED`. |
| BR-22 | Mỗi báo thức chỉ được hoãn tối đa 3 lần liên tiếp; sau đó chỉ còn Tắt. |
| BR-23 | Mọi lần gửi/hoãn/tắt phải ghi vào lịch sử thông báo (`SENT`, `SNOOZED`, `DISMISSED`). |
| BR-24 | Nhắc dai chỉ dành cho gói Pro; chu kỳ hợp lệ là 1, 2, 5, 10, 15, 30 phút; tối đa 10 lần nhắc lại mỗi chu kỳ. |
| BR-25 | Hết hạn gói Pro thì việc cũ không tiếp tục nhắc dai. |
| BR-26 | Khi bật nhắc dai mà việc đã Hoàn thành/Đã hủy thì không nhắc lại. |

### 8.4. Thiết bị & thông báo

| ID | Business Rule |
|---|---|
| BR-27 | Mỗi `deviceToken` gắn với đúng một tài khoản tại một thời điểm. |
| BR-28 | Gỡ thiết bị là soft delete (`isActive = false`) để giữ lịch sử thông báo. |
| BR-29 | Số thiết bị đồng bộ theo gói: Miễn phí 2, Plus 5, Pro/Pro Doanh nghiệp không giới hạn. |
| BR-30 | Mỗi người dùng có tối đa 6 Web Push subscription; endpoint trả 404/410 sẽ bị xóa tự động. |
| BR-31 | Mỗi người dùng có đúng một cấu hình thông báo (`NotificationSetting`). |
| BR-32 | Âm thanh báo thức tự tải lên chỉ dùng được với gói trả phí; hết hạn gói thì âm thanh tùy chỉnh trở về chuông mặc định. |

### 8.5. Danh mục

| ID | Business Rule |
|---|---|
| BR-33 | Cặp (`userId`, `categoryName`) là duy nhất. |
| BR-34 | Danh mục bị ẩn không xóa cứng các công việc đã gán; công việc vẫn hiển thị dưới dạng "Không phân loại". |

### 8.6. Gói, thanh toán, điểm thưởng

| ID | Business Rule |
|---|---|
| BR-35 | Gói trả phí hết hạn được tính như Miễn phí ngay lập tức, và scheduler hạ gói vĩnh viễn. |
| BR-36 | Kỳ đăng ký: tháng 30 ngày, năm 365 ngày (tặng 2 tháng). Mua khi đang còn hạn cùng gói thì cộng dồn. |
| BR-37 | Mỗi tài khoản chỉ được **dùng thử Pro 7 ngày một lần**. |
| BR-38 | Mỗi đơn hàng có mã đơn duy nhất (`MNQ` + 8 ký tự), dùng làm nội dung chuyển khoản. |
| BR-39 | Webhook thanh toán phải xác thực mã bí mật và mỗi sự kiện chỉ được xử lý **một lần** (chống trùng theo mã ngoài). |
| BR-40 | Điểm thưởng: đăng nhập hằng ngày +10 (mỗi ngày một lần); chuỗi 7 ngày liên tiếp +50; mời bạn thành công +100. |
| BR-41 | Chống lạm dụng mời bạn: cùng người mời + cùng IP + cùng thiết bị chỉ tính một tài khoản. |
| BR-42 | Đổi điểm đi qua đúng luồng cấp gói: có bản ghi `Subscription`, có cộng dồn, và không hạ gói Pro Doanh nghiệp. |
| BR-43 | Gói Pro Doanh nghiệp dùng chung cho tối đa 10 ghế (chủ gói + 9 người dùng ké). |
| BR-44 | Một tài khoản chỉ nằm trong đúng một gói Doanh nghiệp, và không được mời người đang trả phí riêng. |
| BR-45 | Chủ gói Doanh nghiệp hết hạn ⇒ mọi chỗ được cấp mất quyền ngay; khi chủ gia hạn phải mời lại. |
| BR-46 | Người trong nhóm có thể tự tắt chia sẻ tiến độ cho chủ gói, và tự rời nhóm bất cứ lúc nào. |
| BR-47 | Báo cáo tuần qua email gửi mỗi tuần tối đa một lần cho mỗi tài khoản; nút "gửi thử" bị chặn bấm liên tục để giữ hạn mức email. |

### 8.7. Giao việc & luân phiên

| ID | Business Rule |
|---|---|
| BR-48 | Chỉ gói Pro được **giao việc**; người nhận không cần gói trả phí. |
| BR-49 | Mỗi việc giao tối đa 5 người nhận; mỗi tài khoản tối đa 50 việc đang giao đi. |
| BR-50 | Người nhận chỉ được đánh dấu "xong phần của tôi"; không được sửa/xóa công việc. |
| BR-51 | Công việc chỉ hoàn thành khi **chủ việc** bấm hoàn thành. |
| BR-52 | Luân phiên xoay người theo thứ tự giao việc; người đến lượt kỳ sau được tính lại sau mỗi kỳ; người bị gỡ khỏi việc không giữ lượt. |
| BR-53 | Không thể giao việc cho chính mình, cho người chưa có tài khoản, hoặc cho việc đã Hoàn thành/Đã hủy. |

### 8.8. AI, báo cáo, kế hoạch, hỗ trợ, quản trị

| ID | Business Rule |
|---|---|
| BR-54 | Hạn mức AI theo ngày (theo múi giờ Việt Nam): Miễn phí 5, Plus 50, Pro/Pro Doanh nghiệp không giới hạn. Lượt chỉ bị trừ sau khi AI trả kết quả thành công. |
| BR-55 | Chỉ số báo cáo luôn loại việc trong thùng rác; ngày/giờ tính theo giờ Việt Nam; "đúng hạn" = `completedAt ≤ dueAt`. |
| BR-56 | Kế hoạch tuần xếp bằng luật (không dùng AI), năng lực mỗi ngày chọn trong 3/5/8/10; việc không còn chỗ trước hạn phải xuất hiện trong danh sách cảnh báo trễ. |
| BR-57 | Mỗi người dùng có đúng một hội thoại hỗ trợ; mỗi tin nhắn kèm tối đa 3 ảnh. |
| BR-58 | Admin không được xem nội dung công việc cá nhân của người dùng; chỉ thao tác trên tài khoản, đơn hàng và hội thoại hỗ trợ. |
| BR-59 | Tài khoản Admin không thể bị xóa qua chức năng xóa người dùng. |

## 9. Entity nghiệp vụ

| Entity | Chức năng nghiệp vụ |
|---|---|
| Role | Vai trò của người dùng: USER hoặc ADMIN. |
| User | Tài khoản: thông tin đăng nhập, hồ sơ, gói hiện tại, hạn gói, điểm thưởng, mã mời, thời điểm đăng nhập gần nhất. |
| PasswordResetRequest | Yêu cầu đặt lại mật khẩu (token, hạn dùng, trạng thái đã dùng). |
| EmailVerificationCode | Mã xác thực email khi đăng ký. |
| Category | Danh mục công việc của người dùng (tên, màu, ẩn/hiện). |
| Task | Công việc: tiêu đề, mô tả, danh mục, ưu tiên, trạng thái, hạn, quy tắc lặp, nhắc dai, luân phiên, thùng rác. |
| Subtask | Việc con trong một công việc. |
| Reminder | Thời điểm nhắc nhở và vòng đời trạng thái; số lần hoãn và số lần nhắc lại. |
| Device | Thiết bị nhận thông báo đẩy. |
| WebPushSubscription | Đăng ký Web Push của trình duyệt. |
| NotificationSetting | Cấu hình thông báo cá nhân (âm thanh, hoãn mặc định, rung). |
| NotificationLog | Lịch sử mỗi lần gửi/hoãn/tắt thông báo. |
| CustomSound | Âm thanh báo thức tự tải lên. |
| AppSetting | Cấu hình hệ thống dạng khóa/giá trị (thí dụ khóa VAPID tự sinh). |
| RefreshToken | Phiên đăng nhập (token làm mới). |
| PointTransaction | Lịch sử cộng/trừ điểm thưởng. |
| Invitation | Lời mời bạn bè và trạng thái kích hoạt. |
| TaskShare | Giao việc cho người khác và trạng thái xong phần của người nhận. |
| FamilyMember | Ghế trong một gói Pro Doanh nghiệp (model/bảng vẫn mang tên family). |
| Subscription | Lịch sử quyền lợi theo gói (nguồn sự thật về hạn dùng). |
| PaymentOrder | Đơn mua gói và trạng thái thanh toán. |
| BillingEvent | Nhật ký sự kiện thanh toán (chống xử lý trùng webhook). |
| BillingSetting | Cấu hình nhận tiền và API/webhook ngân hàng. |
| AiUsage | Hạn mức dùng trợ lý AI theo ngày. |
| SupportConversation | Hội thoại hỗ trợ giữa người dùng và admin. |
| SupportMessage | Tin nhắn trong hội thoại hỗ trợ. |
| SupportAttachment | Ảnh gửi kèm trong hội thoại hỗ trợ. |

### 9.1. Quan hệ nghiệp vụ chính

- Một `Role` gán cho nhiều `User`; mỗi `User` thuộc một `Role`.
- Một `User` có nhiều `Category`, `Task`, `Device`, `WebPushSubscription`, `RefreshToken`, `PointTransaction`, `PaymentOrder`, `Subscription` và đúng một `NotificationSetting`.
- Một `Category` có nhiều `Task`; một `Task` thuộc một `Category` hoặc không có danh mục.
- Một `Task` có nhiều `Subtask`, nhiều `Reminder` và nhiều `TaskShare`; một `Task` có thể sinh ra `Task` kế tiếp qua `parentTaskId`.
- Một `Reminder` sinh ra nhiều `NotificationLog` (mỗi lần gửi tới từng thiết bị).
- Một `PaymentOrder` có thể phát sinh nhiều `BillingEvent`; khi xác nhận thì sinh một `Subscription`.
- Một `User` (chủ gói) có nhiều `FamilyMember`; một `User` chỉ có tối đa một tư cách thành viên trong nhà khác.
- Một `User` có đúng một `SupportConversation`, chứa nhiều `SupportMessage`, mỗi tin nhắn có thể có nhiều `SupportAttachment`.

## 10. Module hệ thống

| Module | Trách nhiệm |
|---|---|
| Authentication | Đăng ký (xác thực email), đăng nhập mật khẩu/Google, làm mới token, đăng xuất, quên/đặt lại mật khẩu, phân quyền. |
| User | Hồ sơ, đổi mật khẩu, thống kê cá nhân, hoạt động gần đây, báo cáo tuần qua email, âm thanh riêng, khóa lịch `.ics`. |
| Category | Quản lý danh mục công việc. |
| Task | Tạo/xem/sửa/xóa (thùng rác)/hoàn thành/mở lại/hủy, việc con, lặp lại, nhắc dai, luân phiên, tìm kiếm & lọc. |
| Reminder & Notification | Lên lịch, kích hoạt, gửi (Web Push/FCM), hoãn/tắt, nhắc dai, lịch sử thông báo. |
| Device | Thiết bị, Web Push subscription, cài đặt thông báo & âm thanh. |
| Calendar | Xem lịch trong app và xuất feed `.ics`. |
| Dashboard | Số liệu tổng quan cá nhân và hệ thống. |
| AI | Phân tích câu thành công việc, hạn mức theo ngày, nhập bằng giọng nói. |
| Plans & Billing | Danh mục gói, đơn hàng, VietQR, webhook/API ngân hàng, subscription, dùng thử, hạ gói hết hạn. |
| Rewards | Điểm, chuỗi đăng nhập, mã mời, đổi thưởng. |
| Sharing & Family | Giao việc, luân phiên, gói Pro Doanh nghiệp. |
| Reports & Planner | Báo cáo năng suất, xuất file, kế hoạch tuần. |
| Support | Hội thoại hỗ trợ người dùng ↔ admin. |
| Admin | Dashboard, quản lý người dùng, đối soát thanh toán, cấu hình nhận tiền. |

## 11. Danh sách màn hình

### 11.1. Màn hình Guest

| ID | Màn hình | Đường dẫn | Nội dung chính |
|---|---|---|---|
| SCR-G-01 | Trang giới thiệu | `/` | Giới thiệu, tính năng nổi bật, CTA đăng ký/đăng nhập. |
| SCR-G-02 | Bảng giá | `/pricing` | 4 gói, giá tháng/năm, quyền lợi, hạn mức. |
| SCR-G-03 | Đăng ký | `/register` | Họ tên, email, mật khẩu + bước nhập mã xác nhận email. |
| SCR-G-04 | Đăng nhập | `/login` | Email/mật khẩu, nút đăng nhập Google, link quên mật khẩu. |
| SCR-G-05 | Quên mật khẩu | `/forgot-password` | Nhập email để nhận liên kết đặt lại. |
| SCR-G-06 | Đặt lại mật khẩu | `/reset-password` | Đặt mật khẩu mới bằng token trong email. |
| SCR-G-07 | Callback OAuth | `/oauth-callback` | Nhận token từ Google và chuyển vào app. |

### 11.2. Màn hình User

| ID | Màn hình | Đường dẫn | Nội dung chính |
|---|---|---|---|
| SCR-U-01 | Dashboard cá nhân | `/app` | Thẻ số liệu (hôm nay/quá hạn/hoàn thành/sắp tới), việc gần đây, tạo nhanh. |
| SCR-U-02 | Danh sách công việc | `/app/tasks` | Danh sách, tìm kiếm, lọc, phân trang; tab thùng rác. |
| SCR-U-03 | Chi tiết công việc | `/app/tasks/:id` | Thông tin, việc con, nhắc nhở, người được giao, luân phiên. |
| SCR-U-04 | Thêm/Sửa công việc | `/app/tasks/new`, `/app/tasks/:id/edit` | Form đầy đủ: tiêu đề, mô tả, danh mục, ưu tiên, hạn, lặp, nhắc nhở, nhắc dai. |
| SCR-U-05 | Lịch | `/app/calendar` | Lịch ngày/tuần/tháng + link xuất `.ics`. |
| SCR-U-06 | Danh mục | `/app/categories` | Danh sách, thêm/sửa/ẩn danh mục, chọn màu. |
| SCR-U-07 | Màn hình báo thức | (overlay toàn cục) | Chuông, màu theo ưu tiên, nút Hoãn/Tắt. |
| SCR-U-08 | Lịch sử thông báo | `/app/notifications` | Danh sách thông báo đã gửi/hoãn/tắt, lọc thời gian. |
| SCR-U-09 | Hồ sơ cá nhân | `/app/profile` | Họ tên, email, điện thoại, ảnh; thống kê & hoạt động gần đây. |
| SCR-U-10 | Đổi mật khẩu | `/app/change-password` | Mật khẩu hiện tại & mới. |
| SCR-U-11 | Cài đặt | `/app/settings` | Âm thanh, hoãn mặc định, rung, thiết bị, Web Push, tùy chọn báo cáo tuần. |
| SCR-U-12 | Gói & thanh toán | `/app/billing` | Gói hiện tại, mua gói, mã QR, trạng thái đơn, dùng thử. |
| SCR-U-13 | Trợ lý AI | `/app/ai` | Ô nhập/nói, xem trước công việc nhận diện, hạn mức còn lại. |
| SCR-U-14 | Điểm thưởng | `/app/rewards` | Điểm, chuỗi đăng nhập, mã mời, bảng đổi thưởng, lịch sử. |
| SCR-U-15 | Báo cáo năng suất | `/app/reports` | Biểu đồ 7/30/90 ngày, tỉ lệ đúng hạn, xuất CSV. |
| SCR-U-16 | Kế hoạch tuần | `/app/planner` | Xếp việc 7 ngày, cảnh báo quá tải, chọn năng lực/ngày. |
| SCR-U-17 | Việc được giao | `/app/assigned` | Việc người khác nhờ, đánh dấu xong phần của mình. |
| SCR-U-18 | Cả nhà | `/app/family` | Mời/gỡ thành viên, bảng tiến độ, chia sẻ tiến độ, rời nhóm. |
| SCR-U-19 | Hỗ trợ | `/app/support` | Chat với admin, gửi ảnh. |

### 11.3. Màn hình Admin

| ID | Màn hình | Đường dẫn | Nội dung chính |
|---|---|---|---|
| SCR-A-01 | Dashboard hệ thống | `/admin` | Tổng số người dùng, công việc, thông báo hôm nay. |
| SCR-A-02 | Quản lý người dùng | `/admin/users` | Danh sách, tìm kiếm, khóa/mở, đổi gói, xóa. |
| SCR-A-03 | Quản lý đơn hàng | `/admin/orders` | Danh sách/lọc đơn, xác nhận, hủy, gán giao dịch, cấu hình nhận tiền. |
| SCR-A-04 | Hỗ trợ khách hàng | `/admin/support` | Danh sách hội thoại, trả lời, đổi trạng thái. |

## 12. Kết luận

Tài liệu Business Analysis của **MN-Qronx** mô tả ứng dụng quản lý thời gian và công việc cá nhân với điểm khác biệt cốt lõi là **cơ chế nhắc nhở kiểu báo thức**, đã mở rộng thành sản phẩm freemium hoàn chỉnh: gói trả phí, trợ lý AI, giao việc, gói Pro Doanh nghiệp, điểm thưởng và chăm sóc khách hàng.

Các quy tắc trọng tâm đã thống nhất xuyên suốt tài liệu:

- Nhắc nhở phải kích hoạt đúng giờ, kèm âm thanh/rung và thông báo hệ thống kể cả khi đã đóng trình duyệt; người dùng Hoãn (tối đa 3 lần) hoặc Tắt.
- Gói Pro có **nhắc dai** (tối đa 10 lần nhắc lại, chu kỳ 1–30 phút) — dừng ngay khi việc xong.
- Việc chuyển sang Hoàn thành/Đã hủy sẽ hủy mọi nhắc nhở chưa kích hoạt.
- Xóa việc là soft delete: giữ 30 ngày trong thùng rác rồi mới xóa vĩnh viễn.
- Mỗi công việc thuộc một chủ sở hữu; giao việc chỉ tạo bản ghi chia sẻ, người nhận không sửa/xóa được.
- Gói Pro Doanh nghiệp cho tối đa 10 ghế với quyền lợi y hệt Pro.
- Mọi lần gửi thông báo, mọi sự kiện thanh toán đều được ghi log để tra cứu và chống xử lý trùng.

Các bước tiếp theo được đề xuất:

1. Bổ sung Use Case/Activity Diagram cho các luồng mới (thanh toán, giao việc, gói Doanh nghiệp, hỗ trợ) — xem `02_MN-Qronx_Diagrams.md`.
2. Giữ ERD và thiết kế cơ sở dữ liệu đồng bộ với `backend/prisma/schema.prisma` — xem `03`, `04`.
3. Mở rộng đặc tả API theo danh sách endpoint thực tế — xem `05`.
4. Hoàn thiện UI/UX cho màn hình báo thức, kế hoạch tuần và đối soát đơn — xem `06`.
5. Phát triển app di động tái dùng lớp `services/` và lớp kiểm tra quyền lợi gói.
6. Tăng cường kiểm thử tự động cho các luồng thanh toán, gói Doanh nghiệp, giao việc và nhắc dai (đã có bộ test Vitest trong `backend/tests/`).
