/**
 * Focused deterministic tests for reusing Cargo Ships across overseas
 * expeditions instead of building a new transport for each one.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { CARGO_SHIP, SETTLER } from '../src/data/units.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { Unit } from '../src/entities/Unit.ts';
import { AIOverseasExpansionSystem } from '../src/systems/AIOverseasExpansionSystem.ts';
import type { CityManager } from '../src/systems/CityManager.ts';
import type { MovementSystem } from '../src/systems/MovementSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { PathfindingSystem } from '../src/systems/PathfindingSystem.ts';
import type { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';
import { UnitBoardingManager } from '../src/systems/UnitBoardingManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import type { WorldMarkerSystem } from '../src/systems/WorldMarkerSystem.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import type { OverseasSettlementTarget } from '../src/types/ai/OverseasSettlementTarget.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

const NATION = 'nation_test';
const W = 16;
const H = 9;

function stub<T>(): T {
  return {} as unknown as T;
}

function oceanMap(width = W, height = H): MapData {
  return {
    width,
    height,
    tileSize: 1,
    tiles: Array.from({ length: height }, (_, y) => (
      Array.from({ length: width }, (_, x): Tile => ({ x, y, type: TileType.Ocean }))
    )),
  };
}

function land(map: MapData, x: number, y: number, ownerId?: string): void {
  const t = map.tiles[y][x];
  t.type = TileType.Plains;
  if (ownerId) t.ownerId = ownerId;
}

function teleportMovement(units: UnitManager): MovementSystem {
  return {
    moveAlongPath: (unit: Unit, path: Tile[]) => {
      const end = path[path.length - 1];
      if (end) units.moveUnit(unit.id, end.x, end.y);
    },
  } as unknown as MovementSystem;
}

function frozenMovement(): MovementSystem {
  return { moveAlongPath: () => {} } as unknown as MovementSystem;
}

interface HarnessOpts {
  map: MapData;
  units: Array<{ id: string; type: typeof CARGO_SHIP | typeof SETTLER; x: number; y: number }>;
  movement: (units: UnitManager) => MovementSystem;
}

function harness(opts: HarnessOpts) {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: NATION, name: 'Testland', color: 0x2277bb }));
  const units = new UnitManager(opts.map.width, opts.map.height);
  const grid = new HexGridSystem();
  const pathfinding = new PathfindingSystem(opts.map, units, grid, nations);
  const boarding = new UnitBoardingManager(units, opts.map, grid, nations);

  // Units are added BEFORE the system exists, so they are "pre-existing" and do
  // not fire the onUnitChanged('created') auto-assignment — matching a nation
  // that already owns a Cargo Ship from an earlier expedition.
  for (const u of opts.units) {
    units.addUnit(new Unit({ id: u.id, name: u.id, ownerId: NATION, unitType: u.type, tileX: u.x, tileY: u.y }));
  }

  // Minimal CityManager/ProductionSystem: no cities means no queued units, which
  // keeps hasQueued* false so transport decisions depend purely on owned ships.
  const cityManager = { getCitiesByOwner: () => [] } as unknown as CityManager;
  const productionSystem = { getQueue: () => [] } as unknown as ProductionSystem;
  const turnManager = { getCurrentRound: () => 1 } as unknown as TurnManager;

  const logs: string[] = [];
  const system = new AIOverseasExpansionSystem(
    stub<WorldMarkerSystem>(), nations, cityManager, turnManager,
    opts.map, productionSystem, units, opts.movement(units), pathfinding, grid, boarding,
    (_n, m) => `[test] ${m}`,
    (_n, m) => { logs.push(m); },
  );

  return { system, logs, units, nations, pathfinding, grid };
}

function setTargets(nations: NationManager, targets: OverseasSettlementTarget[]): void {
  nations.getNation(NATION)!.knownIslandTargets = targets;
}

/** A coastal city object (only ownedTileCoords is read by cityHasWaterTile). */
function coastalCity(map: MapData): City {
  // Put a coast tile the city "owns" so cityHasWaterTile returns true.
  map.tiles[4][5].type = TileType.Coast;
  return { ownedTileCoords: [{ x: 5, y: 4 }] } as unknown as City;
}

