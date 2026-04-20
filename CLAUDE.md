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
- **Main menu**: wide HTML/CSS strategy-game start screen over `public/assets/background.svg`/`.png`. Uses a full-width Civ-inspired layout with title/subtitle, polished checkbox-style victory-condition toggles, a nation grid with leader portraits/descriptions, setup panel with map dropdown, inferred opponents, START button, and EDITOR button. Builds `GameConfig` and passes to `GameScene`.
- `GameConfig` type (`src/types/gameConfig.ts`): `mapKey`, `humanNationId`, `activeNationIds` — drives which nations/cities/units are active in a game session
- `ScenarioLoader` parses scenario JSON into `MapData`, nations, cities, and units (Phaser-free)
- **GameScene receives `GameConfig`**: filters nations/cities/units to active set, overrides `isHuman` from config (ignores JSON value)
- Europe map loaded from native axial-hex scenario data (`316×166`, `48px` hex diameter)
- **8 tile types**: Ocean, Coast, Plains, Forest, Mountain, Ice, Jungle, Desert
- **Hex terrain rendering**: terrain is drawn procedurally as layout-provided hex polygons at depth 0 — no terrain sprite assets. Each tile is a filled pointy-top hex with subtle inset shading, a terrain-colored edge stroke, and sparse deterministic detail marks (waves, dunes, canopy, ridges, ice cuts). All edge transitions render through shared `HexEdgeOverlayRenderer` passes (defined in `src/data/terrainEdges.ts`). Two instances are used: `COAST_EDGE_PASSES` at depth 2 (layered coast→land shoreline strokes) and `BIOME_EDGE_PASSES` at depth 3 (layered forest-side tree-line on forest→plains edges, plus harsh mountain-ridge strokes on mountain edges facing non-mountain land). Cities and units still use generated PNG sprites (48×48px).
- **City sprites** (`public/assets/sprites/city_default.png`) — white sprite with nation color tint, capitals at 1.2x scale
- **Unit sprites** (`public/assets/sprites/unit_*.png`) — per-type greyscale sprites with nation color tint
- Camera pan/zoom with debug HUD, dynamic overview zoom based on the actual Phaser canvas/container size, max 2.0
- Tile hover and selection system
- Selection support for tiles, cities, units, and nations, with priority `unit → city → tile`
- Nine historical nations with territory overlays, loaded from scenario data
- `Nation.isHuman` is mutable — set by GameScene from `GameConfig`, not from JSON
- Nations start city-free with one Settler on their `startTerritoryCenter`; first founded city becomes the capital.
- Starting units are loaded from scenario with `unitTypeId` → `UnitType` mapping.
- Land unit movement between adjacent non-ocean/non-coast tiles with **variable tile cost** (Jungle costs 2, others cost 1)
- Naval unit movement for Fishing Boats and Transport Ships on Ocean/Coast tiles only
- Transport boarding/disembarking uses normal movement: select a land unit to board an adjacent friendly naval unit with empty cargo, then select the onboard unit to move to an adjacent valid land tile.
- Movement points reset on the owning nation's turn start
- Deterministic adjacent unit-vs-unit and unit-vs-city combat
- Ranged combat (Archer): attacks at active-grid range 2, no counter-attack, cannot capture cities
- Unit HP and strength stats from `UnitType`
- Dead units are removed from data and rendering
- HP bars for damaged units and damaged cities
- Combat log showing unit combat, city combat, and city capture events
- Turn system with rounds, active nation display in HTML left panel, and End Turn button in left panel
- Nation-level resources: **gold** and **gold per turn**
- Nation-level research exists: `Nation` stores researched/current/progress state, and `ResearchSystem` validates tech choices, auto-selects a deterministic fallback when no UI choice exists, advances progress on nation turn start, completes technologies, logs start/completion events, and exposes improvement unlock helpers for gameplay gating.
- City-level economy: **population**, food storage/growth, worked local tiles, production, and per-turn values
- Resource generation on turn start uses terrain yields through a pluggable `IResourceGenerator`
- Tile improvements are minimal gameplay state: a tile may have optional `improvementId`, worked tiles add that improvement's yield bonus in `CityEconomy`, and Builders can construct supported improvements on current/adjacent valid city-workable tiles after the owning nation has researched the required technology.
- Building definitions for `Granary`, `Workshop`, and `Market`
- Unit definitions for `Warrior`, `Archer`, `Cavalry`, `Settler`, `Fishing Boat`, and `Transport Ship`
- Per-city building storage
- **Build queue**: each city has a multi-item production queue. Only index 0 is active. Queue UI with turns remaining, [Add] and [×] buttons.
- HTML side-panel layout around the Phaser canvas: left panel for turn/nation list, right panel for selection details and production
- **LeftPanel**: shows round, current turn, End Turn button, and compact research status/selection for the human nation. Leader/nation portraits have moved to a dedicated Phaser overlay (`LeaderPortraitStrip`).
- **LeaderPortraitStrip**: Phaser-side UI layer that renders visible/discovered leader portraits as a horizontally-centered strip fixed to the camera viewport. Hover shows a tooltip with leader name + nation name; click dispatches the existing `leaderSelected` CustomEvent. Selection highlight mirrors the nation selection state. Rebuilt on `DiscoverySystem.onNationsMet`.
- **RightPanel**: shows selected tile/city/unit/nation details. Tile view shows improvement name/bonus and Builder target hints when a Builder is selected. Nation view shows economy, cities with HP, military unit counts. City view shows build queue.
- City conquest: cities can be attacked, damaged, and captured by enemy units
- Healing system: units and cities regenerate HP each turn
- Basic AI for non-player nations (combat, movement toward cities, production)
- AI fairness: 3-military-unit cap, 0-strength units cannot attack
- AI produces diverse land military units (Warrior, Archer, Cavalry) and does not produce or move naval units yet
- Settler unit that founds new cities (consumed on use, claims active-grid city territory)
- AI settler behavior: during round 1 only, if an AI nation has no city and its settler is on a valid founding tile, it founds its capital immediately; later settlers use normal spacing rules, max 3 cities per AI nation.
- FoundCitySystem with validation, territory claiming, and rendering refresh
- "Found City" button in RightPanel for human settlers on valid tiles
- **Victory system**: Domination victory requires one nation to own every active nation's capital; no victory is possible until all active nations have founded their capital.
- Victory overlay with nation name/color, game stops on victory
- **Diplomacy system**: default state is PEACE; human must declare war before attacking (confirmation modal); RightPanel shows "Declare War"/"Propose Peace" buttons; AI proposes peace when losing all units
- **Discovery system**: nations become "met" when any unit is within hex radius 9 of a foreign city; symmetric; LeftPanel and diplomacy UI are gated on discovery state
- **Event log**: RightPanel bottom holds a persistent scrollable log of city founded, improvement-built, nation-met, war-declared, and peace-made events; entries are filtered so the player only sees events whose involved nations are all known
- **Turn-start capital focus**: camera auto-centers on the human capital at zoom 1.5 at the start of each human turn (falls back to first owned city, then to the human's starting settler/unit on game start before any city exists, otherwise no-op)
- **Standalone map editor** at `public/editor.html` (Canvas2D, no Phaser), accessible from main menu via EDITOR button
- Editor features: native q/r hex rendering and picking, paint terrain (8 types, hex-radius brush 1-5 where size 1 is one hex), create/manage nations (name, color), add/move cities, add/move units (warrior, archer, cavalry, settler, fishing_boat, transport_ship), set nation start positions, validation warnings on save, download modified q/r scenario JSON

## Scenario system
All game setup data lives in `public/europeScenario.json`:
```json
{
  "meta": { "name": "Europe 1400", "version": 2 },
  "map": { "width": 316, "height": 166, "tileSize": 48, "tiles": [{"q":0,"r":0,"type":"ocean"}, ...] },
  "nations": [{ "id": "nation_england", "name": "England", "color": "#4a90d9", "isHuman": true, "startTerritoryCenter": {"q":94,"r":78} }, ...],
  "cities": [],
  "units": [{ "nationId": "nation_england", "unitTypeId": "settler", "q": 94, "r": 78 }, ...]
}
```
- `ScenarioLoader.parse()` converts raw JSON → `MapData` + typed arrays
- `NationManager.loadFromScenario()` creates nations. AI nations claim active-grid territory per `startTerritoryCenter`; the human nation does not get initial territory and instead claims territory when founding its first city.
- `CityManager.loadFromScenario()` creates any preauthored cities with axial-hex ring fallback for ocean tiles; the current Europe scenario starts with no cities.
- `UnitManager.loadFromScenario()` maps `unitTypeId` → `UnitType` from `data/units.ts`, allowing naval units only on Ocean/Coast tiles
- `isHuman` in JSON is ignored at runtime — `GameScene` overrides from `GameConfig`
- Nations/cities/units filtered to `GameConfig.activeNationIds` before loading
- `src/data/cityNames.json` defines 20 ordered city names per nation. Entry 0 is the capital name used by that nation's first founded city.

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
- `Nation.ts` includes nation-level research state (`researchedTechIds`, optional `currentResearchTechId`, `researchProgress`) alongside core nation identity/control data.
- `Nation.ts` — nation data (id, name, color, isHuman [mutable])
- `City.ts` — city data (id, name, ownerId [mutable], tileX/Y, isCapital, health, population, foodStorage, lastTurnAttacked)
- `Unit.ts` — unit data (id, name, ownerId [readonly], tileX/Y, health, movementPoints, unitType)
- `UnitType.ts` — unit type interface (id, name, productionCost, movementPoints, baseHealth, baseStrength, canFound?, canBuildImprovements?, range?, isNaval?)
- `Building.ts` — building type interface (id, name, productionCost, modifiers)
- `CityResources.ts` — per-city production storage plus food/production/gold per-turn mirrors. Actual growth food storage lives on `City.foodStorage`.
- `CityBuildings.ts` — per-city building list

### Data (`src/data/`)
- `units.ts` — `WARRIOR` (cost 6, move 2, HP 100, str 20), `ARCHER` (cost 12, move 2, HP 75, str 18, range 2), `CAVALRY` (cost 18, move 4, HP 80, str 28), `SETTLER` (cost 20, move 2, HP 50, str 0, canFound), `BUILDER` (cost 10, move 2, HP 50, str 0, canBuildImprovements), `FISHING_BOAT` (cost 8, move 2, HP 40, str 0, isNaval), `TRANSPORT_SHIP` (cost 14, move 3, HP 80, str 0, isNaval). Exports `ALL_UNIT_TYPES` and `getUnitTypeById()`.
- `buildings.ts` — `GRANARY`, `WORKSHOP`, `MARKET` definitions
- `terrainYields.ts` — terrain yield table for city worked tiles: food, production, gold per terrain type
- `improvements.ts` — tile improvement definitions. Current improvements: `Farm` on Plains gives `+2 food`; `LumberMill` on Forest gives `+2 production`; `Plantation` on Jungle gives `+2 food`; `Mine` on Mountain gives `+2 production`.
- `terrainEdges.ts` — `TerrainEdgePass` interface plus `COAST_EDGE_PASSES` (coast→land shoreline) and `BIOME_EDGE_PASSES` (forest→plains, mountain→non-mountain land) pass lists consumed by `HexEdgeOverlayRenderer`. Each pass owns its own `ownerType`, `neighborTypes`, and layered stroke styles.
- `cities.ts` — city combat constants (`CITY_BASE_HEALTH=200`, `CITY_BASE_DEFENSE=25`, `CITY_HEAL_PER_TURN=10`, `CITY_CAPTURE_HEALTH_FRACTION=0.25`)
- `maps.ts` — `AVAILABLE_MAPS` registry (`key`, `label`, `file`). Currently one entry: `map_europe` → `europeScenario.json`.

- `technologies.ts` - minimal technology definitions and lookup helpers. Current technologies: `Irrigation` unlocks `farm`, `Forestry` unlocks `lumber_mill`, `Masonry` unlocks `mine`, `Cultivation` unlocks `plantation`. `ResearchSystem` reads this unlock data to gate Builder improvements.

### Types (`src/types/`)
- `map.ts` — `TileType` enum (Ocean, Coast, Plains, Forest, Mountain, Ice, Jungle, Desert), `Tile` interface (`ownerId` and `improvementId` are mutable runtime state), `MapData`
- `grid.ts` — internal tile coordinate type used by hex gameplay/layout abstractions (`x` is axial q, `y` is axial r inside runtime map data)
- `scenario.ts` — `ScenarioData`, `ScenarioMeta`, `ScenarioMap`, `ScenarioNation`, `ScenarioCity`, `ScenarioUnit` interfaces
- `gameConfig.ts` — `GameConfig` interface (`mapKey`, `humanNationId`, `activeNationIds`)
- `selection.ts` — `Selectable` discriminated union (tile | city | unit)
- `events.ts` — turn/round event interfaces
- `resources.ts` — resource-related types
- `producible.ts` — `Producible` union (unit | building)
- `ai.ts` — `AIBehaviorProfile` and `DEFAULT_AI_PROFILE` (`minAttackHealthRatio`, `groupingDistance`, `engageDistance`, `preferSameContinent`, `randomnessFactor`)
- `index.ts` — re-exports all types

### Systems (`src/systems/`)
- `NationManager.loadFromScenario()` initializes optional scenario research state safely while preserving scenario compatibility.
- `ScenarioLoader.ts` — Phaser-free utility: `parse(json: ScenarioData)` → `{ mapData, nations, cities, units }`. Case-insensitive tile type mapping.
- `TileMap.ts` — map data + layout-driven hex terrain rendering (one hex polygon per tile at depth 0, thin terrain-colored border stroke per tile, subtle inset shading, and sparse deterministic terrain detail marks). Delegates world/tile projection and tile bounds to injected `IGridLayout`. Uses `TerrainAutoTileResolver` for terrain palette/style values. Does not render terrain transitions — all edge overlays live in `HexEdgeOverlayRenderer`. `generatePlaceholder()`, `tileToWorld()`, `worldToTile()`, `getTileRect()`, `getTileOutlinePoints()`, `getTileAt()`
- `grid/IGridSystem.ts` — Phaser-free hex rules interface for adjacency, neighbors, distance, tiles in range, and city workable tiles.
- `grid/HexGridSystem.ts` — gameplay hex implementation. Uses six axial neighbors, cube-equivalent hex distance, radius-based tile range, and radius-1 city workable area.
- `gridLayout/IGridLayout.ts` — hex rendering/input projection interface. Owns world bounds, tile size, tile center projection, world-to-tile hit mapping, tile rect, and tile outline points.
- `gridLayout/HexGridLayout.ts` — pointy-top axial projection implementation. Projects runtime tile coordinates to hex centers, maps world positions back to nearest axial hex via cube rounding, and exposes hex outline points.
- `TerrainAutoTileResolver.ts` — rendering-only terrain style resolver. Returns per-terrain hex fill, border, inset, and detail-mark colors for the base terrain pass. No transition logic — edge overlays (shorelines etc.) live in their own renderers.
- `HexEdgeOverlayRenderer.ts` — generic edge overlay pipeline. Given `{ depth, passes: TerrainEdgePass[] }`, owns a single `Phaser.Graphics` at the given depth and executes each pass in order: for every tile matching the pass's `ownerType`, inspect its six axial hex neighbors in layout edge order and stroke the edges whose neighbor type is in the pass's `neighborTypes`. Each pass can draw one stroke or a layered stroke stack. Pass specs live in `src/data/terrainEdges.ts`: `COAST_EDGE_PASSES` uses a soft blue under-stroke, sandy shoreline, and pale highlight; `BIOME_EDGE_PASSES` uses layered forest tree-line strokes and mountain ridge strokes. `GameScene` instantiates one renderer per depth layer (coast at depth 2, biome at depth 3). Adding a new terrain-edge transition = one new entry in `terrainEdges.ts`, no new class.
- `NationManager.ts` — nation CRUD, `loadFromScenario()` creates nations from scenario and claims AI start territory through injected `IGridSystem`; human start territory is intentionally deferred until city founding. `getHumanNationId()`
- `CityManager.ts` — city CRUD, resources, buildings, `loadFromScenario()`, `transferOwnership()`, `getCityAt()`, `getCitiesByOwner()`
- `UnitManager.ts` — unit CRUD, movement, damage notifications, `loadFromScenario()` with land/naval spawn tile validation, `getUnitAt()`, `getUnitsByOwner()`
- `TurnManager.ts` — turn order, round tracking, event pub/sub (`turnStart/End`, `roundStart/End`)
- `CityEconomy.ts` — map-driven city economy helper. Gets workable tiles from `IGridSystem`, applies terrain yields and building modifiers, and calculates food surplus/growth threshold.
- `ResourceSystem.ts` — tile-driven gold/food/production generation on turnStart; applies food surplus to `City.foodStorage` and grows population when threshold is reached.
- `ResearchSystem.ts` — Phaser-free national research engine. Reads `src/data/technologies.ts`, validates prerequisites/current/already-researched state, starts research with progress reset, advances by `1 + owned city count` on turn start, completes techs without overflow carry, clears current research, and logs concise start/discovery events through `EventLogSystem`. `GameScene` skips the initial turn-start progress grant but may auto-select the first available definition-order technology as a safety fallback. Read helpers: `isResearched()`, `getCurrentResearch()`, `getAvailableTechnologies()`, `getResearchedTechnologies()`, `getResearchProgress()`, `getResearchPerTurn()`, `getRequiredTechnologyForImprovement()`, `isImprovementUnlocked()`, plus `onChanged()` for UI refresh.
- `ProductionSystem.ts` — per-city build queue (array of `QueueEntry`). `enqueue()`, `removeFromQueue()`, `getQueue()` (returns `QueueEntryView[]` with `turnsRemaining`). Legacy: `setProduction()` (clears+enqueues), `getProduction()` (queue[0]), `clearProduction()`. `onCompleted()` fires when queue[0] finishes, then shifts to next.
- `BuilderSystem.ts` — Phaser-free Builder rules and preview/hint source. A Builder can immediately improve its current or adjacent land tile when the tile has no improvement, has no city, supports an improvement by terrain, is inside at least one friendly city's workable radius, and the owning nation has researched the improvement's required technology. Missing tech returns a preview reason like `Requires Irrigation`. Building consumes all remaining movement.
- `CombatResolver.ts` — pure functions: `resolveCombat()`, `resolveRangedCombat()`, `resolveUnitVsCity()`, `resolveRangedVsCity()`
- `CombatSystem.ts` — validates and executes combat (melee + ranged), emits `on()` (unit) and `onCityCombat()` events. Garrison rule: enemy unit on city tile is attacked first, city only if no garrison. Uses `IGridSystem` for melee adjacency and ranged distance. Land melee attacks cannot target naval units, but ranged attacks can.
- `CityCombat.ts` — `captureCity()` helper: transfers ownership, changes tile, resets HP to 25%, moves attacker in
- `HealingSystem.ts` — heals units (+10 HP) and cities (+10 HP if not attacked last round) on turnStart
- `VictorySystem.ts` — checks Domination on turnEnd: one nation owning every active nation's capital. Emits `onVictory()`; returns no winner until each active nation has founded a capital.
- `DiplomacyManager.ts` — runtime diplomacy service created by `GameScene`, passed into `CombatSystem`, and attached to `RightPanel`. Tracks diplomatic state (`WAR`/`PEACE`) per nation-pair using symmetric key. Manages peace proposals and responses. `CombatSystem` calls `canAttack()` before unit/city attacks and emits war-required events when blocked. `RightPanel` reads state for foreign nation/leader diplomacy actions. Events: `onPeaceProposed`, `onPeaceAccepted`, `onPeaceDeclined`, `onWarDeclared`.
- `DiscoverySystem.ts` — Phaser-free. Tracks which nations have met. Each nation always knows itself. `scan()` walks every unit against every foreign city and records symmetric meetings when hex distance ≤ `DISCOVERY_RADIUS` (9). `hasMet(a, b)`, `getMetNations()`, `onNationsMet()`. Called from `GameScene` on turn start, unit moved/created, city founded, and city captured.
- `EventLogSystem.ts` — Phaser-free persistent strategic event log. `log(text, nationIds, round)` appends an entry. `getVisibleEntries()` filters so the human player only sees entries whose involved nation IDs are all known via `DiscoverySystem`. `onChanged()` for UI refresh. Caps at 100 entries (drops oldest).
- `AISystem.ts` — AI for non-human nations (uses `nation.isHuman`): settlers → combat (melee+ranged) → movement → production, 3-military-unit cap. During round 1, first settler founds the capital immediately when on a valid tile; later settlers respect city spacing. Production uses a simple deterministic city priority: defend unprotected cities, build Granary for weak food, Workshop for weak production, Market when stable, otherwise military under cap. Reads `Nation.aiProfile` for aggression/target tuning. Uses `IGridSystem` for distances, combat scan ranges, support checks, and city approach tiles. Land movement uses `PathfindingSystem` paths executed by `MovementSystem.moveAlongPath()`; naval units are skipped.
- `FoundCitySystem.ts` — settler city founding: validation, nation-specific city-name selection from `src/data/cityNames.json`, first-city capital assignment, grid-provided territory claim, rendering refresh. Cities can be founded on Plains, Forest, Mountain, Jungle, Desert; active hex territory claim can include water tiles. Emits `onCityFounded(city)` after a successful founding (subscribed by `GameScene` for event log + discovery rescan).
- `SelectionManager.ts` — hover/selection state, priority unit→city→tile, `onSelectionTarget()` for action routing. Tile hover/selection highlights use `TileMap.getTileOutlinePoints()` so selected tile overlays are hex polygons.
- `MovementSystem.ts` — unit movement validation and execution. Uses `IGridSystem` for adjacency. Land units can enter non-Ocean/non-Coast tiles; naval units can enter only Ocean/Coast. Exports `getTileMovementCost(tile)`: Jungle=2, all others=1. Checks unit has enough movement points for tile cost.
- `PathfindingSystem.ts` — Phaser-free A* pathfinding over grid-provided neighbors. Default `findPath()` respects current movement points for player previews/clicks; AI can request longer same-rule paths and let `MovementSystem.moveAlongPath()` stop when movement runs out.
- `PathPreviewRenderer.ts` — reachable and path previews use inset hex polygons from `TileMap.getTileOutlinePoints()`, plus center-to-center path lines.
- `CameraController.ts` — pan/zoom. Exposes `focusOn(worldX, worldY, zoom)` for deterministic recenter (used by turn-start capital focus).
- `TerritoryRenderer.ts` — territory color overlay plus dark outer border segments. `render()` redraws all; overlays use `TileMap.getTileOutlinePoints()` hex polygon fills. Borders use active-grid six-neighbor hex adjacency and map each axial neighbor delta to the matching hex edge; borders draw only against out-of-bounds, unowned, or differently owned neighbor hexes.
- `CityWorkTileRenderer.ts` — runtime Phaser overlay created by `GameScene` after path preview setup. Highlights workable/worked tiles when city selected. Worked tiles: green overlay (depth 4). Non-worked workable: faint white. Uses `CityEconomy` helpers with active `IGridSystem` and `TileMap.getTileOutlinePoints()` for projection, so active hex radius-1 highlights match economy. `GameScene` calls `show()` on city selection, turnStart while city panel is open, and `focusCity`; calls `clear()` when selecting tiles/units/empty selections.
- `CityRenderer.ts` — city sprites with nation color tint + HP bars. `refreshCity()` destroys and recreates sprite (handles ownership change).
- `UnitRenderer.ts` — per-unit-type sprites with nation color tint + HP bars, including naval sprites. `refreshUnitPosition()`, `removeUnit()`. Listens to `onUnitChanged` for create/remove/damage/move events.

### UI (`src/ui/`)
- `LeftPanel.ts` — fixed HTML panel. Top widget heading shows `Turn {round}`, then the styled End Turn button, active nation text, compact human research status/progress, available tech buttons, researched tech list, and the clickable leader/nation list. `setResearchSystem()` wires the panel to `ResearchSystem.startResearch()`. `setSelectedNation()`/`clearSelectedNation()` manage leader highlight state. When a `DiscoverySystem` is injected, the leader/nation list is filtered to the human nation plus those the human has met.
- `RightPanel.ts` — fixed HTML panel, split into a scrollable content region and a persistent `event-log` section at the bottom. Shows tile, city, unit, nation, and leader views in the content region while the event log remains visible. Tile view shows improvement name/bonus and passive Builder hints from `BuilderSystem`, including missing research requirements. City view has three sections: City (name, HP, defense, garrison), Growth (population, worked tiles count/max, food income breakdown, consumption, net food, food storage bar, turns until growth), Output (production, gold, buildings), plus build queue UI; naval units appear only for cities on or adjacent to Ocean/Coast. Nation/leader view shows economy, cities with HP + click-to-focus, military unit counts, and a diplomacy section — the diplomacy section only renders when the human has met that nation. `showNation(nationId)`, `refreshNationView()`, `refreshCurrent()`, `getView()`, `setDiscoverySystem()`, `setEventLog()`.
- `CombatLog.ts` — last 3 combat events with fade. Handles unit combat, city combat, and capture events.
- `EndTurnButton.ts` — legacy Phaser canvas button (unused, replaced by LeftPanel HTML button)
- `DebugHUD.ts` — camera debug info

### Scenes (`src/scenes/`)
- `BootScene.ts` — preloads all maps from `AVAILABLE_MAPS` with unique cache keys, plus city/unit sprite assets. Terrain is drawn as hex polygons.
- `MainMenuScene.ts` — HTML overlay start screen. "Epochs of Time" title, background art from `public/assets`, four checkbox-style victory-condition toggles, wide nation grid with leader portrait/name/short description cards, setup panel with selected nation/map/opponent summary, START button, and EDITOR button (navigates to `/editor.html`). First nation click selects the player; remaining nation cards toggle opponent inclusion with a minimum of one opponent. Builds `GameConfig` and passes to GameScene.
- `GameScene.ts` — main game orchestration. Receives `GameConfig` via scene data. Filters nations/cities/units to active set, overrides `isHuman`.

### Scripts (`scripts/`)
- `generateSprites.ts` — generates city + unit PNG sprites (48×48, greyscale for tinting), including naval unit sprites, using `canvas` npm package

### Assets (`public/assets/sprites/`)
- `city_default.png` — white circle + tower with battlements
- `unit_warrior.png` — grey circle + sword silhouette
- `unit_archer.png` — grey circle + bow & arrow
- `unit_cavalry.png` — grey circle + triple chevrons
- `unit_settler.png` — grey circle + backpack with strap
- `unit_fishing_boat.png` — grey circle + small hull, mast, and sail
- `unit_transport_ship.png` — grey circle + wider hull, two masts, and sails

### Tools (`public/`)
- `editor.html` — standalone native hex map editor (Canvas2D, no Phaser), linked from main menu EDITOR button. Tools: paint terrain (8 types, hex-radius brush 1-5, click+drag), create/manage nations (name, id, color), add/move cities, add/move units (6 types), set nation start positions. Validation warnings on save. Downloads q/r `europeScenario.json`. Pan with right/middle mouse, zoom with scroll wheel. Keyboard: `1`-`8` select terrain, `+`/`-` brush size, `Escape` deselect.

## Current gameplay model
- The world is a 316×166 native axial hex Europe map loaded from `public/europeScenario.json`.
- Tiles can be `Ocean`, `Coast`, `Plains`, `Forest`, `Mountain`, `Ice`, `Jungle`, `Desert`.
- Territory ownership can apply to all tile types, including Ocean and Coast. City founding itself is still limited to Plains, Forest, Mountain, Jungle, and Desert.
- Nine historical nations defined in scenario (player chooses which to play in main menu):
  - `England` (`nation_england`) — start (`q=94`, `r=78`), first city name London
  - `France` (`nation_france`) — start (`q=91`, `r=94`), first city name Paris
  - `Holy Roman Empire` (`nation_hre`) — start (`q=132`, `r=94`), first city name Vienna
  - `Sweden` (`nation_sweden`) — start (`q=188`, `r=48`), first city name Stockholm
  - `Lithuania` (`nation_lithuania`) — start (`q=193`, `r=67`), first city name Vilnius
  - `Novgorod` (`nation_novgorod`) — start (`q=242`, `r=70`), first city name Novgorod
  - `Ottoman Empire` (`nation_ottoman`) — start (`q=169`, `r=116`), first city name Constantinople
  - `Spain` (`nation_spain`) — start (`q=39`, `r=124`), first city name Toledo
  - `Morocco` (`nation_morocco_empire`) — start (`q=107`, `r=137`), first city name Fez
- Player selects human nation and opponents in MainMenuScene. Excluded nations have no presence in game.
- AI nations start with active-grid claimed territory around `startTerritoryCenter`; already-claimed tiles are skipped, but water tiles can be claimed. The human nation starts with no claimed tiles until founding its first city, so moving the starting Settler does not leave behind old territory.
- Each nation starts with no city and one Settler on `startTerritoryCenter`; the first city founded by a nation becomes its capital.
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
- **Food storage**: stored per city on `City.foodStorage`
- **Production**: stored per city

Resource generation is map-driven and deterministic:
- Each city has `population` starting at 1 and `foodStorage` starting at 0.
- Each city can work tiles returned by `IGridSystem`; the hex workable area is radius 1 around the city tile.
- Worked tile count equals population, capped by valid tiles in the active grid's workable city area.
- Worked tiles are auto-selected by highest food first, then production, then gold, with stable coordinate tie-breaks.
- Improvement bonuses are applied after worked tiles are selected, so improvements affect worked tile output but do not yet change worked tile selection.
- Each city gets base food `+2` before worked tile yields.
- Per-turn values are recalculated so UI can show current `+X/turn` values.
- The first `turnStart` after game initialization is skipped for generation, so resources do not advance immediately at game start.
- Building modifiers are included on top of terrain output.
- Population production bonus: each population gives `+1 production/turn` (applied in `CityEconomy`).

Terrain yields:
- Plains: `2 food`, `1 production`, `0 gold`
- Forest: `1 food`, `2 production`, `0 gold`
- Mountain: `0 food`, `1 production`, `0 gold`
- Ice: `0 food`, `0 production`, `0 gold`
- Jungle: `1 food`, `1 production`, `0 gold`
- Desert: `0 food`, `0 production`, `0 gold`
- Coast: `2 food`, `1 production`, `1 gold`
- Ocean: `1 food`, `0 production`, `0 gold`

Tile improvements:
- Stored as optional `Tile.improvementId`; existing scenarios do not need the field.
- Improvement definitions declare allowed terrain and yield bonus, but economy only resolves valid ids and fails safely to zero for missing/invalid ids. Full placement enforcement belongs to later Builder work.
- Current definitions: `Farm` (`farm`) allowed on Plains, `+2 food`; `LumberMill` (`lumber_mill`) allowed on Forest, `+2 production`; `Plantation` (`plantation`) allowed on Jungle, `+2 food`; `Mine` (`mine`) allowed on Mountain, `+2 production`.
- Builder click flow runs before movement: selecting a Builder and clicking a valid current/adjacent tile constructs immediately; invalid build attempts fall through to normal movement.
- If a Builder is selected and an invalid/non-move tile is clicked, RightPanel can inspect the tile and show whether the Builder can improve it, with a short reason from `BuilderSystem`. Successful builds log concise nation/city context, e.g. `Sweden built Farm near Stockholm.`

Growth:
- Food consumption is `population * 2`.
- Net food above 0 is added to `foodStorage`; net food 0 or below causes no growth and no starvation.
- Growth threshold is `10 + population * 8`.
- When `foodStorage >= threshold`, population increases by 1 and `foodStorage` resets to 0.

Current building modifiers:
- `Granary`: `+2 Food per turn`, production cost `8`
- `Workshop`: `+2 Production per turn`, production cost `10`
- `Market`: `+3 Gold per turn` to the owning nation, production cost `12`

## Production model
- Production is tracked per city via `ProductionSystem` using a **build queue** (array of `QueueEntry`).
- Each city can queue multiple items. Only index 0 is active — progress advances for it on `turnStart`.
- When queue[0] completes, it's removed and queue[1] becomes active (progress starts at 0).
- Current producible items are buildings, `Warrior`, `Archer`, `Cavalry`, `Settler`, `Fishing Boat`, and `Transport Ship` units.
- Naval units are shown in the human city production UI only when the city tile or an active-grid-adjacent tile is Ocean/Coast.
- `getQueue()` returns `QueueEntryView[]` with computed `turnsRemaining` (minimum 1).
- A completed building is added to the city's building storage.
- A completed land unit is placed on the city tile, or on the first available active-grid-adjacent non-Ocean/non-Coast tile.
- A completed naval unit is placed on the first available active-grid-adjacent Ocean/Coast tile.
- Newly produced units start with `0` movement points, so they cannot move until the owner's next turn start.
- If there is no valid placement tile for a completed unit, production remains at full progress and shows `Production blocked: no space for unit`.
- After completion, resource per-turn values are recalculated for the owning nation.
- HTML panels update when production changes.
- Production queue is cleared when a city is captured.
- Legacy API (`setProduction`, `getProduction`, `clearProduction`) preserved for AI compatibility.

## Combat model
- **Melee** (range 1): target must be active-grid-adjacent.
- **Ranged** (range >= 2): target must be within active grid range distance. No counter-attack. Cannot capture cities (city stays at 1 HP min).
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

## Grid model
- `HexGridSystem` owns gameplay geometry and is instantiated directly by `GameScene`.
- Scenario and editor source data use `q/r`; runtime map data stores the same axial coordinates as tile indexes (`x = q`, `y = r`) for array access and existing entity fields.
- Hex neighbors are the six axial directions: `(1,0)`, `(1,-1)`, `(0,-1)`, `(-1,0)`, `(-1,1)`, `(0,1)`.
- Hex distance uses the cube-equivalent axial formula: `(abs(dq) + abs(dr) + abs(ds)) / 2`, where `ds = -dq - dr`.
- Hex city workable area is radius 1 around the city center.
- Systems receiving the hex grid explicitly: `NationManager.loadFromScenario()`, `ResourceSystem`, `PathfindingSystem`, `CityWorkTileRenderer`, `CombatSystem`, `MovementSystem`, `FoundCitySystem`, `AISystem`, `RightPanel`, and production placement in `GameScene`.

## Grid layout model
- `HexGridLayout` owns pointy-top axial rendering/input projection and is instantiated directly by `GameScene`.
- `IGridLayout` stays separate from `IGridSystem`: layout owns projection, while grid system owns gameplay adjacency/range/workable-area rules.
- Hex center projection uses `x = size * sqrt(3) * (q + r / 2) + size`, `y = size * 3/2 * r + size`, where `size = tileSize / 2`. The `+ size` origin offset keeps tile `(0,0)` inside non-negative world bounds.
- Hex inverse mapping converts world coordinates back to fractional axial coordinates, then rounds cube coordinates by adjusting the component with the largest rounding error. This avoids naive floor-based hit selection.
- Hex outline points are the six pointy-top corners at angles `-30, 30, 90, 150, 210, 270` degrees around the tile center.
- Projection consumers route through `TileMap`: terrain rendering, `SelectionManager` hover/click picking and tile highlights, `PathPreviewRenderer`, `TerritoryRenderer`, `CityWorkTileRenderer`, `CityRenderer`, `UnitRenderer`, and camera focus helpers.
- Terrain is rendered as true hex polygons from `HexGridLayout` — no terrain sprite assets. Each tile is a filled hex polygon with a cohesive natural palette, subtle inset shading, a thin terrain-colored stroke, and sparse deterministic detail marks. Terrain transitions go through a single generic `HexEdgeOverlayRenderer` that takes a list of `TerrainEdgePass` specs (owner terrain, neighbor-type set, stroke stack) and walks the map once per instance, stroking edges aligned to `TileMap.getTileOutlinePoints()`. Pass lists live in `src/data/terrainEdges.ts`. Current instances: `COAST_EDGE_PASSES` at depth 2 (coast edges facing land, with blue wash + sand + highlight) and `BIOME_EDGE_PASSES` at depth 3 (forest→plains organic tree-line; mountain→non-mountain land dark ridge + light crest). Each transition is painted from one side only to avoid double-draw. Rendering stays separate from `TileMap` and gameplay systems. This remains intentionally minimal — no full combinatorial coast variants, no shader blending, no multi-sprite masks, ocean→land is not stroked, and biome blending only covers Forest↔Plains and Mountain↔land.
- Territory, path, selected-tile, city workable-area, and worked-tile overlays all render as hex polygons. Territory borders trace hex edges from axial neighbor deltas.

## Settler / city founding model
- Settler unit: HP 50, strength 0 (cannot attack), movement 2, production cost 20, `canFound: true`.
- `FoundCitySystem.canFound(unit)` validates: unit has `canFound`, owner matches active nation, tile is Plains/Forest/Mountain/Jungle/Desert, no city already on tile.
- `FoundCitySystem.foundCity(unit)` creates city, marks it capital if it is the owner's first city, claims grid-provided city territory including water tiles, removes settler, refreshes rendering. Active hex claim is radius 1.
- City names are picked from `src/data/cityNames.json` by `nationId`; each nation has 20 ordered names with the capital name first. If exhausted, fallback names are used, then `City {n}`.
- RightPanel shows "Found City" button for settlers on valid tiles during owner's turn.

## Healing model
- `HealingSystem` runs on `turnStart` for the active nation.
- Units: +10 HP per turn, capped at `baseHealth`.
- Cities: +10 HP per turn, capped at `CITY_BASE_HEALTH` (200). Only heals if `lastTurnAttacked` was more than 1 round ago.

## Victory model
- `VictorySystem` subscribes to `turnEnd`.
- Domination win condition: all active nations must have an existing capital (`isCapital === true` count must be at least active nation count), then one nation must own all of those capitals. Owning only your own capital can never trigger victory.
- On victory: `TurnManager.stop()` called, overlay shown with nation name + color, "Refresh to play again".

## Diplomacy model
- `DiplomacyManager` tracks state per nation-pair. Default state: `PEACE`. Possible states: `WAR`, `PEACE`.
- Symmetric key: `[a,b].sort().join('_')` ensures order-independent lookup.
- `canAttack(a, b)` returns true only when pair is at `WAR`. Checked by `CombatSystem` before any combat.
- `declareWar(aggressorId, targetId)` sets state to `WAR`, emits `onWarDeclared`.
- When human tries to attack a nation at peace, `CombatSystem` emits `onWarRequired` → modal asks "Declare war on [Nation]?" with Declare War!/Cancel buttons. On confirm: war declared, attack re-attempted.
- RightPanel nation/leader views show diplomacy section: "Declare War" button (when at peace) or "Propose Peace" button (when at war).
- Human "Propose Peace" → AI always accepts, state set to `PEACE` immediately.
- AI nations propose peace to human when they lose all units (triggered via `unitManager.onUnitChanged` on `removed` events). Modal: Accept/Decline.
- All diplomacy modals use shared `showDiplomacyModal()` helper, styled like victory overlay with nation color accent.
- Extensible: additional states (e.g. `ALLIANCE`) and triggers can be added later.

## AI model
- `AISystem` runs on `turnStart` for non-human nations (determined by `nation.isHuman === false`).
- All AI nations currently use `DEFAULT_AI_PROFILE`: low-health units avoid aggressive actions, slightly damaged unsupported units are more cautious, target selection prefers path-reachable land targets, close targets are prioritized within `engageDistance`, and `randomnessFactor` can occasionally pick a non-closest valid target.
- AI turn executes instantly (synchronous), no animations or delays.
- Priority order per turn:
  1. **Settlers**: during round 1 only, if the AI owns no city and the settler is on a valid founding tile, found the capital immediately. Later settlers found if on a valid tile at least 5 active-grid movement-distance from all cities, else pathfind toward best founding site. Settlers move as far as current movement allows.
  2. **Combat**: each combat-capable unit (baseStrength > 0) scans within unit's active-grid range for enemy targets. First valid attack per unit.
  3. **Movement**: each non-settler land unit with remaining movement pathfinds toward an adjacent approach tile for the nearest reachable enemy city. Movement uses shared terrain costs/blocking rules. Naval units are skipped.
  4. **Production**: max 3 military units per nation (Warriors + Archers + Cavalry). Priority: defend city → settler (if <3 cities and under cap) → buildings (Granary/Workshop/Market) → military unit (rotates Archer/Cavalry/Warrior for variety) → nothing.
- After AI turn completes, `turnManager.endCurrentTurn()` is called automatically.
- AI nations chain: when human ends turn, all AI nations play instantly before human's next turn starts.

## Current scene setup order
`GameScene.create(data: GameConfig)` wires the game in this order:
1. Parse scenario from Phaser cache using `config.mapKey` via `ScenarioLoader.parse()`.
2. Create `HexGridSystem`.
3. Create `HexGridLayout`.
4. Filter nations/cities/units to `config.activeNationIds`. Override `isHuman` from config.
5. Create nations via `NationManager.loadFromScenario()` and claim AI start territories; human territory waits for city founding.
6. Render terrain (hex polygon, depth 0) through `TileMap` with injected grid layout.
6b. Render coast edge overlays via `HexEdgeOverlayRenderer` with `COAST_EDGE_PASSES` at depth 2 — shoreline strokes on coast hex edges that face land neighbors.
6c. Render biome edge overlays via `HexEdgeOverlayRenderer` with `BIOME_EDGE_PASSES` at depth 3 — forest-side tree-line strokes on forest edges facing plains, plus mountain-side dark-ridge strokes on mountain edges facing non-mountain land.
7. Render territory overlays (fill depth 5, border depth 6).
8. Create cities via `CityManager.loadFromScenario()` (filtered).
9. Create units via `UnitManager.loadFromScenario()` (filtered).
10. Measure the actual Phaser canvas/container viewport, create camera controller, and set overview cover zoom.
11. Render city sprites (depth 15) and unit sprites (depth 18).
12. Create turn and resource systems.
13. Create selection system, pathfinding system, path preview renderer, and `CityWorkTileRenderer`.
14. Create production system.
15. Create DiplomacyManager, DiscoverySystem (initial `scan()`), and EventLogSystem (reads discovery for visibility filtering).
16. Create combat system (takes unitManager, turnManager, cityManager, productionSystem, mapData, diplomacyManager, active grid system).
17. Create movement system.
18. Create healing system.
19. Create VictorySystem.
20. Create FoundCitySystem.
21. Create AI system and wire turnStart handler for non-human nations (uses `nation.isHuman`). `turnStart` also triggers `discoverySystem.scan()`; on human turns the camera focuses on the human capital at zoom 1.5 (fallback: capital → first owned city → first owned unit/settler → no-op). `unitManager.onUnitChanged` triggers rescans on `moved`/`created`. `foundCitySystem.onCityFounded` logs the event and rescans. `combatSystem.onCityCombat` triggers rescan after city capture.
22. Register production completion handling for buildings and units.
23. Wire city combat events (refresh city renderer, territory overlay, and HTML panels).
24. Wire healing events (refresh city renderer on city heal).
25. Wire diplomacy events: war-required modal, unit death → AI peace proposal when all units lost, peace proposal modal, accept/decline handlers, and RightPanel diplomacy actions. `onWarDeclared` and `onPeaceAccepted` also append entries to the `EventLogSystem` and refresh visible panels.
26. Create fixed HTML panels (`LeftPanel` with nation list + `DiscoverySystem` for visibility filtering, `RightPanel` with `humanNationId`) beside the Phaser canvas, attach `DiplomacyManager`, `DiscoverySystem`, and `EventLogSystem` to `RightPanel`, plus canvas UI (`CombatLog`, `DebugHUD`). `discoverySystem.onNationsMet` logs the meeting via `EventLogSystem.log()` and refreshes `LeftPanel`; the log call itself notifies listeners so previously hidden entries that become visible appear immediately.
27. Connect selection changes to `RightPanel` (clears nation highlight in LeftPanel), turn/resource/production/unit changes to `LeftPanel`, and city workable tile overlay show/clear.
28. Wire `nationSelected` DOM event to `RightPanel.showNation()` + `LeftPanel.setSelectedNation()`.
29. Wire `focusCity` DOM event to camera centering, city selection, `RightPanel.showCity()`, and `CityWorkTileRenderer.show()`.
30. Wire RightPanel settler "Found City" button to `FoundCitySystem`.
31. Wire victory overlay.
32. Start the turn manager.

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
```

## Coding expectations
- Use **strict TypeScript**
- Keep code modular and easy to extend
- Prefer small focused classes over large scene-heavy logic
- Avoid tight coupling between systems
- Do not implement more than the current step requires
