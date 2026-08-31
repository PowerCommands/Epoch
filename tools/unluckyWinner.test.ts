/** Focused deterministic tests for the Unlucky Winner turning point. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Nation } from '../src/entities/Nation.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { createGameDate, type GameDate } from '../src/systems/GameDate.ts';
import {
  UnluckyWinnerTurningPointSystem,
  UNLUCKY_WINNER_TRIGGER_YEAR,
  UNLUCKY_WINNER_TRIGGER_MONTH_INDEX,
  UNLUCKY_WINNER_RETRY_TURNS,
  type CulturalRankEntry,
} from '../src/systems/diplomacy/UnluckyWinnerTurningPointSystem.ts';

interface HarnessInput {
  cultureByNation: Record<string, number>;
  humanIds?: string[];
  /** Initial in-game date; defaults to exactly July 1914. */
  date?: GameDate;
}

const JULY_1914 = createGameDate(UNLUCKY_WINNER_TRIGGER_YEAR, false, UNLUCKY_WINNER_TRIGGER_MONTH_INDEX);
const BEFORE_1914 = createGameDate(1913, false, 11); // December 1913

function makeHarness(input: HarnessInput) {
  const nations = new NationManager();
  for (const [id, culture] of Object.entries(input.cultureByNation)) {
    nations.addNation(new Nation({ id, name: id, color: 0xffffff, isHuman: input.humanIds?.includes(id) ?? false }));
    nations.getResources(id).culture = culture;
  }
  const diplomacy = new DiplomacyManager();
  const messages: string[] = [];
  const living = new Set(Object.keys(input.cultureByNation));
  let date = input.date ?? JULY_1914;
  let turn = 1;

  // Strongest -> weakest by culture, deterministic id tie-break — mirrors
  // VictorySystem.getCulturalVictoryRanking's primary sort.
  const ranking = (): CulturalRankEntry[] =>
    Object.keys(input.cultureByNation)
      .map((id) => ({ nationId: id, cultureValue: nations.getResources(id).culture }))
      .sort((a, b) => (b.cultureValue - a.cultureValue) || a.nationId.localeCompare(b.nationId));

  const system = new UnluckyWinnerTurningPointSystem({
    nationManager: nations,
    diplomacyManager: diplomacy,
    getGameDate: () => date,
    getCurrentTurn: () => turn,
    getCulturalRanking: ranking,
    isNationLiving: (id) => living.has(id),
    getNationName: (id) => id,
    log: (message) => messages.push(message),
  });

  return {
    nations,
    diplomacy,
    system,
    messages,
    setDate: (value: GameDate) => { date = value; },
    setTurn: (value: number) => { turn = value; },
    kill: (id: string) => living.delete(id),
    tick: (t?: number) => { if (t !== undefined) turn = t; system.handleTurnStart(turn); },
  };
}

test('nothing happens before July 1914', () => {
  const h = makeHarness({
    date: BEFORE_1914,
    cultureByNation: { China: 40000, France: 20000, USA: 15000, Mongolia: 8000, England: 3000 },
  });
  h.tick(1);
  assert.equal(h.system.serialize().armed, false);
  assert.equal(h.system.serialize().completed, false);
  assert.equal(h.messages.length, 0);
});

test('in July 1914 the strongest AI attacks the weakest available nation', () => {
  const h = makeHarness({
    cultureByNation: { China: 40000, France: 20000, USA: 15000, Mongolia: 8000, England: 3000 },
  });
  h.tick(1);
  const saved = h.system.serialize();
  assert.equal(saved.armed, true);
  assert.equal(saved.attackerId, 'China', 'strongest AI is the attacker');
  assert.equal(saved.targetId, 'England', 'culturally weakest available nation is the target');
  // Attacker is now hostile enough for normal AI war logic (>= 50 hostile bar).
  assert.ok(h.diplomacy.getRelation('China', 'England').hostility >= 50);
  assert.ok(h.messages.some((m) => /China selected as cultural leader/.test(m)));
  assert.ok(h.messages.some((m) => /England selected as culturally weakest available target/.test(m)));
});

