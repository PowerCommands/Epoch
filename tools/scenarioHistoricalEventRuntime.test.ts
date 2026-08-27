import assert from 'node:assert/strict';
import test from 'node:test';

import { Nation } from '../src/entities/Nation';
import { AllianceManager } from '../src/systems/diplomacy/AllianceManager';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import {
  addMonths,
  compareGameDates,
  createGameDate,
  hasReachedOrCrossedDate,
} from '../src/systems/GameDate';
import { NationManager } from '../src/systems/NationManager';
import { ScenarioHistoricalEventSystem } from '../src/systems/ScenarioHistoricalEventSystem';
import { TurnManager } from '../src/systems/TurnManager';
import type { ScenarioWorldWarHistoricalEvent } from '../src/types/scenario';

const GERMANY = 'germany';
const POLAND = 'poland';
const ENGLAND = 'england';

function worldWar(
  id: string,
  year: number,
  month: number,
  conflicts = [{ nationAId: GERMANY, nationBId: POLAND }],
): ScenarioWorldWarHistoricalEvent {
  return {
    id,
    type: 'worldWar',
    name: id,
    description: '',
    startYear: year,
    startYearIsBC: false,
    startMonth: month,
    conflicts,
    endConditionNationId: GERMANY,
  };
}

function harness(
  events: ScenarioWorldWarHistoricalEvent[],
  startYear = 1938,
  mode: 'staticYear' | 'monthly' = 'staticYear',
  staticYearStep = 1,
) {
  const nations = new NationManager();
  for (const [id, name] of [[GERMANY, 'Germany'], [POLAND, 'Poland'], [ENGLAND, 'England']] as const) {
    nations.addNation(new Nation({ id, name, color: 0 }));
  }
  const turns = new TurnManager(nations, undefined, {
    name: 'Runtime test', version: 1, startYear, startYearIsBC: false,
    timeProgression: { mode, staticYearStep },
  });
  const diplomacy = new DiplomacyManager(turns);
  const alliances = new AllianceManager();
  diplomacy.setAllianceGuard((a, b) => alliances.areAllied(a, b));
  const logs: string[] = [];
  const system = new ScenarioHistoricalEventSystem(events, turns, diplomacy, alliances, {
    isNationActive: (id) => Boolean(nations.getNation(id)),
    getNationName: (id) => nations.getNation(id)?.name ?? id,
    log: (message) => logs.push(message),
  });
  const advanceRound = () => {
    const round = turns.getCurrentRound();
    while (turns.getCurrentRound() === round) turns.endCurrentTurn();
  };
  return { nations, turns, diplomacy, alliances, logs, system, advanceRound };
}

test('GameDate helpers compare, cross, and add months through BC/AD without year zero', () => {
  const december1BC = createGameDate(1, true, 11);
  const january1AD = addMonths(december1BC, 1);
  assert.deepEqual({ year: january1AD.year, isBC: january1AD.isBC, monthIndex: january1AD.monthIndex },
    { year: 1, isBC: false, monthIndex: 0 });
  assert.equal(compareGameDates(december1BC, january1AD), -1);
  assert.equal(hasReachedOrCrossedDate(createGameDate(2, true, 0), january1AD, december1BC), true);
});

test('A: exact September date triggers at the pre-round boundary', () => {
  const h = harness([worldWar('WWII', 1939, 9)], 1939, 'monthly');
  h.turns.restoreTurnState(8, 0); // August 1939
  h.turns.start();
  assert.equal(h.system.hasTriggered('WWII'), false);
  h.advanceRound();
  assert.equal(h.system.hasTriggered('WWII'), true);
  assert.equal(h.turns.getGameDateLabel(), 'September 1939');
  assert.equal(h.turns.getRuntimeDateProgression()?.mode, 'monthly');
});

test('B/C/D: skipped date anchors to September, continues monthly, and triggers once', () => {
  const h = harness([worldWar('WWII', 1939, 9)], 1938, 'staticYear', 2);
  let declarations = 0;
  h.diplomacy.onWarDeclared(() => { declarations += 1; });
  h.turns.start();
  h.advanceRound();
  assert.equal(h.turns.getGameDateLabel(), 'September 1939');
  assert.equal(declarations, 1);
  const expected = ['October 1939', 'November 1939', 'December 1939', 'January 1940'];
  for (const label of expected) {
    h.advanceRound();
    assert.equal(h.turns.getGameDateLabel(), label);
  }
  assert.equal(declarations, 1);
  assert.equal(h.logs.filter((line) => line.startsWith('Historical Event triggered:')).length, 1);
});

test('E: every configured active conflict becomes WAR with historical source metadata', () => {
  const h = harness([worldWar('WWII', 1939, 9, [
    { nationAId: GERMANY, nationBId: POLAND },
    { nationAId: GERMANY, nationBId: ENGLAND },
  ])], 1940);
  const sources: string[] = [];
  h.diplomacy.onWarDeclared((_a, _b, metadata) => sources.push(metadata.source));
  h.turns.start();
  assert.equal(h.diplomacy.getState(GERMANY, POLAND), 'WAR');
  assert.equal(h.diplomacy.getState(GERMANY, ENGLAND), 'WAR');
  assert.deepEqual(sources, ['scenarioHistoricalEvent', 'scenarioHistoricalEvent']);
});

