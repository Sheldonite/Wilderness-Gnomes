"""Generate Tobias the Tuna companion sprite sheet.

Layout: 192px cells, 6 columns x 2 rows, profile view facing RIGHT (the game
flips the sprite horizontally for left-facing use, see src/game/config/tobiasSprite.ts):
    row 0 (frames 0-5): SWIM cycle  - a relaxed cruising loop. Loops seamlessly,
        frame 5 -> frame 0.
    row 1 (frames 6-11): DART cycle - the same fish in an aggressive torpedo
        attack pose (straighter body, fins swept back, fast tail beat, a slight
        forward lean). The game only plays frames 6-9, but all six are drawn
        as one coherent loop so frames 10-11 continue it cleanly.

Tobias is a whimsical joke: a proper chunky bluefin tuna - torpedo body,
pointed snout, deeply forked crescent tail, tall front dorsal fin, yellow
finlets along the tail stalk - except he "swims" through open air. Instead of
water bubbles he trails a few soft, low-alpha air-current wisps.

Technique (matches build_deer.py / build_stag.py): the fish is built from flat
storybook colour blocks with a dark ink outline, drawn at supersample SS=4 on
a CELL*SS canvas and downsampled with LANCZOS for antialiasing. The whole body
silhouette is one smooth polygon (key profile points softened with a small
Catmull-Rom spline) rather than the ellipse stacks the deer/stag use, since a
tuna's tapered torpedo shape needs a continuous curve to read correctly.

Both cycles share the same anatomy code; only a handful of numeric parameters
(undulation amplitude/wavenumber, tail-beat amplitude/frequency, pectoral fin
angle/flutter, body stretch, forward lean, dorsal-fin sweep) differ between
'swim' and 'dart' so the two rows stay visibly the same character.

Pure procedural PIL (no external image inputs). Fully deterministic - every
animated offset is a function of frame index, nothing is randomised.

Usage: python scripts/build_tobias_tuna.py   (needs Pillow)
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = f'{ROOT}/src/assets/sprites/tobias-tuna-sheet.png'

CELL = 192
SS = 4
FRAMES = 6          # frames per row
GLOBAL_SCALE = 0.90  # final safety margin knob, applied uniformly about the centre

CX, CY = CELL / 2.0, CELL / 2.0

INK = (30, 34, 44, 255)
BACK = (44, 78, 122)          # deep steel-blue back / fin colour
MID = (86, 132, 178)          # lighter blue mid-body
BELLY = (226, 232, 238)       # pale silver-white belly
FINLET = (238, 194, 92)       # bright yellow finlets + dorsal rim
HILITE = (216, 236, 244)      # iridescent flank streak
WISP_COL = (233, 244, 250)    # pale air-current wisps

# Body silhouette: (x offset from centre, top half-thickness, bottom half-thickness).
# x runs from the peduncle (thin tail stalk, negative x / trailing side) to the
# pointed snout (positive x / leading side). The back (top) is drawn a touch
# deeper than the belly (bottom) for the classic tuna "shoulder" hump.
PEDUNCLE_X = -58
SNOUT_X = 78
BODY_PROFILE = [
    (-58,  3.0,  3.0),
    (-44, 12.0,  9.0),
    (-28, 25.0, 18.0),
    (-12, 31.0, 23.0),
    (  4, 32.0, 24.0),
    ( 22, 28.0, 21.0),
    ( 40, 21.0, 15.0),
    ( 56, 12.0,  8.0),
    ( 70,  5.0,  4.0),
    ( 78,  1.0,  1.0),
]

SWIM = dict(amp=3.0, k=2.3, tail_amp=12, tail_freq=1, pect_angle=24, pect_flutter=9,
            pect_freq=2, dorsal_sweep=0.10, lean=0.0, stretch=1.00, scale=1.00,
            wisp_reach=13, wisp_n=3)
DART = dict(amp=0.9, k=1.9, tail_amp=15, tail_freq=2, pect_angle=60, pect_flutter=4,
            pect_freq=2, dorsal_sweep=0.75, lean=-7.0, stretch=1.06, scale=0.95,
            wisp_reach=16, wisp_n=4)


def S(pts):
    return [(x * SS, y * SS) for x, y in pts]


def place(pts, lean, scale):
    """Local (centre-relative) points -> absolute canvas points, with global scale/lean."""
    out = [(CX + x * scale, CY + y * scale) for x, y in pts]
    if lean:
        a = math.radians(lean)
        ca, sa = math.cos(a), math.sin(a)
        out = [(CX + (x - CX) * ca - (y - CY) * sa, CY + (x - CX) * sa + (y - CY) * ca) for x, y in out]
    return out


def offset_polygon(pts, d):
    """Grow (d>0) or shrink (d<0) a closed polygon outward along its own normals.

    PIL's ImageDraw.polygon(outline=, width=N) does NOT actually extend the
    stroke beyond the fill path (verified empirically - width has no effect
    on the rasterised extent), so a real ink border needs a geometrically
    grown copy of the shape drawn first, with the true-size fill on top.
    """
    n = len(pts)
    area = sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n))
    sign = 1.0 if area < 0 else -1.0
    out = []
    for i in range(n):
        p_prev, p, p_next = pts[i - 1], pts[i], pts[(i + 1) % n]

        def edge_normal(a, b):
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy) or 1e-6
            return -dy / L, dx / L
        n1x, n1y = edge_normal(p_prev, p)
        n2x, n2y = edge_normal(p, p_next)
        nx, ny = n1x + n2x, n1y + n2y
        L = math.hypot(nx, ny) or 1e-6
        nx, ny = nx / L, ny / L
        out.append((p[0] + sign * nx * d, p[1] + sign * ny * d))
    return out


def outlined_polygon(draw, pts, fill, width=1.7):
    draw.polygon(S(offset_polygon(pts, width)), fill=INK)
    draw.polygon(S(pts), fill=fill)


def outlined_ellipse(draw, box, fill, width=1.8):
    w = width * SS
    draw.ellipse([box[0] * SS - w, box[1] * SS - w, box[2] * SS + w, box[3] * SS + w], fill=INK)
    draw.ellipse([box[0] * SS, box[1] * SS, box[2] * SS, box[3] * SS], fill=fill)


def rotate_pts(pts, pivot, angle_deg):
    a = math.radians(angle_deg)
    ca, sa = math.cos(a), math.sin(a)
    px, py = pivot
    out = []
    for x, y in pts:
        dx, dy = x - px, y - py
        out.append((px + dx * ca - dy * sa, py + dx * sa + dy * ca))
    return out


def inset(pts, factor):
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    return [(cx + (x - cx) * factor, cy + (y - cy) * factor) for x, y in pts]


def catmull_rom(points, n=6):
    """Smooth an open polyline through its control points (numpy not required)."""
    if len(points) < 3:
        return list(points)
    pad = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(1, len(pad) - 2):
        p0, p1, p2, p3 = pad[i - 1], pad[i], pad[i + 1], pad[i + 2]
        for j in range(n):
            t = j / n
            t2, t3 = t * t, t * t * t
            x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
                       (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
                       (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    out.append(pad[-2])
    return out


def profile_th(x):
    """Linear-interpolated (top_half_thickness, bottom_half_thickness) at any x."""
    pts = BODY_PROFILE
    if x <= pts[0][0]:
        return pts[0][1], pts[0][2]
    if x >= pts[-1][0]:
        return pts[-1][1], pts[-1][2]
    for (x0, t0, b0), (x1, t1, b1) in zip(pts, pts[1:]):
        if x0 <= x <= x1:
            f = (x - x0) / (x1 - x0)
            return t0 + (t1 - t0) * f, b0 + (b1 - b0) * f
    return pts[-1][1], pts[-1][2]


def make_wave(amp, k, phase):
    """A gentle travelling flexure: near-zero at the snout, strongest at the peduncle."""
    def wave(x):
        frac = (SNOUT_X - x) / (SNOUT_X - PEDUNCLE_X)
        frac = min(max(frac, 0.0), 1.0)
        env = frac ** 2.2
        return amp * env * math.sin(phase - k * frac)
    return wave


def blend_line(f, wavefn, stretch, x_min=None, x_max=None):
    """A line at fraction f between the top (f=0) and bottom (f=1) body edges."""
    pts = [p for p in BODY_PROFILE if (x_min is None or p[0] >= x_min) and (x_max is None or p[0] <= x_max)]
    line = [(x * stretch, (-tt + wavefn(x)) * (1 - f) + (tb + wavefn(x)) * f) for x, tt, tb in pts]
    return catmull_rom(line, 6)


def body_shapes(wavefn, stretch):
    top_pts = [(x * stretch, -tt + wavefn(x)) for x, tt, tb in BODY_PROFILE]
    bot_pts = [(x * stretch, tb + wavefn(x)) for x, tt, tb in BODY_PROFILE]
    top_s = catmull_rom(top_pts, 6)
    bot_s = catmull_rom(bot_pts, 6)
    outline = top_s + list(reversed(bot_s))
    back_shade = top_s + list(reversed(blend_line(0.50, wavefn, stretch)))
    belly_shade = bot_s + list(reversed(blend_line(0.60, wavefn, stretch)))
    hi = blend_line(0.50, wavefn, stretch, -20, 55)
    lo = blend_line(0.56, wavefn, stretch, -20, 55)
    hilite = hi + list(reversed(lo))
    return outline, back_shade, belly_shade, hilite


def tail_lobes(wavefn, stretch, angle):
    """Two sickle-shaped lobes sharing a pivot at the peduncle, forming a deep
    lunate fork: each sweeps back to a sharp tip then curves back concave
    toward a shared notch, leaving a clear V gap of background between them."""
    pivot = (PEDUNCLE_X * stretch, wavefn(PEDUNCLE_X))
    upper = [(6, -4), (-4, -12), (-14, -21), (-25, -28), (-32, -31), (-24, -24), (-14, -16), (-5, -7)]
    lower = [(x, -y) for x, y in upper]
    upper = rotate_pts([(pivot[0] + x, pivot[1] + y) for x, y in upper], pivot, angle)
    lower = rotate_pts([(pivot[0] + x, pivot[1] + y) for x, y in lower], pivot, angle)
    return upper, lower


def dorsal_points(wavefn, sweep):
    """sweep in [0,1]: 0 = tall and upright (cruising), 1 = laid back and
    shortened, as a real tuna's first dorsal folds down when swimming fast."""
    x_back, x_front = 0, 24
    yb = -profile_th(x_back)[0] + wavefn(x_back)
    yf = -profile_th(x_front)[0] + wavefn(x_front)
    tip = (5 - sweep * 18, yb - (42 - sweep * 22))
    concave = (11 - sweep * 7, yb - (16 - sweep * 6))
    return [(x_front, yf), tip, concave, (x_back, yb)]


