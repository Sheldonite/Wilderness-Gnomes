"""Generate the Ron Bard ("Ron, the Festive Bard") walk sprite sheet.

192px cells, 8 columns x 8 rows, output 1536x1536:
    row 0: idle-down    (facing camera, breathing lift + fluttering ribbons)
    row 1: walk-down    (facing camera)
    row 2: walk-down-right
    row 3: walk-right   (profile)
    row 4: walk-up-left (back, angled left)
    row 5: walk-up      (back to camera)
    row 6: walk-left    (profile)
    row 7: walk-down-left
Each walk row is a full 8-frame stride cycle -- alternating legs, hip/shoulder
counter-rotation, lateral weight shift and a body bob that falls out of pinning
the planted foot to the ground line.  The idle row is 8 frames of a relaxed
two-foot stance with a chest-breathing lift and a slow ribbon flutter.

Rig: a hip/shoulder skeleton with two-segment legs (thigh + shin + a knee that
bends through the swing) and two-segment arms (upper + forearm).  One walk
formula serves all eight facings -- only the (sx, sy) unit facing vector
changes, so a step reads as horizontal travel in profile and as foreshortening
plus a foot lift in the front/back views.  Every frame first solves the small
whole-body vertical shift that pins the lower foot to a fixed sole line (so the
walk never floats or pulses in scale), then draws far leg -> near leg -> far arm
-> shirt -> jacket -> sash -> head -> near arm -> staff -> ribbons -> confetti.
The three "left" rows are mirrors of the matching right-leaning render, so each
silhouette family (front, back, side, diag-front, diag-back) is solved once.

Shading: every material is a 4-tone ramp -- (ink, shadow, base, highlight) --
see the MATERIALS block.  `paint()` is the one drawing primitive: it strokes an
ink outline around a silhouette, floods the silhouette with the base tone, then
paints an ordered list of shadow / highlight / detail layers *clipped to that
silhouette* through a mask.  Light is treated as coming from the upper left, so
shadow shapes hug the lower-right of every form and rim highlights run down the
upper-left edge (`rim()` builds those; core shadows are half-planes or the
silhouette offset down-right and re-clipped).  Every
material therefore shows at least four tones on screen.  Drawing happens at
SS-times supersample and is downsampled with LANCZOS for clean anti-aliased
edges, the same technique as build_deer.py / build_stag.py / build_wizard_walk.py.

Usage: python scripts/build_ron_bard.py   (needs Pillow)
"""
import math
import os
from collections import namedtuple

from PIL import Image, ImageDraw

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = f'{ROOT}/src/assets/sprites/ron-bard-spritesheet.png'
CELL = 192
SS = 4                 # supersample factor
COLS = 8
N = 8                  # frames per row
OW = 1.7               # default ink outline width, in final pixels


# ---------------------------------------------------------------- palette --
# MATERIALS.  Every material is a four tone ramp: outline (darkest), core
# shadow, base, highlight.  Light comes from the upper left.
Mat = namedtuple('Mat', 'ink sh base hi')


def M(ink, sh, base, hi):
    return Mat(ink + (255,), sh + (255,), base + (255,), hi + (255,))


SKIN     = M((92, 48, 40),   (194, 134, 100), (234, 184, 142), (252, 219, 186))
SKIN_D   = M((78, 40, 34),   (164, 110, 82),  (200, 152, 116), (228, 186, 148))
HAIR     = M((18, 12, 14),   (32, 21, 20),    (58, 40, 34),    (108, 78, 55))
JACKET   = M((9, 28, 26),    (21, 58, 50),    (42, 101, 84),    (84, 150, 124))
JACKET_D = M((8, 24, 22),    (16, 44, 39),    (30, 75, 62),    (56, 112, 93))
LINING   = M((44, 22, 24),   (96, 44, 44),    (142, 68, 63),   (186, 102, 90))
SHIRT    = M((100, 88, 70),  (183, 168, 139), (233, 220, 190), (251, 244, 224))
TROUSER  = M((27, 15, 25),   (52, 29, 46),    (83, 48, 71),    (120, 78, 102))
TROUS_D  = M((23, 13, 21),   (42, 23, 37),    (64, 37, 55),    (94, 60, 81))
BOOT     = M((12, 10, 14),   (25, 21, 27),    (45, 39, 46),    (104, 95, 101))
BOOT_D   = M((10, 9, 12),    (20, 17, 22),    (34, 30, 36),    (78, 71, 77))
WOOD     = M((52, 32, 18),   (103, 69, 39),   (150, 106, 64),  (198, 156, 105))
GOLD     = M((86, 56, 16),   (175, 129, 43),  (234, 188, 82),  (255, 239, 170))
PINK     = M((90, 28, 50),   (177, 63, 97),   (232, 107, 135), (253, 168, 188))
BLUE     = M((20, 42, 86),   (45, 88, 148),   (79, 134, 200),  (150, 194, 242))
ORANGE   = M((90, 42, 12),   (177, 88, 31),   (234, 134, 59),  (253, 190, 120))

def FLAT(col):
    """A material whose whole ramp is one tone -- for flat detail patches."""
    return Mat(INK, col, col, col)


RIBBONS = (PINK, BLUE, GOLD, ORANGE)
SASH_BANDS = (PINK, GOLD, BLUE, ORANGE)
CONFETTI = (PINK, BLUE, GOLD, ORANGE, SHIRT)

INK = (22, 16, 20, 255)
EYE_WHITE = (250, 247, 240, 255)
EYE_SH = (205, 196, 186, 255)
IRIS = (78, 50, 34, 255)
PUPIL = (26, 17, 17, 255)
GLINT = (255, 255, 255, 255)
MOUTH_IN = (94, 34, 40, 255)
TONGUE = (194, 90, 94, 255)
TEETH = (250, 244, 230, 255)


# ------------------------------------------------------- body proportions --
# All in final (1x) pixels.  CX / SOLE anchor every one of the 64 cells.
CX = 96.0
SOLE = 179.2                    # outermost ink pixel under the planted boot
BOOT_H = 13.5
ANKLE_Y = SOLE - OW - BOOT_H    # 165.0
SHIN = 21.0
THIGH = 23.0
KNEE_Y = ANKLE_Y - SHIN         # 144.0
HIP_Y = KNEE_Y - THIGH          # 121.0
TORSO_H = 51.5
SH_Y = HIP_Y - TORSO_H          # 74.0
NECK = 3.0
HEAD_RY = 21.5
HEAD_RX = 20.5
HEAD_CY = SH_Y - NECK - HEAD_RY  # 48.0 -> skull top 25, hair tips ~21

UPARM = 17.5
FOREARM = 16.0

SWING = math.radians(34.0)      # thigh swing amplitude
KFLEX = math.radians(56.0)      # knee bend through the swing phase
ASWING = math.radians(32.0)     # free arm
AFLEX = math.radians(38.0)
ARM_OUT = math.radians(19.0)    # arms hang clear of the coat silhouette

FRONT_HIP_OFF, SIDE_HIP_OFF = 12.0, 5.5
FRONT_SH_OFF, SIDE_SH_OFF = 25.0, 10.0
FRONT_SH_HALF, SIDE_SH_HALF = 24.0, 17.0
FRONT_WAIST_HALF, SIDE_WAIST_HALF = 19.5, 14.5
FRONT_HEM_HALF, SIDE_HEM_HALF = 23.0, 17.5


# ------------------------------------------------------------ shape model --
# A "shape" is a tuple understood by _render():
#   ('poly',  [(x, y), ...])
#   ('ell',   (x0, y0, x1, y1))
#   ('rrect', (x0, y0, x1, y1), radius)
#   ('line',  [(x, y), ...], width)          -- round caps, curved joints
# A silhouette is a list of shapes unioned together, so a whole limb chain gets
# a single continuous outline instead of an ink seam at every joint.

