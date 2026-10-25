# MN-Qronx AI riêng — train & serve

Model tự train chuyên phân tích câu tiếng Việt thành công việc đúng cấu trúc
form tạo việc (`title*, description, categoryName, dueAt*, priority,
repeatType + repeatDays, reminders, subtasks`).

```
ai/
├── dataset_schema.json   # Schema output chuẩn (form tạo công việc)
├── seed_dataset.jsonl    # 24 mẫu khởi đầu (input → output)
├── train.py              # Fine-tune ViT5 + LoRA (text → JSON)
├── evaluate.py           # Chấm accuracy theo từng field
├── serve.py              # API inference: POST /parse
├── requirements.txt
└── Dockerfile            # Deploy inference server (Render/VPS)
```

## 1. API contract

`POST /parse` — body `{ "text": "..." }`, tối đa 2000 ký tự:

```json
{
  "tasks": [
    {
      "title": "Tập gym",
      "description": "",
      "dueAt": "2026-09-22T07:00:00+07:00",
      "priority": "MEDIUM",
      "repeatType": "NONE",
      "repeatDays": [],
      "reminders": [{ "remindAt": "2026-09-22T06:50:00+07:00" }],
      "categoryName": "Sức khỏe"
    }
  ],
  "model": "mn-qronx-parser-v1-rulebased"
}
```

`priority` ∈ `LOW|MEDIUM|HIGH|URGENT`, `repeatType` ∈ `NONE|DAILY|WEEKLY|MONTHLY`
(`WEEKLY` kèm `repeatDays` 1–7, 1 = Thứ 2). `reminders ≤ dueAt`, tối đa 5.

## 2. Chạy API local (chưa cần train)

`serve.py` có sẵn parser luật tiếng Việt nên chạy được ngay:

```bash
cd ai
pip install fastapi uvicorn
python serve.py  # http://localhost:8000 (GET /health, POST /parse)
```

Trỏ backend tới nó:

```bash
AI_INFER_URL=http://localhost:8000
```

## 3. Thu thập data

`data/train.jsonl` (800 mẫu) + `data/eval.jsonl` (120 mẫu) đã sinh sẵn bằng
`generate_data.py` — mỗi mẫu có mốc `Hôm nay là ...` để model học tính ngày
tương đối, nhãn tính từ slot nên luôn đúng (đã fuzz 5000 mẫu: 0 lỗi giờ,
0 due quá khứ). Sinh lại ĐÚNG bộ đang commit (đổi tham số là ra bộ khác):

```bash
cd ai
PYTHONUTF8=1 python generate_data.py --train data/train.jsonl --eval data/eval.jsonl \
    --n-train 800 --n-eval 120 --seed 42
```

### Lỗi nhãn đã sửa (đừng "sửa lại" thành bản cũ)

Bộ nhãn từng mâu thuẫn với chính câu chữ, làm điểm đo thấp oan cho parser:

| Lỗi trong bộ sinh | Hậu quả |
|---|---|
| `f"thứ {wd + 1}"` (wd là chỉ số Python 0=T2) | câu nói "thứ 4" nhưng nhãn là Thứ Năm: 55/71 việc nêu tên thứ trong `eval.jsonl` lệch **+1 ngày**, và model học luôn ánh xạ sai |
| Câu "khó" lặp tiêu đề: nhãn = việc trước +2h nhưng giữ nguyên **phút** | câu chỉ nói "lúc 9h" mà nhãn 9h15 ⇒ dạy model đoán bừa phút |
| Câu lặp tiêu đề còn +2h vắt qua nửa đêm | nhãn sang **ngày hôm sau** trong khi câu không nói ngày |
| Câu lặp tiêu đề chép cả `priority`/`repeatType` của việc trước | nhãn "quan trọng"/"hàng ngày" mà câu không hề nói (9 ca lệch ưu tiên, 4 ca lệch lặp lại) |
| `"tối nay"` ghép với giờ buổi sáng | câu nói buổi tối, nhãn 08:45 |
| Tên việc "Ăn tối"/"Ăn trưa" ghép với slot sáng | "ăn tối lúc 7 giờ sáng" trong khi parser đọc chữ "tối" trong tên thành 19:00 |

Còn **một nguồn nhiễu cố ý**: `if rng.random() < 0.15: cat = None` xoá danh mục
ngẫu nhiên 15 % số việc dù tên việc nói rất rõ ("Đi siêu thị" → Cá nhân). Vì vậy
`categoryName` chỉ đạt ~87 % dù parser suy luận đúng: muốn con số phản ánh đúng
chất lượng thì bỏ dòng đó (hoặc chấm `None` là "không tính").

Template chỉ dạy được mẫu câu đã biết — sau này bổ sung log thật của người
dùng (câu nào AI đoán sai) vào `data/` để model khôn dần.

