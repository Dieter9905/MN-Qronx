"""Test hồi quy cho parser luật của AI riêng (serve.py) — KHÔNG cần HTTP, không cần
model, chỉ cần Python chuẩn:

    cd ai && python test_rules.py

Mỗi test ở đây gắn với một lỗi ĐÃ TỪNG xảy ra thật (đo bằng `evaluate.py --url`
trên 120 mẫu, xem ai/README.md) nên đừng xoá: chúng là lưới chặn tái phát.

Lỗi đã sửa (số đo trước → sau, trên data/eval.jsonl):
  · "…, nhắc trước 1 giờ" bị tách thành việc rác "Nhắc trước" và việc gốc MẤT
    nhắc nhở → số việc 68,3 % → 100 %
  · "ngày 13" nói khi đã qua ngày 13 vẫn trả hạn quá khứ (backend từ chối tạo)
  · cụm "chưa gấp"/"bình thường"/"báo thức đúng giờ" dính vào tiêu đề và mất nhắc
    nhở 0 phút → tiêu đề 54,3 % → 99,2 %
  · "thứ 1" không được nhận là thứ Hai
  · tiếng Anh: "remind me 30 minutes before" khớp tới "min" → tiêu đề
    "…on utes before"; "not urgent" không được nhận
  · câu ngữ cảnh ngày ở đầu đoạn ("Today is Friday, 07/24/2026.") thành việc "Is Friday"
  · danh mục suy luận quá hẹp: 46,9 % → 85,4 %
  · "họp khách 05/10 9h" (ngày/tháng, không có năm) không được hiểu là ngày nào
    ⇒ rơi về hôm nay/ngày mai: lệch 8 ngày, "31/12 20h" lệch 3 tháng, mà người
    dùng không thấy cảnh báo nào
  · "hôm nay 8h15"/"today 9:15am" gõ lúc 10h48 vẫn trả hạn QUÁ KHỨ → backend từ
    chối (dueAt phải lớn hơn hiện tại) và người dùng mất việc vừa nhập
  · chữ "daily" NẰM TRONG TÊN việc bị đọc thành chỉ thị lặp lại: "Họp daily
    standup … hàng tháng" thành DAILY (26/254 việc), và gói FREE (không cho việc
    lặp lại) còn bị backend từ chối thẳng
  · số nằm trong cụm nhắc thành giờ đến hạn: "Gửi email báo giá, quan trọng,
    nhắc trước 1 giờ" → hạn 01:00 và tiêu đề còn "nhắc trước"
"""
import json
import os
import sys
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from evaluate import strip_date  # noqa: E402  (dùng chung cách bỏ câu ngữ cảnh ngày)
from serve import rule_parse  # noqa: E402

# Console Windows mặc định cp1252 → in tiếng Việt sẽ UnicodeEncodeError
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except (ValueError, OSError):
            pass

VN_TZ = timezone(timedelta(hours=7))
NOW = datetime.now(VN_TZ)
FAILED = []


def check(name, cond, detail=""):
    if cond:
        print(f"  ✓ {name}")
    else:
        print(f"  ✗ {name} {('- ' + detail) if detail else ''}")
        FAILED.append(name)


def titles(text):
    return [t["title"] for t in rule_parse(text)]


def one(text):
    tasks = rule_parse(text)
    assert len(tasks) == 1, f"mong 1 việc, được {len(tasks)}: {titles(text)}"
    return tasks[0]


def due(text):
    return datetime.fromisoformat(one(text)["dueAt"])


print("1. Cụm nhắc nhở không được tách thành công việc")
t = rule_parse("Đóng tiền điện 20h, nhắc trước 1 giờ")
check("1 việc (không sinh việc rác 'Nhắc trước')", len(t) == 1, str([x["title"] for x in t]))
check("tiêu đề sạch", t and t[0]["title"] == "Đóng tiền điện", t[0]["title"] if t else "")
check(
    "việc gốc GIỮ được nhắc nhở -60 phút",
    t and len(t[0]["reminders"]) == 1
    and datetime.fromisoformat(t[0]["reminders"][0]["remindAt"])
    == datetime.fromisoformat(t[0]["dueAt"]) - timedelta(minutes=60),
    json.dumps(t[0]["reminders"]) if t else "",
)

