# MN-Qronx – Web Frontend

> **Plan. Do. On Time.** — Ứng dụng quản lý thời gian & công việc cá nhân với nhắc nhở kiểu báo thức.

Website SPA của **MN-Qronx** (trước đây là TaskAlarm theo tài liệu BA), xây dựng theo:

- `BA/01_TaskAlarm_Business_Analysis.md` – nghiệp vụ, yêu cầu chức năng (FR-01 → FR-31), business rules
- `BA/05_TaskAlarm_API_Specification.md` – quy ước API `/api/v1/**` và envelope chuẩn
- `BA/06_TaskAlarm_Wireframe_Specification.md` – danh sách màn hình (SCR-G-* / SCR-U-* / SCR-A-*)
- `BA/07_TaskAlarm_Architecture.md` – stack: React 18 + Vite + TailwindCSS + Context API

## Công nghệ

| Thành phần | Lựa chọn |
|---|---|
| UI | React 18 + Vite 5 |
| Routing | React Router DOM v6 |
| Styling | TailwindCSS 3 (brand: Navy `#0D1B2A` · Blue `#2563EB` · Cyan `#06B6D4` · Purple `#8B5CF6`) |
| Icons | Phosphor (`@phosphor-icons/react`) |
| Font | Plus Jakarta Sans (Google Fonts) |
| State | Context API (`AuthContext`, `AlarmContext`) |
| Data | Mock service layer trên `localStorage` (mô phỏng REST API, không cần backend) |

## Chạy thử

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # build production vào dist/
npm run preview    # xem bản build
```

## Tài khoản demo

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Người dùng | `minh@mn-qronx.com` | `123456` |
| Quản trị viên | `admin@mn-qronx.com` | `Admin@123` |

Có thể đăng ký tài khoản mới ngay trên trang `/register`.

## Cấu trúc

```
src/
├── components/
│   ├── common/        # Button, Badge, Modal, Toast, Input, EmptyState…
│   ├── layout/        # Sidebar, Header, BottomNav, AppShell, AdminShell
│   ├── Logo.jsx       # Logo MN-Qronx (chữ Q = đồng hồ + dấu tích)
│   └── AlarmOverlay.jsx  # SCR-U-07 – báo thức toàn màn hình
├── context/
│   ├── AuthContext.jsx    # Đăng nhập/đăng xuất, phiên JWT (giả)
│   └── AlarmContext.jsx   # Poll reminder đến hạn, phát âm thanh, hoãn/tắt
├── pages/
│   ├── guest/         # Landing, Đăng nhập, Đăng ký, Quên/Đặt lại mật khẩu
│   ├── user/          # Dashboard, Công việc, Chi tiết, Form, Lịch, Danh mục, …
│   └── admin/         # Dashboard hệ thống, Quản lý người dùng
├── services/          # Lớp gọi API mô phỏng (auth, task, reminder, device…)
└── lib/               # db.js (seed + localStorage), constants, format thời gian VN
```

## Tính năng chính (theo BA)

- **Guest**: trang giới thiệu, đăng ký, đăng nhập, quên/đặt lại mật khẩu.
- **User**: dashboard cá nhân; CRUD công việc + việc con + nhắc nhở (tối đa 5); lặp lại Ngày/Tuần/Tháng;
  lịch Ngày/Tuần/Tháng; danh mục (màu, ẩn/hiện); tìm kiếm & lọc; lịch sử thông báo;
  cài đặt thông báo (âm thanh, hoãn mặc định, rung); quản lý thiết bị; hồ sơ; đổi mật khẩu.
- **Báo thức (cốt lõi)**: bấm chuông ⏰ trên header để mô phỏng báo thức toàn màn hình –
  âm thanh Web Audio, màu nền theo mức ưu tiên, Hoãn (tối đa 3 lần) / Tắt; polling reminder
  đến hạn mỗi 20 giây.
- **Admin**: dashboard hệ thống (thống kê + biểu đồ 7 ngày), quản lý người dùng (khóa/mở khóa) – không xem nội dung công việc của User (BR-19).

## Quy tắc UX áp dụng (theo skill ui-ux-pro-max)

- Trợ năng: focus ring rõ, aria-label, keyboard nav, contrast 4.5:1, `prefers-reduced-motion`.
- Touch: nút tối thiểu 44px, bottom nav ≤ 5 mục + FAB, phản hồi nhấn trong 150ms.
- Responsive: desktop sidebar / tablet thu gọn / mobile bottom nav + drawer.
- Icons: Phosphor SVG (không dùng emoji làm icon chức năng).
