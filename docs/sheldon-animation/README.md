# Sheldon

Playable from the character-selection menu (keyboard shortcut 5), with four idle and eight walking frames for each of eight directions. Stopping preserves the last facing direction in combat and Market Day. Idle frames use a brief blink and longer breathing poses; walking runs at 10 fps.

## Assets

- `src/assets/sprites/sheldon/sheldon-atlas.png`: final 2304 × 2048 transparent atlas, 192 × 256 cells, 12 columns and eight direction rows.
- `src/assets/sprites/sheldon/approved.png`: the user-approved character reference.
- `src/game/core/SheldonFrames.ts`: direction order, frame IDs, and indices.
- `src/game/config/sheldonSprite.ts`: production asset loading and animation timing.
- `prompts.json`: prompts used with the built-in image_gen tool. No fallback API was used.

The spritesheet exports the exact rendered frames reviewed by the critic. It replaces loading the draft sources and assembling an atlas at game startup. Generated source drafts and extraction scripts are retained locally under `artifacts/hiker-animation/authoring`; they are not required to run the game.

## Review and validation

`review.md` and `review.json` contain all 96 final scores, reasons, suggested refinements, and review-pass numbers. Rejected frames were regenerated and reviewed again until every frame scored 8/10. The critique compared individual rendered screenshots and ordered poses to the approved reference. It did not independently audit continuous video playback.

All 96 exported production frame PNGs matched the accepted frame PNGs by SHA-256. Browser checks verified all eight walking directions, matching directional idle on release, crossbow integration, Market Day movement, and three character cards fitting a 390-pixel-wide viewport. All 111 automated tests and the production build passed.

For a local development review, open `/?review=sheldon` and choose a direction; `&motion=1` shows the live loop alone. The development review page is not activated in production builds.
