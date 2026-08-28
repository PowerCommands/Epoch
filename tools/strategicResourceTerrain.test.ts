import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getImprovementById } from '../src/data/improvements.ts';
import {
  getNaturalResourceById,
  getNaturalResourceImprovementIdForTile,
  getNaturalResourcesForTileType,
  isResourceAllowedOnTile,
} from '../src/data/naturalResources.ts';
import { generateNaturalResources } from '../src/systems/NaturalResourceSystem.ts';
import { TileType, type MapData } from '../src/types/map.ts';

const EXPECTED_TERRAINS = {
  horses: [TileType.Plains, TileType.Meadow, TileType.Beach, TileType.Desert],
  iron: [TileType.Plains, TileType.Meadow, TileType.Beach, TileType.Forest, TileType.Desert, TileType.Mountain],
  niter: [TileType.Plains, TileType.Meadow, TileType.Beach, TileType.Desert, TileType.Mountain],
  coal: [TileType.Forest, TileType.Mountain, TileType.Plains, TileType.Meadow],
  oil: [TileType.Plains, TileType.Meadow, TileType.Beach, TileType.Desert, TileType.Ice, TileType.Coast, TileType.Ocean],
  natural_gas: [TileType.Plains, TileType.Meadow, TileType.Beach, TileType.Desert, TileType.Ice, TileType.Coast, TileType.Ocean],
  aluminum: [TileType.Plains, TileType.Meadow, TileType.Beach, TileType.Forest, TileType.Desert, TileType.Mountain, TileType.Ice],
  uranium: [TileType.Plains, TileType.Meadow, TileType.Desert, TileType.Mountain, TileType.Ice],
} as const;

const EXPECTED_WEIGHTS = {
  horses: 12,
  iron: 9,
  niter: 6,
  coal: 6,
  oil: 2,
  natural_gas: 0,
  aluminum: 4,
  uranium: 3,
} as const;

test('strategic resources expose the expanded canonical terrain distribution', () => {
  for (const [resourceId, tileTypes] of Object.entries(EXPECTED_TERRAINS)) {
    const resource = getNaturalResourceById(resourceId);
    assert.ok(resource, `missing resource ${resourceId}`);
    assert.deepEqual(resource.allowedTileTypes, tileTypes, `${resourceId} terrain distribution changed`);

    for (const tileType of tileTypes) {
      assert.equal(isResourceAllowedOnTile(resourceId, tileType), true);
      assert.ok(
        getNaturalResourcesForTileType(tileType).some((candidate) => candidate.id === resourceId),
        `${resourceId} is missing from canonical ${tileType} generation/editor candidates`,
      );
    }
  }
});

test('new land combinations resolve to improvements that support their terrain', () => {
  const combinations = [
    ['aluminum', TileType.Mountain, 'mine'],
    ['coal', TileType.Mountain, 'mine'],
    ['coal', TileType.Plains, 'mine'],
    ['coal', TileType.Meadow, 'mine'],
    ['niter', TileType.Mountain, 'mine'],
    ['iron', TileType.Forest, 'mine'],
    ['iron', TileType.Desert, 'mine'],
    ['uranium', TileType.Plains, 'mine'],
    ['uranium', TileType.Meadow, 'mine'],
    ['horses', TileType.Desert, 'pasture'],
  ] as const;

  for (const [resourceId, tileType, expectedImprovementId] of combinations) {
    const resource = getNaturalResourceById(resourceId);
    assert.ok(resource);
    const improvementId = getNaturalResourceImprovementIdForTile(resource, tileType);
    assert.equal(improvementId, expectedImprovementId);
    assert.equal(getImprovementById(improvementId)?.allowedTileTypes.includes(tileType), true);
  }
});

test('Oil and Natural Gas use Offshore Platforms on both sea terrains', () => {
  for (const resourceId of ['oil', 'natural_gas']) {
    const resource = getNaturalResourceById(resourceId);
    assert.ok(resource);
    for (const tileType of [TileType.Coast, TileType.Ocean]) {
      assert.equal(isResourceAllowedOnTile(resourceId, tileType), true);
      assert.equal(getNaturalResourceImprovementIdForTile(resource, tileType), 'offshore_platform');
    }
  }
});

test('strategic resource weights remain unchanged and Natural Gas stays non-generating', () => {
  for (const [resourceId, weight] of Object.entries(EXPECTED_WEIGHTS)) {
    assert.equal(getNaturalResourceById(resourceId)?.weight, weight);
  }
  assert.equal(getNaturalResourceById('natural_gas')?.weight, 0);
});

test('ordinary generation excludes Natural Gas through its zero weight', () => {
  const terrain = Object.values(TileType);
  const mapData: MapData = {
    width: 40,
    height: 40,
    tileSize: 32,
    tiles: Array.from({ length: 40 }, (_, y) => (
      Array.from({ length: 40 }, (_, x) => ({ x, y, type: terrain[(x + y) % terrain.length] }))
    )),
  };

  generateNaturalResources(mapData, {
    mapKey: 'strategic-terrain-test',
    activeNationIds: ['test'],
    humanNationId: 'test',
    resourceAbundance: 'abundant',
    cityCoords: [],
    worldSeed: 'natural-gas-zero-weight',
  });

  const generatedIds = mapData.tiles.flat().flatMap((tile) => tile.resourceId ?? []);
  assert.ok(generatedIds.length > 0);
  assert.equal(generatedIds.includes('natural_gas'), false);
  assert.ok(generatedIds.every((id) => (getNaturalResourceById(id)?.weight ?? 0) > 0));
});

test('the editor manifest derives the expanded strategic terrains from canonical data', () => {
  const manifest = JSON.parse(readFileSync(
    new URL('../public/assets/data/natural-resources-manifest.json', import.meta.url),
    'utf8',
  )) as { resources: Array<{ id: string; allowedTileTypes: TileType[] }> };

  for (const [resourceId, tileTypes] of Object.entries(EXPECTED_TERRAINS)) {
    const manifestResource = manifest.resources.find((resource) => resource.id === resourceId);
    assert.deepEqual(manifestResource?.allowedTileTypes, tileTypes);
  }
});