print("2. 'ngày N' đã qua phải dồn sang tháng sau")
past_day = 1 if NOW.day > 1 else 2
d = due(f"Đóng tiền điện ngày {past_day} lúc 20h")
expected_month = NOW.month + 1 if NOW.day > past_day else NOW.month
expected_year = NOW.year + (1 if expected_month > 12 else 0)
check(
    f"ngày {past_day} → tháng {expected_month % 12 or 12}/{expected_year} (hôm nay {NOW:%d/%m})",
    d.day == past_day and d.month == (expected_month - 1) % 12 + 1 and d.year == expected_year,
    d.isoformat(),
)
check("hạn luôn ở tương lai", d > NOW, d.isoformat())

print("3. Tiêu đề sạch + 'báo thức đúng giờ' = nhắc 0 phút")
task = one("Đọc sách ngày 13 tối 8h30, chưa gấp, báo thức đúng giờ")
check("tiêu đề chỉ còn 'Đọc sách'", task["title"] == "Đọc sách", task["title"])
check("ưu tiên LOW ('chưa gấp')", task["priority"] == "LOW", task["priority"])
check(
    "nhắc đúng lúc đến hạn",
    len(task["reminders"]) == 1 and task["reminders"][0]["remindAt"] == task["dueAt"],
    json.dumps(task["reminders"]),
)

print("4. 'thứ 1' là thứ Hai")
d = due("Đọc sách thứ 1 lúc 12h45, quan trọng hàng ngày")
check("hạn rơi vào thứ Hai", d.weekday() == 0, d.strftime("%A"))
check("không còn chữ 'thứ 1' trong tiêu đề", one("Đọc sách thứ 1 lúc 12h45")["title"] == "Đọc sách")

print("5. Tiếng Anh: nhắc nhở, 'not urgent', giữ 'Daily standup'")
t = rule_parse("Buy milk today at 2pm. Take medicine on Thursday 9:15pm, remind me 30 minutes before daily.")
check("2 việc", len(t) == 2, str([x["title"] for x in t]))
check("tiêu đề sạch ('on'/'remind…' đã bỏ)", [x["title"] for x in t] == ["Buy milk", "Take medicine"], str([x["title"] for x in t]))
check("nhắc trước 30 phút", len(t[1]["reminders"]) == 1 and datetime.fromisoformat(t[1]["reminders"][0]["remindAt"]) == datetime.fromisoformat(t[1]["dueAt"]) - timedelta(minutes=30), json.dumps(t[1]["reminders"]))
check("lặp hàng ngày", t[1]["repeatType"] == "DAILY", t[1]["repeatType"])
t2 = one("Daily standup today 6:15am, not urgent, remind 1 hour before")
check("giữ chữ 'Daily' trong tên việc", t2["title"] == "Daily standup", t2["title"])
check("'not urgent' → LOW", t2["priority"] == "LOW", t2["priority"])
check("nhắc trước 60 phút", len(t2["reminders"]) == 1 and datetime.fromisoformat(t2["reminders"][0]["remindAt"]) == datetime.fromisoformat(t2["dueAt"]) - timedelta(minutes=60), json.dumps(t2["reminders"]))

print("6. Câu ngữ cảnh ngày ở đầu đoạn không thành công việc")
check("tiếng Anh", titles("Today is Friday, 07/24/2026. Buy milk today at 2pm.") == ["Buy milk"])
check(
    "tiếng Việt",
    titles("Hôm nay là thứ Năm, ngày 08/01/2026. Họp team ngày kia 14h, nhắc trước 30 phút.") == ["Họp team"],
)

print("7. Chỉ thị chung 'mỗi việc' vẫn áp cho TẤT CẢ việc")
t = rule_parse("Đi siêu thị thứ 3 15h15, nhắc trước 30 phút. Khám răng ngày 6 tối 9h, chưa gấp hàng tháng. Nhắc trước 30 phút mỗi việc")
check("2 việc, không có việc rác", [x["title"] for x in t] == ["Đi siêu thị", "Khám răng"], str([x["title"] for x in t]))
check("mỗi việc đều có nhắc nhở", all(len(x["reminders"]) == 1 for x in t), json.dumps([x["reminders"] for x in t]))

