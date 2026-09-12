# Planetary zoom

Zoom out past the existing map overview to bend the world into a hemisphere.
Wheel zoom eases through the transition; drag, keyboard pan, and minimap focus
continue to navigate the flat world. At maximum altitude, east/west panning
reveals the other parts of the map. Space outside the limb has no tile hits.
The Canvas renderer retains the flat map and its previous minimum zoom.

## Rendering

`PlanetaryRenderer` adds a custom Phaser 4 `BaseFilterShader` / filter controller
to the main camera's internal filters. Terrain, fog, borders, cities, buildings,
units, and world labels are composited together before projection. HUD cameras
remain separate. The filter is removed entirely at normal zoom.

An inverse orthographic spherical-cap projection grows continuously from zero
curvature. The shader samples the existing viewport texture, with directional
shading and a narrow atmospheric limb. No cloud layer obscures unexplored land
or world labels. The map remains finite: there is no repeated geography or
spherical gameplay topology. Longitude covers a hemisphere at maximum altitude;
this is a visual approximation, not a geospatial conversion of the hex map.

The inverse projection is also applied by the camera's `getWorldPoint`, used by
both Phaser object hit tests and Epoch's tile selection. Drag and wheel anchors
use the same mapping. Camera bounds and the minimap footprint account for the
visible hemisphere. Dimensions and zoom thresholds are calculated from the
current viewport, including after resize.

One viewport-sized GPU pass is added at far zoom. Camera motion updates a fixed
number of uniforms; it does not rebuild tiles or allocate a map-sized texture.
The existing `GeometryClip` flushes stencil restoration without calling
`DrawingContext.use()`, which would auto-clear a pooled camera framebuffer.
This small prerequisite fix preserves all previously rendered layers.

## Validation

- `node --import tsx --test tools/planetaryProjection.test.ts`
- `npm run typecheck`
- With Vite on port 5174: `node tools/planetaryZoom.browser.mjs`
- Existing WebGL/Canvas coverage: `npm run test:phaser-migration:game`

The browser check uses `autorun-output/latest-save.json` by default. Set
`EPOCH_SAVE`, `EPOCH_URL`, `CHROME_PATH`, or `EPOCH_TEST_OUTPUT` to override it.
It captures four zoom stages and landscape/portrait resize screenshots, checks
that actual terrain survives compositing, finds a rendered marker in screenshot
pixels and verifies sprite/hex picking at that point, checks save-state
invariance, and reports CPU render timings with/without the filter at the same
zoom. Timings are environment-dependent and are not a GPU benchmark.

The projection is deliberately hemispheric: the rear surface is not visible
at once, and heavily foreshortened labels near the limb are less readable.
Zooming inward restores the normal strategic view.

For additional live map dimensions, run
`EPOCH_PLANETARY_MAPS=world,scandinavia node tools/planetaryZoom.browser.mjs`.
These checks restart the scene and use the existing `fog off` cheat solely in
the test browser to make the terrain visible for screenshot review.

Validated on the Maritime Expansion save, World (15,000 tiles), and Scandinavia
(11,250 tiles), plus four pure-projection aspect-ratio cases. The existing
WebGL and Canvas game/HUD/save-reload regression checks also passed. In the
isolated local Chromium sample at 1440×900, median CPU render submission was
12.3 ms without the filter versus 12.5 ms with it at the same far zoom. This
measures submission time, not GPU execution; hardware profiling remains useful.
