import assert from 'node:assert/strict';
import test from 'node:test';

import { AQUEDUCT, SEWERS, getBuildingById } from '../src/data/buildings.ts';
import { POWER_PLANTS } from '../src/data/powerPlants.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { calculateCityEconomy } from '../src/systems/CityEconomy.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { PowerPlantSystem } from '../src/systems/PowerPlantSystem.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem.ts';
import { TileResourceGenerator } from '../src/systems/ResourceGenerator.ts';
import { ResourceSystem } from '../src/systems/ResourceSystem.ts';
import { SaveLoadService, type SaveLoadContext } from '../src/systems/SaveLoadService.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import type { SavedCity } from '../src/types/saveGame.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

const NATION_ID = 'nation_energy_test';

function makeHarness(population = 1) {
  const nationManager = new NationManager();
  const nation = new Nation({ id: NATION_ID, name: 'Energy Test', color: 0x123456 });
  nationManager.addNation(nation);

  const width = 9;
  const height = 9;
  const tiles: Tile[][] = Array.from({ length: height }, (_, y) => (
    Array.from({ length: width }, (_, x): Tile => ({
      x,
      y,
      type: TileType.Plains,
      ownerId: NATION_ID,
    }))
  ));
  const mapData: MapData = { width, height, tileSize: 1, tiles };
  const gridSystem = new HexGridSystem();
  const cityManager = new CityManager();
  const city = new City({
    id: 'city_energy',
    name: 'Energia',
    ownerId: NATION_ID,
    tileX: 4,
    tileY: 4,
  });
  city.population = population;
  city.ownedTileCoords = tiles.flat().map((tile) => ({ x: tile.x, y: tile.y }));
  cityManager.addCity(city);

  const turnManager = new TurnManager(nationManager);
  const happinessSystem = new HappinessSystem(nationManager, cityManager);
  const resourceSystem = new ResourceSystem(
    nationManager,
    cityManager,
    turnManager,
    new TileResourceGenerator(),
    mapData,
    gridSystem,
    happinessSystem,
  );
  const resourceAccessSystem = new ResourceAccessSystem(mapData, { getAllDeals: () => [] });
  const powerPlantSystem = new PowerPlantSystem(cityManager, resourceAccessSystem, mapData, 1);
  const logs: string[] = [];
  resourceSystem.setCityEnergyProvider(
    powerPlantSystem,
    (_nationId, message) => logs.push(message),
  );
  resourceSystem.recalculateForNation(NATION_ID);
  turnManager.start();

  const advanceOwnerTurns = (turns: number): void => {
    for (let index = 0; index < turns; index += 1) turnManager.endCurrentTurn();
  };

  const addResource = (resourceId: string): void => {
    mapData.tiles[8][8].resourceId = resourceId;
    resourceAccessSystem.invalidateResourceIndex();
  };

  const constructPlant = (buildingId: string): void => {
    const building = getBuildingById(buildingId)!;
    const metadata = POWER_PLANTS.find((plant) => plant.buildingId === buildingId)!;
    addResource(metadata.requiredResourceId);
    cityManager.getBuildings(city.id).add(building);
    powerPlantSystem.restore([{ id: city.id, powerPlantAge: 0 }], turnManager.getCurrentRound());
    powerPlantSystem.refreshAllocation(false);
  };

  return {
    nation,
    nationManager,
    city,
    cityManager,
    mapData,
    gridSystem,
    turnManager,
    happinessSystem,
    resourceSystem,
    resourceAccessSystem,
    powerPlantSystem,
    logs,
    advanceOwnerTurns,
    addResource,
    constructPlant,
  };
}

function primeFoodForGrowth(harness: ReturnType<typeof makeHarness>): void {
  harness.happinessSystem.recalculateNation(NATION_ID);
  const economy = calculateCityEconomy(
    harness.city,
    harness.mapData,
    harness.cityManager.getBuildings(harness.city.id),
    harness.gridSystem,
  );
  const gain = Math.floor(economy.netFood * harness.happinessSystem.getGrowthModifier(NATION_ID));
  assert.ok(gain > 0);
  harness.city.foodStorage = economy.foodToGrow - gain;
}

test('population below capacity grows normally, while population at capacity cannot grow', () => {
  const below = makeHarness(5);
  primeFoodForGrowth(below);
  below.advanceOwnerTurns(1);
  assert.equal(below.city.population, 6);
  assert.equal(below.city.energyShortageTurns, undefined);

  const capped = makeHarness(6);
  primeFoodForGrowth(capped);
  capped.advanceOwnerTurns(1);
  assert.equal(capped.city.population, 6);
  assert.equal(capped.city.foodStorage, 0);
  assert.equal(capped.city.energyShortageTurns, 1);
  assert.equal(capped.happinessSystem.getNationState(NATION_ID).unhappinessFromEnergyShortages, 1);
});

