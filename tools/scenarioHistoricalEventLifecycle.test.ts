import assert from 'node:assert/strict';
import test from 'node:test';

import { Nation } from '../src/entities/Nation';
import { AllianceManager } from '../src/systems/diplomacy/AllianceManager';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { NationManager } from '../src/systems/NationManager';
import {
  ScenarioHistoricalEventSystem,
  type SavedScenarioHistoricalEventsState,
} from '../src/systems/ScenarioHistoricalEventSystem';
import { TurnManager } from '../src/systems/TurnManager';
import type { ScenarioTimeProgression, ScenarioWorldWarHistoricalEvent } from '../src/types/scenario';

const GERMANY = 'germany';
const ENGLAND = 'england';
const FRANCE = 'france';
const SWEDEN = 'sweden';
const POLAND = 'poland';
const IDS = [GERMANY, ENGLAND, FRANCE, SWEDEN, POLAND];

function war(
  id: string,
  year: number,
  month: number,
  endConditionNationId = GERMANY,
  conflicts = [
    { nationAId: GERMANY, nationBId: ENGLAND },
    { nationAId: GERMANY, nationBId: FRANCE },
  ],
): ScenarioWorldWarHistoricalEvent {
  return {
    id,
    type: 'worldWar',
    name: id,
    description: '',
    startYear: year,
    startMonth: month,
    startYearIsBC: false,
    conflicts,
    endConditionNationId,
  };
}

function harness(
  events: ScenarioWorldWarHistoricalEvent[],
  progression: ScenarioTimeProgression = { mode: 'staticYear', staticYearStep: 1 },
  startYear = 1938,
) {
  const nations = new NationManager();
  for (const id of IDS) nations.addNation(new Nation({ id, name: id[0].toUpperCase() + id.slice(1), color: 0 }));
  const turns = new TurnManager(nations, undefined, {
    name: 'Lifecycle test', version: 1, startYear, startYearIsBC: false, timeProgression: progression,
  });
  const diplomacy = new DiplomacyManager(turns);
  const alliances = new AllianceManager();
  diplomacy.setAllianceGuard((a, b) => alliances.areAllied(a, b));
  const logs: string[] = [];
  const system = new ScenarioHistoricalEventSystem(events, turns, diplomacy, alliances, {
    isNationActive: (id) => nations.getNation(id) !== undefined,
    isNationEliminated: (id) => nations.getNation(id) === undefined,
    getNationName: (id) => nations.getNation(id)?.name ?? id,
    log: (line) => logs.push(line),
  });
  const advanceRound = () => {
    const round = turns.getCurrentRound();
    while (turns.getCurrentRound() === round) turns.endCurrentTurn();
  };
  const advanceTo = (label: string) => {
    for (let guard = 0; guard < 500 && turns.getGameDateLabel() !== label; guard += 1) advanceRound();
    assert.equal(turns.getGameDateLabel(), label);
  };
  const activate = (eventId: string) => {
    for (let guard = 0; guard < 500 && status(system, eventId).status === 'pending'; guard += 1) advanceRound();
    assert.equal(status(system, eventId).status, 'active');
  };
  return { nations, turns, diplomacy, alliances, system, logs, advanceRound, advanceTo, activate };
}

function status(system: ScenarioHistoricalEventSystem, eventId: string) {
  return system.getRuntimeStates().find((state) => state.eventId === eventId)!;
}

function makePeace(diplomacy: DiplomacyManager, a: string, b: string): void {
  assert.equal(diplomacy.enforceCeasefire(a, b, 1), true);
}

test('A: peace with only one opponent does not complete an active World War', () => {
  const h = harness([war('WWII', 1939, 9)]);
  h.turns.start();
  h.activate('WWII');
  assert.equal(status(h.system, 'WWII').status, 'active');
  makePeace(h.diplomacy, GERMANY, ENGLAND);
  h.advanceRound();
  assert.equal(status(h.system, 'WWII').status, 'active');
  makePeace(h.diplomacy, GERMANY, FRANCE);
  h.advanceRound();
  assert.equal(status(h.system, 'WWII').status, 'completed');
  assert.ok(status(h.system, 'WWII').completedRound);
  assert.ok(status(h.system, 'WWII').completedDate);
});

