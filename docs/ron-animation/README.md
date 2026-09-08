# Ron sprite and animation set

Ron now uses the same atlas format and playback timing as Sheldon: eight directions, four idle frames and eight walk frames per direction (96 frames, 16 loops). The 2304 x 2048 RGBA atlas uses 192 x 256 cells. Stopping retains the last facing; the controller disables procedural stretching for these baked frames. Market Day uses the same foot anchor and animations.

Artwork was generated with the built-in image_gen tool using the user's Festive Bard image for Ron's identity and Sheldon's approved sprite for pixel style and proportions. The existing procedural Ron generator and its output are retained as legacy assets; gameplay loads `src/assets/sprites/ron/ron-atlas.png`.

## Rebuild and review

Source images are saved in `sources/`, in direction order south, southeast, east, northeast, north, northwest, west, southwest. Run `node scripts/pack-ron-sprites.cjs` with `pngjs` and `sharp` available (or set NODE_PATH to their installed package directory). This imports generated art, removes the source backdrop, and aligns cells to sole y=238 with a fixed scale per direction. It does not procedurally draw or invent character poses. `bounds.json` records every packed rectangle.

Development preview: `/?review=ron-sprites&direction=south`; add `&motion=1` for the loop view. All preview frames come from the production Phaser texture.

## Validation

Production build and 180 automated tests pass. Browser playback checks verify the eight walk frames and four idle frames in each direction. The atlas has transparent margins and no cell clipping. Visual inspection confirms outfit and directional silhouettes. Generated gait phases still have some variation in head/torso shape and stride spacing; this is an initial animation set, not a frame-by-frame artistic sign-off equivalent to Sheldon's later head-lock correction pass.

## Prompt set

Built-in image_gen; no fallback API. The initial south prompt requested exactly twelve complete sprites in a four-column by three-row grid with a transparent background, four breathing/blinking idles then eight chronological walking poses. The returned south source had a rendered pale checker backdrop, which the importer removes by edge-connected flood fill while retaining the enclosed ivory shirt. Subsequent directions requested solid cyan for reliable keying.

Common prompt: Production pixel-art RPG animation source for Ron the Festive Bard. Preserve the reference's cheerful clean-shaven adult face, swept-back short black hair, open forest-green festive jacket with small colorful shoulder tassels, loose ivory open-neck shirt, patterned waist sash, baggy plum trousers, black leather boots, and decorated wooden staff with red, blue and gold ribbons. Use Sheldon's adult big-headed proportions, warm dimensional pixel shading, dark outline and slightly elevated game camera. Do not copy Sheldon's hat, beard or clothing. Twelve full-body sprites, four columns by three rows, no text, scenery, grid lines or ground shadow; generous margins around staff and ribbons. Stable face, head size, torso volume and outfit. Top row: open-eyed idle, breathing, brief blink, recovery. Remaining eight: contact A, recoil A, passing A, up A, opposite contact B, recoil B, passing B, up B, natural low steps and free-arm counter-swing, stable staff grip and gentle ribbon follow-through. No running, stretching or duplicate poses.

Per-direction instruction: rotate the entire figure to south/front, southeast/front-three-quarter-right, east/right-profile, northeast/back-three-quarter-right, north/full-back with no face, northwest/back-three-quarter-left, west/left-profile, or southwest/front-three-quarter-left. Every cell in a source must keep that facing. Later sources use Ron's generated south sheet as the identity model and Sheldon's approved sprite as the style reference.
