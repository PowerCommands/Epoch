# Globe navigation

Press **G** to smoothly pull out to the planetary view. Drag to turn the globe;
**A/D** or **Left/Right** rotate it, and **W/S** or **Up/Down** tilt it (limited
to approximately 79 degrees each way). A and S do not issue unit commands in
this mode. Text input and modal dialogs capture their own keyboard input.

Scroll inward to approach the region at the globe's centre. G returns to the
previous zoom, looking at the current region; without rotating, it returns to
the original region. Zooming outward with the wheel also enables globe
navigation. Ordinary map zoom retains its mouse anchor.

The authored map occupies one complete revolution of longitude, so its east
and west edges meet visually on the globe. Its painted hex-grid parallelogram
is stretched over all longitudes and from pole to pole; the empty corners of
the rectangular camera bounds are excluded. The mapping uses the outer tile
centres to avoid unpainted pockets along the jagged hex outlines. Rotation is visual state only: tiles, adjacency,
movement, AI and saves retain the finite map. Zooming inward on either side
of the visual seam approaches that side of the finite map. Picking uses the same inverse
rotation as the shader; space outside the sphere or uncaptured source image
cannot be selected. The minimap shows an approximate surface footprint.

The existing WebGL planetary filter supplies the globe, lighting and smooth
curvature transition. Canvas fallback keeps ordinary map navigation.

Validation:

```sh
npm run typecheck
node --import tsx tools/planetaryProjection.test.ts
# With Vite running on port 5174 (override with EPOCH_URL):
node tools/planetaryZoom.browser.mjs
```

The browser checks start a fresh game by default; `EPOCH_SAVE` may point to a
compatible save. They compare rendered markers against hover and world picking,
exercise G, wheel, drag, keys, UI gates and resize, and check that navigation
does not change units, cities or the turn.
