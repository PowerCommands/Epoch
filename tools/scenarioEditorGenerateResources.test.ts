/**
 * Focused tests for the Scenario Editor "Generate Resources" action.
 *
 * Covers the testable command (`generateScenarioResources`) and the editor
 * adapter (`generateEditorResources`): reuse of the shared generator, Low/Medium/
 * High density mapping, non-destructive preservation, empty-tile-only placement,
 * serializable output, and repeated-use safety.
 *
 * Run with: npx tsx --test tools/scenarioEditorGenerateResources.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isResourceAllowedOnTile } from '../src/data/naturalResources.ts';
import { generateNaturalResources } from '../src/systems/NaturalResourceSystem.ts';
import {
  generateScenarioResources,
  SCENARIO_EDITOR_RESOURCE_DENSITIES,
} from '../src/editor/generateScenarioResources.ts';
import {
  clearEditorResources,
  generateEditorResources,
} from '../src/editor/editorResourceGenerationBundle.ts';
import { TileType, type MapData } from '../src/types/map.ts';

function makeMap(width = 20, height = 20, type: TileType = TileType.Plains): MapData {
  return {
    width,
    height,
    tileSize: 32,
    tiles: Array.from({ length: height }, (_, y) => (
      Array.from({ length: width }, (_, x) => ({ x, y, type }))
    )),
  };
}

function placedTiles(mapData: MapData) {
  return mapData.tiles.flat().filter((tile) => tile.resourceId !== undefined);
}

function resourceCoords(mapData: MapData): string[] {
  return placedTiles(mapData)
    .map((tile) => `${tile.x},${tile.y}:${tile.resourceId}`)
    .sort();
}

test('the editor densities are exactly the shared Low/Medium/High values', () => {
  assert.deepEqual(SCENARIO_EDITOR_RESOURCE_DENSITIES, ['scarce', 'normal', 'abundant']);
});

test('Low / Medium / High map to the shared density behavior (scaling counts)', () => {
  const low = makeMap();
  const medium = makeMap();
  const high = makeMap();
  generateScenarioResources({ mapData: low, density: 'scarce', worldSeed: 'seed' });
  generateScenarioResources({ mapData: medium, density: 'normal', worldSeed: 'seed' });
  generateScenarioResources({ mapData: high, density: 'abundant', worldSeed: 'seed' });

  assert.ok(placedTiles(low).length <= placedTiles(medium).length);
  assert.ok(placedTiles(medium).length < placedTiles(high).length);
});

test('the command routes through the shared generator (identical placements)', () => {
  const viaCommand = makeMap();
  const viaShared = makeMap();

  generateScenarioResources({
    mapData: viaCommand,
    density: 'normal',
    worldSeed: 'shared-routing',
    mapKey: 'scenario_editor',
  });
  generateNaturalResources(viaShared, {
    mapKey: 'scenario_editor',
    activeNationIds: [],
    humanNationId: '',
    resourceAbundance: 'normal',
    cityCoords: [],
    worldSeed: 'shared-routing',
    preserveExistingResources: true,
  });

  assert.deepEqual(resourceCoords(viaCommand), resourceCoords(viaShared));
});

test('generation reports the number of resources it added', () => {
  const mapData = makeMap();
  const result = generateScenarioResources({ mapData, density: 'abundant', worldSeed: 'count' });
  assert.equal(result.density, 'abundant');
  assert.equal(result.addedCount, placedTiles(mapData).length);
  assert.ok(result.addedCount > 0);
});

test('existing resources are preserved, never overwritten or removed', () => {
  const mapData = makeMap();
  mapData.tiles[0][0].resourceId = 'wheat';
  mapData.tiles[4][7].resourceId = 'iron';
  const before = structuredClone(mapData);

  generateScenarioResources({ mapData, density: 'abundant', worldSeed: 'preserve' });

  for (const row of before.tiles) {
    for (const tile of row) {
      if (tile.resourceId !== undefined) {
        assert.equal(mapData.tiles[tile.y][tile.x].resourceId, tile.resourceId);
      }
    }
  }
  // Nothing is ever removed: every original resource still exists.
  assert.equal(mapData.tiles[0][0].resourceId, 'wheat');
  assert.equal(mapData.tiles[4][7].resourceId, 'iron');
});

test('new resources land only on eligible, previously empty tiles', () => {
  const mapData = makeMap();
  mapData.tiles[0][0].resourceId = 'wheat';
  const before = structuredClone(mapData);

  generateScenarioResources({ mapData, density: 'abundant', worldSeed: 'empty-only' });

  for (const row of mapData.tiles) {
    for (const tile of row) {
      if (tile.resourceId === undefined) continue;
      const prior = before.tiles[tile.y][tile.x].resourceId;
      const addedToEmpty = prior === undefined;
      const untouched = prior === tile.resourceId;
      assert.ok(addedToEmpty || untouched, `tile (${tile.x},${tile.y}) was modified improperly`);
      assert.ok(
        isResourceAllowedOnTile(tile.resourceId as string, tile.type),
        `resource ${tile.resourceId} not allowed on ${tile.type}`,
      );
    }
  }
});

test('repeated generation stays non-destructive', () => {
  const mapData = makeMap();
  mapData.tiles[2][2].resourceId = 'wheat';

  generateScenarioResources({ mapData, density: 'normal', worldSeed: 'first' });
  const afterFirst = resourceCoords(mapData);

  generateScenarioResources({ mapData, density: 'normal', worldSeed: 'second' });
  const afterSecond = new Set(resourceCoords(mapData));

  // Every resource present after the first run still exists after the second.
  for (const entry of afterFirst) {
    assert.ok(afterSecond.has(entry), `lost resource ${entry} on repeat generation`);
  }
  assert.ok(afterSecond.size >= afterFirst.length);
});

// ─── Editor adapter (generateEditorResources) ────────────────────────────────

function makeEditorArrays(width = 16, height = 16, terrain = 'plains') {
  const tiles = Array.from({ length: height }, () => Array.from({ length: width }, () => terrain));
  const tileResources = Array.from({ length: height }, () => Array.from({ length: width }, () => undefined as string | undefined));
  return { width, height, tileSize: 32, tiles, tileResources };
}

test('the editor adapter does not mutate the input arrays and returns a grid', () => {
  const editor = makeEditorArrays();
  editor.tileResources[0][0] = 'wheat';
  const inputSnapshot = editor.tileResources.map((row) => row.slice());

  const response = generateEditorResources({ ...editor, density: 'abundant' });

  // Input arrays untouched — the editor applies the returned grid itself.
  assert.deepEqual(editor.tileResources, inputSnapshot);
  assert.equal(response.tileResources.length, editor.height);
  assert.equal(response.tileResources[0].length, editor.width);
  assert.equal(response.tileResources[0][0], 'wheat');
  assert.ok(response.addedCount > 0);
});

test('the editor adapter output serializes as normal scenario resource data', () => {
  const editor = makeEditorArrays();
  editor.tileResources[1][1] = 'iron';
  const response = generateEditorResources({ ...editor, density: 'normal' });

  // Reproduce the editor's buildScenarioOutput tile serialization.
  const flatTiles: Array<{ q: number; r: number; type: string; resourceId?: string }> = [];
  for (let r = 0; r < editor.height; r++) {
    for (let q = 0; q < editor.width; q++) {
      const tile: { q: number; r: number; type: string; resourceId?: string } = { q, r, type: editor.tiles[r][q] };
      const resource = response.tileResources[r][q];
      if (resource !== undefined) tile.resourceId = resource;
      flatTiles.push(tile);
    }
  }

  const serialized = JSON.parse(JSON.stringify({ map: { tiles: flatTiles } }));
  const withResources = serialized.map.tiles.filter((t: { resourceId?: string }) => typeof t.resourceId === 'string');
  assert.ok(withResources.length > 0);
  // The manually placed iron survives serialization as ordinary resource data.
  assert.ok(withResources.some((t: { q: number; r: number; resourceId?: string }) => t.q === 1 && t.r === 1 && t.resourceId === 'iron'));
  for (const t of withResources) {
    assert.equal(typeof t.resourceId, 'string');
  }
});

test('the editor adapter preserves manually placed resources', () => {
  const editor = makeEditorArrays();
  editor.tileResources[3][3] = 'wheat';
  editor.tileResources[5][8] = 'iron';

  const response = generateEditorResources({ ...editor, density: 'abundant' });

  assert.equal(response.tileResources[3][3], 'wheat');
  assert.equal(response.tileResources[5][8], 'iron');
});

// ─── Clear All Resources ─────────────────────────────────────────────────────

test('Clear All Resources removes every natural resource', () => {
  const editor = makeEditorArrays();
  // Strategic and non-strategic resources mixed across the map.
  editor.tileResources[0][0] = 'coal';
  editor.tileResources[0][1] = 'oil';
  editor.tileResources[1][0] = 'natural_gas';
  editor.tileResources[1][1] = 'uranium';
  editor.tileResources[2][2] = 'wheat';
  editor.tileResources[3][3] = 'iron';
  editor.tileResources[4][4] = 'horses';

  const response = clearEditorResources({ tileResources: editor.tileResources });

  assert.equal(response.removedCount, 7);
  assert.ok(response.tileResources.flat().every((id) => id === undefined));
});

test('Clear removes both strategic and non-strategic resources', () => {
  const editor = makeEditorArrays(4, 4);
  editor.tileResources[0][0] = 'uranium'; // strategic
  editor.tileResources[1][1] = 'wheat';   // non-strategic

  const response = clearEditorResources({ tileResources: editor.tileResources });

  assert.equal(response.removedCount, 2);
  assert.equal(response.tileResources[0][0], undefined);
  assert.equal(response.tileResources[1][1], undefined);
});

test('Clear does not mutate the input grid, so cancelling leaves resources intact', () => {
  const editor = makeEditorArrays();
  editor.tileResources[2][2] = 'coal';
  editor.tileResources[3][1] = 'wheat';
  const snapshot = editor.tileResources.map((row) => row.slice());

  // The editor discards this result on cancel; the source grid must be untouched.
  clearEditorResources({ tileResources: editor.tileResources });

  assert.deepEqual(editor.tileResources, snapshot);
});

test('Clear only touches natural resources, not terrain or buildings', () => {
  const editor = makeEditorArrays();
  editor.tileResources[1][1] = 'iron';
  const tilesSnapshot = editor.tiles.map((row) => row.slice());
  const tileBuildings = editor.tiles.map((row) => row.map(() => undefined as string | undefined));
  tileBuildings[2][2] = 'barracks';
  const buildingsSnapshot = tileBuildings.map((row) => row.slice());

  clearEditorResources({ tileResources: editor.tileResources });

  // Terrain and buildings are separate arrays the clear never receives or alters.
  assert.deepEqual(editor.tiles, tilesSnapshot);
  assert.deepEqual(tileBuildings, buildingsSnapshot);
});

test('Clear reports zero when there are no resources to remove', () => {
  const editor = makeEditorArrays();
  const response = clearEditorResources({ tileResources: editor.tileResources });
  assert.equal(response.removedCount, 0);
  assert.ok(response.tileResources.flat().every((id) => id === undefined));
});

test('after clearing, shared Generate Resources can repopulate the map', () => {
  const editor = makeEditorArrays();
  editor.tileResources[0][0] = 'coal';

  const cleared = clearEditorResources({ tileResources: editor.tileResources });
  assert.equal(cleared.tileResources.flat().filter(Boolean).length, 0);

  const generated = generateEditorResources({
    ...editor,
    tileResources: cleared.tileResources,
    density: 'abundant',
  });
  assert.ok(generated.addedCount > 0);
  assert.equal(generated.tileResources.flat().filter(Boolean).length, generated.addedCount);
});

test('cleared then generated resources serialize as normal scenario data', () => {
  const editor = makeEditorArrays();
  editor.tileResources[0][0] = 'coal';

  const cleared = clearEditorResources({ tileResources: editor.tileResources });
  const generated = generateEditorResources({
    ...editor,
    tileResources: cleared.tileResources,
    density: 'normal',
  });

  const flatTiles: Array<{ q: number; r: number; type: string; resourceId?: string }> = [];
  for (let r = 0; r < editor.height; r++) {
    for (let q = 0; q < editor.width; q++) {
      const tile: { q: number; r: number; type: string; resourceId?: string } = { q, r, type: editor.tiles[r][q] };
      const resource = generated.tileResources[r][q];
      if (resource !== undefined) tile.resourceId = resource;
      flatTiles.push(tile);
    }
  }
  const serialized = JSON.parse(JSON.stringify({ map: { tiles: flatTiles } }));
  const withResources = serialized.map.tiles.filter((t: { resourceId?: string }) => typeof t.resourceId === 'string');
  assert.ok(withResources.length > 0);
  assert.equal(withResources.length, generated.tileResources.flat().filter(Boolean).length);
  for (const t of withResources) assert.equal(typeof t.resourceId, 'string');
});
