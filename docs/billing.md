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
| Pro | 79.000đ | 790.000đ | **Nhắc dai tới khi xác nhận**, **báo cáo năng suất + xuất Excel/PDF**, **kế hoạch tuần**, **báo cáo tuần qua email**, **nhờ người khác làm**, không giới hạn AI/thiết bị, toàn bộ âm thanh + âm thanh riêng |
| Pro Gia đình | 199.000đ | 1.990.000đ | **Toàn bộ quyền lợi Pro cho tới 4 tài khoản** trong nhà — mỗi người vẫn là một tài khoản riêng, trả một lần cho cả nhà |

**Điểm bán riêng của Pro: “nhắc dai tới khi bạn xác nhận”.** Free/Plus chuông kêu
một lần, bỏ qua là quên; Pro thì việc chưa xong sẽ kêu lại theo chu kỳ người dùng
chọn (1/2/5/10/15/30 phút, tối đa 10 lần) cho tới khi bấm **Xong** — lúc đó mọi
nhắc nhở của việc bị huỷ nên chuông tự im. Đây là thứ khách cảm nhận được ngay
chứ không phải kiểu “nới trần” mà người dùng hiếm khi đụng tới. Cài đặt ở form
công việc (ô “Nhắc dai tới khi xong”), luật ở `backend/src/services/nagService.js`,
chuông lặp ở `schedulers/reminderScheduler.js`.

**Điểm bán thứ hai: “báo cáo năng suất” — thứ khiến khách ở lại trả tiền hằng tháng.**
Trang `/app/reports` (chỉ Pro) trả lời bốn câu hỏi mà người đi làm nào cũng hỏi:
mình xong bao nhiêu việc, có **đúng hạn** không, làm tốt nhất **vào giờ nào / thứ nào**,
và việc nào đang **bị bỏ quên lâu nhất** (kèm danh sách bấm vào sửa ngay). Có chuỗi
ngày có việc xong, so sánh với kỳ trước (“tuần này hơn tuần trước bao nhiêu việc”),
và đếm xem **nhắc dai đã kéo bạn quay lại bao nhiêu việc** — bằng chứng cụ thể rằng
việc trả tiền cho Pro có tác dụng. Nút **Xuất Excel** trả file .csv (BOM UTF-8 +
dòng `sep=;` vì Excel bản Việt dùng dấu phẩy làm dấu thập phân), nút **Lưu PDF** in
báo cáo bằng `window.print()` (đã có khối `@media print` trong `src/index.css`).
Luật và số liệu nằm ở `backend/src/services/reportService.js` — **mọi con số do server
tính theo giờ Việt Nam**, giao diện không tự đếm lại (hai nơi tính hai kiểu là cách
chắc chắn nhất để khách nhìn thấy hai con số khác nhau).

**Điểm bán thứ ba: “kế hoạch tuần” — trả lời câu hỏi hôm nay làm gì.** Danh sách
công việc chỉ nói *có những việc gì*; trang `/app/planner` (chỉ Pro) xếp việc đang
mở vào 7 ngày: quá hạn lên ngày đầu (lâu nhất trước), việc còn lại nằm đúng ngày đến
hạn, cùng ngày thì ưu tiên cao trước. Khách chọn sức mình mỗi ngày (3/5/8/10 việc).
Điểm quan trọng nhất — và cũng là chỗ khác biệt với mọi app khác: **app nói thật khi
tuần bị quá tải** (“bạn có 33 việc nhưng chỉ đủ chỗ cho 21, giữ nhịp này thì 26 việc
sẽ trễ”), kèm nút dời hạn một chạm. Giấu đi là để khách tự phát hiện ra lúc đã trễ
việc thật. Có luôn gợi ý đặt việc trọng tâm vào **giờ vàng** (tính từ dữ liệu thật của
chính khách). Luật ở `backend/src/services/plannerService.js`.

