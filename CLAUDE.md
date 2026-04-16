# CLAUDE.md

## Project overview
This project is a browser-based 2D turn-based strategy game built with **Phaser 3**, **TypeScript**, and **Vite**.  
The long-term goal is a simpler Civilization-style game played on a **real map of Europe**, not a random map.

## Current architecture
The project is being built step by step with a clean and extensible structure.

Implemented so far:
- Basic Phaser + TypeScript + Vite project setup
- **Scenario-driven data loading**: all game data (map, nations, cities, units) loaded from `public/europeScenario.json`
- Scene flow: `BootScene` (preloads all maps + sprites) → `MainMenuScene` (nation/map selection) → `GameScene`
- **Main menu**: "EPOCH" styled start screen with map dropdown, nation selection cards, opponent toggles. Builds `GameConfig` and passes to `GameScene`.
- `GameConfig` type (`src/types/gameConfig.ts`): `mapKey`, `humanNationId`, `activeNationIds` — drives which nations/cities/units are active in a game session
- `ScenarioLoader` parses scenario JSON into `MapData`, nations, cities, and units (Phaser-free)
- **GameScene receives `GameConfig`**: filters nations/cities/units to active set, overrides `isHuman` from config (ignores JSON value)
- Europe map loaded from scenario (`200×120`, `48px` tiles, 9600×5760px world)
- **8 tile types**: Ocean, Coast, Plains, Forest, Mountain, Ice, Jungle, Desert
- **PNG sprite rendering**: terrain tiles, cities, and units all use generated PNG sprites (48×48px)
- **Terrain sprites** in `public/assets/sprites/terrain/` — one per tile type, rendered via `scene.add.image()` at depth 0
- **City sprites** (`public/assets/sprites/city_default.png`) — white sprite with nation color tint, capitals at 1.2x scale
- **Unit sprites** (`public/assets/sprites/unit_*.png`) — per-type greyscale sprites with nation color tint
- Camera pan/zoom with debug HUD, dynamic overview zoom based on the actual Phaser canvas/container size, max 2.0
- Tile hover and selection system
- Selection support for tiles, cities, units, and nations, with priority `unit → city → tile`
- Six historical nations with territory overlays, loaded from scenario data
- `Nation.isHuman` is mutable — set by GameScene from `GameConfig`, not from JSON
- Capital cities at historical locations with spiral fallback for ocean tiles (marked `isCapital`)
- Starting units per nation, loaded from scenario with `unitTypeId` → `UnitType` mapping
- Land unit movement between adjacent non-ocean/non-coast tiles with **variable tile cost** (Jungle costs 2, others cost 1)
- Naval unit movement for Fishing Boats and Transport Ships on Ocean/Coast tiles only
- Transport boarding/disembarking uses normal movement: select a land unit to board an adjacent friendly naval unit with empty cargo, then select the onboard unit to move to an adjacent valid land tile.
- Movement points reset on the owning nation's turn start
- Deterministic adjacent unit-vs-unit and unit-vs-city combat
- Ranged combat (Archer): attacks at Chebyshev distance 2, no counter-attack, cannot capture cities
- Unit HP and strength stats from `UnitType`
- Dead units are removed from data and rendering
- HP bars for damaged units and damaged cities
- Combat log showing unit combat, city combat, and city capture events
- Turn system with rounds, active nation display in HTML left panel, and End Turn button in left panel
- Nation-level resources: **gold** and **gold per turn**
- City-level resources: **food**, **production**, and per-turn values
- Resource generation on turn start, using a pluggable `IResourceGenerator`
- Building definitions for `Granary`, `Workshop`, and `Market`
- Unit definitions for `Warrior`, `Archer`, `Cavalry`, `Settler`, `Fishing Boat`, and `Transport Ship`
- Per-city building storage
- **Build queue**: each city has a multi-item production queue. Only index 0 is active. Queue UI with turns remaining, [Add] and [×] buttons.
- HTML side-panel layout around the Phaser canvas: left panel for turn/nation list, right panel for selection details and production
- **LeftPanel**: shows round, current turn, clickable nation list (name + color swatch), End Turn button. Clicking nation shows details in RightPanel.
- **RightPanel**: shows selected tile/city/unit/nation details. Nation view shows economy, cities with HP, military unit counts. City view shows build queue.
- City conquest: cities can be attacked, damaged, and captured by enemy units
- Healing system: units and cities regenerate HP each turn
- Basic AI for non-player nations (combat, movement toward cities, production)
- AI fairness: 3-military-unit cap, 0-strength units cannot attack
- AI produces diverse land military units (Warrior, Archer, Cavalry) and does not produce or move naval units yet
- Settler unit that founds new cities (consumed on use, claims 3×3 territory)
- AI settler behavior: founds cities ≥5 tiles from existing cities, max 3 cities per AI nation
- FoundCitySystem with validation, territory claiming, and rendering refresh
- "Found City" button in RightPanel for human settlers on valid tiles
- **Victory system**: last nation holding all starting capitals wins
- Victory overlay with nation name/color, game stops on victory
- **Standalone map editor** at `public/editor.html` (Canvas2D, no Phaser)

