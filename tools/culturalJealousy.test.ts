/** Focused deterministic tests for the Cultural Jealousy agenda. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Nation } from '../src/entities/Nation.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import {
  CulturalJealousySystem,
  CULTURAL_JEALOUSY_ACTIVATION_YEAR,
} from '../src/systems/diplomacy/CulturalJealousySystem.ts';
import {
  evaluateEconomicPressureWillingness,
  type EconomicPressureWillingnessInput,
} from '../src/systems/ai/AIDiplomacySystem.ts';
import { GossipFlavorEventSystem } from '../src/systems/GossipFlavorEventSystem.ts';
import { HistoricalTimelineService } from '../src/systems/HistoricalTimelineService.ts';

interface HarnessInput {
  cultureByNation: Record<string, number>;
  humanIds?: string[];
  year: number;
}

function makeHarness(input: HarnessInput) {
  const nations = new NationManager();
  for (const [id, culture] of Object.entries(input.cultureByNation)) {
    nations.addNation(new Nation({ id, name: id, color: 0xffffff, isHuman: input.humanIds?.includes(id) ?? false }));
    nations.getResources(id).culture = culture;
  }
  const diplomacy = new DiplomacyManager();
  const messages: string[] = [];
  let year = input.year;
  const living = new Set(Object.keys(input.cultureByNation));
  const system = new CulturalJealousySystem({
    nationManager: nations,
    diplomacyManager: diplomacy,
    getGlobalYear: () => year,
    isNationLiving: (id) => living.has(id),
    getCultureScore: (id) => nations.getResources(id).culture,
    getNationName: (id) => id,
    log: (message) => messages.push(message),
  });
  return {
    nations,
    diplomacy,
    system,
    messages,
    setYear: (value: number) => { year = value; },
    kill: (id: string) => living.delete(id),
  };
}

test('nothing happens before the activation year', () => {
  const h = makeHarness({
    year: CULTURAL_JEALOUSY_ACTIVATION_YEAR - 1,
    cultureByNation: { leader: 40000, weakA: 1000, weakB: 2000, mid: 20000 },
  });
  h.system.handleRoundStart(1);
  assert.equal(h.system.getActiveJealousNationIds().length, 0);
  assert.equal(h.nations.getNation('weakA')?.culturalJealousyTargetId, undefined);
});

test('at the activation year the two lowest AI nations resent the cultural leader', () => {
  const h = makeHarness({
    year: CULTURAL_JEALOUSY_ACTIVATION_YEAR,
    cultureByNation: { leader: 40000, weakA: 1000, weakB: 2000, mid: 20000 },
  });
  h.system.handleRoundStart(1);
  assert.deepEqual(h.system.getActiveJealousNationIds(), ['weakA', 'weakB']);
  assert.equal(h.system.getJealousyTargetId('weakA'), 'leader');
  assert.equal(h.system.getJealousyTargetId('weakB'), 'leader');
  assert.match(h.messages[0] ?? '', /CULTURAL JEALOUSY: weakA \(1000\) and weakB \(2000\) resent leader \(40000\)\./);
});

test('a human low-culture nation is never made jealous', () => {
  const h = makeHarness({
    year: CULTURAL_JEALOUSY_ACTIVATION_YEAR,
    humanIds: ['weakA'],
    cultureByNation: { leader: 40000, weakA: 1000, weakB: 2000, mid: 20000 },
  });
  h.system.handleRoundStart(1);
  // weakA is human → skipped; the next-lowest AI (mid) joins weakB.
  assert.deepEqual(h.system.getActiveJealousNationIds(), ['mid', 'weakB']);
  assert.equal(h.nations.getNation('weakA')?.culturalJealousyTargetId, undefined);
});

test('activation warms the two jealous nations and sours them toward the leader', () => {
  const h = makeHarness({
    year: CULTURAL_JEALOUSY_ACTIVATION_YEAR,
    cultureByNation: { leader: 40000, weakA: 1000, weakB: 2000, mid: 20000 },
  });
  const peerBefore = h.diplomacy.getRelation('weakA', 'weakB');
  const targetBefore = h.diplomacy.getRelation('weakA', 'leader');
  h.system.handleRoundStart(1);
  const peerAfter = h.diplomacy.getRelation('weakA', 'weakB');
  const targetAfter = h.diplomacy.getRelation('weakA', 'leader');

  assert.ok(peerAfter.affinity > peerBefore.affinity, 'peer affinity should rise');
  assert.ok(peerAfter.trust > peerBefore.trust, 'peer trust should rise');
  assert.ok(targetAfter.hostility > targetBefore.hostility, 'hostility toward leader should rise');
  assert.ok(targetAfter.suspicion > targetBefore.suspicion, 'suspicion toward leader should rise');
  assert.ok(targetAfter.trust < targetBefore.trust, 'trust toward leader should fall');
});

test('reinforcement drives the relation toward severe hostility over several rounds', () => {
  const h = makeHarness({
    year: CULTURAL_JEALOUSY_ACTIVATION_YEAR,
    cultureByNation: { leader: 40000, weakA: 1000, weakB: 2000, mid: 20000 },
  });
  for (let round = 1; round <= 12; round += 1) h.system.handleRoundStart(round);
  const relation = h.diplomacy.getRelation('weakA', 'leader');
  assert.ok(relation.hostility >= 65, `hostility should climb high, got ${relation.hostility}`);
  const tension = relation.hostility + relation.suspicion - relation.trust - relation.affinity;
  assert.ok(tension >= 100, `tension should reach the severe-hostility bar, got ${tension}`);
});

test('an agenda terminates when the jealous nation goes to war with its target', () => {
  const h = makeHarness({
    year: CULTURAL_JEALOUSY_ACTIVATION_YEAR,
    cultureByNation: { leader: 40000, weakA: 1000, weakB: 2000, mid: 20000 },
  });
  h.system.handleRoundStart(1);
  assert.equal(h.system.getJealousyTargetId('weakA'), 'leader');

  h.diplomacy.declareWar('weakA', 'leader');
  h.system.handleRoundStart(2);
  assert.equal(h.system.getJealousyTargetId('weakA'), undefined, 'weakA agenda ends at war');
  assert.equal(h.system.getJealousyTargetId('weakB'), 'leader', 'weakB agenda independent');
  assert.ok(h.messages.some((m) => /at war with leader — jealousy agenda fulfilled/.test(m)));
});

test('an active agenda blocks re-selection but a single terminated one leaves its peer running', () => {
  const h = makeHarness({
    year: CULTURAL_JEALOUSY_ACTIVATION_YEAR,
    cultureByNation: { leader: 40000, weakA: 1000, weakB: 2000, mid: 20000 },
  });
  h.system.handleRoundStart(1);
  h.diplomacy.declareWar('weakA', 'leader');
  h.system.handleRoundStart(2);
  // weakB still active → no re-selection; targets remain stable.
  assert.deepEqual(h.system.getActiveJealousNationIds(), ['weakB']);
});

test('a failed candidate search does NOT consume the turning point (retries normally)', () => {
  const h = makeHarness({
    year: CULTURAL_JEALOUSY_ACTIVATION_YEAR,
    cultureByNation: { leader: 40000, weakA: 1000, weakB: 2000 },
  });
  // Both eligible AI nations already at war with the leader → no valid pair.
  h.diplomacy.declareWar('weakA', 'leader');
  h.diplomacy.declareWar('weakB', 'leader');
  h.system.handleRoundStart(1);
  assert.equal(h.system.getActiveJealousNationIds().length, 0, 'no pair could form');
  assert.equal(h.system.serialize().consumed, false, 'a failed search must not consume the event');

  // Peace restores eligibility → on a later round the turning point still fires.
  h.diplomacy.enforceCeasefire('weakA', 'leader', 5, 1);
  h.diplomacy.enforceCeasefire('weakB', 'leader', 5, 1);
  h.system.handleRoundStart(2);
  assert.deepEqual(h.system.getActiveJealousNationIds(), ['weakA', 'weakB'], 'retry succeeds later');
  assert.equal(h.system.serialize().consumed, true, 'a successful pair consumes the event');
});

test('the turning point fires exactly once — terminated agendas never reopen it', () => {
  // Five weak AI nations so a *second* pair would be trivially available after
  // the first pair terminates; the fix must still refuse to form one.
  const h = makeHarness({
    year: CULTURAL_JEALOUSY_ACTIVATION_YEAR,
    cultureByNation: { leader: 40000, weakA: 1000, weakB: 2000, weakC: 3000, weakD: 4000 },
  });
  h.system.handleRoundStart(1);
  assert.deepEqual(h.system.getActiveJealousNationIds(), ['weakA', 'weakB']);
  assert.equal(h.system.serialize().consumed, true);

  // Both agendas terminate (war with the leader) — purpose served.
  h.diplomacy.declareWar('weakA', 'leader');
  h.diplomacy.declareWar('weakB', 'leader');
  h.system.handleRoundStart(2);
  assert.equal(h.system.getActiveJealousNationIds().length, 0, 'both agendas terminated');

  // Many further rounds: weakC/weakD are perfectly eligible, yet no pair forms.
  for (let round = 3; round <= 40; round += 1) h.system.handleRoundStart(round);
  assert.equal(h.system.getActiveJealousNationIds().length, 0, 'no second Cultural Jealousy pair ever forms');
  assert.equal(h.nations.getNation('weakC')?.culturalJealousyTargetId, undefined);
  assert.equal(h.nations.getNation('weakD')?.culturalJealousyTargetId, undefined);
});

test('the consumed flag survives save/load — a reloaded game cannot fire a second pair', () => {
  const first = makeHarness({
    year: CULTURAL_JEALOUSY_ACTIVATION_YEAR,
    cultureByNation: { leader: 40000, weakA: 1000, weakB: 2000, weakC: 3000, weakD: 4000 },
  });
  first.system.handleRoundStart(1);
  assert.equal(first.system.serialize().consumed, true);

  // Simulate save → load into a brand-new game/system with the same nations,
  // none of them yet carrying a jealousy agenda (agendas long since ended).
  const saved = first.system.serialize();
  const reloaded = makeHarness({
    year: CULTURAL_JEALOUSY_ACTIVATION_YEAR + 20,
    cultureByNation: { leader: 40000, weakA: 1000, weakB: 2000, weakC: 3000, weakD: 4000 },
  });
  reloaded.system.restore(saved);

  for (let round = 1; round <= 30; round += 1) reloaded.system.handleRoundStart(round);
  assert.equal(reloaded.system.getActiveJealousNationIds().length, 0, 'reloaded game never re-fires');
});

test('terminating an agenda removes only CJ influence and preserves later war changes', () => {
  const h = makeHarness({
    year: CULTURAL_JEALOUSY_ACTIVATION_YEAR,
    cultureByNation: { leader: 40000, weakA: 1000, weakB: 2000, mid: 20000 },
  });
  const before = h.diplomacy.getRelation('weakA', 'leader'); // neutral defaults
  assert.equal(before.hostility, 0);
  assert.equal(before.trust, 50);

  h.system.handleRoundStart(1);
  const afterActivation = h.diplomacy.getRelation('weakA', 'leader');
  assert.ok(afterActivation.hostility > 0, 'CJ modified relations (point 1)');
  assert.ok(afterActivation.suspicion > 0);
  assert.ok(afterActivation.trust < 50);

  // The intended war actually starts (point 2), then independent, non-CJ damage
  // occurs during it: war-driven fear and a city-capture hostility spike.
  h.diplomacy.declareWar('weakA', 'leader');
  const relAtWar = h.diplomacy.getRelation('weakA', 'leader');
  h.diplomacy.setMemoryValues('weakA', 'leader', {
    trust: relAtWar.trust,
    fear: 40, // war-driven fear (CJ never touches fear)
    hostility: relAtWar.hostility + 20, // capture-driven hostility
    affinity: relAtWar.affinity,
    suspicion: relAtWar.suspicion,
  });

  h.system.handleRoundStart(2); // weakA is at war → agenda completes (point 3), CJ influence removed (point 4)

  const afterRemoval = h.diplomacy.getRelation('weakA', 'leader');
  // CJ's own hostility swing is gone; only the +20 capture damage remains (point 5).
  assert.equal(afterRemoval.hostility, 20, 'only the non-CJ war/capture hostility remains');
  assert.equal(afterRemoval.fear, 40, 'war-driven fear is preserved');
  assert.equal(afterRemoval.trust, 50, 'CJ trust loss removed, back to the untouched baseline');
  assert.equal(afterRemoval.suspicion, 0, 'CJ suspicion removed');
  // The influence ledger no longer carries this pair (no lingering artificial state).
  assert.ok(!h.system.serialize().influence?.some((e) =>
    (e.a === 'weakA' && e.b === 'leader') || (e.a === 'leader' && e.b === 'weakA')));
  assert.ok(h.messages.some((m) => /removed temporary antagonist hostility between weakA and leader/.test(m)));
});

test('CJ influence ledger survives serialize/restore and is still removed correctly after reload', () => {
  const first = makeHarness({
    year: CULTURAL_JEALOUSY_ACTIVATION_YEAR,
    cultureByNation: { leader: 40000, weakA: 1000, weakB: 2000, mid: 20000 },
  });
  first.system.handleRoundStart(1);
  const saved = first.system.serialize();
  assert.ok((saved.influence?.length ?? 0) > 0, 'activation recorded influence to persist');
  const savedRelation = first.diplomacy.getRelation('weakA', 'leader');

  // Rebuild a fresh game the way save/load does: nation agenda flags, relation
  // memory, and the turning-point state are each restored independently.
  const reloaded = makeHarness({
    year: CULTURAL_JEALOUSY_ACTIVATION_YEAR,
    cultureByNation: { leader: 40000, weakA: 1000, weakB: 2000, mid: 20000 },
  });
  reloaded.nations.getNation('weakA')!.culturalJealousyTargetId = 'leader';
  reloaded.nations.getNation('weakB')!.culturalJealousyTargetId = 'leader';
  reloaded.diplomacy.setMemoryValues('weakA', 'leader', {
    trust: savedRelation.trust,
    fear: savedRelation.fear,
    hostility: savedRelation.hostility,
    affinity: savedRelation.affinity,
    suspicion: savedRelation.suspicion,
  });
  reloaded.system.restore(saved);

  // War starts after the reload; terminating still subtracts the persisted CJ delta.
  reloaded.diplomacy.declareWar('weakA', 'leader');
  reloaded.system.handleRoundStart(2);
  const afterRemoval = reloaded.diplomacy.getRelation('weakA', 'leader');
  assert.equal(afterRemoval.hostility, 0, 'persisted CJ hostility removed after reload');
  assert.equal(afterRemoval.suspicion, 0, 'persisted CJ suspicion removed after reload');
  assert.equal(afterRemoval.trust, 50, 'persisted CJ trust loss removed after reload');
});

test('tariff willingness rises above threshold for a jealousy target', () => {
  const base: EconomicPressureWillingnessInput = {
    attitude: 'neutral',
    trust: 45,
    hostility: 40,
    affinity: 0,
    suspicion: 20,
    ideologyCompatibility: 0,
    militaryComparison: 'equal',
    threatLevel: 'low',
    warTooRisky: false,
    currentPressure: null,
    diplomacyBias: 0,
  };
  const without = evaluateEconomicPressureWillingness(base);
  const withJealousy = evaluateEconomicPressureWillingness({ ...base, culturalJealousyBias: 0.35 });
  assert.ok(withJealousy.tariffs > without.tariffs, 'jealousy raises tariff willingness');
  assert.ok(without.tariffs < 0.48, 'baseline stays below the tariff threshold');
  assert.ok(withJealousy.tariffs >= 0.48, 'jealousy pushes past the tariff threshold');
});

test('a jealous nation preferentially insults its target even before severe hostility', () => {
  const nations = new NationManager();
  for (const id of ['leader', 'weakA']) {
    nations.addNation(new Nation({ id, name: id, color: 0xffffff }));
  }
  const diplomacy = new DiplomacyManager();
  nations.getNation('weakA')!.culturalJealousyTargetId = 'leader';
  const timeline = new HistoricalTimelineService(() => 1, () => 'Year 1500');
  const gossip = new GossipFlavorEventSystem({
    nationManager: nations,
    diplomacyManager: diplomacy,
    historicalTimeline: timeline,
    getRound: () => 5,
    getMilitaryPower: () => 100,
    isNationActive: () => true,
    isCulturalJealousyAggressor: (speakerId, recipientId) =>
      nations.getNation(speakerId)?.culturalJealousyTargetId === recipientId,
    randomSeed: 'jealousy-test',
    roll: () => 0, // force the probability + selection rolls to succeed
  });
  const results = gossip.handlePeriodicRound(5);
  assert.equal(results.length, 1, 'exactly one insult from the jealous pair');
  assert.equal(results[0]?.speakerNationId, 'weakA', 'the jealous nation is the speaker');
  assert.equal(results[0]?.recipientNationId, 'leader', 'the leader is the target');
});
