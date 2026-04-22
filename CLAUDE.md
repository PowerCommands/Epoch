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
* Renderers → visuals only
* UI → Phaser HUD for gameplay, HTML only for temporary legacy panels
* GameScene → orchestration only

Never mix responsibilities.

---

### UI model

* Phaser → game world AND in-game HUD (units, map, actions, turn button)
* HTML/CSS → temporary panels only (`RightPanel`), planned for removal
* Long-term goal → Phaser-only UI for gameplay

### UI Direction (Important)

* The project is moving toward fully Phaser-driven UI (no HTML overlays for gameplay)
* Reason:
  * Consistent input handling
  * No click-through bugs between HUD and world
  * Better control over rendering, depth, and layering
* Rule:
  * No new gameplay UI should be implemented in HTML
* HTML UI is no longer part of the core gameplay loop
* Phaser screen-space UI is the authoritative interaction layer
* All gameplay input handling must go through Phaser UI and respect pointer consumption

### Input handling

* Phaser UI elements MUST consume pointer events on `pointerdown`
* Phaser UI elements MUST consume pointer events on `pointerup`
* `SelectionManager` and `CameraController` must respect consumed pointers / claimed HUD pointer sequences
* Shared gating between HUD input and world input is a core architectural rule

### UI

* `CityView` is an HTML/CSS overlay for human-owned city inspection
* It opens when a human-owned city is selected
* It shows a compact city summary and detailed city-tile visualization
* It uses zoom `2.0`, emphasizes the city focus area, and de-emphasizes the surrounding map
* It shows compact worked-tile icons and a hover tooltip with full tile breakdown
* It supports drag-drop retargeting of the planned expansion tile
* Building selection in the `RightPanel` can start tile-building placement for the selected human city
* `DiagnosticDialog` is an HTML/CSS floating dialog opened through the `diagnostic` cheat command
* It is draggable, resizable, closable, and live-updating
* `RightPanel` is still active at runtime but is legacy UI planned for removal after the Phaser HUD migration

---

### Data model

* Scenario data comes from JSON files discovered via `public/assets/maps/manifest.json`
* `scripts/generateMapManifest.ts` scans `public/assets/maps/*.json` and writes the manifest used by BootScene, MainMenuScene, and the standalone editor
* Leader → nation mapping remains canonical in `src/data/leaders.ts`
* Browser/editor nation choices come from generated `public/assets/data/nations-manifest.json`; the standalone editor does not read TypeScript source directly
* Scenario files contain only the active nation subset for that map/session
* Runtime controlled via `GameConfig`
* `isHuman` set at runtime only

### Entities

#### City

* Cities now explicitly track `ownedTileCoords` for city territory
* Cities now explicitly track `workedTileCoords` for the yield-producing subset
* Cities now explicitly track `nextExpansionTileCoord` for planned culture growth
* `ownedTileCoords` is the authoritative city territory
* `workedTileCoords` is the explicit subset currently producing yields
* `nextExpansionTileCoord` is the stored next culture-expansion target

#### Tile

* Tiles may store `buildingId`
* Tiles may store `buildingConstruction`
* Only one tile building may exist per tile
* `buildingId` means a finished tile building
* `buildingConstruction` means a reserved/under-construction tile building site

---

## Gameplay constraints

### Map & tiles

* Map availability is manifest-driven; adding a scenario JSON to `public/assets/maps` makes it selectable after manifest generation
* Predefined tile types
* Territory allowed on land + water
* Cities only on land

### Movement

* No diagonal movement
* Land units → no Ocean/Coast
* Naval units → only Ocean/Coast
* Jungle cost = 2, others = 1
* No stacking
* Movement points enforced

### Combat

* Deterministic
* Melee + ranged
* Ranged cannot capture cities
* Garrison blocks city damage
* 0-strength units cannot attack
* Land melee cannot attack naval units

### Cities & economy

* Population + food + production
* 3x3 workable tiles
* Cities explicitly track `ownedTileCoords` as authoritative territory
* Cities store `workedTileCoords` as the per-turn worked subset
* Cities store `nextExpansionTileCoord` as planned culture expansion
* Deterministic growth
* Buildings modify yields
* Nation happiness is a global nation-level mechanic, not a per-city citizen mood model
* City count, population, and finished building happiness all feed the global nation happiness state
* Happiness penalties affect real growth and production through existing economy systems
* Production queue
* Tile-based building placement is additive and does not replace existing city building logic
* RightPanel building selection starts placement mode instead of immediately queueing a building
* Successful placement reserves a construction site on a tile
* The building only becomes finished when production completes

### CityTerritorySystem

* Initializes city-owned tiles
* Assigns worked tiles per city based on population and yields
* Determines claimable tiles from centralized culture-expansion rules
* Chooses and stores the next planned expansion tile
* Lets the human set a valid planned next expansion tile
* Performs city tile claims and refreshes explicit territory state

### BuildingPlacementSystem