> **Quyết định (27/09/2026): bỏ mục “AI xếp cả tuần” khỏi danh sách.** Dịch vụ AI của
> MN-Qronx (thư mục `ai/`, `POST /parse`) là model phân tích câu thành công việc —
> không phải LLM biết lập kế hoạch. Hứa “AI xếp kế hoạch” là hứa suông. Kế hoạch tuần
> nay xếp bằng **luật**: chạy ngay, không tốn lượt AI, và không bao giờ bịa ra công
> việc không có thật — điều tối quan trọng với một app nhắc việc. Phần “gợi ý các bước
> làm” cho một việc lớn đã có sẵn trong Trợ lý AI.
>
> **Bổ sung (28/09/2026): nói là một đường vào Trợ lý AI, không phải tính năng mới.**
> Khách Pro có thể nói một câu, chữ nghe được đổ vào đúng ô nhập như khi gõ tay — dùng
> Web Speech API của trình duyệt nên không tốn lượt AI, không có độ trễ mạng, và không
> cần thuê thêm dịch vụ nhận dạng nào. **Đừng quảng cáo "giọng nói không rời khỏi
> máy"**: Chrome/Edge gửi audio tới dịch vụ nhận dạng của Google rồi mới trả chữ về
> (chỉ Chrome 139+ mới nhận dạng tại máy, app chưa dùng). Câu được phép nói: *chữ nghe
> được không được MN-Qronx lưu ở đâu*. Giới hạn thật (Firefox không có mic; Chromium
> nhúng như Electron báo lỗi mạng dù mạng tốt) ở `docs/ai-capture.md`.
>
> **Quyết định (28/09/2026): bỏ đường vào bằng ẢNH (OCR), chỉ giữ mic.** Bản thử cho
> chụp / kéo–thả / dán ảnh để đọc chữ (tesseract.js chạy trên máy khách) đã bị gỡ. Lý do
> không phải kỹ thuật mà là chất lượng: chữ đọc ra chỉ đúng với ảnh chữ in cỡ lớn, còn
> chữ viết tay, ảnh nghiêng, thiếu sáng thì sai nhiều — mà đó lại đúng là thứ khách hay
> chụp, và một công việc sai giờ tệ hơn là không có công việc nào. Cái giá đi kèm cũng
> không nhỏ: ~4 MB bộ nhận dạng tải về máy khách ở lần đầu, cộng một mớ luật riêng (nối
> dòng bị xé, cắt dòng bị gộp) chỉ để bù lỗi OCR. Mic giữ lại vì không tải gì thêm và
> chữ hiện ngay trong ô nhập cho khách sửa.
>
> Chú ý khi bán: **đây là đường vào, không phải bộ não.** Nó không làm AI giỏi hơn;
> nó chỉ bỏ bước gõ. Nên không được hứa “AI hiểu ảnh” (không còn đường ảnh nào), và
> cũng không nên hứa mic nghe đúng 100% — chữ nghe được luôn cần khách liếc lại trước
> khi bấm tạo.

**Điểm bán thứ tư: báo cáo tuần gửi email sáng thứ 2.** Hai tính năng trên chỉ có giá
trị nếu khách NHỚ mở app; thư tuần làm việc đó thay khách: tuần rồi họ xong bao nhiêu
việc, đúng hạn bao nhiêu, việc nào đang quá hạn, và tuần này có gì chờ (kèm cảnh báo
quá tải và 3 việc nên làm trước). Nội dung dựng từ chính `reportService` và
`plannerService` nên thư và web không bao giờ nói hai con số khác nhau
(`backend/src/services/weeklyReportService.js`, hẹn giờ ở
`schedulers/weeklyReportScheduler.js`: Thứ 2, 07:00–10:00 giờ VN).

> ⚠️ **Hạn mức gửi thư là ràng buộc thật của tính năng này.** Tài khoản Mailjet đang ở
giai đoạn duyệt tạm: **10 thư/giờ và 10 thư/ngày** (`services/mailQuota.js`). Vì vậy
mỗi lượt chỉ gửi một lô 4 thư; chạm trần là DỪNG ngay và lượt sau (15 phút) gửi tiếp,
không thử lại liên tục — mỗi thư bị từ chối là một điểm trừ khi Mailjet xét duyệt. Khi
số khách Pro vượt ~10 người, **phải** xin Mailjet gỡ giới hạn hoặc chuyển sang Resend
/ SMTP riêng trước, nếu không phần lớn khách sẽ không nhận được thư.
>
> Cột `users.weekly_report_sent_at` là chốt chặn chống gửi trùng (cron và nhịp
> `/health` cùng gọi hàm gửi, máy chủ Render ngủ nên cron có thể không chạy). Khách
tắt/mở trong **Cài đặt → Thông báo** (`PUT /me/weekly-report`) — thiếu đường tắt thì
> thư tuần thành thư rác.

