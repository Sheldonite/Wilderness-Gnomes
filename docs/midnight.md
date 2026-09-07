# Midnight companion

Midnight is a separate, optional level-up recruitment, available to either wanderer. Mystery and Midnight can join the same run. Midnight follows on the player's right; Mystery keeps her existing pounce and follow behavior. Midnight does not unlock or inherit Mystery's Double Pounce upgrade.

## Behavior

Midnight walks at 260 pixels/second toward living enemies within 200 pixels of the player and returns when more than 280 pixels away. She stops within 42 pixels to swat, keeps her feet planted for the 480ms animation, and hits at 240ms. The strike deals 22 damage to enemies intersecting a 120-degree forward arc of radius 62; the cooldown is 1500ms from the start of the swat. The attack uses the shared defeat gate, so overlapping spells and companion attacks cannot duplicate kills or XP. Pause freezes her movement, animation and swat effect. Restart clears her recruitment, sprite and attack state.

Values are centralized in `src/game/config/balance.ts`. No existing character images were replaced. Both cats participate in foreground-foliage fading and ground-shadow rendering. The pause menu identifies recruited companions and their attack styles.

## Artwork and prompts

Final project asset: [midnight-spritesheet-source.png](../src/assets/sprites/midnight-spritesheet-source.png).

Created using the built-in image-generation tool. Midnight's supplied photograph was visually inspected to describe her green eyes, caramel right forehead/cheek, darker left face and muzzle, black lower legs and subdued tortoiseshell coat. The successful generation used Mystery's existing sprite sheet as a style reference plus that written marking description; the tool could not read the large original photo file directly. The photograph and unused initial draft remain in ignored local artifacts, not the game bundle.

The generated transparency preview contained a painted checkerboard. A second built-in edit replaced it with a magenta matte. The game decodes that matte once during loading, detects actual sprite gutters, and aligns feet through frame metadata. This preserves the generated cat pixels without a checkerboard, clipped neighboring frames, or per-frame stretching. Left-facing artwork has its own frames to retain asymmetric coat details.

### Sprite-generation prompt

Use case: stylized-concept. Production sprite atlas of MIDNIGHT, a female tortoiseshell cat. The supplied reference is Mystery's existing sprite art, for matching style, proportions, perspective and detail density ONLY. Midnight is a different real cat whose photo has been inspected: follow the detailed coat description below closely. She is noticeably darker and less orange-speckled than Mystery. Her right side of the forehead/face (viewer LEFT when facing forward) is warm caramel; her left side (viewer RIGHT) is mostly black. Her broad black nose bridge and black muzzle are especially distinctive. Her chest is mostly black with a narrow uneven mottled tan band and sparse tan flecks. Her body has subdued brindled patches, with black paws. Match that small crisp outlined pixel-art woodland RPG cat, not a large-headed cartoon. Midnight has green almond eyes, black fur with finely mottled caramel/gold patches, a prominent caramel blaze across her right forehead, eye and cheek (viewer LEFT in the front photo), a blacker left forehead, eye and cheek (viewer RIGHT), a black nose and muzzle, mostly black lower legs, warm flecks on her chest. No collar or clothes. Preserve this face asymmetry across all poses. ONE atlas, exactly FOUR COLUMNS by EIGHT ROWS, 32 isolated full-body sprites at identical scale, a perfectly regular grid with equal square cells and generous transparent gutters. Portrait canvas aspect ratio 1:2. Actual transparent alpha background, no painted checkerboard, no text, no labels, no shadows, no cell dividers. First four rows: four-frame WALK cycles facing DOWN toward viewer, RIGHT, UP away, LEFT. Last four rows: stationary four-frame front-PAW SWAT cycles facing DOWN, RIGHT, UP, LEFT. Each walk row alternates paws with consistent body size and foot baseline. Each swat row has ready pose, raised forepaw, strongly extended forepaw striking forward, recovered pose. Hind feet planted, torso stationary. No jumping, lunging or pouncing. Each of the four frames in a row faces the same direction. All ears, tails and extended paws fit comfortably in their cells.

### Background-edit prompt

Edit this sprite atlas. Change ONLY its background: replace every light gray/white checkerboard square and all empty space with a perfectly uniform solid chroma-key magenta #FF00FF (RGB 255,0,255). Opaque magenta is intentional for game-engine transparency keying; do NOT draw a checkerboard or white/gray halo. Preserve all 32 cat sprites, their exact poses, pixel style, black/caramel fur, green eyes, positions, sizes, and the four-column/eight-row layout. Do not repaint cats or add any details. No text, no border, no shadows. Output the same portrait 1:2 composition. Keep a clear magenta gutter between all cells, without clipping ears, paws or tails.

## Review and checks

- `?review=midnight-sprites`: all four walking and four swatting animations, plus a size comparison with Mystery.
- `?review=midnight-upgrade&character=hailey`: choose her real recruitment card using mouse or 1/2/3.
- `?review=midnight`: isolated companion combat.
- `?review=companions`: both cats together. Append `&character=hailey` for Hailey.
- Companion review controls exercise movement and game over; restarting begins an ordinary run. All fixtures are development-only.

The automated suite contains 29 checks, including independent recruitment/reset, bounded approach speed, planted feet, one hit at the swat frame, all four directions, front-arc targeting, missed/dead targets, leash return, cooldown and shared kill accounting. Run `npm test` or `node tests/run.cjs`.

Manual verification: inspected all four walk and swat directions after correcting frame gutters. Recruited Midnight using the 1 key with Hailey; checked recruitment cards at 800x600 and 1280x720. Exercised both companions together with movement, confirmed both pause labels, and compared paused screenshots byte-for-byte (identical). Ending and restarting restored level 1, 100 health, and no companions. Browser error/warning logs were empty. Production preview loaded the normal title with review fixtures disabled. All 29 automated checks, TypeScript validation, and the production build passed.

Local screenshots: `artifacts/screenshots/midnight-upgrade.jpg` and `artifacts/screenshots/midnight-gameplay.jpg`.
