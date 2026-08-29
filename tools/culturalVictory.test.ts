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
  OVERWHELMING_CULTURE_VICTORY_THRESHOLD,
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
  gamesChampionId?: string | null;
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

  let latestCompletedGames: { gamesNumber: number; overallWinnerNationId?: string } | undefined = options.gamesChampionId === null
    ? undefined
    : { gamesNumber: 1, overallWinnerNationId: options.gamesChampionId ?? TARGET_ID };
  const gamesChampionSource = {
    getLatestCompletedGames: () => latestCompletedGames,
  };
  const victoryLogs: string[] = [];

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
    (_nationId, message) => victoryLogs.push(message),
    researchSystem,
    undefined,
    wonderSystem,
    undefined,
    currencySystem,
    gamesChampionSource,
  );

  const evaluateVictory = () => turnManager.endCurrentTurn();
  const setReigningGamesChampion = (nationId: string | undefined, gamesNumber = 1) => {
    latestCompletedGames = { gamesNumber, overallWinnerNationId: nationId };
  };
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
    setReigningGamesChampion,
    evaluateVictory,
    victoryLogs,
  };
}

test('75,000 Culture, 8 Wonders, and Dominant Currency produce Cultural Victory', () => {
  const harness = makeHarness();
  harness.evaluateVictory();
  assert.deepEqual(harness.victorySystem.getVictoryState()?.type, 'cultural');
  assert.equal(harness.victorySystem.getVictoryState()?.nationId, TARGET_ID);
  assert.equal(harness.victorySystem.getCulturalVictoryProgress(TARGET_ID).victoryRoute, 'normal');
  assert.match(harness.victoryLogs.join('\n'), /achieved Cultural Victory: culture=/);
});

test('75,000 Culture does not bypass missing normal secondary requirements', () => {
  const harness = makeHarness({
    targetCulture: CULTURAL_VICTORY_REQUIRED_CULTURE,
    targetWonderCount: 0,
    targetHasCurrency: false,
    gamesChampionId: null,
  });
  const progress = harness.victorySystem.getCulturalVictoryProgress(TARGET_ID);
  assert.equal(progress.normalRequirementsMet, false);
  assert.equal(progress.overwhelmingCultureThresholdMet, false);
  assert.equal(progress.victoryEligible, false);
  harness.evaluateVictory();
  assert.equal(harness.victorySystem.getVictoryState(), null);
});

test('exactly 250,000 Culture wins despite Wonders, Currency and Games gates', () => {
  const harness = makeHarness({
    targetCulture: OVERWHELMING_CULTURE_VICTORY_THRESHOLD,
    targetWonderCount: 0,
    targetHasCurrency: false,
    gamesChampionId: null,
  });
  const progress = harness.victorySystem.getCulturalVictoryProgress(TARGET_ID);
  assert.equal(progress.normalRequirementsMet, false);
  assert.equal(progress.overwhelmingCultureThreshold, OVERWHELMING_CULTURE_VICTORY_THRESHOLD);
  assert.equal(progress.overwhelmingCultureThresholdMet, true);
  assert.equal(progress.victoryRoute, 'overwhelming');
  assert.equal(progress.victoryEligible, true);

  harness.evaluateVictory();
  assert.equal(harness.victorySystem.getVictoryState()?.type, 'cultural');
  assert.equal(harness.victorySystem.getVictoryState()?.nationId, TARGET_ID);
  assert.match(
    harness.victoryLogs.join('\n'),
    /achieved Cultural Victory through overwhelming cultural dominance: 250,000 \/ 250,000 Culture/,
  );
});

test('249,999 Culture does not trigger overwhelming Cultural Victory', () => {
  const harness = makeHarness({
    targetCulture: OVERWHELMING_CULTURE_VICTORY_THRESHOLD - 1,
    targetWonderCount: 0,
    targetHasCurrency: false,
    gamesChampionId: null,
  });
  assert.equal(
    harness.victorySystem.getCulturalVictoryProgress(TARGET_ID).overwhelmingCultureThresholdMet,
    false,
  );
  harness.evaluateVictory();
  assert.equal(harness.victorySystem.getVictoryState(), null);
});

