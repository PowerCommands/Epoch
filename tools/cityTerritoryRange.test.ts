import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getGameSpeedById, scaleGameSpeedCost } from '../src/data/gameSpeeds.ts';
import { City } from '../src/entities/City.ts';
import {
  CITY_CLAIM_RANGE,
  CityTerritorySystem,
  type CityTileCoord,
} from '../src/systems/CityTerritorySystem.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

const OWNER_ID = 'nation_a';

test('range-bounded territory queries match whole-map reference near a clipped map edge', () => {
  const mapData = createMap(10, 9);
  const city = createCity('edge', 0, 0);
  seedOwnership(city, mapData);
  assertMatchesWholeMapReference(city, mapData);
});

test('range-bounded territory queries match whole-map reference in open terrain', () => {
  const mapData = createMap(15, 14);
  const city = createCity('open', 7, 7);
  seedOwnership(city, mapData);
  assertMatchesWholeMapReference(city, mapData);
});

function assertMatchesWholeMapReference(city: City, mapData: MapData): void {
  const grid = new HexGridSystem();
  const system = new CityTerritorySystem(undefined, grid);
  const expectedClaimable = referenceClaimableTiles(city, mapData, grid);
  const expectedOwnedCount = mapData.tiles
    .flat()
    .filter((tile) => (
      tile.ownerId === city.ownerId
      && grid.getDistance(cityCenter(city), tile) <= CITY_CLAIM_RANGE
    )).length;
  const expectedCost = scaleGameSpeedCost(
    5 + expectedOwnedCount * 2,
    getGameSpeedById(undefined),
  );

  assert.deepEqual(system.getClaimableTiles(city, mapData), expectedClaimable);
  assert.equal(system.getClaimCost(city, mapData), expectedCost);

  const expectedByRing = referenceRingBuckets(expectedClaimable, mapData, grid, city);
  const actualByRing = system.getExpansionCandidatesByRing(city, mapData);
  assert.deepEqual([...actualByRing.keys()], [...expectedByRing.keys()]);

  const actualCoords = [...actualByRing.entries()]
    .flatMap(([ring, tiles]) => tiles.map((tile) => ({ ring, x: tile.x, y: tile.y })))
    .sort(compareRingCoords);
  const expectedCoords = [...expectedByRing.entries()]
    .flatMap(([ring, tiles]) => tiles.map((tile) => ({ ring, x: tile.x, y: tile.y })))
    .sort(compareRingCoords);
  assert.deepEqual(actualCoords, expectedCoords);
  for (const [ring, tiles] of actualByRing) {
    for (const tile of tiles) {
      assert.equal(grid.getDistance(cityCenter(city), tile), ring);
    }
  }
}

function referenceClaimableTiles(
  city: City,
  mapData: MapData,
  grid: HexGridSystem,
): CityTileCoord[] {
  const owned = new Set(city.ownedTileCoords.map((coord) => `${coord.x},${coord.y}`));
  return mapData.tiles
    .flat()
    .filter((tile) => {
      if (owned.has(`${tile.x},${tile.y}`)) return false;
      if (tile.ownerId !== undefined) return false;
      const distance = grid.getDistance(cityCenter(city), tile);
      return distance >= 2 && distance <= CITY_CLAIM_RANGE;
    })
    .map((tile) => ({ x: tile.x, y: tile.y }))
    .sort(compareCoords);
}

function referenceRingBuckets(
  claimable: readonly CityTileCoord[],
  mapData: MapData,
  grid: HexGridSystem,
  city: City,
): Map<number, Tile[]> {
  const claimableSet = new Set(claimable.map((coord) => `${coord.x},${coord.y}`));
  const result = new Map<number, Tile[]>();
  for (const tile of mapData.tiles.flat()) {
    if (!claimableSet.has(`${tile.x},${tile.y}`)) continue;
    const distance = grid.getDistance(cityCenter(city), tile);
    const bucket = result.get(distance) ?? [];
    bucket.push(tile);
    result.set(distance, bucket);
  }
  return result;
}

function seedOwnership(city: City, mapData: MapData): void {
  city.ownedTileCoords = [];
  for (const row of mapData.tiles) {
    for (const tile of row) {
      const distance = new HexGridSystem().getDistance(cityCenter(city), tile);
      if (distance <= 1 || (distance <= CITY_CLAIM_RANGE && (tile.x + tile.y) % 7 === 0)) {
        tile.ownerId = OWNER_ID;
        city.ownedTileCoords.push({ x: tile.x, y: tile.y });
      } else if (distance <= CITY_CLAIM_RANGE && (tile.x * 3 + tile.y) % 11 === 0) {
        tile.ownerId = 'nation_b';
      } else if (distance > CITY_CLAIM_RANGE && (tile.x + tile.y) % 5 === 0) {
        tile.ownerId = OWNER_ID;
      }
    }
  }
  city.ownedTileCoords.sort(compareCoords);
}

function createMap(width: number, height: number): MapData {
  const tiles = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x): Tile => ({
      x,
      y,
      type: (x + y) % 6 === 0 ? TileType.Desert : TileType.Plains,
      resourceId: (x * 5 + y) % 17 === 0 ? 'wheat' : undefined,
    })));
  return { width, height, tileSize: 1, tiles };
}

function createCity(id: string, tileX: number, tileY: number): City {
  return new City({
    id,
    name: id,
    ownerId: OWNER_ID,
    tileX,
    tileY,
    originNationId: OWNER_ID,
  });
}

function cityCenter(city: City): CityTileCoord {
  return { x: city.tileX, y: city.tileY };
}

function compareCoords(a: CityTileCoord, b: CityTileCoord): number {
  return a.y - b.y || a.x - b.x;
}

function compareRingCoords(
  a: { ring: number; x: number; y: number },
  b: { ring: number; x: number; y: number },
): number {
  return a.ring - b.ring || a.y - b.y || a.x - b.x;
}
