/**
 * Focused AI corporation-production and Science Victory vertical-slice tests.
 * Run with: npx tsx --test tools/aiCorporationProduction.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getAIStrategyById } from '../src/data/aiStrategies.ts';
import { FACTORY, MARKET } from '../src/data/buildings.ts';
import { getCorporationById, type CorporationDefinition } from '../src/data/corporations.ts';
import { SCIENCE_VICTORY_TECH_ID } from '../src/data/scienceVictory.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
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
  AEROSPACE_INDUSTRIES_ID,
  AI_AEROSPACE_SCIENCE_VICTORY_SCORE,
  getAICorporationProductionCandidates,
  getAICorporationProductionScore,
} from '../src/systems/ai/AICorporationProduction.ts';
import {
  pickBestAIProductionCandidate,
  scoreAIProductionCandidate,
  type AIProductionCandidate,
} from '../src/systems/ai/AIProductionScoring.ts';
import { TileType, type MapData } from '../src/types/map.ts';

const AEROSPACE = getCorporationById(AEROSPACE_INDUSTRIES_ID)!;
const SILK_ROAD = getCorporationById('silk_road_consortium')!;
const NATION_ID = 'nation_ai';

interface HarnessOptions {
  cityCount?: number;
  factoryCount?: number;
  researchedTechIds?: string[];
  resources?: string[];
  scienceVictoryEnabled?: boolean;
}

function makeHarness(options: HarnessOptions = {}) {
  const nationManager = new NationManager();
  const nation = new Nation({
    id: NATION_ID,
    name: 'Test AI',
    color: 0x123456,
    isHuman: false,
    researchedTechIds: options.researchedTechIds ?? [SCIENCE_VICTORY_TECH_ID],
  });
  nationManager.addNation(nation);

  const cityManager = new CityManager();
  const cities = Array.from({ length: options.cityCount ?? 1 }, (_, index) => {
    const city = new City({
      id: `city_${index + 1}`,
      name: `City ${index + 1}`,
      ownerId: NATION_ID,
      tileX: index,
      tileY: 0,
      isCapital: index === 0,
    });
    cityManager.addCity(city);
    cityManager.getResources(city.id).productionPerTurn = 10 + index * 10;
    if (index < (options.factoryCount ?? 1)) cityManager.getBuildings(city.id).add(FACTORY);
    return city;
  });

  const resources = options.resources ?? ['aluminum'];
  const mapData: MapData = {
    width: Math.max(1, resources.length),
    height: 1,
    tileSize: 32,
    tiles: [resources.map((resourceId, x) => ({
      x,
      y: 0,
      type: TileType.Plains,
      ownerId: NATION_ID,
      resourceId,
    }))],
  };
  if (resources.length === 0) {
    mapData.width = 1;
    mapData.tiles = [[{ x: 0, y: 0, type: TileType.Plains, ownerId: NATION_ID }]];
  }

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
  resourceAccessSystem.setManufacturedResourceProvider(
    (nationId) => corporationSystem.getNationManufacturedResources(nationId),
  );

  // This is the same canonical completion path used by GameScene for humans and AI.
  productionSystem.onCompleted((cityId, item) => {
    if (item.kind !== 'corporation') return;
    const city = cityManager.getCity(cityId);
    if (!city || corporationSystem.isFounded(item.corporationType.id)) return false;
    if (!corporationSystem.canCityProduceCorporation(city, item.corporationType.id)) return false;
    if (!corporationSystem.foundCorporation(city.ownerId, item.corporationType.id, city.id)) return false;
    productionSystem.removeCorporationFromAllQueues(item.corporationType.id);
    return true;
  });

  const victorySystem = new VictorySystem(
    cityManager,
    nationManager,
    turnManager,
    resourceAccessSystem,
    {
      science: { enabled: options.scienceVictoryEnabled ?? true, requiredAerospaceParts: 5 },
      domination: { enabled: false },
      cultural: { enabled: false },
      diplomatic: { enabled: false },
    },
    undefined,
    researchSystem,
    corporationSystem,
  );

  return {
    nation,
    cities,
    cityManager,
    corporationSystem,
    productionSystem,
    resourceAccessSystem,
    turnManager,
    victorySystem,
  };
}

function candidatesFor(
  harness: ReturnType<typeof makeHarness>,
  city = harness.cities[0],
  scienceVictoryEnabled = true,
  definitions: readonly CorporationDefinition[] = [AEROSPACE],
) {
  return getAICorporationProductionCandidates({
    city,
    nationCities: harness.cities,
    corporationSystem: harness.corporationSystem,
    productionSystem: harness.productionSystem,
    scienceVictoryEnabled,
    definitions,
  });
}

test('eligible AI city generates a canonical corporation production candidate', () => {
  const harness = makeHarness();
  const [candidate] = candidatesFor(harness);
  assert.equal(candidate?.item.kind, 'corporation');
  assert.equal(candidate?.item.kind === 'corporation' && candidate.item.corporationType.id, AEROSPACE_INDUSTRIES_ID);
});

test('authoritative CorporationSystem prerequisites suppress an illegal general corporation', () => {
  const harness = makeHarness({ researchedTechIds: [], resources: [] });
  assert.deepEqual(candidatesFor(harness, harness.cities[0], false, [SILK_ROAD]), []);
});

test('Flight alone no longer makes AeroSpace Industries available', () => {
  const harness = makeHarness({ researchedTechIds: ['flight'] });
  assert.deepEqual(candidatesFor(harness), []);
});

test('AeroSpace Industries is unavailable without Aluminum', () => {
  const harness = makeHarness({ resources: [] });
  assert.deepEqual(candidatesFor(harness), []);
});

test('AeroSpace Industries requires an active Factory nationally and in the producing city', () => {
  const noFactory = makeHarness({ factoryCount: 0 });
  assert.deepEqual(candidatesFor(noFactory), []);

  const localFactoryMissing = makeHarness({ cityCount: 2, factoryCount: 1 });
  assert.deepEqual(candidatesFor(localFactoryMissing, localFactoryMissing.cities[1]), []);
});

test('Science Victory enables the elevated AeroSpace Industries score', () => {
  assert.equal(
    getAICorporationProductionScore(AEROSPACE, true),
    AI_AEROSPACE_SCIENCE_VICTORY_SCORE,
  );
});

test('Science Victory disabled removes only the special AeroSpace priority', () => {
  const harness = makeHarness({ scienceVictoryEnabled: false });
  const [candidate] = candidatesFor(harness, harness.cities[0], false);
  const score = candidate.baseScore;
  assert.equal(candidate.item.kind, 'corporation');
  assert.ok(score > 0);
  assert.ok(score < AI_AEROSPACE_SCIENCE_VICTORY_SCORE);
});

test('Rocketry alone satisfies the technology requirement; 82/82 completion is not required', () => {
  const harness = makeHarness({ researchedTechIds: [SCIENCE_VICTORY_TECH_ID] });
  assert.equal(harness.nation.researchedTechIds.length, 1);
  assert.equal(candidatesFor(harness).length, 1);
});

test('an already-founded globally unique corporation is not considered', () => {
  const harness = makeHarness();
  assert.equal(harness.corporationSystem.foundCorporation(NATION_ID, AEROSPACE_INDUSTRIES_ID), true);
  assert.deepEqual(candidatesFor(harness), []);
});

test('AI avoids duplicate corporation queues across its cities', () => {
  const harness = makeHarness({ cityCount: 2, factoryCount: 2 });
  harness.productionSystem.setProduction(harness.cities[0].id, {
    kind: 'corporation',
    corporationType: AEROSPACE,
  });
  assert.deepEqual(candidatesFor(harness, harness.cities[1]), []);
});

test('the fastest eligible idle city is the sole corporation candidate city', () => {
  const harness = makeHarness({ cityCount: 3, factoryCount: 3 });
  assert.deepEqual(candidatesFor(harness, harness.cities[0]), []);
  assert.deepEqual(candidatesFor(harness, harness.cities[1]), []);
  assert.equal(candidatesFor(harness, harness.cities[2]).length, 1);
});

test('AI-selected corporation completes through the normal founding path', () => {
  const harness = makeHarness();
  const candidate = candidatesFor(harness)[0];
  harness.productionSystem.setProduction(harness.cities[0].id, candidate.item);
  assert.equal(harness.productionSystem.completeCurrentProduction(harness.cities[0].id).kind, 'completed');
  assert.equal(harness.corporationSystem.getFoundedCorporation(AEROSPACE_INDUSTRIES_ID)?.founderNationId, NATION_ID);
});

test('completed AeroSpace Industries does not convert active Factories into Aerospace Parts', () => {
  const harness = makeHarness({ cityCount: 3, factoryCount: 3 });
  const candidate = candidatesFor(harness, harness.cities[2])[0];
  harness.productionSystem.setProduction(harness.cities[2].id, candidate.item);
  harness.productionSystem.completeCurrentProduction(harness.cities[2].id);
  assert.equal(harness.resourceAccessSystem.getManufacturedResourceSourceCount(NATION_ID, 'aerospace_parts'), 0);
});

test('Factories plus corporation completion alone are not recognized as Science Victory', () => {
  const harness = makeHarness({ cityCount: 5, factoryCount: 5 });
  const producer = harness.cities[4];
  const candidate = candidatesFor(harness, producer)[0];
  harness.productionSystem.setProduction(producer.id, candidate.item);
  harness.productionSystem.completeCurrentProduction(producer.id);

  assert.equal(harness.victorySystem.getScienceVictoryProgress(NATION_ID).aerospaceParts, 0);
  harness.turnManager.start();
  harness.turnManager.endCurrentTurn();
  assert.equal(harness.victorySystem.getVictoryState(), null);
});

test('ordinary corporations receive a meaningful moderate baseline score', () => {
  const harness = makeHarness({
    researchedTechIds: ['trade_networks'],
    resources: ['silk'],
  });
  harness.cityManager.getBuildings(harness.cities[0].id).add(MARKET);
  const [candidate] = candidatesFor(harness, harness.cities[0], true, [SILK_ROAD]);
  assert.equal(candidate.item.kind, 'corporation');
  assert.ok(candidate.baseScore >= 50 && candidate.baseScore < 100);
});

test('special AeroSpace score wins a normal production-candidate comparison', () => {
  const harness = makeHarness();
  const corporation = candidatesFor(harness)[0];
  const competitor: AIProductionCandidate = {
    item: { kind: 'building', buildingType: FACTORY },
    baseScore: 100,
    category: 'productionBuilding',
  };
  const strategy = getAIStrategyById('baseline');
  const winner = pickBestAIProductionCandidate([competitor, corporation], strategy);
  assert.equal(winner?.item.kind, 'corporation');
});

test('existing non-corporation candidate scoring remains functional', () => {
  const strategy = getAIStrategyById('baseline');
  const candidate: AIProductionCandidate = {
    item: { kind: 'building', buildingType: MARKET },
    baseScore: 70,
    category: 'goldBuilding',
  };
  assert.equal(scoreAIProductionCandidate(candidate, strategy), 70 * strategy.production.goldBuildingWeight);
});
