# Living-world rendering

Ambient animation belongs entirely to rendering. `AmbientProfiles.ts` records an
explicit art decision for every shipped resource, improvement, unit, building,
Wonder and city sprite. No gameplay definition, saved entity, turn counter or
simulation RNG is modified.

`AmbientSprites` is owned by the Phaser scene. Existing renderers attach their
Images after installing the hex/circle clip. The Image remains authoritative for
texture changes, size, transforms, tint and interaction. A Phaser 4 render step
inside the existing GeometryClip draws a small Mesh2D in place of eligible
Images. It never changes the original Image's position or scale. Fixed topology
uses Phaser's ordered quad indices, allowing batching with normal sprites.
During organic rests the source Image draws as a single quad, avoiding idle mesh
submissions; the mesh is retained for the next gesture.

Art-specific cutouts move the worker’s pickaxe and linked arm bones, the cattle
head, the pumpjack beam and individual fishing boats. Each arm segment keeps its
length: the shoulder/elbow linkage follows the tool grip. Mesh influences are
reserved for small hands, tails, head details and foliage. Stance and grazing
cycles spend most of their time resting. Unit roles have distinct profiles;
workers use a jointed pickaxe work/rest gesture, ships heave rigidly on water, bowmen adjust their bow hands,
mounted units move the animal, and covert/strategic units stay still. Stored rice,
bananas, metals and relics remain still because their artwork depicts goods.

Wind installations and windmills use small scene-cached atlases derived from the
original PNGs. Painted blades, including red tips and wooden latticework, rotate
separately from their stationary bases. Only the small supporting surface hidden
by those blades needs reconstruction. These temporary textures are removed on
scene shutdown; source artwork and asset manifests remain unchanged.

Secondary activity uses shared Graphics layers at resource, improvement,
building, unit and city depths. It has no input handlers. Chimney/cooling-tower
anchors, flame colors, puff size, activity density and timing distinguish eras
and industries. City textures select their own era profile, preserving the
entire city silhouette. Damaged and unfinished structures have no operational
ambience. Existing damage effects remain authoritative.

The existing water surface is retained. `WorldAmbientRenderer` also draws sparse
wind-driven leaves over baked forest/jungle terrain; terrain textures themselves
remain fixed. Its former generic city smoke is replaced by the era profiles.

## Landmark decisions

| Wonder | Signature activity |
| --- | --- |
| Pyramids | Occasional low sand/dust drift near the base |
| Great Lighthouse | Narrow rotating lantern beam |
| Colossus | Passing birds; the statue's art has no water base |
| Hanging Gardens | Falling leaves at planted terrace edges; fixed stonework |
| Great Wall | Restrained movement along the path and passing birds |
| Oracle | Visitors and birds; the artwork has no exposed flame |
| Stonehenge | Rare birds and windblown leaves, fixed stones |
| Angkor Wat | Moat ripples and birds above the temple |
| Hagia Sophia | Birds above the domes and courtyard activity |
| Machu Picchu | Light hillside mist and drifting leaves |
| Forbidden City | Courtyard visitors; fixed tiled roofs |
| Taj Mahal | Reflecting-pool ripples and passing birds |
| Eiffel Tower | Slow, localized warm illumination |
| Statue of Liberty | Torch flame and birds above its landscaped land base |
| Big Ben | Restrained clock hands and clock-face light |
| Brandenburg Gate | Small passageway activity |
| Sydney Opera House | Harbor ripples and warm entrance light |
| Empire State Building | Crown and window illumination |
| Panama Canal | Lock-water ripples and quay activity |
| Hoover Dam | Outflow movement and spray |

## Limits and lifecycle

- One monotonic visual clock per scene; geometry updates at most 25 times/second.
  Raw frame timestamps avoid Phaser smoothed-delta slowdown on expensive frames.
  Pause, sleep and document visibility changes reset the frame timestamp.
- Per-object coordinate/ID hashes provide independent phases and gesture variation.
- Offscreen and hidden objects do not deform or emit. Undiscovered resources never
  register an Image. Current visibility is checked in addition to remembered art.
- A maximum of 192 live deformation meshes bounds geometry cost. Further objects
  retain source artwork and applicable secondary activity.
- Zoom below 0.45 disables detail; above it, amplitude and secondary opacity fade
  in. Rotor motion remains physically continuous while detailed rendering is used.
- Reduced-motion preference disables the new sprite ambience. Scene pause freezes
  its clock; game speed does not change that clock. Autorun disables it.
- Source texture changes dispose old meshes. Destroyed sprites unregister;
  shutdown disposes all meshes, shared surfaces, atlases and listeners.
