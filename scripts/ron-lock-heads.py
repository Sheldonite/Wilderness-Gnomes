"""Keep Ron's head identical across every walk frame, as scripts/sheldon-lock-heads.py does for Sheldon.

Ron's idle and walk frames were generated separately, so over a walk loop the head changed size
(up to 14% in area) and the hair drifted from near-black to reddish-brown in west and northeast.
For every direction this script:

  1. removes the pale rim the checker-backdrop key left on the south idle frames (only south was
     keyed from a checker; the others used cyan). Only light, unsaturated pixels that sit directly
     outside a darker outline are removed, so real light edges such as ribbons are left alone;
  2. re-centres any walk frame whose body sits HOP_TOLERANCE px or more from the loop's median
     collar position (south walk 2 and 6 were 7-8 px to the right, a sideways hop);
  3. copies idle frame 1's head (hair and face above a chin or nape seam checked by eye) onto each
     walk frame, where that frame's collar sits, replacing the walk frame's own head. The copy is
     limited to the head's own columns and connected pixels, so the staff and ribbons never move.

Idle frames keep their own heads, so the blink survives. Legs, arms, jacket, staff and ribbons are
untouched. Walk frames are only processed when their raw RGBA matches the reviewer-approved hash in
docs/ron-animation/critique, and the log records each frame's source and result hashes so
scripts/verify-ron-walks.cjs can follow the chain from reviewed pixels to shipped pixels.
Running it on an already locked atlas is a no-op.

Usage: python scripts/ron-lock-heads.py [ATLAS] [--out PATH] [--log PATH]
       (defaults: src/assets/sprites/ron/ron-atlas.png in place, log in docs/ron-animation/headlock/)
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
PRODUCTION = ROOT / 'src/assets/sprites/ron/ron-atlas.png'
PRODUCTION_LOG = ROOT / 'docs/ron-animation/headlock/headlock-log.json'
APPROVALS = ROOT / 'docs/ron-animation/critique'
DIRECTIONS = ['south', 'southeast', 'east', 'northeast', 'north', 'northwest', 'west', 'southwest']
W, H = 192, 256
# Chin bottom (front and side views) or nape (back views) on idle frame 1, checked at 3x zoom.
SEAM = {'south': 88, 'southeast': 93, 'east': 93, 'northeast': 92, 'north': 90, 'northwest': 90, 'west': 88, 'southwest': 91}
DEFRINGE_IDLE = ('south',)
HOP_TOLERANCE = 5
K4 = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], bool)
K8 = np.ones((3, 3), bool)


def sha(cell):
    return hashlib.sha256(np.ascontiguousarray(cell).tobytes()).hexdigest()


def runs(row):
    out, start = [], None
    for x, v in enumerate(row):
        if v and start is None:
            start = x
        if not v and start is not None:
            out.append((start, x - 1)); start = None
    if start is not None:
        out.append((start, len(row) - 1))
    return out


def head_core(opaque, prefer_x=None):
    """Median left and right edge of the head over rows 40-60, ignoring separate staff runs."""
    starts, ends = [], []
    for y in range(40, 61):
        segments = runs(opaque[y])
        if not segments:
            continue
        if prefer_x is None:
            s, e = max(segments, key=lambda t: t[1] - t[0])
        else:
            s, e = min(segments, key=lambda t: 0 if t[0] <= prefer_x <= t[1] else min(abs(t[0] - prefer_x), abs(t[1] - prefer_x)))
        starts.append(s); ends.append(e)
    return int(np.median(starts)), int(np.median(ends))


def head_component(opaque, core, seam, seed):
    """Pixels connected to the head, above the seam and within the head's columns."""
    x0, x1 = max(0, core[0] - 6), min(W, core[1] + 7)
    region = np.zeros_like(opaque)
    region[:max(1, seam + 1), x0:x1] = opaque[:max(1, seam + 1), x0:x1]
    labels, _ = ndimage.label(region, structure=K8)
    sy, sx = seed
    label = labels[sy, sx] if 0 <= sy < H and 0 <= sx < W else 0
    if label == 0:
        ys, xs = np.nonzero(labels)
        if not len(ys):
            return np.zeros_like(opaque)
        i = int(np.argmin((ys - sy) ** 2 + (xs - sx) ** 2))
        label = labels[ys[i], xs[i]]
    return labels == label


def edges(rgba):
    covered = (rgba[..., 3] > 32).astype(np.float32)
    f = rgba.astype(np.float32)
    lum = (f[..., 0] * .299 + f[..., 1] * .587 + f[..., 2] * .114) * covered
    return np.hypot(ndimage.sobel(lum, axis=1), ndimage.sobel(lum, axis=0))


