import assert from 'node:assert/strict';
import test from 'node:test';
import { RENEWABLE_IMPROVEMENTS, WIND_TURBINE, SOLAR_PANELS, OFFSHORE_WIND_FARM, CSP } from '../src/data/improvements.ts';
import { ALL_BUILDINGS, getBuildingById } from '../src/data/buildings.ts';
import { POWER_PLANTS } from '../src/data/powerPlants.ts';
import { WORKER, TRANSPORT_SHIP } from '../src/data/units.ts';
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
import { getNationImprovementMaintenance } from '../src/systems/ImprovementEffects.ts';
import { cleanNuclearWaste } from '../src/systems/StrategicWeaponsSystem.ts';
import { scoreRenewableImprovement } from '../src/systems/ai/AIRenewablePlanning.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { UnitActionToolbox } from '../src/ui/UnitActionToolbox.ts';
import { buildHappinessTooltip } from '../src/ui/happinessFormat.ts';
import { TileType, type MapData } from '../src/types/map.ts';

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
  const unlock = () => RENEWABLE_IMPROVEMENTS.forEach(i => research.unlockTechnology('a', i.requiredTechnologyId!));
  const finish = () => { for (let round = 1; round <= 10; round++) construction.handleTurnStart({ nation, round }); };
  return { map, nations, nation, cities, city, turns, research, units, worker, grid, builder, construction, power, access, happiness, resources, unlock, finish, tile: map.tiles[0][1] };
}

for (const improvement of RENEWABLE_IMPROVEMENTS) {
  test(`${improvement.name}: exact technology unlock and capacity`, () => {
    const h = harness();
    assert.equal(h.research.getRequiredTechnologyForImprovement(improvement.id)?.id, improvement.requiredTechnologyId);
    assert.equal(h.research.isImprovementUnlocked('a', improvement.id), false);
    h.research.unlockTechnology('a', improvement.requiredTechnologyId!);
    assert.equal(h.research.isImprovementUnlocked('a', improvement.id), true);
    h.tile.type = improvement.allowedTileTypes[0];
    h.tile.improvementId = improvement.id;
    assert.equal(h.power.getCityPopulationCapacity(h.city.id), 6 + improvement.populationCapacity!);
    assert.equal(h.power.getCityProductionMultiplier(h.city.id), 1);
    assert.equal(h.happiness.getNationState('a').environment.coal, 0);
    assert.equal(getNationImprovementMaintenance(h.map, 'a'), improvement.maintenance);
  });
  test(`${improvement.name}: normal construction and all terrain restrictions`, () => {
    const h = harness(); h.unlock();
    let actor = h.worker;
    if (improvement.requiredCargoTransportUnitTypeId) {
      actor = new Unit({ id: 'ship', name: 'Ship', ownerId: 'a', tileX: 1, tileY: 0, unitType: TRANSPORT_SHIP });
      h.units.addUnit(actor);
      assert.ok(h.units.boardUnit(h.worker.id, actor.id));
    }
    for (const terrain of Object.values(TileType)) {
      h.tile.type = terrain;
      const result = h.builder.build(actor, h.tile, { improvementId: improvement.id });
      assert.equal(result !== null, improvement.allowedTileTypes.includes(terrain), terrain);
      if (result) {
        h.finish();
        assert.equal(h.tile.improvementId, improvement.id);
        assert.equal(h.power.getCityRenewableCapacity(h.city.id), improvement.populationCapacity);
        h.tile.improvementId = undefined;
        actor.movementPoints = actor.maxMovementPoints;
      }
    }
  });
}

test('renewables stack to +9; destruction, invalid terrain, foreign ownership, and city transfer update immediately', () => {
  const h = harness();
  const ids = ['wind_turbine', 'wind_turbine', 'solar_panels', 'offshore_wind_farm', 'offshore_wind_farm'];
  ids.forEach((id, n) => Object.assign(h.map.tiles[1][n], { improvementId: id, type: n < 3 ? TileType.Plains : TileType.Coast }));
  assert.equal(h.power.getCityPopulationCapacity('city'), 15);
  h.map.tiles[1][0].improvementId = undefined;
  assert.equal(h.power.getCityPopulationCapacity('city'), 14);
  h.map.tiles[1][1].type = TileType.NuclearWaste;
  assert.equal(h.power.getCityPopulationCapacity('city'), 13);
  h.map.tiles[1][2].ownerId = 'b';
  assert.equal(h.power.getCityPopulationCapacity('city'), 12);
  h.city.ownerId = 'b';
  assert.equal(h.power.getCityRenewableCapacity('city'), 1);
});

test('offshore upkeep is exactly twice land wind; costs follow economic ownership', () => {
  assert.equal(OFFSHORE_WIND_FARM.maintenance, WIND_TURBINE.maintenance! * 2);
  const h = harness(); h.tile.improvementId = 'csp'; h.tile.type = TileType.Desert;
  h.tile.improvementOwnerId = 'b';
  assert.equal(getNationImprovementMaintenance(h.map, 'a'), 0);
  assert.equal(getNationImprovementMaintenance(h.map, 'b'), 2);
  assert.equal(h.power.getCityRenewableCapacity('city'), 0);
});

