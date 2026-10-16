"""Generate PWA + Android launcher icons from icons/source-logo.*"""
from PIL import Image, ImageDraw
import glob
import os

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
icons = os.path.join(root, "icons")
os.makedirs(icons, exist_ok=True)

candidates = (
    glob.glob(os.path.join(icons, "source-logo.*"))
    + glob.glob(os.path.join(icons, "odogwu-calc-logo.png"))
)
if not candidates:
    raise SystemExit("No source logo found in icons/")

src = candidates[0]
img = Image.open(src).convert("RGBA")
w, h = img.size
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
img = img.crop((left, top, left + side, top + side))

# App chrome behind portrait (matches photo's white studio look)
BG = (255, 255, 255, 255)


def save_png(im, path, size):
    im.resize((size, size), Image.Resampling.LANCZOS).save(path, "PNG")


img.save(os.path.join(icons, "odogwu-calc-logo.png"), "PNG")
save_png(img, os.path.join(icons, "icon-512.png"), 512)
save_png(img, os.path.join(icons, "icon-192.png"), 192)


def rounded(im, size, radius_ratio=0.22):
    base = im.resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    r = int(size * radius_ratio)
    draw.rounded_rectangle((0, 0, size, size), radius=r, fill=255)
    out = Image.new("RGBA", (size, size), BG)
    out.paste(base, (0, 0), mask)
    return out


densities = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
fg = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}

res = os.path.join(root, "android", "app", "src", "main", "res")
for folder, size in densities.items():
    d = os.path.join(res, folder)
    os.makedirs(d, exist_ok=True)
    icon = rounded(img, size)
    icon.save(os.path.join(d, "ic_launcher.png"), "PNG")
    icon.save(os.path.join(d, "ic_launcher_round.png"), "PNG")

for folder, size in fg.items():
    d = os.path.join(res, folder)
    # Fill most of the adaptive safe zone so the face reads clearly
    canvas = Image.new("RGBA", (size, size), BG)
    content = int(size * 0.86)
    logo = img.resize((content, content), Image.Resampling.LANCZOS)
    off = (size - content) // 2
    canvas.paste(logo, (off, off), logo)
    canvas.save(os.path.join(d, "ic_launcher_foreground.png"), "PNG")

print(f"icons written from {src}")