**Nút “Gửi thử cho tôi ngay” (Cài đặt → Thông báo).** Thư tuần chỉ đi mỗi thứ 2, nên
không ai — kể cả chủ app — xem được nó trước khi nó tới hộp thư của toàn bộ khách trả
tiền. Một thư khách hàng chưa từng ai đọc là rủi ro không đáng có, nên khách Pro bấm
là nhận ngay một bản gửi tới **chính email của mình** (`POST /me/weekly-report/test`).
Ba điều cố ý khác đường gửi thật: **không** ghi `weekly_report_sent_at` (nếu ghi thì
bấm thử một lần là mất thư thật của tuần đó); có chặn bấm liên tục 10 phút
(`weekly_report_test_at`) vì hạn mức chỉ 10 thư/ngày dùng chung cho mọi khách; và khi
máy chủ không gửi được thì vẫn trả **nội dung thư** để khách đọc, thay vì chỉ báo lỗi.

### Một giao dịch ngân hàng phải có ĐÚNG MỘT khoá

Lỗi đã xảy ra thật trên production (27/09/2026): webhook SePay gửi `id` trần
(`85009768`) còn bộ đồng bộ API thêm tiền tố (`sepay:85009768`). Cùng một giao dịch
vào hai lần dưới hai khoá khác nhau nên chốt chống trùng theo `external_id` không bắt
được: lần đầu khớp đúng đơn và kích hoạt gói, lần sau bị đánh dấu “Đơn … đã thanh toán
trước đó” rồi nằm lại trong danh sách **“Tiền đã vào nhưng chưa khớp đơn”**. Admin nhìn
thấy tiền lơ lửng — và rất dễ bấm “Gán vào đơn” cho một đơn khác, tức là tặng thêm 30
ngày cho một lần trả tiền.

Nay mọi đường vào tiền đi qua `canonicalBankExternalId()`
(`backend/src/services/billingService.js`): id SePay dạng số luôn thành
`sepay:<id>`; mã không phải SePay (Casso) **giữ nguyên** khoá cũ để không đổi đường
đang chạy đúng. Khi thêm bất kỳ đường đọc giao dịch mới nào, khoá phải đi qua hàm này.

> **Còn một điểm cần tự kiểm tra ở SePay:** nhật ký có các dòng `BANK_TRANSFER_OUT`
> đúng bằng giá gói (79.000đ, 39.000đ) — tức là giao dịch **tiền ra** cùng số tiền với
> gói khách mua. Hệ thống bỏ qua tiền ra (đúng, không kích hoạt gói), nhưng nếu SePay
> đang trả nhầm chiều cho giao dịch tiền vào thì cần sửa ở phía SePay/Casso.

**Điểm bán thứ năm: “nhờ người khác làm” — quyền lợi Pro duy nhất Free/Plus KHÔNG
thể có bằng cách nào khác.** Bốn tính năng trên đều là “một mình bạn làm tốt hơn”:
khách không trả tiền vẫn tự làm được, chỉ chậm hơn. Giao việc thì khác — muốn nhờ
người thân/đồng nghiệp làm hộ thì buộc phải trả tiền. Ở trang chi tiết công việc,
chủ việc nhập email người được nhờ (kèm lời nhắn), tối đa **5 người mỗi việc**. Người
được nhờ **không cần gói trả phí**: họ thấy việc trong mục **Việc được giao**, vẫn
nhận chuông nhắc như việc của chính mình, và bấm “Xong phần của tôi” — chủ việc nhận
thông báo ngay.

Hai lan can được giữ chặt, vì đây là tính năng duy nhất cho người khác động vào dữ
liệu của khách: (1) **người được giao không sửa/xoá được việc và không đọc được danh
sách người được giao** — mọi truy vấn cũ vẫn khoá theo `tasks.user_id`, nên không có
đường nào để họ thấy việc khác của chủ; (2) **báo xong phần mình KHÔNG làm việc của
chủ tự hoàn thành** — việc chỉ xong khi chủ bấm Xong, nếu không thì “nhờ người khác”
thành “giao quyền quyết định cho người khác”. Việc lặp lại giữ nguyên người được giao
cho kỳ sau (giống cách giữ chế độ nhắc dai), trạng thái xong đặt lại từ đầu — trừ khi
bật **luân phiên** (xem dưới).

Vì sao đây cũng là kênh tăng trưởng: mỗi lần một khách Pro nhờ ai đó, người đó phải
có tài khoản MN-Qronx (dùng miễn phí) và sẽ thấy việc kèm chuông — đường có thêm
người dùng mà không tốn tiền quảng cáo. Nhờ vậy mục **Việc được giao** cố ý KHÔNG
đánh dấu Pro trong menu, và cuối trang có câu dẫn sang bảng giá cho người muốn nhờ
lại người khác. Mã ở `backend/src/services/taskShareService.js`,
`controllers/taskShareController.js`, bảng `task_shares`.

