"""Inference server cho AI riêng MN-Qronx.

- Có checkpoint fine-tune (checkpoints/best) → dùng model.
- Chưa train → parser luật tiếng Việt (đủ chạy production ngay).

Chạy:  uvicorn serve:app --host 0.0.0.0 --port 8000   (thư mục ai/)
API :  GET /health · POST /parse {text} → {tasks, model}
"""
import calendar
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
# Không nhận "mon"/"thu"/"sat" lẻ (bỏ dấu: "mon an"→thứ 2, "thu duc"→thứ 5,
# "ap sat"→thứ 7) — vẫn giữ dạng đầy đủ và "thu 5"/"thứ 5" như cũ
_WD_RX = [
    # Bộ sinh nhãn dùng "thứ 1" cho thứ Hai — thiếu alias này thì "thứ 1" không
    # được nhận là ngày nào và dính lại trong tiêu đề.
    (r"thứ\s*(?:1|01|nhất|nhat)|thu\s*(?:1|01|nhat)|monday", 0),
    # Alias viết tắt "t2"…"t7" là cách gõ rất phổ biến ("t4 với t6 hàng tuần"):
    # thiếu thì câu không có ngày và tiêu đề còn nguyên "t4 với t6".
    (r"thứ\s*2|thu\s*2|thứ hai|thu hai|\bt2\b|monday", 0),
    (r"thứ\s*3|thu\s*3|thứ ba|thu ba|\bt3\b|tuesday|\btue\b", 1),
    (r"thứ\s*4|thu\s*4|thứ tư|thu tu|\bt4\b|wednesday|\bwed\b", 2),
    (r"thứ\s*5|thu\s*5|thứ năm|thu nam|\bt5\b|thursday", 3),
    (r"thứ\s*6|thu\s*6|thứ sáu|thu sau|\bt6\b|friday|\bfri\b", 4),
    (r"thứ\s*7|thu\s*7|thứ bảy|thu bay|\bt7\b|saturday", 5),
    (r"chủ nhật|chu nhat|sunday|\bsun\b|(?<![\wà-ỹ])cn(?![\wà-ỹ])", 6),
]

# Ngày trong tuần được NÊU trong câu, quy về ISO 1..7 (1 = Thứ Hai … 7 = Chủ nhật)
# đúng như backend và lịch của app. Dùng cho lịch LẶP theo thứ: "mỗi tối t4 với t6
# hàng tuần" → [3, 5]. Trước đây rule_parse luôn trả repeatDays rỗng nên backend
# phải hạ WEEKLY thành NONE (mất hẳn lịch lặp người dùng vừa nói).
_WD_ISO = [
    (r"thứ\s*2|thu\s*2|thứ hai|thu hai|\bt2\b|monday", 1),
    (r"thứ\s*3|thu\s*3|thứ ba|thu ba|\bt3\b|tuesday|\btue\b", 2),
    (r"thứ\s*4|thu\s*4|thứ tư|thu tu|\bt4\b|wednesday|\bwed\b", 3),
    (r"thứ\s*5|thu\s*5|thứ năm|thu nam|\bt5\b|thursday", 4),
    (r"thứ\s*6|thu\s*6|thứ sáu|thu sau|\bt6\b|friday|\bfri\b", 5),
    (r"thứ\s*7|thu\s*7|thứ bảy|thu bay|\bt7\b|saturday", 6),
    (r"chủ nhật|chu nhat|\bcn\b|sunday|\bsun\b", 7),
]


def _extract_repeat_days(clause):
    n = _norm(clause)
    return sorted({iso for pat, iso in _WD_ISO if re.search(pat, n)})
_CAT = {"hoc tap": "Học tập", "on tap": "Học tập", "study": "Học tập",
        "cong viec": "Công việc", "work": "Công việc", "hop": "Công việc",
        "ca nhan": "Cá nhân", "personal": "Cá nhân",
        "suc khoe": "Sức khỏe", "health": "Sức khỏe", "gym": "Sức khỏe",
        "tap gym": "Sức khỏe", "the duc": "Sức khỏe", "chay bo": "Sức khỏe",
        "thuoc": "Sức khỏe", "doc sach": "Cá nhân", "sach": "Cá nhân",
        # Tên việc thật của người dùng: thiếu nhóm này thì đa số việc không có
        # danh mục dù rất dễ suy ra (phải khớp theo biên từ — xem _word_in).
        "gui email": "Công việc", "email": "Công việc", "bao gia": "Công việc",
        "review": "Công việc", "bao cao": "Công việc", "goi dien": "Công việc",
        "khach hang": "Công việc", "standup": "Công việc", "hop team": "Công việc",
        # Tên việc tiếng Anh (bộ sinh nhãn có cả nhánh EN, người dùng cũng gõ)
        "team meeting": "Công việc", "meeting": "Công việc",
        "quotation": "Công việc", "english": "Học tập",
        "go running": "Sức khỏe", "running": "Sức khỏe", "medicine": "Sức khỏe",
        "read a book": "Cá nhân", "book": "Cá nhân",
        "electricity": "Cá nhân", "bill": "Cá nhân",
        "buy milk": "Cá nhân", "milk": "Cá nhân",
        "sieu thi": "Cá nhân", "tien dien": "Cá nhân", "dong tien": "Cá nhân",
        "mua sua": "Cá nhân", "don nha": "Cá nhân",
        "kham rang": "Sức khỏe", "yoga": "Sức khỏe", "boi": "Sức khỏe",
        "bai tap": "Học tập", "vat ly": "Học tập", "tieng anh": "Học tập",
        "do an": "Học tập", "nop bao cao": "Công việc"}


