"""Generate the Wonky stag boss sprite sheet.

128px cells, 4 columns x 4 rows, profile view:
    row 0: facing right, walk cycle, 4 frames
    row 1: facing right, windup (head lowered, hoof raised), charge A, charge B, rest (panting)
    rows 2-3: the same, facing left
Drawn at 4x and downsampled. A lean summer whitetail buck: tawny coat, white throat patch, belly,
inner legs and tail flag, a dark nose behind a pale band, big ears, and a lopsided rack still in
velvet: three points on his left antler and five on his right (counting every tip, beam included).
Because the sides differ, left-facing frames are drawn with the right antler nearest and then
mirrored, rather than flipped in game.

Usage: python scripts/build_stag.py   (needs Pillow)
"""
import math
import os
from PIL import Image, ImageDraw, ImageOps

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = f'{ROOT}/src/assets/sprites/stag-boss-spritesheet.png'
CELL = 128; SS = 4; COLS = 4
BIG = CELL * 2           # drawing canvas; the figure is fitted down into the cell afterwards
FIT = 0.66
SHIFT = 14               # the head and rack reach further forward than the tail reaches back
INK = (46, 32, 24, 255)
COAT = (186, 134, 88); SHADE = (150, 104, 66); LIGHT = (206, 160, 112); FACE = (128, 88, 56)
WHITE = (242, 238, 228); INNER_EAR = (226, 196, 176); NOSE = (28, 22, 20); HOOF = (44, 34, 28)
VELVET = (172, 134, 94); VELVET_LIGHT = (210, 178, 134); VELVET_DARK = (128, 96, 66)
LEFT_POINTS, RIGHT_POINTS = 3, 5


def S(pts): return [(x * SS, y * SS) for x, y in pts]


def box(b): return [b[0] * SS, b[1] * SS, b[2] * SS, b[3] * SS]


def grow(b, w): return (b[0] - w, b[1] - w, b[2] + w, b[3] + w)


def blob(draw, ellipses, polygons, fill, width=2.0):
    """Shapes that share one outline: every ink shape first, then every fill, so no seams show."""
    for b in ellipses: draw.ellipse(box(grow(b, width)), fill=INK)
    for p in polygons: draw.polygon(S(p), fill=INK, outline=INK, width=int(width * 2 * SS))
    for b in ellipses: draw.ellipse(box(b), fill=fill)
    for p in polygons: draw.polygon(S(p), fill=fill)


def thick_line(draw, pts, colour, width, outline=2.0):
    draw.line(S(pts), fill=INK, width=int((width + outline * 2) * SS), joint='curve')
    draw.line(S(pts), fill=colour, width=int(width * SS), joint='curve')


def leg(draw, pts, width, colour, hind=False, near=False):
    """A slender leg through `pts` (hip ... hoof), with a white sock above a small dark hoof."""
    thick_line(draw, pts, colour, width)
    hoof = pts[-1]; above = pts[-2]
    sock = (hoof[0] + (above[0] - hoof[0]) * .28, hoof[1] + (above[1] - hoof[1]) * .28)
    draw.line(S([sock, (hoof[0], hoof[1] - 2)]), fill=WHITE, width=int(width * .8 * SS))
    if hind and near:
        # the white inside of the hind leg, as on a real whitetail
        hip, hock = pts[0], pts[-2]
        draw.line(S([(hip[0] + 1.5, hip[1] + 5), (hock[0] + 1, hock[1] - 1)]), fill=WHITE, width=int(1.6 * SS))
    r = width * .7
    draw.polygon(S([(hoof[0] - r, hoof[1] - r), (hoof[0] + r * 1.3, hoof[1] - r), (hoof[0] + r * 1.5, hoof[1] + r * .7), (hoof[0] - r, hoof[1] + r * .7)]), fill=HOOF)


def point_along(pts, t):
    """The point a fraction t of the way along a polyline."""
    lengths = [math.dist(a, b) for a, b in zip(pts, pts[1:])]
    goal = t * sum(lengths)
    for (a, b), length in zip(zip(pts, pts[1:]), lengths):
        if goal <= length:
            f = goal / length if length else 0
            return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
        goal -= length
    return pts[-1]


