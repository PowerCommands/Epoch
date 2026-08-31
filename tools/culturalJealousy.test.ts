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

test('a fresh pair is only selected once no agenda remains active', () => {
  const h = makeHarness({
    year: CULTURAL_JEALOUSY_ACTIVATION_YEAR,
    cultureByNation: { leader: 40000, weakA: 1000, weakB: 2000, mid: 20000 },
  });
  h.system.handleRoundStart(1);
  h.diplomacy.declareWar('weakA', 'leader');
  h.system.handleRoundStart(2);
  // weakB still active → no re-selection; targets remain stable.
  assert.deepEqual(h.system.getActiveJealousNationIds(), ['weakB']);
  h.diplomacy.declareWar('weakB', 'leader');
  h.system.handleRoundStart(3);
  // Both terminated → a fresh pair may form from remaining peaceful pairs.
  assert.ok(!h.system.getActiveJealousNationIds().includes('weakA'));
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