def _word_in(key, text):
    """Khớp cả cụm theo BIÊN TỪ: "hop" không được khớp bên trong "shopping"."""
    return re.search(rf"(?<!\w){re.escape(key)}(?!\w)", text) is not None
_PRI = [("not urgent", "LOW"), ("not important", "LOW"),
        ("khan cap", "URGENT"), ("urgent", "URGENT"),
        ("quan trong", "HIGH"), ("important", "HIGH"),
        ("uu tien cao", "HIGH"),
        ("trung binh", "MEDIUM"), ("medium", "MEDIUM"),
        ("binh thuong", "MEDIUM"),
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
        # "ampm" = buổi đã tường minh → không kế thừa buổi khác cho câu sau
        return (h, mi, False, "ampm"), m.group(0), m.start()
    # Giờ bắt buộc có mốc (h / : / giờ) + ranh giới từ — số lẻ không phải giờ,
    # "h" trong "hàng" không phải mốc giờ
    m = re.search(
        r"(sáng|sang|trưa|trua|chiều|chieu|tối|toi|đêm|dem|khuya)?\s*(\d{1,2})\s*[:h]\s*(\d{2})?\b\s*(sáng|sang|trưa|trua|chiều|chieu|tối|toi|đêm|dem|khuya)?",
        clause, re.I)
    if not m:
        m = re.search(r"(\d{1,2})\s*(giờ|gio|tiếng|tieng|hour)\b", clause, re.I)
        if not m:
            # Không có giờ cụ thể nhưng có từ chỉ buổi ("trưa đi ăn", "chiều
            # họp") → giờ mặc định của buổi (backend bắt buộc dueAt nên câu
            # trống sẽ bị từ chối lúc tạo công việc)
            for words, hh, bucket in ((("đêm", "dem", "khuya"), 22, "dem"),
                                      (("tối", "toi"), 20, "toi"),
                                      (("chiều", "chieu"), 15, "toi"),
                                      (("trưa", "trua"), 12, "trua"),
                                      (("sáng", "sang"), 8, "sang"),
                                      (("ngủ", "ngu", "sleep"), 22, "ngu")):
                for w in words:
                    mm = re.search(rf"(?<!\w){w}(?!\w)", clause, re.I)
                    if mm:
                        return (hh, 0, False, bucket), mm.group(0), mm.start()
            return None, None, -1
        h, mi, post = int(m.group(1)), 0, None
        pre = None
    else:
        pre, h, mi, post = m.group(1), int(m.group(2)), int(m.group(3) or 0), m.group(4)
    hint = _norm(f"{pre or ''} {post or ''}")
    if h < 0 or h > 24 or mi < 0 or mi > 59:
        return None, None, -1
    nxt = False
    # So NGUYÊN VĂN + biên từ: sau bỏ dấu "tôi"→"toi" trùng "tối" và
    # "người"→"nguoi" chứa "ngu" (ngủ) → trước đây 7h thành 19h, 12h thành 0h hôm sau
    before = clause[:m.start()]

    def _w(raw, *words):
        return any(re.search(rf"(?<!\w){re.escape(w)}(?!\w)", raw, re.I)
                   for w in words)

    # Buỗi của câu này — dùng cho câu SAU kế thừa khi câu sau chỉ có số
    # ("…8h30 và …9h" → 9h = 21:00). Thứ tự như periodHintBefore: "sáng" và
    # "ngủ" KHÔNG kế thừa, các buổi còn lại (trưa/chiều/tối/đêm) mới kế thừa.
    if "khuya" in hint or "dem" in hint or _w(before, "đêm", "dem", "khuya"):
        ph = "dem"
    elif "chieu" in hint or "toi" in hint or _w(before, "chiều", "chieu", "tối", "toi"):
        ph = "toi"
    elif "trua" in hint or _w(before, "trưa", "trua"):
        ph = "trua"
    elif "sang" in hint or _w(before, "sáng", "sang"):
        ph = "sang"
    elif _w(before, "ngủ", "ngu", "sleep"):
        ph = "ngu"
    else:
        ph = None

    if "khuya" in hint or "dem" in hint or _w(before, "đêm", "dem", "khuya", "ngủ", "ngu", "sleep"):
        # 0h/12h đêm = nửa đêm hôm sau; 6–11h đêm = buổi tối (+12);
        # 1–5h đêm giữ nguyên ("về 3h sáng" = 03:00, không phải 15:00)
        if h in (0, 12):
            h, nxt = 0, True
        elif 6 <= h < 12:
            h += 12
    elif "chieu" in hint or "toi" in hint:
        if h == 0:  # "Tối 0h" = 00:00 hôm sau
            h, nxt = 0, True
        elif h < 12:
            h += 12
    elif "sang" in hint:
        if h == 12:
            h = 0
    elif "trua" in hint and h <= 10:
        h += 12
    else:
        if _w(before, "chiều", "chieu", "tối", "toi"):
            if h == 0:
                h, nxt = 0, True
            elif h < 12:
                h += 12
        elif _w(before, "trưa", "trua") and h <= 10:
            h += 12
    # "24h khuya" = 00:00 hôm sau (24 nằm ngoài 0–23 nên trước đây bị bỏ
    # hoàn toàn → câu không có giờ → công việc không có thời hạn)
    if h == 24:
        h, nxt = 0, True
    return (h, mi, nxt, ph), m.group(0), m.start()


def _extract_date(clause, now):
    for pat, off in _REL_RX:
        m = re.search(pat, clause, re.I)
        if m:
            # Nuốt luôn từ chỉ buổi đứng ngay trước ("sáng mai", "chiều nay"):
            # không nuốt thì tiêu đề còn "Tập gym sáng" vì span ngày chỉ là "mai".
            # CHỈ làm với dạng trần (mai/nay/today/tomorrow) — "sáng mai" là cụm cố
            # định, còn "tối ngày kia" thì chữ "tối" thuộc TIÊU ĐỀ ("Ăn tối"), nuốt
            # luôn sẽ biến "Ăn tối" thành "Ăn" (11 tiêu đề sai).
            sp = m.group(0)
            if sp.lower() in ("mai", "nay", "today", "tomorrow"):
                head = re.search(r"(?:sáng|sang|trưa|trua|chiều|chieu|tối|toi|đêm|dem)\s+$",
                                 clause[:m.start()], re.I)
                if head:
                    sp = clause[head.start():m.end()]
            return now.date() + timedelta(days=off), sp
    for pat, wd in _WD_RX:
        m = re.search(pat, clause, re.I)
        if m:
            d = now.date()
            delta = (wd - d.weekday()) % 7 or 7
            return d + timedelta(days=delta), m.group(0)
    base_d = now.date()
    m = _DMY_RX.search(clause)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(3)), m.group(4)
        if 1 <= mo <= 12 and 1 <= d <= 31:
            yy = base_d.year if not y else (int(y) + 2000 if int(y) < 100 else int(y))
            for cand in (yy, yy + 1):
                if d > calendar.monthrange(cand, mo)[1]:
                    continue
                got = base_d.replace(year=cand, month=mo, day=d)
                # Có năm: tôn trọng đúng năm người dùng gõ. Không có năm mà ngày
                # đó đã qua: hiểu là năm sau (giống quy ước "ngày 13" đã qua thì
                # hiểu là tháng sau) để hạn không rơi vào quá khứ.
                if y or got >= base_d:
                    return got, m.group(0)
    # "ngày N" — nhưng KHÔNG được lấy số của GIỜ: "Họp team hằng ngày 8h" từng
    # khớp "ngày 8" ⇒ hạn rơi vào ngày 8 của tháng và tiêu đề còn "Họp team hằng h".
    m = re.search(r"ngày\s*(\d{1,2})(?![hH\d])|ngay\s*(\d{1,2})(?![hH\d])", clause, re.I)
    if m:
        d = int(m.group(1) or m.group(2))
        if not 1 <= d <= 31:
            return None, None
        base = now.date()
        year, month = base.year, base.month
        # "ngày 13" nói khi đã qua ngày 13 → hiểu là 13 của tháng sau. Không dồn
        # thì hạn nằm ở quá khứ, backend từ chối (dueAt phải lớn hơn hiện tại)
        # và người dùng mất công việc vừa nhập.
        if d < base.day:
            month += 1
            if month > 12:
                month, year = 1, year + 1
        last_day = calendar.monthrange(year, month)[1]
        return base.replace(year=year, month=month, day=min(d, last_day)), m.group(0)
    return None, None


