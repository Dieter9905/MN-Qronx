"""Warmup 2 hàng embedding của '{' '}' — bước bắt buộc để model sinh được JSON.

VÌ SAO CẦN
---------
ViT5 không có token cho '{' '}' nên `train.py` phải `add_tokens` + resize
embedding. Nhưng LR 2e-4 × 250 bước KHÔNG đủ để 2 hàng mới học: đo trên
`checkpoints/v2` thấy loss tại 18 vị trí ngoặc ≈ 11,5 (p ≈ 1,6e-6, tức ngẫu
nhiên) trong khi 342 vị trí còn lại ≈ 0,00. Model thuộc làu nội dung nhưng
không phát ra được dấu ngoặc ⇒ 0 % JSON hợp lệ.

Module này huấn luyện riêng hàng `lm_head` của 2 token đó với LR cao hơn
(mask gradient nên không đụng gì khác). KHÔNG huấn luyện hàng input `shared`:
text đầu vào không chứa '{' nên hàng đó không có gradient, và model đã học
hành vi ứng với vector nhiễu của nó — đổi đi sẽ phá phần nội dung.

VÌ SAO CHẠY TRÊN CHECKPOINT ĐÃ LƯU
----------------------------------
Gọi cùng đoạn code này ngay sau `Trainer.train()` (model còn trong bộ nhớ) thì
KHÔNG cập nhật được gì: loss tại ngoặc 11,603 → 10,987, norm đứng yên — tức
gradient chảy vào tensor khác với tensor được truyền cho optimizer. Vì vậy
`train.py` lưu checkpoint trước, rồi gọi module này trên bản đã lưu (đường đi
này đã đo kiểm chứng). `--probe` sẽ báo thẳng nếu gradient bằng 0.

DÙNG
----
    python warmup.py --ckpt checkpoints/v3            # sửa tại chỗ
    python warmup.py --ckpt checkpoints/v3 --dry-run  # chỉ đo, không ghi
"""
import argparse
import json
import os
import sys

VOCAB_HINT = 36098


def _load(ckpt, base_id="VietAI/vit5-base"):
    import torch
    from peft import PeftModel
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, BitsAndBytesConfig

    tok = AutoTokenizer.from_pretrained(ckpt)
    try:
        cfg = json.load(open(os.path.join(ckpt, "adapter_config.json"), encoding="utf-8"))
        base_id = cfg.get("base_model_name_or_path") or base_id
    except OSError:
        cfg = {}
    kw = {}
    if torch.cuda.is_available():
        kw = dict(quantization_config=BitsAndBytesConfig(
            load_in_4bit=True, bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16), device_map="auto")
    base = AutoModelForSeq2SeqLM.from_pretrained(base_id, **kw)
    if base.config.vocab_size != len(tok):
        base.resize_token_embeddings(len(tok))
    model = PeftModel.from_pretrained(base, ckpt)
    model.config.use_cache = False
    return tok, model, cfg


