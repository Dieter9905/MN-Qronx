"""Inference server cho AI riêng MN-Qronx.

- Có checkpoint fine-tune (checkpoints/best) → dùng model.
- Chưa train → parser luật tiếng Việt (đủ chạy production ngay).

Chạy:  uvicorn serve:app --host 0.0.0.0 --port 8000   (thư mục ai/)
API :  GET /health · POST /parse {text} → {tasks, model}
"""
import json
import os
import re
import unicodedata
from datetime import datetime, timedelta, timezone

VN_TZ = timezone(timedelta(hours=7))
MODEL_VERSION = os.environ.get("AI_MODEL_VERSION", "mn-qronx-parser-v1")
# AI_CKPT cho phép trỏ sang bản mới (v3…) mà không phải sửa code.
CKPT = os.environ.get("AI_CKPT") or os.path.join(
    os.path.dirname(__file__), "checkpoints", "best")
# Sinh JSON 3-5 việc cần ~350-450 token; 500 từng làm output bị CẮT giữa chừng
# nên json.loads luôn thất bại dù ngoặc đã học đúng. Đo trên data/eval: độ dài
# target trung bình 345 token, mẫu 5 việc vượt 500 ⇒ để 600.
MAX_NEW_TOKENS = int(os.environ.get("AI_MAX_NEW_TOKENS", "600"))
# Giải mã: ĐO ĐƯỢC mới chọn, không phải phỏng đoán (checkpoint v6, 4 mẫu eval):
#   greedy            → JSON 3/4 nhưng LẶP việc ("Đọc sách" hai lần)
#   beams=4           → JSON 3/4, có mẫu đứt giữa chừng
#   beams=4 + no_repeat_ngram=8 → JSON 4/4, không trùng việc  ← chọn
NUM_BEAMS = int(os.environ.get("AI_NUM_BEAMS", "4"))
NO_REPEAT_NGRAM = int(os.environ.get("AI_NO_REPEAT_NGRAM", "8"))
# Trên CPU (Render free) sinh 500 token mất hàng chục giây ⇒ hết hạn rồi lùi về
# parser luật. Chỉnh qua AI_MODEL_TIMEOUT khi chạy trên GPU.
MODEL_TIMEOUT = float(os.environ.get("AI_MODEL_TIMEOUT", "8"))

_model, _tok = None, None


def try_load_model():
    """Load checkpoint fine-tune (full hoặc LoRA adapter) nếu có."""
    global _model, _tok
    if _model is not None or not os.path.isdir(CKPT):
        return _model is not None
    try:
        import torch
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
        _tok = AutoTokenizer.from_pretrained(CKPT)
        use_cuda = torch.cuda.is_available()
        if os.path.exists(os.path.join(CKPT, "adapter_config.json")):
            from peft import PeftModel
            cfg = json.load(open(os.path.join(CKPT, "adapter_config.json")))
            base_id = cfg.get("base_model_name_or_path") or "VietAI/vit5-base"
            if use_cuda:
                # Cùng lượng tử 4-bit như lúc train + đẩy lên GPU
                from transformers import BitsAndBytesConfig
                base = AutoModelForSeq2SeqLM.from_pretrained(
                    base_id,
                    quantization_config=BitsAndBytesConfig(
                        load_in_4bit=True, bnb_4bit_quant_type="nf4",
                        bnb_4bit_compute_dtype=torch.float16),
                    device_map="auto")
            else:
                base = AutoModelForSeq2SeqLM.from_pretrained(base_id)
            # Checkpoint mới có thêm token '{' '}' → phải mở rộng embedding cho
            # khớp vocab tokenizer trước khi nạp adapter (nếu không sẽ lệch shape).
            if base.config.vocab_size != len(_tok):
                base.resize_token_embeddings(len(_tok))
            _model = PeftModel.from_pretrained(base, CKPT)
        else:
            if use_cuda:
                _model = AutoModelForSeq2SeqLM.from_pretrained(
                    CKPT, device_map="auto")
            else:
                _model = AutoModelForSeq2SeqLM.from_pretrained(CKPT)
        _model.eval()
        _model.config.use_cache = True  # train tắt cache để tiết kiệm VRAM, infer bật lại cho nhanh
        return True
    except Exception:
        _model, _tok = None, None
        return False