const CARGO_COUNT = (units: UnitManager) =>
  units.getUnitsByOwner(NATION).filter((u) => u.unitType.id === CARGO_SHIP.id).length;

// ── 1. Completing an expedition RELEASES the Cargo Ship (does not destroy it). ──
test('a completed expedition releases the Cargo Ship for reuse instead of retiring it', () => {
  const map = oceanMap();
  for (let y = 3; y <= 5; y += 1) for (let x = 1; x <= 4; x += 1) land(map, x, y, NATION);
  land(map, 13, 4);
  land(map, 13, 3);

  const h = harness({
    map,
    units: [
      { id: 'transport', type: CARGO_SHIP, x: 5, y: 4 },
      { id: 'settler', type: SETTLER, x: 2, y: 4 },
    ],
    movement: teleportMovement,
  });
  const target: OverseasSettlementTarget = {
    markerId: 'island-1', name: 'Far Island', targetX: 13, targetY: 4,
    source: 'marker', priority: 2, discoveredTurn: 1, selected: true, status: 'expeditionReady',
    assignedSettlerUnitId: 'settler', assignedTransportUnitId: 'transport',
  };
  setTargets(h.nations, [target]);

  for (let i = 0; i < 12 && target.status !== 'completed'; i += 1) h.system.runStaging(NATION);

  assert.equal(target.status, 'completed', 'expedition reached completion');
  assert.equal(target.assignedTransportUnitId, undefined, 'transport assignment cleared on completion');
  assert.notEqual(h.units.getUnit('transport'), undefined, 'Cargo Ship still exists (released, not destroyed)');
  assert.ok(h.logs.some((l) => l.includes('released') && l.includes('for reuse')), 'release-for-reuse was logged');
  assert.ok(!h.logs.some((l) => l.includes('retired')), 'the ship is not retired');
});

// ── 2. A later expedition REUSES the existing free Cargo Ship (no new build). ───
test('a new expedition reserves the existing free Cargo Ship rather than requesting a new one', () => {
  const map = oceanMap();
  const city = coastalCity(map);
  const h = harness({
    map,
    units: [
      { id: 'transport', type: CARGO_SHIP, x: 5, y: 4 }, // idle, unassigned
      { id: 'settler2', type: SETTLER, x: 2, y: 4 },
    ],
    movement: frozenMovement,
  });
  const target: OverseasSettlementTarget = {
    markerId: 'island-2', name: 'Second Island', targetX: 13, targetY: 4,
    source: 'marker', priority: 1, discoveredTurn: 2, selected: true, status: 'selected',
    assignedSettlerUnitId: 'settler2',
  };
  setTargets(h.nations, [target]);

  const request = h.system.getExpeditionProductionRequest(NATION, city, true, [CARGO_SHIP]);

  assert.equal(request, undefined, 'no production requested — the existing ship is reused');
  assert.equal(target.assignedTransportUnitId, 'transport', 'the existing Cargo Ship was reserved');
  assert.equal(CARGO_COUNT(h.units), 1, 'no second Cargo Ship was created');
  assert.ok(h.logs.some((l) => l.includes('reserved existing') && l.includes('reused')), 'reuse was logged');
});