**Luân phiên người làm: “tuần này ai đổ rác”.** Giao việc trả lời được câu “nhờ ai
làm”, nhưng việc nhà lặp lại cần câu trả lời khác: “**kỳ này đến lượt ai**”. Không có
nó, một việc “đổ rác hằng tuần” giao cho 3 người thì cả 3 cùng nhận chuông mỗi tuần
(dễ bỏ qua vì ai cũng tưởng người khác làm) hoặc cả 3 cùng làm. Vì vậy trên việc lặp
lại, chủ việc bật được **luân phiên** (`Task.rotateEnabled`); mỗi kỳ đúng **một**
người là `Task.turnAssigneeId` — người **đến lượt**. Thứ tự xoay được suy ra từ
`task_shares` theo **thời điểm giao việc** (`rotationOrder()`), không lưu thành cột
riêng: danh sách người được giao đã là thứ tự, thêm một cột nữa chỉ là chỗ để hai
nguồn dữ liệu lệch nhau. Hàm này **sắp xếp có ý định** chứ không tin thứ tự dòng DB
trả về — cùng một danh sách đi qua hai truy vấn (nhắc nhở lọc `doneAt`, trang chi tiết
thì không) mà lệch thứ tự thì lượt kế tiếp rơi vào hai người khác nhau ở hai màn hình.

Chuông chỉ đánh thức người đến lượt (cộng chủ việc, nếu chủ không phải người đến
lượt), nên không còn cảnh ba người cùng nhận. Khi chủ bấm Xong, kỳ lặp kế tiếp tự
chuyển lượt sang người kế tiếp; hết danh sách thì quay lại đầu. Có sẵn cả đường
**đổi tay thủ công** cho những tuần bất thường (“tuần này con ốm, mẹ làm”):
`setRotation(..., { assigneeId })` chỉ đổi người của kỳ này mà không tắt luân phiên,
và chỉ cho đổi sang người đã được giao việc này — nếu không, người đến lượt sẽ là
người không có trong danh sách và chuông sẽ kêu vào khoảng không.
Người đến lượt thấy việc trong **Việc được giao** kèm nhãn **“Đến lượt bạn”**
(`isMyTurn`), người khác trong danh sách vẫn thấy việc nhưng ở dạng “chờ tới lượt” và
không bị nhắc — họ không bị mất việc, chỉ là kỳ này chưa tới phiên.

Bốn chi tiết dễ sai đã xử lý sẵn: (1) người đến lượt bị **thu hồi** khỏi việc thì lượt
tự nhảy sang người kế tiếp, không để việc “mồ côi lượt”; (2) thêm người mới vào việc
đang luân phiên thì người đó vào **cuối hàng** (nhờ mốc `createdAt`), không chen ngang
làm lệch phiên của người đang chờ; (3) **bật luân phiên hai lần không đẩy lượt sang
người khác** — lượt đang có được giữ nếu người đó còn trong danh sách, vì nút này
khách sẽ bấm lại và “bấm lại mà đổi người trực” là loại lỗi im lặng tệ nhất;
(4) việc **không** ở chế độ luân phiên thì mọi thứ chạy y như trước — luân phiên là
lớp phủ, không phải đường thứ hai. Mã ở `taskShareService`
(`setRotation`, `nextTurnAssignee`, `reminderTargetsForTask`), route
`PUT /tasks/:taskId/rotation`.

### Gói Pro Gia đình: tăng TIỀN MỖI KHÁCH, không chỉ tăng số khách

Năm điểm bán trên đều bán cho **một người**: doanh thu chỉ tăng khi có thêm khách
mới. Gói Pro Gia đình là gói đầu tiên nâng được mức trả của một khách lên
**199.000đ/tháng** (1.990.000đ/năm = 10 tháng) thay vì 79.000đ, và nhờ mỗi khách
mời thêm **3 người** dùng app miễn phí — mỗi người trong nhà là một tài khoản thật,
việc thật, chuông thật, nên cũng là người có thể trả tiền sau này. So với 4 gói Pro
lẻ (316.000đ) thì cả nhà rẻ hơn, nhưng một khách trả nhiều hơn 2,5 lần gói Pro thường.

