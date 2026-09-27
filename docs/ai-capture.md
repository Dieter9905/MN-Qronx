# Nói và chụp: hai đường vào trợ lý AI

Khách Pro có ba cách đưa việc vào app: **gõ**, **nói**, **chụp ảnh**. Hai cách sau
mới, và cả hai đều đổ về đúng một luồng xử lý như khi gõ tay.

| Cách | Đường vào | Chạy ở đâu |
| --- | --- | --- |
| Gõ | ô nhập của trợ lý AI / Tạo nhanh | — |
| Nói | `src/lib/useVoiceInput.js` + `components/common/VoiceButton.jsx` | Web Speech API của trình duyệt (trên máy khách) |
| Chụp / kéo–thả / dán ảnh | `src/lib/imageOcr.js`, `src/lib/useImageOcr.js`, `components/common/ImageOcrButton.jsx` | tesseract.js chạy trong trình duyệt (trên máy khách) |

Có mặt ở hai chỗ: khung chat **Trợ lý AI** (`components/AiTaskChat.jsx`) và hộp
thoại **Tạo nhanh** (`components/QuickCapture.jsx`).

## Vì sao cả hai chạy TRÊN MÁY khách, không gửi lên máy chủ

- **Giọng nói là dữ liệu riêng tư nhất** người dùng đưa vào app: họ nói trong nhà,
  trong xe, có khi cả tên người khác. Web Speech API trả chữ ngay trên máy — không
  upload, không tốn hạn mức AI theo ngày, không phụ thuộc mạng tới máy chủ
  (`api/ai/parse-tasks` có hạn mức và có thể đang ngủ).
- **Ảnh còn nhạy cảm hơn**: ảnh chụp giấy tờ, tin nhắn, thời khoá biểu. AI của
  MN-Qronx (`ai/serve.py`) là model tự chạy chỉ đọc **chữ**, không đọc **ảnh** —
  muốn đọc ảnh phải thuê một dịch vụ nhìn ảnh bên ngoài, tức là tốn tiền mỗi lần
  chụp VÀ phải gửi ảnh của khách đi. OCR ngay trên máy thì ảnh không rời khỏi máy.

Đổi lại phải nói thật về giới hạn:

- Mic: Chrome / Edge / Safari (kể cả Chrome trên Android). **Firefox không hỗ trợ**
  → nút mic tự ẩn, không để khách bấm vào rồi không có gì xảy ra.
- Ảnh: **chữ in và ảnh chụp màn hình đọc tốt** (đo thật: ảnh chữ in cỡ lớn, độ rõ
  94–95%); **chữ viết tay, ảnh nghiêng, thiếu sáng thì sai nhiều**. Bộ nhận dạng
  (`vie`, 3,8 MB) tải một lần rồi trình duyệt tự cache trong IndexedDB, nên lần đầu
  hơi lâu (có hiện tiến trình), các lần sau gần như tức thì.

## Luật quan trọng nhất: KHÔNG tự tạo công việc

Chữ đọc từ ảnh và chữ nghe được đều **đổ vào ô nhập để khách đọc lại, sửa, rồi mới
tạo** — không đường nào tự tạo thẳng. Lý do rất cụ thể: công việc sai giờ hoặc sai
chữ thì tệ hơn là không có công việc, vì chuông sẽ kêu sai lúc và khách mất niềm
tin vào đúng cái tính năng họ đang trả tiền. Ở khung chat, chữ OCR được gửi như một
tin nhắn của khách (họ nhìn thấy NGUYÊN VĂN thứ máy đọc được, kể cả chỗ sai) rồi
mới tới bước duyệt — nhờ vậy sửa được ngay bằng cách nhắn lại.

Khi độ rõ của ảnh thấp (< 60%) app nói thẳng là ảnh mờ và chữ có thể sai, thay vì
im lặng để khách tin nhầm.

## Hai cái bẫy của OCR, và cách xử lý

1. **Xuống dòng giữa câu.** Bộ tách công việc coi mỗi dòng là một việc (đúng với
   danh sách gạch đầu dòng), nhưng OCR xuống dòng vì hết bề ngang trang: "Họp nhóm
   lúc 9h" bị xé thành hai việc. → Dòng bắt đầu bằng chữ thường (hoặc từ nối
   "và/với/rồi…") sau một dòng chưa kết thúc câu được **nối lại**.
2. **Gộp hai việc thành một dòng.** Chiều ngược lại, cũng gặp thật khi chụp giấy:
   hai việc trên hai dòng giấy bị tesseract đọc thành MỘT dòng —
   `"Thứ 5 đi họp lớp lúc 19h Chủ nhật 8h đưa con đi học bơi"` — và nếu để nguyên
   thì mất luôn một việc mà không báo gì. → Một **mốc thứ/ngày MỚI** đứng sau chỗ đã
   có **giờ**, và còn ít nhất hai từ thật phía sau mốc đó, thì cắt thành dòng riêng
   (`splitPackedLine`). Điều kiện "hai từ thật" để không cắt "…đi học bơi chủ nhật"
   thành một dòng rác chỉ có chữ "chủ nhật".

Chữ đọc ra còn phải **giữ dấu xuống dòng** khi trả về: gộp tất cả thành một dòng là
xoá mất đúng thứ thông tin mà một tờ giấy ghi nhiều việc mang lại.

## Một lỗi cũ trong bộ tách công việc (đã sửa)

`Thứ 4 họp phụ huynh lúc 14h` từng ra tiêu đề `Thứ ọp phụ huynh` và hạn **04:00**:
`extractTime` trong `src/services/aiService.js` coi chữ "h" của "họp" là mốc giờ
(`4 h`), nên cụm "4 h" bị cắt khỏi tiêu đề và giờ bị hiểu sai. Nay "h" chỉ là mốc
giờ khi ngay sau nó không phải chữ cái — cùng luật `HAS_CLOCK` đã dùng ở chỗ khác,
và cùng luật mà bản Python (`ai/serve.py`) đã có sẵn bằng `\b`. Lỗi này chỉ lộ ra
khi có đường vào mới (ảnh/giọng nói hay ghi "Thứ X <việc>"), nhưng nó là lỗi của
parser nên gõ tay cũng từng bị.

## Kiểm tra tay

1. `npm run dev` + API ở cổng 8081, đăng nhập bằng tài khoản Pro.
2. Trang **Trợ lý AI**: bấm nút micro → nói (Chrome/Android) → chữ hiện dần ngay
   trên ô nhập, bấm lần nữa để dừng.
3. Bấm nút ảnh, hoặc **kéo ảnh** vào khung, hoặc **dán ảnh chụp màn hình** (Ctrl+V).
   Lần đầu sẽ thấy "Đang tải bộ nhận dạng…" — sau đó chữ đọc được đi vào ô nhập (ô
   nhập của Tạo nhanh) hoặc gửi thẳng vào chat (Trợ lý AI).