def _valid_tasks(tasks):
    return (isinstance(tasks, list) and len(tasks) > 0
            and all(isinstance(t, dict) and str(t.get("title") or "").strip()
                    for t in tasks))


def _merge_hybrid(ml_tasks, rule_tasks):
    """Ghép điểm mạnh của hai bên: model làm TIÊU ĐỀ, luật làm NGÀY GIỜ.

    ĐO ĐƯỢC (6 câu thật, xem README): model giỏi đặt tiêu đề nhưng yếu phần
    thời gian — trên chính những câu mà nó được chọn, nó trả `dueAt: null`
    ("Sáng 7h tập gym" → không có 7h), bỏ `nhắc trước 10 phút`, biến "hàng ngày"
    thành NONE và "quan trọng" thành MEDIUM — đều là thứ parser luật làm đúng.

    Vì vậy với mỗi việc của model, nếu luật có việc cùng tiêu đề (hoặc cùng vị
    trí khi số lượng bằng nhau) thì lấy bổ sung các trường model để trống/yếu.
    Không bao giờ XOÁ dữ liệu luật đã tìm được.
    """
    def key(s):
        return re.sub(r"[^a-z0-9]+", "", _norm(str(s or "")))

    by_title = {key(t.get("title")): t for t in rule_tasks}
    same_len = len(ml_tasks) == len(rule_tasks)
    merged = []
    for i, mt in enumerate(ml_tasks):
        t = dict(mt)
        rt = by_title.get(key(t.get("title")))
        if rt is None and same_len:
            rt = rule_tasks[i]
        if rt:
            # NGÀY GIỜ: luật là nguồn chính, không chỉ khi model để trống. Đo
            # được cả trường hợp model TRẢ SAI: "Uống thuốc hàng ngày lúc 8h
            # sáng" → 20:00 (giờ mặc định) trong khi luật ra đúng 08:00.
            if rt.get("dueAt"):
                t["dueAt"] = rt["dueAt"]
            if rt.get("reminders"):
                t["reminders"] = rt["reminders"]
            if (t.get("priority") or "MEDIUM") == "MEDIUM" \
                    and rt.get("priority") not in (None, "MEDIUM"):
                t["priority"] = rt["priority"]
            if (t.get("repeatType") or "NONE") == "NONE" \
                    and rt.get("repeatType") not in (None, "NONE"):
                t["repeatType"] = rt["repeatType"]
            if not t.get("categoryName") and rt.get("categoryName"):
                t["categoryName"] = rt["categoryName"]
        merged.append(t)
    return merged


# ── Parser luật (fallback / dùng trước khi train) ─────────────

def _norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.replace("đ", "d")

_REL_RX = [
    (r"ngày mai|ngay mai", 1), (r"ngày kia|ngay kia", 2),
    (r"hôm nay|hom nay|to nay|tối nay", 0), (r"hôm qua|hom qua", -1),
    (r"\btomorrow\b", 1), (r"\btoday\b", 0),
    (r"(?<![\wà-ỹ])mai(?![\wà-ỹ])", 1), (r"(?<![\wà-ỹ])nay(?![\wà-ỹ])", 0),
]
_WD_RX = [
    (r"thứ\s*2|thu\s*2|thứ hai|thu hai|monday|\bmon\b", 0),
    (r"thứ\s*3|thu\s*3|thứ ba|thu ba|tuesday|\btue\b", 1),
    (r"thứ\s*4|thu\s*4|thứ tư|thu tu|wednesday|\bwed\b", 2),
    (r"thứ\s*5|thu\s*5|thứ năm|thu nam|thursday|\bthu\b", 3),
    (r"thứ\s*6|thu\s*6|thứ sáu|thu sau|friday|\bfri\b", 4),
    (r"thứ\s*7|thu\s*7|thứ bảy|thu bay|saturday|\bsat\b", 5),
    (r"chủ nhật|chu nhat|sunday|\bsun\b|(?<![\wà-ỹ])cn(?![\wà-ỹ])", 6),
]
_CAT = {"hoc tap": "Học tập", "on tap": "Học tập", "study": "Học tập",
        "cong viec": "Công việc", "work": "Công việc", "hop": "Công việc",
        "ca nhan": "Cá nhân", "personal": "Cá nhân",
        "suc khoe": "Sức khỏe", "health": "Sức khỏe", "gym": "Sức khỏe",
        "tap gym": "Sức khỏe", "the duc": "Sức khỏe", "chay bo": "Sức khỏe",
        "thuoc": "Sức khỏe", "doc sach": "Cá nhân", "sach": "Cá nhân"}
