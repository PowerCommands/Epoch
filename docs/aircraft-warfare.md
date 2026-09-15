# Aircraft warfare

The six existing fixed-wing aircraft now use bases and air missions. Helicopter Gunship and strategic weapons retain their separate behavior. Aircraft statistics, costs, unlocks, resources, upkeep, quality and upgrade chains are unchanged; fighters apply a 0.35 strength multiplier to conventional strikes.

## Playing

- Flight unlocks **Airfield**: 2 aircraft, 250 production, 3 maintenance.
- Radar unlocks **Air Base**: 4 total aircraft, 400 production, 5 maintenance. It replaces an existing Airfield on its exact tile automatically. Without an Airfield it uses normal land placement.
- Both air buildings are placed on city-owned land. Missions and fighter coverage start at the building tile.
- Ordering an aircraft opens a map destination cursor: click a highlighted friendly Airfield, Air Base or Carrier; Escape cancels. Any owned base with capacity is eligible, including bases outside the producing city. The queue shows and saves the selected destination. A moving Carrier receives the aircraft at its current position.
- Carrier provides **3 aircraft slots**. Its cargo eligibility accepts aircraft capabilities, not the entire `air` category. Existing bomber atomic payloads remain supported.
- Click a base tile repeatedly to cycle through its aircraft, or use the normal unit turn queue. Shift-click a city to open its city view directly.
- **Air Mission** highlights operational range. Click an enemy unit or city target within that range. The aircraft enters from the upper right, passes over the target and exits toward the lower left. Garrison priority and existing ranged city combat apply; aircraft cannot capture cities.
- **Rebase** highlights friendly destinations with capacity within normal aircraft range. Click a destination to transfer there. Rebasing uses the aircraft's turn and performs no attack.
- Both actions consume all movement. Carrier aircraft refresh on their owner's turn. Ordinary movement, boarding and disembarking cannot move aircraft between bases.
- The city view and sidebar show aircraft capacity. Aircraft details show their base, range and quality. Fighter and AA/SAM details show interception radius/chance; selection displays coverage.

## Interception

`src/data/airOperations.ts` contains separate fighter and ground-defense tables:

| Quality | Radius | Chance |
| --- | ---: | ---: |
| 0 | 2 | 10% |
| 1 | 3 | 20% |
| 2 | 4 | 30% |
| 3 | 4 | 40% |
| 4 | 5 | 50% |
| 5 | 6 | 60% |

Epoch currently produces and restores quality levels 1–5. The Level 0 air-defense entry is configured without changing the existing quality system.

Each offensive mission gets **at most one interception roll across its entire outbound route**. Eligible defenders must be hostile under the existing diplomacy/ceasefire rules. Selection prefers the highest chance, then shortest distance to the first covered route tile, then stable unit ID. Ground defenses aboard transports do not intercept. Fighter coverage originates at its assigned base, including a moving Carrier.

The roll is seeded by round, attacker ID and defender ID. It is independent of rendering and does not reroll when loading the same state. A successful check applies existing quality/health-adjusted ranged damage and **always aborts the mission**, even when the aircraft survives. Fighters fly to intercept and return; AA/SAM fire projectiles while remaining on their tile. Interception is automatic, including for sleeping fighters and fighters that already used an offensive action. There is no additional per-defender reaction limit in this version. Transfers do not trigger interception.

## Capacity and loss rules

Capacity is derived from active buildings and live aircraft assignments, never from a separately persisted counter. Broken buildings provide no capacity; upgrade capacity does not stack. Production is blocked when capacity is unavailable, including enqueue, completion/purchase and per-turn progress. Queued aircraft do not reserve future slots; a queue pauses if its selected destination becomes full, destroyed, captured or broken. It never silently switches a selected destination.

When a building is broken/removed, a city is captured/removed, or a Carrier is destroyed/captured, displaced aircraft divert to the nearest friendly base with a free slot within their normal range. Stable IDs break ties. Aircraft with no valid destination are explicitly removed and reported through `[Air]` messages. Existing payload loss/removal rules follow their aircraft. Emergency diversion preserves the aircraft's current action availability.

Legacy saves and scenario aircraft without metadata use the same nearest-base rule from their stored position. Existing city-only air buildings from older saves are placed on an available owned tile during load; no additional buildings or capacity are granted. Scenario authors should provide enough Airfields/Air Bases or nearby Carriers: aircraft that cannot find a valid base are lost during initialization. Scenario aircraft may start on water for assignment to a nearby Carrier.

## Architecture and persistence

