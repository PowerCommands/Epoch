import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getNaturalResourceById } from '../src/data/naturalResources.ts';
import { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem.ts';
import { getTileResourceQuantity } from '../src/systems/resource/ResourceQuantity.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

const OWNER_ID = 'nation_a';

test('resource tile index matches whole-map ownership counts and resource ordering', () => {
  const mapData = createResourceMap();
  const system = new ResourceAccessSystem(mapData, { getAllDeals: () => [] });

  for (const resourceId of ['wheat', 'iron', 'horses']) {
    assert.equal(
      system.getOwnedResourceSourceCount(OWNER_ID, resourceId),
      referenceOwnedCount(mapData, OWNER_ID, resourceId),
    );
  }
  assert.deepEqual(
    system.getOwnedNaturalResources(OWNER_ID),
    referenceOwnedResources(mapData, OWNER_ID),
  );
});

test('indexed tile references immediately reflect ownership and improvement changes', () => {
  const mapData = createResourceMap();
  const system = new ResourceAccessSystem(mapData, { getAllDeals: () => [] });
  const wheat = mapData.tiles[1][2];

  const before = system.getOwnedResourceSourceCount(OWNER_ID, 'wheat');
  wheat.ownerId = OWNER_ID;
  assert.equal(
    system.getOwnedResourceSourceCount(OWNER_ID, 'wheat'),
    referenceOwnedCount(mapData, OWNER_ID, 'wheat'),
  );
  assert.ok(system.getOwnedResourceSourceCount(OWNER_ID, 'wheat') > before);

  wheat.improvementId = 'farm';
  assert.equal(
    system.getOwnedResourceSourceCount(OWNER_ID, 'wheat'),
    referenceOwnedCount(mapData, OWNER_ID, 'wheat'),
  );
});

test('resource index invalidation rebuilds membership after save-load-style tile restoration', () => {
  const mapData = createResourceMap();
  const system = new ResourceAccessSystem(mapData, { getAllDeals: () => [] });
  system.getOwnedNaturalResources(OWNER_ID);

  mapData.tiles[0][0].resourceId = undefined;
  mapData.tiles[4][5].resourceId = 'wheat';
  mapData.tiles[4][5].ownerId = OWNER_ID;
  system.invalidateResourceIndex();

  assert.equal(
    system.getOwnedResourceSourceCount(OWNER_ID, 'wheat'),
    referenceOwnedCount(mapData, OWNER_ID, 'wheat'),
  );
  assert.deepEqual(
    system.getOwnedNaturalResources(OWNER_ID),
    referenceOwnedResources(mapData, OWNER_ID),
  );
});

function createResourceMap(): MapData {
  const width = 7;
  const height = 6;
  const tiles = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x): Tile => ({
      x,
      y,
      type: TileType.Plains,
    })));

  Object.assign(tiles[0][0], { resourceId: 'iron', ownerId: OWNER_ID });
  Object.assign(tiles[0][4], { resourceId: 'horses', ownerId: 'nation_b' });
  Object.assign(tiles[1][2], { resourceId: 'wheat', ownerId: 'nation_b' });
  Object.assign(tiles[2][1], { resourceId: 'horses', ownerId: OWNER_ID });
  Object.assign(tiles[3][3], { resourceId: 'wheat', ownerId: OWNER_ID });
  Object.assign(tiles[5][6], { resourceId: 'iron', ownerId: OWNER_ID, improvementId: 'mine' });
  return { width, height, tileSize: 1, tiles };
}

function referenceOwnedCount(mapData: MapData, nationId: string, resourceId: string): number {
  let count = 0;
  for (const row of mapData.tiles) {
    for (const tile of row) {
      if (tile.resourceId !== resourceId || tile.ownerId !== nationId) continue;
      count += getTileResourceQuantity(tile, getNaturalResourceById);
    }
  }
  return count;
}

function referenceOwnedResources(mapData: MapData, nationId: string): string[] {
  const ids = new Set<string>();
  for (const row of mapData.tiles) {
    for (const tile of row) {
      if (tile.ownerId !== nationId || tile.resourceId === undefined) continue;
      ids.add(tile.resourceId);
    }
  }
  return [...ids];
}
