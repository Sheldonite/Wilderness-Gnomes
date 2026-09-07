"""Build the Code Wizard sheet with fully generated walk animations.

The source art (`code-wizard-main-alpha-large.png`) only ever drew one leg pose per
direction, so nothing from its legs is used. Each direction keeps the painted upper
body and staff; below the hips a simple two-segment leg rig is drawn from scratch and
animated through an 8-frame walk cycle (thigh swing, knee flex, alternating legs, body
bob from the stance leg). Rows: idle, down, down-right, right, up-left, up, left,
down-left. Output: 8 columns x 8 rows of 192px cells.

Usage: python scripts/build_wizard_walk.py   (needs Pillow, numpy, scipy)
"""
import math
import os
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SRC = f'{ROOT}/src/assets/sprites/code-wizard-main-alpha-large.png'
OUT = f'{ROOT}/src/assets/sprites/code-wizard-main-spritesheet.png'
PREVIEW = f'{ROOT}/artifacts/wizard-walk-preview.png'   # artifacts/ is gitignored
os.makedirs(f'{ROOT}/artifacts', exist_ok=True)

C = 192; COLS = 8; ROWS = 8; SS = 3          # cell size, frames per row, supersample
# screen-space facing per row: (x, y); y>0 faces the camera
FACING = [(0, 1), (0, 1), (1, 1), (1, 0), (-1, -1), (0, -1), (-1, 0), (-1, 1)]
IDLE_ROW = 0
SWING = math.radians(40)      # thigh swing amplitude
FLEX = math.radians(55)       # knee flex at mid swing
LEG_WIDTH = 24                # jeans thickness at 192px
FOOT_H = 9
OUTLINE = (24, 22, 30, 255)
SHOE = (188, 32, 34, 255); SHOE_DARK = (132, 22, 26, 255); SOLE = (236, 226, 208, 255)

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
    """First painted frame of each source row, cropped to its pixels, ground shadow removed."""
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
        foot = frame[int(frame.shape[0] * 0.86):]
        foot[foot[:, :, 3] < 200] = 0
        frames.append(frame)
    assert len(frames) == ROWS
    return frames


def analyse(frame):
    """Where the painted legs were: hip line, hip x positions, jeans colour, and the staff pixels."""
    r, g, b, a = [frame[:, :, i].astype(int) for i in range(4)]
    vis = a > 10
    h = frame.shape[0]
    hip_guess = int(h * 0.55)
    jeans = vis & (b >= r + 8) & (b >= g) & (b < 150)
    jeans[:hip_guess] = False
    jeans = ndimage.binary_opening(jeans, iterations=2)
    ys, xs = np.where(jeans)
    hip_y = int(np.percentile(ys, 3))
    top_band = jeans[hip_y:hip_y + 12]
    txs = np.where(top_band.any(axis=0))[0]
    hip_l, hip_r = txs.min(), txs.max()
    colour = tuple(int(v) for v in np.median(frame[jeans][:, :3], axis=0)) + (255,)

    # staff shaft: brown that runs from above the hip line into the leg band
    brown = vis & (r > 90) & (r < 210) & (r > g + 15) & (g > b + 10)
    dark = vis & (r + g + b < 180)
    shaft = brown | (dark & ndimage.binary_dilation(brown, iterations=2))
    labels, count = ndimage.label(ndimage.binary_dilation(shaft, iterations=3))
    staff = np.zeros_like(shaft)
    for i in range(1, count + 1):
        comp = labels == i
        if comp[:hip_guess - 10].any() and comp[hip_y + 10:].any():
            staff |= comp & shaft & ~jeans
    staff[:hip_y] = False
    return hip_y, hip_l, hip_r, colour, staff


def upper_body(frame, hip_y, staff):
    """The painted art with everything below the hips removed, except the staff."""
    body = frame.copy()
    cut = np.zeros(frame.shape[:2], dtype=bool)
    cut[hip_y + 5:] = True
    cut &= ~ndimage.binary_dilation(staff, iterations=1)
    body[cut] = 0
    return body


def leg_points(hip, phase, length, facing):
    """Hip -> knee -> ankle for a leg at a walk phase, projected for the facing direction."""
    fx, fy = facing
    norm = math.hypot(fx, fy) or 1
    sx, sy = fx / norm, fy / norm
    theta = SWING * math.sin(phase)                          # thigh angle from vertical, + = forward
    flex = FLEX * max(0.0, math.cos(phase)) ** 1.2            # knee bends while the leg swings forward
    l1 = l2 = length / 2

    def step(point, angle, seg):
        # forward component shows as x on side views and as depth (a little y) on front/back views
        return (point[0] + seg * math.sin(angle) * sx,
                point[1] + seg * math.cos(angle) + seg * math.sin(angle) * sy * 0.3)

    knee = step(hip, theta, l1)
    ankle = step(knee, theta - flex, l2)
    return knee, ankle, sx, sy, theta - flex


def quad(p, q, wp, wq):
    """Corners of a tapered segment from p (width wp) to q (width wq)."""
    dx, dy = q[0] - p[0], q[1] - p[1]
    n = math.hypot(dx, dy) or 1
    nx, ny = -dy / n, dx / n
    return [(p[0] + nx * wp / 2, p[1] + ny * wp / 2), (q[0] + nx * wq / 2, q[1] + ny * wq / 2),
            (q[0] - nx * wq / 2, q[1] - ny * wq / 2), (p[0] - nx * wp / 2, p[1] - ny * wp / 2)]