// ── 3. When the only Cargo Ship is BUSY, the expedition waits (no new build). ───
test('an expedition waits for a busy Cargo Ship instead of building a second one', () => {
  const map = oceanMap();
  const city = coastalCity(map);
  const h = harness({
    map,
    units: [
      { id: 'transport', type: CARGO_SHIP, x: 5, y: 4 },
      { id: 'settler2', type: SETTLER, x: 2, y: 4 },
    ],
    movement: frozenMovement,
  });
  // Expedition A holds the ship and is actively en route (not selected).
  const busy: OverseasSettlementTarget = {
    markerId: 'island-A', name: 'Island A', targetX: 13, targetY: 4,
    source: 'marker', priority: 2, discoveredTurn: 1, selected: false, status: 'enRoute',
    assignedSettlerUnitId: 'settler-A', assignedTransportUnitId: 'transport',
  };
  // Expedition B is the selected target and needs transport.
  const waiting: OverseasSettlementTarget = {
    markerId: 'island-B', name: 'Island B', targetX: 14, targetY: 4,
    source: 'marker', priority: 1, discoveredTurn: 2, selected: true, status: 'selected',
    assignedSettlerUnitId: 'settler2',
  };
  setTargets(h.nations, [busy, waiting]);

  const request = h.system.getExpeditionProductionRequest(NATION, city, true, [CARGO_SHIP]);

  assert.equal(request, undefined, 'no transport production requested while the ship is busy');
  assert.equal(waiting.assignedTransportUnitId, undefined, 'the busy ship is not double-assigned to expedition B');
  assert.equal(CARGO_COUNT(h.units), 1, 'no second Cargo Ship was created');
  assert.ok(h.logs.some((l) => l.includes('waiting for a busy Cargo Ship')), 'waiting was logged');

  // Repeated evaluation must not spam the waiting log every turn.
  const before = h.logs.filter((l) => l.includes('waiting for a busy Cargo Ship')).length;
  h.system.getExpeditionProductionRequest(NATION, city, true, [CARGO_SHIP]);
  const after = h.logs.filter((l) => l.includes('waiting for a busy Cargo Ship')).length;
  assert.equal(after, before, 'waiting log is deduplicated across turns');
});

// ── 4. With NO Cargo Ship owned, a new transport is requested (replacement). ────
test('a new transport is requested only when the nation owns no Cargo Ship', () => {
  const map = oceanMap();
  const city = coastalCity(map);
  const h = harness({
    map,
    units: [
      { id: 'settler2', type: SETTLER, x: 2, y: 4 }, // settler exists, but no transport
    ],
    movement: frozenMovement,
  });
  const target: OverseasSettlementTarget = {
    markerId: 'island-3', name: 'Third Island', targetX: 13, targetY: 4,
    source: 'marker', priority: 1, discoveredTurn: 3, selected: true, status: 'selected',
    assignedSettlerUnitId: 'settler2',
  };
  setTargets(h.nations, [target]);

  const request = h.system.getExpeditionProductionRequest(NATION, city, false, [CARGO_SHIP]);

  assert.notEqual(request, undefined, 'a production request is returned');
  assert.equal(request?.component, 'transport', 'the request is for transport');
  assert.equal(request?.unitType.id, CARGO_SHIP.id, 'a Cargo Ship is requested');
  assert.ok(h.logs.some((l) => l.includes('no Cargo Ship available')), 'the no-ship request was logged');
});

// ── 5. If the assigned Cargo Ship disappears while preparing, recover & replace. ─
test('a vanished assigned transport is cleared and replacement is allowed', () => {
  const map = oceanMap();
  const city = coastalCity(map);
  const h = harness({
    map,
    units: [
      { id: 'settler2', type: SETTLER, x: 2, y: 4 },
    ],
    movement: frozenMovement,
  });
  // Assigned transport id points at a unit that no longer exists.
  const target: OverseasSettlementTarget = {
    markerId: 'island-4', name: 'Fourth Island', targetX: 13, targetY: 4,
    source: 'marker', priority: 1, discoveredTurn: 4, selected: true, status: 'expeditionPreparing',
    assignedSettlerUnitId: 'settler2', assignedTransportUnitId: 'ghost-transport',
  };
  setTargets(h.nations, [target]);

  const request = h.system.getExpeditionProductionRequest(NATION, city, false, [CARGO_SHIP]);

  assert.equal(request?.component, 'transport', 'replacement transport requested after the ship vanished');
});