def small_fin_points(x, wavefn, top):
    th = profile_th(x)
    sign = -1 if top else 1
    base_y = (-th[0] if top else th[1]) + wavefn(x)
    tip = (x - 5, base_y + sign * 9)
    return [(x - 7, base_y), tip, (x + 5, base_y)]


def finlet_points(x, wavefn, top):
    th = profile_th(x)
    sign = -1 if top else 1
    base_y = (-th[0] if top else th[1]) + wavefn(x)
    return [(x - 2.6, base_y), (x, base_y + sign * 6.5), (x + 2.6, base_y)]


def pectoral_points(angle):
    local = [(2, -2), (-3, 8), (-7, 19), (-9, 29), (-2, 29), (4, 18), (6, 7), (4, -1)]
    return rotate_pts(local, (0, 0), angle)


def wisp_points(x0, y0, length, curl, n=6):
    pts = []
    for i in range(n + 1):
        t = i / n
        x = x0 - length * t
        y = y0 + math.sin(t * math.pi * curl) * length * 0.24
        pts.append((x, y))
    return pts


def draw_wisps(draw, mode, phase, wisp_reach, n, pivot_x, pivot_y, lean, scale):
    """Soft trailing curls anchored near the (fixed) peduncle rather than the
    swinging tail tip, so their reach - and the frame's overall bounding box -
    stays predictable no matter how hard the tail is beating."""
    for i in range(n):
        ph = phase + i * 2.3
        side = 1 if i % 2 == 0 else -1
        x0 = pivot_x - 3
        y0 = pivot_y + side * (16 + i * 7) + math.sin(ph) * 2.5
        length = wisp_reach * (0.55 + 0.12 * i)
        curl = 1.0 + 0.3 * i + 0.15 * math.sin(ph)
        pts = wisp_points(x0, y0, length, curl)
        pts = place(pts, lean, scale)
        alpha = max(16, int((92 if mode == 'dart' else 74) - i * 14))
        width = max(1, int((2.4 - i * 0.3) * SS))
        draw.line(S(pts), fill=WISP_COL + (alpha,), width=width, joint='curve')