def antler_shape(points, lean):
    """One whitetail antler: a main beam that climbs, splays outward and curls back in at the tip,
    with points - 1 tines standing up off it, so it shows `points` tips in all (beam tip included).
    `lean` is -1 for his left antler (splaying back over the neck), +1 for his right (splaying forward)."""
    height = 8 + points * 9
    s = lean
    # cupped like a real whitetail rack: out from the head, then up and curling back in
    beam = [(2 * s, 0), (13 * s, -height * .2), (21 * s, -height * .45), (22 * s, -height * .72), (15 * s, -height)]
    tines = []
    count = points - 1
    for i in range(count):
        k = i / max(1, count - 1)
        root = point_along(beam, (0.45 + 0.3 * k) if count < 3 else (0.3 + 0.55 * k))
        size = 11 - 2.5 * k
        dx, dy = s * .8, -1.0                         # tines rise up and outward, clear of the curling beam
        norm = math.hypot(dx, dy)
        tines.append([root, (root[0] + dx / norm * size, root[1] + dy / norm * size)])
    return [beam] + tines


def antlers(draw, base, facing_right, only):
    """Wonky's lopsided rack in velvet: three points on his left antler, five on his right. The
    antler on the viewer's side is drawn brighter. `only` is 'far' or 'near', so the head can sit
    between them."""
    bx, by = base
    near_name = 'left' if facing_right else 'right'   # facing right we see his left flank
    name = near_name if only == 'near' else ('right' if near_name == 'left' else 'left')
    lines = antler_shape(LEFT_POINTS, -1) if name == 'left' else antler_shape(RIGHT_POINTS, 1)
    light, mid, dark = (VELVET_LIGHT, VELVET, VELVET_DARK) if only == 'near' else (VELVET, VELVET_DARK, (104, 78, 54))
    pts = [[(bx + x, by + y) for x, y in line] for line in lines]
    for p in pts: draw.line(S(p), fill=INK, width=int(7.4 * SS), joint='curve')
    for p in pts:   # velvet tips are soft and rounded
        x, y = p[-1]
        draw.ellipse(box((x - 3.6, y - 3.6, x + 3.6, y + 3.6)), fill=INK)
    for p in pts: draw.line(S(p), fill=mid, width=int(4.2 * SS), joint='curve')
    for p in pts:
        x, y = p[-1]
        draw.ellipse(box((x - 2.2, y - 2.2, x + 2.2, y + 2.2)), fill=mid)
    for p in pts: draw.line(S([(x + .8, y - .5) for x, y in p]), fill=light, width=int(1.7 * SS), joint='curve')
    for p in pts: draw.line(S([(x - 1.2, y + .6) for x, y in p]), fill=dark, width=int(1.0 * SS), joint='curve')


