"""Lock each direction's idle head (cap, hair, face) onto its eight walk frames.

The AI-generated walk frames each carried an independently drawn head, so the face
angle and cap size drifted between steps. This composites the idle-1 head above the
neck line onto every walk frame, following the walk frame's own head position for
the horizontal offset and vertical bob. Legs, arms and jacket stay untouched.
"""
from PIL import Image
import numpy as np, json, sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
atlas_path = root / 'src/assets/sprites/sheldon/sheldon-atlas.png'
dirs = ['south','southeast','east','northeast','north','northwest','west','southwest']
W, H = 192, 256
im = np.array(Image.open(atlas_path).convert('RGBA'))
log = {}

def cell(r, c): return im[r*H:(r+1)*H, c*W:(c+1)*W]
def neck_row(a, lo=72, hi=96):
    widths = [(int((a[y, :, 3] > 32).sum()), y) for y in range(lo, hi)]
    return min(widths)[1]
def head_center(a, cut):
    m = a[20:cut-6, :, 3] > 32
    xs = np.where(m.any(axis=0))[0]
    return (xs.min() + xs.max()) / 2

for r, d in enumerate(dirs):
    ref = cell(r, 0).copy()
    ref_neck = neck_row(ref); cut = ref_neck + 5  # seam lands in the dark collar below the chin
    ref_cx = head_center(ref, cut)
    head = ref[:cut].copy()
    for c in range(4, 12):
        walk = cell(r, c)
        w_neck = neck_row(walk)
        dy = int(np.clip(w_neck - ref_neck, -3, 3))
        dx = int(round(head_center(walk, w_neck + 1) - ref_cx))
        # erase the walk frame's own head, then paste the locked head opaquely
        top = cut + dy
        walk[:top] = 0
        canvas = np.zeros_like(walk)
        x0, x1 = max(0, dx), min(W, W + dx)
        y0, y1 = max(0, dy), dy + cut
        canvas[y0:y1, x0:x1] = head[y0-dy:cut, x0-dx:x1-dx]
        alpha = canvas[..., 3:4] / 255.0
        walk[:] = (canvas * alpha + walk * (1 - alpha)).astype(np.uint8)
        walk[..., 3] = np.maximum(canvas[..., 3], walk[..., 3])
        log[f'{d}-walk-{c-3}'] = dict(dx=dx, dy=dy, cut=cut)
    # idle frames: fix any frame whose feet sit one row high
    for c in range(0, 4):
        a = cell(r, c); rows = np.where((a[..., 3] > 32).any(axis=1))[0]
        if rows.max() != 237:
            shift = 237 - rows.max()
            a[:] = np.roll(a, shift, axis=0); log[f'{d}-idle-{c+1}'] = dict(shift=int(shift))

Image.fromarray(im).save(atlas_path)
(root / "artifacts/spritepaint-validation/headlock-log.json").write_text(json.dumps(log, indent=1))
print(json.dumps(log))
