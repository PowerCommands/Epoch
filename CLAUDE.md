# CLAUDE.md

## Project overview

Browser-based 2D turn-based strategy game built with Phaser 3 + TypeScript + Vite.  
Goal: simplified Civilization-style gameplay on a real Europe map.

---

## Core principles

* Data-driven game (scenario JSON controls map, nations, cities, units)
* Pure logic separate from rendering and UI
* Small modular systems
* Event-driven communication
* Incremental changes only

---

## Architecture rules

### Separation of concerns

* Entities → pure TypeScript (no Phaser)
* Systems → game rules only
* Renderers → visuals only (world + UI rendering primitives)
* UI → user interaction and display (Phaser screen-space UI for runtime, HTML only where explicitly used)
* GameScene → orchestration only; creates systems, wires dependencies, creates UI layers, and connects UI callbacks/events to systems

Never mix responsibilities.

---

### UI model

* Phaser → game world and primary runtime UI
* Phaser screen-space UI is used for HUD, overlays, right sidebar, minimap, and interaction panels
* HTML/CSS → used only for specific overlays/tools (e.g. CityView, diagnostics, editor)
* UI must remain separate from game logic
* Communication between UI and gameplay systems must happen through explicit events, callbacks, or state updates
* Gameplay rules must not live in UI components

---

### Runtime UI

* `HudLayer` is the primary Phaser HUD layer
* `RightSidebarPanel` is the Phaser screen-space right-side panel
* `RightSidebarPanelDataProvider` prepares data for UI and must not contain gameplay rules
* `MinimapHud` renders the minimap
* `LeaderPortraitStrip` renders nation/leader access
* `UnitActionToolbox` handles unit interaction UI
* `CityView` is an HTML/CSS overlay for human-owned city inspection
* `DiagnosticDialog` is an HTML/CSS debug dialog opened via cheat command
* `EscapeMenu` handles save/load/quit flow

---

### Input handling

* Phaser UI elements MUST consume pointer events on `pointerdown`
* Phaser UI elements MUST consume pointer events on `pointerup`
* `SelectionManager` and `CameraController` must respect consumed pointers
* Shared gating between UI input and world input is a core architectural rule
* UI must prevent click-through into map interaction

---

### Phaser UI pattern

* Build runtime UI as screen-space Phaser UI components/layers
* UI must be resolution-aware and react to viewport changes
* UI must not contain gameplay logic
* UI communicates with systems via callbacks, events, or explicit state updates

---

### Data model

* Scenario data comes from JSON files via `public/assets/maps/manifest.json`
* `scripts/generateMapManifest.ts` builds the manifest
* Leader → nation mapping is defined in `src/data/leaders.ts`
* Editor uses generated `public/assets/data/nations-manifest.json`
* Scenario files contain only active nations
* Runtime controlled via `GameConfig`
* `isHuman` is set at runtime only

---

## Entities

### City

* Tracks `ownedTileCoords` (territory)
* Tracks `workedTileCoords` (yield-producing tiles)
* Tracks `nextExpansionTileCoord` (planned growth)
* `ownedTileCoords` is authoritative territory state

### Tile

* May contain `buildingId`
* May contain `buildingConstruction`
* Only one building per tile
* `buildingConstruction` represents reserved construction

---

## Gameplay constraints

### Map & tiles

* Map selection is manifest-driven
* Predefined tile types
* Territory allowed on land + water
* Cities only on land

---

### Movement

* No diagonal movement
* Land units → cannot enter Ocean/Coast
* Naval units → only Ocean/Coast
* Jungle cost = 2, others = 1
* No unit stacking
* Movement points enforced

---

### Combat

* Deterministic
* Melee and ranged
* Ranged cannot capture cities
* Garrison blocks city damage
* 0-strength units cannot attack
* Land melee cannot attack naval units

---

### Cities & economy

* Population, food, production
* 3x3 workable tiles
* Deterministic growth
* Buildings modify yields
* Production queue

