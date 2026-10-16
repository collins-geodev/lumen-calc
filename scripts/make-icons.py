from PIL import Image, ImageDraw
import os

src = r"C:\Users\colli\.cursor\projects\c-Users-colli-lumen-calc\assets\odogwu-calc-logo-1024.jpg"
root = r"C:\Users\colli\lumen-calc"
icons = os.path.join(root, "icons")
os.makedirs(icons, exist_ok=True)

img = Image.open(src).convert("RGBA")
w, h = img.size
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
img = img.crop((left, top, left + side, top + side))


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
    out = Image.new("RGBA", (size, size), (5, 6, 12, 255))
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
    canvas = Image.new("RGBA", (size, size), (5, 6, 12, 255))
    content = int(size * 0.72)
    logo = img.resize((content, content), Image.Resampling.LANCZOS)
    off = (size - content) // 2
    canvas.paste(logo, (off, off), logo)
    canvas.save(os.path.join(d, "ic_launcher_foreground.png"), "PNG")

print("icons written")
