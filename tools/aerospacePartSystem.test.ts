/**
 * Focused tests for deliberate Aerospace Part manufacturing.
 * Run with: npx tsx --test tools/aerospacePartSystem.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AEROSPACE_PART_BASE_PRODUCTION_COST,
  AEROSPACE_PART_COST_GROWTH_RATE,
  AEROSPACE_INDUSTRIES_ID,
  AEROSPACE_PART_PRODUCTION,
  AEROSPACE_PARTS_ID,
  DEFAULT_REQUIRED_AEROSPACE_PARTS,
  SCIENCE_VICTORY_TECH_ID,
  calculateAerospacePartProductionCost,
} from '../src/data/scienceVictory.ts';
import { FACTORY } from '../src/data/buildings.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { AerospacePartSystem } from '../src/systems/AerospacePartSystem.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { CorporationSystem } from '../src/systems/CorporationSystem.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { ResearchSystem } from '../src/systems/ResearchSystem.ts';
import { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { VictorySystem } from '../src/systems/VictorySystem.ts';
import { getAIAerospacePartProductionCandidate } from '../src/systems/ai/AIAerospacePartProduction.ts';
import { TileType, type MapData } from '../src/types/map.ts';

const OWNER_ID = 'nation_owner';
const RIVAL_ID = 'nation_rival';

function makeHarness() {
  const nationManager = new NationManager();
  const owner = new Nation({
    id: OWNER_ID,
    name: 'Founder',
    color: 0x111111,
    isHuman: true,
    researchedTechIds: [SCIENCE_VICTORY_TECH_ID],
  });
  const rival = new Nation({
    id: RIVAL_ID,
    name: 'Rival',
    color: 0x222222,
    researchedTechIds: [SCIENCE_VICTORY_TECH_ID],
  });
  nationManager.addNation(owner);
  nationManager.addNation(rival);

  const cityManager = new CityManager();
  const ownerCity = new City({
    id: 'owner_city', name: 'Founder City', ownerId: OWNER_ID, tileX: 0, tileY: 0, isCapital: true,
  });
  const rivalCity = new City({
    id: 'rival_city', name: 'Rival City', ownerId: RIVAL_ID, tileX: 1, tileY: 0, isCapital: true,
  });
  cityManager.addCity(ownerCity);
  cityManager.addCity(rivalCity);
  cityManager.getBuildings(ownerCity.id).add(FACTORY);
  cityManager.getBuildings(rivalCity.id).add(FACTORY);
  cityManager.getResources(ownerCity.id).productionPerTurn = 20;
  cityManager.getResources(rivalCity.id).productionPerTurn = 20;

  const mapData: MapData = {
    width: 2,
    height: 1,
    tileSize: 32,
    tiles: [[
      { x: 0, y: 0, type: TileType.Plains, ownerId: OWNER_ID, resourceId: 'aluminum' },
      { x: 1, y: 0, type: TileType.Plains, ownerId: RIVAL_ID, resourceId: 'aluminum' },
    ]],
  };
  const turnManager = new TurnManager(nationManager);
  const happinessSystem = new HappinessSystem(nationManager, cityManager);
  const productionSystem = new ProductionSystem(cityManager, turnManager, happinessSystem);
  const researchSystem = new ResearchSystem(nationManager, cityManager, () => turnManager.getCurrentRound());
  const resourceAccessSystem = new ResourceAccessSystem(mapData, { getAllDeals: () => [] });
  const corporationSystem = new CorporationSystem(nationManager, cityManager, {
    researchSystem,
    resourceAccessSystem,
  });
  const aerospacePartSystem = new AerospacePartSystem(
    cityManager,
    researchSystem,
    resourceAccessSystem,
    corporationSystem,
    productionSystem,
  );
  resourceAccessSystem.setManufacturedResourceProvider((nationId) => {
    const result = new Map(corporationSystem.getNationManufacturedResources(nationId));
    for (const [resourceId, quantity] of aerospacePartSystem.getManufacturedResources(nationId)) {
      result.set(resourceId, quantity);
    }
    return result;
  });
  productionSystem.setItemProductionPercentProvider((nationId, item) => (
    item.kind === 'manufacturedResource' && item.productionType.id === AEROSPACE_PARTS_ID
      ? aerospacePartSystem.getProductionBonusPercent(nationId)
      : 0
  ));
  productionSystem.setItemProductionCostProvider((cityId, item, baseCost) => {
    if (item.kind !== 'manufacturedResource' || item.productionType.id !== AEROSPACE_PARTS_ID) {
      return baseCost;
    }
    const city = cityManager.getCity(cityId);
    return city
      ? { cost: aerospacePartSystem.getProductionCost(city.ownerId), lock: true }
      : baseCost;
  });
  productionSystem.onCompleted((cityId, item) => {
    if (item.kind !== 'manufacturedResource') return;
    const city = cityManager.getCity(cityId);
    return city !== undefined && aerospacePartSystem.completeProduction(city) !== null;
  });
  const victorySystem = new VictorySystem(
    cityManager,
    nationManager,
    turnManager,
    resourceAccessSystem,
    {
      science: { enabled: true },
      domination: { enabled: false },
      cultural: { enabled: false },
      diplomatic: { enabled: false },
    },
    undefined,
    researchSystem,
    corporationSystem,
  );

  const foundAerospaceIndustries = () => (
    corporationSystem.foundCorporation(OWNER_ID, AEROSPACE_INDUSTRIES_ID, ownerCity.id)
  );
  const completePart = (city: City) => {
    productionSystem.setProduction(city.id, {
      kind: 'manufacturedResource',
      productionType: AEROSPACE_PART_PRODUCTION,
    });
    return productionSystem.completeCurrentProduction(city.id);
  };
  const addOwnerCity = (id: string) => {
    const city = new City({
      id,
      name: id,
      ownerId: OWNER_ID,
      tileX: 0,
      tileY: 0,
    });
    cityManager.addCity(city);
    cityManager.getBuildings(city.id).add(FACTORY);
    cityManager.getResources(city.id).productionPerTurn = 20;
    return city;
  };

  return {
    owner,
    rival,
    ownerCity,
    rivalCity,
    mapData,
    cityManager,
    corporationSystem,
    aerospacePartSystem,
    productionSystem,
    resourceAccessSystem,
    turnManager,
    victorySystem,
    foundAerospaceIndustries,
    completePart,
    addOwnerCity,
  };
}

test('Factories alone do not count as Aerospace Parts', () => {
  const harness = makeHarness();
  assert.equal(harness.victorySystem.getScienceVictorySettings().requiredAerospaceParts, DEFAULT_REQUIRED_AEROSPACE_PARTS);
  assert.equal(harness.resourceAccessSystem.getManufacturedResourceSourceCount(OWNER_ID, AEROSPACE_PARTS_ID), 0);
  assert.equal(harness.resourceAccessSystem.getManufacturedResourceSourceCount(RIVAL_ID, AEROSPACE_PARTS_ID), 0);
});

test('Aerospace Parts cannot be manufactured before global corporation unlock', () => {
  const harness = makeHarness();
  assert.equal(harness.aerospacePartSystem.canCityProduce(harness.ownerCity), false);
  assert.match(harness.aerospacePartSystem.getCityProductionBlockers(harness.ownerCity)[0], /not been founded/);
});

test('founding AeroSpace Industries globally unlocks part production', () => {
  const harness = makeHarness();
  assert.equal(harness.foundAerospaceIndustries(), true);
  assert.equal(harness.aerospacePartSystem.isGloballyUnlocked(), true);
  assert.equal(harness.aerospacePartSystem.canCityProduce(harness.ownerCity), true);
});

test('Rocketry, Aluminum, and a Factory let a non-owner manufacture Aerospace Parts after unlock', () => {
  const harness = makeHarness();
  harness.foundAerospaceIndustries();
  assert.equal(harness.aerospacePartSystem.canCityProduce(harness.rivalCity), true);
  assert.equal(harness.completePart(harness.rivalCity).kind, 'completed');
  assert.equal(harness.aerospacePartSystem.getQuantity(RIVAL_ID), 1);
});

test('Flight alone does not allow Aerospace Part production after global unlock', () => {
  const harness = makeHarness();
  harness.foundAerospaceIndustries();
  harness.rival.researchedTechIds = ['flight'];
  assert.equal(harness.aerospacePartSystem.canCityProduce(harness.rivalCity), false);
  assert.ok(harness.aerospacePartSystem.getCityProductionBlockers(harness.rivalCity)
    .includes(`missing technology: ${SCIENCE_VICTORY_TECH_ID}`));
});

test('missing Aluminum prevents Aerospace Part production', () => {
  const harness = makeHarness();
  harness.foundAerospaceIndustries();
  harness.mapData.tiles[0][1].resourceId = undefined;
  assert.equal(harness.aerospacePartSystem.canCityProduce(harness.rivalCity), false);
  assert.ok(harness.aerospacePartSystem.getCityProductionBlockers(harness.rivalCity).includes('missing resource: aluminum'));
});

test('missing active Factory prevents Aerospace Part production', () => {
  const harness = makeHarness();
  harness.foundAerospaceIndustries();
  harness.cityManager.getBuildings(harness.rivalCity.id).setBroken(FACTORY.id, true);
  assert.equal(harness.aerospacePartSystem.canCityProduce(harness.rivalCity), false);
  assert.ok(harness.aerospacePartSystem.getCityProductionBlockers(harness.rivalCity)
    .includes('city missing active building: factory'));
});

test('AeroSpace Industries owner receives exactly +50% part Production', () => {
  const harness = makeHarness();
  harness.foundAerospaceIndustries();
  const item = { kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION } as const;
  assert.equal(harness.aerospacePartSystem.getProductionBonusPercent(OWNER_ID), 50);
  assert.equal(harness.productionSystem.getTurnsEstimate(harness.ownerCity.id, item), 40);
});

test('non-owner receives no Aerospace Part Production bonus', () => {
  const harness = makeHarness();
  harness.foundAerospaceIndustries();
  const item = { kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION } as const;
  assert.equal(harness.aerospacePartSystem.getProductionBonusPercent(RIVAL_ID), 0);
  assert.equal(harness.productionSystem.getTurnsEstimate(harness.rivalCity.id, item), 60);
});

test('first Aerospace Part uses the configured 1200 base production cost', () => {
  const harness = makeHarness();
  assert.equal(AEROSPACE_PART_BASE_PRODUCTION_COST, 1200);
  assert.equal(harness.aerospacePartSystem.getProductionCost(OWNER_ID), 1200);
  harness.productionSystem.setProduction(harness.ownerCity.id, {
    kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION,
  });
  assert.equal(harness.productionSystem.getQueue(harness.ownerCity.id)[0]?.lockedProductionCost, 1200);
});

test('a simultaneous second Aerospace Part receives the Part #2 cost', () => {
  const harness = makeHarness();
  const secondCity = harness.addOwnerCity('owner_city_2');
  harness.productionSystem.setProduction(harness.ownerCity.id, {
    kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION,
  });
  harness.productionSystem.setProduction(secondCity.id, {
    kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION,
  });
  assert.equal(AEROSPACE_PART_COST_GROWTH_RATE, 0.10);
  assert.equal(harness.productionSystem.getQueue(secondCity.id)[0]?.lockedProductionCost, 1320);
});

test('additional simultaneous Aerospace Parts continue through the escalating sequence', () => {
  const harness = makeHarness();
  const cities = [
    harness.ownerCity,
    harness.addOwnerCity('owner_city_2'),
    harness.addOwnerCity('owner_city_3'),
    harness.addOwnerCity('owner_city_4'),
  ];
  for (const city of cities) {
    harness.productionSystem.setProduction(city.id, {
      kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION,
    });
  }
  assert.deepEqual(
    cities.map((city) => harness.productionSystem.getQueue(city.id)[0]?.lockedProductionCost),
    [1200, 1320, 1452, 1597],
  );
});

test('completed and in-flight Aerospace Parts both determine the next slot', () => {
  const harness = makeHarness();
  harness.aerospacePartSystem.restoreProgress([{ nationId: OWNER_ID, quantity: 2 }]);
  const inFlightCities = [
    harness.ownerCity,
    harness.addOwnerCity('owner_city_2'),
    harness.addOwnerCity('owner_city_3'),
  ];
  for (const city of inFlightCities) {
    harness.productionSystem.setProduction(city.id, {
      kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION,
    });
  }
  const nextCity = harness.addOwnerCity('owner_city_4');
  harness.productionSystem.setProduction(nextCity.id, {
    kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION,
  });
  assert.equal(harness.aerospacePartSystem.getInFlightQuantity(OWNER_ID), 4);
  assert.equal(
    harness.productionSystem.getQueue(nextCity.id)[0]?.lockedProductionCost,
    calculateAerospacePartProductionCost(5),
  );
});

test('an in-flight Aerospace Part retains its cost as other parts start and complete', () => {
  const harness = makeHarness();
  harness.foundAerospaceIndustries();
  const secondCity = harness.addOwnerCity('owner_city_2');
  harness.productionSystem.setProduction(harness.ownerCity.id, {
    kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION,
  });
  const originalCost = harness.productionSystem.getQueue(harness.ownerCity.id)[0]?.cost;

  harness.productionSystem.setProduction(secondCity.id, {
    kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION,
  });
  assert.equal(harness.productionSystem.getQueue(harness.ownerCity.id)[0]?.cost, originalCost);

  assert.equal(harness.productionSystem.completeCurrentProduction(secondCity.id).kind, 'completed');
  assert.equal(harness.productionSystem.getQueue(harness.ownerCity.id)[0]?.cost, originalCost);
});

test('cancelling an in-flight part affects future slots without repricing existing parts', () => {
  const harness = makeHarness();
  const secondCity = harness.addOwnerCity('owner_city_2');
  const thirdCity = harness.addOwnerCity('owner_city_3');
  const replacementCity = harness.addOwnerCity('owner_city_4');
  for (const city of [harness.ownerCity, secondCity, thirdCity]) {
    harness.productionSystem.setProduction(city.id, {
      kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION,
    });
  }
  const firstCost = harness.productionSystem.getQueue(harness.ownerCity.id)[0]?.lockedProductionCost;
  const thirdCost = harness.productionSystem.getQueue(thirdCity.id)[0]?.lockedProductionCost;

  harness.productionSystem.clearProduction(secondCity.id);
  harness.productionSystem.setProduction(replacementCity.id, {
    kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION,
  });

  assert.equal(harness.productionSystem.getQueue(harness.ownerCity.id)[0]?.lockedProductionCost, firstCost);
  assert.equal(harness.productionSystem.getQueue(thirdCity.id)[0]?.lockedProductionCost, thirdCost);
  assert.equal(
    harness.productionSystem.getQueue(replacementCity.id)[0]?.lockedProductionCost,
    calculateAerospacePartProductionCost(2),
  );
});

test('later Aerospace Parts follow the rounded exponential cost formula', () => {
  assert.deepEqual(
    Array.from({ length: 10 }, (_, completedParts) => calculateAerospacePartProductionCost(completedParts)),
    [1200, 1320, 1452, 1597, 1757, 1933, 2126, 2338, 2572, 2830],
  );
});

test('progressive Aerospace Part cost is per nation', () => {
  const harness = makeHarness();
  harness.aerospacePartSystem.restoreProgress([
    { nationId: OWNER_ID, quantity: 7 },
    { nationId: RIVAL_ID, quantity: 2 },
  ]);
  assert.equal(harness.aerospacePartSystem.getProductionCost(OWNER_ID), 2338);
  assert.equal(harness.aerospacePartSystem.getProductionCost(RIVAL_ID), 1452);
});

test('a nation entering the race at zero parts still receives the base cost', () => {
  const harness = makeHarness();
  harness.aerospacePartSystem.restoreProgress([{ nationId: OWNER_ID, quantity: 8 }]);
  assert.equal(harness.aerospacePartSystem.getProductionCost(RIVAL_ID), 1200);
});

test('cost configuration can change growth without changing the algorithm', () => {
  assert.equal(calculateAerospacePartProductionCost(5, {
    baseProductionCost: 1200,
    growthRate: 0.05,
  }), 1532);
  assert.equal(calculateAerospacePartProductionCost(5, {
    baseProductionCost: 1200,
    growthRate: 0.10,
  }), 1933);
});

test('human and AI cities use the same national Aerospace Part cost rule', () => {
  const harness = makeHarness();
  assert.equal(harness.owner.isHuman, true);
  assert.equal(harness.rival.isHuman, false);
  harness.aerospacePartSystem.restoreProgress([
    { nationId: OWNER_ID, quantity: 3 },
    { nationId: RIVAL_ID, quantity: 3 },
  ]);
  const item = { kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION } as const;
  assert.equal(
    harness.productionSystem.getCost(item, harness.ownerCity.id),
    harness.productionSystem.getCost(item, harness.rivalCity.id),
  );
});

test('restored progress deterministically reconstructs next-part and queued costs', () => {
  const source = makeHarness();
  source.aerospacePartSystem.restoreProgress([{ nationId: OWNER_ID, quantity: 6 }]);
  source.productionSystem.setProduction(source.ownerCity.id, {
    kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION,
  });
  const savedProgress = source.aerospacePartSystem.getProgressForSave();
  const savedQueue = source.productionSystem.getProduction(source.ownerCity.id);

  const restored = makeHarness();
  restored.aerospacePartSystem.restoreProgress(savedProgress);
  restored.productionSystem.restoreQueue(restored.ownerCity.id, savedQueue ? [savedQueue] : []);

  assert.equal(restored.aerospacePartSystem.getProductionCost(OWNER_ID), 2338);
  // Standard speed preserves the locked base cost after progression.
  assert.equal(restored.productionSystem.getQueue(restored.ownerCity.id)[0]?.cost, 2126);
});

test('AeroSpace Industries bonus does not affect ordinary city production', () => {
  const harness = makeHarness();
  const factoryItem = { kind: 'building', buildingType: FACTORY } as const;
  const before = harness.productionSystem.getTurnsEstimate(harness.ownerCity.id, factoryItem);
  harness.foundAerospaceIndustries();
  assert.equal(harness.productionSystem.getTurnsEstimate(harness.ownerCity.id, factoryItem), before);
});

test('Science Victory does not trigger at 9 accumulated parts', () => {
  const harness = makeHarness();
  harness.foundAerospaceIndustries();
  harness.aerospacePartSystem.restoreProgress([{ nationId: OWNER_ID, quantity: 9 }]);
  harness.turnManager.start();
  harness.turnManager.endCurrentTurn();
  assert.equal(harness.victorySystem.getVictoryState(), null);
});

test('Science Victory triggers at configured 10 accumulated parts', () => {
  const harness = makeHarness();
  harness.foundAerospaceIndustries();
  harness.aerospacePartSystem.restoreProgress([{ nationId: OWNER_ID, quantity: 9 }]);
  harness.completePart(harness.ownerCity);
  assert.equal(harness.victorySystem.getScienceVictoryProgress(OWNER_ID).aerospaceParts, 10);
  harness.turnManager.start();
  harness.turnManager.endCurrentTurn();
  assert.equal(harness.victorySystem.getVictoryState()?.type, 'science');
});

test('accumulated Aerospace Parts survive state save/restore', () => {
  const source = makeHarness();
  source.aerospacePartSystem.restoreProgress([
    { nationId: OWNER_ID, quantity: 4 },
    { nationId: RIVAL_ID, quantity: 2 },
  ]);
  const saved = source.aerospacePartSystem.getProgressForSave();
  const restored = makeHarness();
  restored.aerospacePartSystem.restoreProgress(saved);
  assert.equal(restored.aerospacePartSystem.getQuantity(OWNER_ID), 4);
  assert.equal(restored.aerospacePartSystem.getQuantity(RIVAL_ID), 2);
});

test('AI receives a high-priority part candidate after global unlock', () => {
  const harness = makeHarness();
  harness.foundAerospaceIndustries();
  const candidate = getAIAerospacePartProductionCandidate({
    city: harness.rivalCity,
    nationCities: [harness.rivalCity],
    aerospacePartSystem: harness.aerospacePartSystem,
    productionSystem: harness.productionSystem,
    scienceVictoryEnabled: true,
    requiredAerospaceParts: 10,
  });
  assert.equal(candidate?.item.kind, 'manufacturedResource');
  assert.ok((candidate?.baseScore ?? 0) >= 120);
});

test('AI stops adding part candidates when accumulated plus queued reaches requirement', () => {
  const harness = makeHarness();
  harness.foundAerospaceIndustries();
  harness.aerospacePartSystem.restoreProgress([{ nationId: RIVAL_ID, quantity: 9 }]);
  harness.productionSystem.setProduction(harness.rivalCity.id, {
    kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION,
  });
  assert.equal(getAIAerospacePartProductionCandidate({
    city: harness.rivalCity,
    nationCities: [harness.rivalCity],
    aerospacePartSystem: harness.aerospacePartSystem,
    productionSystem: harness.productionSystem,
    scienceVictoryEnabled: true,
    requiredAerospaceParts: 10,
  }), undefined);
});
