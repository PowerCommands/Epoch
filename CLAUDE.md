# CLAUDE.md

## Project overview
This project is a browser-based 2D turn-based strategy game built with **Phaser 3**, **TypeScript**, and **Vite**.  
The long-term goal is a simpler Civilization-style game played on a **real map of Europe**, not a random map.

## Current architecture
The project is being built step by step with a clean and extensible structure.

Implemented so far (through step 18):
- Basic Phaser + TypeScript + Vite project setup
- Scene flow: `BootScene` (preloads europeMap.json) → `MainMenuScene` → `GameScene`
- Europe map loaded from `public/europeMap.json` (`200×120`, `48px` tiles, 9600×5760px world)
- Camera pan/zoom with debug HUD, dynamic overview zoom based on the actual Phaser canvas/container size, max 2.0
- Tile hover and selection system
- Selection support for tiles, cities, and units, with priority `unit → city → tile`
- Six historical nations (England, France, HRE, Sweden, Ottoman Empire, Spain) with territory overlays
- Capital cities at historical locations with spiral fallback for ocean tiles (marked `isCapital`)
- One starting unit per nation
- Unit movement between adjacent non-ocean tiles
- Movement points reset on the owning nation's turn start
- Deterministic adjacent unit-vs-unit and unit-vs-city combat
- Ranged combat (Archer): attacks at Chebyshev distance 2, no counter-attack, cannot capture cities
- Unit HP and strength stats from `UnitType`
- Dead units are removed from data and rendering
- HP bars for damaged units and damaged cities
- Combat log showing unit combat, city combat, and city capture events
- Turn system with rounds, active nation display in HTML left panel, and End Turn button
- Nation-level resources: **gold** and **gold per turn**
- City-level resources: **food**, **production**, and per-turn values
- Resource generation on turn start, using a pluggable `IResourceGenerator`
- Building definitions for `Granary`, `Workshop`, and `Market`
- Unit definitions for `Warrior`, `Archer`, `Cavalry`, and `Settler`
- Per-city building storage
- Production system where each city can produce one item at a time
- HTML side-panel layout around the Phaser canvas: left panel for turn/nation overview, right panel for selection details and production
- Right-side HTML production menu for selecting city production, including buildings and units
- City conquest: cities can be attacked, damaged, and captured by enemy units
- Healing system: units and cities regenerate HP each turn
- Basic AI for non-player nations (combat, movement toward cities, production)
- AI fairness: 3-military-unit cap, 0-strength units cannot attack
- AI produces diverse military units (Warrior, Archer, Cavalry)
- Settler unit that founds new cities (consumed on use, claims 3×3 territory)
- AI settler behavior: founds cities ≥5 tiles from existing cities, max 3 cities per AI nation
- FoundCitySystem with validation, territory claiming, and rendering refresh
- "Found City" button in RightPanel for human settlers on valid tiles
- **Victory system**: last nation holding all 6 starting capitals wins
- Victory overlay with nation name/color, game stops on victory

## Important design rules
- Keep **data models Phaser-free** where possible
  - `Nation`, `City`, `Unit`, resource data, building data, production state, and turn logic should remain pure TypeScript classes
- Keep **rendering separate from logic**
  - Renderers and UI belong in their own classes
- Keep the **layout architecture hybrid**
  - Phaser owns only the central map/game-world canvas.
  - HTML/CSS owns fixed side panels, text-heavy controls, lists, buttons, scroll, production menus, and selection details.
  - Do not move left/right panels into Phaser unless the product direction changes to a fully canvas-rendered UI.
  - CSS owns page layout: `#panel-left` = left 10vw, `#game-container` = center 80vw, `#panel-right` = right 10vw.
  - Phaser must measure the real `#game-container` size via DOM (`getBoundingClientRect()` / resize handling), not guess from `window.innerWidth`.
  - Phaser camera/zoom calculations must use the actual canvas/camera viewport, not hard-coded `1280×720` or `window.innerWidth * 0.8` assumptions.
  - Communication between HTML UI and Phaser should stay explicit through events/state updates, for example selection changes, `focusCity`, turn/resource/production updates.