def _render(d, shapes, off, fill, grow=0.0):
    ox, oy = off
    for sh in shapes:
        k = sh[0]
        if k == 'poly':
            pts = [((x - ox) * SS, (y - oy) * SS) for x, y in sh[1]]
            if grow > 0:
                d.polygon(pts, fill=fill, outline=fill, width=max(1, int(round(grow * 2 * SS))))
            else:
                d.polygon(pts, fill=fill)
        elif k == 'ell':
            x0, y0, x1, y1 = sh[1]
            d.ellipse([(x0 - ox - grow) * SS, (y0 - oy - grow) * SS,
                       (x1 - ox + grow) * SS, (y1 - oy + grow) * SS], fill=fill)
        elif k == 'rrect':
            x0, y0, x1, y1 = sh[1]
            r = max(0.0, sh[2] + grow)
            d.rounded_rectangle([(x0 - ox - grow) * SS, (y0 - oy - grow) * SS,
                                 (x1 - ox + grow) * SS, (y1 - oy + grow) * SS],
                                radius=r * SS, fill=fill)
        elif k == 'line':
            pts = [((x - ox) * SS, (y - oy) * SS) for x, y in sh[1]]
            w = max(1, int(round((sh[2] + grow * 2) * SS)))
            if len(pts) > 1:
                d.line(pts, fill=fill, width=w, joint='curve')
            r = w / 2.0
            for px, py in (pts[0], pts[-1]):
                d.ellipse([px - r, py - r, px + r, py + r], fill=fill)


def shapes_bbox(shapes, pad=0.0):
    xs, ys = [], []
    for sh in shapes:
        k = sh[0]
        if k == 'poly':
            pts, e = sh[1], 0.0
        elif k in ('ell', 'rrect'):
            x0, y0, x1, y1 = sh[1]
            pts, e = [(x0, y0), (x1, y1)], 0.0
        else:
            pts, e = sh[1], sh[2] / 2.0
        for x, y in pts:
            xs += [x - e, x + e]
            ys += [y - e, y + e]
    return min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad


def paint(img, sil, mat, layers=(), ow=OW, ink=None):
    """The one drawing primitive used for every material on the sprite.

    Strokes an `ow`-wide ink outline around `sil`, floods `sil` with mat.base,
    then paints `layers` -- ordered (key, shapes) pairs where key is 'sh',
    'hi', 'base', 'ink' or a literal RGBA -- clipped inside the silhouette.
    """
    if not sil:
        return
    x0, y0, x1, y1 = shapes_bbox(sil, ow + 1.5)
    X0 = max(0, int(math.floor(x0 * SS)))
    Y0 = max(0, int(math.floor(y0 * SS)))
    X1 = min(CELL * SS, int(math.ceil(x1 * SS)))
    Y1 = min(CELL * SS, int(math.ceil(y1 * SS)))
    if X1 <= X0 or Y1 <= Y0:
        return
    if ow > 0:
        _render(ImageDraw.Draw(img), sil, (0.0, 0.0), ink or mat.ink, grow=ow)
    off = (X0 / SS, Y0 / SS)
    W, H = X1 - X0, Y1 - Y0
    tile = Image.new('RGBA', (W, H), mat.base)
    td = ImageDraw.Draw(tile)
    for key, shapes in layers:
        if not shapes:
            continue
        if key == 'sh':
            col = mat.sh
        elif key == 'hi':
            col = mat.hi
        elif key == 'base':
            col = mat.base
        elif key == 'ink':
            col = mat.ink
        else:
            col = key
        _render(td, shapes, off, col)
    tile.putalpha(255)          # ImageDraw replaces rather than blends
    mask = Image.new('L', (W, H), 0)
    _render(ImageDraw.Draw(mask), sil, off, 255)
    img.paste(tile, (X0, Y0), mask)


def shift(shapes, dx, dy):
    out = []
    for sh in shapes:
        k = sh[0]
        if k == 'poly':
            out.append(('poly', [(x + dx, y + dy) for x, y in sh[1]]))
        elif k == 'ell':
            x0, y0, x1, y1 = sh[1]
            out.append(('ell', (x0 + dx, y0 + dy, x1 + dx, y1 + dy)))
        elif k == 'rrect':
            x0, y0, x1, y1 = sh[1]
            out.append(('rrect', (x0 + dx, y0 + dy, x1 + dx, y1 + dy), sh[2]))
        else:
            out.append(('line', [(x + dx, y + dy) for x, y in sh[1]], sh[2]))
    return out


def rim(sil, dx=2.4, dy=1.8):
    """Highlight layers that leave a lit rim along the upper-left silhouette."""
    return [('hi', sil), ('base', shift(sil, dx, dy))]


# --------------------------------------------------------- small geometry --
def lerp(a, b, t):
    return a + (b - a) * t


def clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v


def circ(p, r):
    return ('ell', (p[0] - r, p[1] - r, p[0] + r, p[1] + r))


def mid(p, q, t=0.5):
    return (lerp(p[0], q[0], t), lerp(p[1], q[1], t))


def quad(p, q, wp, wq):
    dx, dy = q[0] - p[0], q[1] - p[1]
    n = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / n, dx / n
    return [(p[0] + nx * wp / 2, p[1] + ny * wp / 2), (q[0] + nx * wq / 2, q[1] + ny * wq / 2),
            (q[0] - nx * wq / 2, q[1] - ny * wq / 2), (p[0] - nx * wp / 2, p[1] - ny * wp / 2)]


def limb(p, q, wp, wq):
    """A tapered capsule: quad body with round joints at both ends."""
    return [('poly', quad(p, q, wp, wq)), circ(p, wp / 2), circ(q, wq / 2)]


def rot(p, c, a):
    s, co = math.sin(a), math.cos(a)
    dx, dy = p[0] - c[0], p[1] - c[1]
    return (c[0] + dx * co - dy * s, c[1] + dx * s + dy * co)


def rot_all(pts, c, a):
    return [rot(p, c, a) for p in pts]


def round_poly(pts, r, seg=5):
    """Round a polygon's corners inward (never grows the outer bounds)."""
    out = []
    m = len(pts)
    for i in range(m):
        a, p, b = pts[(i - 1) % m], pts[i], pts[(i + 1) % m]
        d1 = math.hypot(a[0] - p[0], a[1] - p[1]) or 1.0
        d2 = math.hypot(b[0] - p[0], b[1] - p[1]) or 1.0
        r1, r2 = min(r, d1 * 0.5), min(r, d2 * 0.5)
        t1 = (p[0] + (a[0] - p[0]) / d1 * r1, p[1] + (a[1] - p[1]) / d1 * r1)
        t2 = (p[0] + (b[0] - p[0]) / d2 * r2, p[1] + (b[1] - p[1]) / d2 * r2)
        for k in range(seg + 1):
            t = k / seg
            u = 1.0 - t
            out.append((u * u * t1[0] + 2 * u * t * p[0] + t * t * t2[0],
                        u * u * t1[1] + 2 * u * t * p[1] + t * t * t2[1]))
    return out


def egg(cx, cy, rx, ry, chin=0.78, n=36):
    """Head silhouette: an ellipse whose lower half tapers to a jaw."""
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        sy = math.sin(a)
        taper = 1.0 - (1.0 - chin) * (max(0.0, sy) ** 1.6)
        pts.append((cx + rx * math.cos(a) * taper, cy + ry * sy))
    return pts


def barrel(cx, top, bot, half_top, half_waist, half_hem, lean=0.0, n=12):
    """Rounded torso: shoulders wider than the waist, hem flaring back out."""
    prof = ((0.00, 0.62), (0.07, 0.93), (0.18, 1.00), (0.42, 0.94),
            (0.66, 0.82), (0.84, 0.83), (1.00, 0.88))

    def half_at(t):
        w = lerp(half_top, half_waist, t / 0.52) if t < 0.52 else \
            lerp(half_waist, half_hem, (t - 0.52) / 0.48)
        k = prof[-1][1]
        for i in range(len(prof) - 1):
            if prof[i][0] <= t <= prof[i + 1][0]:
                f = (t - prof[i][0]) / (prof[i + 1][0] - prof[i][0])
                k = lerp(prof[i][1], prof[i + 1][1], f)
                break
        return w * k

    left, right = [], []
    for i in range(n + 1):
        t = i / n
        y = lerp(top, bot, t)
        x = cx + lean * (1.0 - t)
        h = half_at(t)
        left.append((x - h, y))
        right.append((x + h, y))
    return left + right[::-1]


