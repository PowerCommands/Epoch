import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildBorderAdjacencyCounts,
  type BorderAdjacencyCounts,
} from '../src/systems/BorderPressureSystem.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import type { IGridSystem } from '../src/systems/grid/IGridSystem.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

const NATIONS = ['a', 'b', 'c'] as const;

test('single-pass border scan matches the former per-pair algorithm for territorial and cultural borders', () => {
  const mapData = createSyntheticMap();
  const hexGrid = new HexGridSystem();
  let neighborCalls = 0;
  const countingGrid: IGridSystem = {
    getAdjacentCoords: (coord) => hexGrid.getAdjacentCoords(coord),
    getNeighbors: (coord, map) => {
      neighborCalls++;
      return hexGrid.getNeighbors(coord, map);
    },
    isAdjacent: (a, b) => hexGrid.isAdjacent(a, b),
    getDistance: (a, b) => hexGrid.getDistance(a, b),
    getTilesInRange: (center, range, map, options) =>
      hexGrid.getTilesInRange(center, range, map, options),
    getWorkableCityTiles: (city, map) => hexGrid.getWorkableCityTiles(city, map),
  };

  const actual = buildBorderAdjacencyCounts(mapData, countingGrid);

  assert.equal(neighborCalls, mapData.width * mapData.height, 'each tile is visited exactly once');
  for (let i = 0; i < NATIONS.length; i++) {
    for (let j = i + 1; j < NATIONS.length; j++) {
      const nationAId = NATIONS[i];
      const nationBId = NATIONS[j];
      const expected: BorderAdjacencyCounts = {
        border: referencePairCount(mapData, hexGrid, nationAId, nationBId, 'ownerId'),
        cultural: referencePairCount(mapData, hexGrid, nationAId, nationBId, 'cultureOwnerId'),
      };
      assert.deepEqual(actual.get(`${nationAId}|${nationBId}`) ?? { border: 0, cultural: 0 }, expected);
    }
  }
});

function createSyntheticMap(): MapData {
  const width = 6;
  const height = 6;
  const tiles: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      const tile: Tile = { x, y, type: TileType.Plains };
      if (x < 2) tile.ownerId = 'a';
      else if (x < 4) tile.ownerId = 'b';
      else if (y < 5) tile.ownerId = 'c';
      if (y < 2) tile.cultureOwnerId = 'c';
      else if (x + y < 6) tile.cultureOwnerId = 'a';
      else if (x !== 5 || y !== 5) tile.cultureOwnerId = 'b';
      row.push(tile);
    }
    tiles.push(row);
  }
  return { width, height, tileSize: 1, tiles };
}

function referencePairCount(
  mapData: MapData,
  gridSystem: IGridSystem,
  nationAId: string,
  nationBId: string,
  ownerField: 'ownerId' | 'cultureOwnerId',
): number {
  const seen = new Set<string>();
  for (const row of mapData.tiles) {
    for (const tile of row) {
      if (tile[ownerField] !== nationAId) continue;
      for (const neighbor of gridSystem.getNeighbors(tile, mapData)) {
        if (neighbor[ownerField] !== nationBId) continue;
        const tileA = `${tile.x},${tile.y}`;
        const tileB = `${neighbor.x},${neighbor.y}`;
        seen.add(tileA < tileB ? `${tileA}|${tileB}` : `${tileB}|${tileA}`);
      }
    }
  }
  return seen.size;
}
