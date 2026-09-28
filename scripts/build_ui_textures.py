"""Build the storybook UI textures from the game's own painted art.

Outputs to src/assets/ui/:
    board.png        warm plank board with a bevelled rim and iron nails (9-slice, 28px)
    board-dark.png   the same board stained dark, for HUD plaques that carry light text
    plank-tile.png   a strip of planks that tiles sideways, for wide bars (market header/footer)
    parchment.png    aged paper with deckled, lightly burnt edges (9-slice, 56px)
    ribbon.png       a forest-green cloth ribbon with notched tails (9-slice left/right, 64px)
    seal.png         a red wax seal for the level badge

The planks are cut from the painted timber bridge (src/assets/storybook/timber-bridge-source.png),
so the UI wood matches the wood in the world.

Usage: python scripts/build_ui_textures.py   (needs Pillow and numpy)
"""
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = f'{ROOT}/src/assets/ui'
BRIDGE = f'{ROOT}/src/assets/storybook/timber-bridge-source.png'
random.seed(7)
rng = np.random.default_rng(7)

# Clean stretches of plank between the nail rows, as (left, right) columns on the bridge.
PLANKS = [(282, 372), (407, 494), (522, 612), (652, 742), (782, 868), (906, 994), (1032, 1122), (1157, 1247), (1283, 1372), (1407, 1490)]
PLANK_TOP, PLANK_BOTTOM = 280, 598


def plank(i):
    """One plank, turned so its grain runs sideways."""
    left, right = PLANKS[i % len(PLANKS)]
    return Image.open(BRIDGE).convert('RGB').crop((left, PLANK_TOP, right, PLANK_BOTTOM)).rotate(90, expand=True)


