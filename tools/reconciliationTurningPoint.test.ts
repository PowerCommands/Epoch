import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Nation } from '../src/entities/Nation.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import {
  RECONCILIATION_RETRY_ROUNDS,
  RECONCILIATION_TRIGGER_YEAR,
  ReconciliationTurningPointSystem,
  type SavedReconciliationTurningPointState,
} from '../src/systems/diplomacy/ReconciliationTurningPointSystem.ts';

function makeHarness(options: { humanIds?: string[]; year?: number } = {}) {
  const nations = new NationManager();
  for (const id of ['england', 'france', 'sweden', 'spain']) {
    nations.addNation(new Nation({
      id,
      name: id[0]!.toUpperCase() + id.slice(1),
      color: 0xffffff,
      isHuman: options.humanIds?.includes(id) ?? false,
    }));
  }
  const diplomacy = new DiplomacyManager();
  const living = new Set(nations.getAllNations().map((nation) => nation.id));
  const jealousyParticipants = new Set<string>();
  const messages: string[] = [];
  const history: Array<[string, string]> = [];
  let year = options.year ?? RECONCILIATION_TRIGGER_YEAR;
  let round = 100;
  const system = new ReconciliationTurningPointSystem({
    nationManager: nations,
    diplomacyManager: diplomacy,
    getGlobalYear: () => year,
    getCurrentRound: () => round,
    isNationLiving: (id) => living.has(id),
    isCulturalJealousyParticipant: (id) => jealousyParticipants.has(id),
    getNationName: (id) => nations.getNation(id)?.name ?? id,
    log: (message) => messages.push(message),
    recordHistory: (a, b) => history.push([a, b]),
  });

  const damage = (a: string, b: string, affinity = -20, hostility = 80): void => {
    diplomacy.setMemoryValues(a, b, {
      trust: 10,
      fear: 35,
      hostility,
      affinity,
      suspicion: 60,
    });
  };

  return {
    nations,
    diplomacy,
    system,
    messages,
    history,
    jealousyParticipants,
    damage,
    setYear: (value: number) => { year = value; },
    setRound: (value: number) => { round = value; },
  };
}

test('Reconciliation first becomes eligible from calendar year 1800', () => {
  const h = makeHarness({ year: RECONCILIATION_TRIGGER_YEAR - 1 });
  h.damage('england', 'france');
  h.system.handleRoundStart(100);
  assert.equal(h.system.serialize().occurred, false);

  h.setYear(RECONCILIATION_TRIGGER_YEAR);
  h.system.handleRoundStart(101);
  assert.equal(h.system.serialize().occurred, true);
  assert.deepEqual(h.history, [['england', 'france']]);
});

test('deterministically selects the first valid AI pair and logs names and transformation', () => {
  const h = makeHarness();
  h.damage('england', 'france', 12);
  h.damage('england', 'sweden', -40);
  h.system.handleRoundStart(100);

  assert.deepEqual(h.history, [['england', 'france']]);
  assert.match(h.messages[0] ?? '', /England and France reconcile/);
  assert.match(h.messages[0] ?? '', /affinity 12→50/);
});

test('nations currently at war with each other cannot reconcile', () => {
  const h = makeHarness();
  h.damage('england', 'france');
  assert.equal(h.diplomacy.declareWar('england', 'france'), true);
  h.system.handleRoundStart(100);
  assert.equal(h.system.serialize().occurred, false);
});

test('human nations cannot be selected', () => {
  const h = makeHarness({ humanIds: ['england'] });
  h.damage('england', 'france');
  h.system.handleRoundStart(100);
  assert.equal(h.system.serialize().occurred, false);
});

test('Cultural Jealousy nations and their targets cannot be selected', () => {
  const jealousNation = makeHarness();
  jealousNation.damage('england', 'france');
  jealousNation.jealousyParticipants.add('england');
  jealousNation.system.handleRoundStart(100);
  assert.equal(jealousNation.system.serialize().occurred, false);

  const jealousyTarget = makeHarness();
  jealousyTarget.damage('england', 'france');
  jealousyTarget.jealousyParticipants.add('france');
  jealousyTarget.system.handleRoundStart(100);
  assert.equal(jealousyTarget.system.serialize().occurred, false);
});

test('reset clears trust, fear, suspicion, and hostility', () => {
  const h = makeHarness();
  h.damage('england', 'france', -20);
  h.system.handleRoundStart(100);
  const relation = h.diplomacy.getRelation('england', 'france');
  assert.deepEqual(
    { trust: relation.trust, fear: relation.fear, suspicion: relation.suspicion, hostility: relation.hostility },
    { trust: 0, fear: 0, suspicion: 0, hostility: 0 },
  );
});

test('reset raises affinity below 50 to 50', () => {
  const h = makeHarness();
  h.damage('england', 'france', -20);
  h.system.handleRoundStart(100);
  const relation = h.diplomacy.getRelation('england', 'france');
  assert.equal(relation.affinity, 50);
});

test('reset never reduces affinity above 50', () => {
  const h = makeHarness();
  h.damage('england', 'france', 80, 80);
  h.system.handleRoundStart(100);
  assert.equal(h.diplomacy.getRelation('england', 'france').affinity, 80);
});

test('no candidates schedules one retry exactly ten rounds later', () => {
  const h = makeHarness();
  h.system.handleRoundStart(100);
  assert.deepEqual(h.system.serialize(), { occurred: false, nextAttemptRound: 100 + RECONCILIATION_RETRY_ROUNDS });
  assert.match(h.messages[0] ?? '', /Next attempt in 10 turns/);

  h.damage('england', 'france');
  h.system.handleRoundStart(109);
  assert.equal(h.system.serialize().occurred, false);
  h.system.handleRoundStart(110);
  assert.equal(h.system.serialize().occurred, true);
});

test('Reconciliation occurs only once per game', () => {
  const h = makeHarness();
  h.damage('england', 'france');
  h.system.handleRoundStart(100);
  h.damage('spain', 'sweden');
  h.system.handleRoundStart(110);
  assert.equal(h.history.length, 1);
});

test('normal diplomacy resumes with no ongoing agenda or protection', () => {
  const h = makeHarness();
  h.damage('england', 'france');
  h.system.handleRoundStart(100);
  // The ordinary manager remains authoritative immediately after the event.
  assert.equal(h.diplomacy.declareWar('england', 'france'), true);
  assert.equal(h.diplomacy.getState('england', 'france'), 'WAR');
  assert.deepEqual(Object.keys(h.system.serialize()).sort(), ['nextAttemptRound', 'occurred']);
});

test('save/load preserves waiting and completed state without duplicate firing', () => {
  const waiting = makeHarness();
  waiting.system.handleRoundStart(100);
  const waitingSave = JSON.parse(JSON.stringify(waiting.system.serialize())) as SavedReconciliationTurningPointState;

  const resumed = makeHarness();
  resumed.system.restore(waitingSave);
  resumed.damage('england', 'france');
  resumed.system.handleRoundStart(109);
  assert.equal(resumed.history.length, 0);
  resumed.system.handleRoundStart(110);
  assert.equal(resumed.history.length, 1);

  const completedSave = JSON.parse(JSON.stringify(resumed.system.serialize())) as SavedReconciliationTurningPointState;
  const loadedCompleted = makeHarness();
  loadedCompleted.system.restore(completedSave);
  loadedCompleted.damage('spain', 'sweden');
  loadedCompleted.system.handleRoundStart(200);
  assert.equal(loadedCompleted.history.length, 0);
  assert.equal(loadedCompleted.system.serialize().occurred, true);
});