def _extract_reminder(clause):
    n = _norm(clause)
    # "báo thức đúng giờ" = nhắc ĐÚNG lúc đến hạn (offset 0). Bộ sinh nhãn dùng
    # đúng cụm này cho mốc 0 phút; không nhận ra thì cụm chữ dính vào tiêu đề và
    # công việc mất nhắc nhở.
    m0 = re.search(r"(?:bao thuc|nhac)\s+(?:dung gio|dung luc|khi den han|den gio)", n)
    if m0:
        return 0, clause[m0.start():m0.end()], m0.start(), m0.end()
    m = re.search(r"nhac.*?(\d+)\s*(phut|tieng|gio|hour|minute)", n)
    if m:
        v = int(m.group(1))
        off = -v * 60 if m.group(2) in ("tieng", "gio", "hour", "hr") else -v
        # map span ngược về chuỗi gốc (độ dài tương đương sau bỏ dấu)
        return off, clause[m.start():m.end()], m.start(), m.end()
    # Tiếng Anh: "remind me 30 minutes before" / "remind 1 hour before" /
    # "remind me on time". Phải lấy TRỌN cụm (kể cả "before"/"on time") làm span:
    # bản trước khớp tới "min" nên phần còn lại dính vào tiêu đề ("…on utes before").
    m = re.search(
        r"\b(?:remind|reminder)(?:\s+me)?"
        r"(?:\s+(\d+)\s*(minutes?|mins?|hours?|hrs?))?"
        r"(?:\s+(?:before|prior|earlier|in advance|on time|ahead))?", n)
    if m:
        v = int(m.group(1)) if m.group(1) else 0
        off = -v * 60 if (m.group(2) or "").startswith(("hour", "hr")) else -v
        return off, clause[m.start():m.end()], m.start(), m.end()
    return None, None, -1, -1


