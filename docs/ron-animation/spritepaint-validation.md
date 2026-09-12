# SpritePaint animation consistency — Ron — 2026-09-12

**Result: Ron's walk heads now match his idle head in all eight directions, the south walk no longer hops sideways, and the south idle frames no longer carry a pale keying rim.** The 8/10 scores from the walk correction pass rated each frame against its neighbours. They did not hold head size, face and hair colour constant across a loop, which this pass does.

This is the consistency change applied to Sheldon on 2026-09-07 ([Sheldon's report](../sheldon-animation/spritepaint-validation.md)), adapted to Ron in two ways. His staff and ribbons share the head's rows, so the head is copied as a masked shape rather than as whole rows. His walk frames are hash-locked to the critique, so the change runs as a logged pipeline stage the verifier can follow.

## Findings before the change

Measured on the reviewed atlas (sha256 `b44a54d5…`) with a head mask that excludes the staff and ribbons. Head area counts hair and face pixels above the chin (or, for back views, nape) seam.

| Direction | Idle | Walk | Main observation |
|---|---|---|---|
| South | Pale grey rim around the whole figure (327–509 edge pixels per frame) | Head area 3487–3634 against idle 3792–3831; frames 2 and 6 sit 8–9 px right | The south source was keyed from a pale checker backdrop, leaving a 1 px rim outside the dark outline that no walk frame has. The walk body hops sideways twice per loop. |
| Southeast | Consistent | Head area 4033–4316 against idle 4383–4475 | Walk heads smaller than idle; face shape changes between steps. |
| East | Consistent | Head area 3858–4142 against idle 4193–4274 | Walk heads up to 8% smaller, hair lighter and spikier than idle. |
| Northeast | Consistent | Head area 3553–3714 against idle 3975–4029 | Hair drifts from near-black (about RGB 41, 36, 32) to reddish-brown (about 55–59, 38–39, 29–32). |
| North | Consistent | Head area 3344–3761 against idle 3952–3981 | Heads up to 15% smaller, hair a more saturated brown. |
| Northwest | Consistent | Head area 3167–3824 | The largest drift: a 21% swing within one loop and a changing head angle. |
| West | Consistent | Head area 3497–3954 against idle 4153–4198 | Hair visibly reddish (about RGB 56–67, 33–37, 22–29) against near-black idle hair. |
| Southwest | Consistent | Head area 3681–4080 against idle 4110–4122 | Head size varies within the loop. |

All 96 cells are 192 × 256 with the occupied bottom edge at y=238, and no art touches a cell border.

## Correction pass

`scripts/ron-lock-heads.py`, now the last stage of `scripts/pack-ron-sprites.cjs`:

1. **Head lock.** For each direction, idle frame 1 supplies the head: every pixel connected to the hair and face above a seam at the chin (front and side views) or nape (back views), limited to the head's own columns so the staff, ribbons and shoulder tassels are never copied. Seam rows, checked at 3× zoom: south 88, southeast 93, east 93, northeast 92, north 90, northwest 90, west 88, southwest 91. Each walk frame is registered to idle frame 1 by normalised edge correlation of the collar band just below the seam, which locates that frame's body. The walk frame's own head is erased and idle frame 1's head is composited at that offset, so the head rides on the body (vertical offsets 0 to −11 px). Sheldon's ±3 px clamp would not work here, because Ron's northwest walk bodies sit up to 11 px higher than idle frame 1.
2. **South rim.** From the four south idle frames, only light, unsaturated pixels sitting directly outside a darker outline are removed (316, 356, 502 and 363 pixels). Real light edges such as white ribbons stay.
3. **South hop.** A walk frame whose collar sits 5 px or more from its loop's median is moved horizontally with no pixel content changed: south walk 2 by −7 px and walk 6 by −8 px. No other direction had an outlier beyond 3 px.

Idle frames keep their own heads, so the idle blink is untouched. Legs, arms, jacket, sash, staff and ribbons are untouched.

**Review chain.** The script only locks walk frames whose raw RGBA matches the reviewer-approved hash in `critique/*-approved.json`. It writes [`headlock/headlock-log.json`](headlock/headlock-log.json) with every frame's source hash, result hash, body shift and head offset. `scripts/verify-ron-walks.cjs` follows that chain: each shipped walk frame must be the logged result of a reviewed frame, and a locked atlas without its log fails. Running the lock again on a locked atlas does nothing.

## After the change

| Direction | Walk head area, before → after | Collar x-offsets, walk 1–8 |
|---|---|---|
| South | 3487–3634 → 3756 in every frame | −1, 8, 2, −1, 1, 9, 1, 0 → −1, 1, 2, −1, 1, 1, 1, 0 |
| Southeast | 4033–4316 → 4464 | unchanged (−1 to −3) |
| East | 3858–4142 → 4193–4195 | unchanged (0 to 1) |
| Northeast | 3553–3714 → 4000 | unchanged (1 to 3) |
| North | 3344–3761 → 3956 | unchanged (1 to 2) |
| Northwest | 3167–3824 → 3750 | unchanged (−3 to −4) |
| West | 3497–3954 → 4163 | unchanged (−2 to 2) |
| Southwest | 3681–4080 → 4122 | unchanged (−1 to −3) |

Every walk head now equals its direction's idle frame 1 head, hair colour included; east reads 4193–4195 only because two pixels blend where the head overlaps the collar. The south idle head area moves from 3792–3831 to 3681–3756 because the rim pixels are gone.

Walk silhouettes are now 216–224 px tall instead of exactly 216. The idle-sized head sits on walk bodies that were drawn for a smaller head and normalised to 216 px overall. Feet stay on y=238, nothing reaches a cell border, and idle heights are unchanged (213–218). Per-animation numbers are in the local `bounds-report.md` listed below.

## Verification

- **Scratch run first.** The script ran on a copy. Its head close-ups and a full-body south strip were inspected before and after, including the seams at the chin and nape. A second run on its own output was a byte-identical no-op, and a fresh run was pixel-identical. `import-ron-walks.cjs` followed by the lock reproduces the shipped atlas pixel for pixel.
- **Installed atlas.** sha256 `6d3bc5ce…`, matching the log. `node scripts/verify-ron-walks.cjs src/assets/sprites/ron/ron-atlas.png <pre-lock atlas>` passes: 64 distinct, unclipped head-locked frames trace to reviewer-approved pixels; 28 idle frames are unchanged and 4 were de-fringed as logged. `critique/validation.json` and `walk-preview.gif` were regenerated from the new atlas.
- **In game.** The Ron review page (`/?review=ron-sprites&direction=…`) was loaded headlessly for all eight directions. All 96 rendered frames match the atlas pixel for pixel, with no page errors or failed requests, including the south motion view.
- **Build and tests.** Typecheck, the production build and all 180 tests pass.

## SpritePaint projects and limitations

Local review files, gitignored:

- `artifacts/ron-spritepaint-validation/`: the 16 `.spritepaint` projects built from the corrected atlas, a ZIP of all 16, `pixel-bounds.json`, and `bounds-report.md` with the before and after measurements. Walks play at 10 fps; idle holds are 10/6/1/6 ticks, matching the game's 1000/600/100/600 ms.
- `artifacts/ron-headlock/spritepaint-before/`: the same 16 projects built from the pre-lock atlas, for side-by-side comparison.
- `artifacts/ron-headlock/`: the pre-lock atlas and the in-game capture script, results and screenshots.

Load projects through SpritePaint's menu → Load Project.

Unlike Sheldon's validation, these projects were not loaded into spritepaint.com during this pass. Consistency was checked with exact pixel measurements, close-up and native-size renders, and the game's own review page. The pass does not change leg or arm motion, jacket bead positions or ribbon shapes, which still vary between walk frames as the critique noted. Walk bodies also remain slightly taller than idle bodies.
