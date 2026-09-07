"""Generate the Ron Bard ("Ron, the Festive Bard") walk sprite sheet.

192px cells, 8 columns x 8 rows, output 1536x1536:
    row 0: idle-down    (facing camera, subtle breathing / ribbon sway)
    row 1: walk-down    (facing camera)
    row 2: walk-down-right
    row 3: walk-right   (profile)
    row 4: walk-up-left (back, angled left)
    row 5: walk-up      (back to camera)
    row 6: walk-left    (profile)
    row 7: walk-down-left
Each walk row is a full 8-frame stride cycle (alternating legs + body bob); the
idle row is 8 frames of a static stance with a gentle chest-breathing lift and
a fluttering ribbon staff.

Rig: a simple hip/shoulder skeleton with two-segment legs (thigh+shin) and
two-segment arms (upper+forearm), animated with the same swing/knee-flex
formula for every one of the 8 facing directions -- only the (sx, sy) unit
facing vector changes, so a step shows up as horizontal travel in profile and
as vertical foreshortening + bob in front/back views. Every frame first solves
for the small full-body vertical shift that pins the lower foot to a fixed
ground line (so the walk never "floats" or pulses in scale), then draws far
leg -> near leg -> far arm -> torso/sash/fringe -> head/hair/face -> near arm
-> ribbon staff -> streaming ribbons. Four facing "left" rows (walk-left,
walk-up-left, walk-down-left) are produced by mirroring the corresponding
canonical right-leaning render, so the geometry only has to be solved once per
silhouette family (front, back, side, diag-front, diag-back).

Everything is flat storybook colour blocks with a dark ink outline, drawn at
SS-times supersample and downsampled with LANCZOS for clean anti-aliased
edges (same technique as build_deer.py / build_stag.py / build_wizard_walk.py).

Usage: python scripts/build_ron_bard.py   (needs Pillow)
"""
import math
import os
from PIL import Image, ImageDraw

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = f'{ROOT}/src/assets/sprites/ron-bard-spritesheet.png'
CELL = 192
SS = 3
COLS = 8

# ---- palette -----------------------------------------------------------
INK = (34, 26, 30, 255)
JACKET = (30, 74, 62, 255); JACKET_SH = (20, 52, 44, 255)
SHIRT = (240, 232, 214, 255)
TROUSER = (74, 42, 62, 255); TROUSER_SH = (52, 28, 44, 255)
ORANGE = (232, 126, 60, 255); PINK = (226, 92, 116, 255)
BLUE = (72, 126, 190, 255); GOLD = (238, 194, 92, 255)
RIBBON_COLOURS = [PINK, BLUE, GOLD, ORANGE]
BOOT = (38, 32, 38, 255)
SKIN = (226, 176, 140, 255)
HAIR = (40, 30, 28, 255)
STAFF = (132, 94, 58, 255); STAFF_SH = (98, 68, 42, 255)
MOUTH = (98, 40, 42, 255)

# ---- body metrics, in final (1x) pixels; CX/GROUND anchor every cell ---
CX = CELL / 2.0
GROUND = 176.0                 # sole baseline (16px bottom margin)
BOOT_H = 9.0
ANKLE_Y = GROUND - BOOT_H
THIGH = 35.0; SHIN = 35.0
HIP_Y = ANKLE_Y - THIGH - SHIN
TORSO_H = 42.0
SHOULDER_Y = HIP_Y - TORSO_H
NECK = 5.0
HEAD_R = 15.0
HEAD_CY = SHOULDER_Y - NECK - HEAD_R      # ~= 35, head top ~20 -> figure height ~156px

UPARM = 15.0; FOREARM = 15.0
HIP_HALF = 15.0                # torso bottom half-width

SWING = math.radians(30); FLEX = math.radians(52)          # leg walk amplitude
ARM_SWING = math.radians(30); ARM_FLEX = math.radians(20)  # free (far) arm
GRIP_SWING = math.radians(16); GRIP_FLEX = math.radians(9)  # staff-hand arm (steadier)

FRONT_HIP_OFF = 11.0; SIDE_HIP_OFF = 4.0
FRONT_SH_OFF = 19.0; SIDE_SH_OFF = 7.0

