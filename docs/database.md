# Cơ sở dữ liệu: nơi ở, sao lưu, và cách đổi nhà cung cấp

## Vì sao có tài liệu này

Postgres free của Render **tự hết hạn**, không phải hỏng: ngày 06/10/2026 Render
báo DB `mn-qronx` bị treo rồi xoá dữ liệu sau một thời gian gia hạn. Đây là bản
chất của gói free, không phải sự cố một lần — dựng lại một DB free mới của Render
chỉ đổi lấy 90 ngày nữa, rồi lặp lại đúng câu chuyện.

Vì vậy dữ liệu đã được chuyển sang **Tiger Cloud** (750 MB, vùng `ap-southeast-1`
Singapore, không đặt hạn thời gian). Tài liệu này ghi lại cách sao lưu, cách
khôi phục, và những cạm bẫy đã gặp — để lần sau làm lại mất vài phút chứ không
phải dò lại từ đầu.

## Hiện trạng

| | |
|---|---|
| Nhà cung cấp | Tiger Cloud (Timescale), vùng Singapore |
| Engine | PostgreSQL (Prisma, `provider = "postgresql"`) |
| Quy mô | 27 bảng, 236 dòng lúc chuyển (06/10/2026) |
| Chuỗi kết nối trên máy chủ | dashboard Render → service `taskalarm-api` → `DATABASE_URL` |
| Chuỗi kết nối trên máy dev | `backend/.env` |

`render.yaml` để `DATABASE_URL` ở dạng `sync: false` vì DB **không còn do Render
quản lý** — biến phải đặt trong dashboard, không lấy từ `fromDatabase` nữa.

> ⚠️ `backend/.env` trên máy dev nối **thẳng vào dữ liệu thật của khách**. Mọi
> lệnh xoá phải có `where`, và test chỉ được dọn dữ liệu `*@example.com`.

## Sao lưu

```bash
cd backend && npm run db:dump          # → backups/<thời-điểm>/
```

Mặc định ghi vào `backups/<ISO>/`, gồm:

- `<tên-bảng>.json` — toàn bộ dòng của bảng đó
- `_manifest.json` — số dòng, cột + kiểu, khoá ngoại, và `last_value` của mọi
  sequence

**Vì sao không dùng `pg_dump`?** Máy dev không có PostgreSQL client. Nhưng cách
này còn chặt hơn cho việc đổi nhà cung cấp: JSON do chính Postgres sinh
(`json_agg`) nên ngày giờ, số thập phân, enum, `bytea`, mảng đều ra đúng định
dạng chuẩn — phía Node không phải tự đoán kiểu rồi tự chuyển.

`backups/` nằm trong `.gitignore` (cả `backend/.gitignore` lẫn gốc): đây là **dữ
liệu thật của khách**, không bao giờ được đẩy lên git.

## Khôi phục sang DB khác

```bash
cd backend
TARGET_DATABASE_URL="postgres://..." npm run db:restore                      # chạy thử
TARGET_DATABASE_URL="postgres://..." npm run db:restore -- --apply          # ghi thật
TARGET_DATABASE_URL="postgres://..." npm run db:restore -- --replace --apply # xoá sạch rồi ghi lại
```

Script cố tình **không** đọc `DATABASE_URL` làm đích, mà đòi
`TARGET_DATABASE_URL`: trên máy dev `DATABASE_URL` là DB thật, lấy nó làm đích
nghĩa là ghi đè chính dữ liệu đang phục vụ khách.

Ba lớp chặn, theo thứ tự:

1. **Chạy thử mặc định** — chỉ in kế hoạch, phải thêm `--apply` mới ghi.
2. **Từ chối DB đích đang có dữ liệu** (trừ khi thêm `--force`), và từ chối nếu
   đích trùng đúng máy chủ + tên database của nguồn.
3. **Đối chiếu từng dòng sau khi ghi** — so nội dung DB đích với file sao lưu
   theo kiểu chuẩn hoá (sắp khoá, sắp thứ tự dòng). Lệch là báo đỏ và thoát
   khác 0, chứ không chỉ kiểm số dòng.

`--replace` xoá sạch 27 bảng ở đích (theo thứ tự ngược khoá ngoại) rồi ghi lại.
Dùng cho **lần chốt cuối**, xem mục dưới.

Toàn bộ việc ghi nằm trong **một giao dịch**: hỏng giữa đường thì DB đích không
có dữ liệu dở dang.

## Chuyển nhà cung cấp: các bước

