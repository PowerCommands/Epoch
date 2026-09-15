import assert from 'node:assert/strict';
import test from 'node:test';
import { AQUEDUCT, SEWERS, COAL_POWER_PLANT, WIND_TURBINE } from '../src/data/buildings.ts';
import { ECONOMIC_DEVELOPMENT } from '../src/data/projects.ts';
import { WARRIOR } from '../src/data/units.ts';
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
import { reserveUrbanSlots } from '../src/systems/UrbanDevelopment.ts';
import type { AIPowerPlantDecision } from '../src/systems/ai/AIPowerPlantPlanning.ts';
import { TileType, type MapData } from '../src/types/map.ts';

function harness() {
  const nationManager = new NationManager();
  const nation = new Nation({ id: 'usa', name: 'USA', color: 0 });
  nationManager.addNation(nation);
  Object.assign(nationManager.getResources(nation.id), { gold: 100, goldPerTurn: 10 });
  const cityManager = new CityManager();
  const city = new City({ id: 'boston', name: 'Boston', ownerId: nation.id, tileX: 2, tileY: 2 });
  city.population = 8;
  cityManager.addCity(city);
  const mapData: MapData = { width: 5, height: 5, tileSize: 1, tiles: Array.from({ length: 5 }, (_, y) =>
    Array.from({ length: 5 }, (_, x) => ({ x, y, type: TileType.Plains, ownerId: nation.id, resourceId: 'coal' }))) };
  city.ownedTileCoords = mapData.tiles.flat().map(({ x, y }) => ({ x, y }));
  reserveUrbanSlots(city, mapData);
  const productionSystem = new ProductionSystem(cityManager, new TurnManager(nationManager), new HappinessSystem(nationManager, cityManager));
  const powerPlantSystem = new PowerPlantSystem(cityManager, new ResourceAccessSystem(mapData, { getAllDeals: () => [] }), mapData, 1);
  const unlocked = new Set([AQUEDUCT.id, SEWERS.id]);
  const ai = Object.create(AISystem.prototype) as AISystem;
  Object.assign(ai, {
    cityManager, nationManager, productionSystem, powerPlantSystem, mapData,
    buildingPlacementSystem: new BuildingPlacementSystem(),
    isHuman: () => false,
    canBuildBuilding: (_nationId: string, id: string) => unlocked.has(id),
    formatLog: (_nationId: string, message: string) => message,
  });
  const internal = ai as unknown as {
    createPowerPlantPlans(nationId: string, cities: readonly City[]): Map<string, AIPowerPlantDecision>;
    canCityBuildBuilding(city: City, nationId: string, building: BuildingType): boolean;
    reconsiderContinuousProjects(cities: readonly City[], round?: number): void;
    ensureUrgentCapacityProduction(nationId: string, cities: readonly City[]): void;
  };
  return {
    city, buildings: cityManager.getBuildings(city.id), mapData, productionSystem, powerPlantSystem, unlocked,
    plan: () => internal.createPowerPlantPlans(nation.id, [city]).get(city.id),
    canBuild: (building: BuildingType) => internal.canCityBuildBuilding(city, nation.id, building),
    runCapacityCycle: (round = 0) => {
      internal.reconsiderContinuousProjects([city], round);
      internal.ensureUrgentCapacityProduction(nation.id, [city]);
    },
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

test('a capped city leaves perpetual gold production and completes capacity infrastructure', () => {
  const h = harness();
  h.buildings.add(SEWERS);
  h.productionSystem.enqueue(h.city.id, { kind: 'project', projectType: ECONOMIC_DEVELOPMENT });
  h.runCapacityCycle();
  const item = h.productionSystem.getProduction(h.city.id)?.item;
  assert.equal(item?.kind === 'building' && item.buildingType.id, AQUEDUCT.id);
  h.runCapacityCycle();
  assert.equal(h.productionSystem.getQueue(h.city.id).length, 1, 'no duplicate while construction is running');
  h.productionSystem.onCompleted((_id, completed) => {
    if (completed.kind === 'building') h.buildings.add(completed.buildingType);
  });
  assert.equal(h.productionSystem.completeCurrentProduction(h.city.id).kind, 'completed');
  assert.equal(h.powerPlantSystem.getCityPopulationCapacity(h.city.id), 10);
});

test('reconsidering gold production preserves queued finite work and placement', () => {
  const h = harness();
  h.productionSystem.enqueue(h.city.id, { kind: 'project', projectType: ECONOMIC_DEVELOPMENT });
  h.productionSystem.enqueue(h.city.id, { kind: 'building', buildingType: AQUEDUCT }, { placement: { tileX: 1, tileY: 0 } });
  h.runCapacityCycle(1);
  assert.equal(h.productionSystem.getQueue(h.city.id).length, 1);
  assert.deepEqual(h.productionSystem.getProduction(h.city.id)?.placement, { tileX: 1, tileY: 0 });
});

test('continuous projects are reconsidered at least every five rounds', () => {
  const h = harness();
  h.buildings.add(SEWERS);
  h.productionSystem.enqueue(h.city.id, { kind: 'project', projectType: ECONOMIC_DEVELOPMENT });
  for (let round = 1; round < 5; round++) {
    h.runCapacityCycle(round);
    assert.equal(h.productionSystem.getProduction(h.city.id)?.item.kind, 'project');
  }
  h.runCapacityCycle(5);
  const item = h.productionSystem.getProduction(h.city.id)?.item;
  assert.equal(item?.kind === 'building' && item.buildingType.id, AQUEDUCT.id);
});

test('capacity priorities do not interrupt finite construction or emergency defenders', () => {
  const h = harness();
  h.productionSystem.enqueue(h.city.id, { kind: 'unit', unitType: WARRIOR });
  const before = h.productionSystem.getProduction(h.city.id);
  h.runCapacityCycle();
  assert.deepEqual(h.productionSystem.getProduction(h.city.id), before);
});

test('unavailable fuel falls back to buildable sanitation during persistent shortage', () => {
  const h = harness();
  h.unlocked.add(COAL_POWER_PLANT.id);
  for (const row of h.mapData.tiles) for (const tile of row) tile.resourceId = undefined;
  h.buildings.add(SEWERS);
  h.productionSystem.setProduction(h.city.id, { kind: 'project', projectType: ECONOMIC_DEVELOPMENT });
  h.runCapacityCycle();
  const item = h.productionSystem.getProduction(h.city.id)?.item;
  assert.equal(item?.kind === 'building' && item.buildingType.id, AQUEDUCT.id);
});

test('unavailable infrastructure leaves the queue open for ordinary fallback without invalid reservations', () => {
  const h = harness();
  h.unlocked.clear();
  h.productionSystem.setProduction(h.city.id, { kind: 'project', projectType: ECONOMIC_DEVELOPMENT });
  h.runCapacityCycle();
  assert.equal(h.productionSystem.getProduction(h.city.id), undefined);
  assert.ok(h.mapData.tiles[0].every(tile => !tile.buildingConstruction));
});