N = 8  # frames per row


# ---- low level helpers (outlined shapes, tapered limbs) ----------------
def S(pts):
    return [(x * SS, y * SS) for x, y in pts]


def outlined_ellipse(d, x0, y0, x1, y1, fill, width=1.6):
    w = width * SS
    d.ellipse([x0 * SS - w, y0 * SS - w, x1 * SS + w, y1 * SS + w], fill=INK)
    d.ellipse([x0 * SS, y0 * SS, x1 * SS, y1 * SS], fill=fill)


def outlined_polygon(d, pts, fill, width=1.6):
    P = S(pts)
    d.polygon(P, fill=INK, outline=INK, width=int(width * 2 * SS))
    d.polygon(P, fill=fill)


def thick_line(d, pts, colour, width, outline=1.6):
    P = S(pts)
    d.line(P, fill=INK, width=int((width + outline * 2) * SS), joint='curve')
    d.line(P, fill=colour, width=int(width * SS), joint='curve')


def quad(p, q, wp, wq):
    dx, dy = q[0] - p[0], q[1] - p[1]
    n = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / n, dx / n
    return [(p[0] + nx * wp / 2, p[1] + ny * wp / 2), (q[0] + nx * wq / 2, q[1] + ny * wq / 2),
            (q[0] - nx * wq / 2, q[1] - ny * wq / 2), (p[0] - nx * wp / 2, p[1] - ny * wp / 2)]


def tapered(d, p, q, wp, wq, colour, outline=3.0):
    """One tapered limb segment with an ink underlay and a rounded start joint."""
    d.polygon(S(quad(p, q, wp + outline, wq + outline)), fill=INK)
    r = (wp + outline) / 2
    d.ellipse(S([(p[0] - r, p[1] - r), (p[0] + r, p[1] + r)]), fill=INK)
    d.polygon(S(quad(p, q, wp, wq)), fill=colour)
    r2 = wp / 2
    d.ellipse(S([(p[0] - r2, p[1] - r2), (p[0] + r2, p[1] + r2)]), fill=colour)


def boot(d, ankle, sx):
    length = 15 + 6 * abs(sx)
    height = 10.0
    heel = 5 if sx >= 0 else length - 5
    x0 = ankle[0] - heel
    box = [x0, ankle[1] - 2, x0 + length, ankle[1] + height]
    r = height * 0.5
    d.rounded_rectangle(S([(box[0] - 2.2, box[1] - 2.2), (box[2] + 2.2, box[3] + 2.2)]),
                         radius=(r + 2.2) * SS, fill=INK)
    d.rounded_rectangle(S([(box[0], box[1]), (box[2], box[3])]), radius=r * SS, fill=BOOT)


def limb_point(hip, phase, l1, l2, sx, sy, swing_amt, flex_amt):
    """Hip -> knee/elbow -> ankle/hand for a limb at a walk phase."""
    theta = swing_amt * math.sin(phase)
    flex = flex_amt * max(0.0, math.cos(phase)) ** 1.2

    def step(pt, ang, seg):
        return (pt[0] + seg * math.sin(ang) * sx,
                pt[1] + seg * math.cos(ang) + seg * math.sin(ang) * sy * 0.35)

    mid = step(hip, theta, l1)
    end = step(mid, theta - flex, l2)
    return mid, end


def ankle_dy(phase, sx, sy):
    _, (ex, ey) = limb_point((0.0, 0.0), phase, THIGH, SHIN, sx, sy, SWING, FLEX)
    return ey


def compute_shift(leg_phase, sx, sy):
    """Vertical shift so the lower foot always lands exactly on ANKLE_Y."""
    a = HIP_Y + ankle_dy(leg_phase, sx, sy)
    b = HIP_Y + ankle_dy(leg_phase + math.pi, sx, sy)
    return ANKLE_Y - max(a, b)