* Centralizes valid tile-building placement rules
* Computes valid placement tiles directly from `city.ownedTileCoords`
* Handles placement mode state and improvement-replacement confirmation flow
* Reserves placement by writing `tile.buildingConstruction`

### CityViewRenderer

* Renders city center, owned tiles, worked tiles, claimable tiles, and next expansion tile
* Handles Phaser visualization only
* Adds focus-region emphasis and de-emphasizes the outer map area
* Renders compact in-tile yield icons
* Renders planned expansion progress with centered percent
* Highlights valid drag-drop targets in pink during retargeting
* Highlights valid tile-building placement targets in cyan while placement mode is active
* Shows under-construction tile sites and their production progress in City View

### TileBuildingRenderer

* Renders tile-bound building sprites from `assets/sprites/buildings/{buildingId}.png`
* Renders reserved construction sites separately from finished buildings
* Shows real centered construction progress from the city production queue
* Stays visual-only and rebuilds from explicit tile state

### TerritoryRenderer

* Territory borders still use the same outer-edge computation as before
* Borders now use nation color instead of a hardcoded black stroke
* Borders render thicker for readability and support a City View emphasis mode

### DiagnosticSystem

* Centralizes runtime diagnostic data and diagnostic dialog state
* First version exposes zoom and camera position
* Designed for future expansion beyond camera values

### Resource model

* Worked tiles are no longer computed ad-hoc only from radius rules
* They are stored explicitly on the city and refreshed by system logic

### Gameplay / culture expansion

* Claimable tiles are determined in one centralized system
* Cities maintain a stored planned next expansion tile
* Human players can inspect city territory in City View
* Human players can choose the planned next expansion tile from valid claimable tiles
* The planned next expansion tile shows real claim progress visually
* Human players retarget planned expansion via drag-drop between valid claimable tiles
* Claim progress is based on real city culture and current claim cost
* Actual tile claiming still happens only when culture expansion triggers
* This model prepares the future City View and later human override

### Gameplay visualization

* Worked tile symbols use:
* `🌾` Food
* `⚙️` Production
* `🔬` Science
* `💰` Gold
* `⭐` Culture
* `😀` Happiness
* The primary in-map representation is compact icons
* Detailed numeric breakdown is shown in City View tooltip
* Only implemented real values should be shown
* Cyan tile highlights indicate valid building placement targets in City View

### AI

* Runs only for non-human nations
* Order:

  1. settlers
  2. combat
  3. movement
  4. production

### Diplomacy

* Default = PEACE
* WAR required for combat
* Event-driven

### Victory

* All capitals owned by one nation

### Cheat / debug tooling

* The old on-map debug HUD has been removed
* Cheat command `diagnostic` toggles the runtime diagnostics dialog

---

## Turn queue (unit focus system)

### Core behavior

* At start of human turn:

  * All eligible units enter a queue
  * First unit becomes active
  * Camera focuses active unit

* If no units:

  * Focus capital

### Queue rules

A unit is included if:

* Owned by human
* Not sleeping
* Movement > 0

A unit leaves queue when:

* Movement = 0
* Skipped (Space)
* Set to sleep

### Manual override

* Selecting another unit:

  * Becomes active immediately
  * Inserted at current queue position

### Skip

* Space → next unit
* If all skipped → queue ends

### Sleep

* Excluded from queue

### Edge cases

* All sleeping → focus capital
* New unit mid-turn → not added
* Dead unit → removed

---

## Camera behavior

### Turn start

* Focus capital
* Zoom = 1.5

### Queue navigation

* Focus active unit

### Shortcuts

Press **C**:

* Active unit → focus
* Else:

  1. Capital
  2. First city
  3. First unit\

Press **Space**:
* Active unit → skip turn

Press **S**:
* Active unit → Sleep

Press **R**:
* Active unit → initiate Ranged attack

Press **M**:
* Active unit → Move mode

Press **A**:
* Active unit → Attack

Press **Escape**:
* Activates menu to save, load or quit game

---

## Editor interaction model

### Modes

#### Paint mode (default)

* Click → paint terrain
* Drag → continuous paint
* Brush size 1–5
* Active when terrain selected

#### Pan mode

* Activated by hand tool
* Drag → move map

---

### Mode rules

* Selecting terrain → Paint mode
* Hand tool → Pan mode
* Only one mode active

---

### Input behavior

Paint mode:

* Click → paint
* Drag → paint
* Scroll → zoom

Pan mode:

* Click/drag → move map
* Scroll → zoom

---

### Priority

* Paint overrides pan unless hand tool active
* Prevent accidental map movement

---

### Constraints

* Canvas2D only (no Phaser)
* Accurate hex picking
* Brush uses axial hex radius

---

## Systems design rules

When adding features:

* Prefer new system
* Keep single responsibility
* Avoid duplication
* Use events

GameScene:

* Creates systems
* Wires dependencies
* No gameplay logic

---

## File structure

* entities/ → data models
* systems/ → logic
* ui/ → HTML UI
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
5. Keep minimal

---

## Mindset

Stable base > features
Clarity > cleverness
Systems > hacks
Determinism > randomness