**Quyền lợi bằng nhau, không phải bản “Pro rút gọn”.** `PLANS.FAMILY` được **dựng
từ `PLANS.PRO`** (`spread` thay vì chép tay) nên hạn mức, âm thanh, nhắc dai, báo
cáo, kế hoạch tuần, giao việc… không bao giờ lệch giữa hai gói — có test bắt chuyện
này (`plans[FAMILY].limits === plans[PRO].limits`). Quyền lợi riêng của gói này là
**thêm người**, không phải bớt quyền nào.

**Người trong nhà được “vật chất hoá” là gói PRO.** Đây là quyết định kỹ thuật quan
nhất của tính năng: `users.plan = PRO` + một dòng `subscriptions` với
`provider = FAMILY` (nguồn quyền lợi), thay vì để mỗi chỗ kiểm tra gói tự suy ra
“người này có được dùng Pro không”. Nhờ vậy **mọi cổng quyền lợi cũ chạy đúng mà
không sửa một dòng nào** (nếu không thì chủ nhà — người trả tiền — lại là người
không mở được báo cáo, kế hoạch tuần, nhắc dai), và cũng không có chỗ nào tính
khác chỗ nào. `provider = FAMILY` riêng một giá trị để **báo cáo doanh thu không
bao giờ đếm một chỗ ngồi là một khách đã trả tiền**.

**Sống theo chủ.** Bảng `family_members` (`owner_id` + `member_id` unique — một
người chỉ nằm trong một nhà), quyền hạn của người trong nhà luôn lấy theo hạn của
chủ: `familyService.syncFamilySeats()` chạy mỗi phút cùng nhịp hạ gói hết hạn
(`schedulers/reminderScheduler.js`), nên:

- chủ **gia hạn** → cả nhà được kéo theo hạn mới trong vòng 1 phút, không cần vá
  từng đường cấp gói (mua, admin tặng, đổi điểm, dùng thử);
- chủ **hết hạn** → ghế bị thu hồi **và dòng thành viên bị xoá**. Khi chủ mua lại
  phải **mời lại** — tự bật quyền cho người đã muốn rời đi là điều không ai mong đợi;
- người trong nhà **không mua gói riêng** được (`createOrder` trả 400 kèm cách
  làm đúng), vì `applyPlanChange` sẽ đóng luôn dòng ghế và để hai nguồn quyền lợi
  đánh nhau.

**Người trong nhà không bị mời bấm vào một lỗi:** dòng `provider = FAMILY` bị loại
khỏi thư nhắc “Gia hạn ngay” (`sendRenewalReminders`) và bảng “sắp hết hạn trong 7
gày” của admin (`listExpiringSoon`) — họ không tự gia hạn được, người duy nhất cần
nhắc là chủ gói, mà chủ gói đã có dòng riêng rồi.

**Không cướp khách đang trả tiền:** không mời được người đang có gói trả phí, không
mời được người đang là chủ một nhà khác, và người đã ở nhà khác thì không nhận thêm
chỗ. Chủ nhà đổi điểm lấy thưởng được cộng thẳng vào FAMILY chứ không hạ xuống PRO
(`rewardService.claimReward`) — nếu không thì một lần đổi điểm làm cả nhà mất quyền.

Giao diện: khối **“Gói gia đình”** ở trang Gói (`/app/billing`) dùng CÙNG một khối
cho cả ba vai — người chưa có nhà thấy giá và nút mua, chủ gói thấy danh sách chỗ +
form mời + nút gỡ, người trong nhà thấy mình dùng chung của ai và nút rời đi. Mã ở
`backend/src/services/familyService.js`, `controllers/familyController.js`, 4 đường
`/me/family`.

### “Cả nhà hôm nay” — thứ khiến gói 199.000đ khác gói 79.000đ

Ba chỗ ngồi là lý do để MUA gói gia đình, nhưng không phải lý do để Ở LẠI trả
199.000đ mỗi tháng: sau tháng đầu, khách chỉ còn thấy mình trả gấp 2,5 lần gói Pro
thường. Trang `/app/family` là phần chỉ chủ gói có — cả nhà đang tới đâu: hôm nay ai
xong bao nhiêu việc, 7 ngày qua được bao nhiêu, ai đang có việc quá hạn, và **tên tối
đa 3 việc quá hạn lâu nhất** của từng người (việc trễ 5 phút không phải thứ cần nhắc;
việc bỏ quên 5 ngày mới là). Số liệu do `familyService.getFamilyBoard()` tính bằng
**một hàm duy nhất** (`progressOf`) cho cả chủ gói lẫn từng thành viên — hai chỗ đếm
hai kiểu là cách chắc chắn nhất để màn hình nói dối khách. Ngày tính theo giờ Việt
Nam, giống mọi báo cáo khác.

