"""Chấm accuracy AI riêng theo từng field của form tạo việc.

Hai chế độ:

  # 1) Chấm checkpoint NGAY TRÊN MÁY (đúng prompt lúc train, không phụ thuộc service)
  python evaluate.py --ckpt checkpoints/v3 --test data/eval.jsonl

  # 2) Chấm qua HTTP (chấm cái đang phục vụ thật)
  python evaluate.py --url http://localhost:8000 --test data/eval.jsonl

So sánh output với kỳ vọng trong file test JSONL:
  title (exact, lowercase) · dueAt ngày · dueAt giờ · priority ·
  repeatType · reminder (số lượng) · categoryName

LƯU Ý về mấy cái bẫy đã từng làm sai kết quả:
- File test có `input` mở đầu bằng câu tổng hợp "Hôm nay là thứ Năm, ngày
  08/01/2026." Lúc TRAIN, model nhận đúng chuỗi đó (kèm tiền tố "parse: ").
  Vì vậy chế độ --ckpt dùng y nguyên obj["input"].
- Mốc "hôm nay" của MỖI MẪU một khác (trải từ 01/2026 đến 11/2026), còn nhãn
  dueAt là ngày tuyệt đối tính từ mốc đó. Chế độ --url vì thế BẮT BUỘC để
  parser đọc câu ngữ cảnh đó làm mốc neo (serve._ctx_anchor); nếu bỏ câu đi
  (--strip-date) thì parser lấy ngày thật của máy ⇒ mọi so sánh ngày tuyệt đối
  đều trượt và due_day chỉ còn ~4 % — con số vô nghĩa, từng che mất việc parser
  vứt bỏ thông tin ngày mà dataset đã cung cấp. Chỉ dùng --strip-date khi muốn
  kiểm tra riêng phần chữ (title/priority/category).
- Chế độ --url còn phải tránh để parser luật biến câu ngữ cảnh thành việc ảo
  tiêu đề "Là thứ Năm ngày 08/01/2026" ⇒ cổng --min-task-count không bao giờ đạt
  (đã xử lý trong serve.py bằng _CTX_SENT_RX).
- Output JSON 3-5 việc cần ~350-450 token; cắt ở 256 token làm JSON luôn hỏng
  dù model sinh ngoặc đúng. Vì thế có --max-new và mặc định 600.
- Giải mã ảnh hưởng lớn hơn tưởng: greedy cho model v6 sinh vòng lặp lặp hoặc
  nhân đôi công việc, còn beams=4 + no_repeat_ngram=8 cho JSON hợp lệ 4/4.
  Mặc định ở đây phải TRÙNG serve.py, nếu không con số chấm được không mô tả
  cái đang phục vụ thật.
"""
import argparse
import json
import re
import sys
import urllib.request
from datetime import datetime

# Console Windows mặc định là cp1252 → in tiếng Việt sẽ UnicodeEncodeError.
# Đặt lại stdout/stderr sang UTF-8 để `python evaluate.py …` chạy được trên Windows.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except (ValueError, OSError):
            pass

PREFIX = "parse: "
_DATE_SENT_RX = re.compile(
    r"^\s*(?:(?:Hôm nay|Hom nay)\s+là\s+[^.]*?ngày\s+\d{1,2}/\d{1,2}/\d{4}"
    r"|(?:Today|today)\s+is\s+[^.]*?\d{1,2}/\d{1,2}/\d{4})\s*\.\s*",
    re.I)


def strip_date(text):
    """Bỏ câu ngữ cảnh ngày tổng hợp ở đầu (chỉ dùng ở chế độ --url)."""
    return _DATE_SENT_RX.sub("", text, count=1).strip()


# ── hai kiểu "parse" ───────────────────────────────────────────