def draw_leg(draw, hip, knee, ankle, sx, sy, shin_angle, colour, width, scale):
    """One trouser leg as two tapered panels with a straight cuff, then a sneaker."""
    S = lambda pts: [(x * scale, y * scale) for x, y in pts]
    w_hip, w_knee, w_ankle = width * 1.15, width * 0.95, width * 0.78
    o = 4.5
    thigh = quad(hip, knee, w_hip, w_knee); shin = quad(knee, ankle, w_knee, w_ankle)
    thigh_o = quad(hip, knee, w_hip + o, w_knee + o); shin_o = quad(knee, ankle, w_knee + o, w_ankle + o)
    for poly in (thigh_o, shin_o): draw.polygon(S(poly), fill=OUTLINE)
    kr = (w_knee + o) / 2
    draw.ellipse(S([(knee[0] - kr, knee[1] - kr), (knee[0] + kr, knee[1] + kr)]), fill=OUTLINE)
    for poly in (thigh, shin): draw.polygon(S(poly), fill=colour)
    kr = w_knee / 2
    draw.ellipse(S([(knee[0] - kr, knee[1] - kr), (knee[0] + kr, knee[1] + kr)]), fill=colour)
    # crease line down the shin for a little form
    crease = (ankle[0] * 0.5 + knee[0] * 0.5, ankle[1] * 0.5 + knee[1] * 0.5)
    draw.line(S([knee, crease]), fill=tuple(int(v * 0.8) for v in colour[:3]) + (255,), width=int(2 * scale))
    # sneaker: rounded box pointing the way of travel, heel just behind the ankle
    ax, ay = ankle
    length = 15 + 11 * abs(sx)
    height = FOOT_H + 2 * abs(sy)
    heel = 6 if sx == 0 else 5
    x0 = ax - heel if sx >= 0 else ax - (length - heel)
    if sx == 0: x0 = ax - length / 2
    box = [x0, ay - 1, x0 + length, ay + height]
    r = height * 0.5
    draw.rounded_rectangle(S([(box[0] - 2.5, box[1] - 2.5), (box[2] + 2.5, box[3] + 2.5)]), radius=(r + 2.5) * scale, fill=OUTLINE)
    draw.rounded_rectangle(S([(box[0], box[1]), (box[2], box[3])]), radius=r * scale, fill=SHOE if sy >= 0 else SHOE_DARK)
    draw.rounded_rectangle(S([(box[0] + 1, box[3] - 3.5), (box[2] - 1, box[3] - 1)]), radius=1.5 * scale, fill=SOLE)


def render_row(frame, row):
    """All frames for one direction, each an RGBA image sized like the source frame plus margin."""
    hip_y, hip_l, hip_r, colour, staff = analyse(frame)
    body = upper_body(frame, hip_y, staff)
    h, w = frame.shape[:2]
    ground = h - 1
    facing = FACING[row]
    fx, fy = facing
    leg_len = ground - FOOT_H - hip_y
    fnorm = math.hypot(fx, fy) or 1
    side = abs(fx) / fnorm                                           # 1 in profile, 0 straight on
    spread = (hip_r - hip_l) * 0.27 * (1 - side) + 4 * side          # legs stack in profile
    cx = (hip_l + hip_r) / 2 + (2 if fx == 0 else 0)
    hips = [(cx - spread, hip_y + 3), (cx + spread, hip_y + 3)]     # left leg, right leg (screen space)
    far = 0 if fx >= 0 else 1                                        # leg on the far side is drawn first
    shade = tuple(int(v * 0.72) for v in colour[:3]) + (255,)
    frames = []
    for i in range(COLS):
        phase = 2 * math.pi * i / COLS if row != IDLE_ROW else 0.0
        phases = [phase, phase + math.pi] if row != IDLE_ROW else [0.0, 0.0]
        legs = [leg_points(hips[k], phases[k], leg_len, facing if row != IDLE_ROW else (0, 1)) for k in range(2)]
        # the stance leg keeps the body on the ground: shift the whole figure so the lowest ankle lands
        lowest = max(l[1][1] for l in legs)
        lift = (ground - FOOT_H) - lowest
        margin = 12
        canvas = Image.new('RGBA', ((w + 2 * margin) * SS, (h + margin) * SS), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        order = [far, 1 - far]
        for k in order:
            knee, ankle, sx, sy, shin = legs[k]
            hip = hips[k]
            shift = lambda p: (p[0] + margin, p[1] + lift)
            draw_leg(draw, shift(hip), shift(knee), shift(ankle), sx, sy, shin, shade if k == far and fx != 0 else colour, LEG_WIDTH, SS)
        canvas = canvas.resize(((w + 2 * margin), h + margin), Image.LANCZOS)
        body_img = Image.fromarray(body)
        out = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
        out.alpha_composite(canvas)
        out.alpha_composite(body_img, (margin, int(round(lift))))
        frames.append((out, cx + margin))
    return frames


frames = extract_frames()
sheet = Image.new('RGBA', (C * COLS, C * ROWS), (0, 0, 0, 0))
for row, frame in enumerate(frames):
    for col, (img, anchor_x) in enumerate(render_row(frame, row)):
        arr = np.array(img); ys, xs = np.where(arr[:, :, 3] > 10)
        img = img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        anchor_x -= xs.min(); bottom = img.height
        px = int(round(col * C + C / 2 - anchor_x)); py = row * C + C - 1 - bottom
        assert px >= col * C and px + img.width <= (col + 1) * C and py >= row * C, (row, col, px, py, img.size)
        sheet.paste(img, (px, py), img)
sheet.save(OUT)

bg = Image.new('RGBA', sheet.size, (150, 170, 110, 255)); bg.alpha_composite(sheet)
bg.resize((bg.width // 2, bg.height // 2), Image.LANCZOS).save(PREVIEW)
print('saved', OUT)
