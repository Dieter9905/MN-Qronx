---
version: 1
slug: "src-pages-guest-landingpage-jsx"
primary_target: "src/pages/guest/LandingPage.jsx"
related_targets: []
---

# Surface brief — landing (khách, chưa đăng nhập)

## Scope & visitor mode

- Target: `src/pages/guest/LandingPage.jsx` (route landing công khai của web MN-Qronx).
- Chế độ khách: người mới, chưa biết sản phẩm; mode surface = Persuade.
- Ngôn ngữ nội dung theo i18n hiện có (`landing` VN/EN); dark + light bắt buộc.

## Audience, job, action, proof, constraints

- Khách mục tiêu: sinh viên/cá nhân tự lập kế hoạch (nhóm/lớp là mở rộng).
- Việc cần làm của họ: không để một việc đến hạn trôi nổi.
- Action chính: đăng ký → đặt báo thức cho việc đầu tiên. Action phụ: bấm thử chuông trên phòng mẫu (demo có nhãn "mẫu").
- Proof: phòng mẫu chạy thật khung đầu (giờ thật, việc mẫu đến hạn, chuông reo khi bấm); bộ đếm & nhật ký đúng hạn đánh nhãn "mẫu"; minh bạch web push + desktop + extension như hiện trạng.
- Constraints: logo Q (đồng hồ + tích) giữ nguyên; slogan "Plan. Do. On Time."; cả sáng lẫn tối; không đổi hàm chức năng/backend; không khai thác những gì sản phẩm chưa có.

## Chosen direction & memorable moment

- Hướng được chọn: **phòng mini-hompy có thể bày** (người dùng chọn trực tiếp trên vòng quyết định, vượt cả THE ROLL là "đồng hồ báo thức để bàn" của tôi).
- Khoảnh khắc đáng nhớ: **chuông trên bàn học trong phòng reo khi một việc đến hạn** — một khoảnh khắc biên đạo riêng: thẻ việc sáng đèn trước, chuông lắc nhẹ reo sau.

## Unresolved decisions

- Mức độ chi tiết minh hoạ SVG phòng: cách vẽ nội thất (cửa sổ vòm, thảm tròn, cây) cần duyệt bằng screenshot mốc trước khi hoàn.
- Bản tối (tối phòng buổi đêm + đèn ấm) và bản sáng (tường hoa) — kiểm tra chuyển dịch giữa 2 mode có mượt không.

---

## Direction contract

THESIS: Trang chủ là NHÀ RIÊNG của bạn: mỗi việc là một món đồ bạn đặt vào phòng, việc đến hạn là món đồ sáng đèn mà chuông đặt cạnh reo. Nó từ chối trật tự SaaS mặc định ("hero gradient + 3 thẻ tính năng").

OWN-WORLD: Porcelain #FFF6EC làm nền; Acorn #8B6F4E làm màu nét nâu của khung lớn, moss #DCE8DF + sage #A9C4B1 làm tường gạch cấu trúc, Oat #EADCC7 làm nền sàn, Blush #F5C9CF riêng cho trạng thái đến hạn, Rain #B7C7D6 trung tính. Mỗi block viền nâu ấm đường mảnh, góc lớn; đường kẻ chấm chia mục; nhãn pill nhỏ; phòng isometric là vật chủ. Chữ hiển thị Baloo 2 (tròn nặng, tự chủ font), thân Nunito; mọi icon một tập vẽ đồng nhất (Phosphor một nét). Bản tối = tường tối + đèn ấm.

STORY: trong 10 giây khách hiểu: app này cho bạn một góc phòng riêng biết nhắc đúng giờ; tin vì thấy phòng mẫu sống thật (giờ thật chạy, việc đến hạn sáng đèn, chuông reo khi bấm); làm: bấm "Bắt đầu phòng của mình" để đăng ký, hoặc "Đặt báo thức" ngay trên thẻ việc mẫu (demo có nhãn).

FIRST VIEWPORT: đúng bố cục của chụp tham chiếu Acornnest: (1) hàng nav pill: logo Q trái; phải là các mục nav + CTA. (2) cột trái: câu dẫn chủ đạo + dòng phụ + 2 CTA; dưới là 3 blip nhỏ. (3) giữa trang: PHÒNG isometric lớn — hai tường hoa và sàn caro; bàn học với 3 mảnh việc, 1 việc sáng đèn, chuông tròn trên bàn; thẻ việc nổi có "Đặt báo thức". (4) cột phải: rail 3 card (Hôm nay; Chuông đổ đúng hạn; Nhật ký đúng hạn). Tách mục bằng đường chấm.

FORM: "phòng mini-hompy bày được" — thế giới dealt từ vòng khảo sát, người dùng chọn trực tiếp trên trang quyết định, đè lựa chọn của tôi (bảng đen là IMPECCABLE'S PICK, đồng hồ để bàn là THE ROLL). seed:62cebed9a676ee7e.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