def call_parse(url, text):
    req = urllib.request.Request(
        url.rstrip("/") + "/parse",
        data=json.dumps({"text": text}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        body = json.load(r)
    return body.get("tasks", []), body.get("model", "")


def make_ckpt_parse(ckpt, max_new=500, default_max=None,
                    num_beams=4, no_repeat_ngram=8):
    """Nạp checkpoint LoRA + tokenizer và trả về hàm parse chạy local."""
    import torch
    from peft import PeftModel
    from transformers import (AutoModelForSeq2SeqLM, AutoTokenizer,
                              BitsAndBytesConfig)

    tok = AutoTokenizer.from_pretrained(ckpt)
    base_id = "VietAI/vit5-base"
    try:
        cfg = json.load(open(f"{ckpt}/adapter_config.json", encoding="utf-8"))
        base_id = cfg.get("base_model_name_or_path") or base_id
    except OSError:
        pass
    kw = {}
    if torch.cuda.is_available():
        kw = dict(quantization_config=BitsAndBytesConfig(
            load_in_4bit=True, bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16), device_map="auto")
    base = AutoModelForSeq2SeqLM.from_pretrained(base_id, **kw)
    if base.config.vocab_size != len(tok):
        # checkpoint mới thêm token '{' '}' → phải khớp vocab trước khi nạp adapter
        base.resize_token_embeddings(len(tok))
    try:
        model = PeftModel.from_pretrained(base, ckpt)
    except Exception:
        model = base
    model.eval()
    model.config.use_cache = True
    device = next(model.parameters()).device
    lb = tok.convert_tokens_to_ids("{")
    rb = tok.convert_tokens_to_ids("}")
    print(f"ckpt={ckpt} | vocab={len(tok)} | id ngoặc mở={lb} ngoặc đóng={rb}"
          f" | cuda={torch.cuda.is_available()}", flush=True)

    def parse(text):
        src = {k: v.to(device) for k, v in tok(
            PREFIX + text[:2000], return_tensors="pt",
            truncation=True, max_length=320).items()}
        n = max_new if default_max is None else min(max_new, default_max)
        # Cấu hình này phải TRÙNG với serve.py, nếu không điểm đo được không nói
        # lên điều gì về cái đang phục vụ thật. Greedy sinh vòng lặp lặp và nhân
        # đôi công việc; beams=4 + no_repeat_ngram=8 là cấu hình cho JSON hợp lệ
        # cao nhất khi đo trên checkpoint v6.
        kw = dict(max_new_tokens=n, do_sample=False, num_beams=max(1, num_beams))
        if no_repeat_ngram > 0:
            kw["no_repeat_ngram_size"] = no_repeat_ngram
        with torch.inference_mode():
            out = model.generate(**src, **kw)
        raw = tok.decode(out[0], skip_special_tokens=True)
        try:
            data = json.loads(raw[raw.index("{"):raw.rindex("}") + 1])
            tasks = data.get("tasks", data) if isinstance(data, dict) else data
            return (tasks if isinstance(tasks, list) else []), raw
        except Exception:
            return [], raw

    return parse


# ── so khớp ────────────────────────────────────────────────────

def norm(s):
    return " ".join(str(s or "").lower().split())


def same_day(a, b):
    try:
        return datetime.fromisoformat(a).date() == datetime.fromisoformat(b).date()
    except Exception:
        return False


def same_hour(a, b):
    try:
        da, db = datetime.fromisoformat(a), datetime.fromisoformat(b)
        return (da.date(), da.hour, da.minute) == (db.date(), db.hour, db.minute)
    except Exception:
        return False


KEYS = ["task_count", "json_ok", "title", "due_day", "due_hour", "priority",
        "repeat", "reminder", "category"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=None, help="chế độ HTTP")
    ap.add_argument("--ckpt", default=None, help="chế độ checkpoint local")
    ap.add_argument("--test", required=True)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--max-new", type=int, default=600,
                    help="trần token sinh ra (target trung bình 345, mẫu 5 việc >500)")
    ap.add_argument("--num-beams", type=int, default=4)
    ap.add_argument("--no-repeat-ngram", type=int, default=8)
    ap.add_argument("--strip-date", action="store_true",
                    help="bỏ câu ngữ cảnh ngày tổng hợp trước khi gửi (chế độ --url)")
    ap.add_argument("--dump", default=None, help="ghi JSON kết quả ra file")
    ap.add_argument("--min-task-count", type=float, default=0.95,
                    help="cổng: accuracy tách số việc tối thiểu (không đạt → exit 1)")
    ap.add_argument("--min-title", type=float, default=0.90,
                    help="cổng: accuracy tiêu đề tối thiểu")
    args = ap.parse_args()
    if not args.ckpt and not args.url:
        ap.error("cần --ckpt hoặc --url")

    rows = []
    with open(args.test, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    if args.limit:
        rows = rows[:args.limit]
    print(f"mẫu: {len(rows)} | nguồn: {args.ckpt or args.url}")

    ckpt_parse = (make_ckpt_parse(args.ckpt, args.max_new, None,
                                 args.num_beams, args.no_repeat_ngram)
                  if args.ckpt else None)

    totals = {k: [0, 0] for k in KEYS}
    n = 0
    fails = 0
    samples = []
    for obj in rows:
        exp = obj["output"]["tasks"]
        text = strip_date(obj["input"]) if (args.url and args.strip_date) else obj["input"]
        try:
            if ckpt_parse:
                got, raw = ckpt_parse(text)
                ok_json = True
            else:
                got, _ = call_parse(args.url, text)
                raw = ""
                ok_json = True
        except Exception as e:
            print(f"FAIL: {type(e).__name__}: {e}")
            continue
        n += 1
        # "JSON đọc được" = json.loads thành công VÀ ra danh sách có việc. Phép
        # kiểm tra lỏng cũ (bắt đầu '{' và kết thúc '}') từng báo 120/120 "hợp
        # lệ" trong khi output thật là `{}} "tasks"} "title"}` lặp vô hạn —
        # nó che mất đúng cái lỗi cần đo.
        ok_json = bool(got)
        totals["json_ok"][1] += 1
        totals["json_ok"][0] += bool(ok_json)
        totals["task_count"][1] += 1
        totals["task_count"][0] += (len(got) == len(exp))
        if not ok_json:
            fails += 1
        for e, g in zip(exp, got):
            for key, ok in [
                ("title", norm(e.get("title")) == norm(g.get("title"))),
                ("due_day", (not e.get("dueAt")) or same_day(e["dueAt"], g.get("dueAt") or "")),
                ("due_hour", (not e.get("dueAt")) or same_hour(e["dueAt"], g.get("dueAt") or "")),
                ("priority", (e.get("priority") or "MEDIUM") == (g.get("priority") or "MEDIUM")),
                ("repeat", (e.get("repeatType") or "NONE") == (g.get("repeatType") or "NONE")),
                ("reminder", len(e.get("reminders") or []) == len(g.get("reminders") or [])),
                ("category", (e.get("categoryName") or None) == (g.get("categoryName") or None)),
            ]:
                totals[key][1] += 1
                totals[key][0] += bool(ok)
        # Dump ĐỦ mẫu: bản trước chỉ lưu 10 mẫu đầu, nên khi phân tích lỗi người
        # đọc tưởng đã xem hết mà thực ra bỏ qua 110/120 mẫu (mọi kết luận "còn
        # lại lỗi gì" đều dựa trên 8 % dữ liệu).
        samples.append({"input": obj["input"][:300], "exp": exp,
                        "got": got, "raw": raw[:600]})
        if args.ckpt and n % 10 == 0:
            print(f"  ... {n}/{len(rows)} mẫu | JSON hỏng {fails}", flush=True)

    print(f"chạy: {n} | JSON đọc được: {fails} mẫu hỏng")
    failed = False
    for k, (ok, total) in totals.items():
        acc = ok / total if total else 0
        mark = ""
        if k == "task_count" and acc < args.min_task_count:
            mark, failed = "  ← RỚT CỔNG", True
        if k == "title" and acc < args.min_title:
            mark, failed = "  ← RỚT CỔNG", True
        print(f"  {k:12s} {ok}/{total} = {acc * 100:.1f} %{mark}"
              if total else f"  {k:12s} n/a")
    if args.dump:
        json.dump({"n": n, "totals": totals, "samples": samples},
                  open(args.dump, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)
        print(f"→ {args.dump}")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
