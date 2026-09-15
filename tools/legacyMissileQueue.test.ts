import assert from 'node:assert/strict';
import test from 'node:test';
import { MISSILE_LAUNCH_PAD } from '../src/data/buildings';
import { City } from '../src/entities/City';
import { Nation } from '../src/entities/Nation';
import { BuildingPlacementSystem } from '../src/systems/BuildingPlacementSystem';
import { CityManager } from '../src/systems/CityManager';
import { HappinessSystem } from '../src/systems/HappinessSystem';
import { NationManager } from '../src/systems/NationManager';
import { ProductionSystem } from '../src/systems/ProductionSystem';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import { TurnManager } from '../src/systems/TurnManager';
import { initializeUrbanDevelopment } from '../src/systems/UrbanDevelopment';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem';
import { TileType, type MapData } from '../src/types/map';
import type { SavedCity } from '../src/types/saveGame';

function fixture() {
  const map: MapData = { width: 9, height: 9, tileSize: 16, tiles: Array.from({ length: 9 }, (_, y) =>
    Array.from({ length: 9 }, (_, x) => ({ x, y, type: TileType.Plains }))) };
  const sourceCity = new City({ id: 'city', name: 'Legacy City', ownerId: 'owner', tileX: 4, tileY: 4 });
  initializeUrbanDevelopment(sourceCity, map);
  const saved: SavedCity = { id: sourceCity.id, name: sourceCity.name, ownerId: sourceCity.ownerId,
    urbanDevelopment: sourceCity.urbanDevelopment!, tileX: 4, tileY: 4, isCapital: true,
    health: 100, population: 1, foodStorage: 0, culture: 0, lastTurnAttacked: null,
    ownedTileCoords: [{ x: 4, y: 4 }, { x: 0, y: 0 }, { x: 8, y: 0 }], workedTileCoords: [], buildings: [],
    productionQueue: [{ item: { kind: 'building', id: 'nuclear_silo' }, accumulated: 317, lockedProductionCost: 432 }] };
  const nations = new NationManager(); nations.addNation(new Nation({ id: 'owner', name: 'Owner', color: 1 }));
  const cities = new CityManager();
  const production = new ProductionSystem(cities, new TurnManager(nations), new HappinessSystem(nations, cities));
  const placement = new BuildingPlacementSystem();
  const restore = () => (SaveLoadService as unknown as {
    applyCitiesAndProduction(cities: SavedCity[], manager: CityManager, production: ProductionSystem, map: MapData, grid: HexGridSystem, speed: 'standard'): void;
  }).applyCitiesAndProduction([saved], cities, production, map, new HexGridSystem(), 'standard');
  return { map, saved, cities, production, placement, restore };
}

test('old city-only silo queue gains a physical land reservation without losing progress or locked cost', () => {
  const h = fixture(); h.restore();
  const entry = h.production.getQueue('city')[0];
  assert.equal(entry.progress, 317); assert.equal(entry.lockedProductionCost, 432);
  assert.deepEqual(entry.placement, { tileX: 0, tileY: 0 });
  assert.deepEqual(h.map.tiles[0][0].buildingConstruction, { buildingId: 'nuclear_silo', cityId: 'city' });
  assert.equal(h.map.tiles[4][4].buildingConstruction, undefined);
  const destination = h.placement.completePhysicalBuilding(h.cities.getCity('city')!, MISSILE_LAUNCH_PAD, h.map);
  assert.equal(destination?.buildingId, MISSILE_LAUNCH_PAD.id);
});

test('existing valid launch-pad reservation remains at its chosen tile after load', () => {
  const h = fixture();
  h.saved.productionQueue[0].placement = { tileX: 8, tileY: 0 };
  h.map.tiles[0][8].buildingConstruction = { buildingId: 'nuclear_silo', cityId: 'city' };
  h.restore();
  assert.deepEqual(h.production.getQueue('city')[0].placement, { tileX: 8, tileY: 0 });
  assert.equal(h.map.tiles[0][0].buildingConstruction, undefined);
});

test('an obsolete city-center reservation migrates away from the city tile', () => {
  const h = fixture();
  h.saved.productionQueue[0].placement = { tileX: 4, tileY: 4 };
  h.map.tiles[4][4].buildingConstruction = { buildingId: 'nuclear_silo', cityId: 'city' };
  h.restore();
  assert.deepEqual(h.production.getQueue('city')[0].placement, { tileX: 0, tileY: 0 });
  assert.equal(h.map.tiles[4][4].buildingConstruction, undefined);
});

test('legacy silo queue retains paid work with a clear placement block when all owned land is occupied', () => {
  const h = fixture(); h.map.tiles[0][0].improvementId = 'farm'; h.map.tiles[0][8].resourceId = 'iron';
  h.restore();
  const entry = h.production.getQueue('city')[0];
  assert.equal(entry.progress, 317); assert.equal(entry.lockedProductionCost, 432);
  assert.equal(entry.placement, undefined);
  assert.match(entry.blockedReason ?? '', /empty owned land tile outside the city center/);
  assert.equal(h.placement.findReservedTile('city', MISSILE_LAUNCH_PAD.id, h.map), null);
  h.map.tiles[0][0].improvementId = undefined;
  assert.deepEqual(h.placement.reserveFirstValidPlacement(h.cities.getCity('city')!, MISSILE_LAUNCH_PAD, h.map), { tileX: 0, tileY: 0 });
  assert.ok(h.placement.completePhysicalBuilding(h.cities.getCity('city')!, MISSILE_LAUNCH_PAD, h.map));
});