def draw_stag(pose, phase, facing_right=True):
    """pose: 'walk' | 'windup' | 'charge' | 'rest'. phase in [0,1) for walk/charge cycles.
    Always drawn facing right; a left-facing frame puts his right antler nearest, then mirrors."""
    img = Image.new('RGBA', (BIG * SS, BIG * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, ground = 118, 190
    bl, bh = 35, 15                    # body half length / half height
    leg_h = 38
    stretch = 1.0
    lean = 0
    if pose == 'charge': stretch, lean = 1.18, 10
    if pose == 'windup': lean = -6
    body_y = ground - leg_h - bh + 4
    if pose == 'walk': body_y -= abs(math.sin(phase * math.pi * 2)) * 2
    if pose == 'rest': body_y += 2 + math.sin(phase * math.pi * 2) * 1.5
    bx = cx + lean
    L = bl * stretch
    swing = math.sin(phase * math.pi * 2)

    def front_leg(x, sw, lift, col, w, near):
        hip = (bx + x, body_y + bh * .5)
        knee = (hip[0] + sw * .35 + (7 if lift else 0), hip[1] + leg_h * .48 - lift * .6)
        hoof = (hip[0] + sw + (11 if lift else 0), ground - lift)
        leg(d, [hip, knee, hoof], w, col, near=near)

    def hind_leg(x, sw, col, w, near):
        hip = (bx + x, body_y + bh * .2)
        stifle = (hip[0] + 4 + sw * .2, hip[1] + leg_h * .32)
        hock = (hip[0] - 5 + sw * .55, hip[1] + leg_h * .62)
        hoof = (hip[0] - 1 + sw, ground)
        leg(d, [hip, stifle, hock, hoof], w, col, hind=True, near=near)

    # legs: far pair (shaded) first, then the near pair over the body's edge
    if pose == 'walk':
        far = [('hind', -L * .62, swing * 9), ('front', L * .6, -swing * 9)]
        near = [('hind', -L * .5, -swing * 9), ('front', L * .74, swing * 9)]
    elif pose == 'charge':
        g = 1 if phase < .5 else -1
        far = [('hind', -L * .66, -24 * g), ('front', L * .58, 22 * g)]
        near = [('hind', -L * .52, -16 * g), ('front', L * .76, 28 * g)]
    else:
        far = [('hind', -L * .62, 0), ('front', L * .6, 0)]
        near = [('hind', -L * .5, 0), ('front', L * .74, 0)]
    lift = 16 if pose == 'windup' else 0
    for kind, x, sw in far:
        if kind == 'hind': hind_leg(x, sw, SHADE, 3.6, False)
        else: front_leg(x, sw, 0, SHADE, 3.4, False)
    # tail flag: brown on top, white fringe beneath
    tx, ty = bx - L - 2, body_y - bh * .55
    blob(d, [], [[(tx + 4, ty - 3), (tx - 9, ty - 6), (tx - 11, ty + 1), (tx + 3, ty + 6)]], WHITE, 1.6)
    d.polygon(S([(tx + 4, ty - 3), (tx - 9, ty - 6), (tx - 8, ty - 1), (tx + 3, ty + 1)]), fill=FACE)
    # body: rump and barrel, and a deeper chest up front, sharing one outline
    blob(d, [(bx - L, body_y - bh, bx + L * .55, body_y + bh * .95),
             (bx + L * .1, body_y - bh * 1.05, bx + L * 1.02, body_y + bh * 1.3)], [], COAT)
    d.ellipse(box((bx - L * .96, body_y - bh * .98, bx + L * .9, body_y - bh * .2)), fill=SHADE)
    d.ellipse(box((bx - L * .9, body_y - bh * .8, bx + L * .96, body_y + bh * .5)), fill=COAT)
    d.ellipse(box((bx - L * .6, body_y + bh * .38, bx + L * .62, body_y + bh * .98)), fill=WHITE)   # white belly
    d.ellipse(box((bx - L * .98, body_y - bh * .45, bx - L * .72, body_y + bh * .55)), fill=WHITE)  # white rump patch
    for kind, x, sw in near:
        if kind == 'hind': hind_leg(x, sw, COAT, 4.2, True)
        else: front_leg(x, sw, lift if kind == 'front' else 0, COAT, 4.0, True)
    # neck and head
    nx, ny = bx + L * .78, body_y - bh * .35
    head_drop = 22 if pose == 'windup' else (10 if pose == 'charge' else 0)
    hx, hy = nx + 15 + (6 if pose == 'charge' else 0), ny - 25 + head_drop
    antlers(d, (hx - 1, hy - 7), facing_right, 'far')
    far_ear = [(hx - 3, hy - 6), (hx - 9, hy - 16), (hx - 4, hy - 19), (hx + 1, hy - 7)]
    blob(d, [], [far_ear], SHADE, 1.5)
    neck = [(nx - 13, ny - 6), (hx - 10, hy - 4), (hx - 1, hy + 8), (nx + 11, ny + 12)]
    skull = (hx - 10, hy - 9, hx + 8, hy + 8)
    muzzle = [(hx + 3, hy - 8), (hx + 22, hy - 2), (hx + 24, hy + 3), (hx + 20, hy + 8), (hx + 3, hy + 8)]
    blob(d, [skull], [neck, muzzle], COAT)
    d.polygon(S([(nx - 10, ny - 3), (hx - 9, hy - 2), (hx - 6, hy + 4), (nx - 3, ny + 2)]), fill=SHADE)  # shaded mane line
    d.polygon(S([(hx - 7, hy - 8), (hx + 21, hy - 2), (hx + 20, hy + 0), (hx - 5, hy - 4)]), fill=FACE)   # darker brow and nose bridge
    d.ellipse(box((hx - 6, hy + 5, hx + 6, hy + 13)), fill=WHITE)                                          # white throat patch
    d.ellipse(box((hx + 12, hy + 3.5, hx + 21, hy + 8.5)), fill=WHITE)                                     # white chin
    d.line(S([(hx + 16, hy - 2), (hx + 16, hy + 6)]), fill=WHITE, width=int(2.4 * SS))                     # pale band behind the nose
    d.ellipse(box((hx + 19, hy - 2, hx + 25, hy + 4.5)), fill=NOSE)                                        # dark nose
    eye = (hx + 1.5, hy - 2.5)
    d.ellipse(box((eye[0] - 3.6, eye[1] - 2.8, eye[0] + 3.6, eye[1] + 2.8)), fill=WHITE)                  # pale eye ring
    d.ellipse(box((eye[0] - 2.4, eye[1] - 1.9, eye[0] + 2.4, eye[1] + 1.9)), fill=NOSE)
    d.ellipse(box((eye[0] - .2, eye[1] - 1.4, eye[0] + 1, eye[1] - .3)), fill=(255, 252, 240, 255))
    antlers(d, (hx - 1, hy - 7), facing_right, 'near')
    near_ear = [(hx - 4, hy - 6), (hx - 12, hy - 15), (hx - 19, hy - 15), (hx - 17, hy - 8), (hx - 8, hy + 1)]
    blob(d, [], [near_ear], COAT, 1.6)
    d.polygon(S([(hx - 7, hy - 5), (hx - 12, hy - 12.5), (hx - 16.5, hy - 12.5), (hx - 15, hy - 8.5), (hx - 8.5, hy - 1.5)]), fill=INNER_EAR)
    if pose == 'windup':
        # pawed dust
        for i in range(3):
            x = bx + L * .74 + 14 + i * 7; y = ground - 2 - i * 3
            d.ellipse(S([(x - 4, y - 2), (x + 4, y + 2)]), fill=(200, 184, 150, 160))
    if pose == 'charge':
        for i in range(4):
            x = bx - L - 8 - i * 9; y = ground - 6 + (i % 2) * 4
            d.ellipse(S([(x - 5, y - 2.5), (x + 5, y + 2.5)]), fill=(200, 184, 150, 150 - i * 25))
    # fit about the hooves so every pose shares a baseline and nothing clips
    gx, gy = (cx + SHIFT) * SS, ground * SS
    tx, ty = (BIG - CELL) / 2 * SS + CELL * SS / 2, (BIG - CELL) / 2 * SS + CELL * SS - 6 * SS
    out = img.transform(img.size, Image.AFFINE, (1 / FIT, 0, gx - tx / FIT, 0, 1 / FIT, gy - ty / FIT), Image.BICUBIC)
    off = (BIG - CELL) // 2 * SS
    cell = out.crop((off, off, off + CELL * SS, off + CELL * SS)).resize((CELL, CELL), Image.LANCZOS)
    return cell if facing_right else ImageOps.mirror(cell)


sheet = Image.new('RGBA', (CELL * COLS, CELL * 4), (0, 0, 0, 0))
for row, facing_right in ((0, True), (2, False)):
    for i in range(4): sheet.paste(draw_stag('walk', i / 4, facing_right), (i * CELL, row * CELL))
    for i, (pose, phase) in enumerate([('windup', 0), ('charge', 0), ('charge', .5), ('rest', .25)]):
        sheet.paste(draw_stag(pose, phase, facing_right), (i * CELL, (row + 1) * CELL))
# Every frame must keep a clear margin: nothing may touch a cell's edge.
alpha = sheet.getchannel('A')
for r in range(4):
    for c in range(COLS):
        cell = alpha.crop((c * CELL, r * CELL, (c + 1) * CELL, (r + 1) * CELL))
        edges = [cell.crop((0, 0, CELL, 1)), cell.crop((0, CELL - 1, CELL, CELL)), cell.crop((0, 0, 1, CELL)), cell.crop((CELL - 1, 0, CELL, CELL))]
        assert all(e.getextrema()[1] < 8 for e in edges), f'frame {r},{c} touches its cell edge'
sheet.save(OUT)
print('saved', OUT)
