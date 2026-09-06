import assert from 'node:assert/strict';
import test from 'node:test';

import { CheatSystem, type GameContext } from '../src/systems/CheatSystem.ts';
import { TileType, type Tile } from '../src/types/map.ts';

function makeHarness(options: { cityCenter?: boolean } = {}) {
  const tile: Tile = {
    x: 1,
    y: 1,
    type: TileType.Plains,
    ownerId: 'mongolia',
    resourceOwnerNationId: 'mongolia',
    resourceId: 'horses',
    improvementId: 'pasture',
    improvementOwnerId: 'mongolia',
    improvementConstruction: {
      improvementId: 'farm', cityId: 'city-1', unitId: 'worker-1', ownerId: 'mongolia',
      remainingTurns: 1, totalTurns: 2,
    },
    buildingId: 'granary',
    buildingBroken: true,
    buildingConstruction: { buildingId: 'library', cityId: 'city-1' },
    wonderId: 'pyramids',
    wonderConstruction: { wonderId: 'colossus', cityId: 'city-1' },
    cultureOwnerId: 'mongolia',
    cultureSourceCityId: 'city-1',
  };
  const city = {
    id: 'city-1', name: 'Karakorum', ownerId: 'mongolia', tileX: options.cityCenter ? 1 : 0,
    tileY: options.cityCenter ? 1 : 0, ownedTileCoords: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    workedTileCoords: [{ x: 1, y: 1 }],
  };
  const removedBuildings: string[] = [];
  const queue = [
    { placement: { tileX: 1, tileY: 1 } },
    { placement: { tileX: 2, tileY: 2 } },
  ];
  const removedQueueIndices: number[] = [];
  const removedWonders: string[] = [];
  const refreshed: Array<[number, number, boolean | undefined]> = [];
  let resourceIndexInvalidations = 0;

  const context = {
    humanNationId: 'mongolia',
    mapData: { width: 3, height: 3, tileSize: 48, tiles: [
      [{ x: 0, y: 0, type: TileType.Plains }, { x: 1, y: 0, type: TileType.Plains }, { x: 2, y: 0, type: TileType.Plains }],
      [{ x: 0, y: 1, type: TileType.Plains }, tile, { x: 2, y: 1, type: TileType.Plains }],
      [{ x: 0, y: 2, type: TileType.Plains }, { x: 1, y: 2, type: TileType.Plains }, { x: 2, y: 2, type: TileType.Plains }],
    ] },
    selectionManager: { getSelected: () => ({ kind: 'tile', tile }) },
    cityManager: {
      getCityAt: (x: number, y: number) => city.tileX === x && city.tileY === y ? city : undefined,
      getAllCities: () => [city],
      getBuildings: () => ({ remove: (id: string) => { removedBuildings.push(id); return true; } }),
    },
    productionSystem: {
      getQueue: () => queue,
      removeFromQueue: (_cityId: string, index: number) => {
        removedQueueIndices.push(index);
        queue.splice(index, 1);
      },
    },
    wonderSystem: {
      getCompletedWonder: () => ({ ownerId: 'mongolia' }),
      removeCompletedWonder: (id: string) => { removedWonders.push(id); return true; },
    },
    resourceAccessSystem: { invalidateResourceIndex: () => { resourceIndexInvalidations += 1; } },
    resourceSystem: { recalculateForNation: () => undefined },
    refreshTileVisuals: (x: number, y: number, terrainChanged?: boolean) => refreshed.push([x, y, terrainChanged]),
  } as unknown as GameContext;

  return {
    cheats: new CheatSystem(context), tile, city, removedBuildings, removedQueueIndices,
    removedWonders, refreshed, getResourceIndexInvalidations: () => resourceIndexInvalidations,
  };
}

test('tile clear removes tile state and city references but leaves terrain alone', () => {
  const h = makeHarness();
  const message = h.cheats.execute('tile clear');

  assert.equal(message, 'Cleared tile (1, 1); units were left untouched');
  assert.equal(h.tile.type, TileType.Plains);
  assert.equal(h.tile.ownerId, undefined);
  assert.equal(h.tile.resourceId, undefined);
  assert.equal(h.tile.improvementId, undefined);
  assert.equal(h.tile.improvementConstruction, undefined);
  assert.equal(h.tile.buildingId, undefined);
  assert.equal(h.tile.buildingConstruction, undefined);
  assert.equal(h.tile.wonderId, undefined);
  assert.equal(h.tile.wonderConstruction, undefined);
  assert.equal(h.tile.cultureOwnerId, undefined);
  assert.equal(h.tile.cultureSourceCityId, undefined);
  assert.deepEqual(h.city.ownedTileCoords, [{ x: 0, y: 0 }]);
  assert.deepEqual(h.city.workedTileCoords, []);
  assert.deepEqual(h.removedBuildings, ['granary']);
  assert.deepEqual(h.removedQueueIndices, [0]);
  assert.deepEqual(h.removedWonders, ['pyramids']);
  assert.equal(h.getResourceIndexInvalidations(), 1);
  assert.deepEqual(h.refreshed, [[1, 1, undefined]]);
});

test('tile clear refuses to corrupt a city center', () => {
  const h = makeHarness({ cityCenter: true });
  assert.match(h.cheats.execute('tile clear'), /Cannot clear a city center/);
  assert.equal(h.tile.ownerId, 'mongolia');
});

test('tile terrain changes only terrain and flags a domination-total transition', () => {
  const h = makeHarness();
  const message = h.cheats.execute('tile ocean');
  assert.equal(h.tile.type, TileType.Ocean);
  assert.equal(h.tile.ownerId, 'mongolia');
  assert.equal(h.tile.buildingId, 'granary');
  assert.match(message, /removes one tile from the Domination land total/);
  assert.deepEqual(h.refreshed, [[1, 1, true]]);
});

test('tile completion lists terrain, clear, and the grassland alias', () => {
  const h = makeHarness();
  const values = h.cheats.getCompletions('tile ').map((entry) => entry.value);
  assert.ok(values.includes('clear'));
  assert.ok(values.includes('ocean'));
  assert.ok(values.includes('plains'));
  assert.ok(values.includes('grassland'));

  h.cheats.execute('tile grassland');
  assert.equal(h.tile.type, TileType.Plains);
});
