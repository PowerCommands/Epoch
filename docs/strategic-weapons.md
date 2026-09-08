# Strategic weapons: implementation and playtest guide

## Architecture investigation

The existing Guided Missile had ranged strength but no consumption or blast path, so it could act as a reusable ranged air unit. Atomic Bomb and Nuclear Missile had no ranged strength, and ordinary combat rejected them. Bomber and Stealth Bomber already provided suitable ranged strike profiles (10 and 20 hexes); they did not have cargo. Nuclear Submarine was a long-range naval combat unit without missile capacity. Bomb Shelter explicitly described its nuclear reduction as omitted.

The reusable parts were substantial: axial hex range queries; multi-unit/cargo ownership, movement and serialization in UnitManager; adjacent boarding rules; city health/population and repairable CityBuildings; timed Worker improvement construction; resource quantities/capacity and Uranium demand; shared city production restrictions; Council/UN emergency sessions with human voting deferral; canonical diplomacy war transitions; and the persistent History/Newspaper pipeline.

Uranium requirements already apply to both nuclear ordnance types and Nuclear Submarine. Nuclear Power Plant already requires Uranium to construct and operate, has a 100-turn life, and supplies its existing production/capacity effects. These systems remain authoritative; contamination now makes resource quantity zero until cleanup. The existing Non-Proliferation Treaty is an **UN member production restriction**, not a disarmament or launch ban. Both queue selection and completion already consult that restriction. New ordnance continues to use those paths and IDs.

## Chosen architecture

- `src/data/strategicWeapons.ts` contains blast profiles, cleanup duration, shelter multiplier, deterrence strength and generated weapon descriptions.
- `StrategicWeaponsSystem` validates delivery and resolves area effects outside ordinary ranged combat. CombatSystem routes strategic attacks through it after enforcing turn and combat blockers. It uses the existing hex grid and entity managers.
- Bomber and Stealth Bomber each carry one Atomic Bomb. Nuclear Submarine carries three Guided/Nuclear Missiles in any combination. Cargo gains an optional exact-unit-ID allowlist; ordinary transports retain category-based rules.
- Nuclear Silo is a city building unlocked by Advanced Ballistics. Nuclear Missiles produced in a city are stationed on its center tile. A working, owned silo authorizes launch from that tile. Missiles remain ordinary saved units; the silo needs no second inventory or cargo ledger. Land storage has no separate count cap; production, Uranium capacity and upkeep limit stockpiles. Broken or captured silos do not authorize the former owner's launches.
- Atomic Bomb cannot move independently. Load it from the same/adjacent tile. Launching consumes its bomber's remaining action and the bomb. A submarine similarly launches one payload per turn; silo-based missiles each consume their own action. Missiles can relocate on land and load submarines; they cannot launch from open water independently.
- No new stealth model is introduced. Submarine survivability comes from mobility, fog, range, AI standoff positioning and a higher deterrence valuation for submarine-based warheads.

## Default balance

All radii include the center tile and every axial hex within the radius; full areas contain 7, 37 and 61 tiles respectively. There is no damage falloff.

| Weapon | Radius | Unit HP damage | City HP damage | Population loss | Buildings broken |
| --- | ---: | ---: | ---: | ---: | ---: |
| Guided Missile | 1 | 60 | 70 | 0% | 15% |
| Atomic Bomb | 3 | 120 | 180 | 50% | 60% |
| Nuclear Missile | 4 | 160 | 240 | 65% | 80% |

Population losses and building counts round down. Building selection is stable by ID. City-center blasts leave at least one population and one city HP: weapons devastate cities but do not capture them or invoke ordinary capital capitulation. Conventional forces must exploit the aftermath. Military casualties feed the existing war-loss accounting.

All three destroy improvements throughout their area and damage units regardless of civilian/military/naval status or stacking. Destroyed transports lose their cargo. Applicable city buildings become repairable ruins; standalone buildings hit by the blast are broken. Existing wonders retain their existing protection from this new damage path.

