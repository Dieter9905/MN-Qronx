"""Sinh dataset train AI riêng (>=500 mẫu) từ template có nhãn đúng.

Mỗi mẫu: {"input": "Hôm nay là thứ Hai, ngày 22/09/2026. <câu>",
           "output": {"tasks": [...]}}  (đúng ai/dataset_schema.json)

Nhãn được TÍNH từ slot (không parse lại) nên luôn đúng.
Chạy:  python generate_data.py --train data/train.jsonl --eval data/eval.jsonl
"""
import argparse
import calendar
import json
import os
import random
import sys

# Console Windows mặc định là cp1252 → in tiếng Việt sẽ UnicodeEncodeError.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except (ValueError, OSError):
            pass

WD_VN = ["thứ Hai", "thứ Ba", "thứ Tư", "thứ Năm",
         "thứ Sáu", "thứ Bảy", "Chủ nhật"]

ACTS = [  # (tiêu đề, category)
    ("Tập gym", "Sức khỏe"), ("Chạy bộ", "Sức khỏe"), ("Uống thuốc", "Sức khỏe"),
    ("Khám răng", "Sức khỏe"), ("Tập yoga", "Sức khỏe"), ("Đi bơi", "Sức khỏe"),
    ("Họp team", "Công việc"), ("Gửi email báo giá", "Công việc"),
    ("Review code", "Công việc"), ("Họp daily standup", "Công việc"),
    ("Nộp báo cáo tuần", "Công việc"), ("Gọi điện cho khách hàng", "Công việc"),
    ("Ôn tập Toán chương {}", "Học tập"), ("Học tiếng Anh", "Học tập"),
    ("Làm bài tập Vật lý", "Học tập"), ("Nộp đồ án môn Web", "Học tập"),
    ("Đọc sách", "Cá nhân"), ("Đóng tiền điện", "Cá nhân"),
    ("Mua sữa cho con", "Cá nhân"), ("Ăn trưa", None), ("Ăn tối", None),
    ("Đi siêu thị", "Cá nhân"), ("Dọn nhà", "Cá nhân"),
]

PRIOS = [("", "MEDIUM", 0.55), ("khẩn cấp", "URGENT", 0.10),
         ("quan trọng", "HIGH", 0.15), ("chưa gấp", "LOW", 0.10),
         ("bình thường", "MEDIUM", 0.10)]

REMINDERS = [(None, None, 0.40), ("nhắc trước 10 phút", -10, 0.20),
             ("nhắc trước 30 phút", -30, 0.15), ("nhắc trước 1 giờ", -60, 0.15),
             ("báo thức đúng giờ", 0, 0.10)]

GLOBAL_REM = [("Nhắc trước 10 phút mỗi cái", -10),
              ("Nhắc trước 30 phút mỗi việc", -30)]

EN_ACTS = [
    ("Gym", "Sức khỏe"), ("Go running", "Sức khỏe"), ("Take medicine", "Sức khỏe"),
    ("Team meeting", "Công việc"), ("Review code", "Công việc"),
    ("Send quotation email", "Công việc"), ("Daily standup", "Công việc"),
    ("Study math chapter {}", "Học tập"), ("Learn English", "Học tập"),
    ("Read a book", "Cá nhân"), ("Pay electricity bill", "Cá nhân"),
    ("Buy milk", "Cá nhân"), ("Lunch", None), ("Dinner", None),
]
EN_WD = ["Monday", "Tuesday", "Wednesday", "Thursday",
         "Friday", "Saturday", "Sunday"]
EN_PRIOS = [("", "MEDIUM", 0.60), ("urgent", "URGENT", 0.10),
            ("important", "HIGH", 0.15), ("not urgent", "LOW", 0.15)]
EN_REMS = [(None, None, 0.45), ("remind me 30 minutes before", -30, 0.25),
           ("remind 1 hour before", -60, 0.15),
           ("remind me on time", 0, 0.15)]
EN_GLOBAL = [("Remind 10 minutes before each", -10),
             ("Remind 30 minutes before each", -30)]