def render_cell(mode, frame):
    p = SWIM if mode == 'swim' else DART
    phase = 2 * math.pi * frame / FRAMES
    lean, scale, stretch = p['lean'], p['scale'] * GLOBAL_SCALE, p['stretch']
    wavefn = make_wave(p['amp'], p['k'], phase)

    base = Image.new('RGBA', (CELL * SS, CELL * SS), (0, 0, 0, 0))
    wisp_layer = Image.new('RGBA', base.size, (0, 0, 0, 0))
    wd = ImageDraw.Draw(wisp_layer)
    pivot_x = PEDUNCLE_X * stretch
    pivot_y = wavefn(PEDUNCLE_X)
    draw_wisps(wd, mode, phase, p['wisp_reach'], p['wisp_n'], pivot_x, pivot_y, lean, scale)
    wisp_layer = wisp_layer.filter(ImageFilter.GaussianBlur(1.3 * SS))
    img = Image.alpha_composite(base, wisp_layer)
    d = ImageDraw.Draw(img)

    # tail beats like a pendulum about the peduncle, faster/harder in the dart
    tail_angle = p['tail_amp'] * math.sin(phase * p['tail_freq'])
    upper, lower = tail_lobes(wavefn, stretch, tail_angle)
    outlined_polygon(d, place(lower, lean, scale), BACK)
    outlined_polygon(d, place(upper, lean, scale), BACK)

    # body: base fill, then back/belly shading bands, then a thin flank highlight
    outline, back_shade, belly_shade, hilite = body_shapes(wavefn, stretch)
    outlined_polygon(d, place(outline, lean, scale), MID)
    d.polygon(S(place(back_shade, lean, scale)), fill=BACK)
    d.polygon(S(place(belly_shade, lean, scale)), fill=BELLY)
    hx = S(place(hilite, lean, scale))
    hilite_layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(hilite_layer).polygon(hx, fill=HILITE + (100,))
    img = Image.alpha_composite(img, hilite_layer)
    d = ImageDraw.Draw(img)

    # second dorsal + anal fin, then the finlet row along the tail stalk
    outlined_polygon(d, place(small_fin_points(-28, wavefn, True), lean, scale), BACK, 1.3)
    outlined_polygon(d, place(small_fin_points(-28, wavefn, False), lean, scale), BACK, 1.3)
    for fx in (-52, -48, -44, -40, -36):
        outlined_polygon(d, place(finlet_points(fx, wavefn, True), lean, scale), FINLET, 0.9)
        outlined_polygon(d, place(finlet_points(fx, wavefn, False), lean, scale), FINLET, 0.9)

    # tall first dorsal fin, yellow-edged (outer yellow polygon, smaller blue fill inset)
    dpts = dorsal_points(wavefn, p['dorsal_sweep'])
    outlined_polygon(d, place(dpts, lean, scale), FINLET, 1.6)
    d.polygon(S(place(inset(dpts, 0.72), lean, scale)), fill=BACK)

    # pectoral fin, fluttering gently when cruising, swept tight to the body when darting
    pect_angle = p['pect_angle'] + p['pect_flutter'] * math.sin(phase * p['pect_freq'])
    pect = pectoral_points(pect_angle)
    ax, ay = 42, profile_th(42)[1] * 0.75 + wavefn(42)
    pect = [(ax + x, ay + y) for x, y in pect]
    outlined_polygon(d, place(pect, lean, scale), BACK, 1.4)

    # eye: cheerful, not menacing - white sclera, dark pupil, tiny highlight
    ex, ey = SNOUT_X - 16, -profile_th(SNOUT_X - 16)[0] * 0.35 + wavefn(SNOUT_X - 16)
    ex, ey = ex * stretch, ey
    eye_box = place([(ex - 6.5, ey - 6.5), (ex + 6.5, ey + 6.5)], lean, scale)
    outlined_ellipse(d, [eye_box[0][0], eye_box[0][1], eye_box[1][0], eye_box[1][1]], (255, 255, 255), 1.4)
    pupil_box = place([(ex - 0.5, ey - 3.4), (ex + 5.5, ey + 3.4)], lean, scale)
    d.ellipse(S(pupil_box), fill=INK)
    hl_box = place([(ex + 0.4, ey - 2.6), (ex + 2.4, ey - 0.8)], lean, scale)
    d.ellipse(S(hl_box), fill=(255, 255, 255))

    return img.resize((CELL, CELL), Image.LANCZOS)


def build():
    sheet = Image.new('RGBA', (CELL * FRAMES, CELL * 2), (0, 0, 0, 0))
    for f in range(FRAMES):
        sheet.paste(render_cell('swim', f), (f * CELL, 0))
    for f in range(FRAMES):
        sheet.paste(render_cell('dart', f), (f * CELL, CELL))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sheet.save(OUT)
    print('saved', OUT, sheet.size)


if __name__ == '__main__':
    build()
