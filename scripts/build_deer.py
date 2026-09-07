"""Generate doe, fawn and buck enemy sprite sheets.

Same layout as the squirrel sheet: 64px cells, 4 walk frames per row, rows in the
order down, down-right, right, up-right, up, up-left, left, down-left.
Drawn at 4x and downsampled, storybook-style flat colour with a dark outline.

Usage: python scripts/build_deer.py   (needs Pillow)
"""
import math
import os
from PIL import Image, ImageDraw

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT_DIR = f'{ROOT}/src/assets/sprites'
CELL = 64; SS = 4; FRAMES = 4
ROWS = [(0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1), (-1, 0), (-1, 1)]
INK = (52, 34, 26, 255)
GROUND = 56 + CELL      # drawn on a double-height canvas so tall antlers are not clipped

DOE = dict(coat=(196, 142, 88), shade=(160, 110, 66), belly=(232, 208, 172), spots=None, size=1.0, name='deer-doe')
FAWN = dict(coat=(205, 140, 82), shade=(168, 108, 60), belly=(238, 216, 182), spots=(250, 244, 226), size=0.7, name='deer-fawn')
BUCK = dict(coat=(150, 104, 62), shade=(112, 76, 44), belly=(214, 190, 156), spots=None, size=1.12, name='deer-buck', antlers=(214, 196, 160), fit=0.72)


def outlined(draw, shape, box, fill, width=1.6):
    """Draw a shape with an ink outline by drawing it larger in ink first."""
    w = width * SS
    big = [box[0] - w, box[1] - w, box[2] + w, box[3] + w]
    getattr(draw, shape)(big, fill=INK)
    getattr(draw, shape)(box, fill=fill)


def leg(draw, x, y_top, y_bottom, swing, width, colour, forward):
    """A slim leg from the body down to a hoof, angled by swing (px at the hoof)."""
    w = width * SS
    x0, x1 = x * SS, (x + swing) * SS
    y0, y1 = y_top * SS, y_bottom * SS
    draw.line([(x0, y0), (x1, y1)], fill=INK, width=int(w + 2.4 * SS))
    draw.line([(x0, y0), (x1, y1)], fill=colour, width=int(w))
    hoof = 1.8 * SS
    draw.ellipse([x1 - w / 2 - 0.5 * SS, y1 - hoof, x1 + w / 2 + 0.5 * SS, y1 + hoof], fill=INK)


def spots(draw, cx, cy, rx, ry, colour, seed):
    for i in range(9):
        a = seed + i * 2.399
        px = cx + math.cos(a) * rx * (0.35 + (i % 3) * 0.2)
        py = cy + math.sin(a) * ry * (0.3 + (i % 2) * 0.35) - ry * 0.15
        r = 1.1 * SS
        draw.ellipse([px * SS - r, py * SS - r, px * SS + r, py * SS + r], fill=colour)


def antlers_side(draw, spec, hx, hy):
    """Branching antlers rising from the top of the head, profile view."""
    s = spec['size']; col = spec['antlers']
    for base_x in (hx - 2.5 * s, hx + 1.5 * s):
        beam = [(base_x, hy - 4 * s), (base_x - 4 * s, hy - 15 * s), (base_x - 2.5 * s, hy - 25 * s)]
        tines = [[(base_x - 3.4 * s, hy - 13 * s), (base_x - 9 * s, hy - 19 * s)], [(base_x - 3.2 * s, hy - 20 * s), (base_x + 3 * s, hy - 25 * s)]]
        for pts in [beam] + tines:
            P = [(x * SS, y * SS) for x, y in pts]
            draw.line(P, fill=INK, width=int(3.6 * s * SS), joint='curve')
        for pts in [beam] + tines:
            P = [(x * SS, y * SS) for x, y in pts]
            draw.line(P, fill=col, width=int(1.8 * s * SS), joint='curve')


def antlers_front(draw, spec, hx, hy):
    s = spec['size']; col = spec['antlers']
    for d in (-1, 1):
        beam = [(hx + d * 3 * s, hy - 4 * s), (hx + d * 9 * s, hy - 15 * s), (hx + d * 7 * s, hy - 25 * s)]
        tines = [[(hx + d * 8 * s, hy - 13 * s), (hx + d * 15 * s, hy - 18 * s)], [(hx + d * 8.4 * s, hy - 20 * s), (hx + d * 2.5 * s, hy - 25.5 * s)]]
        for pts in [beam] + tines:
            P = [(x * SS, y * SS) for x, y in pts]
            draw.line(P, fill=INK, width=int(3.6 * s * SS), joint='curve')
        for pts in [beam] + tines:
            P = [(x * SS, y * SS) for x, y in pts]
            draw.line(P, fill=col, width=int(1.8 * s * SS), joint='curve')


