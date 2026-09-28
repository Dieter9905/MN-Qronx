# Nói: một đường nữa vào trợ lý AI

Khách Pro có hai cách đưa việc vào app: **gõ** và **nói**. Giọng nói đổ về đúng một
luồng xử lý như khi gõ tay.

| Cách | Đường vào | Chạy ở đâu |
| --- | --- | --- |
| Gõ | ô nhập của trợ lý AI / Tạo nhanh | — |
| Nói | `src/lib/useVoiceInput.js` + `components/common/VoiceButton.jsx` | Web Speech API của trình duyệt (trên máy khách) |

Có mặt ở hai chỗ: khung chat **Trợ lý AI** (`components/AiTaskChat.jsx`) và hộp thoại
**Tạo nhanh** (`components/QuickCapture.jsx`).

## Vì sao chạy TRÊN MÁY khách, không gửi lên máy chủ

- **Giọng nói là dữ liệu riêng tư nhất** người dùng đưa vào app: họ nói trong nhà,
  trong xe, có khi cả tên người khác. Web Speech API trả chữ ngay trên máy — không
  upload, không tốn hạn mức AI theo ngày, không phụ thuộc mạng tới máy chủ
  (`api/ai/parse-tasks` có hạn mức và có thể đang ngủ).

Đổi lại phải nói thật về giới hạn:

- Mic: Chrome / Edge / Safari (kể cả Chrome trên Android). **Firefox không hỗ trợ**
  → nút mic tự ẩn, không để khách bấm vào rồi không có gì xảy ra.
- Nghe sai chính tả, sai dấu là chuyện thường → chữ luôn đổ vào ô nhập để khách đọc
  lại, sửa, rồi mới tạo.

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