test('the human is never selected as attacker even when culturally strongest', () => {
  const h = makeHarness({
    humanIds: ['China'],
    cultureByNation: { China: 40000, France: 20000, USA: 15000, Mongolia: 8000, England: 3000 },
  });
  h.tick(1);
  const saved = h.system.serialize();
  assert.equal(saved.attackerId, 'France', 'highest-ranked AI is chosen, skipping the human leader');
  assert.equal(saved.targetId, 'England');
});

test('the human may be selected as the target', () => {
  const h = makeHarness({
    humanIds: ['England'],
    cultureByNation: { China: 40000, France: 20000, USA: 15000, Mongolia: 8000, England: 3000 },
  });
  h.tick(1);
  const saved = h.system.serialize();
  assert.equal(saved.attackerId, 'China');
  assert.equal(saved.targetId, 'England', 'the human is an allowed target');
});

test('a target already at war with the attacker is skipped for the next weakest', () => {
  const h = makeHarness({
    cultureByNation: { China: 40000, France: 20000, USA: 15000, Mongolia: 8000, England: 3000 },
  });
  h.diplomacy.declareWar('China', 'England'); // weakest is unavailable
  h.tick(1);
  const saved = h.system.serialize();
  assert.equal(saved.attackerId, 'China');
  assert.equal(saved.targetId, 'Mongolia', 'next culturally weakest valid nation is chosen');
});

test('no valid target does not consume the event — it retries and later arms', () => {
  const h = makeHarness({
    cultureByNation: { China: 40000, England: 3000 },
  });
  // China at war with its only possible target → no valid new-war target.
  h.diplomacy.declareWar('China', 'England');
  h.tick(1);
  let saved = h.system.serialize();
  assert.equal(saved.armed, false, 'not armed');
  assert.equal(saved.completed, false, 'not consumed');
  assert.equal(saved.nextRetryTurn, 1 + UNLUCKY_WINNER_RETRY_TURNS, 'a short retry is scheduled');
  assert.ok(h.messages.some((m) => /No valid new-war target/.test(m)));

  // Before the retry turn nothing happens.
  h.tick(1 + UNLUCKY_WINNER_RETRY_TURNS - 1);
  assert.equal(h.system.serialize().armed, false);

  // Peace restores a valid target → on the retry turn it arms.
  h.diplomacy.enforceCeasefire('China', 'England', 5, 2);
  h.tick(1 + UNLUCKY_WINNER_RETRY_TURNS);
  saved = h.system.serialize();
  assert.equal(saved.armed, true);
  assert.equal(saved.attackerId, 'China');
  assert.equal(saved.targetId, 'England');
});

test('once the intended war starts the event completes and removes only its own influence', () => {
  const h = makeHarness({
    cultureByNation: { China: 40000, France: 20000, USA: 15000, Mongolia: 8000, England: 3000 },
  });
  h.tick(1); // arms China -> England
  const afterArm = h.diplomacy.getRelation('China', 'England');
  assert.ok(afterArm.hostility >= 50);

  // Normal AI logic declares the war; the declaration + a capture then apply
  // their own, non-Unlucky-Winner diplomatic damage.
  h.diplomacy.declareWar('China', 'England');
  const atWar = h.diplomacy.getRelation('China', 'England');
  h.diplomacy.setMemoryValues('China', 'England', {
    trust: atWar.trust,
    fear: 40, // war-driven fear (never touched by Unlucky Winner)
    hostility: atWar.hostility + 15, // capture-driven hostility
    affinity: atWar.affinity,
    suspicion: atWar.suspicion,
  });

  h.tick(2); // detects war → completes and removes influence
  const saved = h.system.serialize();
  assert.equal(saved.completed, true);
  assert.equal(saved.armed, false);
  assert.equal(saved.influence, undefined, 'influence ledger cleared');

  const after = h.diplomacy.getRelation('China', 'England');
  assert.equal(after.hostility, 15, 'only the non-UW war/capture hostility remains');
  assert.equal(after.fear, 40, 'war-driven fear preserved');
  assert.equal(after.trust, 50, 'UW trust loss removed, back to untouched baseline');
  assert.equal(after.suspicion, 0, 'UW suspicion removed');
  assert.ok(h.messages.some((m) => /China declared war on England/.test(m)));
  assert.ok(h.messages.some((m) => /Temporary relation influence removed/.test(m)));
  assert.ok(h.messages.some((m) => /Event completed/.test(m)));
});

