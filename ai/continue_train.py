"""Huấn luyện CHUNG LoRA + 2 hàng embedding của '{' '}' — bước cuối của recipe.

VÌ SAO CẦN (đo được, không phải suy đoán)
-----------------------------------------
Sau `train.py` model đã học làu nội dung nhưng không phát ra được ngoặc, vì hai
hàng embedding mới khởi tạo ngẫu nhiên gần như không dịch chuyển ở LR 2e-4
(loss tại mọi vị trí ngoặc ≈ 11,5, tức p ≈ 1,6e-6 — như tung xúc xắc). `warmup.py`
sửa 2 hàng đó với LR riêng, nhưng vì LoRA đã học để *phối hợp với hướng ngẫu
nhiên cũ*, output rơi vào vòng lặp ngoặc: `{}} "tasks"} "title"} "title"}…`.

Module này huấn luyện chung (LoRA + 2 hàng ngoặc) để LoRA thích ứng lại. Đo trên
`data/eval.jsonl` với giải mã beams=4 + no_repeat_ngram=8: sau 1500 bước, JSON
hợp lệ 4/4 và tiêu đề đúng 4/5 (trước đó 0/120 vì output không phải JSON).

DÙNG
----
    python continue_train.py --ckpt checkpoints/v3 --steps 1500
    python continue_train.py --ckpt checkpoints/v3 --steps 1500 --measure 8
"""
import argparse
import json
import os
import shutil
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

GEN_KW = dict(num_beams=4, no_repeat_ngram_size=8)
TOKENIZER_FILES = ["tokenizer.json", "tokenizer_config.json",
                   "special_tokens_map.json", "spiece.model", "added_tokens.json"]


def _encoded(tok, train_file="data/train.jsonl", max_pairs=80):
    pairs = []
    with open(train_file, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                pairs.append(json.loads(line))
            if len(pairs) >= max_pairs:
                break
    return [(tok("parse: " + r["input"][:2000], truncation=True, max_length=320),
             tok(json.dumps(r["output"], ensure_ascii=False))["input_ids"])
            for r in pairs]


def _pick_lm_head(model, tok, enc, lb, log=print):
    """Chọn ĐÚNG tensor `lm_head` mà forward dùng: probe 1 bước lr=0.

    Có 3 module cùng tên chứa 'lm_head' (`lm_head`, `lm_head.original_module`,
    `lm_head.modules_to_save.default`); chọn theo thứ tự khai báo có thể trúng
    tensor không được dùng ⇒ huấn luyện vô hiệu mà không báo lỗi.
    """
    import torch
    cands = [(n, m.weight) for n, m in model.named_modules()
             if "lm_head" in n and hasattr(m, "weight")
             and m.weight.shape[0] == len(tok)]
    for name, w in cands:
        for p in model.parameters():
            p.requires_grad_(False)
        w.requires_grad_(True)
        opt = torch.optim.SGD([w], lr=0.0)
        model.train()
        e0, lab0 = enc[0]
        src = {k: torch.tensor([v]).to(model.device) for k, v in e0.items()}
        model(**src, labels=torch.tensor([lab0]).to(model.device)).loss.backward()
        gn = None if w.grad is None else float(w.grad[lb].norm().item())
        log(f"  probe {name}: grad-norm tại '{{' = {gn}")
        if gn and gn > 0:
            model.zero_grad(set_to_none=True)
            return name, w
        model.zero_grad(set_to_none=True)
    return None, None


def _measure(tok, model, n=4, max_new=600, log=print):
    """Đo JSON hợp lệ / đúng số việc / tiêu đề đúng trên n mẫu đầu của eval."""
    import torch
    rows = []
    with open("data/eval.jsonl", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                rows.append(json.loads(line))
            if len(rows) >= n:
                break
    model.eval()
    ok_json = ok_cnt = ok_title = n_title = n_got = n_exp = 0
    for r in rows:
        src = {k: v.to(model.device) for k, v in tok(
            "parse: " + r["input"][:2000], return_tensors="pt",
            truncation=True, max_length=320).items()}
        with torch.inference_mode():
            out = model.generate(**src, max_new_tokens=max_new, **GEN_KW)
        raw = tok.decode(out[0], skip_special_tokens=True)
        exp = r["output"]["tasks"]
        got = []
        try:
            d = json.loads(raw[raw.index("{"):raw.rindex("}") + 1])
            got = d.get("tasks", d) if isinstance(d, dict) else d
            got = got if isinstance(got, list) else []
        except Exception:
            pass
        n_exp += len(exp)
        n_got += len(got)
        ok_json += bool(got)
        ok_cnt += (len(got) == len(exp))
        for e, g in zip(exp, got):
            n_title += 1
            ok_title += (" ".join(str(e.get("title", "")).lower().split())
                         == " ".join(str(g.get("title", "")).lower().split()))
    log(f"  [{n} mẫu] JSON {ok_json}/{n} | đúng số việc {ok_cnt}/{n} | "
        f"tiêu đề {ok_title}/{n_title} | việc sinh {n_got}/{n_exp}")
    return ok_json, ok_cnt


def continue_train(ckpt, steps=1500, lr=2e-4, out=None, batch_pairs=80,
                   measure=0, log=print, base_id="VietAI/vit5-base"):
    """Huấn luyện chung LoRA + 2 hàng ngoặc. Trả True nếu chạy xong."""
    import torch
    from warmup import _load

    out = out or ckpt
    tok, model, _ = _load(ckpt, base_id)
    enc = _encoded(tok, max_pairs=batch_pairs)
    lb = tok.convert_tokens_to_ids("{")
    log(f"huấn luyện chung: {len(enc)} mẫu | {steps} bước | lr={lr:g}")

    name, target = _pick_lm_head(model, tok, enc, lb, log=log)
    if target is None:
        log("!! không tensor nào nhận gradient → dừng (xem warmup.py)")
        return False
    log(f"→ dùng tensor: {name}")

    for p in model.parameters():
        p.requires_grad_(False)
    params = [p for n, p in model.named_parameters()
              if "lora_" in n and p.dtype.is_floating_point]
    for p in params:
        p.requires_grad_(True)
    target.requires_grad_(True)
    log(f"  tham số: {sum(p.numel() for p in params):,} LoRA + 2 hàng ngoặc")

    opt = torch.optim.AdamW(params + [target], lr=lr, eps=1e-6)
    model.train()
    t0, loss = time.time(), None
    for s in range(steps):
        e, lab = enc[s % len(enc)]
        src = {k: torch.tensor([v]).to(model.device) for k, v in e.items()}
        loss = model(**src, labels=torch.tensor([lab]).to(model.device)).loss
        opt.zero_grad()
        loss.backward()
        opt.step()
    log(f"  xong {steps} bước / {time.time() - t0:.0f}s | loss cuối "
        f"{loss.item() if loss is not None else float('nan'):.4f}")

    model.config.use_cache = True
    model.save_pretrained(out)
    for f in TOKENIZER_FILES:
        src_f = os.path.join(ckpt, f)
        if os.path.exists(src_f):
            shutil.copy(src_f, os.path.join(out, f))
    log(f"→ đã ghi {out}")
    if measure:
        _measure(tok, model, n=measure, log=log)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True)
    ap.add_argument("--out", default=None)
    ap.add_argument("--steps", type=int, default=1500)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--measure", type=int, default=0, help="số mẫu eval để đo")
    a = ap.parse_args()
    ok = continue_train(a.ckpt, steps=a.steps, lr=a.lr, out=a.out,
                        measure=a.measure)
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