def register(ref_edges, walk_edges, cx, seam, half=24, reach_x=10, reach_y=14):
    """Offset of a walk frame's collar band against idle 1's, by normalised edge correlation."""
    y0, y1, x0, x1 = seam + 2, seam + 25, cx - half, cx + half + 1
    ref = ref_edges[y0:y1, x0:x1]
    ref = ref - ref.mean()
    ref_norm = np.sqrt((ref * ref).sum()) or 1.0
    best = (-2.0, 0, 0, 0.0)
    for dy in range(-reach_y, reach_y + 1):
        for dx in range(-reach_x, reach_x + 1):
            if y0 + dy < 0 or y1 + dy > H or x0 + dx < 0 or x1 + dx > W:
                continue
            band = walk_edges[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
            band = band - band.mean()
            ncc = float((ref * band).sum() / (ref_norm * (np.sqrt((band * band).sum()) or 1.0)))
            score = ncc - 0.0004 * (abs(dx) + abs(dy))   # flat ties settle on the smaller shift
            if score > best[0]:
                best = (score, dx, dy, ncc)
    return best[1], best[2], round(best[3], 4)


def over(dst, src):
    src_a = src[..., 3:4].astype(np.float32) / 255
    dst_a = dst[..., 3:4].astype(np.float32) / 255
    out_a = src_a + dst_a * (1 - src_a)
    rgb = (src[..., :3] * src_a + dst[..., :3] * dst_a * (1 - src_a)) / np.maximum(out_a, 1e-6)
    out = np.concatenate([rgb, out_a * 255], axis=-1)
    return np.where(out_a > 0, out, 0).round().clip(0, 255).astype(np.uint8)


def rim_over_outline(rgba):
    f = rgba.astype(np.int32)
    lum = (f[..., 0] * 299 + f[..., 1] * 587 + f[..., 2] * 114) // 1000
    sat = f[..., :3].max(axis=-1) - f[..., :3].min(axis=-1)
    visible = rgba[..., 3] > 0
    pale = visible & ndimage.binary_dilation(~visible, structure=K4) & (lum >= 110) & (sat <= 55)
    dark = visible & ~pale & (lum < 80)
    return pale & ndimage.binary_dilation(dark, structure=K4)


def defringe(rgba):
    out, removed = rgba.copy(), 0
    for _ in range(3):
        rim = rim_over_outline(out)
        count = int(rim.sum())
        if not count:
            break
        out[rim] = 0
        removed += count
    return out, removed


def shift_x(rgba, shift):
    out = np.zeros_like(rgba)
    if shift > 0:
        out[:, shift:] = rgba[:, :W - shift]
    elif shift < 0:
        out[:, :W + shift] = rgba[:, -shift:]
    else:
        out[:] = rgba
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('atlas', nargs='?', default=str(PRODUCTION))
    parser.add_argument('--out')
    parser.add_argument('--log')
    args = parser.parse_args()
    source = Path(args.atlas)
    output = Path(args.out) if args.out else source
    if args.log:
        log_path = Path(args.log)
    elif output.resolve() == PRODUCTION.resolve():
        log_path = PRODUCTION_LOG
    else:
        log_path = output.with_name(output.stem + '.headlock-log.json')

    source_bytes = source.read_bytes()
    atlas = np.array(Image.open(source).convert('RGBA'))
    if atlas.shape != (H * 8, W * 12, 4):
        sys.exit(f'Unexpected atlas size {atlas.shape[1]}x{atlas.shape[0]}')
    prior = json.loads(log_path.read_text()) if log_path.exists() else None

    def cell(row, col):
        return atlas[row * H:(row + 1) * H, col * W:(col + 1) * W]

    approved = {}
    for d in DIRECTIONS:
        frames = json.loads((APPROVALS / f'{d}-approved.json').read_text())['frames']
        approved[d] = {f['frame']: f['rgbaSha256'].lower() for f in frames}
    walk_hashes = {(d, c - 3): sha(cell(r, c)) for r, d in enumerate(DIRECTIONS) for c in range(4, 12)}
    unreviewed = [k for k, v in walk_hashes.items() if v != approved[k[0]][k[1]]]

    if unreviewed:
        if prior and all(walk_hashes[(e['direction'], e['frame'])] == e['resultSha256'] for e in prior['walk']) \
                and all(sha(cell(DIRECTIONS.index(e['direction']), e['frame'] - 1)) == e['resultSha256'] for e in prior['idle']):
            print('Ron atlas is already head-locked; nothing to do.')
            if output.resolve() != source.resolve():
                output.write_bytes(source_bytes)
            return
        sys.exit(f'Refusing to lock: {len(unreviewed)} walk frames are neither reviewer-approved pixels nor this '
                 f'log\'s locked result (first: {unreviewed[0]}). Rebuild with scripts/pack-ron-sprites.cjs.')

    idle_log = []
    for d in DEFRINGE_IDLE:
        r = DIRECTIONS.index(d)
        for c in range(4):
            before = sha(cell(r, c))
            if prior and any(e['direction'] == d and e['frame'] == c + 1 and e['resultSha256'] == before for e in prior['idle']):
                idle_log.append(next(e for e in prior['idle'] if e['direction'] == d and e['frame'] == c + 1))
                continue
            cleaned, removed = defringe(cell(r, c))
            if removed < 100:
                # the checker rim runs to hundreds of pixels; fewer means the frame is already clean
                idle_log.append(dict(direction=d, frame=c + 1, removed=0, sourceSha256=before, resultSha256=before))
                continue
            cell(r, c)[:] = cleaned
            idle_log.append(dict(direction=d, frame=c + 1, removed=removed, sourceSha256=before, resultSha256=sha(cell(r, c))))

    walk_log = []
    for r, d in enumerate(DIRECTIONS):
        reference = cell(r, 0).copy()
        ref_opaque = reference[..., 3] > 32
        core = head_core(ref_opaque)
        cx = (core[0] + core[1]) // 2
        seam = SEAM[d]
        head = head_component(ref_opaque, core, seam, (50, cx))
        head_ys, head_xs = np.nonzero(head)
        ref_edges = edges(reference)
        found = [register(ref_edges, edges(cell(r, c)), cx, seam) for c in range(4, 12)]
        median_dx = int(round(float(np.median([f[0] for f in found]))))
        for c, (dx, dy, ncc) in zip(range(4, 12), found):
            frame = c - 3
            walk = cell(r, c).copy()
            shift = -(dx - median_dx) if abs(dx - median_dx) >= HOP_TOLERANCE else 0
            if shift:
                moved = shift_x(walk, shift)
                if int((moved[..., 3] > 0).sum()) != int((walk[..., 3] > 0).sum()):
                    sys.exit(f'{d} walk {frame}: re-centring by {shift}px would cut pixels at the cell edge')
                walk = moved
                dx, dy, ncc = register(ref_edges, edges(walk), cx, seam)
            opaque = walk[..., 3] > 32
            own = head_component(opaque, head_core(opaque, prefer_x=cx + dx), seam + dy, (50 + dy, cx + dx))
            walk[own] = 0
            ty, tx = head_ys + dy, head_xs + dx
            if ty.min() < 0 or ty.max() >= H or tx.min() < 0 or tx.max() >= W:
                sys.exit(f'{d} walk {frame}: the locked head would leave the cell at offset ({dx}, {dy})')
            layer = np.zeros_like(walk)
            layer[ty, tx] = reference[head_ys, head_xs]
            walk = over(walk, layer)
            cell(r, c)[:] = walk
            walk_log.append(dict(direction=d, frame=frame, sourceSha256=walk_hashes[(d, frame)], resultSha256=sha(walk),
                                 bodyShift=shift, dx=dx, dy=dy, ncc=ncc, erased=int(own.sum()), pasted=int(len(head_ys))))

    output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(atlas).save(output)
    log = dict(tool='scripts/ron-lock-heads.py', seam=SEAM, hopTolerance=HOP_TOLERANCE, defringedDirections=list(DEFRINGE_IDLE),
               atlas=str(output.resolve().relative_to(ROOT) if output.resolve().is_relative_to(ROOT) else output),
               sourceAtlasSha256=hashlib.sha256(source_bytes).hexdigest(),
               resultAtlasSha256=hashlib.sha256(output.read_bytes()).hexdigest(), idle=idle_log, walk=walk_log)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text(json.dumps(log, indent=1) + '\n')
    shifted = [(e['direction'], e['frame'], e['bodyShift']) for e in walk_log if e['bodyShift']]
    print(f"Locked 64 walk heads to idle frame 1; removed the checker rim from {sum(1 for e in idle_log if e['removed'])} "
          f"south idle frames; re-centred {len(shifted)} walk frames {shifted}. Log: {log_path}")


if __name__ == '__main__':
    main()