## Scenario system
All game setup data lives in `public/europeScenario.json`:
```json
{
  "meta": { "name": "Europe 1400", "version": 1 },
  "map": { "width": 200, "height": 120, "tileSize": 48, "tiles": [{"x":0,"y":0,"type":"ocean"}, ...] },
  "nations": [{ "id": "nation_england", "name": "England", "color": "#4a90d9", "isHuman": true, "startTerritoryCenter": {"x":43,"y":56} }, ...],
  "cities": [{ "id": "city_london", "name": "London", "nationId": "nation_england", "tileX": 43, "tileY": 56, "isCapital": true }, ...],
  "units": [{ "nationId": "nation_england", "unitTypeId": "warrior", "tileX": 43, "tileY": 57 }, ...]
}
```
- `ScenarioLoader.parse()` converts raw JSON → `MapData` + typed arrays
- `NationManager.loadFromScenario()` creates nations, claims 5×5 territory per `startTerritoryCenter`
- `CityManager.loadFromScenario()` creates cities with spiral fallback for ocean tiles
- `UnitManager.loadFromScenario()` maps `unitTypeId` → `UnitType` from `data/units.ts`, allowing naval units only on Ocean/Coast tiles
- `isHuman` in JSON is ignored at runtime — `GameScene` overrides from `GameConfig`
- Nations/cities/units filtered to `GameConfig.activeNationIds` before loading

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
  - Communication between HTML UI and Phaser should stay explicit through events/state updates, for example selection changes, `focusCity`, `nationSelected`, turn/resource/production updates.
- Use **event-driven systems**
  - New systems should react to events such as `turnStart`, `turnEnd`, `roundStart`, `roundEnd`
- Keep APIs clean and extensible
- Do **not** add unnecessary gameplay mechanics before the foundation is ready

## File structure overview

### Entities (`src/entities/`)
- `Nation.ts` — nation data (id, name, color, isHuman [mutable])
- `City.ts` — city data (id, name, ownerId [mutable], tileX/Y, isCapital, health, lastTurnAttacked)
- `Unit.ts` — unit data (id, name, ownerId [readonly], tileX/Y, health, movementPoints, unitType)
- `UnitType.ts` — unit type interface (id, name, productionCost, movementPoints, baseHealth, baseStrength, canFound?, range?, isNaval?)
- `Building.ts` — building type interface (id, name, productionCost, modifiers)
- `CityResources.ts` — per-city food/production storage
- `CityBuildings.ts` — per-city building list

