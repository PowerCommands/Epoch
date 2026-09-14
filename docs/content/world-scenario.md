# World

`public/assets/maps/world.json` replaces the former `Word` scenario under the
existing `map_world` key. There is no second World map. The manifest gives World
order 1, making it first and initially selected through the existing Game Setup
and editor ordering. Explicit browser-local scenario ordering still works.

The map is **150 columns × 100 rows**, 15,000 axial hexes. Hand-simplified
longitude/latitude coastlines compensate for horizontal axial shear so north
appears up. The wider layout gives the continents natural landscape proportions.
Britain and Japan are broadened to support early development, with navigable straits separating them
from the mainland. Ireland and smaller islands are symbolic at this resolution.

Each nation has exactly one authored Settler at the nearest playable hex to its
capital area, with no starting cities. The normal game-wide automatic starting
Scout remains enabled. All ten sites can reach food, Horses, Iron and Coal over
land; the island starts have at least 25 usable nearby land tiles.

| Nation | Leader | Start area | q, r |
| --- | --- | --- | --- |
| United States | Donald J. Trump | Washington | 53, 31 |
| Brazil | Jair Bolsonaro | Brasília | 50, 58 |
| England | Boris Johnson | London | 82, 25 |
| Germany | Angela Merkel | Berlin | 87, 25 |
| Nigeria | Bola Tinubu | Abuja | 75, 46 |
| South Africa | Nelson Mandela | Pretoria | 74, 62 |
| China | Mao Zedong | Beijing | 119, 31 |
| India | Narendra Modi | Delhi | 103, 36 |
| Japan | Oda Nobunaga | Tokyo | 126, 33 |
| Australia | John Howard | Canberra | 112, 67 |

The generator authors 28 simplified river corridors, with 260 river-bearing
hexes using the existing reciprocal six-edge encoding. These include the
Mississippi–Missouri, Amazon, Paraná, Rhine, Danube, Volga, Nile, Niger, Congo,
Zambezi, Indus, Ganges, Yangtze, Yellow River, Mekong and Murray–Darling. Narrow
valleys cross simplified mountain ridges; sea hexes are river mouths only.

There are 1,292 resource-bearing hexes. Productive land and coasts are richer
than open ocean. Petroleum is concentrated in selected basins, minerals in
industrial/mining regions, and crops and luxuries follow broad climatic zones.
There are 128 selective coastal Beach tiles, including every inhabited continent.
Compact rounded ice caps are centred at axial column 74.5, near rows 3 and 96,
so they sit at the poles in Globe navigation. They span only 40–50 columns and
seven rows each, leaving surrounding ocean visible. Total ice coverage is 667
hexes, about 35% less than the original portrait version. Seven Polar Bears are
in the Arctic and Greenland, with none in Antarctica.

Archaeology includes 32 Ancient Pottery, 12 Ancient Coins, 12 Ancient Weapons,
six Royal Relics and four Ancient Treasures. Land finds cover all six inhabited
continental regions, including sites near the Nile, Mesopotamia, India, China,
Mesoamerica and the Andes. Exactly six Shipwrecks cover Atlantic routes, the
Caribbean, the Cape, the Indian Ocean, Southeast Asia and a remote Pacific site.
Sixteen geographic markers provide labels without gameplay effects.

Metadata omits balance overrides so normal defaults apply (including 4000 BC and
automatic time progression). There are no authored diplomacy pairs, alliances,
Mutual Foe Agreements, technology/culture grants, buildings or historical events.
`turningPointEventsConfigured: true` makes the empty event list authoritative,
preventing legacy migration from silently adding scheduled Turning Points.

Rebuild deterministically from the repository root:

```sh
node --import tsx scripts/generateWorldScenario.ts
```

The old `python3 scripts/generateWorldMap.py` entry point delegates to this same
generator and no longer writes the obsolete `worldScenario.json` filename.

Validation:

```sh
node --import tsx tools/worldScenario.test.ts
node --import tsx --test tools/scenarioOrder.test.ts tools/scenarioOnlyResourceMode.test.ts tools/multipleLeaders.test.ts tools/modernAlternativeLeaders.test.ts
npm run typecheck
node node_modules/vite/bin/vite.js build
# With a local development server running:
EPOCH_URL=http://127.0.0.1:5174 node tools/worldScenario.browser.mjs
```

The browser test checks editor export preservation, resolved editor leaders,
first/default Game Setup selection, all ten live leader selections and Settlers,
authored resources/rivers, and two normal AI rounds with all ten first cities
founded near their starts. Initial Settler positions must match exactly; the
normal AI may subsequently move before founding. It also captures the actual
Globe zoom at the equator and both poles. Screenshots and the validation report go to
`/tmp/epoch-world-validation` unless `EPOCH_ARTIFACTS` is set.

A broader check also found an existing unrelated failure in
`tools/scenarioTurningPointIntegration.test.ts:65`: its source-text assertion
expects `he-conflicts-section` visibility to be assigned from `builtIn`, while
the unchanged editor now uses a different expression. Both the test file and
editor are unchanged by this scenario work; the live World editor test exercises
the empty historical-event roundtrip successfully.