test('F: an existing war is preserved and emits no duplicate declaration', () => {
  const h = harness([worldWar('WWII', 1939, 9, [
    { nationAId: GERMANY, nationBId: POLAND },
    { nationAId: GERMANY, nationBId: ENGLAND },
  ])], 1940);
  h.diplomacy.restoreState(GERMANY, POLAND, {
    state: 'WAR', aggressorNationId: POLAND, lastWarDeclarationTurn: 77,
    militaryUnitsLostA: 4, militaryStrengthAtWarStartA: 123,
  });
  let declarations = 0;
  h.diplomacy.onWarDeclared(() => { declarations += 1; });
  h.turns.start();
  const existing = h.diplomacy.getRelation(GERMANY, POLAND);
  assert.equal(existing.aggressorNationId, POLAND);
  assert.equal(existing.lastWarDeclarationTurn, 77);
  assert.equal(existing.militaryUnitsLostA, 4);
  assert.equal(existing.militaryStrengthAtWarStartA, 123);
  assert.equal(declarations, 1);
});

test('G: only forced historical war bypasses and clears treaty and ceasefire blockers', () => {
  const h = harness([worldWar('WWII', 1939, 9)], 1940);
  h.diplomacy.restoreState(GERMANY, POLAND, {
    state: 'PEACE', peaceTreatyUntilTurn: 50, ceasefireUntilTurn: 50,
  });
  assert.equal(h.diplomacy.declareWar(GERMANY, POLAND), false);
  h.turns.start();
  const relation = h.diplomacy.getRelation(GERMANY, POLAND);
  assert.equal(relation.state, 'WAR');
  assert.equal(relation.peaceTreatyUntilTurn, null);
  assert.equal(relation.ceasefireUntilTurn, null);
});

test('H: an authored war resolves an alliance contradiction first', () => {
  const h = harness([worldWar('WWII', 1939, 9)], 1940);
  h.alliances.createAlliance(GERMANY, POLAND, 'Old Alliance', 1);
  assert.equal(h.diplomacy.declareWar(GERMANY, POLAND), false);
  h.turns.start();
  assert.equal(h.alliances.areAllied(GERMANY, POLAND), false);
  assert.equal(h.diplomacy.getState(GERMANY, POLAND), 'WAR');
});

test('I: a future World War is reached naturally after the first monthly anchor', () => {
  const h = harness([
    worldWar('War A', 1939, 9, [{ nationAId: GERMANY, nationBId: POLAND }]),
    worldWar('War B', 1940, 1, [{ nationAId: GERMANY, nationBId: ENGLAND }]),
  ], 1938, 'staticYear', 2);
  h.turns.start();
  h.advanceRound();
  assert.equal(h.turns.getGameDateLabel(), 'September 1939');
  assert.equal(h.system.hasTriggered('War A'), true);
  assert.equal(h.system.hasTriggered('War B'), false);
  for (let i = 0; i < 4; i += 1) h.advanceRound();
  assert.equal(h.turns.getGameDateLabel(), 'January 1940');
  assert.equal(h.system.hasTriggered('War B'), true);
  assert.equal(h.diplomacy.getState(GERMANY, ENGLAND), 'WAR');
});

test('multiple events in one large jump stop at the earliest historical date', () => {
  const h = harness([
    worldWar('War A', 1935, 3),
    worldWar('War B', 1939, 9, [{ nationAId: GERMANY, nationBId: ENGLAND }]),
  ], 1930, 'staticYear', 10);
  h.turns.start();
  h.advanceRound();
  assert.equal(h.turns.getGameDateLabel(), 'March 1935');
  assert.equal(h.system.hasTriggered('War A'), true);
  assert.equal(h.system.hasTriggered('War B'), false);
});

test('same-date events trigger together in stable scenario order', () => {
  const h = harness([
    worldWar('First', 1939, 9),
    worldWar('Second', 1939, 9, [{ nationAId: GERMANY, nationBId: ENGLAND }]),
  ], 1938, 'staticYear', 2);
  h.turns.start();
  h.advanceRound();
  assert.deepEqual(h.system.getTriggeredEventIds(), ['First', 'Second']);
  assert.equal(h.diplomacy.getState(GERMANY, POLAND), 'WAR');
  assert.equal(h.diplomacy.getState(GERMANY, ENGLAND), 'WAR');
});

test('an overdue initial event triggers immediately without rewinding the scenario start', () => {
  const h = harness([worldWar('Overdue', 1939, 9)], 1940);
  h.turns.start();
  assert.equal(h.system.hasTriggered('Overdue'), true);
  assert.equal(h.turns.getGameDateLabel(), 'January 1940');
});

test('J: no authored events leaves normal progression and diplomacy untouched', () => {
  const h = harness([], 1938, 'staticYear', 2);
  h.turns.start();
  h.advanceRound();
  assert.equal(h.turns.getGameDateLabel(), 'January 1940');
  assert.equal(h.turns.getRuntimeDateProgression(), null);
  assert.equal(h.diplomacy.getState(GERMANY, POLAND), 'PEACE');
});