_PRI = [("khan cap", "URGENT"), ("urgent", "URGENT"),
        ("quan trong", "HIGH"), ("important", "HIGH"),
        ("trung binh", "MEDIUM"), ("medium", "MEDIUM"),
        ("thap", "LOW"), ("low", "LOW"), ("chua gap", "LOW")]
_REP = [("hang ngay", "DAILY"), ("moi ngay", "DAILY"), ("daily", "DAILY"),
        ("hang tuan", "WEEKLY"), ("moi tuan", "WEEKLY"), ("weekly", "WEEKLY"),
        ("hang thang", "MONTHLY"), ("monthly", "MONTHLY")]


def _extract_time(clause):
    m = re.search(r"(?<![:\d])(\d{1,2})(:\d{2})?\s*(am|pm)\b", clause, re.I)
    if m:
        h = int(m.group(1))
        mi = int(m.group(2)[1:]) if m.group(2) else 0
        if m.group(3).lower() == "pm" and h < 12:
            h += 12
        if m.group(3).lower() == "am" and h == 12:
            h = 0
        return (h, mi, False), m.group(0), m.start()
    # Giờ bắt buộc có mốc (h / : / giờ) + ranh giới từ — số lẻ không phải giờ,
    # "h" trong "hàng" không phải mốc giờ
    m = re.search(
        r"(sáng|sang|trưa|trua|chiều|chieu|tối|toi|đêm|dem)?\s*(\d{1,2})\s*[:h]\s*(\d{2})?\b\s*(sáng|sang|trưa|trua|chiều|chieu|tối|toi|đêm|dem)?",
        clause, re.I)
    if not m:
        m = re.search(r"(\d{1,2})\s*(giờ|gio|tiếng|tieng|hour)\b", clause, re.I)
        if not m:
            return None, None, -1
        h, mi, post = int(m.group(1)), 0, None
        pre = None
    else:
        pre, h, mi, post = m.group(1), int(m.group(2)), int(m.group(3) or 0), m.group(4)
    hint = _norm(f"{pre or ''} {post or ''}")
    if h < 0 or h > 23 or mi < 0 or mi > 59:
        return None, None, -1
    nxt = False
    if "dem" in hint or "ngu" in _norm(clause[:m.start()]):
        if h == 12:
            h, nxt = 0, True
        elif h < 12:
            h += 12
    elif "chieu" in hint or "toi" in hint:
        if h < 12:
            h += 12
    else:
        before = _norm(clause[:m.start()])
        if "chieu" in before or "toi" in before:
            if h < 12:
                h += 12
        elif "trua" in before and h <= 10:
            h += 12
    return (h, mi, nxt), m.group(0), m.start()


def _extract_date(clause, now):
    for pat, off in _REL_RX:
        m = re.search(pat, clause, re.I)
        if m:
            return now.date() + timedelta(days=off), m.group(0)
    for pat, wd in _WD_RX:
        m = re.search(pat, clause, re.I)
        if m:
            d = now.date()
            delta = (wd - d.weekday()) % 7 or 7
            return d + timedelta(days=delta), m.group(0)
    m = re.search(r"ngày\s*(\d{1,2})|ngay\s*(\d{1,2})", clause, re.I)
    if m:
        return now.date().replace(day=int(m.group(1) or m.group(2))), m.group(0)
    return None, None


def _extract_reminder(clause):
    n = _norm(clause)
    m = re.search(r"nhac.*?(\d+)\s*(phut|tieng|gio|hour|minute)", n)
    if not m:
        m = re.search(r"remind.*?(\d+)\s*(min|hour)", n)
    if not m:
        return None, None, -1, -1
    v = int(m.group(1))
    off = -v * 60 if m.group(2) in ("tieng", "gio", "hour", "hr") else -v
    # map span ngược về chuỗi gốc (độ dài tương đương sau bỏ dấu)
    return off, clause[m.start():m.end()], m.start(), m.end()


