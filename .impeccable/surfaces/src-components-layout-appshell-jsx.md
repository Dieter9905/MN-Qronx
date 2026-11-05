---
version: 1
slug: "src-components-layout-appshell-jsx"
primary_target: "src/components/layout/AppShell.jsx"
related_targets: ["src/components/layout/Sidebar.jsx","src/components/layout/Header.jsx","src/components/layout/BottomNav.jsx","src/components/layout/WorkspaceSwitcher.jsx","src/components/layout/SupportBadge.jsx","src/components/layout/DesktopBanner.jsx","src/components/MascotBot.jsx","src/pages/user/DashboardPage.jsx","src/components/TodayBrief.jsx"]
---

# Surface brief — shell + dashboard (mở rộng thế giới phòng)

## Scope & visitor mode

- Target: `src/components/layout/AppShell.jsx` (khung app: Sidebar + Header + BottomNav + MobileDrawer + QuickCapture/FocusMode/ShortcutsModal + phím tắt + route-beam/page-enter). Related: `src/components/layout/Sidebar.jsx`, `src/components/layout/Header.jsx`, `src/components/layout/BottomNav.jsx`, `src/pages/user/DashboardPage.jsx`, `src/components/TodayBrief.jsx` — cộng `src/components/common/RoomUI.jsx` ở mức TÁI DÙNG lớp da có sẵn; `src/components/TaskItem.jsx` chỉ Ở MỨC THÊM biến thể skin phòng qua prop tùy chọn (mặc định giữ nguyên diện mạo cũ — file còn được dùng ở nhiều trang ngoài mốc này); `src/components/WorldLogo.jsx` (chữ đặc, tái dùng).
- Route: `/app` — shell phủ toàn bộ app; mốc này duyệt vỏ shell + trang dashboard. Không đụng các trang user khác (duyệt từng đợt sau), không đụng AdminShell; sketch quyết định `.impeccable/mocks/decision/*` chỉ là critique reference, không build từ file đó.
- Mode: **Operate** (người dùng vào đây để làm việc — mode rules: thế giới chỉ mượn type/palette/density/1 signature move; nav + controls vẫn là component web chuẩn; màn không được đọc như artifact của thế giới).
- Logic/API/i18n giữ 100%: `getDashboard`, `completeTask`, `getMyBilling`, `useCachedQuery` (cache hiển thị ngay, reload ngầm), phím tắt Ctrl+N/H/T/L/,,/D/K/F, QuickCapture, FocusMode, MobileDrawer + WorkspaceSwitcher (lọc theo onlyTypes), DemoAlarmButton, banner hạn gói (≤7 ngày), TodayBrief (toast 1 lần/ngày khóa `mnq:todayBriefShown`), PLAN_NAMES/PLAN_BADGE, toàn bộ `t.*` 2 ngôn ngữ, aria-label hiện có; giữ Skeleton/EmptyState/useSlowHint.
- Lượt build: **code-led** (harness không có image-gen; không comp lưới đo phút). Craft floor áp dụng đầy đủ: no kicker/eyebrow (kể cả nhãn section uppercase nhỏ), no gradient text, no glass, no colored border-left >1px, no hard offset shadow, no icon-tile-stack, no emoji-as-icons, ONE authored motion, token prefix `room-`; Blush chỉ trạng thái đến hạn/phòng; Rain trung tính cho lỗi/chờ.
- Sáng + tối bắt buộc; mọi số liệu là dữ liệu thật từ API (không dữ liệu demo sống trong build; số trong sketch Nam/3 quá hạn/streak 12 chỉ là material duyệt bố cục).

## Audience, job, action, proof, constraints

