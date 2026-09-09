# Middle East scenario

`public/assets/maps/middle-east.json` is authored Scenario Editor content, registered as
`map_middle_east` with manifest `order: 3`. Ancient Europa and America precede it;
existing personal ordering continues to override the manifest.

The 125×75 axial hex map approximates the regional coastline, Sinai, Arabian Peninsula,
Persian Gulf, Red Sea, Nile delta, Taurus/Zagros/Alborz ridges and three river systems
(Nile, Tigris, Euphrates). Moscow and Washington occupy detached symbolic islands.
Unclaimed neighboring regions provide expansion space. No scenario-specific runtime
mechanics, historical events, wars or alliances are added.

| Nation | Leader | Cities | Owned tiles |
|---|---|---|---:|
| Iran | Ruhollah Khomeini | Tehran, Isfahan, Shiraz | 702 |
| Iraq | Saddam Hussein | Baghdad, Basra | 195 |
| Egypt | Abdel Fattah el-Sisi | Cairo, Alexandria, Aswan | 439 |
| Israel | Benjamin Netanyahu | Jerusalem | 16 |
| Turkey | Recep Tayyip Erdoğan | Ankara, Istanbul, Izmir | 395 |
| Saudi Arabia | Mohammed bin Salman | Riyadh, Jeddah, Mecca | 785 |
| United States | Donald J. Trump | Washington | 148 |
| Russia | Vladimir Putin | Moscow | 139 |

The first city listed is each nation's original and residence capital. Each capital
starts with one Settler. Territories use canonical `cities[].ownedTileCoords`, with
connected city and national regions. The editor omits default `leaderId` values;
Egypt, USA and Russia retain explicit non-default modern leader selections.

The date starts in AD 2025, with non-future technologies researched through the existing
Nation Details system and 500 starting gold per nation. Leader choices intentionally
span different modern periods rather than one historical snapshot. There are 193 resource
deposits, including 13 Oil and 11 Natural Gas deposits, and 78 river tiles. All resource
placements use terrain-compatible existing resource IDs. Food, production and strategic
resources are available to every nation, including both external powers.

The existing editor setting `dominationLandPercent` is 50: pre-painted Saudi territory
already covers about 19% of the map's 4,138 land tiles, so the normal 20% setting would
allow a very short expansion to satisfy the land route. Other victory settings retain
the standard values.

Validation:

- `node --import tsx --test tools/middleEastScenario.test.ts tools/scenarioOrder.test.ts tools/scenarioCityEditing.test.ts tools/middleEasternNations.test.ts`
- `EPOCH_URL=http://127.0.0.1:5176 node tools/middleEastScenario.browser.mjs`
- `npm run typecheck`
- `npm run build`

The browser check opens the existing editor, compares its export with the scenario,
checks the fresh-player third position, starts a normal game, checks live leaders,
cities, territory, Settlers, rivers and resources, and runs two ordinary AI rounds.
Screenshots and the browser validation report default to `/tmp/epoch-middle-east-validation`.
