# Middle East scenario

`public/assets/maps/middle-east.json` is authored Scenario Editor content, registered as
`map_middle_east` with manifest `order: 4`. World, Ancient Europa and America precede it;
existing personal ordering continues to override the manifest.

The 125×75 axial hex map approximates the regional coastline, Sinai, Arabian Peninsula,
Persian Gulf, Red Sea, Nile delta, Taurus/Zagros/Alborz ridges and three river systems
(Nile, Tigris, Euphrates). Moscow and Washington occupy detached symbolic islands.
Unclaimed neighboring regions provide expansion space. No scenario-specific runtime
mechanics, wars or alliances are added. Existing scheduled historical events are preserved.

| Nation | Leader | Cities | City-owned tiles | Claimed tiles |
|---|---|---|---:|---:|
| Iran | Ruhollah Khomeini | Tehran, Isfahan, Shiraz | 57 | 643 |
| Iraq | Saddam Hussein | Baghdad, Basra | 31 | 166 |
| Egypt | Abdel Fattah el-Sisi | Cairo, Alexandria, Aswan | 48 | 391 |
| Israel | Benjamin Netanyahu | Jerusalem | 13 | 3 |
| Turkey | Recep Tayyip Erdoğan | Ankara, Istanbul, Izmir | 53 | 342 |
| Saudi Arabia | Mohammed bin Salman | Riyadh, Jeddah, Mecca | 34 | 751 |
| United States | Donald J. Trump | Washington | 19 | 129 |
| Russia | Vladimir Putin | Moscow | 19 | 120 |

The first city listed is each nation's original and residence capital. There are no preplaced units. City territories use canonical `cities[].ownedTileCoords`,
with compact areas within two hex steps of each city. National geography outside
those areas uses 2,545 canonical `map.tiles[].territorialClaimNationId` entries,
authored with the Scenario Editor's claim painting tool and exported through it.
These claims provide no city yields or resource access until actually acquired.
The national footprints are preserved except for two tiles in Basra's reserved
urban core, formerly assigned to distant Isfahan, which now belong to Basra.
The editor omits default `leaderId` values; Egypt, USA and Russia retain explicit
non-default modern leader selections.

The existing start date (2000 BC) is preserved, with existing per-nation technology selections and 500 starting gold per nation. Leader choices intentionally
span different modern periods rather than one historical snapshot. There are 193 resource
deposits, including 13 Oil and 11 Natural Gas deposits, and 78 river tiles. All resource
placements use terrain-compatible existing resource IDs. Food, production and strategic
resources are available to every nation, including both external powers.

The existing `dominationLandPercent` setting remains 50. National claims now
represent the broad political footprint independently of compact city ownership;
other victory settings are unchanged.

Validation:

- `node --import tsx --test tools/middleEastScenario.test.ts tools/scenarioOrder.test.ts tools/scenarioCityEditing.test.ts tools/middleEasternNations.test.ts`
- `EPOCH_URL=http://127.0.0.1:5176 node tools/middleEastScenario.browser.mjs`
- `npm run typecheck`
- `npm run build`

The browser check opens the existing editor, compares its export with the scenario,
checks the fresh-player fourth position, starts a normal game, checks live leaders,
cities, city ownership, independent claims, Settlers, rivers and resources, and runs two ordinary AI rounds.
Screenshots and the browser validation report default to `/tmp/epoch-middle-east-validation`.
