# Nói: một đường nữa vào trợ lý AI

Khách Pro có hai cách đưa việc vào app: **gõ** và **nói**. Giọng nói đổ về đúng một
luồng xử lý như khi gõ tay.

| Cách | Đường vào | Chạy ở đâu |
| --- | --- | --- |
| Gõ | ô nhập của trợ lý AI / Tạo nhanh | — |
| Nói | `src/lib/useVoiceInput.js` + `components/common/VoiceButton.jsx` | Web Speech API của trình duyệt (trình duyệt gửi audio tới Google rồi trả chữ về) |

Có mặt ở hai chỗ: khung chat **Trợ lý AI** (`components/AiTaskChat.jsx`) và hộp thoại
**Tạo nhanh** (`components/QuickCapture.jsx`).

## Vì sao không tự thu âm rồi gửi lên máy chủ MN-Qronx

- Không tốn hạn mức AI theo ngày (`api/ai/parse-tasks` có hạn mức và có thể đang
  ngủ), không có độ trễ mạng, không phải thuê thêm dịch vụ nhận dạng nào.

### ⚠️ Điều KHÔNG được hứa: "giọng nói không rời khỏi máy"

Bản đầu của tài liệu này ghi sai chỗ đó. Chrome/Edge **không** nhận dạng tại máy:
chúng gửi audio tới dịch vụ của Google rồi trả chữ về tab (đó là lý do API này cần
mạng, và cũng là lý do có mã lỗi `network`). Chỉ từ Chrome 139 mới có chế độ nhận
dạng ngay trên máy qua `processLocally`, và **app này chưa dùng** — nên tuyệt đối
 không dùng câu "không rời khỏi máy" trong marketing hay trong app. Nói đúng được
phép nói: *chữ nghe được không được lưu ở đâu trong hệ thống MN-Qronx, và không tốn
lượt AI nào của bạn*.

Đổi lại phải nói thật về giới hạn:

- Mic chạy trên **Chrome / Edge / Safari** (kể cả Chrome trên Android).
- **Firefox không có API này** → nút mic tự ẩn, không để khách bấm vào rồi không có
  gì xảy ra.
- **Chromium nhúng trong ứng dụng khác (Electron)** — gồm khung trình duyệt của các
  app desktop — CÓ API nhưng bản dựng không kèm khoá dịch vụ nhận dạng của Google,
  nên mọi phiên đều kết thúc bằng lỗi `network` **dù mạng rất tốt**
  ([electron#46143](https://github.com/electron/electron/issues/46143)). Nút mic vẫn
  hiện ở môi trường này, và bấm vào là nhận được câu giải thích đúng + cách sửa
  (mở bằng Chrome/Edge/Safari).
- Nghe sai chính tả, sai dấu là chuyện thường → chữ luôn đổ vào ô nhập để khách đọc
  lại, sửa, rồi mới tạo.

### Mã lỗi `network` không có nghĩa là "mạng của khách hỏng"

Chrome dùng đúng một mã `network` cho mọi ca không lấy được chữ từ dịch vụ nhận
 dạng, kể cả khi mạng bình thường (VPN / tường lửa / tiện ích chặn quảng cáo đang
chặn máy chủ Google, DNS chặn Google, hoặc trình duyệt là bản Chromium nhúng). Vì vậy
`networkErrorMessage()` trong `src/lib/useVoiceInput.js` tách thành ba câu khác nhau:
đang thật sự offline · Chromium nhúng · còn lại. Câu cũ "Kiểm tra kết nối rồi thử
lại" đã bị bỏ vì nó đổ lỗi sai chỗ và đẩy khách đi kiểm tra router.

## Luật quan trọng nhất: KHÔNG tự tạo công việc

Chữ nghe được **đổ vào ô nhập để khách đọc lại, sửa, rồi mới tạo** — không tự tạo
thẳng. Lý do rất cụ thể: công việc sai giờ hoặc sai chữ thì tệ hơn là không có công
việc, vì chuông sẽ kêu sai lúc và khách mất niềm tin vào đúng cái tính năng họ đang
trả tiền.

## Đã bỏ đường vào bằng ẢNH (28/09/2026)

Bản thử có thêm đường chụp / kéo–thả / dán ảnh để đọc chữ (tesseract.js chạy trên máy
khách). Đã gỡ hẳn. Vì sao:

- Chữ đọc ra **chỉ đúng với ảnh chữ in cỡ lớn** (đo thật: độ rõ 94–95%). Chữ viết tay,
  ảnh nghiêng, thiếu sáng thì sai nhiều — mà đó đúng là thứ khách hay chụp.
- Cái giá không nhỏ: **~4 MB bộ nhận dạng tải về máy khách** ở lần đầu (lần sau mới
  nhanh nhờ cache), cộng một mớ luật riêng chỉ để bù lỗi OCR (nối dòng bị xé vì hết bề
  ngang, cắt dòng bị gộp hai việc làm một).
- Mic giữ lại vì không tải gì thêm, chạy tức thì, và chữ hiện ngay trong ô nhập cho
  khách sửa.

## Một lỗi cũ trong bộ tách công việc (đã sửa)

`Thứ 4 họp phụ huynh lúc 14h` từng ra tiêu đề `Thứ ọp phụ huynh` và hạn **04:00**:
`extractTime` trong `src/services/aiService.js` coi chữ "h" của "họp" là mốc giờ
(`4 h`), nên cụm "4 h" bị cắt khỏi tiêu đề và giờ bị hiểu sai. Nay "h" chỉ là mốc giờ
khi ngay sau nó không phải chữ cái — cùng luật `HAS_CLOCK` đã dùng ở chỗ khác, và cùng
luật mà bản Python (`ai/serve.py`) đã có sẵn bằng `\b`. Lỗi này lộ ra khi có đường vào
mới (giọng nói hay "Thứ X <việc>"), nhưng nó là lỗi của parser nên gõ tay cũng từng bị.

## Kiểm tra tay

1. `npm run dev` + API ở cổng 8081, đăng nhập bằng tài khoản Pro.
2. Trang **Trợ lý AI**: bấm nút micro → nói (Chrome/Android) → chữ hiện dần ngay trên ô
   nhập, bấm lần nữa để dừng.
3. Hộp thoại **Tạo nhanh** (Ctrl+K) ở chế độ AI: bấm micro → chữ đổ vào ô nhập, xem
   trước bên dưới rồi mới bấm "Tạo bằng AI".
