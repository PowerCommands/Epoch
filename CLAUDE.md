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
* UI → HTML panels only
* GameScene → orchestration only

Never mix responsibilities.

---

### UI model

* Phaser → world rendering only
* HTML/CSS → panels and interaction
* Communication via explicit events

---

### Data model

* All data comes from `europeScenario.json`
* Runtime controlled via `GameConfig`
* `isHuman` set at runtime only

---

## Gameplay constraints

### Map & tiles

* Fixed Europe map
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
* Deterministic growth
* Buildings modify yields
* Production queue

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
