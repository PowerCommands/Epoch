# Classic unit sprite refresh

Tool: built-in image_gen.

Target assets:
- `public/assets/sprites/units/longswordsman.png`
- `public/assets/sprites/units/horseman.png`

Style reference: `public/assets/sprites/units/cavalry.png`.

## Longswordsman prompt

Use case: style-transfer. Asset type: transparent PNG unit sprite for a historical strategy game. Image 1 is the EDIT TARGET longswordsman; image 2 is Cavalry, the STYLE REFERENCE ONLY. Repaint image 1 as a richly shaded, classic hand-painted miniature matching the natural brown leather, warm steel, realistic dimensional materials and restrained highlights of image 2. Replace its flat black silhouette and yellow outlines with modeled medieval steel plate armor, chainmail, dark brown leather, muted burgundy cloth and a readable polished steel longsword. Keep EXACT image-1 pose, silhouette, proportions and normalized locations: helmet at (0.50,0.17), shoulder and sword hand near (0.445,0.327), sword extends diagonally down-left to (0.21,0.67); boots around (0.45,0.84) and (0.56,0.89). Same small full-body figure occupying the same area in the square canvas. Preserve the sword angle, grip, legs, facing and transparent margins so the existing sword animation still aligns. No horse, no extra weapons or props, no ground/base, no text. Fully opaque painted character with genuinely transparent alpha background, no glow, no pale wash, no flat outlined/cartoon/vector look. Output one square PNG.

## Horseman prompt

Use case: style-transfer. Image 1 is the horseman EDIT TARGET, image 2 the Cavalry STYLE REFERENCE. Produce a single square game sprite: repaint the horseman in the classic, dimensional hand-painted miniature style of Cavalry, with richly modeled chestnut coat, darker mane, brown leather tack, natural steel armor, subtle bronze fittings, deep shadows and restrained highlights. Preserve image 1 pose, facing left, proportions, positions and transparent margins exactly; rider head at (.52,.18), horse head (.32,.43), visible front leg root (.45,.65) hoof (.45,.91), rear leg root (.675,.565) hoof (.67,.78). Full horse and helmeted medieval rider. Do not use Cavalry's hat, firearm or right-facing pose. No ground, no text, no frame, no glow, no washed-out highlights, no flat vector outlines. Background MUST be true transparency in the alpha channel, not a rendered checkerboard pattern. All subject pixels must be opaque; only background transparent. Match the warm realistic painterly material detail and visual weight of Cavalry.


## Integration

The user authorized local background removal. Neutral checkerboard pixels were removed with Pillow, the main painted component retained, tiny highlight pinholes closed, and the alpha-preserving sprites reduced to 256 × 256 with Lanczos. Original generated sources and full-resolution transparent versions are in `output/imagegen/classic-units/`. Only Horseman and Longswordsman were replaced; their lightening filters were removed and the Longswordsman sword cutout was realigned.
