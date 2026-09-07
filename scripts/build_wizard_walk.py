"""Build the Code Wizard sheet with a synthesized walk cycle.

Usage: python scripts/build_wizard_walk.py   (needs Pillow, numpy, scipy)

The source art has one stride pose per direction repeated four times, so the
legs never move. This script keeps the painted upper body and staff, isolates
the legs by colour (jeans, shoes, their outlines), and produces four poses:
    0 stride, 1 legs together (raised), 2 mirrored stride, 3 legs together.
"""
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage

import os
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SRC = f'{ROOT}/src/assets/sprites/code-wizard-main-alpha-large.png'
OUT = f'{ROOT}/src/assets/sprites/code-wizard-main-spritesheet.png'
PREVIEW = f'{ROOT}/artifacts/wizard-walk-preview.png'   # artifacts/ is gitignored
os.makedirs(f'{ROOT}/artifacts', exist_ok=True)
C = 192; COLS = 4; ROWS = 8; FOOT_PAD = 1
PASS_LIFT = 3          # px the whole body rises on the legs-together frames
PASS_CLOSE = 0.6       # how far each leg slides toward the centre line on pass frames
PASS_STRETCH = 1.04    # legs straighten slightly on pass frames
HIP_KEEP = 0.2         # top fraction of the leg mask that stays fixed with the torso

im = np.array(Image.open(SRC).convert('RGBA'))
alpha = im[:, :, 3] > 10


def runs(mask):
    out, start = [], None
    for i, v in enumerate(mask):
        if v and start is None: start = i
        if not v and start is not None: out.append((start, i)); start = None
    if start is not None: out.append((start, len(mask)))
    return out


def extract_frames():
    """Return the first (canonical) frame of each row, cropped and anchored like the previous build."""
    frames = []
    for (y0, y1) in runs(alpha.any(axis=1)):
        band = alpha[y0:y1]
        merged = []
        for c in runs(band.any(axis=0)):
            if merged and c[0] - merged[-1][1] < 15: merged[-1] = (merged[-1][0], c[1])
            else: merged.append(c)
        x0, x1 = merged[0]
        yy = np.where(alpha[y0:y1, x0:x1].any(axis=1))[0]
        frame = im[y0 + yy[0]:y0 + yy[-1] + 1, x0:x1].copy()
        # the source paints a soft ground shadow under the feet; the game draws its own, so drop it
        foot = frame[int(frame.shape[0] * 0.86):]
        foot[foot[:, :, 3] < 200] = 0
        frames.append(frame)
    assert len(frames) == ROWS
    return frames


def leg_mask(frame):
    """Jeans + shoes + their dark outlines, excluding the brown staff shaft."""
    r, g, b, a = [frame[:, :, i].astype(int) for i in range(4)]
    vis = a > 10
    jeans = vis & (b >= r + 8) & (b >= g) & (b < 150)
    shoes = vis & (r > 120) & (r > g * 2) & (r > b * 2)
    white = vis & (r > 200) & (g > 200) & (b > 200)
    core = jeans | shoes | white
    h = frame.shape[0]
    core[: int(h * 0.55)] = False
    core = ndimage.binary_opening(core, iterations=1)
    dark = vis & (r + g + b < 180)                                   # ink outlines
    # Shadowed jeans on the far leg are nearly black, so grow the core into connected dark or
    # blue pixels within a short radius, then take the soft edges and outlines around that.
    near = ndimage.binary_dilation(core, iterations=8)
    dusk = vis & ((r + g + b < 200) | ((b >= r) & (b >= g) & (b < 170)))
    dusk[: int(h * 0.55)] = False
    grown = ndimage.binary_propagation(core, mask=(core | dusk) & near)
    grown = ndimage.binary_dilation(grown, iterations=3) & vis
    grown = ndimage.binary_fill_holes(grown)
    low_shoes = shoes.copy(); low_shoes[: int(h * 0.72)] = False       # hat and beard are red too
    shoe_rows = np.where(low_shoes.any(axis=1))[0]
    if len(shoe_rows):                                                # soles, outlines and contact pixels
        grown[shoe_rows.min():] |= vis[shoe_rows.min():]
    # The staff shaft is the only brown thing that runs from above the hips down into the leg band,
    # so keep just the brown components that reach up past the hip line.
    brown = vis & (r > 90) & (r < 210) & (r > g + 15) & (g > b + 10) & ~core
    shaft = brown | (dark & ndimage.binary_dilation(brown, iterations=2))   # shaft plus its ink outline/shading
    labels, count = ndimage.label(ndimage.binary_closing(shaft, iterations=2))
    wood = np.zeros_like(brown)
    hip = int(h * 0.55)
    for i in range(1, count + 1):
        comp = labels == i
        if comp[:hip].any() and comp[hip:].any():
            wood |= comp
    wood = ndimage.binary_dilation(wood, iterations=1) & ~ndimage.binary_erosion(core, iterations=2)
    return grown & ~wood