## 4. Train thật (GPU local, VD RTX 3050 4GB)

`train.py` dùng QLoRA 4-bit + batch 1 × tích lũy 16 nên vừa VRAM 4GB.
Yêu cầu: NVIDIA driver + torch CUDA (`pip install torch --index-url
https://download.pytorch.org/whl/cu124`), còn lại trong `requirements.txt`.

```bash
cd ai
# torch chưa có wheel cho Python 3.13+ → dùng Python 3.12 (uv tự tải, không cần sudo)
uv venv ~/.venv/mnq-ai --python 3.12
uv pip install --python ~/.venv/mnq-ai/bin/python torch --index-url https://download.pytorch.org/whl/cu124
uv pip install --python ~/.venv/mnq-ai/bin/python -r requirements.txt
~/.venv/mnq-ai/bin/python train.py --train data/train.jsonl --eval data/eval.jsonl --out checkpoints/v1
```

Với 920 mẫu, 5 epochs, RTX 3050 mất **~30–60 phút**, giữ checkpoint
eval tốt nhất (`load_best_model_at_end`). Không có GPU thì thuê Colab T4
làm tương tự. Test khói pipeline (không ra model dùng được):
```bash
python train.py --demo
```
5. Chấm điểm — chấm checkpoint trước, rồi mới chấm qua service:
```bash
python evaluate.py --ckpt checkpoints/v1 --test data/eval.jsonl
```
   Luôn chấm bằng `--ckpt` khi muốn biết **model** làm được gì: chế độ `--url`
   chỉ phản ánh cái đang phục vụ, mà `serve.py` ưu tiên parser luật nên có thể
   che mất lỗi của model (đúng ca đã xảy ra với v1/v2 — 0 % JSON hợp lệ mà
   `/health` vẫn báo `"finetuned": true`).
6. Tải checkpoint về, đổi tên thành `ai/checkpoints/best` (hoặc đặt
   `AI_CKPT=checkpoints/v3`), build lại image và deploy (mục 6) —
   **và nhớ sửa `Dockerfile`: hiện nó chỉ COPY `serve.py` + `dataset_schema.json`,
   không có `checkpoints/`, nên bản deploy thật luôn chạy thuần luật.**

## 4b. Bẫy tokenizer: ViT5 KHÔNG có `{` `}` (đã đo, đã sửa)

ViT5-base có 36.096 token và **không có token nào chứa `{` hay `}`** (trong khi
`[` `]` `"` `:` đều có). Vì target là `json.dumps(...)` nên MỌI dấu ngoặc nhọn bị
mã hoá thành `<unk>` ⇒ nhãn hỏng từ đầu, model không thể học sinh JSON.

`train.py` đã thêm 2 token rồi `resize_token_embeddings`. Nhưng **chỉ thế là chưa
đủ** — đo trên `checkpoints/v2` (250 bước × LR 2e-4):

| Vị trí | Loss | Nghĩa |
|---|---|---|
| 18 vị trí ngoặc nhọn | **≈ 11,5** (p ≈ 1,6e-6) | ngẫu nhiên, chưa học gì |
| 342 vị trí còn lại | **≈ 0,00** | model thuộc làu nội dung |

Hai hàng embedding mới (khởi tạo norm ≈ 26 so với trung vị 60 của các hàng gốc)
gần như không dịch chuyển. LR 2e-4 (Adam chỉ dịch được ~`lr × số bước` mỗi phần
tử) quá nhỏ để 2 hàng đó học. Hệ quả: model trả về **0 % JSON hợp lệ** dù nội
dung (title, dueAt, category) học đúng.

### Recipe đã kiểm chứng (`warmup.py` → `continue_train.py`)

`train.py` tự chạy cả hai bước, nhưng thứ tự và đường đi rất quan trọng:

1. **Train LoRA** như thường (`train.py`, 5 epoch × 800 mẫu ≈ 250 bước).
2. **Lưu checkpoint TRƯỚC**, rồi mới warmup 2 hàng ngoặc bằng
   `warmup.warmup_checkpoint()` — hàm này tự *probe* để chọn đúng tensor
   `lm_head` mà forward dùng (có 3 module cùng chứa tên `lm_head`; chọn sai thì
   huấn luyện vô hiệu mà không báo lỗi). Đo trên `checkpoints/v3`: loss tại
   ngoặc **11,0 → 0,21**, norm 60/68 (trung vị các hàng gốc ≈ 60).
   Gọi cùng đoạn code khi model còn trong bộ nhớ (ngay sau `Trainer.train()`)
   thì **không cập nhật được gì** (11,60 → 10,99, norm đứng yên) — vì vậy hàm
   `brace_warmup` cũ trong `train.py` đã bị bỏ khỏi luồng.
