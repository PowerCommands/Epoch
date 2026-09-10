import assert from 'node:assert/strict';
import test from 'node:test';
import { AQUEDUCT, SEWERS, COAL_POWER_PLANT, WIND_TURBINE } from '../src/data/buildings.ts';
import type { BuildingType } from '../src/entities/Building.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { AISystem } from '../src/systems/AISystem.ts';
import { BuildingPlacementSystem } from '../src/systems/BuildingPlacementSystem.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { PowerPlantSystem } from '../src/systems/PowerPlantSystem.ts';
import { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import type { AIPowerPlantDecision } from '../src/systems/ai/AIPowerPlantPlanning.ts';
import { TileType, type MapData } from '../src/types/map.ts';

function harness() {
  const nationManager = new NationManager();
  const nation = new Nation({ id: 'usa', name: 'USA', color: 0 });
  nationManager.addNation(nation);
  Object.assign(nationManager.getResources(nation.id), { gold: 100, goldPerTurn: 10 });
  const cityManager = new CityManager();
  const city = new City({ id: 'boston', name: 'Boston', ownerId: nation.id, tileX: 0, tileY: 0 });
  city.population = 8;
  city.ownedTileCoords = [0, 1, 2].map(x => ({ x, y: 0 }));
  cityManager.addCity(city);
  const mapData: MapData = { width: 3, height: 1, tileSize: 1, tiles: [[0, 1, 2].map(x => ({
    x, y: 0, type: TileType.Plains, ownerId: nation.id, resourceId: 'coal',
  }))] };
  const productionSystem = new ProductionSystem(cityManager, new TurnManager(nationManager), new HappinessSystem(nationManager, cityManager));
  const powerPlantSystem = new PowerPlantSystem(cityManager, new ResourceAccessSystem(mapData, { getAllDeals: () => [] }), mapData, 1);
  const unlocked = new Set([AQUEDUCT.id, SEWERS.id]);
  const ai = Object.create(AISystem.prototype) as AISystem;
  Object.assign(ai, {
    cityManager, nationManager, productionSystem, powerPlantSystem, mapData,
    buildingPlacementSystem: new BuildingPlacementSystem(),
    isHuman: () => false,
    canBuildBuilding: (_nationId: string, id: string) => unlocked.has(id),
  });
  const internal = ai as unknown as {
    createPowerPlantPlans(nationId: string, cities: readonly City[]): Map<string, AIPowerPlantDecision>;
    canCityBuildBuilding(city: City, nationId: string, building: BuildingType): boolean;
  };
  return {
    city, buildings: cityManager.getBuildings(city.id), mapData, productionSystem, powerPlantSystem, unlocked,
    plan: () => internal.createPowerPlantPlans(nation.id, [city]).get(city.id),
    canBuild: (building: BuildingType) => internal.canCityBuildBuilding(city, nation.id, building),
  };
}

test('capacity AI builds an aqueduct once and stops choosing it on subsequent turns', () => {
  const h = harness();
  h.buildings.add(SEWERS);
  assert.equal(h.plan()?.buildingId, AQUEDUCT.id);
  h.productionSystem.onCompleted((_cityId, item) => {
    if (item.kind === 'building') h.buildings.add(item.buildingType);
  });
  h.productionSystem.enqueue(h.city.id, { kind: 'building', buildingType: AQUEDUCT });
  assert.equal(h.plan(), undefined);
  assert.equal(h.productionSystem.completeCurrentProduction(h.city.id).kind, 'completed');
  assert.equal(h.powerPlantSystem.getCityPopulationCapacity(h.city.id), 10);
  for (const population of [8, 9, 10]) {
    h.city.population = population;
    assert.equal(h.plan(), undefined, `population ${population}`);
  }
});

test('broken sanitation buildings need repair, not another copy', () => {
  const h = harness();
  for (const building of [SEWERS, AQUEDUCT]) {
    h.buildings.add(building);
    h.buildings.setBroken(building.id, true);
    assert.equal(h.canBuild(building), false);
  }
  assert.equal(h.plan(), undefined);
});

test('existing, reserved and queued aqueducts are excluded by the AI building gate', () => {
  for (const state of ['placed', 'reserved', 'queued'] as const) {
    const h = harness();
    const tile = h.mapData.tiles[0][1];
    if (state === 'placed') tile.buildingId = AQUEDUCT.id;
    if (state === 'reserved') tile.buildingConstruction = { cityId: h.city.id, buildingId: AQUEDUCT.id };
    if (state === 'queued') h.productionSystem.enqueue(h.city.id, { kind: 'building', buildingType: AQUEDUCT });
    assert.equal(h.canBuild(AQUEDUCT), false, state);
  }
});

test('capacity AI can still replace an aging plant of the same type', () => {
  const h = harness();
  h.unlocked.clear();
  h.unlocked.add(COAL_POWER_PLANT.id);
  h.buildings.add(COAL_POWER_PLANT);
  h.powerPlantSystem.restore([{ id: h.city.id, powerPlantAge: 19 }], 1);
  h.powerPlantSystem.refreshAllocation(false);
  assert.equal(h.plan()?.buildingId, COAL_POWER_PLANT.id);
  assert.equal(h.plan()?.reason, 'aging_replacement');
});

test('repeatable renewable infrastructure remains buildable', () => {
  const h = harness();
  h.unlocked.add(WIND_TURBINE.id);
  h.buildings.add(WIND_TURBINE);
  h.mapData.tiles[0][1].buildingId = WIND_TURBINE.id;
  h.mapData.tiles[0][2].resourceId = undefined;
  assert.equal(h.canBuild(WIND_TURBINE), true);
});