A working Bomb Shelter halves nuclear damage to city HP, population, the city-center building damage fraction, and units on the city tile. It does not halve Guided Missile damage or protect surrounding terrain. Protection is evaluated before effects. Infrastructure on outlying tiles can also be hit directly.

Atomic Bomb and Nuclear Missile turn land into Nuclear Waste, excluding Mountain, Coast and Ocean. Waste provides zero yields and zero resource quantity. Terrain identity is retained across repeated strikes. Worker cleanup takes **5 turns**, uses existing improvement-speed modifiers and a Worker charge on completion, restores the exact original terrain, and leaves improvements destroyed. The action is available on owned contaminated land serviced by the existing city/Worker architecture, including city centers. Moving or losing the Worker cancels construction through the existing rules.

Silo cost is **450 production / 8 maintenance**. Existing weapon costs, ranges, resource requirements and upkeep remain unchanged. Nuclear deterrence adds **350 defensive strength per ready weapon**, capped at four, plus **175 per submarine warhead**, capped at two. Mutual nuclear capability multiplies the defender's deterrence contribution by **1.5**. These are defensive war-evaluation terms, not conventional attack strength.

## Politics and AI

Successful nuclear use is recorded as a priority-120 newspaper/history event before its Council/UN response. Global relation consequences reuse condemnation memory effects (Trust −15, Fear +5, Hostility +15), identified as nuclear use. Guided Missiles do neither.

Each affected foreign nation raises an emergency response in the active institution. The victim supports; the aggressor is excluded. Eligible members make one equal-weight decision without spending Influence. A majority of eligible nations must support. Only supporters enter the victim's war through canonical diplomacy; rejected/absent human input never declares war. Existing diplomatic blockers remain effective. The response source does not activate additional alliance/vassal declarations or mark interveners as new aggressors. Multiple unresolved human emergency ballots persist in the normal meeting history and are resumed in order.

AI production competes through the existing production candidate scoring and resource/treaty gates. It seeks bomber delivery for an Atomic Bomb, a silo or submarine for later missiles, small arsenals, and Bomb Shelters when known rivals possess nuclear weapons. Existing strategic resource demand includes Uranium needed by unlocked nuclear units and power plants.

AI loads weapons, relocates land missiles to silos, moves armed platforms into standoff range, and evaluates complete blast areas. Guided Missiles favor worthwhile conventional targets. Nuclear firing requires severe military pressure or an endangered city, enough concentrated target value, and no domestic collateral damage. It accounts for leader risk tolerance, hostility/trust/fear, enemy nuclear retaliation and predicted collective intervention. The intervention estimate reuses the actual resolution's leader, alliance and military-power scoring. Nuclear possession also changes defensive war power and the AI's temporary diplomatic fear assessment. No random firing is used.

AI uses Epoch's existing simulation knowledge for strategic power assessment. Player views show their own arsenal and publicly recorded nuclear use, without revealing hidden foreign stockpile counts or submarine positions.

## Player controls and feedback

Select ordnance and use **Load Weapon** near a compatible platform. Select the platform and choose **Select Nuclear Payload** or **Select Conventional Payload**, then **Launch** and a map coordinate within range. Strategic weapons can target fog of war without revealing hidden occupants. The existing ranged preview shows the blast footprint on hover. Unit details show classification, radius, damage, carrier restrictions and capacity. A failed launch reports its reason. A blast touching a neutral nation is rejected; declare the relevant war through existing diplomacy first.

Nuclear Waste uses the native terrain renderer's dark/acid-green style and a matching minimap color. Tile inspection names the original terrain. Cleanup has a brush icon. The silo has a vector building asset using the existing asset-path/manifest pipeline.

`[Strategic]` diagnostics report production, periodic AI arsenal/ready counts, launch platform and target, casualties/contaminated tiles, nuclear use, Council/UN outcomes, intervention membership and retained deterrence. These are event/periodic logs, not per-target scoring spam.