- Use **event-driven systems**
  - New systems should react to events such as `turnStart`, `turnEnd`, `roundStart`, `roundEnd`
- Keep APIs clean and extensible
  - The placeholder map will later be replaced by a real Europe map, possibly based on geodata
- Do **not** add unnecessary gameplay mechanics before the foundation is ready

## File structure overview

### Entities (`src/entities/`)
- `Nation.ts` — nation data (id, name, color)
- `City.ts` — city data (id, name, ownerId [mutable], tileX/Y, isCapital, health, lastTurnAttacked)
- `Unit.ts` — unit data (id, name, ownerId [readonly], tileX/Y, health, movementPoints, unitType)
- `UnitType.ts` — unit type interface (id, name, productionCost, movementPoints, baseHealth, baseStrength, canFound?, range?)
- `Building.ts` — building type interface (id, name, productionCost, modifiers)
- `CityResources.ts` — per-city food/production storage
- `CityBuildings.ts` — per-city building list

### Data (`src/data/`)
- `units.ts` — `WARRIOR` (cost 6, move 2, HP 100, str 20), `ARCHER` (cost 12, move 2, HP 75, str 18, range 2), `CAVALRY` (cost 18, move 4, HP 80, str 28), `SETTLER` (cost 20, move 2, HP 50, str 0, canFound)
- `buildings.ts` — `GRANARY`, `WORKSHOP`, `MARKET` definitions
- `cities.ts` — city combat constants (`CITY_BASE_HEALTH=200`, `CITY_BASE_DEFENSE=25`, `CITY_HEAL_PER_TURN=10`, `CITY_CAPTURE_HEALTH_FRACTION=0.25`)

### Systems (`src/systems/`)
- `TileMap.ts` — map data + rendering, `loadEuropeMap()`, `generatePlaceholder()`, `tileToWorld()`, `worldToTile()`, `getTileAt()`
- `NationManager.ts` — nation CRUD, `createDefault()` creates 6 historical nations with territory, spiral land-tile fallback
- `CityManager.ts` — city CRUD, resources, buildings, `transferOwnership()`, `getCityAt()`, `getCitiesByOwner()`
- `UnitManager.ts` — unit CRUD, movement, damage notifications, `getUnitAt()`, `getUnitsByOwner()`
- `TurnManager.ts` — turn order, round tracking, event pub/sub (`turnStart/End`, `roundStart/End`)
- `ResourceSystem.ts` — gold/food/production generation on turnStart
- `ProductionSystem.ts` — per-city production queue, `setProduction()`, `clearProduction()`, `onCompleted()`
- `CombatResolver.ts` — pure functions: `resolveCombat()`, `resolveRangedCombat()`, `resolveUnitVsCity()`, `resolveRangedVsCity()`
- `CombatSystem.ts` — validates and executes combat (melee + ranged), emits `on()` (unit) and `onCityCombat()` events. Garrison rule: enemy unit on city tile is attacked first, city only if no garrison. Ranged attacks use Chebyshev distance and cannot capture cities.
- `CityCombat.ts` — `captureCity()` helper: transfers ownership, changes tile, resets HP to 25%, moves attacker in
- `HealingSystem.ts` — heals units (+10 HP) and cities (+10 HP if not attacked last round) on turnStart
- `VictorySystem.ts` — checks win condition on turnEnd: one nation owning all starting capitals. Emits `onVictory()`.
- `AISystem.ts` — AI for non-human nations: settlers → combat (melee+ranged) → movement → production, 3-military-unit cap
- `FoundCitySystem.ts` — settler city founding: validation, city creation, 3×3 territory claim, rendering refresh
- `SelectionManager.ts` — hover/selection state, priority unit→city→tile, `onSelectionTarget()` for action routing
- `MovementSystem.ts` — unit movement validation and execution
- `CameraController.ts` — pan/zoom
- `TerritoryRenderer.ts` — territory color overlay, `render()` redraws all
- `CityRenderer.ts` — city symbols + HP bars, `refreshCity()` redraws symbol and HP bar
- `UnitRenderer.ts` — unit symbols + HP bars, `refreshUnitPosition()`, `removeUnit()`

