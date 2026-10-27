# ─── Sinh bộ icon MN-Qronx từ ảnh logo gốc ────────────────────────────
# Chạy: python scripts/gen-brand-icons.py
# Đầu vào: ảnh logo gốc (PNG vuông, nền tối). Tự phát hiện bbox của khối
# rounded-square phát sáng, bo góc trong suốt bằng mask để các icon phẳng.
# Đầu ra:
#   assets/brand/                 — logo gốc + master 512
#   extension/icons/icon{16,32,48,128}.png
#   extension/store/store-icon-128.png
#   public/icons/icon-192.png, icon-512.png, icon-maskable-512.png,
#          apple-touch-icon.png
#   public/favicon.svg            — SVG nhúng PNG base64 (giữ path cũ)
#   desktop/MN-Qronx.Window/Assets/logo.ico

import base64
import io
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw

SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
    r"C:\Users\ADMIN\OneDrive\Hình ảnh\ce65272a-ded3-48ed-b528-f334d1e13c5e.png"
)
ROOT = Path(__file__).resolve().parent.parent

BRAND = ROOT / "assets/brand"
EXT_ICONS = ROOT / "extension/icons"
EXT_STORE = ROOT / "extension/store"
WEB_ICONS = ROOT / "public/icons"
DESKTOP_ASSETS = ROOT / "desktop/MN-Qronx.Window/Assets"

DIST_THRESHOLD = 55   # khoảng cách màu khỏi nền → cửa "phát sáng" thật
PAD = 6               # đệm giữ quang halo quanh khối chính
RADIUS_RATIO = 0.2    # bo góc logo ≈ 20% cạnh


def load_source() -> Image.Image:
    if not SRC.exists():
        sys.exit(f"Không tìm thấy ảnh logo gốc: {SRC}")
    return Image.open(SRC).convert("RGB")


def safe_copy(src: Path, dst: Path) -> None:
    try:
        shutil.copyfile(src, dst)
    except shutil.SameFileError:
        pass  # đã copy có sẵn, không có gì phải làm


def tight_crop(img: Image.Image) -> Image.Image:
    """Cắt sát khối rounded-square (bội số PAD giữ halo)."""
    px = img.load()
    w, h = img.size
    bg = px[3, 3]  # nền ở góc

    def lit(x: int, y: int) -> bool:
        r, g, b = px[x, y]
        return abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > DIST_THRESHOLD

    xs, ys = [], []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if lit(x, y):
                xs.append(x)
                ys.append(y)
    if not xs:
        sys.exit("Ảnh không phát hiện được khối logo")
    left, right = max(0, min(xs) - PAD), min(w, max(xs) + PAD + 1)
    top, bottom = max(0, min(ys) - PAD), min(h, max(ys) + PAD + 1)
    return img.crop((left, top, right, bottom))


def rounded_mask(size: int, ratio: float = RADIUS_RATIO) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * ratio), fill=255)
    return mask


def to_icon(master: Image.Image, size: int) -> Image.Image:
    icon = master.resize((size, size), Image.LANCZOS).convert("RGBA")
    icon.putalpha(rounded_mask(size))
    return icon


def main() -> None:
    src = load_source()
    crop = tight_crop(src)
    # vuông hoá: lấy cạnh lớn hơn, paste giữa
    side = max(crop.size)
    sq = Image.new("RGB", (side, side), crop.load()[3, 3] if side in crop.size else crop.getpixel((0, 0)))
    cx, cy = (side - crop.size[0]) // 2, (side - crop.size[1]) // 2
    sq.paste(crop, (cx, cy))
    master = sq.resize((512, 512), Image.LANCZOS).convert("RGBA")
    master.putalpha(rounded_mask(512))

    # brand master
    BRAND.mkdir(parents=True, exist_ok=True)
    safe_copy(SRC, BRAND / "logo-original.png")
    master.save(BRAND / "logo-512.png")

    # extension icons
    for s in (16, 32, 48, 128):
        to_icon(master, s).save(EXT_ICONS / f"icon{s}.png")
    to_icon(master, 128).save(EXT_STORE / "store-icon-128.png")

    # web icons
    WEB_ICONS.mkdir(parents=True, exist_ok=True)
    to_icon(master, 192).save(WEB_ICONS / "icon-192.png")
    (WEB_ICONS / "icon-512.png").unlink(missing_ok=True)
    to_icon(master, 512).save(WEB_ICONS / "icon-512.png")
    to_icon(master, 180).save(WEB_ICONS / "apple-touch-icon.png")

    # maskable: nền đặc màu góc ảnh + logo 76% (an toàn vùng tròn 80%)
    bg = Image.open(SRC).convert("RGB").getpixel((4, 4))
    maskable = Image.new("RGB", (512, 512), bg)
    inner = master.resize((384, 384), Image.LANCZOS)
    maskable.paste(inner, (64, 64), inner)
    maskable.save(WEB_ICONS / "icon-maskable-512.png")

    # favicon.svg — nhúng PNG base64, giữ nguyên đường dẫn cũ cho cả web + PWA
    buf = io.BytesIO()
    to_icon(master, 128).save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    (ROOT / "public/favicon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">'
        '<image width="128" height="128" href="data:image/png;base64,'
        + b64 + '"/></svg>',
        encoding="utf-8",
    )

    # ICO Windows (nhiều kích thước trong 1 file)
    DESKTOP_ASSETS.mkdir(parents=True, exist_ok=True)
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    imgs = [to_icon(master, s) for s in ico_sizes]
    imgs[-1].save(DESKTOP_ASSETS / "logo.ico", format="ICO", sizes=[(s, s) for s in ico_sizes])

    # ── MSIX: bộ tile/logo theo Package.appxmanifest ────────────────────
    msix = DESKTOP_ASSETS / "Manifest"
    msix.mkdir(parents=True, exist_ok=True)

    def save_scale(name: str, base: int, scales=(100, 125, 150, 200)) -> None:
        for s in scales:
            to_icon(master, round(base * s / 100)).save(msix / f"{name}.scale-{s}.png")

    save_scale("Square44x44Logo", 44)
    save_scale("Square150x150Logo", 150)
    save_scale("StoreLogo", 50)
    # altform-unplated: nền trong suốt sẵn có của icon và rounded mask
    for s in [16, 20, 24, 30, 32, 36, 48, 60, 64, 72, 80, 96, 256]:
        to_icon(master, s).save(msix / f"Square44x44Logo.targetsize-{s}.png")
        to_icon(master, s).save(msix / f"Square44x44Logo.targetsize-{s}_altform-unplated.png")
    # SplashScreen: nền màu góc ảnh + icon giữa (kích thước chuẩn MSIX)
    for w, h, sc in ((620, 300, 100), (775, 375, 125), (930, 450, 150), (1240, 600, 200)):
        splash = Image.new("RGB", (w, h), bg)
        iconside = round(h * 0.55)
        ic = to_icon(master, iconside)
        splash.paste(ic, (round(w / 2 - iconside / 2), round(h / 2 - iconside / 2)), ic)
        splash.save(msix / f"SplashScreen.scale-{sc}.png")

    print("OK — đã sinh icon từ", SRC.name)
    print("  brand:", BRAND / "logo-512.png")
    print("  ext  :", [f"icon{s}.png" for s in (16, 32, 48, 128)])
    print("  web  : icon-192/512, maskable, apple-touch, favicon.svg")
    print("  win  :", DESKTOP_ASSETS / "logo.ico")


if __name__ == "__main__":
    main()
