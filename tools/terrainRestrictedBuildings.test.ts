import assert from 'node:assert/strict';
import test from 'node:test';

import { GRANARY, HOTEL, OBSERVATORY, STONE_WORKS } from '../src/data/buildings.ts';
import type { BuildingType } from '../src/entities/Building.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { applyBuildingCompletionEffects } from '../src/systems/BuildingCompletionEffects.ts';
import { BuildingPlacementSystem } from '../src/systems/BuildingPlacementSystem.ts';
import { calculateCityEconomy } from '../src/systems/CityEconomy.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { PowerPlantSystem } from '../src/systems/PowerPlantSystem.ts';
import type { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem.ts';
import { SaveLoadService } from '../src/systems/SaveLoadService.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { getBuildingTerrainRequirement } from '../src/utils/buildingRequirements.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';
import type { SavedCity } from '../src/types/saveGame.ts';

const NATION_ID = 'terrain_building_nation';
const CITY_ID = 'terrain_building_city';

function makeHarness(types: readonly TileType[]) {
  const nationManager = new NationManager();
  nationManager.addNation(new Nation({ id: NATION_ID, name: 'Terrain Test', color: 0x456789 }));
  const cityManager = new CityManager();
  const city = new City({ id: CITY_ID, name: 'Terrainburg', ownerId: NATION_ID, tileX: 0, tileY: 0 });
  const tiles: Tile[][] = [types.map((type, x): Tile => ({ x, y: 0, type, ownerId: NATION_ID }))];
  const mapData: MapData = { width: types.length, height: 1, tileSize: 1, tiles };
  city.ownedTileCoords = tiles[0].map(({ x, y }) => ({ x, y }));
  cityManager.addCity(city);
  const turnManager = new TurnManager(nationManager);
  const production = new ProductionSystem(cityManager, turnManager, new HappinessSystem(nationManager, cityManager));
  const placement = new BuildingPlacementSystem();
  production.onCompleted((cityId, item) => {
    if (item.kind !== 'building') return true;
    const tile = placement.finalizeReservedBuilding(cityId, item.buildingType.id, mapData);
    if (!tile) return false;
    cityManager.getBuildings(cityId).add(item.buildingType);
    applyBuildingCompletionEffects(city, item.buildingType);
    return true;
  });
  return { city, cityManager, mapData, placement, production };
}

function coordsFor(building: BuildingType, types: readonly TileType[]) {
  const h = makeHarness(types);
  return h.placement.getValidPlacementCoords(h.city, building, h.mapData).map(({ x }) => x);
}

test('unrestricted land buildings preserve existing placement behavior', () => {
  assert.equal(GRANARY.allowedTerrains, undefined);
  assert.deepEqual(
    coordsFor(GRANARY, [TileType.Plains, TileType.Beach, TileType.Forest, TileType.Mountain, TileType.Coast, TileType.Ocean]),
    [1, 2],
  );
});

test('terrain-restricted buildings accept only their configured terrain', () => {
  const terrainSample = [TileType.Plains, TileType.Beach, TileType.Forest, TileType.Mountain, TileType.Coast];
  assert.deepEqual(HOTEL.allowedTerrains, [TileType.Beach]);
  assert.deepEqual(STONE_WORKS.allowedTerrains, [TileType.Mountain]);
  assert.deepEqual(OBSERVATORY.allowedTerrains, [TileType.Mountain]);
  assert.deepEqual(coordsFor(HOTEL, terrainSample), [1]);
  assert.deepEqual(coordsFor(STONE_WORKS, terrainSample), [3]);
  assert.deepEqual(coordsFor(OBSERVATORY, terrainSample), [3]);
});

test('human placement highlights and accepts only an allowed terrain tile', () => {
  const h = makeHarness([TileType.Plains, TileType.Beach]);
  assert.equal(h.placement.startPlacement(h.city, HOTEL.id, h.mapData), true);
  assert.deepEqual(h.placement.getState()?.validCoords, [{ x: 1, y: 0 }]);
  assert.deepEqual(h.placement.selectTile(h.city, { x: 0, y: 0 }, h.mapData), { status: 'invalid' });
  assert.deepEqual(h.placement.selectTile(h.city, { x: 1, y: 0 }, h.mapData), {
    status: 'reserved',
    coord: { x: 1, y: 0 },
    buildingId: HOTEL.id,
  });
});

test('AI reservation uses the same terrain validation and returns immediately when none is valid', () => {
  const valid = makeHarness([TileType.Plains, TileType.Mountain]);
  assert.deepEqual(valid.placement.reserveFirstValidPlacement(valid.city, OBSERVATORY, valid.mapData), { tileX: 1, tileY: 0 });
  assert.equal(valid.mapData.tiles[0][0].buildingConstruction, undefined);
  assert.equal(valid.mapData.tiles[0][1].buildingConstruction?.buildingId, OBSERVATORY.id);

  const unavailable = makeHarness([TileType.Plains, TileType.Forest]);
  assert.equal(unavailable.placement.reserveFirstValidPlacement(unavailable.city, STONE_WORKS, unavailable.mapData), undefined);
  assert.equal(unavailable.placement.startPlacement(unavailable.city, STONE_WORKS.id, unavailable.mapData), false);
  assert.ok(unavailable.mapData.tiles[0].every((tile) => tile.buildingConstruction === undefined));
});

test('Hotel has its finalized recurring Gold effect and no Tourism placeholder modifiers', () => {
  assert.deepEqual(HOTEL.modifiers, { goldPerTurn: 5 });
  assert.equal(HOTEL.modifiers.culturePerTurn, undefined);
  assert.equal(HOTEL.modifiers.culturePercent, undefined);
  assert.equal(HOTEL.populationOnCompletion, 1);
  assert.equal(HOTEL.modifiers.populationCapacity, undefined);

  const h = makeHarness([TileType.Beach]);
  const buildings = h.cityManager.getBuildings(h.city.id);
  const before = calculateCityEconomy(h.city, h.mapData, buildings, new HexGridSystem()).gold;
  buildings.add(HOTEL);
  const after = calculateCityEconomy(h.city, h.mapData, buildings, new HexGridSystem()).gold;
  assert.equal(after - before, 5);
});

test('Hotel completion adds exactly one current population without increasing capacity', () => {
  const h = makeHarness([TileType.Plains, TileType.Beach]);
  const power = new PowerPlantSystem(
    h.cityManager,
    { hasResource: () => false } as ResourceAccessSystem,
    h.mapData,
  );
  const capacityBefore = power.getCityPopulationCapacity(h.city.id);
  h.city.population = capacityBefore;
  const reserved = h.placement.reserveFirstValidPlacement(h.city, HOTEL, h.mapData);
  assert.deepEqual(reserved, { tileX: 1, tileY: 0 });
  h.production.enqueue(h.city.id, { kind: 'building', buildingType: HOTEL }, { placement: reserved });
  assert.equal(h.production.completeCurrentProduction(h.city.id).kind, 'completed');
  assert.equal(h.city.population, capacityBefore + 1);
  assert.equal(power.getCityPopulationCapacity(h.city.id), capacityBefore);
  assert.equal(power.isCityInEnergyShortage(h.city.id, h.city.population), true);
  assert.equal(h.production.completeCurrentProduction(h.city.id).kind, 'empty');
  assert.equal(h.city.population, capacityBefore + 1);
});

test('save/load preserves an already-built Hotel without replaying its population effect or relocating it', () => {
  const h = makeHarness([TileType.Plains]);
  h.mapData.tiles[0][0].buildingId = HOTEL.id;
  const saved: SavedCity = {
    id: CITY_ID,
    name: 'Terrainburg',
    ownerId: NATION_ID,
    tileX: 0,
    tileY: 0,
    isCapital: true,
    originNationId: NATION_ID,
    isOriginalCapital: true,
    isResidenceCapital: true,
    health: 100,
    population: 17,
    foodStorage: 0,
    culture: 0,
    ownedTileCoords: [{ x: 0, y: 0 }],
    workedTileCoords: [],
    lastTurnAttacked: null,
    buildings: [HOTEL.id],
    productionQueue: [],
  };
  const apply = (SaveLoadService as unknown as {
    applyCitiesAndProduction: (
      cities: SavedCity[], cityManager: CityManager, productionSystem: ProductionSystem,
      mapData: MapData, gridSystem: HexGridSystem, gameSpeedId: 'standard',
    ) => void;
  }).applyCitiesAndProduction;
  apply([saved], h.cityManager, h.production, h.mapData, new HexGridSystem(), 'standard');

  assert.equal(h.cityManager.getCity(CITY_ID)?.population, 17);
  assert.equal(h.cityManager.getBuildings(CITY_ID).hasActive(HOTEL.id), true);
  assert.equal(h.mapData.tiles[0][0].buildingId, HOTEL.id);
  assert.equal(h.mapData.tiles[0][0].type, TileType.Plains);
});

test('terrain requirements are formatted generically for player-facing building information', () => {
  assert.equal(getBuildingTerrainRequirement(HOTEL), 'Requires: Beach');
  assert.equal(getBuildingTerrainRequirement(STONE_WORKS), 'Requires: Mountain');
  assert.equal(getBuildingTerrainRequirement(OBSERVATORY), 'Requires: Mountain');
  assert.equal(getBuildingTerrainRequirement(GRANARY), undefined);
});
