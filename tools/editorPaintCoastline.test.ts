/**
 * Focused test for the editor "Paint coastline" feature. It extracts the real
 * addCoastBorder / isLandTerrain source from public/editor.html and exercises it
 * (with the paintCoastline diff semantics) on a small map, verifying coast is
 * added only along the land/sea border and that a second run changes nothing.
 * Run with: npx tsx --test tools/editorPaintCoastline.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';

const editorHtml = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'editor.html'),
  'utf8',
);

// Extract the real coastline helpers straight from the editor source so the test
// covers the shipped logic rather than a copy.
const start = editorHtml.indexOf('function isLandTerrain');
const end = editorHtml.indexOf('function smoothTerrainGrid');
assert.ok(start !== -1 && end !== -1 && end > start, 'located coastline helpers in editor.html');
const helperSource = editorHtml.slice(start, end);
assert.match(helperSource, /function addCoastBorder\(grid\)/, 'addCoastBorder is present in the extracted source');

const MW_HEX_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];

/** Compile the extracted editor functions against injected editor globals. */
function makeAddCoastBorder(mapW: number, mapH: number): (grid: string[][]) => string[][] {
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'mapW', 'mapH', 'MW_HEX_DIRS',
    `${helperSource}; return addCoastBorder;`,
  ) as (w: number, h: number, dirs: number[][]) => (grid: string[][]) => string[][];
  return factory(mapW, mapH, MW_HEX_DIRS);
}

/** Mirror of paintCoastline's diff loop: apply addCoastBorder and count changes. */
function paint(tiles: string[][], addCoastBorder: (g: string[][]) => string[][]): number {
  const result = addCoastBorder(tiles);
  let changed = 0;
  for (let r = 0; r < tiles.length; r += 1) {
    for (let q = 0; q < tiles[r].length; q += 1) {
      if (tiles[r][q] === result[r][q]) continue;
      tiles[r][q] = result[r][q];
      changed += 1;
    }
  }
  return changed;
}

// 5x5 map: a 1x1 land tile at the center surrounded by open ocean.
function centerLandMap(): string[][] {
  const grid = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 'ocean'));
  grid[2][2] = 'plains';
  return grid;
}

test('coast is added only on sea tiles bordering land; land and inner sea are unchanged', () => {
  const tiles = centerLandMap();
  const addCoastBorder = makeAddCoastBorder(5, 5);
  const changed = paint(tiles, addCoastBorder);

  assert.ok(changed > 0, 'some ocean tiles were converted to coast');
  assert.equal(tiles[2][2], 'plains', 'land tile stays land');

  // The land tile's 6 hex neighbors are the sea/land boundary → coast.
  for (const [dq, dr] of MW_HEX_DIRS) {
    const nq = 2 + dq, nr = 2 + dr;
    assert.equal(tiles[nr][nq], 'coast', `neighbor (${nq},${nr}) became coast`);
  }
  // A far corner not bordering land stays ocean.
  assert.equal(tiles[0][0], 'ocean', 'sea not bordering land is untouched');
  assert.equal(changed, MW_HEX_DIRS.length, 'exactly the boundary ring changed');
});

test('running Paint coastline a second time changes nothing (idempotent)', () => {
  const tiles = centerLandMap();
  const addCoastBorder = makeAddCoastBorder(5, 5);
  paint(tiles, addCoastBorder);
  const secondPass = paint(tiles, addCoastBorder);
  assert.equal(secondPass, 0, 'second run makes no further changes');
});

test('a map with no sea/land boundary is left unchanged', () => {
  const allLand = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => 'plains'));
  const addCoastBorder = makeAddCoastBorder(3, 3);
  assert.equal(paint(allLand, addCoastBorder), 0, 'all-land map: no coast added');

  const allOcean = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => 'ocean'));
  assert.equal(paint(allOcean, addCoastBorder), 0, 'all-ocean map: no coast added');
});
