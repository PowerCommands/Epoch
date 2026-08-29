import assert from 'node:assert/strict';
import test from 'node:test';

import { CARGO_SHIP, SETTLER } from '../src/data/units.ts';
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
const OTHER = 'nation_other';
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

function land(map: MapData, x: number, y: number, ownerId?: string): Tile {
  const t = map.tiles[y][x];
  t.type = TileType.Plains;
  if (ownerId) t.ownerId = ownerId;
  return t;
}

/** Movement stub: teleports a unit to the end of the path it is handed. */
function teleportMovement(units: UnitManager): MovementSystem {
  return {
    moveAlongPath: (unit: Unit, path: Tile[]) => {
      const end = path[path.length - 1];
      if (end) units.moveUnit(unit.id, end.x, end.y);
    },
  } as unknown as MovementSystem;
}

/** Movement stub: never moves anyone (isolates the *selection* from arrival). */
function frozenMovement(): MovementSystem {
  return { moveAlongPath: () => {} } as unknown as MovementSystem;
}

interface HarnessOpts {
  map: MapData;
  target: { x: number; y: number };
  settlerAt: { x: number; y: number };
  transportAt: { x: number; y: number };
  movement: (units: UnitManager) => MovementSystem;
  extraNations?: string[];
}

function harness(opts: HarnessOpts) {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: NATION, name: 'Testland', color: 0x2277bb }));
  for (const id of opts.extraNations ?? []) nations.addNation(new Nation({ id, name: id, color: 0x996633 }));
  const units = new UnitManager(opts.map.width, opts.map.height);
  const grid = new HexGridSystem();
  const pathfinding = new PathfindingSystem(opts.map, units, grid, nations);
  const boarding = new UnitBoardingManager(units, opts.map, grid, nations);

  const transport = new Unit({ id: 'transport', name: 'Cargo Ship', ownerId: NATION, unitType: CARGO_SHIP, tileX: opts.transportAt.x, tileY: opts.transportAt.y });
  const settler = new Unit({ id: 'settler', name: 'Settler', ownerId: NATION, unitType: SETTLER, tileX: opts.settlerAt.x, tileY: opts.settlerAt.y });
  units.addUnit(transport);
  units.addUnit(settler);

  const logs: string[] = [];
  const system = new AIOverseasExpansionSystem(
    stub<WorldMarkerSystem>(), nations, stub<CityManager>(), stub<TurnManager>(),
    opts.map, stub<ProductionSystem>(), units, opts.movement(units), pathfinding, grid, boarding,
    (_n, m) => `[test] ${m}`,
    (_n, m) => { logs.push(m); },
  );

  const target: OverseasSettlementTarget = {
    markerId: 'island-1', name: 'Far Island', targetX: opts.target.x, targetY: opts.target.y,
    source: 'marker', priority: 1, discoveredTurn: 1, selected: true, status: 'expeditionReady',
    assignedSettlerUnitId: settler.id, assignedTransportUnitId: transport.id,
  };
  nations.getNation(NATION)!.knownIslandTargets = [target];

  return { system, logs, target, settler, transport, units, pathfinding, grid };
}

// ── 1 & 2. Embarkation coast is always land-reachable; a geometrically nearer coast
//          on a different landmass (across water) is never selected. ────────────
test('embarkation coast is land-reachable, never the closer cross-water tile', () => {
  const map = oceanMap();
  // Settler's continent A: x in [1..4], y in [3..5].
  for (let y = 3; y <= 5; y += 1) for (let x = 1; x <= 4; x += 1) land(map, x, y, NATION);
  // Decoy island B: a single owned coast at (8,4), across open water, CLOSER to the
  // destination than any coast of continent A — the kind of tile the old selector
  // would pick and then fail to path to.
  land(map, 8, 4, NATION);
  // Destination island near the east edge.
  land(map, 13, 4);
  land(map, 13, 3);

  const h = harness({
    map, target: { x: 13, y: 4 }, settlerAt: { x: 2, y: 4 }, transportAt: { x: 5, y: 4 },
    movement: frozenMovement,
  });

  h.system.runStaging(NATION);

  const coast = { x: h.target.embarkCoastX, y: h.target.embarkCoastY };
  assert.ok(coast.x !== undefined && coast.y !== undefined, 'an embarkation coast was chosen');
  // Not the cross-water decoy.
  assert.ok(!(coast.x === 8 && coast.y === 4), 'must not pick the cross-water decoy (8,4)');
  // The decoy really is unreachable by land, and the chosen coast really is reachable.
  assert.equal(h.pathfinding.findPath(h.settler, 8, 4, { respectMovementPoints: false }), null,
    'decoy (8,4) is genuinely unreachable by land');
  assert.notEqual(h.pathfinding.findPath(h.settler, coast.x!, coast.y!, { respectMovementPoints: false }), null,
    'chosen coast is land-reachable by the Settler');
  // Chosen coast lies on continent A.
  assert.ok(coast.x! >= 1 && coast.x! <= 4 && coast.y! >= 3 && coast.y! <= 5, 'coast is on the Settler continent');
  // Destination bias: the east-facing edge (x=4) is preferred over the west edge.
  assert.equal(coast.x, 4, 'coast is biased toward the destination (east edge)');
  // The Settler is never told to path across water: no find-path failure logged.
  assert.ok(!h.logs.some((l) => l.includes('could not find path')), 'no unreachable-staging failure logged');
  assert.ok(h.logs.some((l) => l.includes('selected reachable embarkation coast')), 'logged the chosen coast');
});