def gen_task_en(rng, anchor):
    import datetime as _dt
    ay, am, ad = anchor
    title, cat = rng.choice(EN_ACTS)
    if "{}" in title:
        title = title.format(rng.randint(1, 8))
    kind = rng.choices(["rel", "weekday", "none"],
                       weights=[0.55, 0.25, 0.20])[0]
    anchor_wd = _dt.date(ay, am, ad).weekday()
    day_off, date_ph, rep, wd_iso = 0, "", "NONE", None
    if kind == "rel":
        off, ph = rng.choice([(0, "today"), (1, "tomorrow")])
        day_off, date_ph = off, ph
    elif kind == "weekday":
        wd = rng.randint(0, 6)
        day_off = (wd - anchor_wd) % 7 or 7
        date_ph = f"on {EN_WD[wd]}"
        if rng.random() < 0.35:
            rep, wd_iso = "WEEKLY", [wd + 1]
    slot = rng.choices(["morning", "afternoon", "evening"],
                       weights=[0.35, 0.35, 0.30])[0]
    h = {"morning": rng.randint(5, 10), "afternoon": rng.randint(13, 17),
         "evening": rng.randint(18, 22)}[slot]
    mi = rng.choice([0, 0, 0, 15, 30])
    ap = "am" if h < 12 else "pm"
    h12 = h % 12 or 12
    tstr = f"{h12}{(':%02d' % mi) if mi else ''}{ap}"
    if rng.random() < 0.4:
        tstr = f"at {tstr}"
    base = _dt.date(ay, am, ad) + _dt.timedelta(days=day_off)
    no_due = (kind == "none" and rng.random() < 0.25)
    due = None if no_due else (base.year, base.month, base.day, h, mi)
    if no_due:
        tstr = ""
    prio_ph, prio = pick(EN_PRIOS, rng)
    rem_ph, rem_off = pick(EN_REMS, rng)
    if rep == "NONE" and rng.random() < 0.08:
        rep = "DAILY"
    sent = " ".join(p for p in [title, date_ph, tstr] if p)
    if prio_ph:
        sent += f", {prio_ph}"
    if rem_ph:
        sent += f", {rem_ph}"
    if rep == "DAILY":
        sent += " daily"
    due_iso = fmt(due) if due else None
    rems = []
    if rem_off is not None and due:
        d = _dt.datetime(due[0], due[1], due[2], due[3], due[4])
        d += _dt.timedelta(minutes=rem_off)
        rems = [{"remindAt": f"{d.year:04d}-{d.month:02d}-{d.day:02d}"
                              f"T{d.hour:02d}:{d.minute:02d}:00+07:00"}]
    if rng.random() < 0.15:
        cat = None
    return sent, {"title": title, "description": "", "dueAt": due_iso,
                  "priority": prio, "repeatType": rep,
                  "repeatDays": wd_iso or [], "reminders": rems,
                  "categoryName": cat}


def pick(weighted, rng):
    r = rng.random()
    acc = 0.0
    for a, b, w in weighted:
        acc += w
        if r < acc:
            return a, b
    return weighted[0][0], weighted[0][1]


def add_months(y, m, d, n=1):
    m += n
    while m > 12:
        m -= 12
        y += 1
    d = min(d, calendar.monthrange(y, m)[1])
    return y, m, d


def fmt(dt):
    return f"{dt[0]:04d}-{dt[1]:02d}-{dt[2]:02d}T{dt[3]:02d}:{dt[4]:02d}:00+07:00"


