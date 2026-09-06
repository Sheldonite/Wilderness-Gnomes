# Storybook overhaul — verification

Verified locally on 2026-09-06.

## Result

The title screen, selection cards, HUD, upgrades, pause and results screens now share the golden woodland design. The forest has new generated ground, foliage, water and bridge artwork, continuous routes, soft contact shadows and bounded combat effects.

Original Code Wizard, Hailey, Mystery and squirrel image files are unchanged. Mystery's uneven sprite rows are now cropped to their actual alpha bounds and aligned to a consistent baseline. The camera has a 160-pixel visual margin to keep tall characters visible at arena edges; the arena remains 3200 × 3200, movement/collision limits are unchanged, and zoom remains 1.

## Checks completed

- TypeScript type check and production build passed. The build retains Vite's existing large-Phaser-bundle advisory.
- No errors or warnings in a fresh browser session through selection, upgrades, companion acquisition, pause, repeated restart and return to selection.
- Both playable characters launch through mouse selection and 1/2 plus Enter. All movement-direction animations and Mystery's walking/pouncing frames were inspected on the development contact sheet.
- Mystery was acquired through the upgrade UI. Subsequent ordinary combat collected XP and opened another level-up screen.
- Paused screenshots taken at different times were byte-for-byte identical. Escape resumed the run.
- Multiple restart cycles reset health, level, kills and time, retained Hailey, and correctly returned to the selection screen.
- Title, HUD and upgrade layouts checked at 1280 × 720 and 800 × 600. Title and upgrade controls also fit at 1920 × 1080; gameplay was inspected at that size.
- River crossing, ponds, foliage fading and the arena edge inspected. A clipped character at the original camera edge was corrected with the visual margin.
- Production preview starts normally even with a development review query; F2/F9 review controls are absent there.
- Reduced-motion support uses the system media query in the renderer and stylesheet. The OS preference was not changed during this check.

## Performance comparison

Both versions were measured in the same browser at 1280 × 720, with a development fixture starting with 180 enemies and 220 XP pickups. Test-only health and XP thresholds kept the scene running without an upgrade pause.

| Version | Approx. frame rate | Mean frame time | 95th percentile |
| --- | --- | --- | --- |
| Original code at 8e30d7f | 60.0 FPS | 16.7 ms | 16.7 ms |
| Storybook overhaul | 60.0 FPS | 16.7 ms | 16.8 ms |

The redesigned run was observed beyond 1:40 of combat. No sustained regression was observed on this machine. This is a local measurement, not a guarantee for other hardware.

## Development review controls

F2 opens sprite adjustments. F9 toggles frame timing and object counts. They are disabled in the production build.

The development server accepts `?review=sprites`, `upgrades`, `companion`, `crowd`, `gameover`, `river`, `pond`, and `edge`. Add `&character=hailey` when useful. F10 ends a test run only on the development `gameover` review route, making repeat restart checks reproducible. These routes do not activate in production.

Final representative screenshots are in `artifacts/screenshots/title.jpg`, `gameplay.jpg`, and `upgrades.jpg`. Additional inspection shots and the original-code comparison fixture remain under ignored `artifacts/`. Generated artwork paths and all generation prompts are documented in [artwork.md](artwork.md).

No balance change or character image replacement was performed. Local verification was completed before publication.