test('B: an unrelated additional war involving the end nation prevents completion', () => {
  const h = harness([war('WWII', 1939, 9)]);
  h.turns.start();
  h.activate('WWII');
  assert.equal(h.diplomacy.declareWar(GERMANY, SWEDEN), true);
  makePeace(h.diplomacy, GERMANY, ENGLAND);
  makePeace(h.diplomacy, GERMANY, FRANCE);
  h.advanceRound();
  assert.equal(status(h.system, 'WWII').status, 'active');
  makePeace(h.diplomacy, GERMANY, SWEDEN);
  h.advanceRound();
  assert.equal(status(h.system, 'WWII').status, 'completed');
});

test('C: canonical NationManager elimination completes a World War despite stale WAR relations', () => {
  const h = harness([war('WWII', 1939, 9)]);
  h.turns.start();
  h.activate('WWII');
  h.nations.removeNation(GERMANY);
  h.turns.removeNation(GERMANY);
  h.advanceRound();
  assert.equal(status(h.system, 'WWII').status, 'completed');
  assert.equal(h.diplomacy.getState(GERMANY, ENGLAND), 'WAR');
});

test('D/E: restored yearly progression continues from completion after many monthly rounds', () => {
  const h = harness([war('WWII', 1939, 9)]);
  h.turns.start();
  h.activate('WWII');
  h.advanceTo('May 1945');
  makePeace(h.diplomacy, GERMANY, ENGLAND);
  makePeace(h.diplomacy, GERMANY, FRANCE);
  h.advanceRound(); // completion at May 1945, enter May 1946
  assert.equal(status(h.system, 'WWII').completedDate?.monthName, 'May');
  assert.equal(status(h.system, 'WWII').completedDate?.year, 1945);
  assert.equal(h.turns.getGameDateLabel(), 'May 1946');
  h.advanceRound();
  assert.equal(h.turns.getGameDateLabel(), 'May 1947');
});

test('F: active save/load preserves February 1942 monthly state without re-declaration', () => {
  const definition = war('WWII', 1939, 9);
  const first = harness([definition]);
  first.turns.start();
  first.activate('WWII');
  first.advanceTo('February 1942');
  const savedRound = first.turns.getCurrentRound();
  const saved = JSON.parse(JSON.stringify(first.system.serialize())) as SavedScenarioHistoricalEventsState;

  const loaded = harness([definition]);
  loaded.turns.restoreTurnState(savedRound, 0);
  loaded.diplomacy.restoreState(GERMANY, ENGLAND, { state: 'WAR', lastWarDeclarationTurn: 2 });
  loaded.diplomacy.restoreState(GERMANY, FRANCE, { state: 'WAR', lastWarDeclarationTurn: 2 });
  let declarations = 0;
  loaded.diplomacy.onWarDeclared(() => { declarations += 1; });
  loaded.system.restore(saved);
  loaded.turns.start();
  assert.equal(loaded.system.hasActiveWorldWar(), true);
  assert.equal(loaded.turns.getGameDateLabel(), 'February 1942');
  assert.equal(declarations, 0);
  loaded.advanceRound();
  assert.equal(loaded.turns.getGameDateLabel(), 'March 1942');
  assert.equal(declarations, 0);
});

test('G: completed save/load stays completed and continues its restored timeline', () => {
  const definition = war('WWII', 1939, 9);
  const first = harness([definition]);
  first.turns.start();
  first.activate('WWII');
  makePeace(first.diplomacy, GERMANY, ENGLAND);
  makePeace(first.diplomacy, GERMANY, FRANCE);
  first.advanceRound();
  const savedRound = first.turns.getCurrentRound();
  const savedLabel = first.turns.getGameDateLabel();
  const saved = JSON.parse(JSON.stringify(first.system.serialize())) as SavedScenarioHistoricalEventsState;

  const loaded = harness([definition]);
  loaded.turns.restoreTurnState(savedRound, 0);
  loaded.system.restore(saved);
  let declarations = 0;
  loaded.diplomacy.onWarDeclared(() => { declarations += 1; });
  loaded.turns.start();
  assert.equal(status(loaded.system, 'WWII').status, 'completed');
  assert.equal(loaded.turns.getGameDateLabel(), savedLabel);
  loaded.advanceRound();
  assert.equal(declarations, 0);
  assert.equal(status(loaded.system, 'WWII').status, 'completed');
});