- Người dùng mục tiêu: cá nhân/sinh viên/người trong nhóm đã đăng nhập, mở app mỗi ngày về chính nhà mình.
- Việc cần làm đi qua màn này: nắm hôm nay trong vài giây, không bỏ sót việc đến hạn/quá hạn, hoàn thành ngay từ hàng trong danh sách.
- Action chính: chạm check hoàn thành (toggle `completeTask` ổn định), mở chi tiết việc, tạo việc mới (QuickCapture/phím tắt/FAB), đọc trạng thái gói, đi qua điểm thưởng.
- Proof: PRODUCT.md định vị "một công việc đến hạn không bị bỏ sót" — hàng đến hạn phải là thứ chạm đầu tiên; discipline màu chứng minh cơ chế (Blush chỉ đến hạn, Rain trung tính); thống kê không lệch API; visual nằm trong `DESIGN.md`.
- Constraints: logo Q + slogan giữ nhà; không bịa field API mới; copy là `t.*` i18n hiện có (không chữ cứng ngoài i18n); PLAN_BADGE không sửa nguyên file (Admin dùng chung) — chỉ đè màu tại nơi dùng trong shell; không đổi route/shortcut/hành vi; shell áp `room-world` cho toàn `/app`.

## Chosen direction & memorable moment

- Cấu trúc đã khoá qua roll `seed:3650682e151ab039` (dealt 4/7/2 — index 4 lead): **Tủ hai cánh (split)** — dealt card thứ ba trên trang quyết định; sketch `.impeccable/mocks/decision/split.html` đi kèm như critique reference cho review code-led.
- Điểm nhấn user đã chốt cho mốc dashboard: **việc đến hạn + quá hạn nổi bậc**, **streak / điểm thưởng**, **tổng quan ngày hôm nay**; giữ logic/API/i18n.
- Khoảnh khắc đáng nhớ: **thẻ dán tape "Nhật ký đúng hạn" trên mặt tủ phải — món sticker duy nhất của phòng trong một màn product chuẩn (signature move duy nhất)**: số streak Baloo 2, icon Flame một nét, nút "Nhận thưởng" paper pill; không vẽ chuỗi chấm "tuần này" vì chưa có data theo tuần (không claim gì API không có). Authored motion duy nhất: `room-due-glow` (2.6s) trên chấm trạng thái của hàng việc đến hạn đầu tiên.

## Unresolved decisions

- Thứ tự khối tủ phải (sticker → tổng quan → vòng % → AI → note) cần duyệt bằng screenshot: nếu tủ quá dài thì vòng % + legend phải gọn lại.
- tryAlarm (banner mời chuông cũ): giữ nguyên copy i18n, nhưng xem ở mốc ảnh nên để note Moss trong tủ hay hàng mỏng cuối bàn.
- BottomNav da phòng (FAB giữa + sliding pill) giữ được touch 44px và đo lại pill trượt đúng khi đổi token.

---

## Direction contract

THESIS: Dashboard là mặt bàn làm việc trong phòng mini-hompy — cánh trái để làm việc (quá hạn trước, việc hôm nay, hoàn thành ngay từ hàng), cánh phải là tủ thông tin luôn mở sẵn (sticker streak, tổng quan số, vòng %, AI, điểm thưởng); nav và controls vẫn đọc như web chuẩn, vì đây là Operate: thế giới chỉ vẽ vào chữ (Baloo 2/Nunito), màu token phòng, mật độ thẻ giấy và một signature nằm trên mặt tủ.

