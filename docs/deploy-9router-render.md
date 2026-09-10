# Deploy 9Router lên Render (AI thật chạy 24/7, không phụ thuộc máy local)

Mục tiêu: đưa 9Router (gateway AI) lên Render để backend trên `taskalarm-api.onrender.com`
gọi AI thật qua URL công khai, kể cả khi tắt máy tính.

> ⚠️ **Lưu ý giới hạn Render free:** mỗi tài khoản Render chỉ được **1 web service miễn phí**
> (backend `taskalarm-api` đã dùng hết). Vì vậy service 9Router phải dùng gói **Starter ($7/tháng)**
> — bù lại được: luôn bật 24/7 (không ngủ), có disk lưu cấu hình, rất hợp cho AI.

---

## Bước 1 — Tạo web service 9Router trên Render

1. Mở **https://dashboard.render.com** → **New +** → **Web Service**
2. Chọn **"Deploy an existing image from a registry"**
3. Nhập image: **`decolua/9router:latest`**
4. Đặt tên: **`taskalarm-9router`** → chọn Region **Singapore** (cùng vùng với backend)
5. Chọn **Instance Type: Starter ($7/tháng)** — gói này có persistent disk

### Persistent Disk (bắt buộc để cấu hình không bị mất)
- Bấm **Advanced** → **Add Disk**:
  - Mount Path: **`/data`**
  - Size: **1 GB** (đủ dư cho SQLite cấu hình)

### Env Vars (Advanced → Environment)
| Key | Value |
|---|---|
| `INITIAL_PASSWORD` | `jRi30SrH` |
| `JWT_SECRET` | `0c9ea2d755548e838358a42a8da34775e4660feb74308be398a7291b34d6252f` |
| `API_KEY_SECRET` | `ddf3d36c0ad9b257926279e78664e016d401b808b47ccd5d6bf11d4b7fc80023` |
| `MACHINE_ID_SALT` | `b61d74722b5c848c853f444ed861895e` |
| `DATA_DIR` | `/data` |
| `REQUIRE_API_KEY` | `true` (chặn người lạ dùng gateway của bạn) |
| `AUTH_COOKIE_SECURE` | `true` (bắt buộc vì chạy sau HTTPS) |
| `HOSTNAME` | `0.0.0.0` |

> Không cần set `PORT` — Render tự inject. `NODE_ENV` mặc định production trong image.

### Health Check Path
**`/dashboard`** (trang này trả 200 dù chưa đăng nhập; không dùng `/v1/models` vì bị chặn khi `REQUIRE_API_KEY=true`)

6. Bấm **Create Web Service** → chờ deploy xong (~2-3 phút), mở URL: `https://taskalarm-9router.onrender.com/dashboard`

---

## Bước 2 — Cấu hình lần đầu trên dashboard 9Router

1. Mở `https://taskalarm-9router.onrender.com/dashboard` → đăng nhập mật khẩu **`jRi30SrH`**
2. **Providers** → kết nối nhà cung cấp (nên kết nối 2-3 để có dự phòng):
   - **Kiro AI** (đăng nhập bằng Google/GitHub/AWS Builder ID) — model `kr/claude-sonnet-4.5` chất lượng cao, free ~50 credits/tháng
   - **OpenCode Free** — không cần tài khoản, model tự động cập nhật (dự phòng khi Kiro hết quota)
   - Nếu có key trả phí (GLM/MiniMax/OpenRouter…) thì thêm vào cho chắc
3. **API Key** (mục Endpoint / API Keys) → **tạo 1 key** → copy lại (dùng cho backend)

---

## Bước 3 — Trỏ backend sang 9Router trên Render

1. Render → **taskalarm-api** → **Environment** → thêm / sửa 3 biến:
   - `AI_BASE_URL` = `https://ninerouter-latest-9h6b.onrender.com/v1`
   - `AI_API_KEY` = `<key bạn copy ở Bước 2>` (VD `sk-e07272e88a538143-ukiaax-3d1b9e16`)
   - `AI_MODEL` = `kr/claude-sonnet-4.5` (Claude Sonnet 4.5 qua Kiro)
2. Render tự redeploy → sau ~2 phút, mở `mn-qronx.id.vn` → Tạo nhanh → tab AI → thử.
3. (Tuỳ chọn) Sửa `backend/.env` trên máy local cùng 3 biến trên để dev cũng dùng AI server.

---

## Bước 4 — Kiểm tra

```bash
# Health (không cần key)
curl -I https://taskalarm-9router.onrender.com/dashboard

# List model (cần key)
curl https://taskalarm-9router.onrender.com/v1/models \
  -H "Authorization: Bearer <API_KEY>"

# AI parse task qua backend của bạn
curl -X POST https://taskalarm-api.onrender.com/api/v1/ai/parse-tasks \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"text":"Sáng 7h tập gym. Chiều 2h họp team. Tối 8h đọc sách."}'
```

---

## ⚠️ Lưu ý quan trọng

- **Kiro quota**: tài khoản Kiro free chỉ ~50 credits/tháng — hết thì model `kr/*` báo 403.
  Nếu hết, đổi `AI_MODEL` sang model của **OpenCode Free** (xem trong dashboard → Models)
  hoặc thêm provider trả phí. App đã có **chuỗi model dự phòng** nên không sập.
- **Cấu hình trên server độc lập** với máy local — phải kết nối provider ngay trên dashboard
  của server (không tự đồng bộ qua). Muốn đồng bộ dùng tính năng **Cloud Sync** trong dashboard.
- **Bảo mật**: `REQUIRE_API_KEY=true` đã bật → mọi request tới `/v1/*` phải kèm key.
- Khi máy local tắt, app **vẫn hoạt động bình thường** — không cần mở 9Router local nữa
  (có thể gỡ luôn 9Router khỏi máy).