"""Íconos de la app con la estética bodegón: madera, paño verde, borde de bronce y las cuatro matas en abanico."""
import math, os, random, sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'public')
S = 1024  # se dibuja grande y se achica

WOOD, WOOD2, WOOD3 = (42, 27, 20), (58, 39, 29), (75, 52, 38)
FELT, FELT2, FELTL = (31, 90, 69), (23, 71, 55), (42, 115, 88)
BRASS, BRASS2 = (201, 162, 75), (227, 196, 120)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def wood(size):
    """Madera oscura con vetas."""
    rnd = random.Random(7)
    im = Image.new('RGB', (size, size), WOOD)
    d = ImageDraw.Draw(im)
    y = 0
    while y < size:
        h = rnd.randint(6, 22)
        c = lerp(WOOD, WOOD3 if rnd.random() < 0.35 else WOOD2, rnd.random() * 0.8)
        d.rectangle([0, y, size, y + h], fill=c)
        y += h
    im = im.filter(ImageFilter.GaussianBlur(size / 300))
    # vetas onduladas
    d = ImageDraw.Draw(im)
    for _ in range(40):
        y0 = rnd.uniform(0, size)
        amp, freq, ph = rnd.uniform(4, 18), rnd.uniform(1, 3), rnd.uniform(0, 6)
        pts = [(x, y0 + amp * math.sin(x / size * freq * math.pi * 2 + ph)) for x in range(0, size + 8, 8)]
        d.line(pts, fill=lerp(WOOD, (20, 12, 8), rnd.uniform(0.3, 0.8)), width=rnd.randint(1, 3))
    return im.filter(ImageFilter.GaussianBlur(size / 700))


def vignette(size, strength=0.55):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).ellipse([-size * 0.15, -size * 0.2, size * 1.15, size * 1.1], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(size / 6))
    return m.point(lambda v: int(255 - (255 - v) * strength))


def rounded_mask(size, box, r):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle(box, radius=r, fill=255)
    return m


def felt(size):
    """Paño con una luz arriba al centro, como una lámpara sobre la mesa."""
    im = Image.new('RGB', (size, size), FELT2)
    light = Image.new('L', (size, size), 0)
    ImageDraw.Draw(light).ellipse([size * 0.05, -size * 0.1, size * 0.95, size * 0.85], fill=255)
    light = light.filter(ImageFilter.GaussianBlur(size / 5))
    im = Image.composite(Image.new('RGB', (size, size), FELTL), im, light)
    noise = Image.effect_noise((size, size), 18).convert('L')
    return ImageChops.overlay(im, Image.merge('RGB', [noise] * 3)).filter(ImageFilter.GaussianBlur(0.6))


def card(name, h):
    c = Image.open(os.path.join(ROOT, 'public', 'naipes', name + '.webp')).convert('RGBA')
    w = round(c.width * h / c.height)
    return c.resize((w, h), Image.LANCZOS)


def paste_card(base, c, cx, cy, angle):
    r = c.rotate(-angle, resample=Image.BICUBIC, expand=True)
    # sombra
    a = r.split()[3]
    sh = Image.new('RGBA', r.size, (0, 0, 0, 0))
    sh.putalpha(a.point(lambda v: v * 0.55))
    sh = sh.filter(ImageFilter.GaussianBlur(S / 90))
    x, y = int(cx - r.width / 2), int(cy - r.height / 2)
    base.alpha_composite(sh, (x + S // 120, y + S // 60))
    base.alpha_composite(r, (x, y))


def fan(base, cx, cy, h, spread=15, radius=None):
    """Las cuatro matas: 7 de oro, 7 de espada, ancho de basto y ancho de espada adelante."""
    names = ['7o', '7e', '1b', '1e']
    radius = radius or h * 1.15
    n = len(names)
    for i, nm in enumerate(names):
        ang = (i - (n - 1) / 2) * spread
        rad = math.radians(ang)
        x = cx + radius * math.sin(rad)
        y = cy + radius * (1 - math.cos(rad))
        paste_card(base, card(nm, h), x, y, ang)


def build(full_bleed=False):
    """full_bleed: para el ícono 'maskable' (Android recorta la forma): sin bordes y con el abanico en la zona segura."""
    base = wood(S).convert('RGBA')
    if full_bleed:
        inset, r = int(S * 0.07), int(S * 0.18)
    else:
        inset, r = int(S * 0.075), int(S * 0.16)
    box = [inset, inset, S - inset, S - inset]
    # borde de bronce
    rim = Image.new('RGBA', (S, S), BRASS2 + (255,))
    grad = Image.linear_gradient('L').resize((S, S)).rotate(-35)
    rim = Image.composite(Image.new('RGBA', (S, S), BRASS2 + (255,)), Image.new('RGBA', (S, S), (150, 112, 44, 255)), grad)
    base.paste(rim, (0, 0), rounded_mask(S, box, r))
    b = int(S * 0.022)
    inner = [box[0] + b, box[1] + b, box[2] - b, box[3] - b]
    base.paste(felt(S), (0, 0), rounded_mask(S, inner, r - b))
    # sombra interior del paño
    sh = Image.new('L', (S, S), 0)
    ImageDraw.Draw(sh).rounded_rectangle(inner, radius=r - b, outline=255, width=int(S * 0.03))
    sh = ImageChops.multiply(sh.filter(ImageFilter.GaussianBlur(S / 60)), rounded_mask(S, inner, r - b))
    base.alpha_composite(Image.merge('RGBA', [Image.new('L', (S, S), 0)] * 3 + [sh.point(lambda v: v * 0.6)]))

    if full_bleed:
        fan(base, S * 0.53, S * 0.46, int(S * 0.4), spread=12)
    else:
        fan(base, S * 0.53, S * 0.45, int(S * 0.5), spread=13)

    # luz general
    v = vignette(S)
    dark = Image.new('RGBA', (S, S), (10, 6, 4, 255))
    out = Image.composite(base, dark, v)
    return out.convert('RGB')


def rounded_png(im, size, radius_ratio):
    """Para el favicon: esquinas transparentes."""
    im = im.resize((size, size), Image.LANCZOS).convert('RGBA')
    m = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], radius=int(size * 4 * radius_ratio), fill=255)
    im.putalpha(m.resize((size, size), Image.LANCZOS))
    return im


std = build()
mask = build(full_bleed=True)
os.makedirs(OUT, exist_ok=True)
std.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, 'icon-512.png'), optimize=True)
std.resize((192, 192), Image.LANCZOS).save(os.path.join(OUT, 'icon-192.png'), optimize=True)
mask.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, 'icon-maskable-512.png'), optimize=True)
mask.resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, 'apple-touch-icon.png'), optimize=True)
# favicon: sin madera alrededor, solo el paño con el borde, para que se vea a 32px
fav = std.crop((int(S * 0.075), int(S * 0.075), int(S * 0.925), int(S * 0.925)))
rounded_png(fav, 64, 0.2).save(os.path.join(OUT, 'favicon.png'), optimize=True)
print('ok')