test('the event fires only once — it never re-arms after completing', () => {
  const h = makeHarness({
    cultureByNation: { China: 40000, France: 20000, USA: 15000, Mongolia: 8000, England: 3000 },
  });
  h.tick(1);
  h.diplomacy.declareWar('China', 'England');
  h.tick(2); // completes
  assert.equal(h.system.serialize().completed, true);

  const messagesBefore = h.messages.length;
  for (let t = 3; t <= 40; t += 1) h.tick(t);
  assert.equal(h.messages.length, messagesBefore, 'no further activity after completion');
  assert.equal(h.system.serialize().armed, false);
});

test('while armed and not yet at war the hostility pressure is maintained', () => {
  const h = makeHarness({
    cultureByNation: { China: 40000, France: 20000, USA: 15000, Mongolia: 8000, England: 3000 },
  });
  h.tick(1);
  const armed = h.diplomacy.getRelation('China', 'England').hostility;
  // The AI has not declared war yet; the turning point keeps the pressure on.
  h.tick(2);
  h.tick(3);
  const later = h.diplomacy.getRelation('China', 'England').hostility;
  assert.ok(later >= armed, 'hostility does not fall away while waiting for the AI to act');
  assert.equal(h.system.serialize().armed, true, 'still armed until the war starts');
});

test('an armed event survives save/load and still removes its influence after reload', () => {
  const first = makeHarness({
    cultureByNation: { China: 40000, France: 20000, USA: 15000, Mongolia: 8000, England: 3000 },
  });
  first.tick(1); // arms China -> England
  const saved = first.system.serialize();
  assert.equal(saved.armed, true);
  const savedRelation = first.diplomacy.getRelation('China', 'England');

  // Rebuild a fresh game the way save/load does and restore the turning point.
  const reloaded = makeHarness({
    cultureByNation: { China: 40000, France: 20000, USA: 15000, Mongolia: 8000, England: 3000 },
  });
  reloaded.diplomacy.setMemoryValues('China', 'England', {
    trust: savedRelation.trust,
    fear: savedRelation.fear,
    hostility: savedRelation.hostility,
    affinity: savedRelation.affinity,
    suspicion: savedRelation.suspicion,
  });
  reloaded.system.restore(saved);

  reloaded.diplomacy.declareWar('China', 'England');
  reloaded.tick(2);
  const after = reloaded.diplomacy.getRelation('China', 'England');
  assert.equal(reloaded.system.serialize().completed, true, 'completes after reload');
  assert.equal(after.hostility, 0, 'persisted UW hostility removed after reload');
  assert.equal(after.suspicion, 0, 'persisted UW suspicion removed after reload');
  assert.equal(after.trust, 50, 'persisted UW trust loss removed after reload');
});

test('a completed event stays completed across save/load', () => {
  const first = makeHarness({
    cultureByNation: { China: 40000, France: 20000, USA: 15000, Mongolia: 8000, England: 3000 },
  });
  first.tick(1);
  first.diplomacy.declareWar('China', 'England');
  first.tick(2);
  const saved = first.system.serialize();
  assert.equal(saved.completed, true);

  const reloaded = makeHarness({
    cultureByNation: { China: 40000, France: 20000, USA: 15000, Mongolia: 8000, England: 3000 },
  });
  reloaded.system.restore(saved);
  for (let t = 3; t <= 30; t += 1) reloaded.tick(t);
  assert.equal(reloaded.system.serialize().armed, false, 'never re-arms after a reloaded completion');
  assert.equal(reloaded.system.serialize().completed, true);
});
