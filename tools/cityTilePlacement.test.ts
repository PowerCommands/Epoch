import assert from 'node:assert/strict';
import test from 'node:test';
import { ARMORY, BARRACKS, WALLS } from '../src/data/buildings.ts';
import { PYRAMIDS } from '../src/data/wonders.ts';
import { City } from '../src/entities/City.ts';
import { BuildingPlacementSystem } from '../src/systems/BuildingPlacementSystem.ts';
import { WonderPlacementSystem } from '../src/systems/WonderPlacementSystem.ts';
import { TileType, type MapData } from '../src/types/map.ts';

function setup(width = 2) {
  const city = new City({ id: 'city', name: 'City', ownerId: 'nation', tileX: 0, tileY: 0 });
  const map: MapData = {
    width, height: 1, tileSize: 1,
    tiles: [Array.from({ length: width }, (_, x) => ({ x, y: 0, type: TileType.Plains, ownerId: city.ownerId }))],
  };
  city.ownedTileCoords = map.tiles[0].map(({ x, y }) => ({ x, y }));
  return { city, map, buildings: new BuildingPlacementSystem(), wonders: new WonderPlacementSystem() };
}

test('Barracks placement excludes the city center for humans and AI', () => {
  const { city, map, buildings } = setup();
  assert.equal(BARRACKS.requiresEmptyTile, undefined);
  assert.equal(buildings.startPlacement(city, BARRACKS.id, map), true);
  assert.deepEqual(buildings.getState()?.validCoords, [{ x: 1, y: 0 }]);
  assert.deepEqual(buildings.selectTile(city, { x: 0, y: 0 }, map), { status: 'invalid' });
  assert.equal(map.tiles[0][0].buildingConstruction, undefined);
  assert.equal(buildings.selectTile(city, { x: 1, y: 0 }, map).status, 'reserved');
  assert.equal(buildings.completePhysicalBuilding(city, BARRACKS, map), map.tiles[0][1]);
  const ai = setup();
  assert.deepEqual(ai.buildings.reserveFirstValidPlacement(ai.city, BARRACKS, ai.map), { tileX: 1, tileY: 0 });
});

test('a city with no other tiles cannot reserve a building or wonder', () => {
  const { city, map, buildings, wonders } = setup(1);
  assert.equal(buildings.startPlacement(city, BARRACKS.id, map), false);
  assert.equal(buildings.reserveFirstValidPlacement(city, BARRACKS, map), undefined);
  assert.equal(wonders.startPlacement(city, PYRAMIDS.id, map), false);
  assert.equal(wonders.reserveFirstValidPlacement(city, PYRAMIDS, map), undefined);
});

test('old city-center reservations and upgrade predecessors cannot complete physical buildings', () => {
  const { city, map, buildings } = setup();
  const center = map.tiles[0][0];
  center.buildingConstruction = { cityId: city.id, buildingId: BARRACKS.id };
  assert.equal(buildings.completePhysicalBuilding(city, BARRACKS, map), null);
  assert.equal(center.buildingId, undefined);
  center.buildingId = BARRACKS.id;
  assert.deepEqual(buildings.getValidPlacementCoords(city, ARMORY, map), []);
  assert.equal(buildings.completePhysicalBuilding(city, ARMORY, map), null);
  assert.equal(center.buildingId, BARRACKS.id);
});

test('Walls retain automatic city placement without a map reservation', () => {
  const { city, map, buildings } = setup();
  assert.equal(WALLS.placement, 'city');
  assert.equal(buildings.startPlacement(city, WALLS.id, map), false);
  assert.equal(buildings.reserveFirstValidPlacement(city, WALLS, map), undefined);
  assert.equal(map.tiles[0][0].buildingConstruction, undefined);
});

test('wonder placement also excludes the city center', () => {
  const { city, map, wonders } = setup();
  assert.equal(wonders.startPlacement(city, PYRAMIDS.id, map), true);
  assert.deepEqual(wonders.getState()?.validCoords, [{ x: 1, y: 0 }]);
  assert.deepEqual(wonders.selectTile(city, { x: 0, y: 0 }, map), { status: 'invalid' });
  assert.deepEqual(wonders.reserveFirstValidPlacement(city, PYRAMIDS, map), { tileX: 1, tileY: 0 });
});
