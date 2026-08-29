import assert from 'node:assert/strict';
import test from 'node:test';

import { CARGO_SHIP } from '../src/data/units.ts';
import { Nation } from '../src/entities/Nation.ts';
import { Unit } from '../src/entities/Unit.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { PathfindingSystem } from '../src/systems/PathfindingSystem.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import {
  EXPEDITION_STALL_TURNS_BEFORE_REROUTE,
  isExpeditionStalled,
  selectExpeditionRecoveryWaypoint,
  updateExpeditionProgress,
} from '../src/systems/ai/expeditionRecovery.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

const NATION = 'nation_test';

// ── Pure stall accounting ─────────────────────────────────────────────────────
test('progress resets the stall counter only on meaningful improvement', () => {
  // First observation just baselines.
  let p = updateExpeditionProgress(10, {});
  assert.deepEqual(p, { bestDistance: 10, stallTurns: 0 });

  // No improvement -> stall increments and is not yet "stuck".
  p = updateExpeditionProgress(10, p);
  assert.equal(p.stallTurns, 1);
  assert.equal(isExpeditionStalled(p), false);

  // Getting closer resets the counter and lowers the best distance.
  p = updateExpeditionProgress(9, p);
  assert.deepEqual(p, { bestDistance: 9, stallTurns: 0 });

  // A temporary regression keeps the best but counts as a stalled turn.
  p = updateExpeditionProgress(11, p);
  assert.deepEqual(p, { bestDistance: 9, stallTurns: 1 });
});

test('a single non-improving turn is not treated as stuck; the threshold is', () => {
  let p = updateExpeditionProgress(20, {});
  for (let i = 0; i < EXPEDITION_STALL_TURNS_BEFORE_REROUTE - 1; i += 1) {
    p = updateExpeditionProgress(20, p);
    assert.equal(isExpeditionStalled(p), false, `not stuck yet at turn ${i + 1}`);
  }
  p = updateExpeditionProgress(20, p);
  assert.equal(p.stallTurns, EXPEDITION_STALL_TURNS_BEFORE_REROUTE);
  assert.equal(isExpeditionStalled(p), true);
});

// ── Recovery waypoint selection (uses the shared PathfindingSystem) ────────────
function waterMap(width: number, height: number): MapData {
  return {
    width,
    height,
    tileSize: 1,
    tiles: Array.from({ length: height }, (_, y) => (
      Array.from({ length: width }, (_, x): Tile => ({ x, y, type: TileType.Ocean }))
    )),
  };
}

function harness(width = 9, height = 9) {
  const mapData = waterMap(width, height);
  const nations = new NationManager();
  nations.addNation(new Nation({ id: NATION, name: 'Testland', color: 0x3366aa }));
  const units = new UnitManager(width, height);
  const grid = new HexGridSystem();
  const pathfinding = new PathfindingSystem(mapData, units, grid, nations);
  return { mapData, nations, units, grid, pathfinding };
}

function addShip(units: UnitManager, id: string, x: number, y: number): Unit {
  const ship = new Unit({ id, name: 'Cargo Ship', ownerId: NATION, unitType: CARGO_SHIP, tileX: x, tileY: y });
  units.addUnit(ship);
  return ship;
}

test('selects a reachable water waypoint that is closer to the objective', () => {
  const h = harness();
  const transport = addShip(h.units, 'transport', 4, 6);
  const target = { x: 4, y: 0 };

  const waypoint = selectExpeditionRecoveryWaypoint({
    transport,
    targetX: target.x,
    targetY: target.y,
    mapData: h.mapData,
    gridSystem: h.grid,
    pathfindingSystem: h.pathfinding,
    unitManager: h.units,
  });

  assert.ok(waypoint, 'expected a waypoint on an open sea');
  // Water, reachable, distinct from the transport tile, and closer to the target.
  assert.equal(h.mapData.tiles[waypoint!.y][waypoint!.x].type, TileType.Ocean);
  assert.ok(waypoint!.x !== transport.tileX || waypoint!.y !== transport.tileY);
  const before = h.grid.getDistance({ x: transport.tileX, y: transport.tileY }, target);
  const after = h.grid.getDistance(waypoint!, target);
  assert.ok(after < before, `waypoint should be closer: ${after} < ${before}`);
  assert.ok(h.pathfinding.findPath(transport, waypoint!.x, waypoint!.y, { respectMovementPoints: false }));
});

test('excluded coordinates (a prior failed waypoint) are not reselected', () => {
  const h = harness();
  const transport = addShip(h.units, 'transport', 4, 6);
  const target = { x: 4, y: 0 };

  const first = selectExpeditionRecoveryWaypoint({
    transport, targetX: target.x, targetY: target.y,
    mapData: h.mapData, gridSystem: h.grid, pathfindingSystem: h.pathfinding, unitManager: h.units,
  });
  assert.ok(first);

  const second = selectExpeditionRecoveryWaypoint({
    transport, targetX: target.x, targetY: target.y,
    mapData: h.mapData, gridSystem: h.grid, pathfindingSystem: h.pathfinding, unitManager: h.units,
    exclude: [first!],
  });
  assert.ok(second);
  assert.ok(second!.x !== first!.x || second!.y !== first!.y, 'must pick a different tile');
});

test('occupied tiles are never chosen as a waypoint', () => {
  const h = harness();
  const transport = addShip(h.units, 'transport', 4, 6);
  const target = { x: 4, y: 0 };
  // Block every tile within the search radius that another unit occupies.
  const blockedKeys = new Set<string>();
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const x = 4 + dx;
      const y = 4 + dy;
      if (x === transport.tileX && y === transport.tileY) continue;
      if (x < 0 || y < 0 || x >= h.mapData.width || y >= h.mapData.height) continue;
      addShip(h.units, `blocker-${x}-${y}`, x, y);
      blockedKeys.add(`${x},${y}`);
    }
  }

  const waypoint = selectExpeditionRecoveryWaypoint({
    transport, targetX: target.x, targetY: target.y,
    mapData: h.mapData, gridSystem: h.grid, pathfindingSystem: h.pathfinding, unitManager: h.units,
  });
  if (waypoint) {
    assert.equal(blockedKeys.has(`${waypoint.x},${waypoint.y}`), false, 'chose an occupied tile');
  }
});

test('a fully boxed-in transport yields no waypoint (retry later, never crash)', () => {
  const h = harness();
  const transport = addShip(h.units, 'transport', 4, 4);
  // Surround the transport on all six hex neighbours so nothing is reachable.
  for (const n of h.grid.getAdjacentCoords({ x: 4, y: 4 })) {
    if (n.x < 0 || n.y < 0 || n.x >= h.mapData.width || n.y >= h.mapData.height) continue;
    addShip(h.units, `wall-${n.x}-${n.y}`, n.x, n.y);
  }

  const waypoint = selectExpeditionRecoveryWaypoint({
    transport, targetX: 4, targetY: 0,
    mapData: h.mapData, gridSystem: h.grid, pathfindingSystem: h.pathfinding, unitManager: h.units,
  });
  assert.equal(waypoint, undefined);
});