def ribbon(d, origin, angle, length, phase, colour, width=3.0):
    perp = angle + math.pi / 2
    pts = []
    n = 6
    for i in range(n + 1):
        t = i / n
        dist = t * length
        wave = math.sin(phase + t * 3.4) * (2.5 + 7 * t)
        pts.append((origin[0] + math.cos(angle) * dist + math.cos(perp) * wave,
                    origin[1] + math.sin(angle) * dist + math.sin(perp) * wave))
    thick_line(d, pts, colour, width, outline=1.1)


# ---- facing categories ---------------------------------------------------
def facing_category(fx, fy):
    if fx == 0 and fy > 0: return 'front'
    if fx == 0 and fy < 0: return 'back'
    if fy == 0: return 'side'
    if fy > 0: return 'diag_front'
    return 'diag_back'


# grip is torso-relative (CX+gdx, hip_y+gdy); elev = degrees above horizontal
# the pole tilts toward; dirs = which way it leans (-1 left, +1 right). Kept
# shallow/short on purpose -- there is only ~20px of headroom above the head
# but ~85px of clear space to either side, so the pole (and its ribbons)
# reach mostly sideways rather than straight up to stay inside the cell.
STAFF_CFG = {
    'front':      dict(gdx=4, gdy=0, elev=40, dirs=-1, length=58, back=15),
    'back':       dict(gdx=2, gdy=0, elev=40, dirs=1, length=54, back=14),
    'side':       dict(gdx=13, gdy=3, elev=40, dirs=1, length=42, back=14),
    'diag_front': dict(gdx=7, gdy=1, elev=40, dirs=-1, length=54, back=14),
    'diag_back':  dict(gdx=7, gdy=1, elev=40, dirs=1, length=50, back=14),
}


def draw_ron(d, fx, fy, mode, frame):
    norm = math.hypot(fx, fy) or 1.0
    sx, sy = fx / norm, fy / norm
    side_amt = abs(sx)
    cat = facing_category(fx, fy)

    if mode == 'idle':
        oy = 0.0
        breathe = 1.6 * math.sin(2 * math.pi * frame / N)
        ribbon_phase = 2 * math.pi * frame / N
        legA_phase = legB_phase = math.pi
        armA_phase = armB_phase = math.pi
    else:
        leg_phase = 2 * math.pi * frame / N
        oy = compute_shift(leg_phase, sx, sy)
        breathe = 0.0
        ribbon_phase = 2 * math.pi * frame / N * 2
        legA_phase = leg_phase
        legB_phase = leg_phase + math.pi
        armA_phase = legB_phase          # contralateral swing
        armB_phase = legA_phase

    hip_y = HIP_Y + oy
    shoulder_y = SHOULDER_Y + oy - breathe
    head_cy = HEAD_CY + oy - breathe

    hip_off = FRONT_HIP_OFF * (1 - side_amt) + SIDE_HIP_OFF * side_amt
    sh_off = FRONT_SH_OFF * (1 - side_amt) + SIDE_SH_OFF * side_amt

    hipA = (CX - hip_off, hip_y); hipB = (CX + hip_off, hip_y)
    shA = (CX - sh_off, shoulder_y); shB = (CX + sh_off, shoulder_y)

    kneeA, ankleA = limb_point(hipA, legA_phase, THIGH, SHIN, sx, sy, SWING, FLEX)
    kneeB, ankleB = limb_point(hipB, legB_phase, THIGH, SHIN, sx, sy, SWING, FLEX)
    elbowA, handA = limb_point(shA, armA_phase, UPARM, FOREARM, sx, sy, ARM_SWING, ARM_FLEX)
    elbowB, handB = limb_point(shB, armB_phase, UPARM, FOREARM, sx, sy, GRIP_SWING, GRIP_FLEX)

    far_shade = TROUSER_SH if side_amt > 0.15 else TROUSER

    # far leg
    tapered(d, hipA, kneeA, 15, 12, far_shade)
    tapered(d, kneeA, ankleA, 12, 9, far_shade)
    boot(d, ankleA, sx)
    # near leg
    tapered(d, hipB, kneeB, 16, 13, TROUSER)
    tapered(d, kneeB, ankleB, 13, 10, TROUSER)
    boot(d, ankleB, sx)

    # far arm (sleeve + skin hand), tucked mostly behind the torso
    tapered(d, shA, elbowA, 10, 8, JACKET_SH if side_amt > 0.15 else JACKET)
    tapered(d, elbowA, handA, 8, 6.5, JACKET_SH if side_amt > 0.15 else JACKET)
    outlined_ellipse(d, handA[0] - 3.4, handA[1] - 3.4, handA[0] + 3.4, handA[1] + 3.4, SKIN, 1.1)

    draw_torso_body(d, shA, shB, hip_y, cat, sx)
    draw_head(d, CX + (2.0 if cat != 'side' else sx * 2.0), head_cy, HEAD_R, cat, sx)

    # near arm on top, holding the staff
    tapered(d, shB, elbowB, 11, 9, JACKET)
    tapered(d, elbowB, handB, 9, 7, JACKET)
    outlined_ellipse(d, handB[0] - 3.6, handB[1] - 3.6, handB[0] + 3.6, handB[1] + 3.6, SKIN, 1.1)

    draw_torso_trim(d, shA, shB, hip_y, cat)

    cfg = STAFF_CFG[cat]
    grip = (CX + cfg['gdx'], hip_y + cfg['gdy'])
    elev = math.radians(cfg['elev'])
    dxu, dyu = cfg['dirs'] * math.cos(elev), -math.sin(elev)
    length, back = cfg['length'], cfg['back']
    ang = math.atan2(dyu, dxu)
    tip = (grip[0] + dxu * length, grip[1] + dyu * length)
    butt = (grip[0] - dxu * back, grip[1] - dyu * back)
    thick_line(d, [butt, grip, tip], STAFF, 4.4)
    d.line(S([(grip[0], grip[1]), (tip[0], tip[1])]), fill=STAFF_SH, width=int(1.4 * SS))
    outlined_ellipse(d, tip[0] - 4.2, tip[1] - 4.2, tip[0] + 4.2, tip[1] + 4.2, GOLD, 1.3)

    for i, col in enumerate(RIBBON_COLOURS):
        rp = ribbon_phase + i * 1.35
        fan = math.radians((i - 1.5) * 7)
        ribbon(d, tip, ang + fan, 26 + i * 3.5, rp, col)