### Data (`src/data/`)
- `units.ts` — `WARRIOR` (cost 6, move 2, HP 100, str 20), `ARCHER` (cost 12, move 2, HP 75, str 18, range 2), `CAVALRY` (cost 18, move 4, HP 80, str 28), `SETTLER` (cost 20, move 2, HP 50, str 0, canFound), `FISHING_BOAT` (cost 8, move 2, HP 40, str 0, isNaval), `TRANSPORT_SHIP` (cost 14, move 3, HP 80, str 0, isNaval). Exports `ALL_UNIT_TYPES` and `getUnitTypeById()`.
- `buildings.ts` — `GRANARY`, `WORKSHOP`, `MARKET` definitions
- `cities.ts` — city combat constants (`CITY_BASE_HEALTH=200`, `CITY_BASE_DEFENSE=25`, `CITY_HEAL_PER_TURN=10`, `CITY_CAPTURE_HEALTH_FRACTION=0.25`)
- `maps.ts` — `AVAILABLE_MAPS` registry (`key`, `label`, `file`). Currently one entry: `map_europe` → `europeScenario.json`.

### Types (`src/types/`)
- `map.ts` — `TileType` enum (Ocean, Coast, Plains, Forest, Mountain, Ice, Jungle, Desert), `Tile` interface (ownerId is mutable), `MapData`
- `scenario.ts` — `ScenarioData`, `ScenarioMeta`, `ScenarioMap`, `ScenarioNation`, `ScenarioCity`, `ScenarioUnit` interfaces
- `gameConfig.ts` — `GameConfig` interface (`mapKey`, `humanNationId`, `activeNationIds`)
- `selection.ts` — `Selectable` discriminated union (tile | city | unit)
- `events.ts` — turn/round event interfaces
- `resources.ts` — resource-related types
- `producible.ts` — `Producible` union (unit | building)
- `index.ts` — re-exports all types

### Systems (`src/systems/`)
- `ScenarioLoader.ts` — Phaser-free utility: `parse(json: ScenarioData)` → `{ mapData, nations, cities, units }`. Case-insensitive tile type mapping.
- `TileMap.ts` — map data + sprite-based terrain rendering (one `scene.add.image()` per tile at depth 0). `generatePlaceholder()`, `tileToWorld()`, `worldToTile()`, `getTileAt()`
- `NationManager.ts` — nation CRUD, `loadFromScenario()` creates nations from scenario + claims 5×5 territory, `getHumanNationId()`, spiral land-tile fallback
- `CityManager.ts` — city CRUD, resources, buildings, `loadFromScenario()`, `transferOwnership()`, `getCityAt()`, `getCitiesByOwner()`
- `UnitManager.ts` — unit CRUD, movement, damage notifications, `loadFromScenario()` with land/naval spawn tile validation, `getUnitAt()`, `getUnitsByOwner()`
- `TurnManager.ts` — turn order, round tracking, event pub/sub (`turnStart/End`, `roundStart/End`)
- `ResourceSystem.ts` — gold/food/production generation on turnStart
- `ProductionSystem.ts` — per-city build queue (array of `QueueEntry`). `enqueue()`, `removeFromQueue()`, `getQueue()` (returns `QueueEntryView[]` with `turnsRemaining`). Legacy: `setProduction()` (clears+enqueues), `getProduction()` (queue[0]), `clearProduction()`. `onCompleted()` fires when queue[0] finishes, then shifts to next.
- `CombatResolver.ts` — pure functions: `resolveCombat()`, `resolveRangedCombat()`, `resolveUnitVsCity()`, `resolveRangedVsCity()`
- `CombatSystem.ts` — validates and executes combat (melee + ranged), emits `on()` (unit) and `onCityCombat()` events. Garrison rule: enemy unit on city tile is attacked first, city only if no garrison. Ranged attacks use Chebyshev distance and cannot capture cities. Land melee attacks cannot target naval units, but ranged attacks can.
- `CityCombat.ts` — `captureCity()` helper: transfers ownership, changes tile, resets HP to 25%, moves attacker in
- `HealingSystem.ts` — heals units (+10 HP) and cities (+10 HP if not attacked last round) on turnStart
- `VictorySystem.ts` — checks win condition on turnEnd: one nation owning all starting capitals. Emits `onVictory()`.
- `AISystem.ts` — AI for non-human nations (uses `nation.isHuman`): settlers → combat (melee+ranged) → movement → production, 3-military-unit cap. Naval units are skipped for AI movement/production.
- `FoundCitySystem.ts` — settler city founding: validation, city creation, 3×3 territory claim, rendering refresh. Claimable/foundable: Plains, Forest, Mountain, Jungle, Desert.
- `SelectionManager.ts` — hover/selection state, priority unit→city→tile, `onSelectionTarget()` for action routing
- `MovementSystem.ts` — unit movement validation and execution. Land units can enter non-Ocean/non-Coast tiles; naval units can enter only Ocean/Coast. Exports `getTileMovementCost(tile)`: Jungle=2, all others=1. Checks unit has enough movement points for tile cost.
- `CameraController.ts` — pan/zoom
- `TerritoryRenderer.ts` — territory color overlay, `render()` redraws all
- `CityRenderer.ts` — city sprites with nation color tint + HP bars. `refreshCity()` destroys and recreates sprite (handles ownership change).
- `UnitRenderer.ts` — per-unit-type sprites with nation color tint + HP bars, including naval sprites. `refreshUnitPosition()`, `removeUnit()`. Listens to `onUnitChanged` for create/remove/damage/move events.