def gen_task(rng, anchor):
    ay, am, ad = anchor
    title, cat = rng.choice(ACTS)
    if "{}" in title:
        title = title.format(rng.randint(1, 8))

    # --- ngày ---
    kind = rng.choices(
        ["rel", "weekday", "monthday", "none"],
        weights=[0.45, 0.25, 0.10, 0.20])[0]
    # weekday của anchor (0=T2)
    import datetime as _dt
    anchor_wd = _dt.date(ay, am, ad).weekday()
    day_off, date_ph, wd_iso, rep = 0, "", None, "NONE"
    if kind == "rel":
        off, ph = rng.choice([(0, "hôm nay"), (1, "ngày mai"), (2, "ngày kia")])
        day_off, date_ph = off, ph
    elif kind == "weekday":
        wd = rng.randint(0, 6)
        delta = (wd - anchor_wd) % 7 or 7
        day_off = delta
        # wd là chỉ số Python (0 = thứ Hai). Tiếng Việt đếm "thứ 2" = thứ Hai …
        # "thứ 7" = thứ Bảy, nên phải là wd + 2. Bản cũ ghi wd + 1 ⇒ câu nói
        # "thứ 4" nhưng nhãn lại rơi vào Thứ Năm: 55/71 việc có nêu tên thứ trong
        # eval.jsonl lệch đúng +1 ngày, và model học luôn ánh xạ sai đó.
        date_ph = "Chủ nhật" if wd == 6 else f"thứ {wd + 2}"
        if rng.random() < 0.35:  # lặp hàng tuần theo đúng thứ đó
            rep, wd_iso = "WEEKLY", [wd + 1]
    elif kind == "monthday":
        dd = rng.randint(1, 28)
        if dd < ad:
            y, m, d = add_months(ay, am, dd)
        else:
            y, m, d = ay, am, dd
        # trả về qua day_off tuyệt đối
        base = _dt.date(ay, am, ad)
        day_off = (_dt.date(y, m, d) - base).days
        date_ph = f"ngày {dd}"
        if rng.random() < 0.30:
            rep = "MONTHLY"
    # --- giờ ---
    slot = rng.choices(["morning", "noon", "afternoon", "evening"],
                       weights=[0.3, 0.15, 0.3, 0.25])[0]
    # Việc mà chính TÊN đã nói buổi phải có giờ đúng buổi đó: bản cũ ghép "Ăn tối"
    # với 07:00 (nhãn "ăn tối lúc 7 giờ sáng") trong khi parser đọc chữ "tối" trong
    # tên thành buổi tối 19:00 ⇒ 5 ca lệch giờ mà câu nào cũng đúng.
    if "tối" in title and slot != "evening":
        slot = "evening"
    elif "trưa" in title and slot != "noon":
        slot = "noon"
    h = {"morning": rng.randint(5, 10), "noon": rng.randint(11, 13),
         "afternoon": rng.randint(14, 17), "evening": rng.randint(18, 22)}[slot]
    mi = rng.choice([0, 0, 0, 15, 30, 45])
    # "tối nay" chỉ hợp khi giờ THẬT SỰ buổi tối. Bản cũ ghép "tối nay" với giờ
    # buổi sáng ("Đọc sách tối nay lúc 8h45" nhưng nhãn 08:45) ⇒ câu nói buổi
    # tối mà nhãn buổi sáng, parser đọc đúng theo câu lại bị tính là sai.
    if kind == "rel" and date_ph == "hôm nay" and slot == "evening" and rng.random() < 0.4:
        date_ph = "tối nay"
    tstr = f"{h}h" + (f"{mi:02d}" if mi else "")
    if slot == "morning" and rng.random() < 0.5:
        tstr = f"sáng {tstr}"
    elif slot == "afternoon" and rng.random() < 0.5:
        tstr = f"chiều {h - 12}h" + (f"{mi:02d}" if mi else "")
        h = h  # giữ giờ 24h cho nhãn
    elif slot == "evening" and rng.random() < 0.5:
        tstr = f"tối {h - 12}h" + (f"{mi:02d}" if mi else "")
    if rng.random() < 0.3:
        tstr = f"lúc {tstr}"

    # --- due ---
    import datetime as _dt2
    base = _dt2.date(ay, am, ad) + _dt2.timedelta(days=day_off)
    no_due = (kind == "none" and rng.random() < 0.25)  # mẫu không hạn → dạy dueAt null
    if no_due:
        tstr = ""  # bỏ giờ khỏi câu để nhãn nhất quán
        due = None  # và bỏ luôn cụm nhắc (nhắc mà không có hạn là vô nghĩa)
    else:
        # có ngày → ngày đó giờ đó; không ngày → hôm nay (anchor) giờ đó
        due = (base.year, base.month, base.day, h, mi)

    # --- ưu tiên / nhắc / lặp ---
    prio_ph, prio = pick(PRIOS, rng)
    rem_ph, rem_off = pick(REMINDERS, rng)
    if no_due:
        rem_ph, rem_off = None, None
    if rep == "NONE" and rng.random() < 0.08:
        rep = "DAILY"

    # --- câu ---
    parts = [title, date_ph, tstr]
    rng.shuffle(parts[1:])  # đảo ngày/giờ, giữ tiêu đề đầu cho tự nhiên
    sent = " ".join(p for p in [parts[0]] + parts[1:] if p)
    if prio_ph:
        sent += f", {prio_ph}"
    if rem_ph:
        sent += f", {rem_ph}"
    if rep == "DAILY":
        sent += " hàng ngày"
    elif rep == "MONTHLY":
        sent += " hàng tháng"
    elif rep == "WEEKLY" and "hàng tuần" not in sent:
        sent += " hàng tuần"

    # --- nhãn ---
    due_iso = fmt(due) if due else None
    rems = []
    if rem_off is not None and due:
        import datetime as _dt3
        d = _dt3.datetime(due[0], due[1], due[2], due[3], due[4])
        d += _dt3.timedelta(minutes=rem_off)
        rems = [{"remindAt": f"{d.year:04d}-{d.month:02d}-{d.day:02d}"
                              f"T{d.hour:02d}:{d.minute:02d}:00+07:00"}]
    if rng.random() < 0.15:
        cat = None
    task = {"title": title, "description": "", "dueAt": due_iso,
            "priority": prio, "repeatType": rep,
            "repeatDays": wd_iso or [], "reminders": rems,
            "categoryName": cat}
    return sent, task, (rem_off is None)