## Persistence and validation

Cargo retains the existing unit serialization. Terrain saves now include current terrain plus optional original terrain, including unowned affected tiles; all tile terrain is serialized so cleaned terrain also survives later saves. Old saves without the new optional fields retain their authored terrain. Cleanup uses saved improvement-construction progress. Silo state uses CityBuildings. Nuclear capability is derived from units/buildings rather than duplicated persistent AI state. Emergencies use existing saved meetings and diplomacy state.

Run `npm run test:strategic` for 34 focused tests across `strategicWeapons.test.ts` and `nuclearDiplomacy.test.ts`. They cover radii/edges, area casualties, delivery/capacity/consumption, shelters, contamination/resource suppression, cleanup/restoration/save-load, actual Worker and strategic AI execution, UI action availability, both global institutions, individual participation, queued ballots, alliance/vassal non-cascading behavior and the UN treaty.

The relevant existing Council, diplomacy, resource, newspaper, cargo, construction, AI-production and ceasefire regressions also pass. A pre-existing Hotel test in `terrainRestrictedBuildings.test.ts` expects only +5 Gold, whereas the committed Hotel definition also grants +25%; this mismatch is unrelated to strategic weapons. Two assertions in `archaeologyDig.test.ts` likewise expect an unlimited Archaeologist, although the committed definition has one improvement charge. Its dedicated save/load and UI tests pass; the failing assertions concern charge counts.

Typecheck and production bundle build were validated. In restricted environments the `tsx` CLI's IPC server can fail with EPERM; running each manifest generator using `node --import tsx scripts/<generator>.ts`, followed by the normal TypeScript/Vite build commands, avoids that CLI limitation.

## Late-game playtest priorities

1. Run Atomic-to-Future autoruns to measure first weapon dates, Uranium acquisition, silo/submarine/bomber mix, stockpile upkeep, and actual nuclear-use frequency.
2. Tune 37/61-tile blast severity against typical city spacing, recovery speed and Worker availability. Large contaminated empires may need many Worker charges; 5 turns is per tile.
3. Check AI standoff/rendezvous behavior on archipelagos, crowded coastlines and disrupted silo networks. Nuclear submarines use ordinary naval visibility, not a new undersea detection system.
4. Evaluate whether deterrence discourages opportunistic conquest without freezing every late-game war, and whether coalition predictions produce plausible leader differences.
5. Manually exercise mixed submarine cargo, bomber upgrades, tactical hover footprints, multiple emergency dialogs, and loading old/contaminated/cleaned saves. Headless tests do not substitute for the Phaser interaction check.
6. Measure terrain re-bake and larger terrain-save costs on the largest maps. No long late-game autorun or interactive campaign was performed during this implementation.


## Canada save launch regression

The supplied `nuclear_save.json` has a missile in Ottawa with an active Nuclear Silo and a war against the USA. Washington is within missile range but outside current visibility (and unexplored). The original human targeting path rejected those coordinates twice: the visibility check and the selectable-object requirement. Strategic launch input now uses the raw clicked tile, as movement into fog already does, and range previews include coordinates in fog. Ordinary ranged attacks retain their visibility rules. Exhausted weapons retain a disabled Launch control explaining the next-turn requirement. Strategic cargo also refreshes its launch action on its owner's turn.

Browser reproduction: start Vite and run `node tools/nuclearSave.browser.mjs autorun-input/nuclear_save.json http://127.0.0.1:5174 public/assets/maps/america.json`. The last argument supplies the America scenario for this save's browser-local custom map reference; no custom scenario definition was embedded in the supplied save. Saved terrain and game entities are restored normally, and the input file is unchanged. The test uses actual launch-mode selection and a pointer click into fog at Washington: missile consumed, Washington at 1 HP, 37 contaminated land tiles, no browser exceptions. The save contains no active global institution, so this reproduction does not exercise a Council emergency. Unit/system tests cover those responses separately.