def compose(frame, legs, transform):
    """Replace the leg pixels with transform(legs_layer), then fill any enclosed gaps from nearby pixels."""
    body = frame.copy(); body[legs] = 0
    layer = np.zeros_like(frame); layer[legs] = frame[legs]
    out = Image.fromarray(body)
    out.alpha_composite(transform(Image.fromarray(layer)))
    arr = np.array(out)
    solid = arr[:, :, 3] > 10
    holes = ndimage.binary_fill_holes(solid) & ~solid
    holes[: int(frame.shape[0] * 0.5)] = False
    if holes.any():
        _, idx = ndimage.distance_transform_edt(~solid, return_indices=True)
        arr[holes] = arr[idx[0][holes], idx[1][holes]]
    # drop stray fragments (bits of outline that travelled with the legs) not attached to the body
    solid = arr[:, :, 3] > 10
    labels, count = ndimage.label(solid)
    sizes = ndimage.sum(solid, labels, range(1, count + 1))
    for i, size in enumerate(sizes, start=1):
        if size < 60: arr[labels == i] = 0
    return Image.fromarray(arr)


def legs_geometry(legs):
    ys, xs = np.where(legs)
    return xs.mean(), ys.min(), ys.max() + 1


def mirrored(layer_img, cx):
    w = layer_img.width
    flipped = layer_img.transpose(Image.FLIP_LEFT_RIGHT)
    # after a flip the centre x maps to (w-1-cx); shift back so legs pivot about their own centre
    shift = int(round(cx - (w - 1 - cx)))
    out = Image.new('RGBA', layer_img.size, (0, 0, 0, 0))
    out.paste(flipped, (shift, 0), flipped)
    return out