3. **Bắt buộc: huấn luyện CHUNG thêm** (`continue_train.py`, 1500 bước, LR 2e-4)
   cho LoRA + 2 hàng ngoặc. Bỏ bước này thì output lặp ngoặc vô hạn:
   `{}} "tasks"} "title"} "title"}…` — vì LoRA đã học để phối hợp với *hướng
   ngẫu nhiên cũ* của 2 hàng, thay hướng mà không huấn luyện lại thì sụp.

**Chỉ huấn luyện hàng `lm_head`, không đụng hàng input `shared`**: text đầu vào
không bao giờ chứa `{` nên hàng input không nhận gradient, và model đã học hành
vi ứng với vector nhiễu đó — đổi nó sẽ phá phần nội dung.

```bash
python train.py --out checkpoints/v5                 # train + warmup + 1500 bước chung
python warmup.py --ckpt checkpoints/v5 --dry-run     # chỉ đo, không ghi
python continue_train.py --ckpt checkpoints/v4 --steps 1500 --measure 4
```

### Giải mã cũng quyết định (đo trên `checkpoints/v6`, 4 mẫu eval)

| Cấu hình | JSON hợp lệ | Việc sinh ra / kỳ vọng | Ghi chú |
|---|---|---|---|
| greedy | 3/4 | 7/10 | **lặp/nhân đôi** việc ("Đọc sách" hai lần) |
| beams=4 | 3/4 | 5/10 | có mẫu đứt giữa chừng |
| **beams=4 + `no_repeat_ngram_size=8`** | **4/4** | 5/10 | cấu hình `serve.py` dùng |
| beams=4 + `rep_pen 1.05` + `lp 1.3` | 3/4 | 5/10 | ra được 3 việc/4 nhưng cũng lặp |

Cấu hình trong `serve.py` và `evaluate.py` **phải trùng nhau**, nếu không con số
chấm được không mô tả cái đang phục vụ thật.

### Chọn engine: đã sửa lỗi model ghi đè luật (đo trên 6 câu thật)

`/parse` chạy parser luật trước, rồi CHỈ thay bằng model nếu model không bỏ sót
việc nào. Trước đây điều kiện là `len(ml) >= len(rule)` **và không ghép gì**, nên
khi hai bên hoà số việc thì kết quả TỆ ĐI — model trả `dueAt: null`, mất nhắc
nhở, mất “hàng ngày”/“khẩn cấp”:

| Câu | Trước (`>=`, không ghép) | Sau (`_merge_hybrid`) |
|---|---|---|
| "Sáng 7h tập gym, nhắc trước 10 phút" | `None` · 0 nhắc · 1 việc | **07:00** · 1 nhắc |
| "Họp team ngày kia 14h, nhắc trước 30 phút" | luật | **hybrid** 25/09 14:00 |
| "Uống thuốc hàng ngày lúc 8h sáng, quan trọng" | 20:00 · MEDIUM · NONE | **08:00 · HIGH · DAILY** |
| "Buy milk tomorrow at 8am, remind me 30 min before" | 20:00 · 0 nhắc | **24/09 08:00** · 1 nhắc |
| "Đóng tiền điện 20h ngày 30, khẩn cấp" | 23/09 20:00 · MEDIUM | **30/09 20:00 · URGENT** |
| "Trưa nay ăn trưa… Chiều họp… Tối ăn tối…" | luật (3 việc) | luật (3 việc) |

Quy tắc ghép: giữ **tiêu đề của model** (95,5 %), lấy **ngày giờ + nhắc nhở
của luật** (luật là nguồn chính, kể cả khi model có trả giá trị — nó từng trả
20:00 cho câu ghi “8h sáng”), và chỉ mượn `priority`/`repeatType`/`categoryName`
của luật khi model để ở giá trị mặc định. Không bao giờ xoá dữ liệu luật đã tìm.

### Kết quả chấm trên TOÀN BỘ `data/eval.jsonl` (120 mẫu, `checkpoints/v6`)

```
python evaluate.py --ckpt checkpoints/v6 --test data/eval.jsonl
```

| Chỉ số | v2/v3 (trước khi sửa đủ) | v6 (bây giờ) |
|---|---|---|
| JSON đọc được | **0/120 = 0 %** | **106/120 = 88,3 %** |
| Đúng số việc | 0 % | 53/120 = 44,2 % |
| Tiêu đề đúng | 0 % (không có JSON) | **105/110 = 95,5 %** |
| `dueAt` đúng ngày | — | 17/110 = 15,5 % |
| `dueAt` đúng giờ | — | 13/110 = 11,8 % |
| `priority` | — | 65,5 % |
| `repeatType` | — | 77,3 % |
| Số nhắc nhở | — | 80,9 % |
| `categoryName` | — | 73,6 % |