print("8. Danh mục suy luận được")
for text, cat in [
    ("Gửi email báo giá ngày 26 21h15", "Công việc"),
    ("Đi siêu thị thứ 4 7h15", "Cá nhân"),
    ("Khám răng ngày 6 tối 9h", "Sức khỏe"),
    ("Làm bài tập Vật lý 13h", "Học tập"),
]:
    got = rule_parse(text)[0]["categoryName"]
    check(f"'{text.split()[0]} …' → {cat}", got == cat, str(got))

print("9. Bất biến trên TOÀN BỘ data/eval.jsonl (không cần service)")
path = os.path.join(HERE, "data", "eval.jsonl")
past = no_due = bad_rem = bad_enum = empty_title = 0
total = 0
with open(path, encoding="utf-8") as f:
    for line in f:
        if not line.strip():
            continue
        text = strip_date(json.loads(line)["input"])
        for t in rule_parse(text):
            total += 1
            if not (t.get("title") or "").strip():
                empty_title += 1
            if not t.get("dueAt"):
                no_due += 1
                continue
            d = datetime.fromisoformat(t["dueAt"])
            if d < NOW:
                past += 1
            if t["priority"] not in ("LOW", "MEDIUM", "HIGH", "URGENT"):
                bad_enum += 1
            if t["repeatType"] not in ("NONE", "DAILY", "WEEKLY", "MONTHLY"):
                bad_enum += 1
            for r in t["reminders"]:
                if datetime.fromisoformat(r["remindAt"]) > d:
                    bad_rem += 1
check(f"{total} việc: không có hạn quá khứ", past == 0, f"{past} việc")
check("mọi việc đều có thời hạn", no_due == 0, f"{no_due} việc")
check("nhắc nhở không bao giờ sau thời hạn", bad_rem == 0, f"{bad_rem} nhắc")
check("mọi việc đều có tiêu đề", empty_title == 0, f"{empty_title} việc")
check("priority/repeatType luôn trong danh sách hợp lệ", bad_enum == 0, f"{bad_enum} việc")

print("10. Ngày dạng '05/10' và giờ đã qua")
FIXED = datetime(2026, 9, 26, 10, 48, tzinfo=VN_TZ)  # Thứ Bảy 26/09/2026, 10h48


def due_at(text, now=FIXED):
    tasks = rule_parse(text, now=now)
    assert len(tasks) == 1, f"mong 1 việc, được {len(tasks)}: {[t['title'] for t in tasks]}"
    return datetime.fromisoformat(tasks[0]["dueAt"])


# Quy ước Việt Nam là NGÀY/THÁNG. Câu tiếng Anh trong bộ dữ liệu không bao giờ dùng
# ngày số (chỉ today/tomorrow/on <thứ>) nên đọc theo kiểu Việt Nam là an toàn.
for text, want, label in [
    ("Họp khách 05/10 9h", "2026-10-05T09:00", "không chữ 'ngày', không năm"),
    ("Họp khách ngày 05/10 9h", "2026-10-05T09:00", "có chữ 'ngày'"),
    ("Họp khách 5/10 9h", "2026-10-05T09:00", "một chữ số"),
    ("Họp khách 05-10 15h", "2026-10-05T15:00", "dấu gạch ngang"),
    ("Họp khách 31/12 20h", "2026-12-31T20:00", "cuối năm"),
    ("Họp khách 05/10/2026 9h", "2026-10-05T09:00", "có năm"),
]:
    got = due_at(text).strftime("%Y-%m-%dT%H:%M")
    check(f"{label}: {text} → {want[:10]}", got == want, got)
check(
    "chữ 'ngày' không dính lại vào tiêu đề",
    [t["title"] for t in rule_parse("Họp khách ngày 05/10 9h", now=FIXED)] == ["Họp khách"],
    str([t["title"] for t in rule_parse("Họp khách ngày 05/10 9h", now=FIXED)]),
)
# Khoảng thời lượng ("10-15 phút") không được đọc thành ngày 10/15
check(
    "'10-15 phút' không thành ngày",
    due_at("Uống thuốc 10-15 phút trước bữa ăn") == FIXED.replace(hour=18, minute=0),
    due_at("Uống thuốc 10-15 phút trước bữa ăn").isoformat(),
)
# Ngày đã qua (không nêu năm) phải dồn sang năm sau, giống quy ước "ngày 13"
check(
    "05/09 đã qua → 05/09 năm sau",
    due_at("Họp khách 05/09 9h") == datetime(2027, 9, 5, 9, 0, tzinfo=VN_TZ),
    due_at("Họp khách 05/09 9h").isoformat(),
)