def _clean_title(clause, spans):
    s = clause
    for sp in spans:
        if sp and len(sp) > 1:
            # Span ngắn (vd "mai", "CN") phải khớp nguyên từ — tránh lẹm vào "email"
            pat = rf"\b{re.escape(sp)}\b" if len(sp) <= 4 else re.escape(sp)
            s = re.sub(pat, " ", s, flags=re.I)
    s = re.sub(r"\b(vào lúc|vao luc|vào|vao|tại|tai|lúc|luc|at)\b", " ", s, flags=re.I)
    s = re.sub(r"^(sáng|sang|trưa|trua|chiều|chieu|tối|toi|đêm|dem|buổi sáng|buổi trưa|buổi chiều|buổi tối)\b",
               " ", s, flags=re.I).strip()
    s = re.sub(r"^(tôi|toi|em|mình|minh|bạn|ban|chúng ta|chung ta|anh|chị|chi)\b(\s+(sẽ|se|cần|can|phải|phai|muốn|muon|đi|di))?", " ",
               s, flags=re.I).strip()
    s = re.sub(r"^(và|va|rồi|roi|sau đó|sau do|tiếp theo|tiep theo|hãy|hay|cần|can|phải|phai|sẽ|se)\b", " ", s, flags=re.I).strip()
    s = re.sub(r"^(có|co)\s+", "", s, flags=re.I).strip()
    s = re.sub(r"\b(khẩn cấp|khan cap|quan trọng|important|trung bình|thấp|thap|urgent|high|medium|low|hàng ngày|hang ngay|hàng tuần|hang tuan|hàng tháng|hang thang|daily|weekly|monthly)\b",
               " ", s, flags=re.I)
    s = re.sub(r"\s+", " ", s.replace(",", " ")).strip(" .,;!?")
    return (s[:1].upper() + s[1:]) if s else None


def rule_parse(text):
    now = datetime.now(VN_TZ)
    clauses = [c.strip() for c in re.split(r"[.;!?]+\n*|\n+", text) if c.strip()]
    glob_off = None
    infos = []
    for c in clauses:
        t, tm, tpos = _extract_time(c)
        r, rm, rpos, rend = _extract_reminder(c)
        # Cụm chỉ thị chung ("Nhắc trước 10 phút mỗi cái"): có nhắc nhở +
        # từ toàn cục, và con số chỉ thuộc về cụm nhắc (không phải giờ riêng)
        time_in_reminder = (t is not None and r is not None
                            and rpos >= 0 and tpos >= 0 and rpos <= tpos < rend)
        if r is not None and (t is None or time_in_reminder) and re.search(
                r"mỗi|moi|từng|tung|tất cả|tat ca|mọi|each|every|all", c, re.I):
            glob_off = r if glob_off is None else glob_off
            infos.append(None)
        else:
            infos.append((c, t, tm, r, rm))
    tasks = []
    for info in infos:
        if not info:
            continue
        c, t, tm, r, rm = info
        day, dm = _extract_date(c, now)
        due = None
        if t:
            d = day or now.date()
            if t[2]:
                d += timedelta(days=1)
            # defensive: validate hour/minute
            if 0 <= t[0] <= 23 and 0 <= t[1] <= 59:
                due = datetime(d.year, d.month, d.day, t[0], t[1], tzinfo=VN_TZ)
            else:
                due = None
        elif day:
            due = datetime(day.year, day.month, day.day, 18, 0, tzinfo=VN_TZ)
        off = r if r is not None else glob_off
        rems = []
        if off is not None and due:
            rems = [{"remindAt": (due + timedelta(minutes=off)).isoformat()}]
        n = _norm(c)
        pri = next((p for k, p in _PRI if k in n), "MEDIUM")
        rep = next((p for k, p in _REP if k in n), "NONE")
        cat = next((v for k, v in _CAT.items() if k in n), None)
        title = _clean_title(c, [tm, dm, rm])
        if not title:
            continue
        tasks.append({"title": title, "description": "", "dueAt": due.isoformat() if due else None,
                      "priority": pri, "repeatType": rep, "repeatDays": [],
                      "reminders": rems, "categoryName": cat})
    return tasks[:20]


