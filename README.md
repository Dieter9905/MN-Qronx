# MN-Qronx

> **Plan. Do. On Time.** — Ứng dụng quản lý thời gian & công việc cá nhân với nhắc nhở kiểu báo thức.

Website SPA của **MN-Qronx** (trước đây là TaskAlarm theo tài liệu BA), xây dựng theo các tài liệu trong thư mục [`BA/`](BA):

| Tài liệu | Nội dung |
|---|---|
| [`BA/01_MN-Qronx_Business_Analysis.md`](BA/01_MN-Qronx_Business_Analysis.md) | Nghiệp vụ, yêu cầu chức năng (FR-01 → FR-71), business rules |
| [`BA/02_MN-Qronx_Diagrams.md`](BA/02_MN-Qronx_Diagrams.md) | Use Case & Activity Diagram |
| [`BA/03_MN-Qronx_ERD.md`](BA/03_MN-Qronx_ERD.md) | ERD 27 model (theo Prisma) |
| [`BA/04_MN-Qronx_database_design.md`](BA/04_MN-Qronx_database_design.md) | Cơ sở dữ liệu, sao lưu/khôi phục |
| [`BA/05_MN-Qronx_API_Specification.md`](BA/05_MN-Qronx_API_Specification.md) | Quy ước API `/api/v1/**` và envelope chuẩn |
| [`BA/06_MN-Qronx_Wireframe_Specification.md`](BA/06_MN-Qronx_Wireframe_Specification.md) | Danh sách màn hình (SCR-G-* / SCR-U-* / SCR-A-*) |
| [`BA/07_MN-Qronx_Architecture.md`](BA/07_MN-Qronx_Architecture.md) | Kiến trúc hệ thống, stack công nghệ |
| [`BA/08_MN-Qronx_Backend_Implementation_Plan.md`](BA/08_MN-Qronx_Backend_Implementation_Plan.md) | Kế hoạch & trạng thái backend |
| [`BA/09_MN-Qronx_Technical_Spec.md`](BA/09_MN-Qronx_Technical_Spec.md) | Đặc tả kỹ thuật backend theo module |
| [`BA/mn-qronx_postgresql_schema.sql`](BA/mn-qronx_postgresql_schema.sql) / [`BA/mn-qronx_sqlserver_schema.sql`](BA/mn-qronx_sqlserver_schema.sql) | Schema SQL tham chiếu |

## Công nghệ

| Thành phần | Lựa chọn |
|---|---|
| UI | React 18 + Vite 5 |
| Routing | React Router DOM v6 |
| Styling | TailwindCSS 3 (brand: Navy `#0D1B2A` · Blue `#2563EB` · Cyan `#06B6D4` · Purple `#8B5CF6`) |
| Icons | Phosphor (`@phosphor-icons/react`) |
| Font | Plus Jakarta Sans (Google Fonts) |
| State | Context API (`AuthContext`, `AlarmContext`) |
| Data | REST API thật (`/api/v1/**`) qua `src/services/apiClient.js`; backend Express + Prisma nằm trong [`backend/`](backend/) |