test('no plant, every active plant, and an inactive plant provide canonical capacities', () => {
  const unpowered = makeHarness();
  assert.equal(unpowered.powerPlantSystem.getCityPopulationCapacity(unpowered.city.id), 6);

  for (const metadata of POWER_PLANTS) {
    const active = makeHarness();
    active.constructPlant(metadata.buildingId);
    assert.equal(
      active.powerPlantSystem.getCityPopulationCapacity(active.city.id),
      metadata.futurePopulationCap,
      metadata.buildingId,
    );
  }

  const inactive = makeHarness();
  inactive.constructPlant('coal_power_plant');
  inactive.mapData.tiles[8][8].resourceId = undefined;
  inactive.resourceAccessSystem.invalidateResourceIndex();
  assert.equal(inactive.powerPlantSystem.getCityPopulationCapacity(inactive.city.id), 6);
});

test('capacity infrastructure follows the complete non-stacking hierarchy', () => {
  const h = makeHarness();
  assert.equal(h.powerPlantSystem.getCityPopulationCapacity(h.city.id), 6);
  h.cityManager.getBuildings(h.city.id).add(SEWERS);
  assert.equal(h.powerPlantSystem.getCityPopulationCapacity(h.city.id), 8);
  h.cityManager.getBuildings(h.city.id).add(AQUEDUCT);
  assert.equal(h.powerPlantSystem.getCityPopulationCapacity(h.city.id), 10);

  const expected = new Map([
    ['coal_power_plant', 16],
    ['oil_power_plant', 20],
    ['gas_power_plant', 24],
    ['nuclear_plant', 48],
  ]);
  for (const [buildingId, capacity] of expected) {
    const withPlant = makeHarness();
    withPlant.cityManager.getBuildings(withPlant.city.id).add(SEWERS);
    withPlant.cityManager.getBuildings(withPlant.city.id).add(AQUEDUCT);
    withPlant.constructPlant(buildingId);
    assert.equal(withPlant.powerPlantSystem.getCityPopulationCapacity(withPlant.city.id), capacity);
  }
});

test('every capacity building describes its canonical population support', () => {
  const expected = new Map([
    ['sewers', 8],
    ['aqueduct', 10],
    ['coal_power_plant', 16],
    ['oil_power_plant', 20],
    ['gas_power_plant', 24],
    ['nuclear_plant', 48],
  ]);
  for (const [buildingId, capacity] of expected) {
    assert.match(getBuildingById(buildingId)!.description, new RegExp(`Population Capacity: ${capacity}\\b`));
  }
});

test('energy shortage has five grace turns and then declines every five turns', () => {
  const h = makeHarness(15);
  h.advanceOwnerTurns(1);
  assert.equal(h.city.energyShortageTurns, 1);
  assert.equal(h.city.population, 15);
  assert.equal(h.logs.filter((line) => line.includes('shortage began')).length, 1);

  h.advanceOwnerTurns(4);
  assert.equal(h.city.energyShortageTurns, 5);
  assert.equal(h.city.population, 15);
  h.advanceOwnerTurns(5);
  assert.equal(h.city.population, 14);
  h.advanceOwnerTurns(5);
  assert.equal(h.city.population, 13);
  assert.equal(h.logs.filter((line) => line.includes('lost 1 population')).length, 2);
});

test('sufficient capacity resolves shortage immediately', () => {
  const h = makeHarness(15);
  h.advanceOwnerTurns(4);
  assert.equal(h.city.energyShortageTurns, 4);
  h.constructPlant('coal_power_plant');
  h.advanceOwnerTurns(1);
  assert.equal(h.city.energyShortageTurns, undefined);
  assert.equal(h.city.population, 15);
  assert.equal(h.happinessSystem.getNationState(NATION_ID).unhappinessFromEnergyShortages, 0);
  assert.equal(h.logs.filter((line) => line.includes('shortage resolved')).length, 1);
});

test('partial capacity recovery preserves the existing shortage countdown', () => {
  const h = makeHarness(30);
  h.advanceOwnerTurns(6);
  assert.equal(h.city.energyShortageTurns, 6);
  h.constructPlant('oil_power_plant');
  h.advanceOwnerTurns(4);
  assert.equal(h.city.energyShortageTurns, 10);
  assert.equal(h.city.population, 29);
});

