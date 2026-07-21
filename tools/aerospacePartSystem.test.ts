/**
 * Focused tests for deliberate Aerospace Part manufacturing.
 * Run with: npx tsx --test tools/aerospacePartSystem.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AEROSPACE_INDUSTRIES_ID,
  AEROSPACE_PART_PRODUCTION,
  AEROSPACE_PARTS_ID,
  DEFAULT_REQUIRED_AEROSPACE_PARTS,
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
    researchedTechIds: ['flight'],
  });
  const rival = new Nation({
    id: RIVAL_ID,
    name: 'Rival',
    color: 0x222222,
    researchedTechIds: ['flight'],
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

test('a qualifying non-owner can manufacture and accumulate Aerospace Parts', () => {
  const harness = makeHarness();
  harness.foundAerospaceIndustries();
  assert.equal(harness.aerospacePartSystem.canCityProduce(harness.rivalCity), true);
  assert.equal(harness.completePart(harness.rivalCity).kind, 'completed');
  assert.equal(harness.aerospacePartSystem.getQuantity(RIVAL_ID), 1);
});

test('missing Flight prevents Aerospace Part production', () => {
  const harness = makeHarness();
  harness.foundAerospaceIndustries();
  harness.rival.researchedTechIds = [];
  assert.equal(harness.aerospacePartSystem.canCityProduce(harness.rivalCity), false);
  assert.ok(harness.aerospacePartSystem.getCityProductionBlockers(harness.rivalCity).includes('missing technology: flight'));
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
  assert.equal(harness.productionSystem.getTurnsEstimate(harness.ownerCity.id, item), 5);
});

test('non-owner receives no Aerospace Part Production bonus', () => {
  const harness = makeHarness();
  harness.foundAerospaceIndustries();
  const item = { kind: 'manufacturedResource', productionType: AEROSPACE_PART_PRODUCTION } as const;
  assert.equal(harness.aerospacePartSystem.getProductionBonusPercent(RIVAL_ID), 0);
  assert.equal(harness.productionSystem.getTurnsEstimate(harness.rivalCity.id, item), 8);
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
