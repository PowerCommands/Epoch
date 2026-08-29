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
const SIZE = 12;
const TARGET = { x: 10, y: 10 };

function buildMap(): MapData {
  const tiles = Array.from({ length: SIZE }, (_, y) => (
    Array.from({ length: SIZE }, (_, x): Tile => ({ x, y, type: TileType.Ocean }))
  ));
  // A boarding shore in the corner and a small island target for landing math.
  tiles[1][1].type = TileType.Plains; // settler boarding tile
  tiles[TARGET.y][TARGET.x].type = TileType.Plains; // island the expedition heads to
  return { width: SIZE, height: SIZE, tileSize: 1, tiles };
}

/** Movement stub: simulates a transport that jitters but never makes progress. */
function makeOscillatingMovement(units: UnitManager, transportId: string): MovementSystem {
  const a = { x: 1, y: 2 };
  const b = { x: 1, y: 3 };
  return {
    moveAlongPath: (unit: Unit) => {
      if (unit.id !== transportId) return;
      const at = unit.tileX === a.x && unit.tileY === a.y;
      const next = at ? b : a;
      units.moveUnit(unit.id, next.x, next.y);
    },
  } as unknown as MovementSystem;
}

function stub<T>(): T {
  return {} as unknown as T;
}

function createExpedition() {
  const mapData = buildMap();
  const nations = new NationManager();
  nations.addNation(new Nation({ id: NATION, name: 'Testland', color: 0x2277bb }));
  const units = new UnitManager(SIZE, SIZE);
  const grid = new HexGridSystem();
  const pathfinding = new PathfindingSystem(mapData, units, grid, nations);
  const boarding = new UnitBoardingManager(units, mapData, grid, nations);

  const transport = new Unit({ id: 'transport', name: 'Cargo Ship', ownerId: NATION, unitType: CARGO_SHIP, tileX: 1, tileY: 2 });
  const settler = new Unit({ id: 'settler', name: 'Settler', ownerId: NATION, unitType: SETTLER, tileX: 1, tileY: 1 });
  units.addUnit(transport);
  units.addUnit(settler);
  assert.equal(boarding.board(settler, transport), true, 'settler should board the transport');
  assert.equal(boarding.isCargo(settler), true);

  const movement = makeOscillatingMovement(units, transport.id);

  const logs: string[] = [];
  const system = new AIOverseasExpansionSystem(
    stub<WorldMarkerSystem>(),
    nations,
    stub<CityManager>(),
    stub<TurnManager>(),
    mapData,
    stub<ProductionSystem>(),
    units,
    movement,
    pathfinding,
    grid,
    boarding,
    (_nationId, message) => `[test] ${message}`,
    (_nationId, message) => { logs.push(message); },
  );

  const nation = nations.getNation(NATION)!;
  const target: OverseasSettlementTarget = {
    markerId: 'island-1',
    name: 'Island One',
    targetX: TARGET.x,
    targetY: TARGET.y,
    source: 'marker',
    priority: 1,
    discoveredTurn: 1,
    selected: true,
    status: 'enRoute',
    assignedSettlerUnitId: settler.id,
    assignedTransportUnitId: transport.id,
  };
  nation.knownIslandTargets = [target];

  return { system, logs, nation, target, transport, settler, units, boarding };
}

test('a stalled overseas expedition eventually reroutes without stranding the settler', () => {
  const h = createExpedition();

  // Drive several turns. The transport jitters but never approaches the island.
  const rerouteTurns: number[] = [];
  const waypointTurns: number[] = [];
  for (let turn = 1; turn <= 20; turn += 1) {
    const before = h.logs.length;
    h.system.runStaging(NATION);
    for (const line of h.logs.slice(before)) {
      if (line.includes('attempting reroute')) rerouteTurns.push(turn);
      if (line.includes('Recovery waypoint selected')) waypointTurns.push(turn);
    }
  }

  // Temporary delay: no reroute in the first few turns (below the threshold).
  assert.ok(rerouteTurns.length > 0, 'a genuinely stalled expedition must attempt recovery');
  assert.ok(rerouteTurns[0] >= 6, `first reroute should wait for the stall threshold, got turn ${rerouteTurns[0]}`);

  // A recovery waypoint was actually selected on open water.
  assert.ok(waypointTurns.length > 0, 'a recovery waypoint should be selected');

  // Repeated recovery is possible if the first attempt does not help.
  assert.ok(rerouteTurns.length >= 2, 'the expedition must be able to retry recovery');

  // The original objective is intact and the expedition was never cancelled/frozen.
  const target = h.nation.knownIslandTargets![0];
  assert.equal(target.status, 'enRoute');
  assert.equal(target.targetX, TARGET.x);
  assert.equal(target.targetY, TARGET.y);

  // The transport/settler relationship is preserved: the settler is still cargo.
  assert.equal(h.boarding.isCargo(h.settler), true, 'settler must not be stranded');
  assert.equal(h.units.getTransportForUnit(h.settler)?.id, h.transport.id);
  assert.equal(target.assignedSettlerUnitId, h.settler.id);
  assert.equal(target.assignedTransportUnitId, h.transport.id);
});

test('reroute logging is not emitted every turn (throttled to the stall window)', () => {
  const h = createExpedition();
  let rerouteLogs = 0;
  for (let turn = 1; turn <= 18; turn += 1) {
    const before = h.logs.length;
    h.system.runStaging(NATION);
    rerouteLogs += h.logs.slice(before).filter((l) => l.includes('attempting reroute')).length;
  }
  // With an 18-turn run and a 6-turn window, recovery fires only a handful of
  // times — never once per turn.
  assert.ok(rerouteLogs >= 1 && rerouteLogs <= 4, `expected throttled reroutes, got ${rerouteLogs}`);
});