- `AirOperationsSystem` owns basing, reconciliation, transfer, interception and mission resolution. `CombatSystem` delegates aircraft missions to it and retains actual conventional strike resolution, diplomacy integration, damage events and city-combat rules.
- `UnitManager` maintains collision-free stationed aircraft, Carrier cargo links, removal and relocation notifications. Aircraft remain selectable at their bases but are not ordinary map occupants or ground-combat targets.
- `AirMissionRenderer` animates disposable aircraft, weapons and impact smoke on the scene clock. Launch spends the action immediately; animated strikes apply actual damage after the final explosion flash. No terrain copy or damage-covering overlay is created. Pending strikes are included in saves and resume on load. `AirMissionAnimation` supplies artwork-specific engine anchors, headings and pure trajectory/timing calculations. Autorun and invisible or disabled animations resolve strikes immediately. Ending a turn finishes outstanding strikes before the next nation acts.
- `Unit.airBase` persists `{ kind: 'city' | 'carrier', id }` through the normal save/load path. Cargo, health, quality and consumed movement use existing serialization. A save during flight captures the completed mission, so no transient flight or interception state needs restoration.
- City-building change notifications reconcile aircraft after capacity loss. Building upgrades add the replacement before removing its predecessor, so aircraft never encounter a temporary zero-capacity state.
- AI production hints live in `ai/AIAirProduction.ts` and feed existing production, resource, upkeep and doctrine gates. Aircraft attack known targets and transfer toward active fronts, including available Carriers. Fighters receive higher production priority when other known nations possess aircraft. Ground defenses seek friendly cities exposed to known enemy air power.

## Validation

- `npm run test:air-animation`: 14 tests covering all six aircraft, diagonal entry/exit, missile arrival at flyover, delayed bomb impacts, interception without weapons, and edge/zoom timing.
- `npm run test:air-animation:browser -- <vite-url>`: real aircraft artwork in WebGL and Canvas, weapon/impact/smoke phases, all six aircraft intercepted by fighters or SAMs with survival/destruction, rebase, fog, autorun, bounded effects and scene cleanup. Captures are written to `/tmp/epoch-air-animation`.
- `npm run test:air`: 35 focused tests for capacity/production, upgrades, collision-free basing, range, garrisons, fighter strike strength, fighter/AA/SAM interception, abort/destruction, overlapping coverage, Carrier movement/coverage, transfer, capture/destruction, save migration and AI.
- `node tools/airOperations.browser.mjs <vite-url>`: includes the animation browser checks above, then actual GameScene scenario initialization, HUD/map-click strike, save/load during visual flight, HUD/map-click Rebase and three autorun rounds. Chrome path can be supplied through `EPOCH_BROWSER_PATH`.
- Relevant regression files: strategic weapons, nuclear diplomacy, building upgrades, military quality, unit upgrade resources, game-speed production costs, settler production, ceasefires, combat animation policy, strategic-resource demand and resource-access indexing.
- TypeScript checking, generated building/unit manifests, production build and whitespace checks.

Two existing assertions in `tools/archaeologyDig.test.ts` (lines 100 and 146) fail because they expect undefined improvement charges while the existing Archaeologist definition supplies 1. Both failures were reproduced using the unchanged HEAD sources in an isolated `/tmp` copy; its transport/dig tests pass. They were not changed as part of this feature.

During the attack-animation revision, 33 of the 36 air-operations checks passed. Three existing checks for base upgrades, standalone base placement and legacy city layout restoration also failed with the unchanged air/combat systems in an isolated copy. All 14 new animation tests, both browser renderers, the full GameScene browser flow and TypeScript checking passed.

## Attack presentation

Triplane, Fighter and Jet Fighter fire two missiles from a distance. They hit within 25 ms of the aircraft passing over the target. Great War Bomber, Bomber and Stealth Bomber release three bombs above the selected tile; each falls for 470 ms before impact. Fire, sparks and an expanding dust ring give way to rising smoke that fades over 1.8 seconds.

Each model retains its original artwork, with a corrected flight heading, moving propellers or jet exhaust, a gentle bank and a ground shadow. Successful strikes continue offscreen without a visible return trip. Intercepted aircraft fade out without releasing weapons or creating explosions, including when destroyed. The defending fighter can fly out and return, or stationary ground defense can show a tracer. Rebase retains its direct base-to-base route without weapons.

At most eight flight effects coexist. Each effect checks current visibility, and enabling autorun clears active visuals. Scene shutdown removes objects and the flight subscription. Fixed-wing aircraft bypass the ordinary ground-projectile animation so no projectile launches prematurely from their base.

## First-version limits

AI planning is pragmatic: it does not optimize air routes, escorts, Carrier task forces or long transfer chains. City and unit strikes use existing combat rules; dedicated building/infrastructure bombing is not added. Combat state commits before visual playback, so health bars, removal and the turn queue may update before the aircraft animation reaches the target. Legacy scenarios need authored air capacity to preserve all starting aircraft.

City targets now use explicit world-effect depths above city artwork, persistent
city fires and badges. The target city's badge is temporarily hidden from just
before impact until flight/impact cleanup, including overlapping attacks and
cancellation. Intercepted flights never suppress a badge. The city-damage browser
regression checks actual explosion pixels over every settlement stage in both
WebGL and Canvas; see `docs/urban-development.md` for the shared 51% health rule.