- WebGL uses Mesh2D. Canvas draws the same deformation data with a bounded 4×4
  triangle grid (8×8 for smaller feature regions) and uses native transformed
  atlas cells for separated rotors and articulated parts.
  Both paths preserve GeometryClip and the original Image during organic rests.

## Validation and extending coverage

`npm run test:ambient` inventories the actual sprite folders, checks bounded
anchors, organic rests/independence, fixed cities/landmarks, and visual-only
source dependencies. Add an explicit profile or a documented stillness decision
when adding an asset; do not silently map new objects to generic motion.

With Vite running, `EPOCH_URL=http://127.0.0.1:5174 npm run test:ambient:browser`
creates before/after artwork galleries under `/tmp/epoch-living-world`, exercises
real GeometryClip and nested containers, and checks fog, overview, destruction,
texture changes, pause/resume, scene shutdown and a 1,000-object stress fixture.
`EPOCH_GALLERY_KINDS` can restrict gallery output to comma-separated categories.

`node scripts/visualWorldAmbient.mjs <save.json> <url> <output-dir>` captures normal
gameplay zooms, verifies saved gameplay data is unchanged after animation, and
measures combined ambient CPU cost. `EPOCH_URL=<url> node
scripts/verifyAmbientGameplay.mjs` compares enabled and disabled rendering across
save loads and scene restarts in WebGL and Canvas, and runs an autorun round.
The existing general migration test exercises real UI too, but its exact reload
assertion fails on the populated fixture because existing turn-start processing
moves an automated scout and heals a unit. The enabled/disabled control confirms
identical behavior in both cases; this visual change leaves that behavior intact. Headless
frame rates are environment-dependent; use the stress CPU metrics separately from
whole-game rendering time and assess target GPUs before setting an FPS guarantee.


Validation on the development host: all eight profile tests pass; production
TypeScript/Vite build passes; all sprite galleries and lifecycle assertions pass;
1,000 objects retain their source state with 192 live meshes (1.2 ms median,
2.6 ms p95 CPU update in headless Chrome after the idle-geometry optimization). Loaded/reloaded units, cities and turn
state match the disabled-animation control in both renderers. One autorun round
completes. These are test-host measurements, not target-hardware frame guarantees.

The final populated-map sample had 408 registered sprites: combined ambient CPU
update was 0.4 ms median / 0.8 ms p95, with zero saved-state differences and clean
fog/overview/shutdown checks. Software-rendered whole-game frame times were slow
with both animation enabled and disabled, so those do not establish hardware FPS.

## Live-render regression

`EPOCH_URL=http://127.0.0.1:5176 node scripts/visualAmbientLive.mjs` loads a
populated save with seven known objects through the real GameScene renderers.
Set `EPOCH_CANVAS=1` to exercise capability-detection fallback, `EPOCH_ZOOM` to
change gameplay zoom, and `EPOCH_TEST_OUTPUT` for captures. It checks actual draw
submission, source-image suppression, wall-clock progress and changed screenshot
pixels, and writes a contact sheet and playback page for visual inspection. It
never forces an animation profile or manually advances the animation clock.

The live investigation found registration, profile resolution, GeometryClip and
WebGL ordering intact. Phaser's smoothed delta made long organic rests much
longer on slow frames; Canvas omitted deformation/rotors entirely. Several
effects were also subpixel at map scale, with factory smoke anchored inside its
stacks. Raw visual time, a Canvas draw adapter, corrected stack/lantern anchors
and targeted tool/pump/smoke/beam visibility fixes address these issues.

## Artwork-specific revision

[The complete artwork audit](ambient-art-review.md) records the depicted feature
and stillness decision for every profile. Structures no longer receive mesh
influences, including planted architectural terraces. Crewless parked artillery
and construction-sign icons are deliberately still. Temple fire now follows its
three visible braziers, with stronger independent tongue variation only at its
large central flame. Factories, cities and other emitters follow painted sources.

`EPOCH_ART=1 node scripts/visualAmbientLive.mjs` adds a Temple, Farm, Fishing Boats,
Hoover Dam and Stonehenge to the normal-game fixture and includes the actual city.
It captures live frames with no animation-clock override and checks both changed
pixels and fixed source-space samples: worker head/chest/boots, cattle legs,
pump support and farmhouse roof. `EPOCH_CANVAS=1` exercises the same check through
the real renderer-capability fallback. The fixture clears overlapping units only
in its in-memory test save; production saves and entity state are untouched.

Original-art cutouts are scene-cached atlases generated at runtime, like the
existing rotors. Only explicitly masked occluded surfaces are repaired, with
pixels sampled from the same artwork. The additional linkage math runs inside
the existing visible-object update budget; no gameplay timers or state are added.
