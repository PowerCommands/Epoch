# Rivers and Astra-Europa

Open the scenario editor, choose **Load scenario → Astra-Europa**, or select
Astra-Europa in the game's scenario list. The shipped map is
`public/assets/maps/astra-europa.json`, registered as `map_astra_europa`.

## Authoring

Choose **Draw River**. Click a land source, then click successive route points or
drag. Skipped hexes are filled automatically. Bends and junctions are derived
from the route; no graphical pieces need selecting. The route stops at its first
coast/ocean tile. **Finish / New river** or Escape ends the current route;
right-drag pans without ending it. To add a tributary, finish the previous route
and draw into an existing river.

**Erase river sections** supports clicking and dragging. Neighboring links are
removed in the same undo transaction. The river panel exposes the editor's
existing **Undo / Redo** history. Ordinary land terrain painting preserves
rivers; painting water removes affected sections and their reciprocal links.
Resizing trims links that would point outside the map.

## Representation and rendering

`Tile.riverConnections` is an optional six-bit mask. Bits clockwise from east
represent axial offsets `(1,0), (0,1), (-1,1), (-1,0), (0,-1), (1,-1)`.
Every connection has a reciprocal bit in its neighbor. Merely adjacent rivers
do not connect. Terrain remains authoritative and unchanged by river authoring.
This avoids turning traversable land into water or making nearby watersheds
merge accidentally.

`src/systems/geography/Rivers.ts` owns connection, deletion, normalization,
hex interpolation, geometry and style helpers. `hasRiver` and `riverNeighbors`
provide geographic queries. Links are undirected: this does not model flow,
river names, catchments or discharge. A single source click is an authoring
anchor; a saved river requires at least one connected pair of tiles.

Two connections produce a sampled quadratic curve between exact shared edge
midpoints. Ends and junction branches meet at tile centers. A narrow water
stroke, muted bank and fine highlight are shared by Canvas and Phaser. Banks
are omitted over water. Units, cities, resources, borders and fog draw above
rivers. Existing terrain art is retained.

`RiverRenderer` uses the existing `TerrainBaker`, confined to the river bounding
rectangle and chunked at the existing texture limit. Astra-Europa requires one
2252 × 804 render texture (about 7.2 MB of RGBA pixels). There are no per-river
objects, timers, particles or per-frame river updates. The editor draws only
visible river geometry during its existing on-demand renders.

Scenario tiles and sparse saved-game tiles carry the optional mask. Both loaders
sanitize invalid values and remove dangling/nonreciprocal links. Old scenarios
need no migration. Existing saves without river fields retain their scenario's
geography. Runtime save restoration rebuilds the river texture.

## Astra-Europa

The 150 × 75 map was created in the actual editor. A temporary automation script
accelerated repetitive terrain brush operations; river routes, corrections,
nation starts and Settlers used the editor's actual controls and pointer input.
The scenario was saved through the editor, downloaded to the maps directory,
registered, and reopened from that saved file. Reloaded editor output matched
the file exactly, including all Scenario Details defaults.

The map includes Scandinavia, Britain, Ireland, Iberia, Italy, the Baltic,
North Sea, Channel, Mediterranean, Adriatic, eastern Europe and northern Africa.
Coastlines, narrow straits, islands and mountain ranges are simplified for hex
readability and playable land. Central Europe has deliberately separated starts;
HRE occupies the Austrian Danube region. Regional woodland replaces precise
vegetation geography. River routes prioritize recognizable direction and outlets
over cartographic accuracy.

Ten rivers form nine connected systems across 155 tiles: **Thames, Seine, Loire,
Rhine, Danube, Elbe, Vistula, Rhône, Po and Inn**. The Inn joins the Danube.
Every system has a sea outlet.

| Nation | Existing default leader | True start and Settler (q, r) | Approximate region |
| --- | --- | --- | --- |
| Sweden | Gustav Vasa | 78, 26 | South-central Sweden |
| England | Henry V | 47, 36 | English Midlands |
| Germany | Hermann the Cheruscan | 68, 37 | Saxony-Anhalt |
| France | Charles VII | 48, 43 | North-central France |
| Holy Roman Empire | Sigismund | 69, 44 | Austrian Danube |

