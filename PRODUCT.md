# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Người dùng cá nhân: lập kế hoạch, theo dõi và hoàn thành công việc đúng thời điểm, nhận nhắc nhở kiểu báo thức.
- Người dùng trong không gian làm việc nhóm, lớp học và gia đình hoặc doanh nghiệp: giao việc, theo dõi việc được giao, dùng chung lịch và kế hoạch tuần.
- Quản trị viên: quản lý người dùng, đơn hàng và hỗ trợ khách hàng, không xem nội dung công việc của người dùng.
- Khách vãng lai: xem trang giới thiệu và bảng giá, đăng ký tài khoản, dùng thử gói trả phí.

## Product Purpose

MN-Qronx giúp người dùng lên kế hoạch, làm việc và hoàn thành mục tiêu đúng thời điểm, với khẩu hiệu Plan. Do. On Time.

Thành công của sản phẩm là khi một công việc đến hạn không bị bỏ sót: người dùng thấy nhắc nhở rõ ràng, xác nhận hoặc hoãn một cách chủ động, và quay lại làm việc đúng lúc.

## Positioning

Điểm khác biệt có thể kiểm chứng của MN-Qronx là nhắc nhở kiểu báo thức, không chỉ là thông báo danh sách:

- Báo thức toàn màn hình với âm thanh, hoãn tối đa 3 lần hoặc tắt.
- Gói Pro có nhắc dai tới khi người dùng xác nhận.
- Web Push để chuông kêu cả khi đã đóng tab.
- Có bản desktop và tiện ích trình duyệt để chuông báo chạy cả khi app web đóng.

## Operating Context

- Công việc hàng ngày có hạn chót, lặp lại theo ngày, tuần hoặc tháng, có việc con và danh mục.
- Người dùng làm việc trên web, chuyển giữa dashboard, danh sách công việc, lịch, bảng và kế hoạch tuần.
- Người dùng dùng chế độ tập trung, trợ lý AI, điểm thưởng và mã mời, báo cáo năng suất.
- Giao diện dùng được bằng tiếng Việt và tiếng Anh, có chế độ sáng và tối.

## Capabilities and Constraints

- Khách: trang giới thiệu, bảng giá, đăng ký có xác thực email, đăng nhập bằng mật khẩu hoặc Google, quên và đặt lại mật khẩu, callback OAuth.
- Người dùng: dashboard, công việc và việc con, nhắc nhở theo gói, thùng rác 30 ngày có khôi phục, lịch ngày, tuần và tháng, danh mục, tìm kiếm và lọc, lịch sử thông báo, cài đặt thông báo và âm thanh, thiết bị, hồ sơ, đổi mật khẩu, xuất lịch .ics, trợ lý AI theo hạn mức gói, điểm thưởng và mã mời, chat hỗ trợ.
- Gói trả phí: Miễn phí, Plus, Pro và Pro Doanh nghiệp, thanh toán VietQR, dùng thử 7 ngày.
- Quản trị: dashboard hệ thống, quản lý người dùng gồm tạo, khóa, mở, đổi gói và xóa, đối soát đơn và cấu hình nhận tiền, trả lời hỗ trợ.
- Khả năng hiện tại: web app React 18 và Vite 5, React Router DOM v6, TailwindCSS 3, dữ liệu qua REST API /api/v1, backend Express và Prisma.

## Resolved Decisions (phỏng vấn 03/11/2026)

- Chỉ số thành công định lượng: tỷ lệ việc đến hạn được hoàn thành đúng hạn (xong trước khi trễ) là thước đo gốc — thiết kế phải thúc đẩy hành động khi chuông kêu, không chỉ liệt kê.
- Thứ tự ưu tiên: người dùng cá nhân/sinh viên đứng trước; nhóm/lớp học là mở rộng tiếp theo.
- Thương hiệu giữ: logo Q (đồng hồ + tích), khẩu hiệu "Plan. Do. On Time.", và cả hai chế độ sáng/tối.
- Tông màu hiện tại (nền navy + gradient xanh–tím) KHÔNG là cam kết: được phép (và khuyến khích) thay bằng thế giới màu của hướng mới sau khi được người dùng chọn.

## Brand Commitments

- Tên sản phẩm: MN-Qronx.
- Khẩu hiệu: Plan. Do. On Time.
- Logo: chữ Q kết hợp đồng hồ và dấu tích.
- Giọng văn trong app: trực tiếp, rõ ràng, bằng tiếng Việt là chính, có bản tiếng Anh.

## Evidence on Hand

- Tài liệu nghiệp vụ trong thư mục BA, gồm phân tích nghiệp vụ, sơ đồ, ERD, thiết kế cơ sở dữ liệu, đặc tả API, đặc tả wireframe, kiến trúc và kế hoạch backend.
- Các route và trang đã chạy trong src/App.jsx: 7 trang khách, 20 trang người dùng và 4 trang quản trị, cùng overlay báo thức toàn màn hình.
- Không có bằng chứng trong tài liệu đã đọc về lời chứng thực khách hàng, số liệu người dùng thật hay cam kết triển khai cụ thể, nên các nội dung đó không được bịa ra trong thiết kế.

## Product Principles

- Đúng thời điểm quan trọng hơn đầy đủ tính năng: nhắc nhở phải tới được người dùng và buộc một hành động rõ ràng.
- Một công việc luôn có trạng thái rõ ràng: chưa làm, đến hạn, đã hoãn, đã xong hoặc đã khôi phục.
- Người dùng kiểm soát được nhắc nhở: cài đặt thông báo, âm thanh, hoãn và tắt phải dễ tìm và dễ đoán.
- Dữ liệu công việc của người dùng là riêng tư, kể cả với quản trị viên.
- Giao diện phải dùng được bằng bàn phím, trên điện thoại và máy tính, trong cả chế độ sáng và tối.

## Accessibility & Inclusion

- Focus ring rõ, aria-label, điều hướng bằng bàn phím, độ tương phản tối thiểu 4.5:1, tôn trọng prefers-reduced-motion.
- Nút bấm tối thiểu 44px trên cảm ứng, điều hướng dưới cùng tối đa 5 mục kèm nút hành động chính trên mobile.
