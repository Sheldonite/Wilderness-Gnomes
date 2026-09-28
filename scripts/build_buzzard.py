"""Generate the pixel-art buzzard sheets.

The buzzard is seen from above as it soars, heading right, broad wings spread to either side and
tipped with fingered primaries. Every frame is drawn on a 48x48 pixel grid, outlined, then scaled 4x
with nearest-neighbour to the 192px cells the game expects. Same layout as before, 6 x 2:
    frames 0-5   flap cycle (the wings shorten as they sweep up and forward, then open again)
    frames 6-9   dive (6 folding, 7-9 tucked)
    frames 10-11 glide
Outputs to src/assets/sprites/:
    buzzard-pixel-sheet.png     Frankie the companion, and the buzzard enemies
    king-frankie-sheet.png      the same bird wearing a little gold crown, for the boss
    buzzard-pixel-portrait.png  a glide frame on its own, for the companion portrait

Usage: python scripts/build_buzzard.py   (needs Pillow)
"""
import math
import os
from PIL import Image, ImageDraw

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT_DIR = f'{ROOT}/src/assets/sprites'
GRID, SCALE, COLS = 48, 4, 6
CY = 24                     # the body's centre line

OUTLINE = (30, 19, 12, 255)
DARK = (66, 40, 24, 255)
MID = (104, 66, 38, 255)
LIGHT = (146, 98, 56, 255)
PALE = (198, 160, 108, 255)
CREAM = (232, 214, 176, 255)
YELLOW = (238, 192, 62, 255)
BEAK = (58, 54, 58, 255)
GOLD = (248, 204, 72, 255)
GOLD_DARK = (178, 124, 32, 255)
GEM = (210, 46, 58, 255)
CLEAR = (0, 0, 0, 0)


def px(img, x, y, colour):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < GRID and 0 <= y < GRID:
        img.putpixel((x, y), colour)


def poly(img, pts, colour):
    ImageDraw.Draw(img).polygon([(round(x), round(y)) for x, y in pts], fill=colour)


def wing(img, span, side, sweep=0.0):
    """One wing reaching `span` pixels out from the body: side -1 is the upper wing, +1 the lower.
    Broad at the wrist, it ends in five separate finger feathers. sweep pulls it back as it folds."""
    s = side
    fingers = min(6, max(0, span - 5))       # the last few pixels of the span are the fingers
    reach = span - fingers
    root_front, root_back = (28, CY + s * 1), (17, CY + s * 2)
    wrist = (31 - sweep * .6, CY + s * reach * .6)
    hand_front = (29 - sweep, CY + s * reach)
    hand_back = (20 - sweep, CY + s * reach)
    trail = (15 - sweep * .5, CY + s * reach * .7)
    poly(img, [root_front, wrist, hand_front, hand_back, trail, root_back], MID)
    if span < 5:
        return
    # shading bands: pale leading edge, lighter coverts, dark secondaries along the trailing edge
    for step in range(0, int(reach) + 1):
        y = CY + s * step
        t = step / max(1, reach)
        front = root_front[0] + (wrist[0] - root_front[0]) * min(1, t / .6) if t <= .6 else wrist[0] + (hand_front[0] - wrist[0]) * (t - .6) / .4
        back = root_back[0] + (trail[0] - root_back[0]) * min(1, t / .7) if t <= .7 else trail[0] + (hand_back[0] - trail[0]) * (t - .7) / .3
        px(img, front - 1, y, PALE)
        for dx in (2, 3):
            px(img, front - dx, y, LIGHT)
        for dx in (0, 1, 2):
            px(img, back + dx, y, DARK)
    # five finger feathers, splayed, with daylight between them
    if fingers:
        xs = [hand_back[0] + 1 + i * (hand_front[0] - hand_back[0] - 2) / 4 for i in range(5)]
        for i, x0 in enumerate(xs):
            lean = (i - 2) * .35
            length = fingers - abs(i - 2) * .5
            for k in range(int(round(length)) + 1):
                px(img, x0 + lean * k, CY + s * (reach + k), DARK)
                px(img, x0 + 1 + lean * k, CY + s * (reach + k), DARK if k < length - 1 else CLEAR)


def tail(img, fan=1.0):
    """A fanned tail behind the body, with a dark terminal band."""
    poly(img, [(16, CY - 2), (6, CY - 5 * fan), (5, CY + 5 * fan), (16, CY + 2)], MID)
    for y in range(int(CY - 5 * fan), int(CY + 5 * fan) + 1):
        px(img, 6, y, DARK); px(img, 7, y, DARK)
    for y in range(int(CY - 3 * fan), int(CY + 3 * fan) + 1, 2):
        px(img, 10, y, LIGHT)


