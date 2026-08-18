# Cơ sở dữ liệu TaskAlarm

Thư mục này chứa hai bản thiết kế DDL tương đương, được xây dựng từ [ERD TaskAlarm](03_TaskAlarm_ERD.md).

| Hệ quản trị | Tệp schema | Phiên bản mục tiêu |
|---|---|---|
| PostgreSQL | [postgresql/taskalarm_schema.sql](postgresql/taskalarm_schema.sql) | PostgreSQL 15 trở lên |
| SQL Server | [sqlserver/taskalarm_schema.sql](sqlserver/taskalarm_schema.sql) | Microsoft SQL Server 2019 trở lên |

Mỗi tệp bao gồm 10 bảng, khóa chính/khóa ngoại, ràng buộc dữ liệu, chỉ mục phục vụ scheduler nhắc nhở, trigger kiểm tra điều kiện nghiệp vụ (giới hạn số nhắc nhở, thời điểm nhắc hợp lệ, task cha cùng chủ sở hữu), và dữ liệu khởi tạo cho role/trạng thái.

## Cách sử dụng

1. Tạo một cơ sở dữ liệu trống trong hệ quản trị tương ứng.
2. Chạy **một** tệp schema phù hợp với hệ quản trị đã chọn.
3. Không chạy cả hai tệp trên cùng một cơ sở dữ liệu.

## Lưu ý khi triển khai ở tầng ứng dụng

- **Scheduler nhắc nhở**: một tiến trình nền (background job/scheduler) cần định kỳ quét bảng `reminders` với điều kiện `status = 'SCHEDULED' AND remind_at <= NOW()` để kích hoạt báo thức đúng giờ (NFR-06). Chỉ mục `ix_reminders_status_remind_at` được tạo sẵn để phục vụ truy vấn này hiệu quả.
- **Hủy nhắc nhở khi công việc kết thúc sớm**: khi ứng dụng cập nhật `tasks.status` sang `COMPLETED` hoặc `CANCELLED`, phải trong cùng transaction cập nhật toàn bộ `reminders` của task đó đang ở `SCHEDULED`/`TRIGGERED` sang `CANCELLED` (ERD-R-13). Đây là logic nghiệp vụ ở tầng Service, schema không tự động thực hiện việc này bằng trigger để tránh trigger phức tạp xử lý nhiều bảng liên quan đến gửi thông báo.
- **Sinh công việc lặp kế tiếp**: khi một `TASK` có `repeat_type <> 'NONE'` được đánh dấu `COMPLETED`, tầng Service phải tạo bản ghi `TASK` mới với `parent_task_id` trỏ về task vừa hoàn thành, đồng thời tạo lại các `REMINDER` tương ứng theo thời hạn mới (ERD-R-14). Việc sinh task mới và reminder mới nên nằm trong cùng transaction với thao tác đánh dấu hoàn thành.
- **Giới hạn hoãn báo thức**: `reminders.snooze_count` được kiểm tra bằng `CHECK` constraint (0–3); tầng Service chịu trách nhiệm không cho phép gọi API hoãn khi `snooze_count` đã đạt 3.
- **Múi giờ**: toàn bộ cột thời gian dùng kiểu có timezone (`TIMESTAMPTZ` trên PostgreSQL, `DATETIMEOFFSET`/lưu UTC trên SQL Server) để đảm bảo tính đúng giờ khi đồng bộ giữa Website và Mobile App ở các múi giờ khác nhau.