def _clean_title(clause, spans):
    s = clause
    # Span DÀI bỏ trước. Cụm nhắc chứa luôn con số của nó ("nhắc trước 1 giờ") nên
    # nếu bỏ span giờ "1 giờ" trước thì chuỗi không còn khớp cụm nhắc và tiêu đề
    # giữ lại chữ "nhắc trước" / "remind before" (từng gặp: "Gửi email báo giá
    # nhắc trước", "Dinner remind before").
    for sp in sorted(spans, key=lambda x: -len(x or "")):
        if sp and len(sp) > 1:
            # Span ngắn (vd "mai", "CN") phải khớp nguyên từ — tránh lẹm vào "email"
            pat = rf"\b{re.escape(sp)}\b" if len(sp) <= 4 else re.escape(sp)
            s = re.sub(pat, " ", s, flags=re.I)
    s = re.sub(r"\b(vào lúc|vao luc|vào ngày|vao ngay|vào|vao|tại|tai|lúc|luc|at|on)\b",
               " ", s, flags=re.I)
    # Ngày còn sót — "ngày 23/9", "ngày 26"
    s = re.sub(r"\bngày\s*\d{1,2}\s*[/-]\s*\d{1,2}(?:\s*[/-]\s*\d{2,4})?\b", " ", s, flags=re.I)
    s = re.sub(r"\bngày\s+\d{1,2}\b", " ", s, flags=re.I)
    s = re.sub(r"\b\d{1,2}\s*[/-]\s*\d{1,2}(?:\s*[/-]\s*\d{2,4})?\b", " ", s, flags=re.I)
    # Giờ còn sót — "9h", "24h khuya" (biên như _HAS_CLOCK: "4 học" không mất chữ học)
    s = re.sub(r"\b\d{1,2}\s*[:h](?![a-zà-ỹ])\s*\d{0,2}\s*(?:sáng|sang|trưa|trua|chiều|chieu|tối|toi|đêm|dem|khuya)?",
               " ", s, flags=re.I)
    # Ngày trong tuần còn sót trong tiêu đề ("t4 với t6", "thứ 6", "Chủ nhật"):
    # lịch lặp đã tách sang repeatType + repeatDays nên không để lại trong tên việc.
    for _ in range(3):
        prev_wd = s
        # Bỏ từ nối TRƯỚC khi bỏ ngày: sau khi "t3"/"t5" bị xoá thì "và" không còn
        # đứng ngay trước một ngày nào nữa nên lookahead trượt → tiêu đề giữ "và"
        # ("Tập gym t3 và t5 hàng tuần" → "Tập gym và").
        s = re.sub(_WD_LINK_TITLE_RX, " ", s)
        s = re.sub(_WD_TITLE_RX, " ", s)
        s = re.sub(r"\s+", " ", s).strip()
        if s == prev_wd:
            break
    # Lặp tới khi ổn định — sau khi bỏ span/ngày/giờ, từ nối + chủ ngữ mới
    # trồi ra đầu câu ("Sau đó tôi sẽ qua…" → cần bỏ nhiều lớp mới ra "Qua…")
    for _ in range(6):
        prev = s
        # Từ chỉ buổi ở ĐẦU câu ("Trưa nay…", "Chiều có…", "Tối ăn…")
        s = re.sub(r"^(?:buổi|buỗi)\s+|^(?:sáng|sang|trưa|trua|chiều|chieu|tối|toi|đêm|dem|khuya)\b",
                   " ", s, flags=re.I).strip()
        # Chủ ngữ ("tôi đi ăn trưa" → "đi ăn trưa", bỏ cả "chúng tôi sẽ")
        s = re.sub(r"^(?:chúng tôi|chung toi|tôi|toi|em|mình|minh|bạn|ban|chúng ta|chung ta|anh|chị|chi)\b"
                   r"(?:\s+(?:sẽ|se|cần|can|phải|phai|muốn|muon|đi|di))?", " ", s, flags=re.I).strip()
        # Từ nối đầu câu
        s = re.sub(r"^(?:và|va|rồi|roi|sau đó|sau do|kế tiếp|ke tiep|tiếp theo|tiep theo|xong"
                   r"|hãy|hay|cần|can|phải|phai|sẽ|se|every)\b", " ", s, flags=re.I).strip()
        s = re.sub(r"^(?:có|co)\s+", "", s, flags=re.I).strip()
        # "nhắc tôi", "mỗi" còn sót ở đầu câu, và "với" mồ côi sau khi bỏ ngày
        # trong tuần ("mỗi tối với đi học thêm" → "đi học thêm")
        s = re.sub(r"^(?:nhắc|nhac|mỗi|moi)(?![a-zà-ỹ0-9])\s*", " ", s, flags=re.I).strip()
        s = re.sub(r"^(?:với|voi)(?![a-zà-ỹ0-9])\s*", " ", s, flags=re.I).strip()
        if s == prev:
            break
    # Ưu tiên / lặp lại / kiểu nhắc — phải bỏ khỏi tiêu đề. "chưa gấp", "bình
    # thường", "báo thức đúng giờ" có trong bộ sinh nhãn nên chắc chắn gặp.
    # "hằng ngày" (hằng) là cách viết người dùng rất hay dùng — thiếu thì tiêu đề
    # giữ lại "hằng ngày" dù repeatType đã đúng là DAILY.
    s = re.sub(r"\b(not urgent|not important|not before|khẩn cấp|khan cap|quan trọng|quan trong|important|trung bình|trung binh|binh thuong|bình thường|binh thuong|chưa gấp|chua gap|thấp|thap|urgent|high|medium|low|hàng ngày|hằng ngày|hang ngay|hàng tuần|hằng tuần|hang tuan|hàng tháng|hằng tháng|hang thang|daily(?!\s+standup)|weekly|monthly|báo thức đúng giờ|bao thuc dung gio|báo thức|bao thuc|đúng giờ|dung gio|mỗi việc|moi viec|mỗi cái|moi cai|tất cả|tat ca|mọi việc|moi viec)\b",
               " ", s, flags=re.I)
    # Cụm "ưu tiên cao/thấp…" đã đọc vào priority → bỏ hẳn khỏi tiêu đề
    s = re.sub(r"\b(?:ưu tiên|uu tien)\s+(?:cao|thấp|thap|trung bình|trung binh|khẩn cấp|khan cap|urgent|high|low)\b",
               " ", s, flags=re.I)
    s = re.sub(r"\s+", " ", s.replace(",", " ")).strip(" .,;!?")
    return (s[:1].upper() + s[1:]) if s else None