def gen_sample(rng):
    import datetime as _dt
    y = 2026
    m = rng.randint(1, 11)
    d = rng.randint(1, 27)
    anchor = (y, m, d)
    wd = WD_VN[_dt.date(y, m, d).weekday()]
    ctx = f"Hôm nay là {wd}, ngày {d:02d}/{m:02d}/{y}. "
    en = rng.random() < 0.15
    if en:
        ctx = f"Today is {EN_WD[_dt.date(y, m, d).weekday()]}, {m:02d}/{d:02d}/{y}. "
    n = rng.choices([1, 2, 3, 4, 5], weights=[0.35, 0.30, 0.17, 0.10, 0.08])[0]
    sents, tasks = [], []
    has_global = n > 1 and rng.random() < 0.5
    for _ in range(n):
        if en:
            s, t = gen_task_en(rng, anchor)
        else:
            s, t, _ = gen_task(rng, anchor)
            # câu khó: trùng tiêu đề khác giờ → bắt buộc tách, không được gộp
            if n > 1 and rng.random() < 0.15 and tasks and tasks[-1]["dueAt"]:
                import datetime as _dt2
                dup = dict(tasks[-1])
                due0 = _dt2.datetime.fromisoformat(dup["dueAt"])
                # Luôn Ở TRONG CÙNG NGÀY: bản cũ cộng 2h nên 22h → 0h hôm sau (nhãn
                # lệch ngày, mà câu chỉ ghi "lúc 12h" nên đọc ra 12h trưa), và
                # chuỗi dup nối tiếp nhau còn đẩy xa hơn nữa.
                h_dup = min(due0.hour + 2, 22)
                if h_dup == due0.hour:  # 22h rồi thì lùi lại 1h cho khác giờ
                    h_dup = max(due0.hour - 1, 5)
                dd = due0.replace(hour=h_dup)
                # Câu chỉ nói "lúc 9h" nên nhãn phải là 9h00: bản cũ giữ nguyên
                # phút của việc trước rồi +2h (7h15 → nhãn 9h15, lệch 15 phút so
                # với chính câu đó) ⇒ model bị dạy đoán bừa phút.
                h12 = dd.hour % 12 or 12
                # Buổi phải nói ra: 14h mà ghi "lúc 2h" thì đọc là 02:00 (lệch 12
                # giờ so với nhãn).
                mark = " tối" if dd.hour >= 18 else (" chiều" if dd.hour >= 13 else "")
                s = f"{dup['title']} lúc {h12}h{mark}"
                dup["dueAt"] = dd.isoformat()
                dup["reminders"] = []
                # Câu chỉ nhắc lại TIÊU ĐỀ + giờ, không hề nói ưu tiên hay lặp lại ⇒
                # nhãn phải để mặc định; bản cũ chép nguyên của việc trước nên model
                # học cách bịa "quan trọng"/"hàng ngày" từ câu bên cạnh (9 ca lệch
                # ưu tiên + 4 ca lệch lặp lại trong eval).
                dup["priority"] = "MEDIUM"
                dup["repeatType"] = "NONE"
                dup["repeatDays"] = []
                t = dup
        sents.append(s)
        tasks.append(t)
    if has_global:
        if en:
            gph, goff = rng.choice(EN_GLOBAL)
        else:
            gph, goff = rng.choice(GLOBAL_REM)
        sents.append(gph)
        for t in tasks:
            if t["dueAt"] and not t["reminders"]:
                import datetime as _dt2
                dd = _dt2.datetime.fromisoformat(t["dueAt"]) + \
                    _dt2.timedelta(minutes=goff)
                t["reminders"] = [{"remindAt": dd.isoformat()}]
    # strip nhắc riêng khỏi câu khi đã có nhắc chung (tránh nhiễu)
    return {"input": ctx + ". ".join(sents),
            "output": {"tasks": tasks}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train", default="data/train.jsonl")
    ap.add_argument("--eval", default="data/eval.jsonl")
    # Mặc định = đúng bộ đang commit trong data/ (620/100 là con số của bản cũ,
    # gọi không tham số vẫn ra bộ 800/120 như README ghi)
    ap.add_argument("--n-train", type=int, default=800)
    ap.add_argument("--n-eval", type=int, default=120)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    base = os.path.dirname(os.path.abspath(__file__))
    train_p = os.path.join(base, args.train)
    eval_p = os.path.join(base, args.eval)
    os.makedirs(os.path.dirname(train_p), exist_ok=True)

    total = args.n_train + args.n_eval
    samples = [gen_sample(rng) for _ in range(total)]
    rng.shuffle(samples)
    with open(train_p, "w", encoding="utf-8") as f:
        for s in samples[:args.n_train]:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")
    with open(eval_p, "w", encoding="utf-8") as f:
        for s in samples[args.n_train:]:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")
    print(f"train: {args.n_train} → {train_p}")
    print(f"eval : {args.n_eval} → {eval_p}")


if __name__ == "__main__":
    main()
