"""Fine-tune ViT5 (+QLoRA 4-bit, vừa GPU 4GB như RTX 3050 Laptop)
cho task parse tiếng Việt → JSON công việc.

Input : "parse: Hôm nay là thứ Hai, ngày 22/09/2026. Sáng 7h tập gym..."
Target: '{"tasks":[{...}]}'  (đúng ai/dataset_schema.json)

VD:  python train.py --train data/train.jsonl --eval data/eval.jsonl --out checkpoints/v1
     python train.py --demo   (khói: 200 mẫu, 1 epoch, CPU/GPU đều chạy)
"""
import argparse
import json
import random

import numpy as np

PREFIX = "parse: "
SRC_LEN, TGT_LEN = 320, 768  # câu dài 4-5 việc JSON ~600 token


def load_pairs(path, limit=None):
    pairs = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            src = PREFIX + obj["input"][:2000]
            tgt = json.dumps(obj["output"], ensure_ascii=False)
            pairs.append((src, tgt))
            if limit and len(pairs) >= limit:
                break
    return pairs


def brace_warmup_inprocess_unused(model, tok, pairs, lr=1e-3, steps=40,
                                  max_pairs=80, log=print):
    """ĐÃ BỎ KHỎI LUỒNG — chỉ giữ để đối chiếu, KHÔNG gọi.

    Gọi hàm này ngay sau `Trainer.train()` (model còn trong bộ nhớ) thì KHÔNG
    cập nhật được gì: gradient chảy vào tensor khác với tensor được truyền cho
    optimizer, đo được loss tại ngoặc 11,603 → 10,987 và norm đứng yên. Đường
    chạy đúng là `warmup.warmup_checkpoint()` trên checkpoint ĐÃ LƯU rồi
    `continue_train.continue_train()`.

    Giai đoạn 2 — bắt buộc, nếu không model KHÔNG sinh được JSON.

    Hai hàng embedding của '{' '}' được thêm mới nên khởi tạo ngẫu nhiên. Trong
    lần chạy 250 bước × LR 2e-4, chúng gần như không dịch chuyển: đo trên
    checkpoints/v2 thấy loss tại MỌI vị trí ngoặc ≈ 11,5 (p ≈ 1,6e-6, tức ngẫu
    nhiên) trong khi mọi vị trí khác ≈ 0,00 — model thuộc làu nội dung nhưng
    không thể phát ra ngoặc ⇒ output không phải JSON. LR 2e-4 quá nhỏ cho hai
    hàng còn lại ở giá trị khởi tạo. Giai đoạn này chỉ huấn luyện riêng 2 hàng
    đó với LR cao hơn, giữ nguyên toàn bộ phần còn lại (LoRA + base).
    """
    import torch

    lb = tok.convert_tokens_to_ids("{")
    rb = tok.convert_tokens_to_ids("}")
    unk = tok.unk_token_id
    if lb in (None, unk) or rb in (None, unk):
        log("!! tokenizer thiếu token '{' '}' — bỏ qua warmup")
        return
    target = None
    for name, mod in model.named_modules():
        if "lm_head" in name and name.endswith("modules_to_save.default"):
            target = mod.weight
    if target is None:
        log("!! không thấy lm_head trong modules_to_save — bỏ qua warmup")
        return

    model.gradient_checkpointing_disable()  # không cần, và tránh lỗi "no input requires grad"
    model.eval()
    sample = pairs[:max_pairs]
    enc = []
    for src, tgt in sample:
        e = tok(src, truncation=True, max_length=SRC_LEN)
        lab = tok(tgt, truncation=True, max_length=TGT_LEN)["input_ids"]
        enc.append((e, lab))

    def brace_loss():
        model.eval()
        tot = n = 0
        with torch.no_grad():
            for e, lab in enc[:10]:
                ids = torch.tensor([lab]).to(model.device)
                src = {k: torch.tensor([v]).to(model.device) for k, v in e.items()}
                lg = model(**src, labels=ids).logits[0].float()
                ls = torch.nn.functional.cross_entropy(lg, ids[0], reduction="none")
                for i, t in enumerate(lab):
                    if t in (lb, rb):
                        tot += ls[i].item()
                        n += 1
        return tot / max(n, 1)

    before = brace_loss()
    log(f"brace warmup: loss tại ngoặc trước = {before:.3f} "
        f"(lr={lr:g}, {steps} bước, {len(enc)} mẫu)")
    for p in model.parameters():
        p.requires_grad_(False)
    target.requires_grad_(True)
    opt = torch.optim.AdamW([target], lr=lr, eps=1e-6)
    mask = torch.zeros_like(target)
    mask[[lb, rb]] = 1.0
    model.train()
    for s in range(steps):
        e, lab = enc[s % len(enc)]
        src = {k: torch.tensor([v]).to(model.device) for k, v in e.items()}
        ids = torch.tensor([lab]).to(model.device)
        loss = model(**src, labels=ids).loss
        opt.zero_grad()
        loss.backward()
        target.grad.mul_(mask)  # chỉ 2 hàng ngoặc được cập nhật
        opt.step()
    after = brace_loss()
    log(f"brace warmup: loss tại ngoặc sau  = {after:.3f}"
        f" | norm ngoặc mở = {target[lb].norm().item():.1f}"
        f" | ngoặc đóng = {target[rb].norm().item():.1f}"
        f" (trung vị các hàng gốc ≈ 60)")
    model.config.use_cache = True