* Cities explicitly track:
  * owned tiles
  * worked tiles
  * planned expansion tile

* Tile-based building placement:
  * Placement starts a placement mode
  * Placement reserves tile (`buildingConstruction`)
  * Building completes via production

* Nation happiness is global:
  * Affected by population, city count, buildings
  * Impacts growth and production

---

### CityTerritorySystem

* Initializes and maintains city territory
* Assigns worked tiles
* Computes claimable tiles
* Stores next expansion tile
* Applies tile claiming on culture growth

---

### BuildingPlacementSystem

* Validates tile-building placement
* Uses `city.ownedTileCoords`
* Handles placement mode and confirmation
* Writes `tile.buildingConstruction`

---

### CityViewRenderer

* Renders city center, territory, worked tiles
* Highlights claimable and planned tiles
* Shows production progress
* Visual only (no logic)

---

### TileBuildingRenderer

* Renders tile buildings and construction
* Shows progress visually
* No gameplay logic

---

### TerritoryRenderer

* Renders borders using nation color
* Uses outer-edge computation
* Supports emphasis modes

---

### DiagnosticSystem

* Provides runtime diagnostic data
* Drives diagnostic dialog
* Extensible for debugging

---

### Resource model

* Worked tiles stored explicitly on cities
* Updated by systems, not computed ad-hoc

---

### Culture expansion

* Centralized claim logic
* Planned expansion tile stored on city
* Human can retarget expansion
* Progress is visualized
* Claiming occurs when threshold reached

---

### Gameplay visualization

* Tile yield icons:
  * 🌾 Food
  * ⚙️ Production
  * 🔬 Science
  * 💰 Gold
  * ⭐ Culture
  * 😀 Happiness

* Map shows compact icons
* Detailed breakdown in CityView
* Only real values shown

---

### AI

* Runs for non-human nations only
* Order:
  1. settlers
  2. combat
  3. movement
  4. production

---

### Diplomacy

* Default = PEACE
* WAR required for combat
* Event-driven

---

### Victory

* All capitals owned by one nation

---

### Cheat / debug

* `diagnostic` command toggles diagnostics dialog

---

## Turn queue (unit focus system)

### Core behavior

* At turn start:
  * Units enter queue
  * First unit becomes active
  * Camera focuses active unit

* If no units:
  * Focus capital

---

### Queue rules

Include unit if:

* Owned by human
* Not sleeping
* Has movement

Remove when:

* Movement = 0
* Skipped
* Sleeping

---

### Manual override

* Selecting unit:
  * Becomes active
  * Inserted in queue

---

### Controls

* Space → skip
* S → sleep

---

## Camera behavior

### Turn start

* Focus capital
* Zoom = 1.5

### Navigation

* Focus active unit

### Shortcuts

* C → focus logic
* Space → skip
* S → sleep
* R → ranged attack
* M → move
* A → attack
* Enter / Return → end current human turn
* Escape → menu

---

## Editor

* Canvas2D only
* Paint mode and pan mode
* Accurate hex picking
* Brush size 1–5

---

## Systems design rules

* Prefer new systems over expanding existing ones
* Single responsibility per system
* Avoid duplication
* Use events

GameScene:

* Creates systems
* Wires dependencies
* Creates UI layers
* Connects UI to systems
* Must not contain gameplay logic

---

## File structure

* entities/ → data models
* systems/ → game logic
* ui/ → UI components (primarily Phaser UI, plus specific HTML overlays/tools)
* scenes/ → Phaser scenes
* data/ → definitions
* types/ → interfaces

---

## Coding rules

* Strict TypeScript
* No `any`
* No hidden mutations
* No large classes
* Use constants

---

## Development approach

1. Identify system
2. Extend or create system
3. Wire into GameScene
4. Update UI if needed
5. Keep changes minimal

---

## Mindset

Stable base > features  
Clarity > cleverness  
Systems > hacks  
Determinism > randomness
