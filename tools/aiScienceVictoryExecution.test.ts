/**
 * Focused tests for the Science Victory execution planner that forces an AI in
 * Science Victory Focus to found AeroSpace Industries and then manufacture
 * Aerospace Parts, so routine production cannot starve an available win path.
 * Run with: npx tsx --test tools/aiScienceVictoryExecution.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FACTORY } from '../src/data/buildings.ts';
import { getCorporationById } from '../src/data/corporations.ts';
import { ECONOMIC_DEVELOPMENT } from '../src/data/projects.ts';
import {
  AEROSPACE_INDUSTRIES_ID,
  AEROSPACE_PART_PRODUCTION,
  AEROSPACE_PARTS_ID,
  SCIENCE_VICTORY_TECH_ID,
} from '../src/data/scienceVictory.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { AISystem } from '../src/systems/AISystem.ts';
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
import {
  evaluateAIVictoryFocus,
  planScienceVictoryProduction,
  type ScienceVictoryExecutionInput,
} from '../src/systems/ai/AIVictoryFocus.ts';
import { TileType, type MapData } from '../src/types/map.ts';

const BASE: ScienceVictoryExecutionInput = {
  inScienceFocus: true,
  hasAerospaceIndustries: false,
  canFoundAerospaceIndustries: true,
  aerospaceIndustriesInProduction: false,
  emergencyActive: false,
  accumulatedParts: 0,
  inFlightParts: 0,
  requiredParts: 10,
  corporationEligibleCities: [
    { cityId: 'cityA', idle: true, turns: 5 },
    { cityId: 'cityB', idle: true, turns: 3 },
  ],
  partEligibleCities: [],
};

// 1. In focus + can found → commit the fastest idle eligible city immediately.
test('prioritizes founding AeroSpace Industries in the fastest idle eligible city', () => {
  const plan = planScienceVictoryProduction(BASE);
  assert.deepEqual(plan, { kind: 'foundAerospaceIndustries', cityId: 'cityB', immediate: true });
});

// 2. Routine production cannot indefinitely block: with no idle city and no
//    emergency, jump the queue of the fastest eligible (busy) city.
test('queues the corporation ahead of routine production when all eligible cities are busy', () => {
  const plan = planScienceVictoryProduction({
    ...BASE,
    corporationEligibleCities: [
      { cityId: 'cityA', idle: false, turns: 8 },
      { cityId: 'cityB', idle: false, turns: 4 },
    ],
  });
  assert.deepEqual(plan, { kind: 'foundAerospaceIndustries', cityId: 'cityB', immediate: false });
});

// Do not reshuffle: if it is already being produced/queued, take no action.
test('does not duplicate or reshuffle when the corporation is already in production', () => {
  const plan = planScienceVictoryProduction({ ...BASE, aerospaceIndustriesInProduction: true });
  assert.deepEqual(plan, { kind: 'none' });
});

// 3 & 4. After founding, prioritize Aerospace Parts in idle eligible cities,
//        bounded by the remaining requirement so parts accumulate to the target.
test('after founding, prioritizes Aerospace Parts in idle eligible cities', () => {
  const plan = planScienceVictoryProduction({
    ...BASE,
    hasAerospaceIndustries: true,
    canFoundAerospaceIndustries: false,
    accumulatedParts: 2,
    inFlightParts: 1,
    requiredParts: 10,
    partEligibleCities: [
      { cityId: 'cityA', idle: true, turns: 5 },
      { cityId: 'cityB', idle: true, turns: 3 },
      { cityId: 'cityC', idle: true, turns: 4 },
    ],
  });
  assert.deepEqual(plan, {
    kind: 'produceAerospaceParts', cityIds: ['cityA', 'cityB', 'cityC'], immediate: true,
  });
});

test('part production never exceeds the remaining Science Victory requirement', () => {
  const plan = planScienceVictoryProduction({
    ...BASE,
    hasAerospaceIndustries: true,
    canFoundAerospaceIndustries: false,
    accumulatedParts: 8,
    inFlightParts: 1,
    requiredParts: 10,
    partEligibleCities: [
      { cityId: 'cityA', idle: true, turns: 5 },
      { cityId: 'cityB', idle: true, turns: 3 },
      { cityId: 'cityC', idle: true, turns: 4 },
    ],
  });
  // Only 1 more part is needed (8 done + 1 in flight = 9 / 10).
  assert.deepEqual(plan, { kind: 'produceAerospaceParts', cityIds: ['cityA'], immediate: true });
});

test('an idle eligible city is preferred over a faster busy city for Aerospace Parts', () => {
  const plan = planScienceVictoryProduction({
    ...BASE,
    hasAerospaceIndustries: true,
    canFoundAerospaceIndustries: false,
    partEligibleCities: [
      { cityId: 'busyFast', idle: false, turns: 2 },
      { cityId: 'idleSlow', idle: true, turns: 8 },
    ],
  });
  assert.deepEqual(plan, {
    kind: 'produceAerospaceParts', cityIds: ['idleSlow'], immediate: true,
  });
});

test('queues one Aerospace Part ahead of the best eligible busy city', () => {
  const plan = planScienceVictoryProduction({
    ...BASE,
    hasAerospaceIndustries: true,
    canFoundAerospaceIndustries: false,
    partEligibleCities: [
      { cityId: 'busySlow', idle: false, turns: 8 },
      { cityId: 'busyFast', idle: false, turns: 3 },
    ],
  });
  assert.deepEqual(plan, {
    kind: 'produceAerospaceParts', cityIds: ['busyFast'], immediate: false,
  });
});

test('does not stack another busy-city queue jump while a Part is already in flight', () => {
  const plan = planScienceVictoryProduction({
    ...BASE,
    hasAerospaceIndustries: true,
    canFoundAerospaceIndustries: false,
    inFlightParts: 1,
    partEligibleCities: [{ cityId: 'busy', idle: false, turns: 3 }],
  });
  assert.deepEqual(plan, { kind: 'none' });
});

test('an active emergency prevents Aerospace Parts from jumping a busy queue', () => {
  const plan = planScienceVictoryProduction({
    ...BASE,
    hasAerospaceIndustries: true,
    canFoundAerospaceIndustries: false,
    emergencyActive: true,
    partEligibleCities: [{ cityId: 'busy', idle: false, turns: 3 }],
  });
  assert.deepEqual(plan, { kind: 'none' });
});

test('no part production once the requirement is already underway', () => {
  const plan = planScienceVictoryProduction({
    ...BASE,
    hasAerospaceIndustries: true,
    canFoundAerospaceIndustries: false,
    accumulatedParts: 7,
    inFlightParts: 3,
    requiredParts: 10,
    partEligibleCities: [{ cityId: 'cityA', idle: true, turns: 5 }],
  });
  assert.deepEqual(plan, { kind: 'none' });
});

// 5. Genuine emergency can override the queue jump (no idle city available).
test('an active emergency defers founding rather than jumping a busy city queue', () => {
  const plan = planScienceVictoryProduction({
    ...BASE,
    emergencyActive: true,
    corporationEligibleCities: [{ cityId: 'cityA', idle: false, turns: 4 }],
  });
  assert.deepEqual(plan, { kind: 'deferFounding', reason: 'all eligible cities busy while an emergency is active' });
});

test('an emergency does NOT stop committing a genuinely idle city (winning still dominates)', () => {
  const plan = planScienceVictoryProduction({
    ...BASE,
    emergencyActive: true,
    corporationEligibleCities: [
      { cityId: 'cityA', idle: false, turns: 4 },
      { cityId: 'cityB', idle: true, turns: 6 },
    ],
  });
  assert.deepEqual(plan, { kind: 'foundAerospaceIndustries', cityId: 'cityB', immediate: true });
});

// Guard rails: no false commitment.
test('no action when not in Science Victory Focus', () => {
  assert.deepEqual(planScienceVictoryProduction({ ...BASE, inScienceFocus: false }), { kind: 'none' });
});

test('no founding action when the requirements are not yet satisfied', () => {
  assert.deepEqual(
    planScienceVictoryProduction({ ...BASE, canFoundAerospaceIndustries: false }),
    { kind: 'none' },
  );
});

test('no action once the Science Victory part requirement is already fulfilled', () => {
  assert.deepEqual(
    planScienceVictoryProduction({
      ...BASE,
      hasAerospaceIndustries: true,
      canFoundAerospaceIndustries: false,
      accumulatedParts: 10,
      requiredParts: 10,
      partEligibleCities: [{ cityId: 'cityA', idle: true, turns: 5 }],
    }),
    { kind: 'none' },
  );
});

const AI_NATION_ID = 'nation_ai';
const AI_CITY_ID = 'city_ai';
const AEROSPACE_INDUSTRIES = getCorporationById(AEROSPACE_INDUSTRIES_ID)!;

function makeBusyProjectIntegrationHarness() {
  const nationManager = new NationManager();
  const nation = new Nation({
    id: AI_NATION_ID,
    name: 'Test AI',
    color: 0x123456,
    isHuman: false,
    researchedTechIds: [SCIENCE_VICTORY_TECH_ID],
    aiVictoryFocus: {
      type: 'science',
      objective: 'foundAerospaceIndustries',
      activatedTurn: 1,
    },
  });
  nationManager.addNation(nation);

  const cityManager = new CityManager();
  const city = new City({
    id: AI_CITY_ID,
    name: 'Factory City',
    ownerId: AI_NATION_ID,
    tileX: 0,
    tileY: 0,
    isCapital: true,
  });
  cityManager.addCity(city);
  cityManager.getBuildings(city.id).add(FACTORY);
  cityManager.getResources(city.id).productionPerTurn = 30;

  const mapData: MapData = {
    width: 1,
    height: 1,
    tileSize: 32,
    tiles: [[{
      x: 0,
      y: 0,
      type: TileType.Plains,
      ownerId: AI_NATION_ID,
      resourceId: 'aluminum',
    }]],
  };
  const turnManager = new TurnManager(nationManager);
  const happinessSystem = new HappinessSystem(nationManager, cityManager);
  const productionSystem = new ProductionSystem(cityManager, turnManager, happinessSystem);
  const researchSystem = new ResearchSystem(nationManager, cityManager, () => turnManager.getCurrentRound());
  const resourceAccessSystem = new ResourceAccessSystem(mapData, { getAllDeals: () => [] });
  const corporationSystem = new CorporationSystem(nationManager, cityManager, {
    researchSystem,
    resourceAccessSystem,
    getCurrentTurn: () => turnManager.getCurrentRound(),
  });
  const aerospacePartSystem = new AerospacePartSystem(
    cityManager,
    researchSystem,
    resourceAccessSystem,
    corporationSystem,
    productionSystem,
  );
  resourceAccessSystem.setManufacturedResourceProvider((nationId) => {
    const resources = new Map(corporationSystem.getNationManufacturedResources(nationId));
    for (const [resourceId, quantity] of aerospacePartSystem.getManufacturedResources(nationId)) {
      resources.set(resourceId, (resources.get(resourceId) ?? 0) + quantity);
    }
    return resources;
  });
  productionSystem.setItemProductionCostProvider((cityId, item, baseCost) => {
    if (item.kind !== 'manufacturedResource' || item.productionType.id !== AEROSPACE_PARTS_ID) {
      return baseCost;
    }
    const producingCity = cityManager.getCity(cityId);
    return producingCity
      ? { cost: aerospacePartSystem.getProductionCost(producingCity.ownerId), lock: true }
      : baseCost;
  });
  productionSystem.onCompleted((cityId, item) => {
    const producingCity = cityManager.getCity(cityId);
    if (!producingCity) return false;
    if (item.kind === 'corporation') {
      if (!corporationSystem.canCityProduceCorporation(producingCity, item.corporationType.id)) return false;
      const founded = corporationSystem.foundCorporation(
        producingCity.ownerId,
        item.corporationType.id,
        producingCity.id,
      );
      if (!founded) return false;
      productionSystem.removeCorporationFromAllQueues(item.corporationType.id);
      return true;
    }
    if (item.kind === 'manufacturedResource') {
      return aerospacePartSystem.completeProduction(producingCity) !== null;
    }
  });

  const victorySystem = new VictorySystem(
    cityManager,
    nationManager,
    turnManager,
    resourceAccessSystem,
    {
      science: { enabled: true, requiredAerospaceParts: 10 },
      domination: { enabled: false },
      cultural: { enabled: false },
      diplomatic: { enabled: false },
    },
    undefined,
    researchSystem,
    corporationSystem,
  );

  const logs: string[] = [];
  const aiSystem = Object.create(AISystem.prototype) as AISystem;
  Object.assign(aiSystem as unknown as Record<string, unknown>, {
    cityManager,
    nationManager,
    productionSystem,
    corporationSystem,
    aerospacePartSystem,
    victorySystem,
    scienceVictoryEnabled: true,
    aerospaceFoundingActionableLoggedNationIds: new Set<string>(),
    forcedScienceVictoryStateByNation: new Map<string, string>(),
    emergencyThreatsByNation: new Map<string, readonly unknown[]>(),
    logScienceVictoryAI: (_nationId: string, message: string) => logs.push(message),
  });
  const runDeterministicScienceVictoryProduction = (): void => {
    (aiSystem as unknown as {
      ensureScienceVictoryProduction(nationId: string, cities: readonly City[]): void;
    }).ensureScienceVictoryProduction(AI_NATION_ID, [city]);
  };

  return {
    nation,
    city,
    corporationSystem,
    aerospacePartSystem,
    productionSystem,
    victorySystem,
    logs,
    runDeterministicScienceVictoryProduction,
  };
}

test('Science Victory execution reprioritizes a busy project through corporation and first Part', () => {
  const harness = makeBusyProjectIntegrationHarness();
  const projectItem = { kind: 'project', projectType: ECONOMIC_DEVELOPMENT } as const;
  harness.productionSystem.setProduction(harness.city.id, projectItem);

  assert.equal(harness.nation.aiVictoryFocus?.objective, 'foundAerospaceIndustries');
  harness.runDeterministicScienceVictoryProduction();

  let queue = harness.productionSystem.getQueue(harness.city.id);
  assert.equal(queue[0]?.item.kind, 'corporation');
  assert.equal(
    queue[0]?.item.kind === 'corporation' && queue[0].item.corporationType.id,
    AEROSPACE_INDUSTRIES.id,
  );
  assert.equal(queue[1]?.item.kind, 'project');
  const preservedProjectProgress = queue[1]?.progress;

  assert.equal(harness.productionSystem.completeCurrentProduction(harness.city.id).kind, 'completed');
  assert.equal(harness.corporationSystem.isFounded(AEROSPACE_INDUSTRIES_ID), true);
  assert.equal(harness.productionSystem.getProduction(harness.city.id)?.item.kind, 'project');

  const focusEvaluation = evaluateAIVictoryFocus(
    harness.nation.aiVictoryFocus,
    true,
    harness.victorySystem.getScienceVictoryProgress(AI_NATION_ID),
    2,
  );
  harness.nation.aiVictoryFocus = focusEvaluation.focus;
  assert.equal(focusEvaluation.transition, 'objectiveAdvanced');
  assert.equal(harness.nation.aiVictoryFocus?.objective, 'produceAerospaceParts');

  harness.runDeterministicScienceVictoryProduction();
  queue = harness.productionSystem.getQueue(harness.city.id);
  assert.equal(queue[0]?.item.kind, 'manufacturedResource');
  assert.equal(
    queue[0]?.item.kind === 'manufacturedResource' && queue[0].item.productionType.id,
    AEROSPACE_PART_PRODUCTION.id,
  );
  assert.equal(queue[1]?.item.kind, 'project');
  assert.equal(queue[1]?.progress, preservedProjectProgress);
  assert.ok(harness.logs.some((message) => (
    message.includes('reprioritized eligible busy city Factory City for an Aerospace Part')
  )));

  harness.runDeterministicScienceVictoryProduction();
  queue = harness.productionSystem.getQueue(harness.city.id);
  assert.equal(queue.length, 2);
  assert.equal(queue[0]?.item.kind, 'manufacturedResource');
  assert.equal(queue[1]?.item.kind, 'project');

  assert.equal(harness.aerospacePartSystem.getQuantity(AI_NATION_ID), 0);
  assert.equal(harness.productionSystem.completeCurrentProduction(harness.city.id).kind, 'completed');
  assert.equal(harness.aerospacePartSystem.getQuantity(AI_NATION_ID), 1);
  queue = harness.productionSystem.getQueue(harness.city.id);
  assert.equal(queue.length, 1);
  assert.equal(queue[0]?.item.kind, 'project');
  assert.equal(queue[0]?.progress, preservedProjectProgress);
});