# ── Tách câu → việc: dấu phẩy, "sau đó", "rồi", "xong", "tiếp theo" ──
# Chỉ cắt khi PHÍA TRƯỚC đã có giờ VÀ cụm sau dấu ngắt có giờ riêng
# ("trưa… lúc 12h") hoặc mở đầu như việc mới ("trưa…", "mai…").
# Câu phụ không có giờ riêng ("Đi ăn trưa, có 5 người tham dự lúc 12h")
# và chỉ thị ("…19h, nhắc trước 30 phút") giữ nguyên.
# Ngày trong tuần còn lại trong TIÊU ĐỀ (viết hoa/thường, có dấu) — xem _clean_title
_WD_TITLE_RX = re.compile(
    r"(?<![a-zà-ỹ0-9])(?:thứ|thu)\s*(?:[2-7]|hai|ba|tư|tu|năm|nam|sáu|sau|bảy|bay)(?![a-zà-ỹ0-9])"
    r"|(?<![a-zà-ỹ0-9])t[2-7](?![a-zà-ỹ0-9])"
    r"|(?<![a-zà-ỹ0-9])(?:chủ nhật|chu nhat|cn)(?![a-zà-ỹ0-9])",
    re.I,
)
# Chỉ bỏ "với/và/," khi ngay sau đó là một ngày trong tuần nữa
_WD_LINK_TITLE_RX = re.compile(
    r"(?<![a-zà-ỹ0-9])(?:với|voi|và|va|,|&)(?![a-zà-ỹ0-9])"
    r"(?=\s*(?:t[2-7](?![a-zà-ỹ0-9])|(?:thứ|thu)\s*(?:[2-7]|hai|ba|tư|tu|năm|nam|sáu|sau|bảy|bay)))",
    re.I,
)

_HAS_CLOCK = re.compile(
    r"(?<!\d)\d{1,2}\s*(?:[:h](?![a-zà-ỹ])|(?:giờ|gio|tiếng|tieng|hour)\b|(?:am|pm)\b)",
    re.I)
_TASK_START = re.compile(
    r"^(?:(?:buỗi|buổi|buoi)\s+)?(?:sáng|sang|trưa|trua|chiều|chieu|tối|toi|đêm|dem)\b"
    r"|^(?:ngày\s+|ngay\s+)?(?:mai|nay|kia)\b"
    r"|^(?:lúc|luc)\s*\d|^\d{1,2}\s*[:h]"
    r"|^(?:thứ\s*\d|thu\s*\d|chủ nhật|chu nhat)\b", re.I)