**Quyền riêng tư là một phần của tính năng, không phải phần phụ.** Người trong nhà
thấy rõ mình đang chia sẻ gì (nêu đúng những con số chủ gói nhìn thấy, kèm câu “không
ai đọc được nội dung công việc của bạn”) và **tắt được bất cứ lúc nào** bằng
`family_members.share_progress` (`PUT /me/family/progress`). Tắt là máy chủ **không
trả số liệu nữa** — che ở giao diện thì dữ liệu của người ta vẫn rời máy chủ, và người
chỉ tắt để thấy yên tâm sẽ phát hiện ra ngay khi hỏi. Bảng của chủ gói khi đó ghi rõ
“Không chia sẻ tiến độ” và tổng cả nhà không tính người đó.

Lý do phải làm đúng chỗ này: bị nhìn trộm việc riêng mà không biết là cách chắc chắn
nhất để người trong nhà rời gói — mà mất một người là mất luôn cả gói 199.000đ, đắt
hơn nhiều so với việc để họ tắt chia sẻ. Cố ý KHÔNG cho chủ gói xem nội dung/mô tả
công việc, và KHÔNG cho chủ gói sửa việc của người khác.

> Khi mở bán app Android, Play Console phải tạo thêm `mnq_family_monthly` và
> `mnq_family_yearly` (xen vào `PRODUCT_IDS`).

**Chỉ ghi vào bảng này thứ khách đang dùng được.** Thứ chưa làm xong nằm ở
`PLANS[...].upcoming` (trang giá hiện kèm nhãn “Sắp có”), hiện chỉ còn: đồng bộ **hai
chiều** Google Calendar (một chiều app → lịch đã có sẵn cho mọi gói qua file .ics).

> **Quyết định (27/09/2026): bỏ “nhắc qua Zalo OA” khỏi danh sách bán.** Người đã cài
> app trên điện thoại thì thông báo đẩy hiện thẳng trên màn hình, không cần Zalo.
> Zalo chỉ còn giá trị như **kênh dự phòng** cho người không cài app (hoặc máy chặn
> thông báo nền) — để lại trong danh sách làm sau, khi có nhu cầu thật; tiền thu ở
> chỗ khác (nhắc dai, hạn mức AI, thiết bị, âm thanh riêng, hỗ trợ ưu tiên).

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

Chuyển khoản không tự gia hạn được nên người dùng phải tự mua lại kỳ mới. Chuỗi
giữ khách gồm bốn tầng — **đã làm hết**:

| Việc | Chỗ nằm | Cách chạy |
|---|---|---|
| Số ngày còn lại trên **Dashboard** khi ≤ 7 ngày | `src/pages/user/DashboardPage.jsx` | Banner vàng kèm nút **Gia hạn ngay** mở `/app/billing`; hiện cả khi còn 0 ngày (`hết hạn hôm nay`) |
| **Email nhắc trước 3 ngày** kèm nút Gia hạn ngay | `billingService.sendRenewalReminders` + `schedulers/billingReminderScheduler.js` | Cron mỗi phút nhưng tự chọn lọc: 08:00–21:00 giờ VN, chu kỳ 15 phút, và cũng chạy theo nhịp `/health` để máy ngủ gói free vẫn gửi kịp |
| **Admin danh sách** "sắp hết hạn trong 7 ngày" | `GET /admin/billing/settings` → trường `expiringSoon`, card ở `/admin/orders` | Kèm ngày nhắc, trạng thái *đã nhắc/chưa nhắc* và nút **Nhắc khách** (mailto) |
| Hết hạn → giữ nguyên dữ liệu, tụt về gói Miễn phí | `planLimits.downgradeExpiredPlans()` | Chạy mỗi phút trong `reminderScheduler` |

**Chống spam email:** cột `subscriptions.reminder_sent_at` — mỗi kỳ đúng một lần;
gửi thất bại thì **không** đánh dấu nên lần chạy sau tự gửi lại. Gói Miễn phí không
nhắc (vốn không có khái niệm hết hạn). Cột này chỉ thêm, `prisma db push` không đụng
dữ liệu cũ.

**Chỉnh thời điểm nhắc:** đổi `daysBefore` trong lời gọi `sendRenewalReminders`
tại `billingReminderScheduler.js`, hoặc đổi khung giờ im lặng `QUIET_FROM_HOUR` /
`QUIET_AFTER_HOUR` (đơn vị: giờ Việt Nam).

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