### UI (`src/ui/`)
- `LeftPanel.ts` — fixed HTML panel. Shows round/current turn, clickable nation list (color swatch + name, "(You)" suffix for human), End Turn button at bottom. Dispatches `nationSelected` DOM event on click. `setSelectedNation()`/`clearSelectedNation()` for highlight state.
- `RightPanel.ts` — fixed HTML panel. Shows 4 view types: tile, city, unit, nation. City view includes build queue UI (queue display + add-to-queue); naval units appear only for cities on or adjacent to Ocean/Coast. Nation view shows economy, cities with HP + click-to-focus, military unit counts. `showNation(nationId)`, `refreshNationView()`, `getView()` for current view type.
- `CombatLog.ts` — last 3 combat events with fade. Handles unit combat, city combat, and capture events.
- `EndTurnButton.ts` — legacy Phaser canvas button (unused, replaced by LeftPanel HTML button)
- `DebugHUD.ts` — camera debug info

### Scenes (`src/scenes/`)
- `BootScene.ts` — preloads all maps from `AVAILABLE_MAPS` with unique cache keys, plus sprite assets (city, unit, terrain)
- `MainMenuScene.ts` — HTML overlay start screen. "EPOCH" title, map dropdown, nation selection cards, opponent toggles (min 1), START button. Builds `GameConfig` and passes to GameScene.
- `GameScene.ts` — main game orchestration. Receives `GameConfig` via scene data. Filters nations/cities/units to active set, overrides `isHuman`.

### Scripts (`scripts/`)
- `generateSprites.ts` — generates city + unit PNG sprites (48×48, greyscale for tinting), including naval unit sprites, using `canvas` npm package
- `generateTerrainSprites.ts` — generates 8 terrain tile PNGs (48×48, full fill) using `canvas` npm package
- `generateMap.ts` — map generation script

### Assets (`public/assets/sprites/`)
- `city_default.png` — white circle + tower with battlements
- `unit_warrior.png` — grey circle + sword silhouette
- `unit_archer.png` — grey circle + bow & arrow
- `unit_cavalry.png` — grey circle + triple chevrons
- `unit_settler.png` — grey circle + backpack with strap
- `unit_fishing_boat.png` — grey circle + small hull, mast, and sail
- `unit_transport_ship.png` — grey circle + wider hull, two masts, and sails
- `terrain/*.png` — 8 terrain tiles (ocean, coast, plains, forest, mountain, ice, jungle, desert)

### Tools (`public/`)
- `editor.html` — standalone map editor (Canvas2D, no Phaser). Paint terrain (8 types, brush size 1-5, click+drag), move cities/units, download modified `europeScenario.json`. Pan with right/middle mouse, zoom with scroll wheel. Keyboard: `1`-`8` select terrain, `+`/`-` brush size, `Escape` deselect.