def draw_side(draw, spec, phase, face_x, depth):
    """Profile deer facing +x (mirrored later for left). depth in [-1,1] tilts toward/away from camera."""
    s = spec['size']; coat, shade, belly = spec['coat'], spec['shade'], spec['belly']
    cx, ground = 32, GROUND
    bl = 24 * s          # body half-length
    bh = 8.5 * s         # body half-height
    leg_h = 15 * s
    body_y = ground - leg_h - bh + 1
    swing = math.sin(phase) * 5 * s
    swing2 = math.sin(phase + math.pi) * 5 * s
    bob = abs(math.sin(phase)) * 1.2
    body_y -= bob
    # far legs first
    leg(draw, cx - bl * 0.62, body_y + bh * 0.4, ground - 1, swing2, 2.6 * s, shade, False)
    leg(draw, cx + bl * 0.58, body_y + bh * 0.4, ground - 1, swing, 2.6 * s, shade, True)
    # tail
    outlined(draw, 'ellipse', [(cx - bl - 3 * s) * SS, (body_y - 2 * s) * SS, (cx - bl + 3 * s) * SS, (body_y + 4 * s) * SS], belly)
    # body
    outlined(draw, 'ellipse', [(cx - bl) * SS, (body_y - bh) * SS, (cx + bl) * SS, (body_y + bh) * SS], coat)
    draw.ellipse([(cx - bl * 0.7) * SS, (body_y + bh * 0.05) * SS, (cx + bl * 0.75) * SS, (body_y + bh * 0.95) * SS], fill=belly)
    draw.ellipse([(cx - bl * 0.95) * SS, (body_y - bh * 0.95) * SS, (cx + bl * 0.4) * SS, (body_y + bh * 0.1) * SS], fill=shade)
    draw.ellipse([(cx - bl * 0.7) * SS, (body_y - bh * 0.8) * SS, (cx + bl * 0.5) * SS, (body_y + bh * 0.25) * SS], fill=coat)
    if spec['spots']: spots(draw, cx - bl * 0.15, body_y, bl * 0.8, bh * 0.9, spec['spots'], 0.4)
    # near legs
    leg(draw, cx - bl * 0.45, body_y + bh * 0.5, ground, swing, 3 * s, coat, False)
    leg(draw, cx + bl * 0.72, body_y + bh * 0.5, ground, swing2, 3 * s, coat, True)
    # neck and head
    nx, ny = cx + bl * 0.85, body_y - bh * 0.3
    hx, hy = nx + 6 * s, ny - 13 * s
    draw.line([(nx * SS, ny * SS), (hx * SS, hy * SS)], fill=INK, width=int(8.6 * s * SS))
    draw.line([(nx * SS, ny * SS), (hx * SS, hy * SS)], fill=coat, width=int(6 * s * SS))
    outlined(draw, 'ellipse', [(hx - 5 * s) * SS, (hy - 4.5 * s) * SS, (hx + 8 * s) * SS, (hy + 4 * s) * SS], coat)
    # ears
    for ex in (hx - 4 * s, hx + 0.5 * s):
        outlined(draw, 'polygon', None, None) if False else None
        pts = [((ex) * SS, (hy - 3 * s) * SS), ((ex - 2.5 * s) * SS, (hy - 11 * s) * SS), ((ex + 3 * s) * SS, (hy - 4 * s) * SS)]
        draw.polygon(pts, fill=INK, outline=INK, width=int(1.6 * SS))
        draw.polygon(pts, fill=coat)
        inner = [((ex + 0.3 * s) * SS, (hy - 4 * s) * SS), ((ex - 1.2 * s) * SS, (hy - 8.5 * s) * SS), ((ex + 1.8 * s) * SS, (hy - 4.6 * s) * SS)]
        draw.polygon(inner, fill=belly)
    if spec.get('antlers'): antlers_side(draw, spec, hx, hy)
    # muzzle, nose, eye
    outlined(draw, 'ellipse', [(hx + 4 * s) * SS, (hy - 1.5 * s) * SS, (hx + 10 * s) * SS, (hy + 3.5 * s) * SS], belly, 1.2)
    draw.ellipse([(hx + 8.2 * s) * SS, (hy - 0.5 * s) * SS, (hx + 10.6 * s) * SS, (hy + 1.7 * s) * SS], fill=INK)
    draw.ellipse([(hx + 1 * s) * SS, (hy - 2.2 * s) * SS, (hx + 3.6 * s) * SS, (hy + 0.4 * s) * SS], fill=INK)
    draw.ellipse([(hx + 1.5 * s) * SS, (hy - 1.8 * s) * SS, (hx + 2.5 * s) * SS, (hy - 0.8 * s) * SS], fill=(255, 255, 255, 255))


