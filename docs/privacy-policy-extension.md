# Chính sách quyền riêng tư — MN-Qronx Extension

> Bản nháp để đưa lên web thành trang công khai (ví dụ
> `https://mn-qronx.id.vn/privacy-extension`), rồi điền URL vào cả Chrome Web
> Store và Edge Add-ons. Ngày cập nhật: 26/10/2026.

MN-Qronx Extension giúp người dùng xem công việc hôm nay của họ trên nền
MN-Qronx và nhận thông báo chuông ngay trên trình duyệt, kể cả khi trang web
MN-Qronx đang không mở.

## Dữ liệu mà tiện ích xử lý

1. **Email và mật khẩu** — chỉ dùng để đăng nhập vào API của MN-Qronx
   (`https://mn-qronx.id.vn`). Mật khẩu không được lưu; tiện ích chỉ giữ
   **token phiên (access/refresh token)** do API trả về.
2. **Danh sách công việc và lời nhắc** — tải từ API MN-Qronx chỉ để hiển thị
   danh sách việc hôm nay và bắn chuông đúng giờ.
3. **Cài đặt tiện ích** (trạng thái chuông, mốc thời gian đã chuông) — lưu
   cục bộ ngay trong trình duyệt của người dùng.

## Dữ liệu KHÔNG bị sử dụng

- Tiện ích không bán, cho thuê hay chia sẻ dữ liệu người dùng cho bên thứ ba.
- Tiện ích không thu thập lịch sử duyệt web, không đọc nội dung của các trang
  web khác, không theo dõi hành vi ngoài phạm vi trên.
- Toàn bộ dữ liệu phiên chỉ đi tới hai nơi: trình duyệt của người dùng và
  backend chính chủ của MN-Qronx (`https://mn-qronx.id.vn`).

## Quyền hạn xin và mục đích

- **alarms** — định kỳ kiểm tra lời nhắc đến giờ (mỗi phút).
- **notifications** — bắn thông báo chuông khi đến giờ nhắc, kèm nút
  "Hoãn 10 phút" và "Tắt nhắc".
- **storage** — lưu token phiên và trạng thái chuông cục bộ.
- **host permission `https://mn-qronx.id.vn/*`** — kết nối API chính chủ để
  đăng nhập, tải danh sách việc và lời nhắc của người dùng.

## Xoá dữ liệu

Đăng xuất bằng nút "Thoát" trong tiện ích sẽ xoá token khỏi trình duyệt.
Muốn xoá toàn bộ dữ liệu tài khoản, liên hệ hỗ trợ theo thông tin trên
mn-qronx.id.vn.

## Liên hệ

Chủ sở hữu: MN-Qronx — mn-qronx.id.vn. Mọi thắc mắc về chính sách này gửi về
hộp thư hỗ trợ công bố trên website.
