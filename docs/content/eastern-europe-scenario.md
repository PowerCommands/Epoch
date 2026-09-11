# Eastern Europe scenario

`public/assets/maps/eastern-europe.json` is registered as `map_eastern_europe`
in the existing map manifest. It opens in Game Setup and the Scenario Editor.
The 170×70 axial hex map covers the British Isles, mainland France, central
Europe, Scandinavia, the Baltic, Ukraine and western Russia. It includes parts
of northern Italy, the Balkans and the Black Sea along its southern edge.

## Geography and authoring

The map rasterizes geographic coastlines and country boundaries, compensating
for the axial grid's horizontal shear. The deliberately wide projection gives
Germany, Poland and the Danish straits room while retaining all nine capitals.
The geographic conversion is:

- latitude = `71.8 - r × 0.445`
- longitude = `(q + r / 2 - 23) / 2.7 - 14`

The offline source file `scripts/data/eastern-europe-outlines.json` contains
regional polygon extracts from Natural Earth's public-domain datasets:

- [1:50m countries](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/)
- [Country GeoJSON source](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson)
- [1:10m subunits source](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_admin_0_map_subunits.geojson)

Downloaded September 11, 2026. Coordinates are rounded to four decimals; polygon
holes and regional islands are retained. The England and Crimea subunits provide
explicit ownership overrides: England excludes Scotland, Wales and Northern
Ireland; Crimea belongs to Ukraine in this scenario. Åland belongs to Finland,
and Kaliningrad belongs to Russia. Non-participating countries remain unclaimed.
These are geographic starting territories, not a scripted historical snapshot.

Named island corrections preserve Funen, Zealand, Lolland, Bornholm, Gotland,
Öland, Åland and the Isle of Wight at tile resolution. Explicit water corrections
keep Dover, the Sound and the Danish belts open. The North Sea connects to the
Baltic, Gulf of Bothnia and Gulf of Finland through water tiles. Copenhagen is
on Zealand, separated from both the mainland and Sweden.

Terrain suggests the Scandinavian mountains, Alps, Carpathians, central European
uplands, boreal forests and Ukrainian plains. Major lakes include Vänern,
Vättern, Ladoga, Onega and Peipus, with selected Finnish lakes. Reciprocal river
links approximate the Thames, Seine, Loire, Rhine, Elbe, Oder, Vistula, Danube,
Dnieper, Don, Volga, Neva, Daugava and northern Scandinavian rivers.

Regenerate deterministically, without network access:

```sh
node --import tsx scripts/generateEasternEuropeScenario.ts
node tools/easternEuropePreview.mjs /tmp/eastern-europe-preview.png
```

The shipped JSON is ordinary editable scenario content. Regeneration overwrites
that file; retain manual Scenario Editor work separately before regenerating.
No runtime geography dependency or new scenario system is introduced.

## Starting setup

| Nation | Existing leader | Capital | Settler q,r | Territory tiles |
|---|---|---|---|---:|
| England | Boris Johnson | London | 37,46 | 107 |
| France | Charles de Gaulle | Paris | 41,52 | 386 |
| Germany | Angela Merkel | Berlin | 75,43 | 280 |
| Poland | Donald Tusk | Warsaw | 96,44 | 247 |
| Sweden | Olof Palme | Stockholm | 96,27 | 471 |
| Finland | Alexander Stubb | Helsinki | 115,26 | 372 |
| Russia | Vladimir Putin | Moscow | 144,36 | 2,028 |
| Ukraine | Volodymyr Zelenskyy | Kyiv | 119,48 | 443 |
| Denmark | Mette Frederiksen | Copenhagen | 76,36 | 38 |

The existing format stores painted national territory through a city's
`ownedTileCoords`, so each nation has one default capital city as well as its
Settler. Islands and exclaves use that same canonical territory array. Coastal
capitals snap to the nearest tile in their own country, within two hexes of the
projected capital coordinate. No extra leaders or nation definitions are added.
Default leaders omit `leaderId`, following editor serialization conventions.
The normal game initialization also supplies one Scout per nation.

Starting gold, technology, culture, research, diplomacy and date retain normal
defaults (4000 BC, automatic time progression). Resource placement uses the
existing default runtime distribution. There are no extra authored armies,
alliances, wars or events. `turningPointEventsConfigured: true` is the current
blank-editor convention and prevents legacy implicit events from being inserted.

The one required gameplay exception is `dominationLandPercent: 50`. Live testing
with the default 20% ended immediately because Russia already exceeds that land
share. The 50% threshold preserves painted geography and allows ordinary play;
all other victory fields are left at their defaults. This is the same treatment
used by Middle East. Detailed gameplay balancing remains for later editing.

## Validation

```sh
node --import tsx --test --test-isolation=none tools/easternEuropeScenario.test.ts tools/scenarioOrder.test.ts tools/scenarioCityEditing.test.ts
EPOCH_URL=http://127.0.0.1:5176 node tools/easternEuropeScenario.browser.mjs
npm run typecheck
npm run build
```

Geography tests verify ownership landmarks, neutral neighboring countries,
Germany's borders with France/Denmark/Poland, Poland–Ukraine, Ukraine–Russia,
Finland–Russia, British isolation, Zealand isolation and connected major seas.
They also verify the roster, existing leaders, defaults, capital Settlers, valid
territories, map dimensions and lossless river loading.

The browser check exports and edits the scenario in the existing editor, opens
Game Setup, starts a game, checks all live leaders, cities, Settlers, default
Scouts, painted territories and rivers, and advances two ordinary AI rounds.
Artifacts are written to `/tmp/epoch-eastern-europe-validation` by default.
