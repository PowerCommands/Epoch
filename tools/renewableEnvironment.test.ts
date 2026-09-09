import { readFileSync } from 'node:fs';
import { InfrastructureSabotageSystem } from '../src/systems/InfrastructureSabotageSystem.ts';
import { InfrastructureRepairSystem } from '../src/systems/InfrastructureRepairSystem.ts';
import type { WonderSystem } from '../src/systems/WonderSystem.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_IMPROVEMENTS } from '../src/data/improvements.ts';
import { RENEWABLE_BUILDINGS, WIND_TURBINE, SOLAR_PANELS, OFFSHORE_WIND_FARM, CSP } from '../src/data/buildings.ts';
import { ALL_BUILDINGS, getBuildingById } from '../src/data/buildings.ts';
import { POWER_PLANTS } from '../src/data/powerPlants.ts';
import { WORKER, AGENT } from '../src/data/units.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { Unit } from '../src/entities/Unit.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import { ResearchSystem } from '../src/systems/ResearchSystem.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { BuilderSystem } from '../src/systems/BuilderSystem.ts';
import { ImprovementConstructionSystem } from '../src/systems/ImprovementConstructionSystem.ts';
import { PowerPlantSystem } from '../src/systems/PowerPlantSystem.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { ResourceSystem } from '../src/systems/ResourceSystem.ts';
import { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem.ts';
import { TileResourceGenerator } from '../src/systems/ResourceGenerator.ts';
import { SaveLoadService } from '../src/systems/SaveLoadService.ts';
import { getNationRenewableMaintenance } from '../src/systems/RenewableBuildingEffects.ts';
import { cleanNuclearWaste } from '../src/systems/StrategicWeaponsSystem.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { buildHappinessTooltip } from '../src/ui/happinessFormat.ts';
import { TileType, type MapData } from '../src/types/map.ts';

import { BuildingPlacementSystem } from '../src/systems/BuildingPlacementSystem.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { migrateRenewableBuildings } from '../src/systems/RenewableBuildingMigration.ts';
import { planAIPowerPlants } from '../src/systems/ai/AIPowerPlantPlanning.ts';
import type { SavedGameState } from '../src/types/saveGame.ts';
function harness() {
  const map: MapData = { width: 8, height: 4, tileSize: 1, tiles: Array.from({ length: 4 }, (_, y) => Array.from({ length: 8 }, (_, x) => ({ x, y, type: TileType.Plains, ownerId: 'a' }))) };
  const nations = new NationManager();
  const nation = new Nation({ id: 'a', name: 'A', color: 1 });
  nations.addNation(nation);
  nations.addNation(new Nation({ id: 'b', name: 'B', color: 2 }));
  const cities = new CityManager();
  const city = new City({ id: 'city', name: 'City', ownerId: 'a', tileX: 0, tileY: 0 });
  city.ownedTileCoords = map.tiles.flat().map(t => ({ x: t.x, y: t.y }));
  cities.addCity(city);
  const turns = new TurnManager(nations);
  const research = new ResearchSystem(nations, cities, () => 1);
  const units = new UnitManager(8, 4);
  const worker = new Unit({ id: 'worker', name: 'Worker', ownerId: 'a', tileX: 1, tileY: 0, unitType: WORKER });
  units.addUnit(worker);
  const grid = new HexGridSystem();
  const builder = new BuilderSystem(units, cities, turns, map, grid, research);
  const construction = new ImprovementConstructionSystem(map, units, cities);
  const access = new ResourceAccessSystem(map, { getAllDeals: () => [] });
  const power = new PowerPlantSystem(cities, access, map, 1);
  const happiness = new HappinessSystem(nations, cities);
  const resources = new ResourceSystem(nations, cities, turns, new TileResourceGenerator(), map, grid, happiness);
  resources.setCityEnergyProvider(power);
  const unlock = () => ['electricity', 'electronics', 'ecology', 'lasers'].forEach(id => research.unlockTechnology('a', id));
  const finish = () => { for (let round = 1; round <= 10; round++) construction.handleTurnStart({ nation, round }); };
  return { map, nations, nation, cities, city, turns, research, units, worker, grid, builder, construction, power, access, happiness, resources, unlock, finish, tile: map.tiles[0][1] };
}

test('renewables stack to +9; destruction, invalid terrain, foreign ownership, and city transfer update immediately', () => {
  const h = harness();
  const ids = ['wind_turbine', 'wind_turbine', 'solar_panels', 'offshore_wind_farm', 'offshore_wind_farm'];
  ids.forEach((id, n) => Object.assign(h.map.tiles[1][n], { buildingId: id, type: n < 3 ? TileType.Plains : TileType.Coast }));
  assert.equal(h.power.getCityPopulationCapacity('city'), 15);
  h.map.tiles[1][0].buildingId = undefined;
  assert.equal(h.power.getCityPopulationCapacity('city'), 14);
  h.map.tiles[1][1].type = TileType.NuclearWaste;
  assert.equal(h.power.getCityPopulationCapacity('city'), 13);
  h.map.tiles[1][2].ownerId = 'b';
  assert.equal(h.power.getCityPopulationCapacity('city'), 12);
  h.city.ownerId = 'b';
  assert.equal(h.power.getCityRenewableCapacity('city'), 1);
});

test('offshore upkeep is exactly twice land wind; costs follow territorial ownership', () => {
  assert.equal(OFFSHORE_WIND_FARM.maintenance, WIND_TURBINE.maintenance! * 2);
  const h = harness(); h.tile.buildingId = 'csp'; h.tile.type = TileType.Desert;
  h.tile.ownerId = 'b';
  assert.equal(getNationRenewableMaintenance(h.map, 'a'), 0);
  assert.equal(getNationRenewableMaintenance(h.map, 'b'), 2);
  assert.equal(h.power.getCityRenewableCapacity('city'), 0);
});

test('national Gold projection and actual turn debit charge unworked buildings', () => {
  const h = harness();
  h.resources.recalculateForNation('a');
  const before = h.nations.getResources('a').goldPerTurn;
  Object.assign(h.map.tiles[3][7], { buildingId: 'offshore_wind_farm', type: TileType.Ocean });
  h.resources.recalculateForNation('a');
  assert.equal(h.nations.getResources('a').goldPerTurn, before - 2);
  const gold = h.nations.getResources('a').gold;
  const expected = Math.floor(before * h.happiness.getGoldModifier('a')) - 2;
  h.turns.start(); h.turns.endCurrentTurn(); h.turns.endCurrentTurn();
  assert.equal(h.nations.getResources('a').gold - gold, expected);
});

for (const metadata of POWER_PLANTS) test(`${metadata.buildingId}: active-only environmental Happiness`, () => {
  const h = harness();
  h.map.tiles[3][7].resourceId = metadata.requiredResourceId;
  h.access.invalidateResourceIndex();
  h.cities.getBuildings('city').add(getBuildingById(metadata.buildingId)!);
  const penalty = ({ coal_power_plant: -5, oil_power_plant: -3, gas_power_plant: -1, nuclear_plant: 0 })[metadata.buildingId];
  const environment = h.happiness.getNationState('a').environment;
  assert.equal(environment.coal + environment.oil + environment.gas, penalty);
  h.map.tiles[3][7].resourceId = undefined; h.access.invalidateResourceIndex();
  assert.deepEqual(h.happiness.getNationState('a').environment, { coal: 0, oil: 0, gas: 0, nuclearWaste: 0 });
});

test('owned waste stacks, excludes neutral tiles, transfers with ownership, and cleans tile-by-tile', () => {
  const h = harness();
  const baselineA = h.happiness.getNetHappiness('a');
  const baselineB = h.happiness.getNetHappiness('b');
  for (let n = 0; n < 3; n++) Object.assign(h.map.tiles[1][n], { type: TileType.NuclearWaste, originalTerrain: TileType.Plains });
  h.map.tiles[1][2].ownerId = undefined;
  assert.equal(h.happiness.getNetHappiness('a'), baselineA - 10);
  assert.equal(h.happiness.getNetHappiness('b'), baselineB);
  h.map.tiles[1][0].ownerId = 'b';
  assert.equal(h.happiness.getNetHappiness('a'), baselineA - 5);
  assert.equal(h.happiness.getNetHappiness('b'), baselineB - 5);
  cleanNuclearWaste(h.map.tiles[1][1]);
  assert.equal(h.happiness.getNetHappiness('a'), baselineA);
  cleanNuclearWaste(h.map.tiles[1][0]);
  assert.equal(h.happiness.getNetHappiness('b'), baselineB);
});

test('Worker cleanup removes the common contamination penalty on completion', () => {
  const h = harness();
  Object.assign(h.tile, { type: TileType.NuclearWaste, originalTerrain: TileType.Plains });
  assert.equal(h.happiness.getNationState('a').environment.nuclearWaste, -5);
  assert.ok(h.builder.build(h.worker, h.tile)); h.finish();
  assert.equal(h.happiness.getNationState('a').environment.nuclearWaste, 0);
});

test('fossil penalties stack nationally and stay visible alongside nuclear waste', () => {
  const h = harness();
  for (let n = 0; n < 6; n++) {
    const buildingId = n < 2 ? 'coal_power_plant' : n === 2 ? 'oil_power_plant' : 'gas_power_plant';
    const id = `plant_${n}`;
    h.cities.addCity(new City({ id, name: id, ownerId: 'a', tileX: n, tileY: 2 }));
    h.cities.getBuildings(id).add(getBuildingById(buildingId)!);
    h.map.tiles[3][n].resourceId = n < 2 ? 'coal' : n === 2 ? 'oil' : 'natural_gas';
  }
  h.access.invalidateResourceIndex();
  h.tile.type = TileType.NuclearWaste;
  const state = h.happiness.getNationState('a');
  assert.deepEqual(state.environment, { coal: -10, oil: -3, gas: -3, nuclearWaste: -5 });
  const tooltip = buildHappinessTooltip(state);
  assert.match(tooltip, /Nuclear Waste: -5/);
  assert.match(tooltip, /coal.*-10/);
});


for (const [index, building] of RENEWABLE_BUILDINGS.entries()) {
  test(`${building.name}: building classification, unlock, placement, production and effects`, () => {
    const h = harness();
    const tech = ['electricity', 'electronics', 'ecology', 'lasers'][index];
    assert.ok(ALL_BUILDINGS.includes(building));
    assert.ok(!ALL_IMPROVEMENTS.some(i => i.id === building.id));
    assert.equal(h.research.getRequiredTechnologyForImprovement(building.id), undefined);
    assert.equal(h.research.getRequiredTechnologyForBuilding(building.id)?.id, tech);
    assert.equal(h.research.isBuildingUnlocked('a', building.id), false);
    h.unlock();
    assert.equal(h.research.isBuildingUnlocked('a', building.id), true);
    const placement = new BuildingPlacementSystem();
    for (const type of Object.values(TileType)) {
      h.tile.type = type;
      const allowed = placement.getValidPlacementCoords(h.city, building, h.map).some(c => c.x === 1 && c.y === 0);
      assert.equal(allowed, building.allowedTerrains!.includes(type), type);
    }
    h.tile.type = building.allowedTerrains![0];
    for (const blocker of [{ resourceId: 'wheat' }, { improvementId: 'farm' }]) {
      Object.assign(h.tile, blocker);
      assert.ok(!placement.getValidPlacementCoords(h.city, building, h.map).some(c => c.x === 1 && c.y === 0));
      h.tile.resourceId = undefined; h.tile.improvementId = undefined;
    }
    const production = new ProductionSystem(h.cities, h.turns, h.happiness);
    production.onCompleted((cityId, item) => {
      if (item.kind !== 'building') return true;
      const tile = placement.completePhysicalBuilding(h.city, item.buildingType, h.map);
      if (!tile) return false;
      h.cities.getBuildings(cityId).add(item.buildingType);
      return true;
    });
    assert.ok(placement.startPlacement(h.city, building.id, h.map));
    assert.equal(placement.selectTile(h.city, h.tile, h.map).status, 'reserved');
    production.enqueue(h.city.id, { kind: 'building', buildingType: building });
    assert.equal(production.completeCurrentProduction(h.city.id).kind, 'completed');
    assert.equal(h.tile.buildingId, building.id);
    assert.equal(h.tile.improvementId, undefined);
    assert.equal(h.power.getCityPopulationCapacity(h.city.id), 6 + building.modifiers.populationCapacity!);
    assert.equal(h.power.getCityProductionMultiplier(h.city.id), 1);
    assert.equal(getNationRenewableMaintenance(h.map, 'a'), building.maintenance);
    h.tile.buildingBroken = true;
    assert.equal(h.power.getCityPopulationCapacity(h.city.id), 6);
    assert.equal(getNationRenewableMaintenance(h.map, 'a'), 0);
    h.tile.buildingBroken = undefined;
    assert.equal(h.power.getCityPopulationCapacity(h.city.id), 6 + building.modifiers.populationCapacity!);
  });

  test(`${building.name}: AI capacity planning uses Building production`, () => {
    const decision = planAIPowerPlants({
      nationId: 'a', isHuman: false,
      cities: [{ id: 'city', name: 'City', population: 6, currentCapacity: 6, queuedPowerPlantIds: [], productionAvailable: true }],
      getResourceCapacity: () => 0,
      canConstruct: (_, id) => id === building.id,
      estimateConstructionTurns: () => 1,
    }).get('city');
    assert.equal(decision?.buildingId, building.id);
  });
}

test('save/load preserves renewable Building tiles, reservations, duplicate capacity and broken state', () => {
  const h = harness();
  RENEWABLE_BUILDINGS.forEach((b, n) => Object.assign(h.map.tiles[1][n], { type: b.allowedTerrains![0], buildingId: b.id }));
  h.tile.buildingConstruction = { cityId: 'city', buildingId: WIND_TURBINE.id };
  h.map.tiles[1][0].buildingBroken = true;
  const saved = JSON.parse(JSON.stringify(SaveLoadService.serializeTiles(h.map)));
  const restored = harness();
  SaveLoadService.restoreTiles(saved, restored.map);
  assert.equal(restored.power.getCityPopulationCapacity('city'), 13);
  assert.equal(getNationRenewableMaintenance(restored.map, 'a'), 5);
  assert.deepEqual(restored.tile.buildingConstruction, h.tile.buildingConstruction);
  assert.equal(restored.map.tiles[1][0].buildingBroken, true);
});

test('legacy renewable saves convert completed tiles and partial work to Buildings and release Workers', () => {
  const state = {
    tiles: [
      { q: 1, r: 0, ownerId: 'a', improvementId: 'wind_turbine' },
      { q: 2, r: 0, ownerId: 'a', improvementConstruction: { improvementId: 'solar_panels', cityId: 'city', unitId: 'worker', ownerId: 'a', remainingTurns: 1, totalTurns: 3 } },
    ],
    cities: [{ id: 'city', ownerId: 'a', ownedTileCoords: [{ x: 1, y: 0 }, { x: 2, y: 0 }], buildings: [], productionQueue: [] }],
    units: [{ id: 'worker', improvementCharges: 2, actionStatus: 'building', buildAction: { improvementId: 'solar_panels' } }],
  } as unknown as SavedGameState;
  const migrated = migrateRenewableBuildings(state);
  assert.equal(migrated.tiles[0].buildingId, 'wind_turbine');
  assert.equal(migrated.tiles[0].improvementId, undefined);
  assert.equal(migrated.tiles[1].buildingConstruction?.buildingId, 'solar_panels');
  assert.equal(migrated.tiles[1].improvementConstruction, undefined);
  assert.deepEqual(migrated.cities[0].buildings, ['wind_turbine']);
  assert.equal(migrated.cities[0].productionQueue[0].item.kind, 'building');
  assert.ok(Math.abs(migrated.cities[0].productionQueue[0].accumulated - 30) < 0.001);
  assert.equal(migrated.units[0].buildAction, undefined);
  assert.equal(migrated.units[0].improvementCharges, 2);
  assert.equal(migrated.units[0].actionStatus, 'active');
  assert.equal(state.tiles[0].improvementId, 'wind_turbine');
  assert.equal(migrateRenewableBuildings(migrated), migrated);
});

test('legacy Solar Plant remains resolvable without entering new production', () => {
  assert.ok(getBuildingById('solar_plant'));
  assert.ok(!ALL_BUILDINGS.some(b => b.id === 'solar_plant'));
});


test('sabotage and repair affect only the targeted renewable Building; waste cleanup stays available', () => {
  const h = harness();
  h.tile.buildingId = WIND_TURBINE.id;
  h.map.tiles[0][2].buildingId = WIND_TURBINE.id;
  h.cities.getBuildings('city').add(WIND_TURBINE);
  const sabotage = new InfrastructureSabotageSystem(h.map, h.cities, {} as WonderSystem, h.nations, () => {});
  const repair = new InfrastructureRepairSystem(h.map, h.cities, {} as WonderSystem, h.nations, () => {});
  const agent = new Unit({ id: 'agent', name: 'Agent', ownerId: 'b', tileX: 1, tileY: 0, unitType: AGENT });
  assert.equal(sabotage.canDestroyBuilding(agent), true);
  assert.equal(sabotage.destroyBuilding(agent), true);
  assert.equal(h.tile.buildingBroken, true);
  assert.equal(h.map.tiles[0][2].buildingBroken, undefined);
  assert.equal(h.power.getCityRenewableCapacity('city'), 1);
  assert.equal(repair.canRepair(h.worker), true);
  h.nations.getResources('a').gold = 100;
  assert.equal(repair.repair(h.worker), true);
  assert.equal(h.tile.buildingBroken, undefined);
  assert.equal(h.power.getCityRenewableCapacity('city'), 2);
  h.worker.movementPoints = 2;
  h.tile.type = TileType.NuclearWaste; h.tile.originalTerrain = TileType.Plains;
  assert.equal(h.builder.getBuildPreview(h.worker, h.tile).improvementId, 'clean_nuclear_waste');
  assert.equal(h.builder.canNationImproveLandTile('a', h.tile), true);
});


test('editor manifests and sprite registrations classify every renewable as a Building', () => {
  const buildings = JSON.parse(readFileSync('public/assets/data/buildings-manifest.json', 'utf8')).buildings;
  const bundle = readFileSync('public/editor/epoch-editor-resources.js', 'utf8');
  for (const building of RENEWABLE_BUILDINGS) {
    const entry = buildings.find((b: { id: string }) => b.id === building.id);
    assert.equal(entry.placement, building.placement);
    assert.deepEqual(entry.allowedTerrains, building.allowedTerrains);
    assert.equal(entry.iconPath, `assets/sprites/buildings/${building.id}.png`);
    assert.ok(readFileSync(`public/${entry.iconPath}`).length > 0);
    assert.ok(!bundle.includes(`improvement_${building.id}`));
  }
});

test('renewable reservations do not complete on terrain or ownership that became invalid', () => {
  for (const mutate of [(h: ReturnType<typeof harness>) => { h.tile.type = TileType.Forest; }, (h: ReturnType<typeof harness>) => { h.tile.ownerId = 'b'; }]) {
    const h = harness();
    const placement = new BuildingPlacementSystem();
    assert.ok(placement.startPlacement(h.city, WIND_TURBINE.id, h.map));
    assert.equal(placement.selectTile(h.city, h.tile, h.map).status, 'reserved');
    mutate(h);
    assert.equal(placement.completePhysicalBuilding(h.city, WIND_TURBINE, h.map), null);
    assert.equal(h.tile.buildingId, undefined);
    assert.equal(h.power.getCityRenewableCapacity('city'), 0);
  }
});