OWN-WORLD: nền Porcelain `rgb(var(--room-paper))` (tối đi qua token), chữ Ink, nét móc Acorn; Baloo 2 cho heading/số lớn, Nunito cho thân; panel là thẻ giấy phẳng ring Acorn/25 + shadow paper-weight `0 18px 34px -22px rgb(0 0 0 / 0.25)`, bo lớn; dot-divider chia trường giữa các khối; Blush DUY NHẤT cho trạng thái đến hạn/quá hạn của việc (nền hàng `blush/40`, chấm trạng thái, chữ `on-blush`), Rain trung tính cho lỗi/chờ và cho rail "đã trôi" (không rose đỏ gấp gáp), Moss/Oat cho note dán; icon Phosphor một nét — mọi emoji ký tự (🔥/🎁/👋) thay bằng icon đúng nghĩa (Flame/Gift) hoặc bỏ; BAN: không gradient (4 StatCard, banner chào navy, rewards navy–tím, ring 3 màu, FAB brand-gradient đều về da phòng), không glass, không hard offset shadow, không icon-tile-stack, không kicker/eyebrow, không border trái màu >1px; nút theo ramp RoomUI: chính = Acorn pill Baloo 2 + shadow `0 14px 26px -12px rgb(0 0 0 / 0.30)` hover `brightness-[0.96]`, phụ = paper pill ring Acorn/40 hover Oat/60; dark = phòng buổi đêm qua token tối — lamp-glow chỉ 1 chỗ trang trí nhanh, không rải khắp; **authored motion DUY NHẤT**: `room-due-glow` (roomGlowPulse 2.6s) trên chấm trạng thái của hàng việc đến hạn đầu tiên — ngoài ra chỉ còn hover dịch nhẹ/brightness, không thêm chuyển động trí.

STORY: trong 5 giây thấy bàn và tủ: một dòng chào gọn trên bàn, rail quá hạn (khi có) là thứ đầu tiên chạm mắt bên bàn trái, sticker streak ngay mặt tủ; trong 15 giây người dùng chạm check một hàng, hàng mờ nhẹ và toast báo như cũ; trong 30 giây lướt tủ đọc đủ: tổng quan 4 số (lần này không gradient), vòng %, gói, điểm thưởng; hôm nay trống thì bàn hiện chỗ trống gọn với EmptyState da phòng — không minh hoạ giả data nào.

FIRST VIEWPORT (lg+): Sidebar trái là vỏ phòng (sticky, NAV_GROUPS chuẩn, item active = pill Oat, WorkspaceSwitcher/SupportBadge/Pro chip giữ vai) và Header trên là vỏ phòng (tìm nhanh, DemoAlarmButton, theme/lang, avatar + PLAN_BADGE da phòng — logic menu nguyên). Nội dung chia 2 pha trên `xl`: BÀN TRÁI ~2/3 cột đơn: dải chào 1 dòng (t.welcome + tên + today + quote nhỏ t.dashQuote — không banner navy); khi `overdueCount > 0` rail Rain/30 + WarningCircle + count + link đứng trên cùng; banner hạn gói ≤7 ngày (logic giữ) là thẻ Oat với BellRinging, không amber-gradient; panel "Việc của hôm nay": hàng TaskItem da phòng (đến hạn nền Blush/40) + link chữ "Xem tất cả"; trống = EmptyState da phòng. TỦ PHẢI ~1/3: (1) sticker tape streak — số lớn + Flame + CTA phụ "Nhận thưởng" → `/app/rewards`; (2) Tổng quan ngày hôm nay: 2×2 số Baloo từ cùng data cũ (todayCount→tasks, overdueCount→tasks, completedCount→tasks, upcomingCount→calendar) thay 4 StatCard gradient; (3) vòng % thuần Acorn (giữ logic SVG của ProgressRing, bỏ gradient 3 màu) + legend 4 hàng; (4) hàng nhỏ Trợ lý AI; (5) note Moss gợi mở (motivation + tryAlarm — copy giữ nguyên vai, chỉ đổi da). MOBILE (390): BottomNav da phòng (4 mục + FAB giữa, sliding pill giữ logic đo), MobileDrawer da phòng; bảng xếp chồng: chào → rail quá hạn → Việc hôm nay → sticker → tổng quan; mọi mốc chạm 44px.

FORM: cấu trúc khoá "Tủ hai cánh" (split) — dealt 4/7/2 của roll `seed:3650682e151ab039`, mode operate; không rút lại, không đổi thế giới; sketch quyết định `.impeccable/mocks/decision/split.html` chỉ làm critique reference.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md extension, and every shipping raster carrying its provenance.
