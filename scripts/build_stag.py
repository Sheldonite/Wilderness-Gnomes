"""Generate the Hollowcrown stag boss sprite sheet.

128px cells, 4 columns x 2 rows, profile view facing right (the game flips for left):
    row 0: walk cycle, 4 frames
    row 1: windup (head lowered, hoof raised), charge A, charge B, rest (panting)
Drawn at 4x and downsampled. A great dark stag with four-point antlers wreathed in moss,
ember eyes, a pale chest blaze, and a faint green glow around the crown.

Usage: python scripts/build_stag.py   (needs Pillow)
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = f'{ROOT}/src/assets/sprites/stag-boss-spritesheet.png'
CELL = 128; SS = 4; COLS = 4
BIG = CELL * 2           # drawing canvas; the figure is fitted down into the cell afterwards
FIT = 0.66
INK = (34, 24, 20, 255)
COAT = (96, 66, 44); SHADE = (66, 44, 30); LIGHT = (128, 92, 62); CHEST = (214, 196, 166)
ANTLER = (222, 206, 172); ANTLER_DARK = (160, 140, 108); MOSS = (118, 160, 76); GLOW = (150, 220, 120)
EMBER = (255, 176, 48); HOOF = (40, 30, 26)


def S(pts): return [(x * SS, y * SS) for x, y in pts]


def outlined_ellipse(draw, box, fill, width=2.2):
    w = width * SS
    draw.ellipse([box[0] * SS - w, box[1] * SS - w, box[2] * SS + w, box[3] * SS + w], fill=INK)
    draw.ellipse([box[0] * SS, box[1] * SS, box[2] * SS, box[3] * SS], fill=fill)


def outlined_polygon(draw, pts, fill, width=2.2):
    draw.polygon(S(pts), fill=INK, outline=INK, width=int(width * 2 * SS))
    draw.polygon(S(pts), fill=fill)


def thick_line(draw, pts, colour, width, outline=2.2):
    draw.line(S(pts), fill=INK, width=int((width + outline * 2) * SS), joint='curve')
    draw.line(S(pts), fill=colour, width=int(width * SS), joint='curve')


def leg(draw, hip, knee, hoof, width, colour, raised=False):
    thick_line(draw, [hip, knee, hoof], colour, width)
    r = width * .75
    draw.ellipse([(hoof[0] - r) * SS, (hoof[1] - r * .6) * SS, (hoof[0] + r) * SS, (hoof[1] + r * .9) * SS], fill=HOOF)


def antlers(draw, glow, base, scale=1.0):
    """Four-point antlers: a main beam curving up and back with four tines each, moss at the base."""
    bx, by = base
    for side, dx in ((-1, -6), (1, 6)):
        beam = [(bx + dx, by), (bx + dx - 6 * side * -1 * 0.2, by - 12), (bx + dx - side * 4, by - 26), (bx + dx - side * 14, by - 40), (bx + dx - side * 22, by - 50)]
        tines = [
            [(bx + dx - side * 1, by - 14), (bx + dx + side * 9, by - 24)],
            [(bx + dx - side * 5, by - 27), (bx + dx + side * 6, by - 38)],
            [(bx + dx - side * 12, by - 38), (bx + dx - side * 2, by - 50)],
            [(bx + dx - side * 19, by - 47), (bx + dx - side * 14, by - 60)],
        ]
        pts = [beam] + tines
        for p in pts: glow.line(S([(x, y) for x, y in p]), fill=GLOW + (110,), width=int(9 * SS), joint='curve')
        for p in pts: draw.line(S(p), fill=INK, width=int(6.4 * SS), joint='curve')
        for p in pts: draw.line(S(p), fill=ANTLER_DARK, width=int(3.6 * SS), joint='curve')
        for p in pts: draw.line(S([(x - side * .6, y - .6) for x, y in p]), fill=ANTLER, width=int(1.8 * SS), joint='curve')
        for x, y in [(bx + dx, by - 2), (bx + dx - side * 2, by - 10), (bx + dx - side * 5, by - 24)]:
            draw.ellipse([(x - 3.2) * SS, (y - 2.4) * SS, (x + 3.2) * SS, (y + 2.4) * SS], fill=MOSS)


def draw_stag(pose, phase):
    """pose: 'walk' | 'windup' | 'charge' | 'rest'. phase in [0,1) for walk/charge cycles."""
    img = Image.new('RGBA', (BIG * SS, BIG * SS), (0, 0, 0, 0))
    glow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img); g = ImageDraw.Draw(glow)
    cx, ground = 118, 190
    bl, bh = 38, 15                    # body half length / half height
    leg_h = 34
    stretch = 1.0
    lean = 0
    if pose == 'charge': stretch, lean = 1.22, 10
    if pose == 'windup': lean = -6
    body_y = ground - leg_h - bh + 2
    if pose == 'walk': body_y -= abs(math.sin(phase * math.pi * 2)) * 2
    if pose == 'rest': body_y += 2 + math.sin(phase * math.pi * 2) * 1.5
    bx = cx + lean
    swing = math.sin(phase * math.pi * 2)
    # legs: far pair (shaded) then near pair
    if pose == 'walk':
        pairs = [(-bl * .66, swing * 9, SHADE, 5.2), (bl * .62, -swing * 9, SHADE, 5.2), (-bl * .5, -swing * 9, COAT, 6), (bl * .78, swing * 9, COAT, 6)]
        for lx, sw, col, w in pairs:
            hip = (bx + lx, body_y + bh * .4)
            knee = (bx + lx + sw * .4, body_y + bh * .4 + leg_h * .5)
            leg(d, hip, knee, (bx + lx + sw, ground), w, col)
    elif pose == 'charge':
        gallop = 1 if phase < .5 else -1
        pairs = [(-bl * .7, -26 * gallop, SHADE, 5.2), (bl * .6, 22 * gallop, SHADE, 5.2), (-bl * .55, -18 * gallop, COAT, 6), (bl * .8, 30 * gallop, COAT, 6)]
        for lx, sw, col, w in pairs:
            hip = (bx + lx, body_y + bh * .35)
            knee = (bx + lx + sw * .55, body_y + bh * .35 + leg_h * .45 - 4)
            leg(d, hip, knee, (bx + lx + sw, ground - 3 + abs(sw) * .12), w, col)
    else:
        raise_front = 16 if pose == 'windup' else 0
        pairs = [(-bl * .66, 0, SHADE, 5.2, 0), (bl * .62, 0, SHADE, 5.2, 0), (-bl * .5, 0, COAT, 6, 0), (bl * .78, 0, COAT, 6, raise_front)]
        for lx, sw, col, w, lift in pairs:
            hip = (bx + lx, body_y + bh * .4)
            knee = (bx + lx + (8 if lift else 0), body_y + bh * .4 + leg_h * .5 - lift * .6)
            leg(d, hip, knee, (bx + lx + (12 if lift else 0), ground - lift), w, col)
    # tail
    outlined_ellipse(d, (bx - bl * stretch - 6, body_y - 4, bx - bl * stretch + 4, body_y + 6), CHEST)
    # body
    outlined_ellipse(d, (bx - bl * stretch, body_y - bh, bx + bl * stretch, body_y + bh), COAT)
    d.ellipse(S([(bx - bl * stretch * .95, body_y - bh * .95), (bx + bl * stretch * .5, body_y)]), fill=SHADE)
    d.ellipse(S([(bx - bl * stretch * .7, body_y - bh * .7), (bx + bl * stretch * .6, body_y + bh * .35)]), fill=COAT)
    d.ellipse(S([(bx - bl * stretch * .5, body_y + bh * .1), (bx + bl * stretch * .85, body_y + bh * .95)]), fill=LIGHT)
    # neck and head
    nx, ny = bx + bl * stretch * .85, body_y - bh * .35
    head_drop = 22 if pose == 'windup' else (10 if pose == 'charge' else 0)
    hx, hy = nx + 14 + (6 if pose == 'charge' else 0), ny - 30 + head_drop
    thick_line(d, [(nx, ny), (hx - 2, hy + 2)], COAT, 15)
    d.line(S([(nx + 3, ny + 5), (hx - 1, hy + 6)]), fill=CHEST, width=int(5 * SS))   # chest blaze up the throat
    antlers(d, g, (hx + 1, hy - 8))
    outlined_ellipse(d, (hx - 9, hy - 9, hx + 15, hy + 8), COAT)
    d.ellipse(S([(hx - 7, hy - 7), (hx + 8, hy + 2)]), fill=SHADE)
    # ears
    for ex in (hx - 8, hx - 1):
        outlined_polygon(d, [(ex, hy - 5), (ex - 5, hy - 19), (ex + 5, hy - 7)], COAT, 1.6)
        d.polygon(S([(ex + .5, hy - 7), (ex - 2.5, hy - 15), (ex + 3, hy - 8)]), fill=CHEST)
    # muzzle, nose, ember eye
    outlined_ellipse(d, (hx + 7, hy - 3, hx + 19, hy + 7), CHEST, 1.6)
    d.ellipse(S([(hx + 15, hy - 1), (hx + 20, hy + 4)]), fill=INK)
    eye = (hx + 3, hy - 2)
    g.ellipse([(eye[0] - 7) * SS, (eye[1] - 7) * SS, (eye[0] + 7) * SS, (eye[1] + 7) * SS], fill=EMBER + (140,))
    d.ellipse(S([(eye[0] - 2.6, eye[1] - 2.4), (eye[0] + 2.6, eye[1] + 2.4)]), fill=INK)
    d.ellipse(S([(eye[0] - 1.7, eye[1] - 1.6), (eye[0] + 1.7, eye[1] + 1.6)]), fill=EMBER)
    d.ellipse(S([(eye[0] - .6, eye[1] - 1.2), (eye[0] + .5, eye[1] - .2)]), fill=(255, 250, 220, 255))
    if pose == 'windup':
        # pawed dust
        for i in range(3):
            x = bx + bl * .78 + 14 + i * 7; y = ground - 2 - i * 3
            d.ellipse(S([(x - 4, y - 2), (x + 4, y + 2)]), fill=(200, 184, 150, 160))
    if pose == 'charge':
        for i in range(4):
            x = bx - bl * stretch - 8 - i * 9; y = ground - 6 + (i % 2) * 4
            d.ellipse(S([(x - 5, y - 2.5), (x + 5, y + 2.5)]), fill=(200, 184, 150, 150 - i * 25))
    glow = glow.filter(ImageFilter.GaussianBlur(6 * SS))
    out = Image.alpha_composite(glow, img)
    # fit about the hooves so every pose shares a baseline and nothing clips
    gx, gy = cx * SS, ground * SS
    tx, ty = (BIG - CELL) / 2 * SS + CELL * SS / 2, (BIG - CELL) / 2 * SS + CELL * SS - 6 * SS
    out = out.transform(out.size, Image.AFFINE, (1 / FIT, 0, gx - tx / FIT, 0, 1 / FIT, gy - ty / FIT), Image.BICUBIC)
    off = (BIG - CELL) // 2 * SS
    return out.crop((off, off, off + CELL * SS, off + CELL * SS)).resize((CELL, CELL), Image.LANCZOS)


sheet = Image.new('RGBA', (CELL * COLS, CELL * 2), (0, 0, 0, 0))
for i in range(4): sheet.paste(draw_stag('walk', i / 4), (i * CELL, 0))
for i, (pose, phase) in enumerate([('windup', 0), ('charge', 0), ('charge', .5), ('rest', .25)]):
    sheet.paste(draw_stag(pose, phase), (i * CELL, CELL))
sheet.save(OUT)
print('saved', OUT)