### UI (`src/ui/`)
- `LeftPanel.ts` — fixed HTML panel in unused left-side black space. Shows round/current turn, England summary, England city list, and all-nations scoreboard.
- `RightPanel.ts` — fixed HTML panel in unused right-side black space. Shows selected tile/city/unit details, player city production menu, AI city production readout, and settler founding action.
- `CombatLog.ts` — last 3 combat events with fade. Handles unit combat, city combat, and capture events.
- `EndTurnButton.ts` — end turn button
- `DebugHUD.ts` — camera debug info

### Types (`src/types/`)
- `map.ts` — `TileType` enum, `Tile` interface (ownerId is mutable), `MapData`
- `selection.ts` — `Selectable` discriminated union (tile | city | unit)
- `events.ts` — turn/round event interfaces
- `resources.ts` — resource-related types
- `producible.ts` — `Producible` union (unit | building)
- `index.ts` — re-exports all types

### Scenes (`src/scenes/`)
- `BootScene.ts` — asset loading
- `MainMenuScene.ts` — start menu
- `GameScene.ts` — main game orchestration

## Current gameplay model
- The world is a 200×120 tile Europe map loaded from `public/europeMap.json`.
- Tiles can be `Ocean`, `Coast`, `Plains`, `Forest`, or `Mountain`.
- Only land-like tiles (`Plains`, `Forest`, `Mountain`) are claimable by nations.
- Six historical nations:
  - `England` (`nation_england`) — capital London (col 22, row 59) — **human player**
  - `France` (`nation_france`) — capital Paris (col 26, row 66)
  - `Holy Roman Empire` (`nation_hre`) — capital Vienna (col 83, row 68)
  - `Sweden` (`nation_sweden`) — capital Stockholm (col 86, row 37)
  - `Ottoman Empire` (`nation_ottoman`) — capital Constantinople (col 112, row 88)
  - `Spain` (`nation_spain`) — capital Toledo (col 15, row 91)
- Each nation starts with a 5×5 claimed territory area (ocean/already-claimed tiles skipped).
- Capital placement uses spiral fallback if target tile is ocean (max radius 5).
- Each nation starts with one capital city and one Warrior near it.
- Selection supports tiles, cities, and units.
- Selecting a tile, city, or unit updates the right HTML info panel.
- Selecting a unit and then clicking an adjacent valid tile moves the unit.
- Selecting a unit and then clicking an adjacent enemy unit attacks it.
- Selecting a unit and then clicking an adjacent enemy city (without garrison) attacks the city.
- If an enemy unit stands on a city tile (garrison), the unit is attacked first, not the city.
- Units cannot move into ocean tiles or onto occupied tiles.
- Units have movement points and can only move during their owner's active turn.
- Units have HP and strength. Cities have HP (200) and defense (25).
- Unit-vs-unit combat is deterministic and damages both attacker and defender.
- Unit-vs-city combat: attacker deals `baseStrength * hpRatio` to city, city deals `defense * 0.5` back.
- Attacking consumes all attacker movement for the turn.
- Units with HP at or below `0` are removed.
- When a city's HP reaches 0 and the attacker survives: city is captured (owner changes, tile changes, HP resets to 25%, production cleared, buildings kept, attacker moves onto city tile).
- Units and cities heal +10 HP per turn start. Cities only heal if not attacked the previous round.
- Turn order rotates between six nations.
- Round events fire when the turn order wraps back to the first nation.