_SEP_RES = [re.compile(r","),
            re.compile(r"\s+(?:sau\s*đó|sau\s*do|rồi|roi|xong|tiếp\s*theo|tiep\s*theo)\s+",
                       re.I),
            # "…8h30 và …9h" — hai vế cùng có giờ → tách; "An, Lan và Bình
            # lúc 9h" không tách vì vế trái chưa có giờ (guard trong _split_clauses)
            re.compile(r"\s+(?:và|va)\s+", re.I)]
# Ngày của câu trước chỉ được "mang sang" câu KHÔNG nêu ngày khi câu trước nói
# bằng từ ngữ tương đối gần ("Sáng mai 7h đi chợ…, trưa 12h họp" → cùng ngày
# mai). Thứ trong tuần / "ngày kia" / ngày số thì KHÔNG mang: "Buy milk today…
# Gym at 6am" là 6h hôm nay, không phải 6h thứ Năm nêu ở câu trước (nhãn cũng
# vậy) — bản trước mang tất nên 3/254 việc lệch ngày, có việc lệch 6 ngày.
_CARRY_RX = re.compile(
    r"hôm nay|hom nay|tối nay|to nay|sáng nay|sang nay|trưa nay|trua nay"
    r"|chiều nay|chieu nay|đêm nay|dem nay|ngày mai|ngay mai|sáng mai|sang mai"
    r"|trưa mai|trua mai|chiều mai|chieu mai|\btoday\b|\btomorrow\b"
    r"|(?<![\wà-ỹ])mai(?![\wà-ỹ])",
    re.I)
# Cụm sau dấu ngắt chỉ còn là lời nhắc cho việc vừa nêu ("…, nhắc trước 1 giờ")
_REMINDER_ONLY = re.compile(r"^\s*(?:nhắc|nhac|remind)\b", re.I)
# Chỉ thị áp cho MỌI việc trong đoạn ("nhắc trước 30 phút mỗi việc")
_GLOBAL_RX = re.compile(r"mỗi|moi|từng|tung|tất cả|tat ca|mọi|each|every|all", re.I)
# Câu ngữ cảnh ngày ở ĐẦU đoạn ("Hôm nay là thứ Năm, ngày 08/01/2026" /
# "Today is Friday, 07/24/2026") — chỉ là ngữ cảnh, không phải công việc
_CTX_SENT_RX = re.compile(
    r"^\s*(?:hôm nay|hom nay|today)\s+(?:là|la|is)\b[^.?!]{0,45}?\d{1,2}\s*[/-]\s*\d{1,2}\s*[/-]\s*\d{2,4}\s*$",
    re.I)
_CTX_EN_RX = re.compile(r"^\s*today\b", re.I)
_NUM_DATE_RX = re.compile(r"(\d{1,2})\s*[/-]\s*(\d{1,2})\s*[/-]\s*(\d{2,4})")
# "05/10", "5-10", "05/10/2026": người Việt viết NGÀY/THÁNG (ngược mm/dd của
# tiếng Anh). Bản trước chỉ hiểu khi có chữ "ngày" đứng ngay trước, nên
# "họp khách 05/10 9h" rơi về hôm nay/ngày mai — lệch cả tuần mà người dùng
# không hề thấy cảnh báo (câu tiếng Anh không bao giờ dùng ngày số nên đọc theo
# kiểu Việt Nam là an toàn).
# Không nhận khoảng thời lượng ("5-10 phút", "trước 2-3 tiếng") làm ngày.
_DMY_RX = re.compile(
    r"(?<![\w/])(?:ngày\s*|ngay\s*)?(\d{1,2})\s*([/-])\s*(\d{1,2})"
    r"(?:\s*[/-]\s*(\d{2,4}))?(?![\d/])"
    r"(?!\s*(?:phút|phut|tiếng|tieng|giờ|gio|ngày|ngay|tuần|tuan|tháng|thang)\b)",
    re.I)


def _ctx_anchor(clause):
    """Mốc neo ngày lấy từ câu ngữ cảnh ở đầu đoạn, None nếu câu không phải
    ngữ cảnh ngày.

    Dataset (và cả model lúc train) đều tính ngày tương đối từ mốc này, nên
    parser luật phải dùng CÙNG mốc. Trước đây parser bỏ hẳn câu đó rồi lấy
    `datetime.now()`, vì thế mọi mốc 'hôm nay/ngày kia/thứ 3' lệch hẳn so với
    nhãn và không có cách nào đo đúng độ chính xác ngày (due_day 4,3 %).
    """
    if not _CTX_SENT_RX.match(clause):
        return None
    m = _NUM_DATE_RX.search(clause)
    if not m:
        return None
    a, b, y = (int(x) for x in m.groups())
    if y < 100:
        y += 2000
    # Tiếng Anh ghi mm/dd, tiếng Việt ghi dd/mm
    day, month = (b, a) if _CTX_EN_RX.match(clause) else (a, b)
    try:
        # 00:05 để 'hôm nay lúc 10h' không bị luật dồn-quá-khứ đẩy sang ngày mai
        return datetime(y, month, day, 0, 5, tzinfo=VN_TZ)
    except ValueError:
        return None