test('national Gold projection and actual turn debit charge unworked improvements', () => {
  const h = harness();
  h.resources.recalculateForNation('a');
  const before = h.nations.getResources('a').goldPerTurn;
  Object.assign(h.map.tiles[3][7], { improvementId: 'offshore_wind_farm', type: TileType.Ocean });
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

test('save/load preserves completed and in-progress renewables and derives effects from tiles', () => {
  const h = harness(); h.unlock();
  RENEWABLE_IMPROVEMENTS.forEach((i, n) => Object.assign(h.map.tiles[1][n], { type: i.allowedTileTypes[0], improvementId: i.id }));
  assert.ok(h.builder.build(h.worker, h.tile, { improvementId: 'wind_turbine' }));
  const saved = JSON.parse(JSON.stringify(SaveLoadService.serializeTiles(h.map)));
  const restored = harness(); restored.unlock();
  SaveLoadService.restoreTiles(saved, restored.map);
  restored.builder.rebuildConstructionIndex();
  // Construction system normally syncs during save restoration; recreate with restored tiles.
  const construction = new ImprovementConstructionSystem(restored.map, restored.units, restored.cities);
  assert.equal(restored.power.getCityPopulationCapacity('city'), 14);
  assert.equal(getNationImprovementMaintenance(restored.map, 'a'), 6);
  for (let round = 1; round <= 10; round++) construction.handleTurnStart({ nation: restored.nation, round });
  assert.equal(restored.power.getCityPopulationCapacity('city'), 15);
  assert.equal(getNationImprovementMaintenance(restored.map, 'a'), 7);
});

test('legacy Solar Plant resolves for saves but is unavailable for new research/production lists', () => {
  const h = harness();
  assert.ok(getBuildingById('solar_plant'));
  assert.ok(!ALL_BUILDINGS.some(b => b.id === 'solar_plant'));
  assert.equal(h.research.isBuildingUnlocked('a', 'solar_plant'), false);
});

test('toolbox cycles to a renewable, shows exact costs, and constructs the selected choice', () => {
  const h = harness(); h.unlock();
  const toolbox = new UnitActionToolbox('a');
  toolbox.setBuildAvailabilityProvider(h.builder); toolbox.setSelectedUnit(h.worker);
  toolbox.tryActivate('cycleImprovement');
  const action = toolbox.getHudActions().find(a => a.mode === 'build')!;
  assert.equal(action.label, 'Build Wind Turbine');
  assert.match(action.tooltip!, /\+1 Population Capacity/);
  assert.match(action.tooltip!, /1 Gold\/turn/);
  assert.ok(h.builder.build(h.worker, h.tile)); h.finish();
  assert.equal(h.tile.improvementId, 'wind_turbine');
});

test('AI planning accounts for +1/+3 benefits, growth need, maintenance commitments and leader economy preference', () => {
  const input = { population: 6, capacity: 6, pendingCapacity: 0, gold: 100, goldPerTurn: 10, pendingMaintenance: 0, economicPriority: false, distance: 0 };
  assert.ok(scoreRenewableImprovement(CSP, input) > scoreRenewableImprovement(SOLAR_PANELS, input));
  assert.equal(scoreRenewableImprovement(CSP, { ...input, gold: 0 }), 0);
  assert.equal(scoreRenewableImprovement(CSP, { ...input, goldPerTurn: 2 }), 0);
  assert.equal(scoreRenewableImprovement(CSP, { ...input, pendingCapacity: 4 }), 0);
  assert.equal(scoreRenewableImprovement(CSP, { ...input, population: 2 }), 0);
  assert.ok(scoreRenewableImprovement(WIND_TURBINE, { ...input, economicPriority: true }) > scoreRenewableImprovement(WIND_TURBINE, input));
});

for (const improvement of RENEWABLE_IMPROVEMENTS) test(`AI actually starts and completes ${improvement.name}`, async () => {
  const { AISystem } = await import('../src/systems/AISystem.ts');
  const h = harness(); h.unlock(); h.city.population = 6;
  // Keep exactly one appropriate plot, ensuring this tests the specific installation.
  h.city.ownedTileCoords = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
  h.tile.type = improvement.allowedTileTypes[0];
  if (improvement.id === 'wind_turbine') h.nation.researchedTechIds = ['electricity'];
  if (improvement.id === 'solar_panels') h.nation.researchedTechIds = ['electronics'];
  h.nations.getResources('a').gold = 100;
  h.nations.getResources('a').goldPerTurn = 10;
  let actor = h.worker;
  if (improvement.id === 'offshore_wind_farm') {
    actor = new Unit({ id: 'ship', name: 'Ship', ownerId: 'a', tileX: 1, tileY: 0, unitType: TRANSPORT_SHIP });
    h.units.addUnit(actor);
    assert.ok(h.units.boardUnit(h.worker.id, actor.id));
  }
  const ai = Object.create(AISystem.prototype);
  Object.assign(ai, { builderSystem: h.builder, powerPlantSystem: h.power, cityManager: h.cities,
    nationManager: h.nations, unitManager: h.units, mapData: h.map, gridSystem: h.grid });
  assert.equal(ai.runRenewableBuilder(actor, 'a'), true);
  assert.equal(h.tile.improvementConstruction?.improvementId, improvement.id);
  h.finish();
  assert.equal(h.tile.improvementId, improvement.id);
  assert.equal(h.power.getCityRenewableCapacity('city'), improvement.populationCapacity);
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

test('in-progress renewable cancels if terrain or ownership changes', () => {
  for (const mutate of [(h: ReturnType<typeof harness>) => { h.tile.type = TileType.Forest; }, (h: ReturnType<typeof harness>) => { h.tile.ownerId = 'b'; }]) {
    const h = harness(); h.unlock();
    assert.ok(h.builder.build(h.worker, h.tile, { improvementId: 'wind_turbine' }));
    mutate(h); h.finish();
    assert.equal(h.tile.improvementId, undefined);
    assert.equal(h.tile.improvementConstruction, undefined);
    assert.equal(h.power.getCityRenewableCapacity('city'), 0);
  }
});