# Giờ đã qua: backend CHỈ nhận dueAt ở tương lai (taskService.js:58), nên mọi câu
# "hôm nay/today" với giờ đã qua phải dồn sang hôm sau, nếu không việc bị mất.
late_now = datetime(2026, 9, 26, 10, 48, tzinfo=VN_TZ)
for text in [
    "Họp team hôm nay 8h15",
    "Họp team hôm nay lúc sáng 9h",
    "Họp team sáng nay 8h",
    "Team meeting today at 9:15am",
    "Learn English today 6am",
    "Họp khách ngày 26 8h",
    "Họp khách 26/09 8h",
]:
    d = due_at(text, now=late_now)
    check(f"giờ đã qua → tương lai: {text}", d > late_now, d.isoformat())
check(
    "giờ CHƯA qua giữ nguyên trong hôm nay",
    due_at("Họp team tối nay 19h") == datetime(2026, 9, 26, 19, 0, tzinfo=VN_TZ),
    due_at("Họp team tối nay 19h").isoformat(),
)

print("11. Tên việc không được đọc thành chỉ thị / không mất chữ")
t = one("Họp daily standup ngày 5 13h15, nhắc trước 1 giờ hàng tháng")
check("'daily' trong tên việc không thành DAILY", t["repeatType"] == "MONTHLY", t["repeatType"])
check("giữ nguyên tên việc", t["title"] == "Họp daily standup", t["title"])
check(
    "câu tiếng Anh có 'Daily standup' vẫn là việc thường",
    one("Daily standup tomorrow 8:15pm, not urgent, remind me on time")["repeatType"] == "NONE",
)
check(
    "'hằng ngày' (hằng) ra khỏi tiêu đề",
    one("Họp team hằng ngày 8h")["title"] == "Họp team",
    one("Họp team hằng ngày 8h")["title"],
)
# Từ chỉ buổi trước "mai/nay" thuộc cụm thời gian ("sáng mai 6h"), nhưng trước
# "ngày kia" thì thuộc TIÊU ĐỀ ("Ăn tối ngày kia …") — nuốt bừa là mất chữ của tên việc.
check("'sáng mai 6h' không để lại 'sáng' trong tiêu đề", one("Tập gym sáng mai 6h, chưa gấp")["title"] == "Tập gym", one("Tập gym sáng mai 6h, chưa gấp")["title"])
check("giữ nguyên tên việc 'Ăn tối'", one("Ăn tối ngày kia tối 8h30")["title"] == "Ăn tối", one("Ăn tối ngày kia tối 8h30")["title"])
t = one("Gửi email báo giá, quan trọng, nhắc trước 1 giờ")
check("số trong cụm nhắc không thành giờ đến hạn", t["dueAt"][11:16] == "18:00", t["dueAt"])
check("không còn chữ 'nhắc trước' trong tiêu đề", t["title"] == "Gửi email báo giá", t["title"])
check(
    "vẫn giữ nhắc trước 60 phút",
    len(t["reminders"]) == 1
    and datetime.fromisoformat(t["reminders"][0]["remindAt"]) == datetime.fromisoformat(t["dueAt"]) - timedelta(minutes=60),
    json.dumps(t["reminders"]),
)
# Nhắc lại đúng tiêu đề thì theo NGÀY THỰC của việc trước (không lấy ngày nêu ở
# tận đầu đoạn)
t = rule_parse("Hôm nay là thứ Ba, ngày 04/08/2026. Đọc sách thứ 6 tối 10h. Đọc sách lúc 11h tối")
check("việc nhắc lại cùng tiêu đề cùng ngày", t[0]["dueAt"][:10] == t[1]["dueAt"][:10], f"{t[0]['dueAt']} vs {t[1]['dueAt']}")

print()
if FAILED:
    print(f"❌ {len(FAILED)} kiểm tra KHÔNG đạt: " + "; ".join(FAILED))
    sys.exit(1)
print("✅ Tất cả kiểm tra parser luật đều đạt")
