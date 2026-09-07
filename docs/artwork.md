# Generated storybook artwork

Created with the built-in image generation tool. Original character and animal image files are unchanged; sprite cropping and alignment are corrected by the game renderer.

Final assets:
- `src/assets/storybook/woodland-title.png`
- `src/assets/storybook/moss-ground.png`
- `src/assets/storybook/woodland-props-source.png`

The foliage source uses a magenta matte decoded once at loading because the generation tool returned a painted checkerboard rather than alpha transparency. Original generated files remain intact.

## Prompts

### title

Use case: illustration-story. Asset: wide 16:9 main menu background for Wilderness Gnomes, a premium cozy fantasy game. Create a beautiful hand-painted golden-hour enchanted woodland clearing, evocative gouache illustration, sophisticated natural colors. Ancient oak trees and fern-covered roots frame far left and right; warm honey sunbeams from upper right through soft moss-green leaves; distant luminous glade and meandering pale footpath through the center; tiny cream wildflowers and red mushrooms only along bottom corners. Composition: CENTER 65 PERCENT AND LEFT-CENTER are quiet softly lit open forest space for separate UI title and character cards. Rich details at outer edges only. Ground view gently elevated, whimsical storybook depth, soft brushwork with crisp authored shapes. Fern green, muted olive, gold, warm cream, bark brown. No people, no animals, no characters, no letters, no logo, no lettering, no buttons, no interface, no borders. Full-bleed wide landscape.

### ground

Use case: stylized-concept. Asset: seamless square top-down ground texture for a 2D storybook woodland game, moss-green golden-hour palette. Hand-painted gouache, soft broad organic areas of pale sage moss and muted fern grass, sparse tiny subtle clover and warm earth flecks. Flat orthographic straight-down view. VERY QUIET and LOW CONTRAST: large smooth irregular color patches, minimal fine detail, no dramatic highlights or shadows, no dark spots, no recognizable repeating focal objects. No trees, bushes, rocks, flowers, water, paths, characters, text, borders or horizon. All four edges tile seamlessly. Premium illustrated game terrain with soft brush texture, balanced muted green overall.

### props

Use case: stylized-concept. Asset: transparent-background sprite atlas for a 2D top-down / three-quarter-overhead enchanted woodland game. Wide 1536x1024 canvas divided into an exact 3-column by 2-row invisible grid of 512x512 equal cells. Each isolated object centered within its own cell with generous transparent margin, complete uncropped object, no overlaps. Row 1: cell 1 a full leafy rounded golden-green oak tree with visible trunk and roots; cell 2 a full slender sage-green birch tree with white bark; cell 3 a full deep fern-green fir tree. Row 2: cell 1 a low cluster of rounded gray moss-covered stones; cell 2 a low clump of lush ferns and delicate cream-gold wildflowers; cell 3 a low cluster of red-capped mushrooms and grass. Soft hand-painted gouache storybook game art, coherent elevated orthographic perspective, warm top-left light, muted moss and fern colors, honey-green highlights, warm brown bark, subtle soft grounding shadow. Clean isolated silhouettes, no background scene, no labels, no grid lines, no text. Real transparent alpha background, not a checkerboard drawing.

### Atlas refinement

Edit this sprite atlas for production use. Remove every bit of the blurry green/yellow background and replace it with REAL transparent alpha (not drawn checkerboard, no colored backdrop). Preserve these six painted object designs and all their details. Arrange them in an exact 3 columns by 2 rows grid with equal cells on a 1536 by 1024 canvas. Each complete tree must fit ENTIRELY inside its top-row 512x512 cell with 30px transparent margin. Shrink trees to fit. Rocks, ferns, mushrooms fit in bottom-row cells with same padding. No cast shadow outside objects. Do not change the art style. Only six isolated objects, transparent between and around objects.

### Final atlas matte

Production sprite atlas edit: KEEP exactly these six objects, their scale, colors, positions and style. Replace ALL the gray-and-white checkerboard background with a single perfectly FLAT uniform pure MAGENTA RGB 255,0,255 (#ff00ff). This is a chroma-key sprite atlas for a game engine which handles transparency at render time. No gradients, glow, shadows, texture, checkerboard, or color variation in the magenta background. Preserve clean natural object edges, do not recolor any object. Keep 1536x1024 size and current 3-column, 2-row layout. Every space between branches/leaves and around objects must be solid magenta.



Additional final assets:
- `src/assets/storybook/stream-water.png`
- `src/assets/storybook/timber-bridge-source.png`
- `src/assets/storybook/heartwood-crossbow.png`

## water

Use case: stylized-concept. Square seamless texture for the surface of a shallow woodland stream in a painted storybook game. Strict top-down orthographic view of water ONLY, covering the ENTIRE image. Muted sage-teal water, soft subtle honey-gold sunlit ripples, transparent-looking gentle variations, brush-painted organic surface. Low contrast natural irregular ripples, fine soft watercolor and gouache detail, very calm. No shore, no banks, no plants, no rocks, no objects, no text, no border, no perspective horizon. All edges tile seamlessly. Premium hand-painted game texture. Predominantly subdued teal green, not bright cyan.

## bridge

Use case: stylized-concept. Isolated production game sprite of a charming rustic wooden footbridge, crossing horizontally LEFT TO RIGHT. Strict overhead elevated orthographic view, suited to a 2D woodland game. Whole bridge fully inside a wide 2:1 composition with generous margin on every side. Twelve weathered honey-brown irregular timber planks span vertically in the image, with two low rustic wooden rails along the top and bottom edges, small posts, subtle moss at ends. Painted storybook gouache style, warm golden-hour light from upper left, crafted natural details, worn grain, soft organic edges, no photorealism. Nothing underneath the bridge: NO water, river, terrain or landscape. Background is perfectly solid pure magenta #ff00ff for chroma-key use, including gaps between rails and posts. No cast shadow outside the object. No text, no labels.