def set_seed(seed=42):
    import torch
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train", default="data/train.jsonl")
    ap.add_argument("--eval", default="data/eval.jsonl")
    ap.add_argument("--out", default="checkpoints/v1")
    ap.add_argument("--base", default="VietAI/vit5-base")
    ap.add_argument("--epochs", type=int, default=5)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--no-quant", action="store_true",
                    help="tắt 4-bit (chỉ khi VRAM >= 12GB)")
    ap.add_argument("--demo", action="store_true")
    ap.add_argument("--brace-lr", type=float, default=1e-3,
                    help="LR cho giai đoạn warmup 2 hàng ngoặc")
    ap.add_argument("--brace-steps", type=int, default=40)
    ap.add_argument("--extra-steps", type=int, default=1500,
                    help="số bước huấn luyện CHUNG (LoRA + 2 hàng ngoặc) sau "
                         "warmup; 0 = tắt (chỉ train, xem continue_train.py)")
    ap.add_argument("--no-brace-warmup", action="store_true",
                    help="tắt warmup (CHỈ để tái hiện lỗi cũ: model sẽ không sinh được JSON)")
    ap.add_argument("--limit", type=int, default=None,
                    help="giới hạn số mẫu train (smoke test)")
    args = ap.parse_args()
    set_seed(args.seed)

    import torch
    from datasets import Dataset
    from transformers import (
        AutoTokenizer, AutoModelForSeq2SeqLM,
        BitsAndBytesConfig, DataCollatorForSeq2Seq,
        TrainingArguments, Trainer,
    )
    from peft import LoraConfig, get_peft_model, TaskType, prepare_model_for_kbit_training

    use_cuda = torch.cuda.is_available()
    print(f"device: {'cuda:' + torch.cuda.get_device_name(0) if use_cuda else 'cpu'}")

    train_pairs = load_pairs(args.train,
                            limit=args.limit or (200 if args.demo else None))
    eval_pairs = load_pairs(args.eval) if args.eval else train_pairs[-50:]
    if args.demo:
        args.epochs = 1
    print(f"train: {len(train_pairs)} | eval: {len(eval_pairs)}")

    tok = AutoTokenizer.from_pretrained(args.base)
    # ViT5 KHÔNG có token cho '{' '}' → mọi dấu ngoặc nhọn trong JSON target bị
    # mã hoá thành <unk>, nên model không thể học sinh ra JSON hợp lệ. Thêm 2
    # token này rồi mở rộng embedding — bắt buộc, phải làm TRƯỚC khi train.
    added = tok.add_tokens(["{", "}"], special_tokens=False)
    print(f"tokenizer: {len(tok)} token (thêm {added} token: '{{' '}}')")
    if use_cuda and not args.no_quant:
        model = AutoModelForSeq2SeqLM.from_pretrained(
            args.base,
            quantization_config=BitsAndBytesConfig(
                load_in_4bit=True, bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=torch.float16),
            device_map="auto")
        model = prepare_model_for_kbit_training(model)
    else:
        model = AutoModelForSeq2SeqLM.from_pretrained(args.base)
    model.resize_token_embeddings(len(tok))
    model = get_peft_model(model, LoraConfig(
        task_type=TaskType.SEQ_2_SEQ_LM, r=8, lora_alpha=16,
        lora_dropout=0.05, target_modules=["q", "v"],
        # Bắt buộc: lm_head/shared phải được huấn luyện VÀ lưu lại, nếu không
        # hàng embedding mới của '{' '}' chỉ là trung bình ngẫu nhiên và mất khi save.
        modules_to_save=["lm_head", "shared"]))
    model.config.use_cache = False  # bắt buộc khi gradient checkpointing
    model.gradient_checkpointing_enable()
    model.print_trainable_parameters()

    def tok_fn(batch):
        src = tok(batch["src"], truncation=True, max_length=SRC_LEN)
        with tok.as_target_tokenizer():
            tgt = tok(batch["tgt"], truncation=True, max_length=TGT_LEN)
        src["labels"] = tgt["input_ids"]
        return src

    train_ds = Dataset.from_dict(
        {"src": [p[0] for p in train_pairs], "tgt": [p[1] for p in train_pairs]}
    ).map(tok_fn, batched=True, remove_columns=["src", "tgt"])
    eval_ds = Dataset.from_dict(
        {"src": [p[0] for p in eval_pairs], "tgt": [p[1] for p in eval_pairs]}
    ).map(tok_fn, batched=True, remove_columns=["src", "tgt"])

    targs = TrainingArguments(
        output_dir=args.out,
        num_train_epochs=args.epochs,
        learning_rate=args.lr,
        per_device_train_batch_size=1,      # 4GB VRAM: batch 1 × tích lũy 16
        gradient_accumulation_steps=16,
        per_device_eval_batch_size=1,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,        # chỉ giữ checkpoint eval tốt nhất
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        logging_steps=20,
        report_to="none",
        seed=args.seed,
    )
    Trainer(
        model=model,
        args=targs,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        data_collator=DataCollatorForSeq2Seq(tok, model=model),
        tokenizer=tok,
    ).train()
    # LƯU TRƯỚC rồi mới warmup — thứ tự này là bắt buộc, xem warmup.py.
    model.save_pretrained(args.out)
    tok.save_pretrained(args.out)
    print(f"OK → checkpoint tốt nhất: {args.out}")

    if not args.no_brace_warmup:
        # Bắt buộc: nếu bỏ, model học thuộc nội dung nhưng không phát ra được '{'
        # '}' ⇒ output không phải JSON (đúng lỗi của checkpoints/v1 và v2).
        # PHẢI gọi warmup_checkpoint trên bản ĐÃ LƯU: gọi cùng đoạn code đó khi
        # model còn trong bộ nhớ thì gradient chảy vào tensor khác với tensor
        # truyền cho optimizer nên không cập nhật gì (loss 11,60 → 10,99).
        from warmup import warmup_checkpoint
        if not warmup_checkpoint(args.out, lr=args.brace_lr,
                                 steps=args.brace_steps):
            print("!! warmup 2 hàng ngoặc KHÔNG đạt → model sẽ không sinh được "
                  "ngoặc, output không phải JSON (xem warmup.py --dry-run)")

    if args.extra_steps:
        # Bắt buộc nếu muốn dùng được: sau khi 2 hàng ngoặc đổi hướng, LoRA đã
        # học với hướng CŨ nên phải huấn luyện chung thêm (xem continue_train.py).
        from continue_train import continue_train
        continue_train(args.out, steps=args.extra_steps, lr=args.lr,
                       out=args.out)


if __name__ == "__main__":
    main()