def _find_seps(text):
    seps = []
    for rx in _SEP_RES:
        seps += [(m.start(), m.end()) for m in rx.finditer(text)]
    return sorted(seps)


def _split_clauses(text):
    chunks, pos = [], 0
    for start, end in _find_seps(text):
        if start < pos:
            continue
        left, rest = text[pos:start], text[end:]
        if len(rest.strip()) < 4 or not _HAS_CLOCK.search(left):
            continue
        nxt = _find_seps(rest)
        head = rest[:nxt[0][0]] if nxt else rest
        # "Đóng tiền điện 20h, nhắc trước 1 giờ": phần sau dấu phẩy là nhắc nhở chứ
        # không phải việc mới — tách ra sẽ sinh việc rác tên "Nhắc trước" và việc
        # gốc mất nhắc nhở. Vẫn tách khi là chỉ thị chung ("… mỗi việc").
        if _REMINDER_ONLY.match(head) and not _GLOBAL_RX.search(head):
            continue
        if _HAS_CLOCK.search(head) or _TASK_START.match(rest.strip()):
            chunks.append(left.strip())
            pos = end
    chunks.append(text[pos:].strip())
    return [c for c in chunks if c]


def _drop_words(norm_text, words):
    """Bỏ các từ của tiêu đề khỏi câu đã chuẩn hoá (theo thứ tự, mỗi từ một lần).

    Dùng để soi phần CÒN LẠI của câu: chữ nằm trong tên việc ("Daily standup")
    không được tính là chỉ thị lặp lại, còn chữ thật sự nói về lặp lại thì còn lại.
    """
    if not words:
        return norm_text
    out, i = [], 0
    for w in norm_text.split():
        if i < len(words) and w == words[i]:
            i += 1
            continue
        out.append(w)
    return " ".join(out)


