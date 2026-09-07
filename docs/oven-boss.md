# The Taco Toaster

The first boss arrives once per run when play resumes at level 10 or higher. He uses scenery navigation, stomps to a 160-pixel throwing distance, and throws three flaming tacos at fixed, marked landing spots. There is an 800ms windup and 1100ms flight, with no damage until impact. Overlapping blasts deal only one 18-damage hit per volley. Below half health, the pause between attacks falls from 3000ms to 2200ms. Health is 1200; defeating him awards one kill and a 120-XP crystal, cancels all pending attacks, and shows a brief victory message. Balance is centralized in `src/game/config/ovenBoss.ts`.

Existing spells, abilities, and both cats can damage him through the shared defeat handler. Pause, upgrade menus and game over freeze his encounter. Restart clears the boss, warning markers, taco sprites and health bar. Three taco images are reused. Reduced motion removes decorative taco spinning without changing flight or timing.

Development review: `?review=oven`, optionally with `&character=hailey`. Reach level 10 opens the real upgrade menu; selecting an upgrade starts the encounter. The other controls exercise movement, defeat, and restart. Review controls are absent from production.

## Artwork

Final asset: [taco-toaster-source.png](../src/assets/sprites/taco-toaster-source.png). Generated using the built-in image-generation tool. The returned PNG has genuine alpha transparency, retained unchanged. The game registers trimmed frames for walking, winding up, throwing, and the taco projectile. Existing character artwork was preserved.

Final generation prompt:

Use case: stylized-concept. Production game sprite atlas for a whimsical woodland RPG boss: a WALKING OVEN that throws flaming tacos, called The Taco Toaster (do not render any text). Exactly 4 columns and 2 rows, 8 isolated sprites with generous empty gutters in a landscape 2:1 canvas. Top row: FOUR sequential walk-cycle poses of the SAME anthropomorphic squat vintage cast-iron cooking oven, three-quarter front view, chunky brown boots taking alternating steps, stubby oven-mitt arms, two expressive glowing amber eyes above an orange-glowing oven-door mouth, little stovetop burners, brass trim, dark teal iron. Charming grumpy chef attitude, funny and friendly fantasy villain. Bottom row: first THREE cells repeat that same oven in wind-up, throwing with one mitt extended, and cooling-off poses. Bottom row FOURTH cell: a single large airborne flaming taco, crunchy curved golden shell, visible lettuce tomato cheese filling and vivid orange yellow flame tail; no oven in this cell. Consistent scale and boot baseline among all seven ovens. Small outlined pixel-art RPG sprites with warm illustrated shading; readable when drawn at 90 pixels tall. No ground shadows, no scenery, no text, no labels, no cell outlines, no brands, no checkerboard. Background deliberately perfectly uniform opaque chroma magenta #FF00FF for game-engine keying. Keep all limbs and flames inside their cells. Oven construction and facial design identical in all poses.

## Verification

All 40 automated checks, TypeScript validation, and the production build passed. Browser checks covered the actual level-9 to level-10 upgrade flow with Hailey and Code Wizard, combat with both companions, the warning/throw cycle, a normal defeat with one kill and 120 XP, forced defeat during a windup, and restart to level 1 with no boss UI. Paused warning screenshots were byte-identical after the overlay settled. Inspected the layout at 1920x945 and 800x600; browser errors and warnings were empty. Representative screenshot: `artifacts/screenshots/taco-toaster-boss.jpg`.

## Grounded walking presentation

The oven is now drawn at 160 pixels instead of 100. His origin and trimmed frames share a boot baseline, and his shadow uses an explicit ground offset with a darker contact ellipse. The walk alternates left-step, planted, right-step, planted poses according to actual distance traveled (48 pixels per cycle); stopping or hitting an obstacle plants the boots. Horizontal movement turns the sprite. Shadow objects are reused and cleaned up with the actor. These presentation changes preserve the boss combat rules and scenery navigation. All 45 tests and the production build pass.
The development-only `?review=oven&look=1` view places him in the clearing for checking scale, feet, shadow, and walking. Visually checked at 1280x720 with no browser errors; saved `artifacts/screenshots/taco-toaster-grounded.jpg`.
