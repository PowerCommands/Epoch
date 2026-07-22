/** Focused deterministic tests for conquest occupation and city integration. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BANK, MARKET } from '../src/data/buildings.ts';
import { ALL_WONDERS } from '../src/data/wonders.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { calculateCityEconomy } from '../src/systems/CityEconomy.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import {
  CITY_OCCUPATION_GOLD_COST_PER_TURN,
  CITY_OCCUPIED_TURNS,
  CITY_RECOVERING_TURNS,
  CityIntegrationSystem,
  getCityIntegrationOutputMultiplier,
  getCityIntegrationProgress,
  getNationOccupationGoldCost,
} from '../src/systems/CityIntegrationSystem.ts';
import { countActiveBanksForNation } from '../src/systems/CurrencySystem.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { ResearchSystem } from '../src/systems/ResearchSystem.ts';
import { TileResourceGenerator } from '../src/systems/ResourceGenerator.ts';
import { ResourceSystem } from '../src/systems/ResourceSystem.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { WonderSystem } from '../src/systems/WonderSystem.ts';
import { getOwnedWonderCount } from '../src/systems/CulturalVictory.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { TileType, type MapData } from '../src/types/map.ts';
import { EMPTY_MODIFIERS } from '../src/types/modifiers.ts';

const ORIGINAL_ID = 'nation_england';
const OCCUPIER_ID = 'nation_france';
const SECOND_OCCUPIER_ID = 'nation_hre';

function makeHarness() {
  const nationManager = new NationManager();
  // Occupier first keeps treasury-turn tests compact.
  nationManager.addNation(new Nation({ id: OCCUPIER_ID, name: 'France', color: 0x002395 }));
  nationManager.addNation(new Nation({ id: ORIGINAL_ID, name: 'England', color: 0xc8102e }));
  nationManager.addNation(new Nation({ id: SECOND_OCCUPIER_ID, name: 'HRE', color: 0xffd700 }));

  const mapData: MapData = {
    width: 3,
    height: 1,
    tileSize: 32,
    tiles: [[0, 1, 2].map((x) => ({
      x,
      y: 0,
      type: TileType.Plains,
      ownerId: ORIGINAL_ID,
    }))],
  };
  const gridSystem = new HexGridSystem();
  const cityManager = new CityManager();
  const city = new City({
    id: 'city_london',
    name: 'London',
    ownerId: ORIGINAL_ID,
    originNationId: ORIGINAL_ID,
    tileX: 1,
    tileY: 0,
    isCapital: true,
  });
  city.population = 4;
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
  const productionSystem = new ProductionSystem(cityManager, turnManager, happinessSystem);
  const logs: string[] = [];
  const integrationSystem = new CityIntegrationSystem(
    cityManager,
    turnManager,
    (_nationId, message) => logs.push(message),
    (changedCity) => resourceSystem.recalculateForNation(changedCity.ownerId),
  );
  const researchSystem = new ResearchSystem(
    nationManager,
    cityManager,
    () => turnManager.getCurrentRound(),
    (nationId) => cityManager.getCitiesByOwner(nationId).reduce((sum, ownedCity) => (
      sum + Math.round(calculateCityEconomy(
        ownedCity,
        mapData,
        cityManager.getBuildings(ownedCity.id),
        gridSystem,
        EMPTY_MODIFIERS,
      ).science * getCityIntegrationOutputMultiplier(ownedCity, turnManager.getCurrentRound()))
    ), 0),
    undefined,
    undefined,
    undefined,
    (ownedCity) => getCityIntegrationOutputMultiplier(ownedCity, turnManager.getCurrentRound()),
  );

  const conquer = (newOwnerId: string) => {
    const previousOwnerId = city.ownerId;
    cityManager.transferOwnership(city.id, newOwnerId, productionSystem);
    return integrationSystem.handleConquest(city, previousOwnerId, newOwnerId);
  };
  const moveToRound = (round: number) => {
    turnManager.restoreTurnState(round, 0);
    integrationSystem.handleRoundStart(round);
    resourceSystem.recalculateForNation(city.ownerId);
  };

  return {
    nationManager,
    cityManager,
    city,
    mapData,
    gridSystem,
    turnManager,
    happinessSystem,
    resourceSystem,
    productionSystem,
    integrationSystem,
    researchSystem,
    logs,
    conquer,
    moveToRound,
  };
}

test('newly created and scenario-start cities begin Integrated with permanent original identity', () => {
  const fresh = new City({ id: 'fresh', name: 'Fresh', ownerId: ORIGINAL_ID, tileX: 0, tileY: 0 });
  assert.equal(fresh.originNationId, ORIGINAL_ID);
  assert.equal(getCityIntegrationProgress(fresh, 1).state, 'integrated');

  const mapData: MapData = {
    width: 1, height: 1, tileSize: 32,
    tiles: [[{ x: 0, y: 0, type: TileType.Plains, ownerId: ORIGINAL_ID }]],
  };
  const scenario = CityManager.loadFromScenario([{
    id: 'scenario_city', name: 'London', nationId: ORIGINAL_ID, q: 0, r: 0, isCapital: true,
  }], mapData).getCity('scenario_city')!;
  assert.equal(scenario.originNationId, ORIGINAL_ID);
  assert.equal(getCityIntegrationProgress(scenario, 1).state, 'integrated');
});

test('foreign conquest starts 25 Occupied turns with zero output and exact maintenance', () => {
  const h = makeHarness();
  const raw = calculateCityEconomy(h.city, h.mapData, h.cityManager.getBuildings(h.city.id), h.gridSystem);
  assert.equal(h.conquer(OCCUPIER_ID), 'occupied');
  const progress = getCityIntegrationProgress(h.city, 1);
  assert.equal(progress.state, 'occupied');
  assert.equal(progress.outputMultiplier, 0);
  assert.equal(progress.occupationGoldCostPerTurn, 100);
  h.resourceSystem.recalculateForNation(OCCUPIER_ID);
  const output = h.cityManager.getResources(h.city.id);
  assert.ok(raw.gold > 0 && raw.production > 0 && raw.science > 0 && raw.culture > 0);
  assert.deepEqual(
    [output.goldPerTurn, output.productionPerTurn, output.sciencePerTurn, output.culturePerTurn],
    [0, 0, 0, 0],
  );
  assert.equal(h.nationManager.getResources(OCCUPIER_ID).goldPerTurn, -100);
});

test('occupation maintenance changes the real treasury and stacks per city', () => {
  const h = makeHarness();
  h.conquer(OCCUPIER_ID);
  const second = new City({
    id: 'city_york', name: 'York', ownerId: OCCUPIER_ID, originNationId: ORIGINAL_ID, tileX: 2, tileY: 0,
  });
  second.integrationStartedRound = 1;
  h.cityManager.addCity(second);
  assert.equal(getNationOccupationGoldCost(OCCUPIER_ID, h.cityManager, 1), 200);
  h.cityManager.transferOwnership(second.id, ORIGINAL_ID);
  h.nationManager.getResources(OCCUPIER_ID).gold = 1_000;
  h.turnManager.start(); // synthetic first start is skipped by ResourceSystem
  h.turnManager.endCurrentTurn();
  h.turnManager.endCurrentTurn();
  h.turnManager.endCurrentTurn(); // next France turn applies city economy
  assert.equal(h.nationManager.getResources(OCCUPIER_ID).gold, 900);
});

test('elapsed turns 0-24 are Occupied, 25-49 Recovering, and 50+ Integrated', () => {
  const h = makeHarness();
  h.conquer(OCCUPIER_ID); // round 1
  assert.equal(getCityIntegrationProgress(h.city, 25).state, 'occupied');
  assert.equal(getCityIntegrationProgress(h.city, 26).state, 'recovering');
  assert.equal(getCityIntegrationProgress(h.city, 50).state, 'recovering');
  assert.equal(getCityIntegrationProgress(h.city, 51).state, 'integrated');
  assert.equal(CITY_OCCUPIED_TURNS, 25);
  assert.equal(CITY_RECOVERING_TURNS, 25);
});

test('Recovering restores exactly 50% Gold, Production, Science, and Culture with no maintenance', () => {
  const h = makeHarness();
  const raw = calculateCityEconomy(h.city, h.mapData, h.cityManager.getBuildings(h.city.id), h.gridSystem);
  h.conquer(OCCUPIER_ID);
  h.moveToRound(26);
  const output = h.cityManager.getResources(h.city.id);
  assert.equal(getCityIntegrationProgress(h.city, 26).state, 'recovering');
  assert.deepEqual(
    [output.goldPerTurn, output.productionPerTurn, output.sciencePerTurn, output.culturePerTurn],
    [raw.gold, raw.production, raw.science, raw.culture].map((value) => Math.round(value * 0.5)),
  );
  assert.equal(getNationOccupationGoldCost(OCCUPIER_ID, h.cityManager, 26), 0);
});

test('Integrated restores 100% output after 50 completed turns', () => {
  const h = makeHarness();
  const raw = calculateCityEconomy(h.city, h.mapData, h.cityManager.getBuildings(h.city.id), h.gridSystem);
  h.conquer(OCCUPIER_ID);
  h.moveToRound(51);
  const output = h.cityManager.getResources(h.city.id);
  assert.equal(getCityIntegrationProgress(h.city, 51).state, 'integrated');
  assert.deepEqual(
    [output.goldPerTurn, output.productionPerTurn, output.sciencePerTurn, output.culturePerTurn],
    [raw.gold, raw.production, raw.science, raw.culture],
  );
});

test('Occupied production queues do not advance; Recovering queues advance at half city output', () => {
  const h = makeHarness();
  h.conquer(OCCUPIER_ID);
  h.productionSystem.enqueue(h.city.id, { kind: 'building', buildingType: MARKET });
  h.productionSystem.markInitialTurnStartSkipped();
  h.turnManager.start();
  assert.equal(h.productionSystem.getQueue(h.city.id)[0].progress, 0);
  assert.equal(h.productionSystem.getBuyCost(h.city.id, 0), null);
  assert.deepEqual(h.productionSystem.completeQueueEntry(h.city.id, 0), {
    ok: false,
    reason: 'Occupied cities cannot buy production',
  });

  h.moveToRound(26);
  const halfProduction = h.cityManager.getResources(h.city.id).productionPerTurn;
  assert.notEqual(h.productionSystem.getBuyCost(h.city.id, 0), null);
  h.turnManager.start();
  assert.equal(h.productionSystem.getQueue(h.city.id)[0].progress, halfProduction);
});

test('Research uses zero, half, and full city Science contributions by integration state', () => {
  const h = makeHarness();
  const integrated = h.researchSystem.getResearchPerTurn(ORIGINAL_ID) - 1;
  h.conquer(OCCUPIER_ID);
  assert.equal(h.researchSystem.getResearchPerTurn(OCCUPIER_ID) - 1, 0);
  h.moveToRound(26);
  const recovering = h.researchSystem.getResearchPerTurn(OCCUPIER_ID) - 1;
  assert.ok(recovering > 0 && recovering < integrated + 1);
  h.moveToRound(51);
  assert.equal(h.researchSystem.getResearchPerTurn(OCCUPIER_ID) - 1, integrated);
});

test('foreign reconquest resets both Occupied and Recovering cities to turn zero', () => {
  const h = makeHarness();
  h.conquer(OCCUPIER_ID);
  h.moveToRound(19);
  assert.equal(h.conquer(SECOND_OCCUPIER_ID), 'occupied');
  assert.equal(getCityIntegrationProgress(h.city, 19).turnsInState, 0);

  h.moveToRound(44);
  assert.equal(getCityIntegrationProgress(h.city, 44).state, 'recovering');
  assert.equal(h.conquer(OCCUPIER_ID), 'occupied');
  assert.equal(getCityIntegrationProgress(h.city, 44).turnsInState, 0);
  assert.ok(h.logs.some((line) => line.includes('occupation reset')));
});

test('the original nation liberates its city immediately without cost or identity mutation', () => {
  const h = makeHarness();
  h.conquer(OCCUPIER_ID);
  h.moveToRound(19);
  assert.equal(h.conquer(ORIGINAL_ID), 'integrated');
  assert.equal(h.city.originNationId, ORIGINAL_ID);
  assert.equal(h.city.integrationStartedRound, undefined);
  assert.equal(getNationOccupationGoldCost(ORIGINAL_ID, h.cityManager, 19), 0);
  assert.ok(h.logs.some((line) => line.includes('liberated by original nation')));
});

test('original nation identity never changes through repeated ownership transfers', () => {
  const h = makeHarness();
  for (const ownerId of [OCCUPIER_ID, SECOND_OCCUPIER_ID, ORIGINAL_ID, OCCUPIER_ID]) {
    h.conquer(ownerId);
    assert.equal(h.city.originNationId, ORIGINAL_ID);
  }
});

test('Occupied Banks are excluded, Recovering Banks count, and broken Banks never count', () => {
  const h = makeHarness();
  h.cityManager.getBuildings(h.city.id).add(BANK);
  h.conquer(OCCUPIER_ID);
  assert.equal(countActiveBanksForNation(OCCUPIER_ID, h.cityManager, 1), 0);
  assert.equal(countActiveBanksForNation(OCCUPIER_ID, h.cityManager, 26), 1);
  h.cityManager.getBuildings(h.city.id).setBroken(BANK.id, true);
  assert.equal(countActiveBanksForNation(OCCUPIER_ID, h.cityManager, 26), 0);
});

test('World Wonders count for the current owner immediately during occupation', () => {
  const h = makeHarness();
  const wonderSystem = new WonderSystem();
  assert.equal(wonderSystem.completeWonder(h.city, ALL_WONDERS[0], 1), true);
  h.conquer(OCCUPIER_ID);
  assert.equal(getCityIntegrationProgress(h.city, 1).state, 'occupied');
  assert.equal(getOwnedWonderCount(OCCUPIER_ID, wonderSystem, h.cityManager), 1);
  assert.equal(getOwnedWonderCount(ORIGINAL_ID, wonderSystem, h.cityManager), 0);
});

test('restore preserves Occupied and Recovering progress plus original nation identity', () => {
  const h = makeHarness();
  h.conquer(OCCUPIER_ID);
  const saved = JSON.parse(JSON.stringify({
    ownerId: h.city.ownerId,
    originNationId: h.city.originNationId,
    integrationStartedRound: h.city.integrationStartedRound,
  })) as { ownerId: string; originNationId: string; integrationStartedRound: number };
  const restoredManager = new CityManager();
  const restored = restoredManager.restoreCity({
    id: 'restored', name: 'London', ownerId: saved.ownerId, originNationId: saved.originNationId,
    tileX: 0, tileY: 0, isCapital: true, isOriginalCapital: true, isResidenceCapital: false,
    health: 100, population: 4, foodStorage: 0, culture: 0, lastTurnAttacked: null,
    integrationStartedRound: saved.integrationStartedRound,
  });
  assert.equal(getCityIntegrationProgress(restored, 10).state, 'occupied');
  assert.equal(getCityIntegrationProgress(restored, 26).state, 'recovering');
  assert.equal(restored.originNationId, ORIGINAL_ID);
  assert.equal(restored.integrationStartedRound, 1);
});

test('transition logging occurs only when entering Recovering and Integrated', () => {
  const h = makeHarness();
  h.conquer(OCCUPIER_ID);
  h.moveToRound(26);
  h.moveToRound(27);
  h.moveToRound(51);
  assert.equal(h.logs.filter((line) => line.includes('entered Recovering')).length, 1);
  assert.equal(h.logs.filter((line) => line.includes('integrated into')).length, 1);
  assert.equal(CITY_OCCUPATION_GOLD_COST_PER_TURN, 100);
});