def draw_torso_body(d, shA, shB, hip_y, cat, sx):
    """Jacket silhouette + cream shirt sliver -- drawn before the head/arms."""
    hip_half = HIP_HALF
    top_l, top_r = (shA[0] - 2, shA[1]), (shB[0] + 2, shB[1])
    bot_l, bot_r = (CX - hip_half, hip_y), (CX + hip_half, hip_y)
    outlined_polygon(d, [top_l, top_r, bot_r, bot_l], JACKET)
    if abs(sx) > 0.15:
        sp = [top_l, (CX - 2, top_l[1] + 3), (CX - hip_half * 0.15, hip_y), bot_l]
        d.polygon(S(sp), fill=JACKET_SH)

    if cat in ('front', 'diag_front'):
        pts = [(CX - 6.5, shA[1] + 4), (CX + 6.5, shA[1] + 4), (CX + 4.0, hip_y - 3), (CX - 4.0, hip_y - 3)]
        d.polygon(S(pts), fill=SHIRT)
    elif cat == 'side':
        edge = CX + sx * hip_half * 0.5
        pts = [(edge - 3, shA[1] + 4), (edge + 3, shA[1] + 4), (edge + 2, hip_y - 4), (edge - 4, hip_y - 4)]
        d.polygon(S(pts), fill=SHIRT)