def model_parse(text):
    import torch
    from torch import no_grad
    now = datetime.now(VN_TZ)
    wd = ["thứ Hai", "thứ Ba", "thứ Tư", "thứ Năm",
          "thứ Sáu", "thứ Bảy", "Chủ nhật"][now.weekday()]
    ctx = (f"Hôm nay là {wd}, ngày {now.day:02d}/{now.month:02d}/{now.year}. ")
    src = _tok("parse: " + ctx + text[:2000], return_tensors="pt",
               truncation=True, max_length=320)
    device = next(_model.parameters()).device
    src = {k: v.to(device) for k, v in src.items()}

    gen_kw = dict(max_new_tokens=MAX_NEW_TOKENS, do_sample=False)
    if NUM_BEAMS > 1:
        gen_kw["num_beams"] = NUM_BEAMS
    if NO_REPEAT_NGRAM > 0:
        gen_kw["no_repeat_ngram_size"] = NO_REPEAT_NGRAM
    with no_grad():
        out = _model.generate(**src, **gen_kw)
    raw = _tok.decode(out[0], skip_special_tokens=True)

    # Fallback: nếu raw không bắt đầu bằng '{' thì ép tiền tố '{"tasks": ['.
    # Phải CHÈN decoder_start_token_id (0) lên trước, nếu không toàn bộ chuỗi bị
    # lệch 1 vị trí so với lúc train ⇒ model sinh rác.
    if not raw.lstrip().startswith('{'):
        pre = [ _model.config.decoder_start_token_id ] + _tok(
            '{"tasks": [', add_special_tokens=False)['input_ids']
        forced = torch.tensor([pre]).to(device)
        with no_grad():
            out = _model.generate(**src, decoder_input_ids=forced,
                                  num_beams=1, max_new_tokens=MAX_NEW_TOKENS)
        raw = _tok.decode(out[0], skip_special_tokens=True)
    try:
        data = json.loads(raw[raw.index("{"):raw.rindex("}") + 1])
        tasks = data.get("tasks", data) if isinstance(data, dict) else data
        return tasks if isinstance(tasks, list) else []
    except Exception:
        return []


# ── FastAPI app ────────────────────────────────────────────────
try:
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel

    app = FastAPI(title="MN-Qronx AI riêng")

    class ParseIn(BaseModel):
        text: str

    @app.get("/health")
    def health():
        # "finetuned" phải nói THẬT là model đã nạp được chưa. Trước đây chỉ
        # kiểm tra thư mục tồn tại nên luôn báo true kể cả khi model không dùng.
        loaded = try_load_model()
        return {"status": "ok", "model": MODEL_VERSION,
                "finetuned": bool(loaded),
                "engine": "model+rule" if loaded else "rule-only",
                "checkpoint": CKPT,
                "checkpoint_present": os.path.isdir(CKPT)}

    @app.post("/parse")
    def parse(body: ParseIn):
        text = (body.text or "").strip()[:2000]
        if not text:
            raise HTTPException(400, "Vui lòng nhập nội dung công việc")
        # Ưu tiên luật: nhanh, ổn định, không bao giờ crash
        tasks = rule_parse(text)
        # Thử ML nếu có checkpoint, nhưng timeout 8s, lỗi thì bỏ qua
        if try_load_model():
            try:
                from concurrent.futures import ThreadPoolExecutor, TimeoutError
                with ThreadPoolExecutor(max_workers=1) as ex:
                    future = ex.submit(model_parse, text)
                    ml_tasks = future.result(timeout=MODEL_TIMEOUT)
                # Chỉ dùng model khi nó KHÔNG bỏ sót việc nào so với luật; phần
                # ngày giờ/nhắc nhở/ưu tiên luật tìm được thì giữ lại
                # (_merge_hybrid). Trước đây điều kiện là `>=` mà không ghép, nên
                # khi hai bên hoà số việc thì kết quả TỆ ĐI: model trả về
                # "Tập gym" không có 7h trong khi luật có.
                if _valid_tasks(ml_tasks) and len(ml_tasks) >= len(tasks):
                    merged = _merge_hybrid(ml_tasks, tasks)[:20]
                    if merged != ml_tasks[:20]:
                        return {"tasks": merged, "model": MODEL_VERSION + "-hybrid"}
                    return {"tasks": merged, "model": MODEL_VERSION}
            except Exception:
                pass
        return {"tasks": tasks, "model": MODEL_VERSION + "-rulebased"}
except ImportError:  # thiếu fastapi khi chỉ train
    app = None