// ── 3. Settler boards the Transport at the reachable origin coast. ──────────────
test('Settler reaches the origin coast, the Transport meets it, and it boards', () => {
  const map = oceanMap();
  for (let y = 3; y <= 5; y += 1) for (let x = 1; x <= 4; x += 1) land(map, x, y, NATION);
  land(map, 13, 4);
  land(map, 13, 3);

  const h = harness({
    map, target: { x: 13, y: 4 }, settlerAt: { x: 2, y: 4 }, transportAt: { x: 5, y: 4 },
    movement: teleportMovement,
  });

  // A couple of staging turns: choose coast, move both units there, board.
  for (let i = 0; i < 3 && h.target.status !== 'embarked'; i += 1) h.system.runStaging(NATION);

  assert.equal(h.target.status, 'embarked', 'expedition reached the embarked state');
  assert.ok(h.units.getTransportForUnit(h.settler)?.id === h.transport.id, 'Settler is cargo of the Transport');
  // It boarded from a coast on the Settler's own continent.
  assert.ok(h.target.embarkCoastX! >= 1 && h.target.embarkCoastX! <= 4, 'boarded from continent A');
  assert.ok(h.logs.some((l) => l.includes('boarded')), 'boarding was logged');
});

// ── 8. A badly-authored, fully-inland MapPoint fails cleanly (no infinite retry). ─
test('a MapPoint with no coastal land in its circle aborts and releases the units', () => {
  // Whole map is land — the target circle contains no coast at all.
  const map = oceanMap(12, 9);
  for (let y = 0; y < 9; y += 1) for (let x = 0; x < 12; x += 1) land(map, x, y, NATION);

  const h = harness({
    map, target: { x: 6, y: 4 }, settlerAt: { x: 2, y: 4 }, transportAt: { x: 3, y: 4 },
    movement: frozenMovement,
  });

  h.system.runStaging(NATION);

  assert.equal(h.target.status, 'cancelled', 'expedition aborted');
  assert.equal(h.target.assignedSettlerUnitId, undefined, 'Settler released');
  assert.equal(h.target.assignedTransportUnitId, undefined, 'Transport released');
  assert.ok(h.logs.some((l) => l.includes('no valid coastal landing exists inside MapPoint')), 'logged the abort reason');
});

// ── 9. Target invalidated after departure (region claimed by another nation) still
//       cancels cleanly — the earlier fix is preserved. ─────────────────────────
test('an embarked expedition whose landing region is fully foreign-owned cancels', () => {
  const map = oceanMap(18, 9);
  // Settler continent A, far to the west (well outside the destination circle).
  for (let y = 3; y <= 5; y += 1) for (let x = 1; x <= 3; x += 1) land(map, x, y, NATION);
  // Destination island near the east edge — every land tile in its circle is owned by
  // another nation (as if that nation settled/claimed it after departure).
  for (let y = 2; y <= 6; y += 1) for (let x = 14; x <= 16; x += 1) land(map, x, y, OTHER);

  const h = harness({
    map, target: { x: 15, y: 4 }, settlerAt: { x: 2, y: 4 }, transportAt: { x: 13, y: 4 },
    movement: frozenMovement, extraNations: [OTHER],
  });
  // Put the expedition already at sea next to the (now foreign) destination, with the
  // Settler boarded so the embarked-transit path runs.
  h.target.status = 'enRoute';
  h.units.boardUnit(h.settler.id, h.transport.id);

  h.system.runStaging(NATION);

  assert.equal(h.target.status, 'cancelled', 'expedition cancels when no valid landing remains');
  assert.ok(h.logs.some((l) => l.includes('no valid landing tile found near')), 'logged the invalidation');
});