def rule_parse(text, now=None):
    clauses = [c.strip() for c in re.split(r"[.;!?]+\n*|\n+", text) if c.strip()]
    # Câu ngữ cảnh ngày ở đầu: vừa không phải công việc (nếu không sẽ thành
    # việc rác "Is Friday"), vừa là MỐC NEO cho mọi ngày tương đối phía sau.
    if clauses and _CTX_SENT_RX.match(clauses[0]):
        now = now or _ctx_anchor(clauses[0])
        clauses = clauses[1:]
    now = now or datetime.now(VN_TZ)
    # Ngoài dấu kết thúc câu, tách thêm theo dấu phẩy / "sau đó" / "rồi"…
    # ("…lên trường lúc 7h…, trưa đi ăn lúc 12h sau đó chiều 2h…" → 3 việc)
    clauses = [x for c in clauses for x in _split_clauses(c)]
    glob_off = None
    infos = []
    for c in clauses:
        t, tm, tpos = _extract_time(c)
        r, rm, rpos, rend = _extract_reminder(c)
        # Cụm chỉ thị chung ("Nhắc trước 10 phút mỗi cái"): có nhắc nhở +
        # từ toàn cục, và con số chỉ thuộc về cụm nhắc (không phải giờ riêng)
        time_in_reminder = (t is not None and r is not None
                            and rpos >= 0 and tpos >= 0 and rpos <= tpos < rend)
        if r is not None and (t is None or time_in_reminder) and _GLOBAL_RX.search(c):
            glob_off = r if glob_off is None else glob_off
            infos.append(None)
        else:
            if time_in_reminder:
                # Con số nằm TRONG cụm nhắc là THỜI LƯỢNG nhắc, không phải giờ
                # đến hạn: "Gửi email báo giá, nhắc trước 1 giờ" từng cho hạn
                # 01:00 (và tiêu đề còn chữ "nhắc trước").
                t, tm = None, None
            infos.append((c, t, tm, r, rm))
    tasks = []
    # Ngày đã biết ở câu trước. Chỉ được mang sang câu KHÔNG nêu ngày khi:
    #   (a) câu trước nói bằng từ tương đối gần — "Sáng mai 7h đi chợ…, trưa
    #       12h họp" → cùng ngày mai; hoặc
    #   (b) câu này NHẮC LẠI đúng tiêu đề đó — "Đi siêu thị thứ 5 7h15. Đi siêu
    #       thị lúc 9h" → cùng ngày (bộ sinh nhãn cũng gán ngày của việc trước).
    # Thứ trong tuần / "ngày kia" / ngày số nêu ở câu trước KHÔNG mang sang việc
    # khác: "Buy milk today… Gym at 6am" là 6h hôm nay, không phải 6h thứ Năm
    # nhắc ở giữa đoạn (bản cũ mang tất ⇒ 3/254 việc lệch ngày, có việc lệch 6 ngày).
    carry = None     # ngày NÊU RÕ ở câu trước
    carry_near = False   # ngày đó có phải từ tương đối gần không
    prev_title = None    # tiêu đề việc trước (để nhận ra câu nhắc lại)
    prev_day = None      # NGÀY THỰC của việc trước (dù câu đó không nêu ngày)
    carry_h = None   # giờ đã resolve ở câu trước (dùng để quyết định kế thừa buổi)
    carry_ph = None  # buổi của câu trước ("…8h30 và …9h" → 9h = 21:00)
    for info in infos:
        if not info:
            continue
        c, t, tm, r, rm = info
        day, dm = _extract_date(c, now)
        title = _clean_title(c, [tm, dm, rm])
        if day is not None:
            carry, carry_near = day, bool(_CARRY_RX.search(c))
        repeat_title = bool(title) and title == prev_title
        # Ngày dùng cho câu này: ngày nêu rõ > ngày tương đối gần của câu trước >
        # NGÀY THỰC của việc trước khi câu này nhắc lại đúng tiêu đề đó. Không có
        # nhánh thứ ba thì "Đọc sách thứ 6 tối 10h. Đọc sách lúc 11h tối" lấy hạn
        # của câu nêu ngày từ tận đầu đoạn (lệch 7 ngày).
        use_day = (day or (carry if carry_near else None)
                   or (prev_day if repeat_title else None))
        hh = t[0] if t else None
        due = None
        if t:
            # Giờ lõm (không nêu buổi) sau câu buổi tối/trưa/chiều → kế thừa
            # buổi khi vẫn đi tiếp về phía sau; buổi sáng/"ngủ" và câu có ngày
            # riêng thì không kế thừa
            if (dm is None and t[3] is None and carry_ph in ("trua", "toi", "dem", "khuya")
                    and 1 <= hh <= 11 and carry_h is not None and hh + 12 >= carry_h):
                hh += 12
            d = use_day or now.date()
            if t[2]:
                d += timedelta(days=1)
            # defensive: validate hour/minute
            if 0 <= hh <= 23 and 0 <= t[1] <= 59:
                due = datetime(d.year, d.month, d.day, hh, t[1], tzinfo=VN_TZ)
        elif day:
            due = datetime(day.year, day.month, day.day, 18, 0, tzinfo=VN_TZ)
        else:
            # Không có giờ lẫn ngày → vẫn phải có thời hạn (backend bắt buộc):
            # mặc định 18:00 ngày kế thừa / hôm nay
            d = use_day or now.date()
            due = datetime(d.year, d.month, d.day, 18, 0, tzinfo=VN_TZ)
        # Giờ đã lùi qua quá khứ mà câu chỉ nêu ngày TƯƠNG ĐỐI ("hôm nay 8h",
        # "sáng nay 8h", "today 9:15am") → dời sang hôm sau ("sau đó 9h" gõ lúc
        # 17h → 9h ngày mai). Bản trước chỉ dồn khi câu KHÔNG nêu ngày, nên mọi
        # câu "hôm nay …" trả hạn quá khứ; backend từ chối (dueAt phải lớn hơn
        # hiện tại) ⇒ người dùng mất việc vừa nhập. Chỉ tôn trọng quá khứ khi
        # người dùng gõ ngày đủ năm ("05/09/2025").
        if due and due <= now and not (dm and _NUM_DATE_RX.search(dm)):
            due += timedelta(days=1)
        # Cập nhật mang ngày/buỗi cho câu sau
        if day is not None:
            carry_ph = t[3] if t else None
            carry_h = (hh + t[1] / 60) if t else None
        elif t:
            if t[3] is not None:
                carry_ph = t[3]
            carry_h = hh + t[1] / 60
        off = r if r is not None else glob_off
        rems = []
        if off is not None and due:
            rems = [{"remindAt": (due + timedelta(minutes=off)).isoformat()}]
        n = _norm(c)
        pri = next((p for k, p in _PRI if k in n), "MEDIUM")
        # Soi chỉ dấu LẶP trên câu ĐÃ BỎ từ của tiêu đề: "Họp daily standup …
        # hàng tháng" phải là MONTHLY, không phải DAILY vì chữ "daily" trong tên
        # việc (trước đây 26/254 việc bị đổi thành lặp hàng ngày — và với gói FREE
        # "không tạo được việc lặp lại" thì việc đó còn bị backend từ chối).
        n_body = _drop_words(n, _norm(title).split()) if title else n
        rep = next((p for k, p in _REP if k in n_body), "NONE")
        # Lịch lặp theo thứ: chỉ có ý nghĩa khi việc thật sự lặp hằng tuần
        # (giống parser phía web) — "Họp team thứ 2 9h" đơn lẻ vẫn là việc một lần.
        rep_days = _extract_repeat_days(c) if rep == "WEEKLY" else []
        cat = next((v for k, v in _CAT.items() if _word_in(k, n)), None)
        if not title:
            continue
        prev_title, prev_day = title, (due.date() if due else None)
        tasks.append({"title": title, "description": "", "dueAt": due.isoformat() if due else None,
                      "priority": pri, "repeatType": rep, "repeatDays": rep_days,
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


if __name__ == "__main__":
    # Chạy khi phát triển: `python serve.py` (đúng như ai/README.md mục 2).
    # Khi deploy thì dùng `uvicorn serve:app --host 0.0.0.0 --port $PORT`.
    if app is None:
        raise SystemExit("Thiếu fastapi/uvicorn — cài: pip install fastapi uvicorn")
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