test('H: pending save/load remains pending and triggers once at its date', () => {
  const definition = war('WWII', 1939, 9);
  const first = harness([definition], { mode: 'monthly' }, 1939);
  first.turns.restoreTurnState(4, 0); // April 1939
  const saved = JSON.parse(JSON.stringify(first.system.serialize())) as SavedScenarioHistoricalEventsState;

  const loaded = harness([definition], { mode: 'monthly' }, 1939);
  loaded.turns.restoreTurnState(4, 0);
  loaded.system.restore(saved);
  let declarations = 0;
  loaded.diplomacy.onWarDeclared(() => { declarations += 1; });
  loaded.turns.start();
  for (let i = 0; i < 5; i += 1) loaded.advanceRound();
  assert.equal(loaded.turns.getGameDateLabel(), 'September 1939');
  assert.equal(status(loaded.system, 'WWII').status, 'active');
  assert.equal(declarations, 2);
});

test('I/J: overlapping wars retain monthly mode until the last ends and restore original two-year step', () => {
  const a = war('War A', 1939, 9, GERMANY, [{ nationAId: GERMANY, nationBId: ENGLAND }]);
  const b = war('War B', 1939, 11, POLAND, [{ nationAId: POLAND, nationBId: FRANCE }]);
  const h = harness([a, b], { mode: 'staticYear', staticYearStep: 2 });
  h.turns.start();
  h.activate('War A');
  h.advanceTo('November 1939');
  assert.equal(h.system.getActiveWorldWars().length, 2);
  makePeace(h.diplomacy, GERMANY, ENGLAND);
  h.advanceRound();
  assert.equal(status(h.system, 'War A').status, 'completed');
  assert.equal(status(h.system, 'War B').status, 'active');
  assert.equal(h.turns.getGameDateLabel(), 'December 1939');
  makePeace(h.diplomacy, POLAND, FRANCE);
  h.advanceRound();
  assert.equal(status(h.system, 'War B').status, 'completed');
  assert.equal(h.turns.getGameDateLabel(), 'December 1941');
  h.advanceRound();
  assert.equal(h.turns.getGameDateLabel(), 'December 1943');
});

test('auto progression resumes from its saved cursor instead of scenario start', () => {
  const h = harness([war('WWII', 1939, 9)], { mode: 'auto' }, 1900);
  h.turns.start();
  h.activate('WWII'); // auto jumps beyond the event and anchors it
  const captured = h.system.serialize().preWorldWarProgression;
  assert.equal(captured?.mode, 'auto');
  makePeace(h.diplomacy, GERMANY, ENGLAND);
  makePeace(h.diplomacy, GERMANY, FRANCE);
  h.advanceRound();
  const completedDate = status(h.system, 'WWII').completedDate!;
  assert.ok(h.turns.getGameDate().year >= completedDate.year);
  assert.equal(h.turns.getRuntimeDateProgression()?.mode, 'auto');
});

test('K: an ordinary war alone never changes the configured timeline', () => {
  const h = harness([], { mode: 'staticYear', staticYearStep: 2 }, 1938);
  h.turns.start();
  assert.equal(h.diplomacy.declareWar(ENGLAND, FRANCE), true);
  h.advanceRound();
  assert.equal(h.turns.getGameDateLabel(), 'January 1940');
  assert.equal(h.turns.getRuntimeDateProgression(), null);
});

test('L: no-event save payload stays empty and older missing runtime state remains compatible', () => {
  const h = harness([]);
  assert.deepEqual(h.system.serialize().events, []);
  h.turns.restoreTurnState(3, 0);
  h.system.restore(undefined);
  h.turns.start();
  assert.equal(h.turns.getGameDateLabel(), 'January 1940');
  assert.equal(h.system.hasActiveWorldWar(), false);
});

test('orphaned save event IDs are ignored while newly authored events initialize pending', () => {
  const h = harness([war('Known', 1950, 1)]);
  h.system.restore({
    events: [{ eventId: 'Removed', status: 'completed' }],
  });
  assert.equal(status(h.system, 'Known').status, 'pending');
  assert.ok(h.logs.some((line) => line.includes('unknown event: Removed')));
});
