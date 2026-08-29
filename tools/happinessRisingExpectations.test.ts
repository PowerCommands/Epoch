import assert from 'node:assert/strict';
import test from 'node:test';

import { Nation } from '../src/entities/Nation';
import { resolveScenarioMeta } from '../src/data/scenarioMeta';
import { CityManager } from '../src/systems/CityManager';
import { computeGameDate } from '../src/systems/GameDate';
import {
  HappinessSystem,
  resolveHappinessTier,
} from '../src/systems/HappinessSystem';
import { NationManager } from '../src/systems/NationManager';
import { TurnManager } from '../src/systems/TurnManager';
import { buildHappinessTooltip } from '../src/ui/happinessFormat';
import type { ScenarioMeta } from '../src/types/scenario';

test('1699 retains every existing positive Happiness boundary', () => {
  const cases = [
    [0, 'stable'],
    [4, 'stable'],
    [5, 'happy'],
    [14, 'happy'],
    [15, 'prosperous'],
    [29, 'prosperous'],
    [30, 'golden_age'],
  ] as const;

  for (const [value, expected] of cases) {
    assert.equal(resolveHappinessTier(value, 1699).state, expected, `Happiness ${value}`);
  }
});

test('negative Happiness boundaries and effects are identical before and after 1700', () => {
  const cases = [
    [-1, 'unhappy'],
    [-4, 'unhappy'],
    [-5, 'very_unhappy'],
    [-9, 'very_unhappy'],
    [-10, 'unrest'],
    [-19, 'unrest'],
    [-20, 'crisis'],
  ] as const;

  for (const [value, expected] of cases) {
    const before = resolveHappinessTier(value, 1699);
    const after = resolveHappinessTier(value, 1700);
    assert.equal(before.state, expected, `Happiness ${value}`);
    assert.deepEqual(after, before, `effects changed at Happiness ${value}`);
  }
});

test('1700 uses the Rising Expectations boundaries exactly', () => {
  const cases = [
    [0, 'stable'],
    [50, 'stable'],
    [51, 'happy'],
    [150, 'happy'],
    [151, 'prosperous'],
    [300, 'prosperous'],
    [301, 'golden_age'],
  ] as const;

  for (const [value, expected] of cases) {
    assert.equal(resolveHappinessTier(value, 1700).state, expected, `Happiness ${value}`);
  }
});

test('each positive state keeps its existing gameplay bonuses', () => {
  const equivalentValues = [
    [0, 0],
    [5, 51],
    [15, 151],
    [30, 301],
  ] as const;

  for (const [pre1700Value, modernValue] of equivalentValues) {
    assert.deepEqual(
      resolveHappinessTier(modernValue, 1700),
      resolveHappinessTier(pre1700Value, 1699),
    );
  }
});

test('human and AI nations use the same calendar-derived scale after load', () => {
  const scenario: ScenarioMeta = {
    name: 'Rising Expectations load test',
    version: 1,
    startYear: 1699,
    startYearIsBC: false,
    timeProgression: { mode: 'staticYear', staticYearStep: 1 },
  };
  const nations = new NationManager();
  nations.addNation(new Nation({ id: 'human', name: 'Human', color: 0 }));
  nations.addNation(new Nation({ id: 'ai', name: 'AI', color: 0 }));
  const turns = new TurnManager(nations, undefined, scenario);
  const happiness = new HappinessSystem(
    nations,
    new CityManager(),
    () => ({ happinessPerTurn: 114 }), // Base 6 + 114 = net Happiness 120.
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined,
    () => turns.getCurrentRound(),
    undefined,
    (round) => turns.getGameDateForRound(round).signedYear,
  );

  assert.equal(turns.getGameDate().signedYear, 1699);
  assert.equal(happiness.getNationState('human').state, 'golden_age');
  assert.equal(happiness.getNationState('ai').state, 'golden_age');
  assert.equal(happiness.getNationState('human').totalHappiness, 120);
  assert.equal(happiness.getNationState('human').totalUnhappiness, 0);

  turns.restoreTurnState(2, 0); // The same cursor restoration used by save/load.
  happiness.recalculateAll();
  assert.equal(turns.getGameDate().signedYear, 1700);
  assert.equal(happiness.getNationState('human').state, 'happy');
  assert.equal(happiness.getNationState('ai').state, 'happy');
  assert.equal(happiness.getNationState('human').totalHappiness, 120);
  assert.equal(happiness.getNationState('human').totalUnhappiness, 0);
  const humanState = happiness.getNationState('human');
  const aiState = happiness.getNationState('ai');
  assert.deepEqual(
    { ...aiState, nationId: 'same' },
    { ...humanState, nationId: 'same' },
    'AI and human derived state must match',
  );
});

test('scenario calendars and the post-1900 Auto cadence select the scale by year', () => {
  const monthlyScenario: ScenarioMeta = {
    name: 'Monthly calendar',
    version: 1,
    startYear: 1699,
    startYearIsBC: false,
    timeProgression: { mode: 'monthly' },
  };
  const monthlyMeta = resolveScenarioMeta(monthlyScenario);
  assert.equal(computeGameDate(monthlyMeta, 12, 1).signedYear, 1699);
  assert.equal(computeGameDate(monthlyMeta, 13, 1).signedYear, 1700);
  assert.equal(resolveHappinessTier(120, computeGameDate(monthlyMeta, 12, 1).signedYear).state, 'golden_age');
  assert.equal(resolveHappinessTier(120, computeGameDate(monthlyMeta, 13, 1).signedYear).state, 'happy');

  const autoScenario: ScenarioMeta = {
    name: 'World calendar',
    version: 1,
    startYear: 4000,
    startYearIsBC: true,
    timeProgression: { mode: 'auto' },
  };
  const autoMeta = resolveScenarioMeta(autoScenario);
  let round1900 = 1;
  while (computeGameDate(autoMeta, round1900, 1).signedYear < 1900) round1900 += 1;
  const at1900 = computeGameDate(autoMeta, round1900, 1);
  const nextTurn = computeGameDate(autoMeta, round1900 + 1, 1);
  assert.equal(at1900.signedYear, 1900);
  assert.equal(nextTurn.signedYear, 1900);
  assert.equal(resolveHappinessTier(120, at1900.signedYear).state, 'happy');
  assert.equal(resolveHappinessTier(120, nextTurn.signedYear).state, 'happy');
});

test('the modern tooltip identifies Rising Expectations and its thresholds', () => {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: 'nation', name: 'Nation', color: 0 }));
  const happiness = new HappinessSystem(nations, new CityManager());
  const tooltip = buildHappinessTooltip(happiness.getNationState('nation'), 1700);
  assert.match(tooltip, /Rising Expectations/);
  assert.match(tooltip, /Stable 0–50/);
  assert.doesNotMatch(buildHappinessTooltip(happiness.getNationState('nation'), 1699), /Rising Expectations/);
});