test('production multipliers are applied exactly once and disappear immediately when inactive', () => {
  const noPlant = makeHarness(4);
  const noPlantBase = calculateCityEconomy(
    noPlant.city,
    noPlant.mapData,
    noPlant.cityManager.getBuildings(noPlant.city.id),
    noPlant.gridSystem,
  ).production;
  noPlant.resourceSystem.recalculateForNation(NATION_ID);
  assert.equal(noPlant.cityManager.getResources(noPlant.city.id).productionPerTurn, noPlantBase);

  for (const metadata of POWER_PLANTS) {
    const active = makeHarness(4);
    active.constructPlant(metadata.buildingId);
    active.resourceSystem.recalculateForNation(NATION_ID);
    const normalProduction = calculateCityEconomy(
      active.city,
      active.mapData,
      active.cityManager.getBuildings(active.city.id),
      active.gridSystem,
    ).production;
    assert.equal(
      active.cityManager.getResources(active.city.id).productionPerTurn,
      normalProduction * metadata.futureProductionMultiplier,
      metadata.buildingId,
    );
  }

  const inactive = makeHarness(4);
  inactive.constructPlant('coal_power_plant');
  inactive.resourceSystem.recalculateForNation(NATION_ID);
  const normalCoalProduction = calculateCityEconomy(
    inactive.city,
    inactive.mapData,
    inactive.cityManager.getBuildings(inactive.city.id),
    inactive.gridSystem,
  ).production;
  assert.equal(inactive.cityManager.getResources(inactive.city.id).productionPerTurn, normalCoalProduction * 2);
  inactive.mapData.tiles[8][8].resourceId = undefined;
  inactive.resourceAccessSystem.invalidateResourceIndex();
  inactive.resourceSystem.recalculateForNation(NATION_ID);
  const inactiveNormalProduction = calculateCityEconomy(
    inactive.city,
    inactive.mapData,
    inactive.cityManager.getBuildings(inactive.city.id),
    inactive.gridSystem,
  ).production;
  assert.equal(inactive.cityManager.getResources(inactive.city.id).productionPerTurn, inactiveNormalProduction);
});

test('Nuclear Plant keeps its legacy bonuses but receives only one energy multiplier', () => {
  const h = makeHarness(4);
  h.constructPlant('nuclear_plant');
  h.resourceSystem.recalculateForNation(NATION_ID);
  const productionWithLegacyBonuses = calculateCityEconomy(
    h.city,
    h.mapData,
    h.cityManager.getBuildings(h.city.id),
    h.gridSystem,
  ).production;
  assert.equal(
    h.cityManager.getResources(h.city.id).productionPerTurn,
    productionWithLegacyBonuses * 6,
  );
});

test('energy shortage countdown survives the real city save/load path', () => {
  const original = makeHarness(15);
  original.city.energyShortageTurns = 9;
  const productionSystem = new ProductionSystem(
    original.cityManager,
    original.turnManager,
    original.happinessSystem,
  );
  const saved = SaveLoadService.serialize({
    mapKey: 'energy-test',
    humanNationId: NATION_ID,
    activeNationIds: [NATION_ID],
    gameSpeedId: 'standard',
    mapData: original.mapData,
    nationManager: original.nationManager,
    cityManager: original.cityManager,
    unitManager: { getAllUnits: () => [] },
    productionSystem,
    policySystem: { getActivePolicyAssignments: () => [] },
    diplomacyManager: { getAllStates: () => [], getPendingPeaceProposals: () => [] },
    discoverySystem: { getAllMetPairs: () => [] },
    turnManager: original.turnManager,
    gridSystem: original.gridSystem,
    wonderSystem: { getCompletedWonders: () => [] },
  } as unknown as SaveLoadContext);
  assert.equal(saved.cities[0].energyShortageTurns, 9);

  const restoredNationManager = new NationManager();
  restoredNationManager.addNation(new Nation({ id: NATION_ID, name: 'Energy Test', color: 0x123456 }));
  const restoredCityManager = new CityManager();
  const restoredTurnManager = new TurnManager(restoredNationManager);
  const restoredHappiness = new HappinessSystem(restoredNationManager, restoredCityManager);
  const restoredProduction = new ProductionSystem(restoredCityManager, restoredTurnManager, restoredHappiness);
  const applyCitiesAndProduction = (SaveLoadService as unknown as {
    applyCitiesAndProduction: (
      cities: SavedCity[],
      cityManager: CityManager,
      productionSystem: ProductionSystem,
      mapData: MapData,
      gridSystem: HexGridSystem,
      gameSpeedId: 'standard',
    ) => void;
  }).applyCitiesAndProduction;
  applyCitiesAndProduction(
    saved.cities,
    restoredCityManager,
    restoredProduction,
    original.mapData,
    original.gridSystem,
    'standard',
  );

  const restoredCity = restoredCityManager.getCity(original.city.id)!;
  // Derived capacity is not migrated into the save and loading never clamps
  // an existing city's population, even when it is already above capacity.
  assert.equal(restoredCity.population, 15);
  assert.equal(restoredCity.energyShortageTurns, 9);
  const restoredAccess = new ResourceAccessSystem(original.mapData, { getAllDeals: () => [] });
  const restoredPower = new PowerPlantSystem(restoredCityManager, restoredAccess, original.mapData, 1);
  const restoredResources = new ResourceSystem(
    restoredNationManager,
    restoredCityManager,
    restoredTurnManager,
    new TileResourceGenerator(),
    original.mapData,
    original.gridSystem,
    restoredHappiness,
  );
  restoredResources.setCityEnergyProvider(restoredPower);
  restoredTurnManager.start();
  restoredTurnManager.endCurrentTurn();
  assert.equal(restoredCity.population, 14);
  assert.equal(restoredCity.energyShortageTurns, 10);
});
