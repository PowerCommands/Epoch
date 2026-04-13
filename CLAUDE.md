# CLAUDE.md

## Project overview
This project is a browser-based 2D turn-based strategy game built with **Phaser 3**, **TypeScript**, and **Vite**.  
The long-term goal is a simpler Civilization-style game played on a **real map of Europe**, not a random map.

## Current architecture
The project is being built step by step with a clean and extensible structure.

Implemented so far:
- Basic Phaser + TypeScript + Vite project setup
- Scene flow: `BootScene` → `MainMenuScene` → `GameScene`
- Tile-based placeholder map with camera pan/zoom
- Tile hover and selection system
- Nations with territorial ownership overlays
- Cities as separate entities placed on the map
- Turn system with rounds, active nation, HUD, and End Turn button

Planned / currently being added:
- Resource system with **gold**, **food**, and **production**

## Important design rules
- Keep **data models Phaser-free** where possible
  - `Nation`, `City`, resource data, and turn logic should remain pure TypeScript classes
- Keep **rendering separate from logic**
  - Renderers and UI belong in their own classes
- Use **event-driven systems**
  - New systems should react to events such as `turnStart`, `turnEnd`, `roundStart`, `roundEnd`
- Keep APIs clean and extensible
  - The placeholder map will later be replaced by a real Europe map, possibly based on geodata
- Do **not** add unnecessary gameplay mechanics before the foundation is ready

## Current gameplay model
- The world consists of tiles
- Tiles may belong to nations
- Cities are entities placed on tiles
- Selection supports both tiles and cities
- Turn order rotates between 4 nations
- UI panels show map, nation, city, and turn information

## Resource direction
The next step uses standard strategy-game resources:
- **Gold**: stored per nation
- **Food**: stored per city
- **Production**: stored per city

Resource generation should initially be simple and deterministic, with a structure that can later be replaced by tile-based yields.

## Coding expectations
- Use **strict TypeScript**
- Keep code modular and easy to extend
- Prefer small focused classes over large scene-heavy logic
- Avoid tight coupling between systems
- Do not implement more than the current step requires