1. **Tạo dịch vụ Postgres mới** (vùng Singapore để độ trễ không đổi).
2. **Dựng schema**, đừng để app tự làm. Đừng dùng `prisma db push` ở bước này:
   nó đọc biến `DATABASE_URL`, mà trên máy dev biến đó là **DB thật** — gõ nhầm
   là `db push` chạy thẳng vào dữ liệu khách. Truyền địa chỉ đích tường minh:
   ```bash
   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > backups/_schema.sql
   npx prisma db execute --url "postgres://..." --file backups/_schema.sql
   ```
3. **Khôi phục dữ liệu** — `npm run db:restore -- --apply` (mục trên).
4. **Chạy thử app thật trên DB mới** trước khi trỏ khách sang: khởi động API với
   `DATABASE_URL` trỏ vào DB mới, rồi kiểm `/health`, `/me`, đọc và tạo một việc.
   Bước này bắt được cả lỗi sequence lẫn lỗi khoá ngoại.
5. **Chốt cuối** (xem mục dưới) ngay trước khi đổi cấu hình.
6. **Đổi `DATABASE_URL` trên Render** (dashboard) rồi deploy lại.
7. **Đổi `DATABASE_URL` trong `backend/.env`** của máy dev sang DB mới.
8. **Giữ DB cũ vài ngày** rồi mới xoá.

### Chốt cuối, để không mất dòng nào

Khôi phục luôn là ảnh chụp tại một thời điểm. Giữa lúc sao lưu và lúc đổi cấu
hình, app cũ **vẫn ghi được** — một khách đăng ký trong khoảng đó sẽ nằm lại DB
cũ và mất hút. Vì vậy bước cuối là:

1. Để `backend/.env` **vẫn trỏ DB cũ** cho tới lúc này: mọi thứ ghi ở máy dev
   trong lúc chờ đều rơi vào DB cũ, nên lần sao lưu cuối gom được hết. Trỏ sớm
   vào DB mới rồi ghi lại từ đầu là tự xoá dữ liệu mình vừa tạo.
2. `npm run db:dump` — sao lưu lại, lần này là bản chụp mới nhất.
3. `npm run db:restore -- --replace --apply` — xoá sạch đích, ghi lại, đối chiếu.
4. Lúc này mới đổi `DATABASE_URL` trên Render và trong `backend/.env`.

Repo chưa có thư mục migration (`prisma/migrations/`) — schema được áp bằng
`prisma db push`, chạy trong `startCommand` mỗi lần deploy. Muốn dựng schema ở
DB mới bằng SQL thuần thì dùng:

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

## Cạm bẫy đã gặp thật

- **Thứ tự cột khác nhau giữa hai DB.** DB lâu ngày có cột xếp theo thứ tự được
  thêm vào; DB dựng mới xếp theo `schema.prisma`. Lệch thứ tự là bình thường và
  vô hại, vì câu lệnh ghi liệt kê tên cột ở cả hai phía — nhưng phải so **tập**
  cột, đừng so thứ tự, kẻo bỏ qua một lần chuyển đúng.
- **Sequence.** Nếu chỉ đặt `max(id)` thì id của những dòng đã xoá trước đây sẽ
  bị dùng lại ở DB mới. Vì vậy bản sao lưu lấy luôn `last_value` thật của từng
  sequence. Quên chỉnh sequence thì lần tạo mới đầu tiên sẽ đụng khoá chính.
- **`seed` chạy mỗi lần deploy** (`startCommand`). Các lệnh `upsert` theo khoá
  duy nhất nên vô hại; nhưng nếu khôi phục dữ liệu **sau** khi app đã chạy thì
  roles/danh mục sẽ bị nhân đôi.
- **`json` không có toán tử `=`** trong Postgres: muốn so hai giá trị JSON phải
  ép `::jsonb`.

## Đã kiểm chứng (06/10/2026)

Toàn bộ đường di chuyển đã được **diễn tập trên một DB tạm cùng máy chủ** trước
khi đụng tới DB mới, rồi mới thi hành thật lên Tiger Cloud:

- Dựng schema mới từ `schema.prisma` (không dùng `db push` để tránh nhầm DB).
- Khôi phục 236/236 dòng, cả 27 bảng đúng số dòng như bản sao lưu.
- Đối chiếu từng dòng: DB đích giống hệt bản sao lưu.
- 25/25 sequence khớp đúng `last_value` của nguồn.
- Khởi động chính API đó trên DB mới, dùng token thật của một tài khoản đã phục
  hồi: `GET /health` 200, `GET /me` 200, `POST /tasks` **201** với id **4687**
  (đúng ngay sau id lớn nhất 4686 — chứng minh sequence không đụng khoá chính).
- `--replace --apply` chạy lại trên dữ liệu đã có: xoá sạch theo đúng thứ tự
  khoá ngoại rồi ghi lại, kết quả vẫn khớp từng dòng.
- Dung lượng dùng: 13 MB / 750 MB của gói free.