## Current gameplay model
- The world is a 200×120 tile Europe map loaded from `public/europeScenario.json`.
- Tiles can be `Ocean`, `Coast`, `Plains`, `Forest`, `Mountain`, `Ice`, `Jungle`, `Desert`.
- Claimable tiles (territory, city founding): Plains, Forest, Mountain, Jungle, Desert. Ice is not claimable.
- Six historical nations defined in scenario (player chooses which to play in main menu):
  - `England` (`nation_england`) — capital London (col 43, row 56)
  - `France` (`nation_france`) — capital Paris (col 47, row 68)
  - `Holy Roman Empire` (`nation_hre`) — capital Vienna (col 83, row 68)
  - `Sweden` (`nation_sweden`) — capital Stockholm (col 108, row 34)
  - `Ottoman Empire` (`nation_ottoman`) — capital Constantinople (col 124, row 85)
  - `Spain` (`nation_spain`) — capital Toledo (col 15, row 91)
- Player selects human nation and opponents in MainMenuScene. Excluded nations have no presence in game.
- Each nation starts with a 5×5 claimed territory area (ocean/already-claimed tiles skipped).
- Capital placement uses spiral fallback if target tile is ocean (max radius 5).
- Each nation starts with units defined in scenario (default: one Warrior near capital).
- Selection supports tiles, cities, units, and nations (via LeftPanel click).
- Selecting a tile, city, or unit updates the right HTML info panel.
- Clicking a nation in LeftPanel shows nation detail (economy, cities, military) in RightPanel.
- Selecting a unit and then clicking an adjacent valid tile moves the unit.
- Selecting a land unit and clicking an adjacent friendly naval unit boards it if the ship has no cargo; selecting the onboard unit and clicking an adjacent valid land tile disembarks it.
- Selecting a unit and then clicking an adjacent enemy unit attacks it.
- Selecting a unit and then clicking an adjacent enemy city (without garrison) attacks the city.
- If an enemy unit stands on a city tile (garrison), the unit is attacked first, not the city.
- Land units cannot move into Ocean or Coast tiles; naval units can move only into Ocean and Coast tiles. No unit can move onto an occupied tile.
- Units have movement points and can only move during their owner's active turn.
- **Movement cost**: Jungle tiles cost 2 movement points, all other passable tiles cost 1.
- Naval units treat all valid water tiles as movement cost 1.
- Units have HP and strength. Naval units currently have 0 strength and cannot initiate attacks. Cities have HP (200) and defense (25).
- Unit-vs-unit combat is deterministic and damages both attacker and defender.
- Archers can attack naval units through the existing ranged combat system; land melee units cannot attack naval units.
- Unit-vs-city combat: attacker deals `baseStrength * hpRatio` to city, city deals `defense * 0.5` back.
- Attacking consumes all attacker movement for the turn.
- Units with HP at or below `0` are removed.
- When a city's HP reaches 0 and the attacker survives: city is captured (owner changes, tile changes, HP resets to 25%, production cleared, buildings kept, attacker moves onto city tile).
- Units and cities heal +10 HP per turn start. Cities only heal if not attacked the previous round.
- Turn order rotates between active nations only.
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
- Production is tracked per city via `ProductionSystem` using a **build queue** (array of `QueueEntry`).
- Each city can queue multiple items. Only index 0 is active — progress advances for it on `turnStart`.
- When queue[0] completes, it's removed and queue[1] becomes active (progress starts at 0).
- Current producible items are buildings, `Warrior`, `Archer`, `Cavalry`, `Settler`, `Fishing Boat`, and `Transport Ship` units.
- Naval units are shown in the human city production UI only when the city tile or a Manhattan-adjacent tile is Ocean/Coast.
- `getQueue()` returns `QueueEntryView[]` with computed `turnsRemaining` (minimum 1).
- A completed building is added to the city's building storage.
- A completed land unit is placed on the city tile, or on the first available adjacent non-Ocean/non-Coast tile in north/east/south/west order.
- A completed naval unit is placed on the first available adjacent Ocean/Coast tile in north/east/south/west order.
- Newly produced units start with `0` movement points, so they cannot move until the owner's next turn start.
- If there is no valid placement tile for a completed unit, production remains at full progress and shows `Production blocked: no space for unit`.
- After completion, resource per-turn values are recalculated for the owning nation.
- HTML panels update when production changes.
- Production queue is cleared when a city is captured.
- Legacy API (`setProduction`, `getProduction`, `clearProduction`) preserved for AI compatibility.

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
- `FoundCitySystem.canFound(unit)` validates: unit has `canFound`, owner matches active nation, tile is Plains/Forest/Mountain/Jungle/Desert, no city already on tile.
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
- `AISystem` runs on `turnStart` for non-human nations (determined by `nation.isHuman === false`).
- AI turn executes instantly (synchronous), no animations or delays.
- Priority order per turn:
  1. **Settlers**: found city if on valid tile ≥5 Manhattan from all cities, else move toward best founding site. Settlers use all movement toward site.
  2. **Combat**: each combat-capable unit (baseStrength > 0) scans within unit's range (Chebyshev) for enemy targets. First valid attack per unit.
  3. **Movement**: each non-settler unit with remaining movement moves one step toward nearest enemy city (Manhattan distance). Must be valid tile (not ocean, not occupied).
  4. **Production**: max 3 military units per nation (Warriors + Archers + Cavalry). Priority: defend city → settler (if <3 cities and under cap) → buildings (Granary/Workshop/Market) → military unit (rotates Archer/Cavalry/Warrior for variety) → nothing.