The file contains exactly these five nations and exactly five units: one Settler
on each true start. There are no cities, leader overrides or Nation Details
customizations. Scenario Details remain at new-map defaults. Epoch's existing
game startup automatically adds a Scout to each nation; that behavior has not
been changed and those Scouts are not authored in this scenario.

## Visual iteration and validation

- Inspected the original editor, then a small river workshop with straight runs,
  bends, a tributary, inland endings and a coastline outlet.
- Removed an obvious repeated woodland pattern from the first Europe pass.
- Corrected an accidental authored Rhine/Danube connection, separated their
  headwaters, and gave the upper Danube more convincing bends.
- Redrew an overly straight Thames after inspecting it in the actual game.
- Removed overlapping translucent end caps that created faint repeated dots.
- Exposed Undo/Redo in the river panel after actual use revealed the existing
  controls were hidden with the terrain palette. Improved erase checkbox layout,
  keyboard focus and the stop-at-water behavior.
- Inspected saved/reloaded editor views at overview and close zoom, plus actual
  Phaser views with normal fog and with fog disabled for whole-region inspection.
  Loaded junction erasing, tributary drawing, terrain painting and Undo/Redo
  restored the original serialized state exactly.
- Launched the saved scenario in Phaser and checked all five Settlers and their
  coordinates. An actual game save/reload preserved all 155 river masks exactly,
  retained the five Settlers and rebuilt the river texture. No browser runtime
  errors were observed. The existing 250 × 166 Europe alternativ scenario also
  opened successfully in the editor with no rivers.

Production build (`npm run build`) passed, with Vite's existing large-bundle
warning. Focused tests and relevant regressions passed:

```sh
node --import tsx --test tools/rivers.test.ts tools/editorRivers.test.ts tools/astraEuropa.test.ts tools/editorPaintCoastline.test.ts tools/scenarioCityEditing.test.ts tools/scenarioEditorGenerateResources.test.ts tools/randomScenarioGenerator.test.ts tools/enlightenmentFogVisibility.test.ts
```

Coverage includes all six directions, interpolation, independent adjacent
rivers, reciprocal deletion, malformed data, shared geometry endpoints,
scenario/save round trips, legacy maps, actual editor helper behavior, water
termination, erase drags, history compatibility, map completeness, defaults,
starts, Settlers and watershed outlets.

Performance was checked in headless Chrome at the same central-European view
with the river texture shown and hidden. This constrained environment rendered
roughly 10–12 FPS in either case (one short sample: 10.6 shown, 11.6 hidden), so
these measurements are not a desktop frame-rate guarantee. The river layer is
one static draw object for this map; no simulation or continuous geometry work
was introduced. Hardware-browser profiling remains useful for much larger maps.

## Files

Added: `src/systems/geography/Rivers.ts`, `src/systems/RiverRenderer.ts`,
`public/assets/maps/astra-europa.json`, `tools/rivers.test.ts`,
`tools/editorRivers.test.ts`, `tools/astraEuropa.test.ts`, this document.

Changed: `public/editor.html`, its generated
`public/editor/epoch-editor-resources.js` bundle and source
`src/editor/editorResourceGenerationBundle.ts`; `src/types/map.ts`,
`src/types/scenario.ts`, `src/types/saveGame.ts`; `src/systems/ScenarioLoader.ts`,
`src/systems/SaveLoadService.ts`, `src/scenes/GameScene.ts`; and
`public/assets/maps/manifest.json`.

No gameplay effects, nation/leader definitions, balance, AI or defaults changed.
Freshwater, crossings, bridges and river-based settlement rules were deliberately
left for later design. Flow direction, named rivers, estuary tapering and more
geographic terrain detail are possible later visual/data improvements. Nothing
was committed.
