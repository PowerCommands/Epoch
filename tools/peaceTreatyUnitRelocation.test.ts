import assert from 'node:assert/strict';
import test from 'node:test';
import { ARCHER, SCOUT, SPY, TRIREME } from '../src/data/units.ts';
import { Nation } from '../src/entities/Nation.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { MovementSystem } from '../src/systems/MovementSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { PeaceTreatyUnitRelocationSystem } from '../src/systems/PeaceTreatyUnitRelocationSystem.ts';
import type { SelectionManager } from '../src/systems/SelectionManager.ts';
import type { TileMap } from '../src/systems/TileMap.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import type { UnitRenderer } from '../src/systems/UnitRenderer.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { TileType, type MapData } from '../src/types/map.ts';

function harness() {
  const map: MapData = { width: 7, height: 7, tileSize: 1, tiles: Array.from({ length: 7 }, (_, y) =>
    Array.from({ length: 7 }, (_, x) => ({ x, y, type: TileType.Plains, ownerId: x < 5 ? 'usa' : 'canada' }))) };
  const nations = new NationManager();
  for (const id of ['canada', 'usa', 'mexico']) nations.addNation(new Nation({ id, name: id, color: 0 }));
  const units = new UnitManager(7, 7);
  const diplomacy = new DiplomacyManager();
  diplomacy.restoreState('canada', 'usa', { state: 'WAR' });
  const grid = new HexGridSystem();
  const movement = new MovementSystem(
    { getTileAt: (x: number, y: number) => map.tiles[y]?.[x] ?? null } as TileMap,
    units, { refreshUnitPosition: () => {} } as unknown as UnitRenderer,
    { getCurrentNation: () => nations.getNation('canada'), on: () => {} } as unknown as TurnManager,
    { onSelectionTarget: () => {} } as unknown as SelectionManager, grid, nations, diplomacy,
  );
  const system = new PeaceTreatyUnitRelocationSystem(units, nations, diplomacy, map, grid,
    (unit, tile) => movement.canUnitPeacefullyEnterTile(unit, tile));
  return { map, nations, units, diplomacy, grid, movement, system };
}

test('peace withdraws surrounded troops on both sides and permits a normal move', () => {
  const h = harness();
  const canadian = h.units.createUnit({ type: ARCHER, ownerId: 'canada', tileX: 2, tileY: 3 });
  const american = h.units.createUnit({ type: ARCHER, ownerId: 'usa', tileX: 6, tileY: 3 });
  canadian.queuedDestination = { x: 0, y: 0 };
  const mp = canadian.movementPoints;
  h.diplomacy.onWarEnded((a, b) => h.system.handleWarEnded(a, b));
  h.diplomacy.respondToPeace('usa', 'canada', true);
  assert.equal(h.map.tiles[canadian.tileY][canadian.tileX].ownerId, 'canada');
  assert.equal(h.map.tiles[american.tileY][american.tileX].ownerId, 'usa');
  assert.equal(canadian.queuedDestination, undefined);
  assert.equal(canadian.movementPoints, mp);
  assert.equal(h.units.getUnitAt(2, 3), null);
  const target = h.grid.getNeighbors({ x: canadian.tileX, y: canadian.tileY }, h.map)
    .find(tile => h.movement.canMoveUnitTo(canadian, tile.x, tile.y));
  assert.ok(target);
  h.movement.moveAlongPath(canadian, [target], { source: 'human-ui' });
  assert.deepEqual([canadian.tileX, canadian.tileY, canadian.movementPoints], [target.x, target.y, mp - 1]);
});

test('old saves recover during an active treaty, without moving wartime or authorized units', () => {
  const h = harness();
  const stranded = h.units.createUnit({ type: ARCHER, ownerId: 'canada', tileX: 2, tileY: 3 });
  const spy = h.units.createUnit({ type: SPY, ownerId: 'canada', tileX: 2, tileY: 3 });
  h.system.recoverStrandedUnits(202);
  assert.equal(stranded.tileX, 2, 'war is still active');
  h.diplomacy.restoreState('canada', 'usa', { state: 'PEACE', peaceTreatyUntilTurn: 209 });
  h.system.recoverStrandedUnits(202);
  assert.equal(stranded.tileX, 5);
  assert.deepEqual([spy.tileX, spy.tileY], [2, 3]);
  const position = [stranded.tileX, stranded.tileY];
  h.system.recoverStrandedUnits(202);
  assert.deepEqual([stranded.tileX, stranded.tileY], position, 'recovery is idempotent');
});

test('withdrawal skips water, occupied destinations and territory of other enemies', () => {
  const h = harness();
  h.diplomacy.restoreState('canada', 'mexico', { state: 'WAR' });
  for (const row of h.map.tiles) for (const tile of row) {
    if (tile.x >= 5) tile.type = TileType.Coast;
  }
  h.map.tiles[3][5].type = TileType.Plains;
  h.units.createUnit({ type: SCOUT, ownerId: 'canada', tileX: 5, tileY: 3 });
  h.map.tiles[2][5].type = TileType.Plains;
  h.map.tiles[2][5].ownerId = 'mexico';
  h.map.tiles[4][6].type = TileType.Plains;
  const unit = h.units.createUnit({ type: ARCHER, ownerId: 'canada', tileX: 2, tileY: 3 });
  h.diplomacy.respondToPeace('usa', 'canada', true);
  h.system.handleWarEnded('usa', 'canada');
  assert.deepEqual([unit.tileX, unit.tileY], [6, 4]);
  assert.equal(h.units.getUnitAt(5, 3)?.unitType.id, SCOUT.id);
});

test('no available destination preserves units and later recovery retries safely', () => {
  const h = harness();
  for (const row of h.map.tiles) for (const tile of row) tile.ownerId = 'usa';
  const unit = h.units.createUnit({ type: ARCHER, ownerId: 'canada', tileX: 2, tileY: 3 });
  h.diplomacy.restoreState('canada', 'usa', { state: 'PEACE', peaceTreatyUntilTurn: 209 });
  h.system.recoverStrandedUnits(202);
  assert.deepEqual([unit.tileX, unit.tileY], [2, 3]);
  h.map.tiles[3][5].ownerId = 'canada';
  h.system.recoverStrandedUnits(203);
  assert.deepEqual([unit.tileX, unit.tileY], [5, 3]);
});

test('combat ships retain their existing peaceful access to foreign water', () => {
  const h = harness();
  h.map.tiles[3][2].type = TileType.Coast;
  const ship = h.units.createUnit({ type: TRIREME, ownerId: 'canada', tileX: 2, tileY: 3 });
  h.diplomacy.respondToPeace('usa', 'canada', true);
  h.system.handleWarEnded('usa', 'canada');
  assert.deepEqual([ship.tileX, ship.tileY], [2, 3]);
});