def together(layer_img, cx, top, bottom):
    """Slide each leg toward the centre line at full size; the back leg is drawn first."""
    arr = np.array(layer_img)
    mask = arr[:, :, 3] > 10
    labels, count = ndimage.label(mask)
    sizes = ndimage.sum(mask, labels, range(1, count + 1))
    order = np.argsort(sizes)[::-1]
    if count >= 2 and sizes[order[1]] > sizes[order[0]] * 0.25:
        parts = [labels == order[0] + 1, labels == order[1] + 1]
        rest = mask & ~parts[0] & ~parts[1]
        for i in range(2):                                            # stray bits go with the nearest leg
            pass
        # assign leftovers to the leg whose centroid is closer
        cents = [np.where(p)[1].mean() for p in parts]
        for y, x in zip(*np.where(rest)):
            parts[0 if abs(x - cents[0]) < abs(x - cents[1]) else 1][y, x] = True
    else:                                                              # legs merged: split at the thinnest column
        cols = mask.sum(axis=0).astype(float)
        xs = np.where(mask.any(axis=0))[0]
        lo, hi = xs.min() + (xs.max() - xs.min()) // 3, xs.max() - (xs.max() - xs.min()) // 3
        split = lo + int(np.argmin(cols[lo:hi + 1]))
        parts = [mask.copy(), mask.copy()]; parts[0][:, split:] = False; parts[1][:, :split] = False
    out = Image.new('RGBA', layer_img.size, (0, 0, 0, 0))
    new_h = int(round((bottom - top) * PASS_STRETCH))
    legs = []
    for part in parts:
        ys, xs = np.where(part)
        if len(xs) == 0: continue
        offset = xs.mean() - cx
        legs.append((abs(offset), part, -offset * PASS_CLOSE))
    legs.sort(key=lambda t: -t[0])                                    # farther leg = back leg, drawn first
    for _, part, dx in legs:
        layer = np.zeros_like(arr); layer[part] = arr[part]
        band = Image.fromarray(layer).crop((0, top, arr.shape[1], bottom)).resize((arr.shape[1], new_h), Image.LANCZOS)
        shifted = Image.new('RGBA', band.size, (0, 0, 0, 0))
        shifted.paste(band, (int(round(dx)), 0), band)
        out.alpha_composite(shifted, (0, bottom - new_h))
    return out


def anchor(frame):
    """Cell-relative offset that puts the lower-body centre on the cell centre and feet on the baseline."""
    a = frame[:, :, 3] > 10; h = frame.shape[0]
    lower = frame[int(h * 0.55):, :, 3].astype(float)
    cx = (lower.sum(axis=0) * np.arange(lower.shape[1])).sum() / lower.sum()
    return int(round(C / 2 - cx)), C - FOOT_PAD - h


def place(sheet, img, col, row, offset, lift=0):
    ox, oy = offset
    px, py = col * C + ox, row * C + oy - lift
    assert px >= col * C and px + img.width <= (col + 1) * C and py >= row * C, (row, col)
    sheet.paste(img, (px, py), img)


frames = extract_frames()
sheet = Image.new('RGBA', (C * COLS, C * ROWS), (0, 0, 0, 0))
masks = Image.new('RGBA', (C * COLS, C * ROWS), (0, 0, 0, 0))
for row, frame in enumerate(frames):
    base = Image.fromarray(frame)
    offset = anchor(frame)
    if row == 0:  # idle row: keep the four painted frames' likeness by reusing the canonical pose
        for col in range(COLS): place(sheet, base, col, row, offset)
        continue
    legs = leg_mask(frame)
    cx, top, bottom = legs_geometry(legs)
    legs[: top + int((bottom - top) * HIP_KEEP)] = False   # hips do not move; avoids a waist seam
    top = top + int((bottom - top) * HIP_KEEP)
    stride_a = base
    stride_b = compose(frame, legs, lambda L: mirrored(L, cx))
    pass_pose = compose(frame, legs, lambda L: together(L, cx, top, bottom))
    for col, (img, lift) in enumerate([(stride_a, 0), (pass_pose, PASS_LIFT), (stride_b, 0), (pass_pose, PASS_LIFT)]):
        place(sheet, img, col, row, offset, lift)
    # debug: mask overlay for the canonical frame
    dbg = frame.copy(); dbg[legs, :3] = (255, 0, 255)
    place(masks, Image.fromarray(dbg), 0, row, offset)

sheet.save(OUT)
# preview: walking rows on a green ground, plus the mask column
bg = Image.new('RGBA', (C * COLS + C, C * ROWS), (90, 110, 90, 255))
bg.alpha_composite(sheet); bg.alpha_composite(masks, (C * COLS, 0))
d = ImageDraw.Draw(bg)
for c in range(COLS + 2): d.line([(c * C, 0), (c * C, C * ROWS)], fill=(255, 0, 255, 90))
bg.resize((bg.width // 2, bg.height // 2), Image.LANCZOS).save(PREVIEW)
print('saved', OUT)
