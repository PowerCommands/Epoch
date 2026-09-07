import assert from 'node:assert/strict';
import test from 'node:test';
import { connectRiver, eraseRiver, hasRiver, normalizeRivers, riverLine, riverMask, riverNeighbors, riverPaths, RIVER_DIRECTIONS, type RiverGrid } from '../src/systems/geography/Rivers';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import type { ScenarioData } from '../src/types/scenario';

function grid(width = 12, height = 12) {
  const masks: (number | undefined)[][] = Array.from({ length: height }, () => Array(width));
  const api: RiverGrid = { width, height, get: (q, r) => masks[r]?.[q], set: (q, r, value) => { masks[r][q] = value || undefined; } };
  return { ...api, masks };
}

test('all six edges connect reciprocally and are queryable without changing terrain', () => {
  const g = grid();
  RIVER_DIRECTIONS.forEach(([q, r], edge) => {
    assert.equal(connectRiver(g, { q: 5, r: 5 }, { q: 5 + q, r: 5 + r }), true);
    assert.equal(g.get(5 + q, 5 + r), 1 << ((edge + 3) % 6));
  });
  assert.equal(g.get(5, 5), 63);
  assert.equal(riverNeighbors(5, 5, 63).length, 6);
  assert.equal(hasRiver({ riverConnections: 63 }), true);
  assert.equal(hasRiver({}), false);
  assert.equal(connectRiver(g, { q: 1, r: 1 }, { q: 10, r: 10 }), false);
  assert.equal(connectRiver(g, { q: 0, r: 0 }, { q: -1, r: 0 }), false);
});

test('fast pointer strokes interpolate contiguous routes in every direction', () => {
  for (let q = 0; q < 12; q++) for (let r = 0; r < 12; r++) {
    const route = riverLine({ q: 5, r: 5 }, { q, r });
    assert.deepEqual(route[0], { q: 5, r: 5 });
    assert.deepEqual(route.at(-1), { q, r });
    const g = grid();
    for (let i = 1; i < route.length; i++) assert.ok(connectRiver(g, route[i - 1], route[i]));
  }
});

test('nearby rivers do not connect implicitly; erasing a junction preserves unrelated links', () => {
  const g = grid();
  connectRiver(g, { q: 4, r: 4 }, { q: 5, r: 4 });
  connectRiver(g, { q: 5, r: 4 }, { q: 6, r: 4 });
  connectRiver(g, { q: 5, r: 4 }, { q: 5, r: 3 });
  connectRiver(g, { q: 5, r: 5 }, { q: 6, r: 5 });
  const unrelated = g.get(5, 5);
  assert.equal(riverNeighbors(5, 4, g.get(5, 4)!).length, 3);
  eraseRiver(g, 5, 4);
  assert.equal(g.get(4, 4), undefined);
  assert.equal(g.get(6, 4), undefined);
  assert.equal(g.get(5, 3), undefined);
  assert.equal(g.get(5, 5), unrelated);
});

test('normalization removes malformed, dangling and out-of-map connections and is idempotent', () => {
  const g = grid();
  connectRiver(g, { q: 3, r: 3 }, { q: 4, r: 3 });
  g.masks[0][0] = 63;
  g.masks[4][4] = 1;
  g.masks[6][6] = 100;
  normalizeRivers(g);
  assert.equal(g.get(0, 0), undefined);
  assert.equal(g.get(4, 4), undefined);
  assert.equal(g.get(6, 6), undefined);
  assert.equal(g.get(3, 3), 1);
  const normalized = JSON.stringify(g.masks);
  normalizeRivers(g);
  assert.equal(JSON.stringify(g.masks), normalized);
  for (const invalid of [NaN, Infinity, -1, 64, 1.5, '3', null]) assert.equal(riverMask(invalid), 0);
});

test('river curves share exact endpoints across all six hex edges, including bends and junctions', () => {
  const center = { x: 200, y: 200 }, radius = 24;
  RIVER_DIRECTIONS.forEach(([q, r], edge) => {
    const neighbor = { x: center.x + radius * Math.sqrt(3) * (q + r / 2), y: center.y + radius * 1.5 * r };
    const a = riverPaths(1 << edge, center, radius)[0].at(-1)!;
    const b = riverPaths(1 << ((edge + 3) % 6), neighbor, radius)[0].at(-1)!;
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-10);
    for (let mask = 1; mask <= 63; mask++) {
      if (!(mask & (1 << edge))) continue;
      assert.ok(riverPaths(mask, center, radius).some(path => [path[0], path.at(-1)!].some(p => Math.hypot(p.x - a.x, p.y - a.y) < 1e-10)));
    }
  });
});

test('scenario and running-game JSON round trips preserve geography and legacy maps still load', () => {
  const fixture = { meta: { name: 'river test', version: 1 }, map: { width: 3, height: 2, tileSize: 48,
    tiles: [{ q: 0, r: 0, type: 'forest', riverConnections: 1 }, { q: 1, r: 0, type: 'plains', riverConnections: 9 }, { q: 2, r: 0, type: 'coast', riverConnections: 8 }] }, nations: [], cities: [], units: [] } as ScenarioData;
  const map = ScenarioLoader.parse(JSON.parse(JSON.stringify(fixture))).mapData;
  assert.equal(map.tiles[0][0].type, 'forest');
  const saved = JSON.parse(JSON.stringify(SaveLoadService.serializeTiles(map)));
  assert.equal(saved.length, 3, 'unowned, resource-free river geography must be saved');
  const legacy = structuredClone(fixture);
  legacy.map.tiles.forEach(tile => delete tile.riverConnections);
  const restored = ScenarioLoader.parse(legacy).mapData;
  assert.ok(restored.tiles.flat().every(tile => !hasRiver(tile)));
  SaveLoadService.restoreTiles(saved, restored);
  assert.deepEqual(restored.tiles.map(row => row.map(tile => tile.riverConnections)), map.tiles.map(row => row.map(tile => tile.riverConnections)));
  assert.equal(restored.tiles[0][0].type, 'forest');
});