def body(img, stretch=0):
    s = stretch
    ImageDraw.Draw(img).ellipse([14 - s, CY - 3, 32, CY + 3], fill=MID)
    ImageDraw.Draw(img).ellipse([17 - s, CY - 2, 30, CY + 1], fill=DARK)       # dark back
    for x in (19, 22, 25, 28):
        px(img, x, CY + 2, LIGHT)                                             # flank streaks
    # head seen from above, beak hooked forward
    hx = 33 + s
    ImageDraw.Draw(img).ellipse([hx - 3, CY - 3, hx + 3, CY + 3], fill=LIGHT)
    for x, y in [(hx - 2, CY - 1), (hx - 1, CY - 1), (hx, CY - 1), (hx - 2, CY), (hx - 1, CY), (hx - 2, CY + 1)]:
        px(img, x, y, MID)                                                    # darker cap
    px(img, hx + 1, CY - 3, CREAM); px(img, hx + 1, CY + 3, CREAM)             # pale brows
    px(img, hx + 2, CY - 2, OUTLINE); px(img, hx + 2, CY + 2, OUTLINE)        # eyes
    px(img, hx + 4, CY - 1, YELLOW); px(img, hx + 4, CY, YELLOW); px(img, hx + 4, CY + 1, YELLOW)
    px(img, hx + 5, CY, BEAK); px(img, hx + 5, CY - 1, BEAK); px(img, hx + 6, CY, BEAK); px(img, hx + 6, CY + 1, OUTLINE)
    return hx


def crown(img, hx):
    """A little gold crown perched on his head, drawn upright so it reads at a glance."""
    base, x0 = CY + 1, hx - 3
    for x in range(x0, x0 + 7):
        px(img, x, base, GOLD_DARK); px(img, x, base - 1, GOLD); px(img, x, base - 2, GOLD)
    for x, h in [(x0, 3), (x0 + 3, 4), (x0 + 6, 3)]:     # three points, the middle one tallest
        for k in range(h):
            px(img, x, base - 3 - k, GOLD)
    px(img, x0 + 3, base - 1, GEM); px(img, x0 + 1, base - 1, (255, 240, 170, 255))


def outline(img):
    a = img.getchannel('A').load()
    out = img.copy()
    for y in range(GRID):
        for x in range(GRID):
            if a[x, y]:
                continue
            if any(0 <= x + ox < GRID and 0 <= y + oy < GRID and a[x + ox, y + oy] for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out.putpixel((x, y), OUTLINE)
    return out


# (span, sweep) for each flap frame: fully open, sweeping up and forward, then opening again
FLAP = [(19, 0), (16, 1), (11, 2), (7, 3), (12, 2), (17, 1)]
GLIDE = [(19, 0), (18, 1)]
DIVE = [(8, 7), (4, 10), (4, 10), (4, 10)]


def frame(span, sweep, crowned, dive=False):
    img = Image.new('RGBA', (GRID, GRID), CLEAR)
    tail(img, .7 if dive else 1)
    for side in (-1, 1):
        wing(img, span, side, sweep)
    hx = body(img, stretch=2 if dive else 0)
    if crowned:
        crown(img, hx)
    return outline(img)


def sheet(crowned):
    frames = [frame(sp, sw, crowned) for sp, sw in FLAP]
    frames += [frame(sp, sw, crowned, dive=True) for sp, sw in DIVE]
    frames += [frame(sp, sw, crowned) for sp, sw in GLIDE]
    out = Image.new('RGBA', (GRID * COLS, GRID * 2), CLEAR)
    for i, f in enumerate(frames):
        bob = [0, 0, 0, 0, 0, 0, 0, -1, 0, 1, 0, 0][i]   # tucked dive frames wobble a pixel
        out.paste(f, ((i % COLS) * GRID, (i // COLS) * GRID + bob), f)
    return out.resize((out.width * SCALE, out.height * SCALE), Image.NEAREST), frames


plain, frames = sheet(False)
plain.save(f'{OUT_DIR}/buzzard-pixel-sheet.png')
sheet(True)[0].save(f'{OUT_DIR}/king-frankie-sheet.png')
portrait = frames[10].crop((2, 2, 46, 46))
portrait.resize((portrait.width * 8, portrait.height * 8), Image.NEAREST).save(f'{OUT_DIR}/buzzard-pixel-portrait.png')
print('saved buzzard sheets to', OUT_DIR)