**Đọc bảng này cho đúng**: tiêu đề gần như hoàn hảo, nhưng `dueAt` chỉ 12-16 %
và mô hình **không dùng được cho production**. Ba kiểu sai quan sát được:

- **Bỏ trắng ngày giờ**: nhiều mẫu trả `"dueAt": null` dù câu có nêu giờ
  ("Đóng tiền điện 20h" → `null`).
- **Lẫn giữa các việc**: "Họp team ngày kia 14h" (kỳ vọng 10/01 14:00) lại ra
  26/01 14:00 — lấy **ngày của việc thứ hai** ghép với **giờ của việc thứ nhất**.
- **Không đổi buổi sang 24h**: "tối 8h30" ra 13:30 thay vì 20:30.

Nguyên nhân: đây là số học ngày tháng tương đối (`ngày kia`, `thứ 4`, `tối`),
thứ mà T5-base 800 mẫu không học nổi. **Parser luật làm đúng phần này** (đo trên
input người dùng thật: 4/4). Vì vậy `serve.py` vẫn ưu tiên luật và chỉ thay bằng
model khi `len(ml_tasks) >= len(rule_tasks)` — thực tế bản đang chạy là luật.

⇒ **Hướng đúng tiếp theo là lai (hybrid)**: lấy `title`/`priority`/`categoryName`
từ model (mạnh) và lấy `dueAt`/`reminders` từ parser luật (mạnh), thay vì để
một bên làm hết.

## 5. Đánh giá

```bash
# Chấm checkpoint ngay trên máy (đúng prompt lúc train, KHÔNG bị service lùi về luật)
python evaluate.py --ckpt checkpoints/v3 --test data/eval.jsonl

# Chấm cái đang phục vụ thật qua HTTP (KHÔNG --strip-date: xem "Hai cái bẫy")
python evaluate.py --url http://localhost:8000 --test data/eval.jsonl
```

Chấm từng field: JSON đọc được, số việc, title, dueAt (ngày + giờ), priority,
repeat, reminder, category.

Hai cái bẫy của harness (đã xử lý trong `evaluate.py`):

- Chế độ `--url` **KHÔNG** được kèm `--strip-date`. `data/eval.jsonl` có `input`
  mở đầu bằng câu tổng hợp "Hôm nay là …, ngày dd/mm/yyyy." và **mỗi mẫu một mốc
  khác nhau** (trải từ 01/2026 đến 11/2026); nhãn `dueAt` là ngày tuyệt đối tính
  từ mốc đó. Bỏ câu mốc đi thì parser lấy ngày thật của máy ⇒ mọi so sánh ngày
  đều trượt và `due_day` chỉ còn ~4 % (con số vô nghĩa, từng che mất việc parser
  vứt bỏ thông tin ngày). Parser luật đọc đúng câu mốc đó (`serve._ctx_anchor`)
  và không biến nó thành việc ảo (nhờ `_CTX_SENT_RX`), nên cổng
  `--min-task-count` đạt bình thường. Chỉ dùng `--strip-date` khi muốn kiểm tra
  riêng phần chữ (title/priority/category).
- `--max-new` mặc định 500: output 3-5 việc cần ~350-450 token, cắt ở 256 làm
  JSON luôn hỏng dù model sinh ngoặc đúng.

## 6. Deploy

Production bây giờ chạy AI ngay trên VPS (không còn dùng Render):

- Code ở `/opt/mn-qronx/ai`, venv Python tại `ai/venv` (fastapi + uvicorn).
- systemd service `mn-qronx-ai`: `uvicorn serve:app --host 127.0.0.1 --port 8000`,
  chỉ nghe loopback — backend gọi nội bộ qua `AI_INFER_URL=http://127.0.0.1:8000`.
- Khởi động lại: `systemctl restart mn-qronx-ai`, log: `journalctl -u mn-qronx-ai -f`.

Copy checkpoint đã train vào `ai/checkpoints/best` rồi khởi động lại service —
`serve.py` tự dùng model fine-tune thay vì parser luật.

Ba điều cần biết trước khi trông đợi production dùng model:

1. Bản đang chạy **chưa có `checkpoints/best`** ⇒ chạy parser luật.
2. VPS (2 vCPU, không GPU): sinh ~450 token cho một câu 3-5 việc mất hàng chục
   giây, vượt `AI_MODEL_TIMEOUT` (mặc định 8 s) nên `serve.py` sẽ lùi về luật.
   Muốn dùng model thật thì cần GPU (hoặc lượng tử hoá int8/ONNX cho CPU).
3. `GET /health` giờ báo `engine`: `rule-only` hay `model+rule`, kèm
   `checkpoint_present` — trước đây chỉ kiểm tra thư mục tồn tại nên báo
   `finetuned: true` một cách sai.