def draw_front(draw, spec, phase, facing_camera):
    """Deer seen head-on (facing_camera) or from behind."""
    s = spec['size']; coat, shade, belly = spec['coat'], spec['shade'], spec['belly']
    cx, ground = 32, GROUND
    bw = 10 * s; bh = 12 * s; leg_h = 15 * s
    body_y = ground - leg_h - bh + 2 - abs(math.sin(phase)) * 1.2
    lift = math.sin(phase) * 2.5 * s
    # back legs (wider stance) then front legs
    for i, (lx, sw) in enumerate([(-bw * 0.75, -lift), (bw * 0.75, lift)]):
        leg(draw, cx + lx, body_y + bh * 0.5, ground - 2 + (abs(sw) if False else 0), 0, 2.6 * s, shade, False)
    outlined(draw, 'ellipse', [(cx - bw) * SS, (body_y - bh) * SS, (cx + bw) * SS, (body_y + bh) * SS], coat)
    if facing_camera:
        draw.ellipse([(cx - bw * 0.6) * SS, (body_y) * SS, (cx + bw * 0.6) * SS, (body_y + bh * 0.9) * SS], fill=belly)
    else:
        draw.ellipse([(cx - bw * 0.8) * SS, (body_y - bh * 0.9) * SS, (cx + bw * 0.8) * SS, (body_y + bh * 0.2) * SS], fill=shade)
        outlined(draw, 'ellipse', [(cx - 3 * s) * SS, (body_y + bh * 0.2) * SS, (cx + 3 * s) * SS, (body_y + bh * 0.9) * SS], belly, 1.2)
    if spec['spots']: spots(draw, cx, body_y - bh * 0.2, bw * 0.8, bh * 0.6, spec['spots'], 1.1)
    for i, lx in enumerate((-bw * 0.45, bw * 0.45)):
        step = lift if i == 0 else -lift
        leg(draw, cx + lx, body_y + bh * 0.55, ground - max(0, step), 0, 3 * s, coat, True)
    # head
    hx, hy = cx, body_y - bh - 4 * s
    outlined(draw, 'ellipse', [(hx - 5.5 * s) * SS, (hy - 6 * s) * SS, (hx + 5.5 * s) * SS, (hy + 6 * s) * SS], coat if facing_camera else shade)
    for ex, d in ((hx - 6 * s, -1), (hx + 6 * s, 1)):
        pts = [((ex - d * 0) * SS, (hy - 2 * s) * SS), ((ex + d * 5 * s) * SS, (hy - 10 * s) * SS), ((ex + d * 1 * s) * SS, (hy + 1 * s) * SS)]
        draw.polygon(pts, fill=INK, outline=INK, width=int(1.6 * SS))
        draw.polygon(pts, fill=coat)
        draw.polygon([((ex + d * 0.8 * s) * SS, (hy - 2 * s) * SS), ((ex + d * 3.6 * s) * SS, (hy - 7.5 * s) * SS), ((ex + d * 1 * s) * SS, (hy - 0.2 * s) * SS)], fill=belly)
    if spec.get('antlers'): antlers_front(draw, spec, hx, hy)
    if facing_camera:
        outlined(draw, 'ellipse', [(hx - 3 * s) * SS, (hy + 1.5 * s) * SS, (hx + 3 * s) * SS, (hy + 6.5 * s) * SS], belly, 1.2)
        draw.ellipse([(hx - 1.6 * s) * SS, (hy + 3.6 * s) * SS, (hx + 1.6 * s) * SS, (hy + 6 * s) * SS], fill=INK)
        for ex in (hx - 3 * s, hx + 3 * s):
            draw.ellipse([(ex - 1.3 * s) * SS, (hy - 1.6 * s) * SS, (ex + 1.3 * s) * SS, (hy + 1 * s) * SS], fill=INK)
            draw.ellipse([(ex - 0.5 * s) * SS, (hy - 1.2 * s) * SS, (ex + 0.4 * s) * SS, (hy - 0.3 * s) * SS], fill=(255, 255, 255, 255))


def render(spec, facing, frame):
    img = Image.new('RGBA', (CELL * SS, 2 * CELL * SS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    phase = 2 * math.pi * frame / FRAMES
    fx, fy = facing
    if fx == 0:
        draw_front(draw, spec, phase, fy > 0)
    else:
        draw_side(draw, spec, phase, fx, fy)
        if fy != 0:
            # three-quarter views: squash the profile a little toward the camera axis
            img = img.transform(img.size, Image.AFFINE, (1 / 0.86, 0, -img.width * (1 - 0.86) / 2 / 0.86, 0, 1, 0), Image.BICUBIC)
        if fx < 0:
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
    fit = spec.get('fit', 1.0)
    if fit != 1.0:
        # antlered heads need headroom: shrink about the hooves; the game scales the sprite back up
        gx, gy = 32 * SS, GROUND * SS
        img = img.transform(img.size, Image.AFFINE, (1 / fit, 0, gx - gx / fit, 0, 1 / fit, gy - gy / fit), Image.BICUBIC)
    return img.crop((0, CELL * SS, CELL * SS, 2 * CELL * SS)).resize((CELL, CELL), Image.LANCZOS)


for spec in (DOE, FAWN, BUCK):
    sheet = Image.new('RGBA', (CELL * FRAMES, CELL * len(ROWS)), (0, 0, 0, 0))
    for r, facing in enumerate(ROWS):
        for f in range(FRAMES):
            sheet.paste(render(spec, facing, f), (f * CELL, r * CELL))
    path = f"{OUT_DIR}/{spec['name']}-spritesheet.png"
    sheet.save(path); print('saved', path)