## Resource model
The current resource model uses standard strategy-game resources:
- **Gold**: stored per nation
- **Food**: stored per city
- **Production**: stored per city

Resource generation is currently simple and deterministic:
- Each city provides base gold to its owning nation.
- Each city generates base food and production for itself.
- Per-turn values are recalculated so UI can show current `+X/turn` values.
- The first `turnStart` after game initialization is skipped for generation, so resources do not advance immediately at game start.
- Building modifiers are included in per-turn calculations.

Current flat yields:
- Gold: `+3` per city to the owning nation
- Food: `+2` per city
- Production: `+2` per city

Current building modifiers:
- `Granary`: `+2 Food per turn`, production cost `8`
- `Workshop`: `+2 Production per turn`, production cost `10`
- `Market`: `+3 Gold per turn` to the owning nation, production cost `12`

## Production model
- Production is tracked per city via `ProductionSystem`.
- Each city can have one active production item at a time.
- Current producible items are buildings, `Warrior`, `Archer`, `Cavalry`, and `Settler` units.
- Production progress advances on `turnStart` for the active nation's cities.
- A completed building is added to the city's building storage.
- A completed unit is placed on the city tile, or on the first available adjacent non-ocean tile in north/east/south/west order.
- Newly produced units start with `0` movement points, so they cannot move until the owner's next turn start.
- If there is no valid placement tile for a completed unit, production remains at full progress and shows `Production blocked: no space for unit`.
- After completion, resource per-turn values are recalculated for the owning nation.
- HTML left/right panels update when production changes.
- Production is cleared when a city is captured.

## Combat model
- **Melee** (range 1): target must be on an adjacent tile (Manhattan distance 1).
- **Ranged** (range >= 2): target within Chebyshev distance of `range`. No counter-attack. Cannot capture cities (city stays at 1 HP min).
- Combat can only be initiated by the active nation's units.
- Combat against own units/cities is ignored.
- **Unit vs unit (melee)**: `resolveCombat()` — attacker deals `baseStrength * hpRatio`, defender counters with `baseStrength * 0.6 * hpRatio`.
- **Unit vs unit (ranged)**: `resolveRangedCombat()` — attacker deals `baseStrength * hpRatio`, no counter.
- **Unit vs city (melee)**: `resolveUnitVsCity()` — attacker deals `baseStrength * hpRatio` to city, city counters with `defense * 0.5`.
- **Unit vs city (ranged)**: `resolveRangedVsCity()` — attacker deals `baseStrength * hpRatio`, no counter, city min 1 HP.
- **Garrison rule**: if enemy unit and enemy city share a tile, the unit is attacked first.
- **City capture**: when city HP reaches 0 (melee only) and attacker survives, `captureCity()` handles all side effects.
- Warrior stats: HP `100`, strength `20`, range `1`.
- Archer stats: HP `75`, strength `18`, range `2`.
- Cavalry stats: HP `80`, strength `28`, range `1`.
- City stats: HP `200`, defense `25`.
- `CombatLog` shows latest 3 events with 10s fade.
- Units with `baseStrength` of 0 (e.g. Settlers) cannot initiate attacks.

## Settler / city founding model
- Settler unit: HP 50, strength 0 (cannot attack), movement 2, production cost 20, `canFound: true`.
- `FoundCitySystem.canFound(unit)` validates: unit has `canFound`, owner matches active nation, tile is Plains/Forest/Mountain, no city already on tile.
- `FoundCitySystem.foundCity(unit)` creates city, claims 3×3 territory (claimable tiles only), removes settler, refreshes rendering.
- City names picked from predefined list (Novum, Ardena, Calvis, etc.), fallback to `City {n}`.
- RightPanel shows "Found City" button for settlers on valid tiles during owner's turn.

