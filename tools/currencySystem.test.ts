/** Focused deterministic tests for currency economic ranking and cadence. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BANK } from '../src/data/buildings.ts';
import { NATION_DEFINITIONS } from '../src/data/nations.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import {
  CURRENCY_RANKING_UPDATE_INTERVAL,
  CurrencySystem,
  countActiveBanksForNation,
  getNextCurrencyRankingUpdateRound,
  rankRelativeValues,
  type CurrencyEconomicMetrics,
} from '../src/systems/CurrencySystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { ResearchSystem } from '../src/systems/ResearchSystem.ts';

const IDS = [
  'nation_england',
  'nation_france',
  'nation_sweden',
  'nation_india',
  'nation_china',
] as const;

const EMPTY_METRICS: CurrencyEconomicMetrics = {
  gold: 0,
  income: 0,
  tradeRelations: 0,
  tradePartners: 0,
  corporations: 0,
  banks: 0,
};

function makeHarness(options: {
  eligibleIds?: readonly string[];
  metrics?: Readonly<Record<string, Partial<CurrencyEconomicMetrics>>>;
} = {}) {
  const eligibleIds = options.eligibleIds ?? IDS;
  const nationManager = new NationManager();
  const metrics = new Map<string, CurrencyEconomicMetrics>();
  for (const id of IDS) {
    const definition = NATION_DEFINITIONS.find((nation) => nation.id === id)!;
    nationManager.addNation(new Nation({
      id,
      name: definition.name,
      color: Number.parseInt(definition.color.slice(1), 16),
      researchedTechIds: eligibleIds.includes(id) ? ['currency'] : [],
    }));
    const configured = { ...EMPTY_METRICS, ...(options.metrics?.[id] ?? {}) };
    metrics.set(id, configured);
    nationManager.getResources(id).gold = configured.gold;
    nationManager.getResources(id).goldPerTurn = configured.income;
  }
  const cityManager = new CityManager();
  const researchSystem = new ResearchSystem(nationManager, cityManager, () => 1);
  const logs: string[] = [];
  const system = new CurrencySystem(nationManager, researchSystem, {
    getGoldIncome: (id) => metrics.get(id)?.income ?? 0,
    getActiveTradePartnerIds: (id) => {
      const value = metrics.get(id) ?? EMPTY_METRICS;
      const unique = Array.from({ length: value.tradePartners }, (_, index) => `partner_${index}`);
      return Array.from({ length: value.tradeRelations }, (_, index) => unique[index % Math.max(1, unique.length)] ?? 'partner_0');
    },
    getCorporationCount: (id) => metrics.get(id)?.corporations ?? 0,
    getActiveBankCount: (id) => metrics.get(id)?.banks ?? 0,
  }, (message) => logs.push(message));
  const setMetrics = (id: string, changes: Partial<CurrencyEconomicMetrics>) => {
    const next = { ...(metrics.get(id) ?? EMPTY_METRICS), ...changes };
    metrics.set(id, next);
    nationManager.getResources(id).gold = next.gold;
    nationManager.getResources(id).goldPerTurn = next.income;
  };
  return { nationManager, researchSystem, system, metrics, logs, setMetrics };
}

function descendingMetrics(): Record<string, CurrencyEconomicMetrics> {
  return Object.fromEntries(IDS.map((id, index) => {
    const value = IDS.length - index;
    return [id, {
      gold: value * 100,
      income: value * 10,
      tradeRelations: value,
      tradePartners: value,
      corporations: value,
      banks: value,
    }];
  }));
}

test('the update interval is one centralized 20-round constant', () => {
  assert.equal(CURRENCY_RANKING_UPDATE_INTERVAL, 20);
  assert.equal(getNextCurrencyRankingUpdateRound(1), 20);
  assert.equal(getNextCurrencyRankingUpdateRound(20), 40);
});

test('nations without Currency are excluded and eligible identities begin Unranked', () => {
  const { system } = makeHarness({ eligibleIds: [IDS[0]] });
  assert.equal(system.getCurrencyState(IDS[0])?.strength, 'Unranked');
  assert.equal(system.getCurrencyState(IDS[1]), undefined);
  assert.equal(system.getRankingUpdateCount(), 0);
});

test('researching Currency activates identity without a full ranking calculation', () => {
  const harness = makeHarness({ eligibleIds: [] });
  assert.equal(harness.researchSystem.unlockTechnology(IDS[0], 'currency'), true);
  assert.equal(harness.system.activateCurrency(IDS[0], 7), true);
  assert.equal(harness.system.getCurrencyState(IDS[0])?.strength, 'Unranked');
  assert.equal(harness.system.getRankingUpdateCount(), 0);
  assert.match(harness.logs[0], /nextUpdateRound=20/);
});

test('no ranking recalculation occurs on rounds 1 through 19', () => {
  const { system } = makeHarness();
  for (let round = 1; round < 20; round++) assert.equal(system.handleRoundStart(round), false);
  assert.equal(system.getRankingUpdateCount(), 0);
  assert.equal(system.getLastRankingUpdateRound(), undefined);
});

test('ranking recalculates on round 20 and again on round 40 only', () => {
  const { system } = makeHarness();
  assert.equal(system.handleRoundStart(20), true);
  for (let round = 21; round < 40; round++) assert.equal(system.handleRoundStart(round), false);
  assert.equal(system.handleRoundStart(40), true);
  assert.equal(system.getRankingUpdateCount(), 2);
  assert.equal(system.getLastRankingUpdateRound(), 40);
});

test('five unique values produce relative points 5/4/3/2/1', () => {
  const points = rankRelativeValues(IDS.map((nationId, index) => ({ nationId, value: 5 - index })));
  assert.deepEqual(IDS.map((id) => points.get(id)), [5, 4, 3, 2, 1]);
});

test('two nations tied for best produce 4/4/3/2/1', () => {
  const values = [100, 100, 80, 60, 40];
  const points = rankRelativeValues(IDS.map((nationId, index) => ({ nationId, value: values[index] })));
  assert.deepEqual(IDS.map((id) => points.get(id)), [4, 4, 3, 2, 1]);
});

test('three nations tied for best produce 3/3/3/2/1 and never below one', () => {
  const values = [100, 100, 100, 60, 40];
  const points = rankRelativeValues(IDS.map((nationId, index) => ({ nationId, value: values[index] })));
  assert.deepEqual(IDS.map((id) => points.get(id)), [3, 3, 3, 2, 1]);
  assert.ok([...points.values()].every((value) => value >= 1));
});

test('all six category rankings use the same relative points and total is their sum', () => {
  const harness = makeHarness({ metrics: descendingMetrics() });
  harness.system.handleRoundStart(20);
  IDS.forEach((id, index) => {
    const ranking = harness.system.getCurrencyState(id)?.ranking!;
    const expected = 5 - index;
    assert.deepEqual(
      [ranking.gold, ranking.income, ranking.tradeRelations, ranking.tradePartners, ranking.corporations, ranking.banks],
      Array(6).fill(expected),
    );
    assert.equal(ranking.total, expected * 6);
  });
});

test('trade relation count and distinct trade partner count rank independently', () => {
  const harness = makeHarness({
    eligibleIds: [IDS[0], IDS[1]],
    metrics: {
      [IDS[0]]: { tradeRelations: 3, tradePartners: 1 },
      [IDS[1]]: { tradeRelations: 2, tradePartners: 2 },
    },
  });
  harness.system.handleRoundStart(20);
  assert.equal(harness.system.getCurrencyState(IDS[0])?.ranking?.tradeRelations, 2);
  assert.equal(harness.system.getCurrencyState(IDS[1])?.ranking?.tradeRelations, 1);
  assert.equal(harness.system.getCurrencyState(IDS[0])?.ranking?.tradePartners, 1);
  assert.equal(harness.system.getCurrencyState(IDS[1])?.ranking?.tradePartners, 2);
});

test('active Banks count while broken Banks do not', () => {
  const cityManager = new CityManager();
  const active = new City({ id: 'active', name: 'Active', ownerId: IDS[0], tileX: 0, tileY: 0 });
  const broken = new City({ id: 'broken', name: 'Broken', ownerId: IDS[0], tileX: 1, tileY: 0 });
  cityManager.addCity(active);
  cityManager.addCity(broken);
  cityManager.getBuildings(active.id).add(BANK);
  cityManager.getBuildings(broken.id).add(BANK);
  cityManager.getBuildings(broken.id).setBroken(BANK.id, true);
  assert.equal(countActiveBanksForNation(IDS[0], cityManager), 1);
});

test('exactly one currency is Dominant and total-score tie-breaking is deterministic', () => {
  const first = makeHarness().system;
  const second = makeHarness().system;
  first.handleRoundStart(20);
  second.handleRoundStart(20);
  const firstDominant = first.getActiveCurrencies().filter((state) => state.strength === 'Dominant');
  const secondDominant = second.getActiveCurrencies().filter((state) => state.strength === 'Dominant');
  assert.equal(firstDominant.length, 1);
  assert.deepEqual(firstDominant.map((state) => state.nationId), secondDominant.map((state) => state.nationId));
});

test('remaining Currency Status bands are relative to final ranking', () => {
  const { system } = makeHarness({ metrics: descendingMetrics() });
  system.handleRoundStart(20);
  assert.deepEqual(IDS.map((id) => system.getCurrencyState(id)?.strength), [
    'Dominant', 'Strong', 'Stable', 'Weak', 'Collapsing',
  ]);
});

test('economic changes remain invisible until the next scheduled update', () => {
  const harness = makeHarness({
    eligibleIds: [IDS[0], IDS[1]],
    metrics: {
      [IDS[0]]: { gold: 100, income: 10, tradeRelations: 2, tradePartners: 2, corporations: 2, banks: 2 },
      [IDS[1]]: { gold: 10, income: 1, tradeRelations: 0, tradePartners: 0, corporations: 0, banks: 0 },
    },
  });
  harness.system.handleRoundStart(20);
  assert.equal(harness.system.getCurrencyState(IDS[0])?.strength, 'Dominant');
  harness.setMetrics(IDS[0], { gold: 0, income: 0, tradeRelations: 0, tradePartners: 0, corporations: 0, banks: 0 });
  harness.setMetrics(IDS[1], { gold: 500, income: 50, tradeRelations: 4, tradePartners: 4, corporations: 4, banks: 4 });
  for (let round = 21; round < 40; round++) harness.system.handleRoundStart(round);
  assert.equal(harness.system.getCurrencyState(IDS[0])?.strength, 'Dominant');
  harness.system.handleRoundStart(40);
  assert.equal(harness.system.getCurrencyState(IDS[1])?.strength, 'Dominant');
});

test('read-only UI getters never trigger ranking calculations', () => {
  const { system } = makeHarness();
  for (let index = 0; index < 20; index++) {
    system.getCurrencyState(IDS[0]);
    system.getActiveCurrencies();
    system.isCurrencyActive(IDS[0]);
  }
  assert.equal(system.getRankingUpdateCount(), 0);
});

test('load initialization performs one valid reconstruction outside the schedule', () => {
  const before = makeHarness({ metrics: descendingMetrics() });
  assert.equal(before.system.initializeAfterLoad(37), true);
  assert.equal(before.system.getRankingUpdateCount(), 1);
  assert.equal(before.system.getLastRankingUpdateRound(), 37);
  assert.ok(before.system.getActiveCurrencies().every((state) => state.strength !== 'Unranked'));

  const after = makeHarness({ metrics: descendingMetrics() });
  after.system.initializeAfterLoad(37);
  assert.deepEqual(after.system.getActiveCurrencies(), before.system.getActiveCurrencies());
});

test('scheduled diagnostics contain all six raw metrics, points, total, and dominance changes', () => {
  const harness = makeHarness({ metrics: descendingMetrics() });
  harness.system.handleRoundStart(20);
  assert.ok(harness.logs.some((line) => line.includes('[Currency Ranking Update — turn 20]')));
  assert.ok(harness.logs.some((line) => (
    line.includes('gold=')
    && line.includes('income=')
    && line.includes('tradeRelations=')
    && line.includes('tradePartners=')
    && line.includes('corporations=')
    && line.includes('banks=')
    && line.includes('total=')
  )));
  assert.ok(harness.logs.some((line) => line.includes('Currency dominance changed:')));
});
