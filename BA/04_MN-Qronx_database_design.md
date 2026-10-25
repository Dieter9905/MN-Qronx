# Cơ sở dữ liệu MN-Qronx

> Tài liệu này thay thế `04_TaskAlarm_database_design.md`.

## 1. Nguồn sự thật và cách triển khai

Cơ sở dữ liệu của MN-Qronx là **PostgreSQL** và được quản lý bằng **Prisma ORM**.

- **Nguồn sự thật duy nhất:** [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma) — khai báo 27 model, enum, quan hệ và chỉ mục.
- **Đồng bộ schema lên DB:** `npx prisma db push` (chạy thủ công trên VPS sau mỗi lần sửa schema). Prisma không dùng migration có version; schema là bản khai báo được áp trực tiếp.
- **Dữ liệu khởi tạo:** [`backend/prisma/seed.js`](../backend/prisma/seed.js) tạo hai vai trò (`USER`, `ADMIN`), tài khoản admin, một tài khoản demo (gói Plus) cùng danh mục, công việc, việc con, nhắc nhở và một thiết bị mẫu.

Hai tệp SQL trong thư mục này là **bản tham chiếu DDL tương đương** dùng khi cần đọc thiết kế mà không muốn mở Prisma, hoặc khi muốn dựng DB trên hệ quản trị khác:

| Hệ quản trị | Tệp schema | Phiên bản mục tiêu |
|---|---|---|
| PostgreSQL | [mn-qronx_postgresql_schema.sql](mn-qronx_postgresql_schema.sql) | PostgreSQL 15 trở lên |
| SQL Server | [mn-qronx_sqlserver_schema.sql](mn-qronx_sqlserver_schema.sql) | Microsoft SQL Server 2019 trở lên |

> ⚠️ Tệp SQL **không** phải là thứ hệ thống dùng để chạy. Nếu sửa cấu trúc, sửa `schema.prisma` trước rồi cập nhật lại tệp SQL cho khớp.

## 2. Môi trường dữ liệu

| | |
|---|---|
| Nhà cung cấp đang dùng | **PostgreSQL 16 cài ngay trên VPS** (Ubuntu 24.04), chỉ nhận kết nối localhost |
| Chuỗi kết nối trên máy chủ | `/opt/mn-qronx/backend/.env` → biến `DATABASE_URL` (không lộ ra ngoài mạng) |
| Chuỗi kết nối trên máy dev | `backend/.env` |
| Deploy | `render.yaml` đã bị xóa khỏi dự án — backend chạy trên VPS qua systemd `mn-qronx`, không còn Render |

> ⚠️ `backend/.env` trên máy dev nối **thẳng vào dữ liệu thật của khách**. Mọi lệnh xóa phải có `where`, và test chỉ được dọn dữ liệu `*@example.com`.

## 3. Sao lưu và khôi phục

Hệ thống có sẵn hai script Node (không phụ thuộc `pg_dump`):

```bash
# Sao lưu: ghi JSON từng bảng + manifest (số dòng, kiểu cột, khóa ngoại, sequence)
cd backend && npm run db:dump          # → backups/<thời điểm>/

# Khôi phục sang một DB khác
TARGET_DATABASE_URL="postgres://..." npm run db:restore                      # chạy thử (mặc định)
TARGET_DATABASE_URL="postgres://..." npm run db:restore -- --apply           # ghi thật
TARGET_DATABASE_URL="postgres://..." npm run db:restore -- --replace --apply # dọn sạch rồi ghi lại
```

Ba lớp bảo vệ của script khôi phục:

1. **Chạy thử là mặc định** — chỉ in kế hoạch, phải thêm `--apply` mới ghi.
2. **Từ chối DB đích đang có dữ liệu** (trừ khi thêm `--force`) và từ chối nếu đích trùng máy chủ + tên database của nguồn.
3. **Đối chiếu từng dòng sau khi ghi** — lệch là báo đỏ và thoát khác 0.

Toàn bộ việc ghi nằm trong một giao dịch; thư mục `backups/` bị `.gitignore` (là **dữ liệu thật của khách**).

## 4. Các nhóm bảng

| Nhóm | Bảng | Ghi chú |
|---|---|---|
| Tài khoản | `roles`, `app_users`, `refresh_tokens`, `password_reset_requests`, `email_verification_codes` | Phiên đăng nhập + xác thực email |
| Công việc | `categories`, `tasks`, `subtasks`, `reminders` | Lõi nghiệp vụ; `tasks` có `deleted_at` (thùng rác) |
| Thông báo | `devices`, `web_push_subscriptions`, `notification_settings`, `notification_logs`, `custom_sounds`, `app_settings` | Web Push, FCM, âm thanh riêng, cấu hình VAPID |
| Thương mại | `subscriptions`, `payment_orders`, `billing_events`, `billing_settings` | Gói, đơn, chống trùng webhook, cấu hình nhận tiền |
| Tăng trưởng | `point_transactions`, `invitations`, `ai_usage` | Điểm thưởng, mời bạn, hạn mức AI/ngày |
| Cộng tác | `task_shares`, `family_members` | Giao việc và gói Pro Doanh nghiệp |
| Hỗ trợ | `support_conversations`, `support_messages`, `support_attachments` | Chat người dùng ↔ admin |

## 5. Lưu ý khi triển khai ở tầng ứng dụng

- **Scheduler nhắc nhở:** cron chạy **mỗi 1 phút**, quét `reminders` với `status = 'SCHEDULED' AND remind_at <= NOW()`. Chỉ mục `ix_reminders_status_remind_at` phục vụ truy vấn này.
- **Hủy nhắc nhở khi công việc kết thúc sớm:** khi `tasks.status` chuyển sang `COMPLETED`/`CANCELLED`, tầng Service cập nhật trong cùng transaction sang `CANCELLED` cho mọi reminder chưa kích hoạt (ERD-R-09).
- **Sinh công việc lặp kế tiếp:** khi việc có `repeat_type <> 'NONE'` được hoàn thành, tầng Service tạo Task mới (`parent_task_id`) và tạo lại các reminder theo hạn mới, trong cùng transaction (ERD-R-10).
- **Thùng rác:** xóa việc = đặt `deleted_at`; scheduler dọn vĩnh viễn sau 30 ngày và xóa kèm `task_shares` (cascade).
- **Giới hạn hoãn/nhắc dai:** `snooze_count ≤ 3`, `nag_count ≤ 10`; tầng Service chịu trách nhiệm chặn gọi API khi đã đạt trần.
- **Hạn mức gói:** mọi giới hạn (số việc, số nhắc nhở, số danh mục, thiết bị, AI/ngày) đọc từ `backend/src/utils/planLimits.js` — nguồn duy nhất cho cả web và app.
- **Múi giờ:** cột thời gian dùng kiểu có timezone (`timestamptz` trên PostgreSQL, `datetimeoffset`/UTC trên SQL Server) để đảm bảo đúng giờ giữa các thiết bị; ngày nghiệp vụ (báo cáo, điểm, hạn mức AI) tính theo `Asia/Ho_Chi_Minh`.
- **Dữ liệu nhị phân:** `custom_sounds.data` và `support_attachments.data` lưu dạng `bytea`/`varbinary(max)`; kích thước và MIME được kiểm ở tầng ứng dụng.
