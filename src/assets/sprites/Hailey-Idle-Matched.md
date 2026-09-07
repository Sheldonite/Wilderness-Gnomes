# Matched Hailey idle

Active asset: `Hailey-Idle-Matched.png`. Generated using the built-in image generation tool, with the original `Hailey-Walk.png` as the design reference. The previous idle image is retained as an unused source variant.

The game fits the artwork to the existing walk canvas and foot baseline. Breathing moves by at most one source pixel vertically.

## Pose prompt

Edit the attached original sprite strip with maximal fidelity. Return a single isolated standing sprite derived from the FIRST sprite on the left. Keep its head, face, hair, ears, bow, torso, shirt design, arms and hands visually identical to the original first sprite. Modify ONLY the legs below the shorts to put both blue sneakers down flat side-by-side, standing still. Do not redraw into a different style, do not upscale the character detail, do not change proportions. The original sprite is compact, 145 pixels wide by 257 pixels tall. Output a 145x257 transparent PNG if possible. Retain the original fine pixel detail, small eyes, small mouth, large head with wide ears, short torso and short legs. Do not enlarge face or lengthen legs. No checkerboard rendered into image, true transparent background. The image must look like it was cut straight from the supplied game sprite sheet, with only its leg stance changed.

## Transparency refinement prompt

Background extraction only. Remove the entire white and pale checkerboard background from the attached sprite and replace it with actual alpha-channel transparency. Output transparent RGBA PNG, not RGB. Preserve EVERY part of the character exactly, including all original pixels, colors, size and proportions. Do not redraw or restyle the character. All checkerboard pixels surrounding the sprite and between her legs must become fully transparent. No shadows or new background.