def draw_torso_trim(d, shA, shB, hip_y, cat):
    """Shoulder ribbon fringe + woven sash -- drawn on top, after both arms,
    so the fringe drapes over the sleeves instead of hiding underneath them."""
    hip_half = HIP_HALF
    for sh, sign in ((shA, -1), (shB, 1)):
        for j, col in enumerate(RIBBON_COLOURS):
            fx0 = sh[0] + sign * (2 + j * 2.1)
            fy0 = sh[1] + 1
            fy1 = fy0 + 9 + (j % 2) * 3
            thick_line(d, [(fx0, fy0), (fx0 + sign * 1.0, fy1)], col, 2.0, outline=0.8)

    # woven sash + tassels
    sash_y0, sash_y1 = hip_y - 9, hip_y - 2
    stripe_w = (hip_half * 2) / 5.0
    for i in range(5):
        col = RIBBON_COLOURS[i % 4]
        x0 = CX - hip_half + i * stripe_w
        d.rectangle(S([(x0, sash_y0), (x0 + stripe_w, sash_y1)]), fill=col)
    d.rectangle(S([(CX - hip_half - 1, sash_y0 - 0.8), (CX + hip_half + 1, sash_y0 + 0.8)]), fill=INK)
    d.rectangle(S([(CX - hip_half - 1, sash_y1 - 0.8), (CX + hip_half + 1, sash_y1 + 0.8)]), fill=INK)
    if cat != 'back':
        for tx in (CX - 3.2, CX + 3.2):
            d.line(S([(tx, sash_y1), (tx, sash_y1 + 9)]), fill=INK, width=int(2.6 * SS))
            outlined_ellipse(d, tx - 1.6, sash_y1 + 7.5, tx + 1.6, sash_y1 + 10.5, GOLD, 0.8)


def draw_head(d, cx, cy, r, cat, sx):
    outlined_ellipse(d, cx - r, cy - r, cx + r, cy + r, SKIN)
    if cat in ('back', 'diag_back'):
        # full coverage: from the back we see hair only, no skin at all
        outlined_ellipse(d, cx - r - 1.5, cy - r - 2.5, cx + r + 1.5, cy + r + 1.5, HAIR)
        return
    if cat == 'side':
        if sx >= 0:
            bx0, bx1 = cx - r - 1.5, cx + r * 0.1
        else:
            bx0, bx1 = cx - r * 0.1, cx + r + 1.5
        outlined_ellipse(d, bx0, cy - r - 2.2, bx1, cy + r * 0.6, HAIR)
        ex = cx + sx * r * 0.4
        d.ellipse(S([(ex - 1.7, cy - 1.6), (ex + 1.7, cy + 1.6)]), fill=INK)
        mx = cx + sx * r * 0.5
        outlined_ellipse(d, mx - 2.2, cy + 6.5, mx + 2.2, cy + 10.2, MOUTH, 0.8)
        return
    # front / diag_front -- hair cap on top, then a clear gap before the
    # eyes/mouth so they don't visually fuse with the hairline's ink edge
    outlined_ellipse(d, cx - r - 1.5, cy - r - 3.0, cx + r + 1.5, cy - r * 0.32, HAIR)
    for ex in (cx - 5.4, cx + 5.4):
        d.ellipse(S([(ex - 2.0, cy + 2.6), (ex + 2.0, cy + 6.6)]), fill=INK)
    outlined_ellipse(d, cx - 2.7, cy + 9.4, cx + 2.7, cy + 13.2, MOUTH, 0.8)


# ---- assembly ------------------------------------------------------------
ROW_SPECS = [
    ('idle', (0, 1), False),
    ('walk', (0, 1), False),
    ('walk', (1, 1), False),
    ('walk', (1, 0), False),
    ('walk', (1, -1), True),    # mirrors to up-left
    ('walk', (0, -1), False),
    ('walk', (1, 0), True),     # mirrors to left
    ('walk', (1, 1), True),     # mirrors to down-left
]


def render_cell(mode, facing, frame, mirror):
    img = Image.new('RGBA', (CELL * SS, CELL * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    fx, fy = facing
    draw_ron(d, fx, fy, mode, frame)
    img = img.resize((CELL, CELL), Image.LANCZOS)
    if mirror:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    return img


def build():
    sheet = Image.new('RGBA', (CELL * COLS, CELL * len(ROW_SPECS)), (0, 0, 0, 0))
    for r, (mode, facing, mirror) in enumerate(ROW_SPECS):
        for f in range(COLS):
            cell = render_cell(mode, facing, f, mirror)
            sheet.paste(cell, (f * CELL, r * CELL), cell)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sheet.save(OUT)
    print('saved', OUT, sheet.size)


if __name__ == '__main__':
    build()