test('human and AI nations use the same overwhelming Culture threshold', () => {
  for (const targetIsHuman of [true, false]) {
    const harness = makeHarness({
      targetCulture: OVERWHELMING_CULTURE_VICTORY_THRESHOLD,
      targetWonderCount: 0,
      targetHasCurrency: false,
      targetIsHuman,
      gamesChampionId: null,
    });
    harness.evaluateVictory();
    assert.equal(harness.victorySystem.getVictoryState()?.nationId, TARGET_ID);
    assert.equal(harness.victorySystem.getCulturalVictoryProgress(TARGET_ID).victoryRoute, 'overwhelming');
  }
});

test('normal Cultural Victory requirements are blocked before the first completed Games', () => {
  const harness = makeHarness({ gamesChampionId: null });
  const progress = harness.victorySystem.getCulturalVictoryProgress(TARGET_ID);

  assert.equal(progress.normalRequirementsMet, true);
  assert.equal(progress.latestCompletedGamesNumber, null);
  assert.equal(progress.isReigningGamesChampion, false);
  assert.equal(progress.victoryEligible, false);
  harness.evaluateVictory();
  assert.equal(harness.victorySystem.getVictoryState(), null);
});

test('only the latest Games winner can pass the additional Cultural Victory gate', () => {
  const harness = makeHarness({ gamesChampionId: RIVAL_ID });
  assert.equal(harness.victorySystem.getCulturalVictoryProgress(TARGET_ID).normalRequirementsMet, true);
  assert.equal(harness.victorySystem.getCulturalVictoryProgress(TARGET_ID).isReigningGamesChampion, false);
  harness.evaluateVictory();
  assert.equal(harness.victorySystem.getVictoryState(), null);
});

test('becoming reigning champion last enables victory through the normal turn-end evaluation', () => {
  const harness = makeHarness({ gamesChampionId: RIVAL_ID });
  harness.evaluateVictory();
  assert.equal(harness.victorySystem.getVictoryState(), null);

  harness.setReigningGamesChampion(TARGET_ID, 2);
  harness.evaluateVictory();
  assert.equal(harness.victorySystem.getVictoryState()?.type, 'cultural');
  assert.equal(harness.victorySystem.getVictoryState()?.nationId, TARGET_ID);
});

test('a new Games winner immediately replaces the previous champion eligibility', () => {
  const harness = makeHarness({ targetCulture: CULTURAL_VICTORY_REQUIRED_CULTURE - 1 });
  assert.equal(harness.victorySystem.getCulturalVictoryProgress(TARGET_ID).isReigningGamesChampion, true);

  harness.setReigningGamesChampion(RIVAL_ID, 2);
  assert.equal(harness.victorySystem.getCulturalVictoryProgress(TARGET_ID).isReigningGamesChampion, false);
  assert.equal(harness.victorySystem.getCulturalVictoryProgress(RIVAL_ID).isReigningGamesChampion, true);
  harness.setReigningGamesChampion(RIVAL_ID, 3);
  assert.equal(harness.victorySystem.getCulturalVictoryProgress(RIVAL_ID).latestCompletedGamesNumber, 3);
  assert.equal(harness.victorySystem.getCulturalVictoryProgress(RIVAL_ID).isReigningGamesChampion, true);
});

test('winning Games alone does not bypass any existing Cultural Victory requirement', () => {
  const harness = makeHarness({ targetCulture: CULTURAL_VICTORY_REQUIRED_CULTURE - 1 });
  const progress = harness.victorySystem.getCulturalVictoryProgress(TARGET_ID);
  assert.equal(progress.isReigningGamesChampion, true);
  assert.equal(progress.normalRequirementsMet, false);
  assert.equal(progress.victoryEligible, false);
  harness.evaluateVictory();
  assert.equal(harness.victorySystem.getVictoryState(), null);
});

test('eliminating the reigning champion transfers no Games eligibility', () => {
  const harness = makeHarness({ targetCulture: CULTURAL_VICTORY_REQUIRED_CULTURE - 1 });
  harness.nationManager.removeNation(TARGET_ID);

  assert.equal(harness.victorySystem.getCulturalVictoryProgress(RIVAL_ID).isReigningGamesChampion, false);
  harness.evaluateVictory();
  assert.equal(harness.victorySystem.getVictoryState(), null);
  harness.setReigningGamesChampion(RIVAL_ID, 2);
  assert.equal(harness.victorySystem.getCulturalVictoryProgress(RIVAL_ID).isReigningGamesChampion, true);
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