def warmup_checkpoint(ckpt, lr=1e-3, steps=40, max_pairs=80, train_file=None,
                      dry_run=False, verify=True, log=print):
    """Huấn luyện 2 hàng ngoặc của `lm_head`. Trả True nếu cải thiện rõ."""
    import torch

    tok, model, cfg = _load(ckpt)
    lb = tok.convert_tokens_to_ids("{")
    rb = tok.convert_tokens_to_ids("}")
    unk = tok.unk_token_id
    if lb in (None, unk) or rb in (None, unk):
        log("!! tokenizer không có token '{' '}' → không thể warmup")
        return False
    n_vocab = len(tok)

    cands = [(n, m.weight) for n, m in model.named_modules()
             if "lm_head" in n and hasattr(m, "weight")
             and m.weight.shape[0] == n_vocab]
    if not cands:
        log("!! không tìm thấy lm_head có vocab khớp → không warmup được")
        return False
    log("hàng lm_head tìm thấy: " + ", ".join(n for n, _ in cands))

    train_file = train_file or os.path.join(os.path.dirname(__file__),
                                            "data", "train.jsonl")
    pairs = []
    with open(train_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                pairs.append(json.loads(line))
            if len(pairs) >= max_pairs:
                break
    enc = [(tok("parse: " + r["input"][:2000], truncation=True, max_length=320),
            tok(json.dumps(r["output"], ensure_ascii=False))["input_ids"])
           for r in pairs]

    def brace_loss(n=10):
        model.eval()
        tot = c = 0
        with torch.no_grad():
            for e, lab in enc[:n]:
                src = {k: torch.tensor([v]).to(model.device) for k, v in e.items()}
                ids = torch.tensor([lab]).to(model.device)
                lg = model(**src, labels=ids).logits[0].float()
                ls = torch.nn.functional.cross_entropy(lg, ids[0], reduction="none")
                for i, t in enumerate(lab):
                    if t in (lb, rb):
                        tot += ls[i].item()
                        c += 1
        return tot / max(c, 1)

    def step(src_, ids_, opt, target):
        src = {k: torch.tensor([v]).to(model.device) for k, v in src_.items()}
        ids = torch.tensor([ids_]).to(model.device)
        loss = model(**src, labels=ids).loss
        opt.zero_grad()
        loss.backward()
        return target.grad, loss.item()

    before = brace_loss()

    # ── Chọn đúng tensor: probe 1 bước, tensor nào CÓ gradient mới dùng ──
    chosen, probe_report = None, []
    for name, w in cands:
        for p in model.parameters():
            p.requires_grad_(False)
        w.requires_grad_(True)
        opt = torch.optim.SGD([w], lr=0.0)  # lr=0 → chỉ đo gradient, không đổi
        model.train()
        g, _ = step(*enc[0], opt, w)
        gn = None if g is None else float(g[lb].norm().item())
        probe_report.append(f"{name}: grad-norm tại '{{' = {gn}")
        if g is not None and gn and gn == gn and gn > 0:
            chosen = (name, w)
            break
    log(f"loss tại ngoặc trước = {before:.3f} | " + " | ".join(probe_report))
    if chosen is None:
        log("!! gradient bằng 0 ở mọi ứng viên lm_head → warmup vô hiệu (bỏ qua)")
        return False
    name, target = chosen

    for p in model.parameters():
        p.requires_grad_(False)
    target.requires_grad_(True)
    opt = torch.optim.AdamW([target], lr=lr, eps=1e-6)
    mask = torch.zeros_like(target)
    mask[[lb, rb]] = 1.0
    model.train()
    for s in range(steps):
        g, _ = step(*enc[s % len(enc)], opt, target)
        if g is None:
            log(f"!! bước {s}: gradient None → dừng")
            return False
        g.mul_(mask)
        opt.step()
    after = brace_loss()
    n_lb = float(target[lb].norm().item())
    n_rb = float(target[rb].norm().item())
    log(f"loss tại ngoặc sau  = {after:.3f} | norm ngoặc = {n_lb:.1f} / {n_rb:.1f} "
        f"(trung vị các hàng gốc ≈ 60)")
    ok = after < max(0.5, before * 0.2) and max(n_lb, n_rb) < 300
    if not ok:
        log(f"!! warmup KHÔNG đạt (trước {before:.3f} → sau {after:.3f}) → không ghi đè")
        return False
    if dry_run:
        log("[dry-run] không ghi checkpoint")
        return True
    model.save_pretrained(ckpt)
    log(f"đã ghi {ckpt} (hàng lm_head của 2 ngoặc đã học)")

    if verify:
        tok2, model2, _ = _load(ckpt)
        saved_lb = tok2.convert_tokens_to_ids("{")
        tot = c = 0
        with torch.no_grad():
            for e, lab in enc[:5]:
                src = {k: torch.tensor([v]).to(model2.device) for k, v in e.items()}
                ids = torch.tensor([lab]).to(model2.device)
                lg = model2(**src, labels=ids).logits[0].float()
                ls = torch.nn.functional.cross_entropy(lg, ids[0], reduction="none")
                for i, t in enumerate(lab):
                    if t in (saved_lb, tok2.convert_tokens_to_ids("}")):
                        tot += ls[i].item()
                        c += 1
        log(f"kiểm chứng lại từ đĩa: loss tại ngoặc = {tot / max(c, 1):.3f}")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--steps", type=int, default=40)
    ap.add_argument("--train-file", default=None)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-verify", action="store_true")
    a = ap.parse_args()
    ok = warmup_checkpoint(a.ckpt, lr=a.lr, steps=a.steps,
                           train_file=a.train_file, dry_run=a.dry_run,
                           verify=not a.no_verify)
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
