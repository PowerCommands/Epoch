/**
 * Verifies Scout Boat resource discovery on legitimately visible coastal land
 * tiles, the reveal-tech gate (no fogged/hidden reveal), and the known-resource
 * query used by resource-driven exploration.
 * Run with: npx tsx --test tools/scoutBoatResourceDiscovery.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SCOUT_BOAT } from '../src/data/units.ts';
import { Nation } from '../src/entities/Nation.ts';
import { Unit } from '../src/entities/Unit.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import { AIExplorationSystem } from '../src/systems/ai/AIExplorationSystem.ts';
import type { CityManager } from '../src/systems/CityManager.ts';
import type { EventLogSystem } from '../src/systems/EventLogSystem.ts';
import type { MovementSystem } from '../src/systems/MovementSystem.ts';
import type { PathfindingSystem } from '../src/systems/PathfindingSystem.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

const NATION = 'france';
const SIZE = 12;

function stub<T>(overrides: Partial<T> = {}): T {
  return overrides as unknown as T;
}

function buildMap(): MapData {
  const tiles = Array.from({ length: SIZE }, (_, y) => (
    Array.from({ length: SIZE }, (_, x): Tile => ({ x, y, type: TileType.Ocean }))
  ));
  return { width: SIZE, height: SIZE, tileSize: 1, tiles };
}

function makeSystem(mapData: MapData, canSee: (nationId: string, resourceId: string) => boolean = () => true) {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: NATION, name: 'France', color: 0x2277bb }));
  const units = new UnitManager(SIZE, SIZE);
  const cityManager = stub<CityManager>({
    getAllCities: () => [],
    getCitiesByOwner: () => [],
  });
  const system = new AIExplorationSystem(
    units,
    cityManager,
    nations,
    stub<TurnManager>({ getCurrentRound: () => 1 }),
    stub<MovementSystem>({}),
    stub<PathfindingSystem>({}),
    mapData,
    stub<EventLogSystem>({ log: () => {} }),
    (_nationId: string, message: string) => message,
    canSee,
  );
  return { system, units };
}

test('10. Scout Boat discovers a strategic resource on a legitimately visible coastal land tile', () => {
  const mapData = buildMap();
  mapData.tiles[4][5] = { x: 5, y: 4, type: TileType.Plains, resourceId: 'iron' }; // adjacent land, neutral
  const { system, units } = makeSystem(mapData);
  // Scout Boat sits on the ocean next to the land tile, no movement this turn.
  units.addUnit(new Unit({ id: 'sb', name: 'Scout Boat', ownerId: NATION, unitType: SCOUT_BOAT, tileX: 5, tileY: 5, movementPoints: 0 }));

  system.runTurn(NATION);

  assert.equal(system.hasKnownResourceSource(NATION, 'iron'), true);
  const opportunities = system.getKnownResourceOpportunities(NATION);
  const iron = opportunities.find((o) => o.resourceId === 'iron');
  assert.ok(iron, 'iron opportunity recorded');
  assert.equal(iron!.isWater, false);
  assert.equal(iron!.neutral, true);
  assert.equal(iron!.ownedBySelf, false);
  assert.deepEqual({ x: iron!.x, y: iron!.y }, { x: 5, y: 4 });
});

test('11. Resources outside vision or not revealed by tech are NOT discovered (no fogged reveal)', () => {
  const mapData = buildMap();
  mapData.tiles[4][5] = { x: 5, y: 4, type: TileType.Plains, resourceId: 'iron' }; // visible + revealed
  mapData.tiles[6][5] = { x: 5, y: 6, type: TileType.Plains, resourceId: 'niter' }; // visible but not revealed
  mapData.tiles[0][5] = { x: 5, y: 0, type: TileType.Plains, resourceId: 'coal' }; // far away, out of vision
  // Reveal predicate hides niter (as if the tech is unresearched).
  const { system, units } = makeSystem(mapData, (_n, resourceId) => resourceId !== 'niter');
  units.addUnit(new Unit({ id: 'sb', name: 'Scout Boat', ownerId: NATION, unitType: SCOUT_BOAT, tileX: 5, tileY: 5, movementPoints: 0 }));

  system.runTurn(NATION);

  assert.equal(system.hasKnownResourceSource(NATION, 'iron'), true);
  assert.equal(system.hasKnownResourceSource(NATION, 'niter'), false, 'unrevealed resource stays hidden');
  assert.equal(system.hasKnownResourceSource(NATION, 'coal'), false, 'out-of-vision resource stays unknown');
});

test('Own-territory resource counts as a known source even if never scouted', () => {
  const mapData = buildMap();
  // Owned iron far from any unit; never entered exploration vision.
  mapData.tiles[0][0] = { x: 0, y: 0, type: TileType.Plains, resourceId: 'iron', ownerId: NATION };
  const { system } = makeSystem(mapData);

  assert.equal(system.hasKnownResourceSource(NATION, 'iron'), true);
  const iron = system.getKnownResourceOpportunities(NATION).find((o) => o.resourceId === 'iron');
  assert.equal(iron?.ownedBySelf, true);
});