def plank_rows(width, height, rows, start=0):
    """Rows of planks laid end to end, with dark seams between rows and butt joints within them."""
    board = Image.new('RGB', (width, height))
    row_h = height / rows
    for r in range(rows):
        top, bottom = round(r * row_h), round((r + 1) * row_h)
        a, b = plank(start + r * 3), plank(start + r * 3 + 1)
        joint = random.randint(width // 3, width * 2 // 3)
        board.paste(a.resize((joint, bottom - top), Image.LANCZOS), (0, top))
        board.paste(b.resize((width - joint, bottom - top), Image.LANCZOS), (joint, top))
        d = ImageDraw.Draw(board)
        d.line([(joint, top), (joint, bottom)], fill=(58, 34, 16), width=2)
        if r:
            d.line([(0, top - 1), (width, top - 1)], fill=(52, 30, 14), width=3)
            d.line([(0, top + 2), (width, top + 2)], fill=(214, 160, 96), width=1)
    return board


def rounded_mask(size, radius):
    mask = Image.new('L', size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return mask


def bevel(img, depth, dark, light):
    """Darken towards the rim and catch a highlight along the top: a carved, bevelled edge."""
    w, h = img.size
    a = np.asarray(img).astype(float)
    y, x = np.mgrid[0:h, 0:w]
    edge = np.minimum.reduce([x, y, w - 1 - x, h - 1 - y]).astype(float)
    shade = np.clip(1 - edge / depth, 0, 1) ** 1.6
    a = a * (1 - shade[..., None] * dark)
    a[:2, :, :] = a[:2, :, :] * (1 - light) + 255 * light
    return Image.fromarray(np.clip(a, 0, 255).astype('uint8'))


def nail(draw, x, y, r=4.5):
    draw.ellipse([x - r - 1, y - r - 1, x + r + 1, y + r + 1], fill=(40, 26, 16))
    draw.ellipse([x - r, y - r, x + r, y + r], fill=(88, 86, 84))
    draw.ellipse([x - r * .7, y - r * .75, x + r * .2, y + r * .05], fill=(168, 164, 156))
    draw.ellipse([x - r * .35, y - r * .45, x - r * .05, y - r * .15], fill=(226, 222, 212))


def build_board(dark=False):
    w, h = 600, 150
    board = plank_rows(w, h, 3, start=4 if dark else 0)
    a = np.asarray(board).astype(float)
    grey = a.mean(axis=2, keepdims=True)
    # stain: dark for HUD plaques, and a gentler honey tone than the sunlit bridge for buttons
    a = (a * .75 + grey * .25) * .5 if dark else (a * .88 + grey * .12) * .86
    board = Image.fromarray(np.clip(a, 0, 255).astype('uint8'))
    board = bevel(board, 16, .62, .28 if not dark else .12)
    d = ImageDraw.Draw(board)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=13, outline=(34, 19, 8), width=3)
    d.rounded_rectangle([3, 3, w - 4, h - 4], radius=11, outline=(232, 178, 108) if not dark else (130, 92, 56), width=1)
    for x, y in [(15, 15), (w - 15, 15), (15, h - 15), (w - 15, h - 15)]:
        nail(d, x, y)
    out = board.convert('RGBA')
    out.putalpha(rounded_mask((w, h), 13))
    out.save(f'{OUT}/board-dark.png' if dark else f'{OUT}/board.png')


def build_plank_tile():
    """Planks whose left and right edges meet, so the strip can repeat sideways."""
    w, h = 512, 96
    strip = plank_rows(w, h, 2, start=2)
    a = np.asarray(strip).astype(float)
    blend = 48
    mirror = a[:, ::-1]
    ramp = np.clip(np.minimum(np.arange(w), w - 1 - np.arange(w)) / blend, 0, 1)[None, :, None]
    a = a * ramp + mirror * (1 - ramp)
    a = a * .92
    Image.fromarray(np.clip(a, 0, 255).astype('uint8')).save(f'{OUT}/plank-tile.png')


def smooth_noise(w, h, cell):
    small = rng.random((max(2, h // cell + 2), max(2, w // cell + 2)))
    return np.asarray(Image.fromarray((small * 255).astype('uint8')).resize((w, h), Image.BICUBIC)).astype(float) / 255


def build_parchment():
    w, h = 720, 540
    base = np.array([238, 222, 183], dtype=float)
    mottle = smooth_noise(w, h, 90) * .55 + smooth_noise(w, h, 30) * .3 + smooth_noise(w, h, 8) * .15
    fibre = rng.normal(0, 1, (h, w))
    a = base[None, None, :] * (0.9 + mottle[..., None] * 0.16) + fibre[..., None] * 3.2
    # a few faint age spots
    y, x = np.mgrid[0:h, 0:w]
    for _ in range(9):
        cx, cy, r = rng.uniform(60, w - 60), rng.uniform(60, h - 60), rng.uniform(18, 60)
        spot = np.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / (2 * r * r)))
        a -= spot[..., None] * np.array([10, 14, 22]) * rng.uniform(.4, 1)
    # deckled edge: the distance to the edge, roughened with noise
    edge = np.minimum.reduce([x, y, w - 1 - x, h - 1 - y]).astype(float)
    rough = edge - (smooth_noise(w, h, 14) * 9 + smooth_noise(w, h, 4) * 3)
    burn = np.clip(1 - rough / 34, 0, 1) ** 1.8
    burnt = np.array([122, 78, 38], dtype=float)
    a = a * (1 - burn[..., None] * .8) + burnt[None, None, :] * burn[..., None] * .8
    rim = np.clip(1 - rough / 6, 0, 1)
    a = a * (1 - rim[..., None] * .5)
    alpha = np.clip((rough - 1) * 90, 0, 255)
    img = Image.fromarray(np.clip(a, 0, 255).astype('uint8')).convert('RGBA')
    img.putalpha(Image.fromarray(alpha.astype('uint8')).filter(ImageFilter.GaussianBlur(.6)))
    img.save(f'{OUT}/parchment.png')


def build_ribbon():
    w, h = 520, 76
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    top, bottom, notch, tail = 10, 66, 22, 40
    cloth = [(0, top), (w, top), (w - notch, (top + bottom) / 2), (w, bottom), (0, bottom), (notch, (top + bottom) / 2)]
    d.polygon(cloth, fill=(46, 88, 56, 255))
    a = np.asarray(img).astype(float)
    y = np.arange(h)[:, None]
    shade = 1.12 - (y - top) / (bottom - top) * .35
    a[..., :3] *= shade[..., None]
    img = Image.fromarray(np.clip(a, 0, 255).astype('uint8'))
    d = ImageDraw.Draw(img)
    # folds where the tails tuck behind the band
    for x0, x1 in [(tail, tail + 10), (w - tail - 10, w - tail)]:
        d.polygon([(x0, top), (x1, top), (x1, bottom), (x0, bottom)], fill=(30, 60, 38, 255))
    d.line([(0, top), (w, top)], fill=(20, 40, 26, 255), width=2)
    d.line([(0, bottom), (w, bottom)], fill=(20, 40, 26, 255), width=2)
    for yy in (top + 6, bottom - 6):   # gold stitching
        for x in range(tail + 16, w - tail - 16, 12):
            d.line([(x, yy), (x + 6, yy)], fill=(224, 190, 110, 255), width=2)
    img.save(f'{OUT}/ribbon.png')


def build_seal():
    s = 112
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    c = s / 2
    pts = []
    for i in range(48):
        a = i / 48 * math.tau
        r = 46 + math.sin(i * 1.7) * 2.5 + random.uniform(-2.5, 2.5)
        pts.append((c + math.cos(a) * r, c + math.sin(a) * r))
    d = ImageDraw.Draw(img)
    d.polygon(pts, fill=(146, 30, 30, 255))
    arr = np.asarray(img).astype(float)
    y, x = np.mgrid[0:s, 0:s]
    light = np.clip(1.25 - np.hypot(x - c * .8, y - c * .75) / (s * .55), .55, 1.25)
    arr[..., :3] *= light[..., None]
    img = Image.fromarray(np.clip(arr, 0, 255).astype('uint8'))
    d = ImageDraw.Draw(img)
    d.ellipse([c - 32, c - 32, c + 32, c + 32], outline=(96, 16, 18, 255), width=4)
    d.ellipse([c - 30, c - 30, c + 30, c + 30], outline=(214, 88, 76, 255), width=1)
    img.save(f'{OUT}/seal.png')


os.makedirs(OUT, exist_ok=True)
build_board(); build_board(dark=True); build_plank_tile(); build_parchment(); build_ribbon(); build_seal()
print('saved textures to', OUT)
