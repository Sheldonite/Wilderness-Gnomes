# SpritePaint animation validation — 2026-09-07

**Result: frame dimensions and clipping pass; animation-wide visual consistency needs more work.** The earlier 8/10 scores rated individual frames. They do not establish that adjacent frames keep identical proportions or form a polished loop.

All 16 animations were loaded separately into https://spritepaint.com and playback was started. The editor showed the expected named layer and 10 fps setting. Its visible canvas was 192 × 256, displayed at a fixed 437.25 × 583 CSS pixels. West contact and passing frames were also selected directly on the timeline for comparison; south was inspected using the onion-skin control.

## Findings

| Direction | Idle | Walk | Main observation / needed improvement |
|---|---|---|---|
| South | No major sizing issue flagged | Needs polish | The upper outline narrows at frame 5 (60 px versus 64–67 px in other steps). Keep the cap/face and jacket scale stable across the second contact. |
| Southeast | No major sizing issue flagged | Needs polish | Walk upper silhouette ranges from 67 to 75 px; the contact frame and compact poses change facial/torso proportions. Lock the same head and torso model before changing limbs. |
| East | No major sizing issue flagged | Needs polish | Walk upper silhouette is 74–81 px versus 73 px throughout idle. Head/face proportions change at the idle/walk transition and across the walk. |
| Northeast | No major sizing issue flagged | No major sizing issue flagged | Upper walk outline stays within 68–71 px; rear direction and model are comparatively stable. This is not a guarantee of perfect motion. |
| North | Minor one-pixel variation | No major sizing issue flagged | Overall alignment is stable. One idle frame has a one-pixel bottom-edge/height difference. |
| Northwest | No major sizing issue flagged | Needs polish | Walk upper outline varies 68–78 px and the head angle changes across steps, especially the final recovery. Preserve head orientation and torso volume. |
| West | No major sizing issue flagged | Needs polish | Upper walk outline varies 80–90 px. Directly comparing contact frame 5 with passing frame 7 shows a different face/profile angle and torso shape, beyond the intended leg motion. |
| Southwest | No major sizing issue flagged | Needs polish | Smaller outline variation (66–70 px), but the face and jacket proportions still vary between the revised contact and neighboring poses. |

All 96 cells are 192 × 256. Occupied character height is 215–216 px. The occupied bottom edge is normally y=238 (exclusive), with one north idle frame at 237. No art reaches a cell boundary, so hats and boots are not clipped. These measures confirm framing, not constant apparent body size.

The upper-silhouette measurement covers source rows 22–87 and includes cap/hair/face and some upper clothing. It is a diagnostic flag, not a pure anatomical head-width measurement; legitimate perspective/pose changes can affect it.

## Evidence and limitations

The checks used actual SpritePaint imports, playback controls, rendered screenshots, selected timeline poses, and exact source-pixel bounds. Browser observations are sampled screenshots rather than a continuous-video perceptual audit. Consequently this report does **not** certify that every loop flows smoothly. The six flagged walking directions should be corrected and rechecked before a full animation sign-off.

The imported projects retain the original RGBA pixels with no rescaling. Walks use eight 100 ms frames. Idle holds use 10/6/1/6 ticks at 10 fps, matching the game's 1000/600/100/600 ms holds. The format was obtained through SpritePaint's own Save Project export.

Local review files: `artifacts/spritepaint-validation/` contains all 16 `.spritepaint` projects, the conversion script, raw frame bounds and preliminary report. They can be loaded through SpritePaint's menu → Load Project. No game artwork was changed during this validation.

## Correction pass — 2026-09-07

**Result: the six flagged walking directions are corrected in `src/assets/sprites/sheldon/sheldon-atlas.png`.** The upper silhouette width is now identical across all eight frames of every walk (south 69, southeast 72–73, east 73, northeast 68, north 68, northwest 76, west 86, southwest 70). The one-pixel-high north idle frame (idle 2) was shifted down so all 96 frames share the y=238 bottom edge.

Method (`scripts/sheldon-lock-heads.py`): each direction's idle frame 1 supplies a single head (cap, hair, face, chin) cut five rows below the narrowest neck row, so the seam falls inside the dark jacket collar. That head replaces the independently generated head on each walk frame. The walk frame's own head position drives the horizontal offset and a vertical bob clamped to ±3 px, so the step rhythm is kept while the face angle, cap size and torso-to-head proportion stay fixed. Legs, arms and jacket are untouched. Per-frame offsets are in `headlock-log.json`; the pre-correction atlas is kept as `sheldon-atlas-before-headlock.png`.

Verification: the 16 `.spritepaint` projects and `bounds-report.md` were regenerated from the corrected atlas. The game was booted headlessly with the project's Playwright capture against the Sheldon review page for west, south and east; all 12 frames per direction rendered with the locked head and no seam (`artifacts/hiker-animation/screenshots-headlock/`). Body height now varies 213–219 px within walks because of the intentional head bob; feet stay planted at y=238.

Not done: a frame-by-frame perceptual audit of the leg and arm motion, which this pass did not change.