## Chạy thử

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build production vào dist/
npm run preview    # xem bản build
```

## Deploy lên Vercel

Repo đã cấu hình sẵn (`vercel.json` + `package.json` ở root) nên Vercel tự nhận diện Vite:

- Import repo https://github.com/Dieter9905/MN-Qronx vào Vercel.
- Framework Preset: **Vite** (tự động) · Build Command: `npm run build` · Output Directory: `dist`.
- Cứ mỗi lần push lên `main`, Vercel tự deploy Production.

## Tài khoản demo

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Người dùng | `minh@mn-qronx.com` | `123456` |
| Quản trị viên | `admin@mn-qronx.com` | `Admin@123` |

Có thể đăng ký tài khoản mới ngay trên trang `/register`.

## Cấu trúc

```
.
├── BA/                  # Tài liệu phân tích nghiệp vụ + schema SQL
├── src/
│   ├── components/
│   │   ├── common/      # Button, Badge, Modal, Toast, Input, EmptyState…
│   │   ├── layout/      # Sidebar, Header, BottomNav, AppShell, AdminShell
│   │   ├── Logo.jsx     # Logo MN-Qronx (chữ Q = đồng hồ + dấu tích)
│   │   └── AlarmOverlay.jsx  # SCR-U-07 – báo thức toàn màn hình
│   ├── context/
│   │   ├── AuthContext.jsx    # Đăng nhập/đăng xuất, phiên JWT (giả)
│   │   └── AlarmContext.jsx   # Poll reminder đến hạn, phát âm thanh, hoãn/tắt
│   ├── pages/
│   │   ├── guest/       # Landing, Đăng nhập, Đăng ký, Quên/Đặt lại mật khẩu, Bảng giá, OAuth
│   │   ├── user/        # Dashboard, Công việc, Chi tiết, Form, Lịch, Danh mục, Gói & thanh toán,
│   │   │                # Trợ lý AI, Điểm thưởng, Báo cáo, Kế hoạch tuần, Việc được giao, Cả nhóm, Hỗ trợ…
│   │   └── admin/       # Dashboard hệ thống, Quản lý người dùng, Đơn hàng, Hỗ trợ
│   ├── services/        # apiClient (REST thật) + service theo module (auth, task, billing…)
│   └── lib/             # constants, format, push, useCachedQuery…
├── backend/             # REST API (Express + Prisma) – xem BA/07 và BA/08
├── public/              # favicon, manifest.json, sw.js (PWA)
├── vercel.json          # Cấu hình deploy Vercel
└── package.json         # App Vite React ở root
```

## Tính năng chính

- **Guest**: trang giới thiệu, bảng giá, đăng ký (xác thực email), đăng nhập (mật khẩu/Google), quên & đặt lại mật khẩu.
- **User**: dashboard cá nhân; công việc + việc con + nhắc nhở (số lượng theo gói); lặp lại Ngày/Tuần (chọn thứ)/Tháng;
  thùng rác 30 ngày có khôi phục; lịch Ngày/Tuần/Tháng; danh mục (màu, ẩn/hiện); tìm kiếm & lọc;
  lịch sử thông báo; cài đặt thông báo & âm thanh riêng; thiết bị; hồ sơ; đổi mật khẩu;
  xuất lịch `.ics`; trợ lý AI (hạn mức theo gói); điểm thưởng & mã mời; chat hỗ trợ.
- **Báo thức (cốt lõi)**: overlay toàn màn hình – âm thanh Web Audio, màu nền theo mức ưu tiên,
  Hoãn (tối đa 3 lần) / Tắt; gửi **Web Push** để chuông kêu cả khi đã đóng tab; gói Pro có **nhắc dai** tới khi xác nhận.
- **Gói trả phí**: Miễn phí / Plus / Pro / Pro Doanh nghiệp – thanh toán VietQR, dùng thử 7 ngày, đổi điểm, giao việc & luân phiên (Pro), báo cáo năng suất, kế hoạch tuần.
- **Admin**: dashboard hệ thống, quản lý người dùng (tạo/khóa/mở/đổi gói/xóa), đối soát đơn & cấu hình nhận tiền, trả lời hỗ trợ – không xem nội dung công việc của User (BR-58).

## Quy tắc UX áp dụng (theo skill ui-ux-pro-max)

- Trợ năng: focus ring rõ, aria-label, keyboard nav, contrast 4.5:1, `prefers-reduced-motion`.
- Touch: nút tối thiểu 44px, bottom nav ≤ 5 mục + FAB, phản hồi nhấn trong 150ms.
- Responsive: desktop sidebar / tablet thu gọn / mobile bottom nav + drawer.
- Icons: Phosphor SVG (không dùng emoji làm icon chức năng).