## Healing model
- `HealingSystem` runs on `turnStart` for the active nation.
- Units: +10 HP per turn, capped at `baseHealth`.
- Cities: +10 HP per turn, capped at `CITY_BASE_HEALTH` (200). Only heals if `lastTurnAttacked` was more than 1 round ago.

## Victory model
- `VictorySystem` subscribes to `turnEnd`.
- Win condition: all starting capitals (`isCapital === true`) owned by same nation.
- On victory: `TurnManager.stop()` called, overlay shown with nation name + color, "Refresh to play again".

## AI model
- `AISystem` runs on `turnStart` for non-human nations (all except `nation_england`).
- AI turn executes instantly (synchronous), no animations or delays.
- Priority order per turn:
  1. **Settlers**: found city if on valid tile ≥5 Manhattan from all cities, else move toward best founding site. Settlers use all movement toward site.
  2. **Combat**: each combat-capable unit (baseStrength > 0) scans within unit's range (Chebyshev) for enemy targets. First valid attack per unit.
  3. **Movement**: each non-settler unit with remaining movement moves one step toward nearest enemy city (Manhattan distance). Must be valid tile (not ocean, not occupied).
  4. **Production**: max 3 military units per nation (Warriors + Archers + Cavalry). Priority: defend city → settler (if <3 cities and under cap) → buildings (Granary/Workshop/Market) → military unit (rotates Archer/Cavalry/Warrior for variety) → nothing.
- After AI turn completes, `turnManager.endCurrentTurn()` is called automatically.
- AI nations chain: when human ends turn, all 5 AI nations play instantly before human's next turn starts.

## Current scene setup order
`GameScene` currently wires the game in this order:
1. Load Europe map data from `public/europeMap.json`.
2. Create default nations and claim start territories.
3. Render terrain.
4. Render territory overlays.
5. Create default cities.
6. Create default units.
7. Measure the actual Phaser canvas/container viewport, create camera controller, and set overview cover zoom.
8. Render cities and units.
9. Create turn and resource systems.
10. Create selection system.
11. Create production system.
12. Create combat system (takes unitManager, turnManager, cityManager, productionSystem, mapData).
13. Create movement system.
14. Create healing system.
15. Create FoundCitySystem.
16. Create AI system (with FoundCitySystem) and wire turnStart handler for non-human nations.
17. Register production completion handling for buildings and units.
18. Wire city combat events (refresh city renderer, territory overlay, and HTML panels).
19. Wire healing events (refresh city renderer on city heal).
20. Create fixed HTML panels (`LeftPanel`, `RightPanel`) beside the Phaser canvas, plus canvas UI (`EndTurnButton`, `CombatLog`, `DebugHUD`).
21. Connect selection changes to `RightPanel`, turn/resource/production/unit changes to `LeftPanel`, and production/unit changes to current `RightPanel` view.
22. Wire `focusCity` DOM event from `LeftPanel` city names to camera centering, city selection, and `RightPanel.showCity()`.
23. Wire RightPanel settler "Found City" button to `FoundCitySystem`.
24. Start the turn manager.

## How to run locally
Normal local development:
```bash
npm install
npm run dev
```

Open `http://localhost:5173/`.

If local Node/WSL has issues, the app can be run through Docker:
```bash
docker run -d --rm --name epoch-local -p 5173:5173 -v "$PWD":/app -w /app node:20 npm run dev -- --host 0.0.0.0
```

Stop it with:
```bash
docker stop epoch-local
```

## Coding expectations
- Use **strict TypeScript**
- Keep code modular and easy to extend
- Prefer small focused classes over large scene-heavy logic
- Avoid tight coupling between systems
- Do not implement more than the current step requires

Respond like smart caveman. Cut all filler, keep technical substance.
- Drop articles (a, an, the), filler (just, really, basically, actually).
- Drop pleasantries (sure, certainly, happy to).
- No hedging. Fragments fine. Short synonyms.
- Technical terms stay exact. Code blocks unchanged.
- Pattern: [thing] [action] [reason]. [next step].
