# Scandinavia

Replaces `public/assets/maps/scandinavia.json`, retaining `map_scandinavia` and its existing assets. `public/assets/maps/manifest.json` puts it fourth in the default order. Existing browser-specific custom ordering still takes precedence.

The 150 × 75 axial hex map contains six nations, no cities, and exactly one authored Settler at each start. Coordinates are zero-based `(q, r)`:

| Nation | Existing leader | Start region | q | r |
| --- | --- | --- | --- | --- |
| Sweden | Gustav Vasa (explicit selection) | Stockholm | 58 | 45 |
| Denmark | Christian IV (default) | Copenhagen | 30 | 59 |
| Finland | Alexander Stubb (default) | Helsinki | 84 | 41 |
| Novgorod | Marfa Boretskaya (default) | Veliky Novgorod | 103 | 48 |
| Lithuania | Vytautas the Great (default) | Vilnius | 75 | 62 |
| Poland | Donald Tusk (explicit alternative) | Warsaw | 56 | 70 |

No authored gold, technology, culture, diplomacy, buildings, improvements or resource ownership is supplied. Scenario dates use the normal 4000 BC / auto progression; other settings inherit defaults. Sweden is the initial human selection. Nation and leader definitions are reused without behavior overrides.

**Runtime distinction:** Epoch automatically adds one Scout to each nation in authored scenarios (`GameScene.spawnStartingScouts`). Therefore the scenario file contains six Settlers only, but a normal new game contains six Settlers plus six Scouts. The existing automatic AI starting territory also applies. No gameplay/default changes were made to suppress these behaviors.

Geography uses manually drawn longitude/latitude polygons projected into the existing axial grid with horizontal shear compensation. Coast occupies shallow water within two hexes of land. The mainland connects around the head of Bothnia; the Baltic, Gulf of Finland, Gulf of Bothnia, Danish straits and North Sea form one navigable sea. Zealand stays separate from the mainland and has at least twenty walkable tiles. Western Scandinavian mountains, northern forests, southern meadows/plains, simplified lakes and reciprocal river paths use existing terrain systems. Ordinary unowned resources include agricultural, marine and strategic deposits; horses, iron and coal occur within twelve hexes of each start.

Compromises: east–west distances are exaggerated relative to north–south distances to fit the wide map. Zealand and Funen are enlarged, coastlines/fjords and Finnish lakes are simplified, and minor islands such as Lolland are omitted to keep straits open. The Helsinki start is slightly inland, and Warsaw lies near the southern edge. Rivers approximate regional drainage rather than precise courses.

Rebuild and validate from the project root:

```sh
node --import tsx scripts/generateScandinaviaScenario.ts
node --import tsx tools/scandinaviaScenario.test.ts
node --import tsx tools/scenarioOrder.test.ts
npm run typecheck
# With Vite running locally:
EPOCH_URL=http://127.0.0.1:5175 node tools/scandinaviaScenario.browser.mjs
```

The browser check verifies editor loading, terrain/unit preservation through editor serialization, fourth position and unique name in Game Setup, all six portraits/leader assignments, live leader selections, all initial Settlers at their starts, no cities, default Scouts, map dimensions and exact preservation of natural resources. Screenshots and runtime results default to `/tmp/epoch-scandinavia-validation`.
