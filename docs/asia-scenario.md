# Asia scenario

The existing `map_asia` entry points to `public/assets/maps/asia.json`. The
150×75 map was authored and exported through the Scenario Editor; resources
use its normal-density Generate Resources command and rivers use its shared
river drawing implementation. There are no gameplay changes.

| Nation | Approximate capital | Start (q, r) | Default leader |
| --- | --- | --- | --- |
| China | Beijing | 84, 37 | Qin Shi Huang |
| India | New Delhi | 41, 48 | Gandhi |
| Japan | Tokyo | 106, 41 | Oda Nobunaga |
| Mongolia | Ulaanbaatar | 79, 29 | Genghis Khan |
| Taiwan | Taipei | 82, 52 | Koxinga |
| Russia | Moscow | 16, 21 | Ivan IV |
| Thailand | Bangkok | 56, 64 | Anutin Charnvirakul |
| South Korea | Seoul | 94, 41 | Lee Jae Myung |
| North Korea | Pyongyang | 92, 36 | Kim Jong Un |

Every nation has exactly one authored Settler on its start. Leaders are resolved
from the nation defaults, with no scenario overrides. The normal game startup
also supplies one Scout per nation and claims a radius-one area (seven tiles)
for each AI nation through `NationManager.loadFromScenario`. These are canonical
startup behaviors; the human nation starts without a territory claim. No cities, ownership, buildings, improvements,
starting technology/culture grants, diplomacy or historical events are authored.
The scenario uses the normal 4000 BC start and automatic date progression.

Geography includes a connected Russian/Asian mainland, India, Korea, Japan,
Taiwan, and neutral Southeast Asian islands. Japan and Taiwan are enlarged for
hex-scale settlement. Honshu has traversable passes through its mountains.
Western Russia and the equatorial margin are compressed to retain Moscow and a
navigable route between the Indian and Pacific oceans. Rivers approximate the
Yangtze, Yellow, Ganges, Indus, Ob, Yenisei, Lena, Amur, Volga, Chao Phraya and Mekong.

The Korean starts are separated by seven hexes so the baseline/defensive AI
city-spacing rule permits both capitals in place. Their relative positions are
compressed around the existing peninsula; its coastline and the sea toward Japan
are preserved. All six original starts and all 338 resources from the six-nation
version are retained. No new resource layer was generated.

Validation:

```sh
node --import tsx --test tools/asianNations.test.ts tools/asiaScenario.test.ts tools/scenarioEditorGenerateResources.test.ts tools/scenarioOnlyResourceMode.test.ts
npm run dev -- --host 127.0.0.1 --port 5174
node tools/asiaScenario.browser.mjs
npm run build
```

The browser check opens the official Editor entry, compares its canonical export,
starts the game with all nine nations, checks default leaders and initial units,
and advances two normal AI rounds to verify first-city founding for every nation.
Screenshots and a machine-readable report go to `/tmp/epoch-asia-validation`
(or `EPOCH_ARTIFACTS`). This verifies initial settlement, not long-term AI balance.


The new nations reuse Japan's existing two-track playlist through
`audioPlaylistNationId: 'nation_japan'`. No music files are added or copied.
Nation flags are optional registry metadata displayed in Game Setup and the
Scenario Editor. The generated catalog, leader editor bundle and sprite manifest
include the new definitions and artwork. Asset prompts and sources are recorded
in [asian-nations-assets.md](asian-nations-assets.md).

Validated September 9, 2026: 66 nation/leader/scenario/resource tests passed,
including production asset equality checks. TypeScript checking and the Vite
production build passed (the existing large-bundle warning remains). The browser
acceptance test verified nine Settlers, nine automatic Scouts, 56 canonical AI
claim tiles, 338 resources, 261 river tiles, and all nine first cities founded on
their authored starts after two normal AI rounds, without page errors.
