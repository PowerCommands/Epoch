/** Focused tests for the three simultaneous Cultural Victory requirements. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ALL_WONDERS } from '../src/data/wonders.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import {
  CULTURAL_VICTORY_REQUIRED_CULTURE,
  CULTURAL_VICTORY_REQUIRED_WONDERS,
} from '../src/systems/CulturalVictory.ts';
import { CurrencySystem, type CurrencyEconomicMetrics } from '../src/systems/CurrencySystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { ResearchSystem } from '../src/systems/ResearchSystem.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { VictorySystem } from '../src/systems/VictorySystem.ts';
import { WonderSystem } from '../src/systems/WonderSystem.ts';

const TARGET_ID = 'nation_england';
const RIVAL_ID = 'nation_india';
const EMPTY_METRICS: CurrencyEconomicMetrics = {
  gold: 0,
  income: 0,
  tradeRelations: 0,
  tradePartners: 0,
  corporations: 0,
  banks: 0,
};

function makeHarness(options: {
  targetCulture?: number;
  targetWonderCount?: number;
  targetHasCurrency?: boolean;
  targetIsHuman?: boolean;
  targetDominant?: boolean;
} = {}) {
  const nationManager = new NationManager();
  const target = new Nation({
    id: TARGET_ID,
    name: 'England',
    color: 0xc8102e,
    isHuman: options.targetIsHuman ?? true,
    researchedTechIds: options.targetHasCurrency === false ? [] : ['currency'],
  });
  const rival = new Nation({
    id: RIVAL_ID,
    name: 'India',
    color: 0xff9933,
    researchedTechIds: ['currency'],
  });
  nationManager.addNation(target);
  nationManager.addNation(rival);
  nationManager.getResources(TARGET_ID).culture = options.targetCulture ?? CULTURAL_VICTORY_REQUIRED_CULTURE;

  const cityManager = new CityManager();
  const targetCity = new City({
    id: 'target_city', name: 'London', ownerId: TARGET_ID, tileX: 0, tileY: 0, isCapital: true,
  });
  const rivalCity = new City({
    id: 'rival_city', name: 'Delhi', ownerId: RIVAL_ID, tileX: 1, tileY: 0, isCapital: true,
  });
  cityManager.addCity(targetCity);
  cityManager.addCity(rivalCity);

  const turnManager = new TurnManager(nationManager);
  const researchSystem = new ResearchSystem(nationManager, cityManager, () => turnManager.getCurrentRound());
  const metricValues = new Map<string, CurrencyEconomicMetrics>([
    [TARGET_ID, { ...EMPTY_METRICS, gold: options.targetDominant === false ? 10 : 100, income: options.targetDominant === false ? 1 : 10 }],
    [RIVAL_ID, { ...EMPTY_METRICS, gold: options.targetDominant === false ? 100 : 10, income: options.targetDominant === false ? 10 : 1 }],
  ]);
  const currencySystem = new CurrencySystem(nationManager, researchSystem, {
    getGoldIncome: (nationId) => metricValues.get(nationId)?.income ?? 0,
    getActiveTradePartnerIds: () => [],
    getCorporationCount: () => 0,
    getActiveBankCount: () => 0,
  });
  const setEconomicStrength = (nationId: string, gold: number, income: number) => {
    metricValues.set(nationId, { ...EMPTY_METRICS, gold, income });
    nationManager.getResources(nationId).gold = gold;
  };
  for (const [nationId, metrics] of metricValues) {
    nationManager.getResources(nationId).gold = metrics.gold;
  }
  currencySystem.initializeAfterLoad(1);
  turnManager.on('roundStart', ({ round }) => currencySystem.handleRoundStart(round));

  const wonderSystem = new WonderSystem();
  const wonderCount = options.targetWonderCount ?? CULTURAL_VICTORY_REQUIRED_WONDERS;
  for (const wonder of ALL_WONDERS.slice(0, wonderCount)) {
    assert.equal(wonderSystem.completeWonder(targetCity, wonder, 1), true);
  }

  const victorySystem = new VictorySystem(
    cityManager,
    nationManager,
    turnManager,
    undefined,
    {
      domination: { enabled: false },
      science: { enabled: false },
      cultural: { enabled: true },
      diplomatic: { enabled: false },
    },
    undefined,
    researchSystem,
    undefined,
    wonderSystem,
    undefined,
    currencySystem,
  );

  const evaluateVictory = () => turnManager.endCurrentTurn();
  return {
    target,
    rival,
    targetCity,
    rivalCity,
    cityManager,
    nationManager,
    turnManager,
    currencySystem,
    victorySystem,
    wonderSystem,
    setEconomicStrength,
    evaluateVictory,
  };
}

test('75,000 Culture, 8 Wonders, and Dominant Currency produce Cultural Victory', () => {
  const harness = makeHarness();
  harness.evaluateVictory();
  assert.deepEqual(harness.victorySystem.getVictoryState()?.type, 'cultural');
  assert.equal(harness.victorySystem.getVictoryState()?.nationId, TARGET_ID);
});

test('74,999 accumulated Culture does not satisfy Cultural Victory', () => {
  const harness = makeHarness({ targetCulture: CULTURAL_VICTORY_REQUIRED_CULTURE - 1 });
  harness.evaluateVictory();
  assert.equal(harness.victorySystem.getVictoryState(), null);
});

test('7 currently owned Wonders do not satisfy Cultural Victory', () => {
  const harness = makeHarness({ targetWonderCount: CULTURAL_VICTORY_REQUIRED_WONDERS - 1 });
  harness.evaluateVictory();
  assert.equal(harness.victorySystem.getVictoryState(), null);
});

test('Strong or Stable Currency does not satisfy the Dominant requirement', () => {
  for (const status of ['Strong', 'Stable'] as const) {
    const harness = makeHarness();
    const state = harness.currencySystem.getCurrencyState(TARGET_ID)!;
    // Deliberately replace only the cached status: VictorySystem must consume it as-is.
    (state as { strength: string }).strength = status;
    harness.evaluateVictory();
    assert.equal(harness.victorySystem.getVictoryState(), null);
  }
});

test('a nation without an active currency cannot win Cultural Victory', () => {
  const harness = makeHarness({ targetHasCurrency: false });
  assert.equal(harness.currencySystem.getCurrencyState(TARGET_ID), undefined);
  harness.evaluateVictory();
  assert.equal(harness.victorySystem.getVictoryState(), null);
});

test('previous Dominance does not count after the current cached status is lost', () => {
  const harness = makeHarness();
  assert.equal(harness.currencySystem.getCurrencyState(TARGET_ID)?.strength, 'Dominant');
  harness.setEconomicStrength(TARGET_ID, 1, 0);
  harness.setEconomicStrength(RIVAL_ID, 1_000, 100);
  harness.currencySystem.handleRoundStart(20);
  assert.notEqual(harness.currencySystem.getCurrencyState(TARGET_ID)?.strength, 'Dominant');
  harness.evaluateVictory();
  assert.equal(harness.victorySystem.getVictoryState(), null);
});

test('Wonder ownership follows current city ownership after conquest', () => {
  const harness = makeHarness();
  harness.targetCity.ownerId = RIVAL_ID;
  assert.equal(harness.victorySystem.getCulturalVictoryProgress(TARGET_ID).ownedWonders, 0);
  assert.equal(
    harness.victorySystem.getCulturalVictoryProgress(RIVAL_ID).ownedWonders,
    CULTURAL_VICTORY_REQUIRED_WONDERS,
  );
});

test('losing a Wonder city before all conditions are fulfilled prevents victory', () => {
  const harness = makeHarness();
  const [lostWonder] = harness.wonderSystem.getCompletedWonders();
  const capturedCity = new City({
    id: 'captured_wonder_city', name: 'Captured', ownerId: TARGET_ID, tileX: 2, tileY: 0,
  });
  harness.cityManager.addCity(capturedCity);
  // Move one completed Wonder to a second city, then lose that city.
  (lostWonder as { cityId: string }).cityId = capturedCity.id;
  capturedCity.ownerId = RIVAL_ID;
  assert.equal(harness.victorySystem.getCulturalVictoryProgress(TARGET_ID).ownedWonders, 7);
  harness.evaluateVictory();
  assert.equal(harness.victorySystem.getVictoryState(), null);
});

test('scheduled Currency update can enable Cultural Victory during the same round', () => {
  const harness = makeHarness({ targetDominant: false });
  assert.notEqual(harness.currencySystem.getCurrencyState(TARGET_ID)?.strength, 'Dominant');
  harness.setEconomicStrength(TARGET_ID, 1_000, 100);
  harness.setEconomicStrength(RIVAL_ID, 1, 0);
  harness.turnManager.restoreTurnState(19, 1);
  harness.turnManager.endCurrentTurn(); // roundEnd 19, then CurrencySystem updates at roundStart 20
  assert.equal(harness.currencySystem.getCurrencyState(TARGET_ID)?.strength, 'Dominant');
  harness.turnManager.endCurrentTurn(); // target turnEnd on round 20 sees the updated cache
  assert.equal(harness.victorySystem.getVictoryState()?.type, 'cultural');
  assert.equal(harness.victorySystem.getVictoryState()?.round, 20);
});

test('VictorySystem reads cached Currency status without an unscheduled ranking update', () => {
  const harness = makeHarness();
  const before = harness.currencySystem.getRankingUpdateCount();
  harness.evaluateVictory();
  assert.equal(harness.currencySystem.getRankingUpdateCount(), before);
});

test('AI and human nations use identical Cultural Victory requirements', () => {
  for (const targetIsHuman of [true, false]) {
    const harness = makeHarness({ targetIsHuman });
    const progress = harness.victorySystem.getCulturalVictoryProgress(TARGET_ID);
    assert.equal(progress.requiredCulture, CULTURAL_VICTORY_REQUIRED_CULTURE);
    assert.equal(progress.requiredWonders, CULTURAL_VICTORY_REQUIRED_WONDERS);
    harness.evaluateVictory();
    assert.equal(harness.victorySystem.getVictoryState()?.nationId, TARGET_ID);
  }
});

test('load-style Currency reconstruction provides valid derived Cultural Victory state', () => {
  const harness = makeHarness();
  assert.equal(harness.currencySystem.getCurrencyState(TARGET_ID)?.rankedAtRound, 1);
  const progress = harness.victorySystem.getCulturalVictoryProgress(TARGET_ID);
  assert.equal(progress.accumulatedCulture, CULTURAL_VICTORY_REQUIRED_CULTURE);
  assert.equal(progress.currencyStatus, 'Dominant');
});
