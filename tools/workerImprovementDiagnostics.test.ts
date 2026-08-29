/**
 * Focused tests for the autorun Worker / Work Boat / tile-improvement diagnostic.
 * Verifies unit counts reflect existing units, improvement counts reflect the map
 * (land/water split + per-type), and Foreign Resource Exploitation holdings are
 * attributed to the operating nation rather than the territorial tile owner.
 *
 * Run with: npx tsx --test tools/workerImprovementDiagnostics.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { ARCHER, WORKER, WORK_BOAT } from '../src/data/units.ts';
import { Nation } from '../src/entities/Nation.ts';
import { Unit } from '../src/entities/Unit.ts';
import {
  buildWorkerImprovementDiagnostics,
  formatWorkerImprovementDiagnostics,
} from '../src/systems/WorkerImprovementDiagnostics.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

const USA = 'usa';
const FRANCE = 'france';

function nation(id: string, name: string): Nation {
  return new Nation({ id, name, color: 0x334455 });
}

function emptyMap(width = 6, height = 6): MapData {
  return {
    width,
    height,
    tileSize: 32,
    tiles: Array.from({ length: height }, (_, y) => (
      Array.from({ length: width }, (_, x): Tile => ({ x, y, type: TileType.Plains }))
    )),
  };
}

function setImprovement(
  map: MapData,
  x: number,
  y: number,
  type: TileType,
  improvementId: string,
  territoryOwnerId: string | undefined,
  improvementOwnerId?: string,
): void {
  const tile = map.tiles[y][x];
  tile.type = type;
  tile.ownerId = territoryOwnerId;
  tile.improvementId = improvementId;
  tile.improvementOwnerId = improvementOwnerId;
}

interface UnitProvider {
  getUnitsByOwner: (id: string) => Unit[];
  add: (id: string, ownerId: string, unitType: typeof WORKER) => void;
}

function makeUnits(): UnitProvider {
  const byOwner = new Map<string, Unit[]>();
  return {
    getUnitsByOwner: (id: string) => byOwner.get(id) ?? [],
    add: (id, ownerId, unitType) => {
      const list = byOwner.get(ownerId) ?? [];
      list.push(new Unit({ id, name: id, ownerId, unitType, tileX: list.length, tileY: 0 }));
      byOwner.set(ownerId, list);
    },
  };
}

test('worker and work boat counts reflect currently existing units, not production history', () => {
  const map = emptyMap();
  const units = makeUnits();
  units.add('w1', USA, WORKER);
  units.add('w2', USA, WORKER);
  units.add('wb1', USA, WORK_BOAT);
  units.add('a1', USA, ARCHER); // non-worker must not be counted

  const diag = buildWorkerImprovementDiagnostics([nation(USA, 'USA')], units.getUnitsByOwner, map);
  assert.equal(diag[0].workers, 2);
  assert.equal(diag[0].workBoats, 1);
});

test('improvement counts reflect the map and split into land/water with per-type breakdown', () => {
  const map = emptyMap();
  setImprovement(map, 0, 0, TileType.Plains, 'farm', USA);
  setImprovement(map, 1, 0, TileType.Plains, 'farm', USA);
  setImprovement(map, 2, 0, TileType.Forest, 'lumber_mill', USA);
  setImprovement(map, 3, 0, TileType.Mountain, 'mine', USA);
  setImprovement(map, 0, 1, TileType.Coast, 'fishing_boats', USA);
  setImprovement(map, 1, 1, TileType.Ocean, 'fishing_boats', USA);
  // A France farm must not leak into the USA totals.
  setImprovement(map, 5, 5, TileType.Plains, 'farm', FRANCE);

  const units = makeUnits();
  const diag = buildWorkerImprovementDiagnostics(
    [nation(USA, 'USA'), nation(FRANCE, 'France')],
    units.getUnitsByOwner,
    map,
  );
  const usa = diag.find((d) => d.nationId === USA)!;
  assert.equal(usa.landImprovements, 4);
  assert.equal(usa.waterImprovements, 2);
  assert.equal(usa.landImprovementCounts.find((c) => c.improvementId === 'farm')!.count, 2);
  assert.equal(usa.landImprovementCounts.find((c) => c.improvementId === 'lumber_mill')!.count, 1);
  assert.equal(usa.landImprovementCounts.find((c) => c.improvementId === 'mine')!.count, 1);
  assert.equal(usa.waterImprovementCounts.find((c) => c.improvementId === 'fishing_boats')!.count, 2);

  const france = diag.find((d) => d.nationId === FRANCE)!;
  assert.equal(france.landImprovements, 1);
  assert.equal(france.waterImprovements, 0);
});

test('Foreign Resource Exploitation holdings are credited to the operating nation', () => {
  const map = emptyMap();
  // A mine on French territory but economically owned/operated by the USA.
  setImprovement(map, 2, 2, TileType.Mountain, 'mine', FRANCE, USA);
  // A plain domestic French farm.
  setImprovement(map, 3, 3, TileType.Plains, 'farm', FRANCE);

  const units = makeUnits();
  const diag = buildWorkerImprovementDiagnostics(
    [nation(USA, 'USA'), nation(FRANCE, 'France')],
    units.getUnitsByOwner,
    map,
  );
  const usa = diag.find((d) => d.nationId === USA)!;
  const france = diag.find((d) => d.nationId === FRANCE)!;

  assert.equal(usa.landImprovements, 1, 'USA gets the exploitation mine it operates');
  assert.equal(usa.landImprovementCounts.find((c) => c.improvementId === 'mine')!.count, 1);
  assert.equal(france.landImprovements, 1, 'France keeps only its own domestic farm');
  assert.equal(france.landImprovementCounts.find((c) => c.improvementId === 'farm')!.count, 1);
  assert.equal(france.landImprovementCounts.find((c) => c.improvementId === 'mine')!.count, 0);
});

test('legacy sea-claim ownership (resourceOwnerNationId) is honored via canonical resolver', () => {
  const map = emptyMap();
  const tile = map.tiles[0][0];
  tile.type = TileType.Ocean;
  tile.ownerId = FRANCE;
  tile.improvementId = 'fishing_boats';
  tile.resourceOwnerNationId = USA; // legacy economic claim, no improvementOwnerId

  const units = makeUnits();
  const diag = buildWorkerImprovementDiagnostics([nation(USA, 'USA')], units.getUnitsByOwner, map);
  assert.equal(diag[0].waterImprovements, 1);
});

test('format produces grep-friendly EconomyDiag lines in the summary style', () => {
  const map = emptyMap();
  setImprovement(map, 0, 0, TileType.Plains, 'farm', USA);
  setImprovement(map, 0, 1, TileType.Coast, 'fishing_boats', USA);
  const units = makeUnits();
  units.add('w1', USA, WORKER);
  units.add('wb1', USA, WORK_BOAT);

  const lines = formatWorkerImprovementDiagnostics(
    buildWorkerImprovementDiagnostics([nation(USA, 'USA')], units.getUnitsByOwner, map),
  );
  assert.equal(lines[0], '[EconomyDiag] USA workers=1 workBoats=1 landImprovements=1 waterImprovements=1');
  assert.match(lines[1], /^ {2}land: .*Farm=1/);
  assert.match(lines[2], /^ {2}water: .*Fishing Boats=1/);
});
