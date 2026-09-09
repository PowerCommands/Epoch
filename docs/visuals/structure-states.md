# Structure visual states

Buildings and Wonders resolve their map artwork from existing tile construction records and the existing broken-state provider. Construction uses the normal sprite and a shared translucent sign. Completed broken structures use `<id>-broken.png`; repairing them restores `<id>.png`. No visual state is saved.

Cities resolve `city_<current era>[-broken].png` from the owner's current era and `health <= CITY_BASE_HEALTH / 2`. The maximum city health remains unchanged. Health, healing, research, ownership and save-restoration refreshes use the existing CityRenderer entry points.

`StructureDamageEffects` shares its smoke/fire drawing function with Improvement destruction. Each persistent renderer has one optional graphics surface, one update listener, a 25 Hz drawing limit, camera culling and a maximum of 32 animated visible sites. Tiny flames are intermittent and disabled for water structures. Damage sprites remain visible independently of animation. Repair, removal, visibility changes, rebuilds and shutdown release effects; texture-loader callbacks are detached on shutdown.

Assets live in `public/assets/sprites/{buildings,wonders,cities}/` with the `-broken.png` suffix. The shared sign is `public/assets/sprites/overlays/under-construction.png`. Map-rendered legacy Solar Plant and Barbarian Camp artwork is also covered. City-only Walls, Castle, Arsenal and Nuclear Silo do not render individual structure images on the map, so their normal city/fortification presentation is retained.

## Generation

Artwork was generated using the built-in imagegen tool, one reference-based edit per sprite. With explicit user authorization, 72 opaque outputs were cleaned using the existing `tools/rembg-pipeline/process.py` and its U2Net model. A detached matte remnant beside the Great Wall was removed from its alpha channel after visual review. Original normal artwork was not replaced. `scripts/prepareStructureDamageAssets.mjs` only exports canvas dimensions matching the source aspect ratio, capped at 512 pixels for map texture memory.

The prompt template below substitutes each relative source filename for SUBJECT:

```
Use case: precise-object-edit. Edit target: the supplied Epoch map sprite, SUBJECT. Produce a dedicated broken counterpart showing significant physical damage: shattered surfaces, partially collapsed architectural elements, charred broken sections and small debris appropriate to this structure. Retain at least 75% of its recognizable silhouette, same architecture, perspective, palette, footprint, placement and framing. Match original game illustration style. Fully transparent background outside original object and base, no background rectangle or scenery. No text, no smoke clouds or flames (animated separately). Preserve original aspect ratio and relative object scale. REQUIRE real PNG alpha transparency: empty background pixels must have alpha zero. NEVER paint a gray/white checkerboard, black matte, or white matte. Keep the entire background truly empty.
```

Wonder prompts append: `This is a World Wonder. Keep its landmark identity unmistakable, with visibly damaged characteristic architecture. No replacement generic ruins.`

City prompts append: `This is a badly battle-damaged but STILL FUNCTIONING city, not an empty ruin. Preserve the flat-shaded low-detail geometric isometric city style exactly. Keep era-specific center landmark and city silhouette, damage several roofs, walls and windows with missing chunks and charred interiors. No photo-real textures or stylistic redesign.`

The first Granary edit used: `Use case: precise-object-edit. Edit target: Epoch isometric granary map sprite. Create its broken damaged counterpart. Preserve exact framing, size, perspective, architectural identity and footprint; broken roof beams, partial collapsed roof and charred wall, scattered small debris within original footprint. Recognizable nonfunctional granary. Preserve transparent background and alpha; no labels, no added background, no baked smoke beyond silhouette. Output PNG.`

The shared sign prompt: `Use case: stylized-concept. Asset: reusable small Epoch strategy map UNDER CONSTRUCTION sign. A single front-facing horizontal antique brass-edged dark charcoal plaque, simple warm ivory bold uppercase lettering reading exactly UNDER CONSTRUCTION on ONE LINE. Ratio 4:1. Tight framing around plaque, tiny transparent margin. Fully transparent background outside plaque, crisp readable typography at small sizes, subtly weathered brass edging matching isometric historical strategy game UI. No posts, no structure, no other objects or symbols, no backdrop, no perspective distortion. Output transparent PNG.`

## Verification

```
npm run typecheck
node --import tsx tools/structureStateGameplay.test.ts
node --import tsx --test tools/structureDamageAssets.test.ts
npx vite --host 127.0.0.1 --port 5174 --strictPort
# In another terminal:
node tools/structureVisuals.browser.mjs
node tools/improvementVisuals.browser.mjs
```

The browser gallery checks construction/completion, broken/repair, restored canonical state, every asset, the inclusive city health threshold, all city eras, visibility/removal/shutdown, and 100 break/repair cycles with 96 damaged structures. It records timing and saves `/tmp/epoch-structure-states.png` for review. The asset test rejects copied artwork, missing sprites, oversized textures and opaque backgrounds (including painted checkerboards).

### Current verification status

TypeScript, the production build, structure gameplay tests, browser state/lifecycle checks and the existing Improvement visual regression pass. The Improvement regression also loaded an existing save with 664 Improvements and found stable object counts. The structure stress test averaged about 0.09 ms per rebuild in this test environment; this is a fixture measurement, not a full-game performance guarantee.

All 90 asset checks pass: 89 dedicated damaged sprites and one shared transparent construction sign. Every exported sprite retains its source canvas aspect ratio and is at most 512 pixels. The complete asset set was visually inspected over a terrain-colored background after cleanup. No opaque/checkerboard backgrounds remain.

The gameplay tests also exercise the real save-loader entry points for construction records, broken CityBuildings, broken Wonders and city health, including loading normal state over damaged state. Browser tests additionally verify that late texture responses use current state and that pending completion/error callbacks are detached on shutdown.

A map-scale preview is saved in [structure-states-preview.png](structure-states-preview.png).

An unrelated existing terrain-building test fails because it expects Hotel modifiers `{ goldPerTurn: 5 }`, while the current definition also includes `goldPercent: 25`. This visual change does not modify those modifiers.
