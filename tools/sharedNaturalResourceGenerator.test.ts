/**
 * Focused tests for the shared procedural natural-resource generator entry point
 * (`generateNaturalResources`) now used by both Game Setup and, later, the
 * Scenario Editor. Verifies the Low/Medium/High densities, terrain eligibility,
 * deterministic seeding, non-destructive preservation, and that the Game Setup
 * path routes through the same generator.
 *
 * Run with: npx tsx --test tools/sharedNaturalResourceGenerator.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isResourceAllowedOnTile } from '../src/data/naturalResources.ts';
import {
  generateNaturalResources,
  type NaturalResourceGenerationOptions,
  type ProceduralResourceDensity,
} from '../src/systems/NaturalResourceSystem.ts';
import { initializeWorldNaturalResources } from '../src/systems/WorldResourceInitialization.ts';
import { TileType, type MapData } from '../src/types/map.ts';

const NATIONS = ['a', 'b', 'c', 'd', 'e', 'f'];

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

function countResources(mapData: MapData): number {
  return placedTiles(mapData).length;
}

function resourceCoords(mapData: MapData): string[] {
  return placedTiles(mapData)
    .map((tile) => `${tile.x},${tile.y}:${tile.resourceId}`)
    .sort();
}

function baseOptions(
  resourceAbundance: ProceduralResourceDensity,
  extra: Partial<NaturalResourceGenerationOptions> = {},
): NaturalResourceGenerationOptions {
  return {
    mapKey: 'test_map',
    activeNationIds: [...NATIONS],
    humanNationId: 'a',
    resourceAbundance,
    cityCoords: [],
    worldSeed: 'shared-generator-seed',
    ...extra,
  };
}

test('Low density generates resources through the shared entry point', () => {
  const mapData = makeMap();
  generateNaturalResources(mapData, baseOptions('scarce'));
  assert.ok(countResources(mapData) > 0, 'expected Low to place resources');
});

test('Medium density generates resources through the shared entry point', () => {
  const mapData = makeMap();
  generateNaturalResources(mapData, baseOptions('normal'));
  assert.ok(countResources(mapData) > 0, 'expected Medium to place resources');
});

test('High density generates resources through the shared entry point', () => {
  const mapData = makeMap();
  generateNaturalResources(mapData, baseOptions('abundant'));
  assert.ok(countResources(mapData) > 0, 'expected High to place resources');
});

test('density scales from Low through Medium to High', () => {
  const low = makeMap();
  const medium = makeMap();
  const high = makeMap();
  generateNaturalResources(low, baseOptions('scarce'));
  generateNaturalResources(medium, baseOptions('normal'));
  generateNaturalResources(high, baseOptions('abundant'));

  assert.ok(countResources(low) <= countResources(medium));
  assert.ok(countResources(medium) < countResources(high));
});

test('generated resources always respect terrain eligibility', () => {
  const mapData = makeMap(20, 20, TileType.Plains);
  // Mix in other terrain (including tiles that support no natural resources).
  for (let y = 0; y < mapData.height; y += 1) {
    for (let x = 0; x < mapData.width; x += 1) {
      if ((x + y) % 4 === 0) mapData.tiles[y][x].type = TileType.Forest;
      else if ((x + y) % 4 === 1) mapData.tiles[y][x].type = TileType.Desert;
      else if ((x + y) % 4 === 2) mapData.tiles[y][x].type = TileType.Ocean;
    }
  }

  generateNaturalResources(mapData, baseOptions('abundant'));

  for (const tile of placedTiles(mapData)) {
    assert.ok(
      isResourceAllowedOnTile(tile.resourceId as string, tile.type),
      `resource ${tile.resourceId} is not allowed on ${tile.type} at (${tile.x},${tile.y})`,
    );
  }
});

test('the same seed and map state produce identical placements', () => {
  const first = makeMap();
  const second = makeMap();
  generateNaturalResources(first, baseOptions('normal'));
  generateNaturalResources(second, baseOptions('normal'));
  assert.deepEqual(resourceCoords(first), resourceCoords(second));
});

test('preservation mode never overwrites or removes existing resources', () => {
  const mapData = makeMap();
  mapData.tiles[0][0].resourceId = 'wheat';
  mapData.tiles[5][5].resourceId = 'iron';
  const before = structuredClone(mapData);

  generateNaturalResources(mapData, baseOptions('abundant', { preserveExistingResources: true }));

  // Every tile that already had a resource keeps exactly that resource.
  for (const row of before.tiles) {
    for (const tile of row) {
      if (tile.resourceId !== undefined) {
        assert.equal(mapData.tiles[tile.y][tile.x].resourceId, tile.resourceId);
      }
    }
  }
  assert.equal(mapData.tiles[0][0].resourceId, 'wheat');
  assert.equal(mapData.tiles[5][5].resourceId, 'iron');
});

test('preservation mode only adds resources to otherwise empty tiles', () => {
  const mapData = makeMap();
  mapData.tiles[0][0].resourceId = 'wheat';
  mapData.tiles[5][5].resourceId = 'iron';
  const before = structuredClone(mapData);

  generateNaturalResources(mapData, baseOptions('abundant', { preserveExistingResources: true }));

  // Any tile holding a resource after generation was either already occupied or
  // was empty before — never one whose prior resource was replaced.
  for (const row of mapData.tiles) {
    for (const tile of row) {
      if (tile.resourceId === undefined) continue;
      const priorResource = before.tiles[tile.y][tile.x].resourceId;
      const addedToEmptyTile = priorResource === undefined;
      const untouchedExisting = priorResource === tile.resourceId;
      assert.ok(addedToEmptyTile || untouchedExisting);
    }
  }
});

test('the Game Setup path routes through the shared generator', () => {
  const viaSetup = makeMap();
  const viaShared = makeMap();

  // Science Victory disabled so the guarantee pass adds nothing; the only
  // resources come from the shared generator.
  initializeWorldNaturalResources(viaSetup, {
    ...baseOptions('normal'),
    isLoadedGame: false,
    scienceVictoryEnabled: false,
  });
  generateNaturalResources(viaShared, baseOptions('normal'));

  assert.deepEqual(resourceCoords(viaSetup), resourceCoords(viaShared));
});