def half_plane(a, b, depth=110.0):
    """Polygon covering everything to the lower-right of the a->b segment."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy) or 1.0
    nx, ny = dy / n, -dx / n
    return ('poly', [a, b, (b[0] + nx * depth, b[1] + ny * depth),
                     (a[0] + nx * depth, a[1] + ny * depth)])


def hashf(*args):
    h = 2166136261
    for a in args:
        h = (h ^ (int(a * 977) & 0xffffffff)) * 16777619 & 0xffffffff
    return ((h >> 9) & 0xffff) / 65535.0


# ------------------------------------------------------------ ribbon bands --
def band_path(origin, angle, length, wave, amp, curl, n=12,
              span=(-0.30, 1.40), hard=None):
    """Centreline of a fluttering ribbon: a curve that turns as it travels.

    The heading is clamped to `span` radians either side of the base angle, and
    optionally to the absolute range `hard`, so a streamer can arc and flutter
    but never loops back across the character's face.
    """
    x, y = origin
    a = angle
    step = length / n
    lo, hi = angle + span[0], angle + span[1]
    if hard is not None:
        lo, hi = max(lo, hard[0]), min(hi, hard[1])
    pts = [(x, y)]
    for i in range(n):
        t = i / n
        a += curl / n + math.radians(amp) * math.cos(wave + 3.4 * t) * 3.0 / n
        a = clamp(a, lo, hi)
        x += step * math.cos(a)
        y += step * math.sin(a)
        pts.append((x, y))
    return pts


def band_edges(pts, w0, w1):
    left, right = [], []
    m = len(pts) - 1
    for i, (x, y) in enumerate(pts):
        if i == 0:
            dx, dy = pts[1][0] - x, pts[1][1] - y
        elif i == m:
            dx, dy = x - pts[m - 1][0], y - pts[m - 1][1]
        else:
            dx, dy = pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1]
        n = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / n, dx / n
        w = lerp(w0, w1, i / m) / 2.0
        left.append((x + nx * w, y + ny * w))
        right.append((x - nx * w, y - ny * w))
    return left, right


def band_slice(left, right, f0, f1):
    """Polygon between two normal-offset fractions across the band (0..1)."""
    a = [(lerp(r[0], l[0], f0), lerp(r[1], l[1], f0)) for l, r in zip(left, right)]
    b = [(lerp(r[0], l[0], f1), lerp(r[1], l[1], f1)) for l, r in zip(left, right)]
    return a + b[::-1]


def draw_ribbon(img, origin, angle, length, wave, amp, curl, mat, w0=5.4, w1=1.6,
                ow=0.95, hard=None):
    pts = band_path(origin, angle, length, wave, amp, curl, hard=hard)
    left, right = band_edges(pts, w0, w1)
    sil = [('poly', band_slice(left, right, 0.0, 1.0))]
    layers = [('sh', [('poly', band_slice(left, right, 0.0, 0.36))]),
              ('hi', [('poly', band_slice(left, right, 0.68, 1.0))])]
    paint(img, sil, mat, layers, ow=ow)


# ------------------------------------------------------------------- pose --
def leg_chain(hip, phase, sx, sy):
    th = SWING * math.sin(phase)
    bend = KFLEX * max(0.0, math.sin(phase + 1.9)) ** 1.25
    kx = hip[0] + THIGH * math.sin(th) * sx
    ky = hip[1] + THIGH * math.cos(th) + THIGH * math.sin(th) * sy * 0.32
    a2 = th - bend
    ax = kx + SHIN * math.sin(a2) * sx
    ay = ky + SHIN * math.cos(a2) + SHIN * math.sin(a2) * sy * 0.32
    return (kx, ky), (ax, ay)


def arm_chain(sh, phase, sx, sy, out_sign):
    """Swing along the travel axis plus a constant outward splay in screen x."""
    th = ASWING * math.sin(phase)
    bend = AFLEX * (0.30 + 0.70 * max(0.0, math.sin(phase + 1.2)))
    splay = ARM_OUT * out_sign * (1.0 - abs(sx) * 0.55)
    cross = 0.30 * (1.0 - abs(sx))          # front/back: the swing reads sideways
    ex = sh[0] + UPARM * (math.sin(th) * (sx + cross) + math.sin(splay))
    ey = sh[1] + UPARM * math.cos(th) * math.cos(splay) + UPARM * math.sin(th) * sy * 0.32
    a2 = th + bend
    hx = ex + FOREARM * (math.sin(a2) * (sx + cross) + math.sin(splay * 0.55))
    hy = ey + FOREARM * math.cos(a2) * math.cos(splay) + FOREARM * math.sin(a2) * sy * 0.32
    return (ex, ey), (hx, hy)


def ik2(root, target, l1, l2, bend):
    dx, dy = target[0] - root[0], target[1] - root[1]
    d = clamp(math.hypot(dx, dy), abs(l1 - l2) + 0.8, (l1 + l2) * 0.99)
    a = math.atan2(dy, dx)
    c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1.0, 1.0)
    ang = a + bend * math.acos(c)
    return (root[0] + l1 * math.cos(ang), root[1] + l1 * math.sin(ang))


def body_shift(phase, sx, sy):
    a = leg_chain((0.0, HIP_Y), phase, sx, sy)[1][1]
    b = leg_chain((0.0, HIP_Y), phase + math.pi, sx, sy)[1][1]
    return ANKLE_Y - max(a, b)


def facing_category(fx, fy):
    if fx == 0:
        return 'front' if fy > 0 else 'back'
    if fy == 0:
        return 'side'
    return 'diag_front' if fy > 0 else 'diag_back'


# ------------------------------------------------------------- body parts --
def draw_boot(img, ankle, sx, tilt, side_amt, far):
    mat = BOOT_D if far else BOOT
    length = 18.0 + 7.0 * side_amt
    heel = 7.0 if sx >= 0 else length - 7.0
    x0 = ankle[0] - heel
    top = ankle[1] - 5.0
    bot = ankle[1] + BOOT_H
    corners = [(x0 + 2.0, top), (x0 + length - 1.5, top), (x0 + length, bot), (x0, bot)]
    if abs(tilt) > 0.004:
        corners = rot_all(corners, ankle, tilt)
        low = max(p[1] for p in corners)
        if low > SOLE - OW:
            dy = low - (SOLE - OW)
            corners = [(x, y - dy) for x, y in corners]
    a, b, c, dd = corners
    sil = [('poly', round_poly([a, b, c, dd], 4.2))]
    toe_f = 0.80 if sx >= 0 else 0.20
    toe_t = mid(a, b, toe_f)
    toe_b = mid(dd, c, toe_f)
    layers = [
        ('sh', [half_plane(mid(a, b, 0.42), mid(dd, c, 0.34))]),
        ('sh', [('poly', [a, b, mid(b, c, 0.30), mid(a, dd, 0.30)])]),
        ('hi', [('line', [mid(dd, c, 0.03), mid(dd, c, 0.97)], 2.6)]),
        ('ink', [('line', [(mid(dd, c, 0.03)[0], mid(dd, c, 0.03)[1] - 2.6),
                           (mid(dd, c, 0.97)[0], mid(dd, c, 0.97)[1] - 2.6)], 1.3)]),
        ('hi', [('line', [mid(toe_t, toe_b, 0.28), mid(toe_t, toe_b, 0.62)], 2.4)]),
        ('ink', [('line', [mid(a, b, 0.06), mid(a, b, 0.94)], 1.4)]),
        ('hi', [('line', [(a[0] + 1.2, a[1] + 2.2), (dd[0] + 1.0, dd[1] - 3.0)], 1.5)]),
    ]
    paint(img, sil, mat, layers)


def draw_leg(img, hip, knee, ankle, mat, inner_sign, side_amt):
    w_hip, w_knee, w_ank = 22.5, 19.0, 14.5
    chain = limb(hip, knee, w_hip, w_knee) + limb(knee, ankle, w_knee, w_ank)
    sil = list(chain)
    kx, ky = knee
    folds = [
        ('line', [(kx - 6.0, ky - 6.5), (kx + 1.5, ky - 4.4)], 1.6),
        ('line', [(kx - 4.5, ky + 3.6), (kx + 3.0, ky + 5.2)], 1.4),
        ('line', [(hip[0] - 4.0, hip[1] + 10.0), (hip[0] + 3.0, hip[1] + 13.0)], 1.6),
    ]
    gather = [('line', [(ankle[0] - w_ank * 0.62, ankle[1] - 5.2),
                        (ankle[0] + w_ank * 0.62, ankle[1] - 4.2)], 1.9),
              ('line', [(ankle[0] - w_ank * 0.58, ankle[1] - 1.6),
                        (ankle[0] + w_ank * 0.58, ankle[1] - 0.9)], 1.6)]
    layers = [('sh', shift(chain, inner_sign * w_hip * 0.40, 1.6))]
    layers += rim(chain, 3.0, 1.6)
    layers += [('sh', folds), ('sh', gather)]
    layers += [('hi', [('line', [(lerp(hip[0], kx, 0.30) - w_hip * 0.26, lerp(hip[1], ky, 0.30)),
                                 (lerp(kx, ankle[0], 0.42) - w_knee * 0.24,
                                  lerp(ky, ankle[1], 0.42))], 1.8)])]
    paint(img, sil, mat, layers)


def draw_sleeve(img, sh, elbow, hand, mat, near):
    w0, w1, w2 = (15.5, 13.0, 11.0) if near else (14.0, 11.5, 9.8)
    chain = limb(sh, elbow, w0, w1) + limb(elbow, hand, w1, w2)
    ex, ey = elbow
    folds = [
        ('line', [(ex - 4.6, ey - 3.6), (ex + 3.6, ey - 1.8)], 1.6),
        ('line', [(ex - 4.0, ey + 1.6), (ex + 3.4, ey + 3.0)], 1.5),
        ('line', [(lerp(sh[0], ex, 0.40) - 3.4, lerp(sh[1], ey, 0.40)),
                  (lerp(sh[0], ex, 0.60) + 2.6, lerp(sh[1], ey, 0.60))], 1.4),
    ]
    layers = [('sh', shift(chain, 3.4, 2.0))]
    layers += rim(chain, 2.8, 1.7)
    layers += [('sh', folds)]
    c0 = (lerp(ex, hand[0], 0.74), lerp(ey, hand[1], 0.74))
    c1 = (lerp(ex, hand[0], 1.02), lerp(ey, hand[1], 1.02))
    layers += [('ink', [('line', [c0, c1], w2 + 1.4)]),
               ('hi', [('line', [c0, mid(c0, c1)], w2 * 0.72)]),
               ('sh', [('line', [mid(c0, c1, 0.45), c1], w2 * 0.6)])]
    paint(img, list(chain), mat, layers)


def draw_hand(img, p, mat, r=5.0, grip=False):
    sil = [circ(p, r), ('ell', (p[0] - r * 0.92, p[1] - r * 0.30, p[0] + r * 0.92, p[1] + r * 1.05))]
    layers = [('sh', [circ((p[0] + r * 0.45, p[1] + r * 0.42), r * 0.85)])]
    layers += rim(sil, 1.8, 1.3)
    if grip:
        layers += [('ink', [('line', [(p[0] - r * 0.85, p[1] - r * 0.20),
                                      (p[0] + r * 0.85, p[1] - r * 0.20)], 1.0)]),
                   ('ink', [('line', [(p[0] - r * 0.85, p[1] + r * 0.45),
                                      (p[0] + r * 0.85, p[1] + r * 0.45)], 1.0)]),
                   ('hi', [('line', [(p[0] - r * 0.8, p[1] - r * 0.62),
                                     (p[0] + r * 0.5, p[1] - r * 0.72)], 1.2)])]
    paint(img, sil, mat, layers, ow=1.25)


def draw_neck(img, cx, sh_y):
    """Short neck column, drawn before the coat so the collar sits over it."""
    paint(img, [('rrect', (cx - 6.3, sh_y - 12.5, cx + 6.3, sh_y + 3.0), 3.2)], SKIN_D,
          [('sh', [half_plane((cx + 0.5, sh_y - 13.0), (cx + 2.5, sh_y + 4.0))]),
           ('sh', [('ell', (cx - 6.5, sh_y - 14.0, cx + 6.5, sh_y - 7.0))])], ow=1.4)


def draw_shirt(img, sh_y, hip_y, half_sh, half_waist, lean):
    sil = [('poly', barrel(CX, sh_y - 2.0, hip_y + 3.0, half_sh * 0.84,
                           half_waist * 0.92, half_waist * 0.96, lean))]
    layers = [('sh', [half_plane((CX + 3.0, sh_y - 6.0), (CX + 8.0, hip_y + 8.0))]),
              # the coat throws a soft shadow onto the shirt down both edges
              ('sh', [('line', [(CX - half_waist * 0.62, sh_y + 4.0),
                                (CX - half_waist * 0.34, hip_y - 2.0)], 5.0)]),
              ('sh', [('line', [(CX + half_waist * 0.62, sh_y + 4.0),
                                (CX + half_waist * 0.34, hip_y - 2.0)], 5.0)]),
              ('sh', [('line', [(CX - 6.0, sh_y + 5.0), (CX + 6.0, sh_y + 6.5)], 2.6)]),
              # placket seam
              ('sh', [('line', [(CX + 0.6, sh_y + 8.0), (CX + 0.6, hip_y - 4.0)], 1.2)])]
    layers += rim(sil, 3.2, 2.2)
    paint(img, sil, SHIRT, layers)


def draw_jacket(img, sh_y, hip_y, half_sh, half_waist, half_hem, lean, cat, sx, side_amt):
    top = sh_y - 3.0
    bot = hip_y + 8.0
    full = barrel(CX, top, bot, half_sh, half_waist, half_hem, lean)
    closed = cat in ('back', 'diag_back') or side_amt > 0.85

    if closed:
        sil = [('poly', full)]
        layers = [('sh', [half_plane((CX + 1.0, top - 4.0), (CX + 6.0, bot + 4.0))])]
        layers += rim(sil, 3.4, 2.4)
        if cat in ('back', 'diag_back'):
            layers += [('sh', [('line', [(CX + lean * 0.6, top + 5.0), (CX, bot - 2.0)], 1.8)]),
                       ('sh', [('line', [(CX - half_sh * 0.86, top + 11.0),
                                         (CX + half_sh * 0.86, top + 11.0)], 1.8)]),
                       ('hi', [('line', [(CX - half_sh * 0.86, top + 9.2),
                                         (CX + half_sh * 0.20, top + 9.2)], 1.4)])]
        else:
            edge = CX + sx * half_waist * 0.86
            layers += [(SHIRT.base, [('poly', [(edge - sx * 0.5, top + 7.5),
                                               (edge + sx * 3.6, top + 9.0),
                                               (edge + sx * 2.0, bot - 16.0),
                                               (edge - sx * 0.4, bot - 15.0)])]),
                       (SHIRT.sh, [('line', [(edge - sx * 0.5, top + 8.0),
                                             (edge - sx * 0.4, bot - 15.0)], 1.4)])]
        layers += [('sh', [('line', [(CX - half_hem - 2, bot - 5.0),
                                     (CX + half_hem + 2, bot - 4.0)], 4.0)])]
        paint(img, sil, JACKET, layers)
        draw_collar(img, sh_y, half_sh, lean, closed=True)
        return

    # open front: two panels flanking a cream wedge
    n = len(full) // 2
    left_edge = full[:n]
    right_edge = full[n:][::-1]
    mid_x = CX + lean * 0.5 + sx * 3.5
    gaps = []
    for i in range(n):
        t = i / (n - 1)
        # wide at the collar, closing to nothing by the sash
        g = 8.4 * max(0.0, 1.0 - (t / 0.58) ** 1.9) + 0.9
        gaps.append(g * lerp(1.0, 0.55, side_amt))
    inner_l = [(mid_x - gaps[i], left_edge[i][1]) for i in range(n)]
    inner_r = [(mid_x + gaps[i], right_edge[i][1]) for i in range(n)]
    panel_l = left_edge + inner_l[::-1]
    panel_r = right_edge + inner_r[::-1]
    sil = [('poly', panel_l), ('poly', panel_r)]
    layers = [('sh', [half_plane((CX + 1.0, top - 4.0), (CX + 7.0, bot + 4.0))])]
    layers += rim([('poly', panel_l)], 3.2, 2.2)
    # shaded inner edge -- the lining rolling under, on both panels
    layers += [('sh', [('line', inner_l[:9], 3.6)]), ('sh', [('line', inner_r[:9], 3.6)])]
    layers += [('ink', [('line', inner_l[:9], 1.4)]), ('ink', [('line', inner_r[:9], 1.4)])]
    # sleeve-seam and body folds
    layers += [('sh', [('line', [(CX - half_sh * 0.76, sh_y + 11.0),
                                 (CX - half_waist * 0.62, hip_y - 10.0)], 1.7)]),
               ('sh', [('line', [(CX + half_sh * 0.74, sh_y + 13.0),
                                 (CX + half_waist * 0.66, hip_y - 8.0)], 1.7)]),
               ('sh', [('line', [(CX - half_waist * 0.9, hip_y + 1.0),
                                 (CX - half_waist * 0.3, hip_y + 6.0)], 1.6)])]
    # hem shadow across the coat skirt
    layers += [('sh', [('line', [(CX - half_hem - 2, bot - 5.0),
                                 (CX + half_hem + 2, bot - 4.0)], 4.2)])]
    paint(img, sil, JACKET, layers)

    # lapels folding outward at the chest
    for sign, inner in ((-1, inner_l), (1, inner_r)):
        a = inner[0]
        b = (a[0] + sign * 8.5, a[1] + 2.0)
        c = (inner[4][0] + sign * 2.0, inner[4][1] + 1.0)
        paint(img, [('poly', [a, b, c])], LINING,
              [('sh', [('poly', [(a[0], a[1] + 2.5), b, c])]),
               ('hi', [('line', [a, b], 1.7)])], ow=1.15)
    draw_collar(img, sh_y, half_sh, lean, closed=False)


def draw_collar(img, sh_y, half_sh, lean, closed):
    y = sh_y - 1.0
    w = half_sh * (0.60 if closed else 0.52)
    pts = [(CX - w + lean, y - 5.0), (CX + w + lean, y - 5.0),
           (CX + w * 1.30 + lean, y + 4.0), (CX - w * 1.30 + lean, y + 4.0)]
    sil = [('poly', round_poly(pts, 2.4))]
    layers = [('sh', [half_plane((CX + lean, y - 7.0), (CX + lean + 2.5, y + 7.0))]),
              ('hi', [('line', [(CX - w * 1.15 + lean, y - 3.6),
                                (CX + w * 0.25 + lean, y - 4.4)], 1.9)]),
              ('sh', [('line', [(CX - w * 0.9 + lean, y + 2.4),
                                (CX + w * 0.9 + lean, y + 2.4)], 1.5)])]
    paint(img, sil, JACKET_D, layers, ow=1.35)


def draw_sash(img, hip_y, half_waist, half_hem, cat, sx, lean, frame):
    y0 = hip_y - 12.0
    y1 = hip_y - 1.5
    w = lerp(half_waist, half_hem, 0.28) + 0.5
    top_l = (CX - w + lean * 0.3, y0 + 1.0)
    top_r = (CX + w + lean * 0.3, y0 - 0.6)
    bot_l = (CX - w - 0.8, y1 + 0.6)
    bot_r = (CX + w + 0.8, y1 - 0.8)
    sil = [('poly', [top_l, top_r, bot_r, bot_l])]
    nb = len(SASH_BANDS)
    layers = []
    for i, mat in enumerate(SASH_BANDS):
        f0, f1 = i / nb, (i + 1) / nb
        a = mid(top_l, bot_l, f0)
        b = mid(top_r, bot_r, f0)
        c = mid(top_r, bot_r, f1)
        d = mid(top_l, bot_l, f1)
        layers.append((mat.base, [('poly', [a, b, c, d])]))
        # form shadow on the right third of every band, then the weave shading
        layers.append((mat.sh, [('poly', [mid(a, b, 0.62), b, c, mid(d, c, 0.62)])]))
        layers.append((mat.ink, [('line', [(d[0], d[1] - 0.6), (c[0], c[1] - 0.6)], 1.0)]))
        layers.append((mat.hi, [('line', [(a[0] + 1.5, a[1] + 1.2),
                                          (lerp(a[0], b[0], 0.45), a[1] + 1.4)], 1.2)]))
    # woven texture: a couple of warp threads
    for f in (0.30, 0.62):
        layers.append((INK, [('line', [(lerp(top_l[0], top_r[0], f), top_l[1] + 1.0),
                                       (lerp(bot_l[0], bot_r[0], f), bot_l[1] - 1.0)], 0.9)]))
    paint(img, sil, PINK, layers, ow=1.5, ink=INK)

    if cat != 'back':
        sway = math.sin(2 * math.pi * frame / N) * 1.8
        for k, (tx, mat) in enumerate(((CX - w * 0.70, GOLD), (CX - w * 0.42, PINK),
                                       (CX - w * 0.16, BLUE))):
            top = (tx, y1 - 1.0)
            end = (tx + sway * (0.5 + 0.35 * k), y1 + 5.0 + (k % 2) * 2.5)
            paint(img, [('line', [top, end], 1.9)], mat,
                  [('hi', [('line', [(top[0] - 0.7, top[1]), (end[0] - 0.7, end[1])], 0.8)])],
                  ow=0.8)
            paint(img, [circ(end, 1.9)], mat,
                  [('sh', [circ((end[0] + 0.8, end[1] + 0.8), 1.5)]),
                   ('hi', [circ((end[0] - 0.7, end[1] - 0.7), 0.8)])], ow=0.8)


def draw_fringe(img, sh_pos, sign, frame, seed):
    """Short ribbon tufts on a shoulder, each with its own highlight."""
    for j, mat in enumerate(RIBBONS):
        t = j / 3.0
        ox = sh_pos[0] + sign * (1.0 + t * 7.5)
        oy = sh_pos[1] - 2.5 + t * 2.4
        flut = math.sin(2 * math.pi * frame / N + j * 1.7 + seed)
        ang = math.radians(92.0) + math.radians(12.0) * flut * sign
        draw_ribbon(img, (ox, oy), ang, 10.0 + (j % 2) * 3.0,
                    2 * math.pi * frame / N + j, 7.0,
                    math.radians(30.0) * flut * sign, mat,
                    w0=4.4, w1=1.8, ow=0.8)


# ------------------------------------------------------------------- head --
def draw_head(img, cx, cy, cat, sx, frame, mode):
    rx, ry = HEAD_RX, HEAD_RY
    back = cat in ('back', 'diag_back')
    turn = 0.0
    if cat == 'side':
        turn = 1.0 if sx >= 0 else -1.0
    elif cat == 'diag_front':
        turn = 0.5 if sx >= 0 else -0.5
    elif cat == 'diag_back':
        turn = 0.45 if sx >= 0 else -0.45
    fcx = cx + turn * 4.0

    sil = [('poly', egg(cx, cy, rx, ry))]

    if not back:
        # ears
        for esign in ((-1, 1) if abs(turn) < 0.9 else (-turn,)):
            ex = cx + esign * (rx - 2.2)
            paint(img, [('ell', (ex - 3.6, cy - 1.0, ex + 3.6, cy + 7.5))], SKIN_D,
                  [('sh', [('ell', (ex - 1.2, cy + 1.2, ex + 3.2, cy + 6.6))]),
                   ('hi', [('line', [(ex - 1.8, cy + 0.6), (ex - 2.1, cy + 4.6)], 1.4)])], ow=1.25)
        layers = [('sh', [half_plane((fcx + 2.5, cy - ry - 3.0), (fcx + 9.0, cy + ry + 3.0))]),
                  ('sh', [('ell', (fcx - 11.0, cy + 13.5, fcx + 11.0, cy + ry + 5.0))])]
        layers += rim(sil, 3.6, 2.6)
        layers += [('hi', [('ell', (cx - rx * 0.86, cy - ry * 0.70, cx - rx * 0.04,
                                    cy + ry * 0.22))])]
        paint(img, sil, SKIN, layers)
        draw_face(img, fcx, cy, rx, ry, turn, frame, mode)
        draw_hair_front(img, cx, cy, rx, ry, turn)
    else:
        layers = [('sh', [half_plane((cx + 2.0, cy - ry - 3.0), (cx + 8.0, cy + ry + 3.0))])]
        layers += rim(sil, 3.8, 2.8)
        paint(img, sil, HAIR, layers)
        draw_hair_back(img, cx, cy, rx, ry)


def draw_face(img, fcx, cy, rx, ry, turn, frame, mode):
    profile = abs(turn) > 0.9
    d = 1.0 if turn >= 0 else -1.0
    eye_y = cy + 0.4
    brow_y = cy - 6.1

    if profile:
        eyes = [(fcx + d * 5.6, 0.90)]
    else:
        eyes = [(fcx - d * 7.5 + d * abs(turn) * 3.4, 1.0 - abs(turn) * 0.40),
                (fcx + d * 7.5 + d * abs(turn) * 2.2, 1.0)]

    # soft brow-ridge shading: darker just under the hairline, lighter cheeks
    paint(img, [('ell', (fcx - 13.4, cy - 8.6, fcx + 13.4, cy - 1.8))], SKIN,
          [('sh', [('ell', (fcx - 13.4, cy - 8.6, fcx + 13.4, cy - 4.5))])], ow=0.0)

    # nose: a shadow wedge down its right side, a lit ridge on the left, and
    # a dark base line with nostrils -- three tones, so it reads at any size
    nx = fcx + d * (1.1 + abs(turn) * 3.8)
    ny = cy + 7.5
    if profile:
        paint(img, [('poly', [(nx - d * 2.4, ny - 5.6), (nx + d * 6.6, ny + 1.2),
                              (nx + d * 2.0, ny + 3.4), (nx - d * 2.8, ny + 2.6)])], SKIN,
              [('sh', [('poly', [(nx + d * 0.4, ny - 2.0), (nx + d * 6.8, ny + 1.4),
                                 (nx + d * 2.0, ny + 3.6), (nx + d * 0.2, ny + 2.0)])]),
               ('hi', [('line', [(nx - d * 1.4, ny - 4.6), (nx + d * 3.0, ny + 0.4)], 1.6)])],
              ow=1.0)
        paint(img, [circ((nx + d * 3.4, ny + 2.0), 1.0)], FLAT(SKIN_D.sh), [], ow=0.0)
    else:
        paint(img, [('poly', [(nx - d * 0.4, ny - 6.2), (nx + d * 2.2, ny + 0.6),
                              (nx + d * 3.6, ny + 3.2), (nx - d * 1.4, ny + 3.2),
                              (nx - d * 1.2, ny - 6.0)])], FLAT(SKIN.sh), [], ow=0.0)
        paint(img, [('poly', [(nx - d * 2.4, ny - 5.6), (nx - d * 1.2, ny - 5.6),
                              (nx - d * 2.0, ny + 1.4), (nx - d * 3.2, ny + 1.0)])],
              FLAT(SKIN.hi), [], ow=0.0)
        paint(img, [circ((nx + d * 0.4, ny + 1.9), 1.9)], FLAT(SKIN.base), [], ow=0.0)
        paint(img, [circ((nx - d * 0.5, ny + 1.2), 1.1)], FLAT(SKIN.hi), [], ow=0.0)
        paint(img, [('line', [(nx - d * 2.6, ny + 3.3), (nx + d * 3.2, ny + 3.3)], 1.5)],
              FLAT(SKIN_D.sh), [], ow=0.0)
        for s in (-1, 1):
            paint(img, [circ((nx + d * s * 2.1 + d * 0.4, ny + 2.4), 0.9)],
                  FLAT(SKIN.ink), [], ow=0.0)

    # eyes
    for ex, sq in eyes:
        srx, sry = 3.05 * sq, 2.65
        paint(img, [('ell', (ex - srx, eye_y - sry, ex + srx, eye_y + sry))],
              Mat(INK, EYE_SH, EYE_WHITE, EYE_WHITE),
              [('sh', [('ell', (ex - srx, eye_y - sry, ex + srx, eye_y - sry + 2.0))])], ow=0.85)
        irx = ex + d * 0.7 * sq
        ir = 2.2
        paint(img, [('ell', (irx - ir * sq, eye_y - ir + 0.3, irx + ir * sq, eye_y + ir + 0.3))],
              Mat(INK, (44, 28, 22, 255), IRIS, (132, 96, 64, 255)),
              [('sh', [('ell', (irx - ir * sq, eye_y - ir + 0.3, irx + ir * sq, eye_y))]),
               (PUPIL, [('ell', (irx - 1.1 * sq, eye_y - 0.75, irx + 1.1 * sq, eye_y + 1.4))]),
               (GLINT, [('ell', (irx - 1.55 * sq, eye_y - 1.55, irx - 0.5 * sq, eye_y - 0.5))])],
              ow=0.0)
        # upper lash line, then a soft lower lid for form
        paint(img, [('line', [(ex - srx * 1.02, eye_y - sry * 0.40),
                              (ex - srx * 0.10, eye_y - sry * 1.16),
                              (ex + srx * 0.96, eye_y - sry * 0.30)], 1.6)],
              Mat(INK, INK, INK, INK), [], ow=0.0)

    # eyebrows -- short, high and lifted at the outer end: cheerful, never a
    # scowl, so the inner ends stay high and far apart
    for ex, sq in eyes:
        out = d if len(eyes) == 1 else (1.0 if ex > fcx else -1.0)
        wi, wo = 3.2 * sq, 4.7 * sq
        inner = (ex - out * wi, brow_y - 1.5)
        peak = (ex + out * 1.0, brow_y - 2.8)
        outer = (ex + out * wo, brow_y - 0.4)
        paint(img, [('line', [inner, peak, outer], 2.0)], HAIR,
              [('hi', [('line', [(inner[0], inner[1] - 0.8), (peak[0], peak[1] - 0.8)], 0.9)])],
              ow=0.0)

    # mouth -- open and singing
    my = cy + 13.6
    mx = fcx + d * (0.8 + abs(turn) * 3.4)
    mw = 5.9 - abs(turn) * 1.9
    mh = 3.7 + (0.7 if (mode == 'idle' and frame % 4 < 2) or (mode != 'idle' and frame % 2 == 0) else 0.0)
    # upper lip bows UP at the corners (a smile); lower lip is a deep arc
    top = [(mx - mw, my - 0.2), (mx - mw * 0.55, my - 2.1), (mx, my - 2.5),
           (mx + mw * 0.55, my - 2.1), (mx + mw, my - 0.2)]
    lower = [(mx + mw * math.cos(a), my - 0.2 + (mh + 0.2) * math.sin(a))
             for a in [math.radians(v) for v in range(0, 181, 20)]]
    mouth_pts = top + lower
    paint(img, [('poly', mouth_pts)],
          Mat(INK, (62, 20, 26, 255), MOUTH_IN, (128, 52, 56, 255)),
          [('sh', [('poly', [(mx - mw, my - 3.0), (mx + mw, my - 3.0),
                             (mx + mw, my + 0.6), (mx - mw, my + 0.6)])]),
           (TEETH, [('poly', top + [(mx + mw * 0.78, my - 0.1), (mx, my + 0.3),
                                    (mx - mw * 0.78, my - 0.1)])]),
           (TONGUE, [('ell', (mx - mw * 0.52, my + mh * 0.35, mx + mw * 0.52, my + mh * 1.25))])],
          ow=1.2)
    for s in (-1, 1):
        paint(img, [('line', [(mx + s * (mw + 2.0), my - 2.4),
                              (mx + s * (mw + 0.2), my - 0.4)], 1.4)], SKIN_D, [], ow=0.0)
    paint(img, [('line', [(fcx - 4.8, cy + ry - 3.6), (fcx + 5.2, cy + ry - 4.0)], 1.9)],
          SKIN_D, [], ow=0.0)


def draw_hair_front(img, cx, cy, rx, ry, turn):
    """Hairline shape with a fringe and sideburns -- not a cap."""
    d = 1.0 if turn >= 0 else -1.0
    t = abs(turn)
    left = cx - rx - 1.6
    right = cx + rx + 1.6
    dip = cy - ry * 0.46
    peak = cy - ry * 0.68
    fx = cx + d * t * 5.0
    outline = [(left, cy - ry * 0.02), (left - 0.4, cy - ry * 0.60),
               (cx - rx * 0.70, cy - ry * 0.92), (cx - rx * 0.16, cy - ry * 1.06),
               (cx + rx * 0.60, cy - ry * 0.94), (right + 0.4, cy - ry * 0.58),
               (right, cy - ry * 0.02),
               (cx + rx * 0.88, dip - 2.2), (cx + rx * 0.44, dip + 1.4),
               (fx + rx * 0.12, peak + 1.4), (fx - rx * 0.38, dip + 2.0),
               (cx - rx * 0.82, dip - 1.0), (cx - rx * 0.98, cy - ry * 0.30)]
    sil = [('poly', outline)]
    for s in (-1, 1):
        bx = cx + s * (rx - 1.4)
        sil.append(('poly', [(bx - s * 3.6, cy - ry * 0.44), (bx + s * 1.6, cy - ry * 0.52),
                             (bx + s * 1.2, cy + 3.6), (bx - s * 3.2, cy + 1.4)]))
    layers = [('sh', [half_plane((cx + 2.0, cy - ry - 7.0), (cx + 9.0, cy + 5.0))])]
    layers += rim(sil, 3.2, 2.4)
    for k, (a0, a1, w, key) in enumerate(((-0.76, -0.24, 2.4, 'hi'), (-0.42, 0.10, 1.8, 'hi'),
                                          (0.14, 0.56, 1.6, 'sh'), (0.52, 0.86, 1.5, 'sh'))):
        p0 = (cx + rx * a0 * 0.94, cy - ry * 1.00 + abs(a0) * 4.0)
        p1 = (cx + rx * a1 * 1.02, cy - ry * 0.44)
        layers.append((key, [('line', [p0, (mid(p0, p1)[0] - 2.4, mid(p0, p1)[1]), p1], w)]))
    layers.append(('hi', [('ell', (cx - rx * 0.92, cy - ry * 1.06, cx - rx * 0.04,
                                   cy - ry * 0.62))]))
    layers.append(('sh', [('ell', (cx + rx * 0.30, cy - ry * 0.86, cx + rx * 1.10,
                                   cy - ry * 0.10))]))
    paint(img, sil, HAIR, layers)


def draw_hair_back(img, cx, cy, rx, ry):
    """Back of the head: strand shapes and a nape, no face."""
    sil = [('poly', egg(cx, cy, rx + 1.6, ry + 1.4, chin=0.86))]
    for i in range(5):
        f = (i - 2) / 2.0
        tx = cx + f * rx * 0.74
        sil.append(('poly', [(tx - 3.8, cy + ry * 0.28), (tx + 3.8, cy + ry * 0.28),
                             (tx + 0.6, cy + ry * 1.14 + (i % 2) * 2.4)]))
    layers = [('sh', [half_plane((cx + 2.0, cy - ry - 4.0), (cx + 8.0, cy + ry + 4.0))])]
    layers += rim(sil, 3.8, 2.8)
    for i in range(5):
        f = (i - 2) / 2.0
        p0 = (cx + f * rx * 0.28, cy - ry * 0.90)
        p1 = (cx + f * rx * 1.08, cy + ry * 0.52)
        key = 'hi' if i % 2 == 0 else 'sh'
        layers.append((key, [('line', [p0, (mid(p0, p1)[0] - f * 2.4, mid(p0, p1)[1]), p1],
                              2.2 if i % 2 == 0 else 1.7)]))
    layers.append(('sh', [('ell', (cx - rx * 0.58, cy + ry * 0.56, cx + rx * 0.58,
                                   cy + ry * 1.02))]))
    layers.append(('base', [('ell', (cx - rx * 0.50, cy + ry * 0.50, cx + rx * 0.36,
                                     cy + ry * 0.92))]))
    for f in (-0.55, 0.0, 0.55):
        layers.append(('hi', [('line', [(cx + f * rx * 0.5, cy + ry * 0.40),
                                        (cx + f * rx * 0.7, cy + ry * 0.98)], 1.4)]))
    layers.append(('hi', [('ell', (cx - rx * 0.68, cy - ry * 0.88, cx - rx * 0.04, cy - ry * 0.28))]))
    paint(img, sil, HAIR, layers)
    for s in (-1, 1):
        ex = cx + s * (rx - 0.2)
        paint(img, [('ell', (ex - 2.8, cy + 0.5, ex + 2.8, cy + 6.5))], SKIN_D,
              [('sh', [('ell', (ex - 0.6, cy + 1.8, ex + 2.6, cy + 5.8))])], ow=1.15)


# ------------------------------------------------------------------ staff --
# The grip sits high, near the ribs, so the staff arm keeps a natural bend and
# the pole clears the head on every facing (there is ~75px of clear space to
# either side but only ~20px of headroom).
STAFF_CFG = {
    'front':      dict(gx=28.0, gy=-14.0, lean=6.0, tip_y=32.0, butt=18.0),
    'diag_front': dict(gx=27.0, gy=-14.0, lean=6.0, tip_y=32.0, butt=18.0),
    'side':       dict(gx=25.0, gy=-14.0, lean=5.0, tip_y=33.0, butt=18.0),
    'diag_back':  dict(gx=27.0, gy=-14.0, lean=6.0, tip_y=33.0, butt=18.0),
    'back':       dict(gx=28.0, gy=-14.0, lean=6.0, tip_y=33.0, butt=18.0),
}


def draw_staff(img, tip, butt):
    sil = limb(butt, tip, 5.0, 3.6)
    layers = [('sh', shift(limb(butt, tip, 3.6, 2.6), 1.7, 0.5))]
    layers += rim(sil, 1.8, 0.7)
    for f0, f1 in ((0.12, 0.34), (0.42, 0.60), (0.68, 0.86)):
        layers.append(('sh', [('line', [(mid(butt, tip, f0)[0] - 0.5, mid(butt, tip, f0)[1]),
                                        (mid(butt, tip, f1)[0] - 1.0, mid(butt, tip, f1)[1])],
                               0.9)]))
    paint(img, sil, WOOD, layers, ow=1.4)

    bead = mid(butt, tip, 0.82)
    paint(img, [circ(bead, 4.3)], WOOD,
          [('sh', [circ((bead[0] + 1.6, bead[1] + 1.5), 3.4)]),
           ('hi', [circ((bead[0] - 1.4, bead[1] - 1.4), 2.0)]),
           ('ink', [('line', [(bead[0] - 4.3, bead[1] + 0.2), (bead[0] + 4.3, bead[1] + 0.2)], 1.0)])],
          ow=1.2)

    paint(img, [circ(tip, 4.8),
                ('poly', [(tip[0] - 3.6, tip[1] + 2.6), (tip[0] + 3.6, tip[1] + 2.6),
                          (tip[0] + 2.3, tip[1] + 7.6), (tip[0] - 2.3, tip[1] + 7.6)])], GOLD,
          [('sh', [circ((tip[0] + 1.7, tip[1] + 1.7), 3.8)]),
           ('sh', [('poly', [(tip[0] + 0.4, tip[1] + 2.6), (tip[0] + 3.6, tip[1] + 2.6),
                             (tip[0] + 2.3, tip[1] + 7.6), (tip[0] + 0.6, tip[1] + 7.6)])]),
           ('hi', [circ((tip[0] - 1.5, tip[1] - 1.7), 2.2)]),
           (GLINT, [circ((tip[0] - 1.9, tip[1] - 2.1), 0.9)])], ow=1.35)


# ------------------------------------------------------------------- draw --
def draw_ron(img, fx, fy, mode, frame, seed):
    norm = math.hypot(fx, fy) or 1.0
    sx, sy = fx / norm, fy / norm
    side_amt = abs(sx)
    cat = facing_category(fx, fy)
    p = 2 * math.pi * frame / N

    if mode == 'idle':
        breathe = 1.4 * math.sin(p) - 0.4
        oy = 0.0
        legA_ph = legB_ph = math.pi
        armA_ph = math.pi + 0.25 * math.sin(p)
        sway = 0.0
        tilt = 0.0
        rib_p = p
    else:
        oy = body_shift(p, sx, sy)
        breathe = 0.0
        legA_ph, legB_ph = p, p + math.pi
        armA_ph = p + math.pi
        sway = 1.8 * math.sin(p) * (1.0 - side_amt)
        tilt = 1.6 * math.sin(p)
        rib_p = p * 2.0

    hip_y = HIP_Y + oy
    sh_y = SH_Y + oy - breathe
    head_cy = HEAD_CY + oy - breathe * 1.2

    hip_off = lerp(FRONT_HIP_OFF, SIDE_HIP_OFF, side_amt)
    sh_off = lerp(FRONT_SH_OFF, SIDE_SH_OFF, side_amt)
    half_sh = lerp(FRONT_SH_HALF, SIDE_SH_HALF, side_amt)
    half_waist = lerp(FRONT_WAIST_HALF, SIDE_WAIST_HALF, side_amt)
    half_hem = lerp(FRONT_HEM_HALF, SIDE_HEM_HALF, side_amt)
    lean = sx * 2.2 + sway * 0.5

    idle_spread = 2.0 if mode == 'idle' else 0.0
    hipA = (CX - hip_off - idle_spread + sway * 0.4, hip_y + tilt)
    hipB = (CX + hip_off + idle_spread + sway * 0.4, hip_y - tilt)

    kneeA, ankA = leg_chain(hipA, legA_ph, sx, sy)
    kneeB, ankB = leg_chain(hipB, legB_ph, sx, sy)

    # Pin the lower foot exactly on the sole line by sliding the WHOLE rig, so
    # the sprite never floats and every one of the 64 cells shares a baseline.
    corr = ANKLE_Y - max(ankA[1], ankB[1])
    oy += corr
    hip_y += corr
    sh_y += corr
    head_cy += corr

    def down(pt):
        return (pt[0], pt[1] + corr)

    hipA, hipB = down(hipA), down(hipB)
    kneeA, kneeB = down(kneeA), down(kneeB)
    ankA, ankB = down(ankA), down(ankB)
    shA = (CX - sh_off + lean, sh_y - tilt * 0.6 + 5.0)
    shB = (CX + sh_off + lean, sh_y + tilt * 0.6 + 5.0)

    def foot_tilt(ank, ph):
        lift = clamp((ANKLE_Y - ank[1]) / 6.0, 0.0, 1.0)
        return -0.40 * math.sin(ph) * lift * (0.35 + 0.65 * side_amt)

    # --- legs, far first
    draw_leg(img, hipA, kneeA, ankA, TROUS_D, +1, side_amt)
    draw_boot(img, ankA, sx, foot_tilt(ankA, legA_ph), side_amt, far=True)
    draw_leg(img, hipB, kneeB, ankB, TROUSER, -1, side_amt)
    draw_boot(img, ankB, sx, foot_tilt(ankB, legB_ph), side_amt, far=False)

    # --- free arm.  In profile it reads in front of the coat while it swings
    # forward and behind it on the way back, so the z-order follows the swing.
    elA, handA = arm_chain(shA, armA_ph, sx, sy, -1.0)
    far_mat = JACKET_D if side_amt > 0.5 else JACKET
    far_skin = SKIN_D if side_amt > 0.5 else SKIN
    front_arm = side_amt > 0.5

    def free_arm():
        draw_sleeve(img, shA, elA, handA, far_mat, near=False)
        draw_hand(img, handA, far_skin, 5.0)

    if not front_arm:
        free_arm()

    # --- torso
    draw_neck(img, CX + lean * 0.7, sh_y)
    draw_shirt(img, sh_y, hip_y, half_sh, half_waist, lean)
    draw_jacket(img, sh_y, hip_y, half_sh, half_waist, half_hem, lean, cat, sx, side_amt)
    draw_sash(img, hip_y, half_waist, half_hem, cat, sx, lean, frame)
    if front_arm:
        free_arm()

    # --- head
    head_x = CX + lean * 0.7 - (sx * 2.0 if cat == 'side' else 0.0)
    draw_head(img, head_x, head_cy, cat, sx, frame, mode)

    # --- staff, then the near arm gripping it
    cfg = STAFF_CFG[cat]
    grip = (CX + cfg['gx'] + lean * 0.5, hip_y + cfg['gy'])
    tip = (grip[0] + cfg['lean'], cfg['tip_y'] + oy * 0.30)
    dx, dy = tip[0] - grip[0], tip[1] - grip[1]
    n = math.hypot(dx, dy) or 1.0
    butt = (grip[0] - dx / n * cfg['butt'], grip[1] - dy / n * cfg['butt'])

    elB = ik2(shB, grip, UPARM, FOREARM, -1)
    draw_sleeve(img, shB, elB, grip, JACKET, near=True)
    draw_staff(img, tip, butt)
    draw_hand(img, grip, SKIN, 5.6, grip=True)

    # --- shoulder fringe over the sleeves
    draw_fringe(img, (shA[0] - 2.0, shA[1] + 3.0), -1, frame, seed)
    draw_fringe(img, (shB[0] + 2.0, shB[1] + 3.0), +1, frame, seed + 1.3)

    # --- streaming ribbons from the cap.  Each gets its own base angle, its
    # own flutter phase and a per-frame curl, so the fan visibly reshapes.
    for i, mat in enumerate(RIBBONS):
        base_ang = math.radians(lerp(8.0, 66.0, i / 3.0))
        wob = math.sin(rib_p + i * 1.9) * math.radians(15.0)
        curl = math.radians(lerp(52.0, 90.0, i / 3.0)) + \
            math.sin(rib_p * 1.3 + i * 2.1) * math.radians(34.0)
        draw_ribbon(img, (tip[0] + 0.6 + i * 0.5, tip[1] + 0.4 + i * 1.1), base_ang + wob,
                    33.0 + i * 3.0, rib_p + i * 1.4,
                    11.0 + 5.0 * math.sin(rib_p + i), curl, mat,
                    w0=8.0 - i * 0.6, w1=2.0,
                    hard=(math.radians(-24.0), math.radians(100.0)))

    # --- sparse confetti
    for i in range(3):
        h1, h2, h3 = hashf(seed, frame, i, 1), hashf(seed, frame, i, 2), hashf(seed, frame, i, 3)
        px = lerp(28.0, 164.0, h1)
        py = lerp(36.0, 150.0, h2)
        if abs(px - CX) < 30.0:
            px += 32.0 if px > CX else -32.0
        mat = CONFETTI[int(h3 * 97) % len(CONFETTI)]
        s = 1.7 + h2 * 1.1
        pts = rot_all([(px - s, py - s), (px + s, py - s), (px + s, py + s), (px - s, py + s)],
                      (px, py), h3 * math.pi)
        paint(img, [('poly', pts)], mat,
              [('hi', [('poly', [pts[0], pts[1], mid(pts[1], pts[2]), mid(pts[0], pts[3])])])],
              ow=0.7)


# --------------------------------------------------------------- assembly --
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


def render_cell(mode, facing, frame, mirror, row):
    img = Image.new('RGBA', (CELL * SS, CELL * SS), (0, 0, 0, 0))
    draw_ron(img, facing[0], facing[1], mode, frame, row * 7 + 3)
    img = img.resize((CELL, CELL), Image.LANCZOS)
    if mirror:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    return img


def build():
    sheet = Image.new('RGBA', (CELL * COLS, CELL * len(ROW_SPECS)), (0, 0, 0, 0))
    for r, (mode, facing, mirror) in enumerate(ROW_SPECS):
        for f in range(COLS):
            sheet.paste(render_cell(mode, facing, f, mirror, r), (f * CELL, r * CELL))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sheet.save(OUT)
    print('saved', OUT, sheet.size)


if __name__ == '__main__':
    build()