- After AI turn completes, `turnManager.endCurrentTurn()` is called automatically.
- AI nations chain: when human ends turn, all AI nations play instantly before human's next turn starts.

## Current scene setup order
`GameScene.create(data: GameConfig)` wires the game in this order:
1. Parse scenario from Phaser cache using `config.mapKey` via `ScenarioLoader.parse()`.
2. Filter nations/cities/units to `config.activeNationIds`. Override `isHuman` from config.
3. Create nations via `NationManager.loadFromScenario()` and claim start territories.
4. Render terrain (sprite-based, depth 0).
5. Render territory overlays (depth 5).
6. Create cities via `CityManager.loadFromScenario()` (filtered).
7. Create units via `UnitManager.loadFromScenario()` (filtered).
8. Measure the actual Phaser canvas/container viewport, create camera controller, and set overview cover zoom.
9. Render city sprites (depth 15) and unit sprites (depth 18).
10. Create turn and resource systems.
11. Create selection system.
12. Create production system.
13. Create combat system (takes unitManager, turnManager, cityManager, productionSystem, mapData).
14. Create movement system.
15. Create healing system.
16. Create VictorySystem.
17. Create FoundCitySystem.
18. Create AI system and wire turnStart handler for non-human nations (uses `nation.isHuman`).
19. Register production completion handling for buildings and units.
20. Wire city combat events (refresh city renderer, territory overlay, and HTML panels).
21. Wire healing events (refresh city renderer on city heal).
22. Create fixed HTML panels (`LeftPanel` with nation list, `RightPanel` with `humanNationId`) beside the Phaser canvas, plus canvas UI (`CombatLog`, `DebugHUD`).
23. Connect selection changes to `RightPanel` (clears nation highlight in LeftPanel), turn/resource/production/unit changes to `LeftPanel`.
24. Wire `nationSelected` DOM event to `RightPanel.showNation()` + `LeftPanel.setSelectedNation()`.
25. Wire `focusCity` DOM event to camera centering, city selection, and `RightPanel.showCity()`.
26. Wire RightPanel settler "Found City" button to `FoundCitySystem`.
27. Wire victory overlay.
28. Start the turn manager.

## How to run locally
Normal local development:
```bash
npm install
npm run dev
```

Open `http://localhost:5173/` for the game.  
Open `http://localhost:5173/editor.html` for the map editor.

If local Node/WSL has issues, the app can be run through Docker:
```bash
docker run -d --rm --name epoch-local -p 5173:5173 -v "$PWD":/app -w /app node:20 npm run dev -- --host 0.0.0.0
```

Stop it with:
```bash
docker stop epoch-local
```

### Sprite generation
```bash
npm run generate-sprites    # city + unit sprites
npm run generate-terrain    # terrain tile sprites
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
