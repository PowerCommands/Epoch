/** Focused deterministic tests for the Insult Gossip expansion. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GOSSIP_DEFINITIONS } from '../src/data/gossip.ts';
import { Nation } from '../src/entities/Nation.ts';
import { DiplomacyManager, type DiplomaticMemoryValues } from '../src/systems/DiplomacyManager.ts';
import {
  calculateThreatFearMultiplier,
  GossipSystem,
  INSULT_COOLDOWN_ROUNDS,
  THREAT_COMPARABLE_FEAR_MULTIPLIER,
  THREAT_FULL_FEAR_MULTIPLIER,
  THREAT_OVERWHELMING_FEAR_MULTIPLIER,
} from '../src/systems/GossipSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { HistoricalTimelineService } from '../src/systems/HistoricalTimelineService.ts';
import { recordGossipInsultInHistory } from '../src/systems/GossipHistoryRecorder.ts';

const SOURCE = 'nation_sweden';
const RECIPIENT = 'nation_england';
const OTHER_RECIPIENT = 'nation_hre';
const INSULTS = [
  'insult_judgment',
  'insult_legacy',
  'insult_leadership',
  'threat_army_at_gates',
  'insult_unworthy',
  'threat_armies_close',
  'threat_take_lands',
] as const;
const ALL_CULTURES = [
  'political_philosophy', 'civil_service_civics', 'military_tradition',
  'nationalism', 'mobilization', 'cold_war',
];

function makeHarness(sourcePower = 100, recipientPower = 100) {
  const nations = new NationManager();
  for (const [id, name, isHuman] of [
    [SOURCE, 'Sweden', true],
    [RECIPIENT, 'England', false],
    [OTHER_RECIPIENT, 'Holy Roman Empire', false],
  ] as const) nations.addNation(new Nation({ id, name, isHuman, color: 0 }));
  nations.getNation(SOURCE)!.unlockedCultureNodeIds.push(...ALL_CULTURES);
  nations.getResources(SOURCE).influence = 100;
  const diplomacy = new DiplomacyManager();
  const power: Record<string, number> = { [SOURCE]: sourcePower, [RECIPIENT]: recipientPower, [OTHER_RECIPIENT]: recipientPower };
  let round = 100;
  let influenceSpendCalls = 0;
  const gossip = new GossipSystem(
    nations,
    diplomacy,
    { spendInfluence: () => { influenceSpendCalls += 1; return 0; } },
    () => round,
    { hasMet: () => true },
    () => 'ancient',
    (nationId) => power[nationId] ?? 0,
  );
  const setRelation = (from: string, toward: string, values: Partial<DiplomaticMemoryValues>) => {
    const current = diplomacy.getRelation(from, toward);
    diplomacy.setMemoryValues(from, toward, {
      trust: values.trust ?? current.trust,
      fear: values.fear ?? current.fear,
      hostility: values.hostility ?? current.hostility,
      affinity: values.affinity ?? current.affinity,
      suspicion: values.suspicion ?? current.suspicion,
    });
  };
  return {
    nations, diplomacy, gossip, setRelation,
    getInfluenceSpendCalls: () => influenceSpendCalls,
    setRound: (value: number) => { round = value; },
  };
}

function insult(gossip: GossipSystem, itemId: typeof INSULTS[number], recipientNationId = RECIPIENT) {
  return gossip.execute({ itemId, sourceNationId: SOURCE, recipientNationId });
}

test('catalog defines all seven weighted Insults, subtypes, and existing Culture ids', () => {
  const definitions = GOSSIP_DEFINITIONS.filter((item) => item.type === 'insult');
  assert.deepEqual(definitions.map((item) => item.id), INSULTS);
  assert.deepEqual(Object.fromEntries(definitions.map((item) => [item.id, item.insultWeight])), {
    insult_judgment: 1,
    insult_legacy: 1.1,
    insult_leadership: 1.25,
    threat_army_at_gates: 1.3,
    insult_unworthy: 1.4,
    threat_armies_close: 1.6,
    threat_take_lands: 2,
  });
  assert.deepEqual(Object.fromEntries(definitions.map((item) => [item.id, item.requiredCultureNodeId])), {
    insult_judgment: undefined,
    insult_legacy: 'political_philosophy',
    insult_leadership: 'civil_service_civics',
    threat_army_at_gates: 'military_tradition',
    insult_unworthy: 'nationalism',
    threat_armies_close: 'mobilization',
    threat_take_lands: 'cold_war',
  });
  assert.deepEqual(definitions.map((item) => item.insultSubtype), [
    'provocation', 'provocation', 'provocation', 'threat', 'provocation', 'threat', 'threat',
  ]);
  assert.ok(definitions.every((item) => !item.requiresTarget));
});

test('Culture requirements are centrally checked against the human source', () => {
  const { nations, gossip } = makeHarness();
  nations.getNation(SOURCE)!.unlockedCultureNodeIds.length = 0;
  nations.getNation(RECIPIENT)!.unlockedCultureNodeIds.push(...ALL_CULTURES);
  assert.equal(gossip.getItemAvailability(SOURCE, 'insult_judgment').available, true);
  assert.equal(gossip.getItemAvailability(SOURCE, 'insult_leadership').available, false);
  const locked = insult(gossip, 'insult_leadership');
  assert.equal(locked.success, false);
  if (!locked.success) assert.equal(locked.failureReason, 'culture_locked');
  nations.getNation(SOURCE)!.unlockedCultureNodeIds.push('civil_service_civics');
  assert.equal(insult(gossip, 'insult_leadership').success, true);
});

test('Insults spend no Influence and apply the structured recipient-to-human effect', () => {
  const { nations, diplomacy, gossip, getInfluenceSpendCalls } = makeHarness();
  let appliedFrom = '';
  let appliedToward = '';
  const originalSetMemoryValues = diplomacy.setMemoryValues.bind(diplomacy);
  diplomacy.setMemoryValues = (from, toward, values) => {
    appliedFrom = from;
    appliedToward = toward;
    originalSetMemoryValues(from, toward, values);
  };
  const beforeInfluence = nations.getResources(SOURCE).influence;
  const result = insult(gossip, 'insult_judgment');
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.influenceSpent, 0);
  assert.equal(nations.getResources(SOURCE).influence, beforeInfluence);
  assert.equal(getInfluenceSpendCalls(), 0);
  assert.equal(appliedFrom, RECIPIENT);
  assert.equal(appliedToward, SOURCE);
  assert.equal(result.diplomaticEffect?.fromNationId, RECIPIENT);
  assert.equal(result.diplomaticEffect?.towardNationId, SOURCE);
  assert.equal(result.insultWeight, 1);
  assert.equal(result.insultSubtype, 'provocation');
});

test('a successful interactive Insult can be recorded as structured History', () => {
  const { nations, gossip } = makeHarness();
  const result = insult(gossip, 'threat_army_at_gates');
  assert.equal(result.success, true);
  if (!result.success) return;

  const timeline = new HistoricalTimelineService(
    () => 100,
    () => 'January 1000 BC',
    (nationId) => nations.getNation(nationId)?.name,
    (nationId) => nationId === SOURCE ? 'Gustavus' : nationId === RECIPIENT ? 'Elizabeth' : undefined,
  );
  assert.equal(recordGossipInsultInHistory(result, timeline, {
    getNationName: (nationId) => nations.getNation(nationId)?.name,
    getLeaderName: (nationId) => nationId === SOURCE ? 'Gustavus' : nationId === RECIPIENT ? 'Elizabeth' : undefined,
  }), true);

  const [history] = timeline.getEvents();
  assert.equal(history?.type, 'leaderInsult');
  assert.equal(history?.metadata?.leaderInsultSubtype, 'threat');
  assert.equal(history?.metadata?.leaderInsultText, result.resolvedText);
  assert.deepEqual(history?.eventNationIds, [SOURCE, RECIPIENT]);
  assert.match(history?.text ?? '', /Gustavus of Sweden threatened Elizabeth of England/);
});

test('ordinary provocation effects do not depend on military power and add no Fear', () => {
  const weak = makeHarness(10, 1_000);
  const strong = makeHarness(1_000, 10);
  const weakResult = insult(weak.gossip, 'insult_unworthy');
  const strongResult = insult(strong.gossip, 'insult_unworthy');
  assert.equal(weakResult.success, true);
  assert.equal(strongResult.success, true);
  if (!weakResult.success || !strongResult.success) return;
  assert.deepEqual(weakResult.diplomaticEffect, strongResult.diplomaticEffect);
  assert.equal(weakResult.diplomaticEffect?.fearDelta, 0);
  assert.equal(weakResult.threatCredible, undefined);
});

test('central threat credibility curve covers weak, comparable, strong and overwhelming forces', () => {
  assert.equal(calculateThreatFearMultiplier(74, 100), 0);
  assert.equal(calculateThreatFearMultiplier(100, 100), THREAT_COMPARABLE_FEAR_MULTIPLIER);
  assert.equal(calculateThreatFearMultiplier(150, 100), THREAT_FULL_FEAR_MULTIPLIER);
  assert.equal(calculateThreatFearMultiplier(201, 100), THREAT_OVERWHELMING_FEAR_MULTIPLIER);
});

test('a non-credible threat adds Hostility but no Fear and returns a mocking response', () => {
  const { gossip } = makeHarness(50, 100);
  const result = insult(gossip, 'threat_army_at_gates');
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.threatCredible, false);
  assert.equal(result.fearMultiplier, 0);
  assert.equal(result.diplomaticEffect?.fearDelta, 0);
  assert.ok(result.diplomaticEffect!.hostilityDelta > 0);
  assert.match(result.responseText!, /army|soldiers|farmers/i);
});

test('comparable and clearly stronger militaries apply partial and full Fear', () => {
  const comparable = insult(makeHarness(100, 100).gossip, 'threat_armies_close');
  const stronger = insult(makeHarness(150, 100).gossip, 'threat_armies_close');
  assert.equal(comparable.success, true);
  assert.equal(stronger.success, true);
  if (!comparable.success || !stronger.success) return;
  assert.equal(comparable.fearMultiplier, 0.75);
  assert.equal(comparable.diplomaticEffect?.fearDelta, 11); // round(14 × .75)
  assert.equal(stronger.fearMultiplier, 1);
  assert.equal(stronger.diplomaticEffect?.fearDelta, 14);
  assert.match(stronger.responseText!, /warning|Threats/i);
});

test('overwhelming strength gives only Fear a modest bonus', () => {
  const full = insult(makeHarness(150, 100).gossip, 'threat_take_lands');
  const overwhelming = insult(makeHarness(250, 100).gossip, 'threat_take_lands');
  assert.equal(full.success, true);
  assert.equal(overwhelming.success, true);
  if (!full.success || !overwhelming.success) return;
  assert.equal(overwhelming.fearMultiplier, 1.25);
  assert.ok(overwhelming.diplomaticEffect!.fearDelta > full.diplomaticEffect!.fearDelta);
  assert.equal(overwhelming.diplomaticEffect?.hostilityDelta, full.diplomaticEffect?.hostilityDelta);
  assert.equal(overwhelming.diplomaticEffect?.suspicionDelta, full.diplomaticEffect?.suspicionDelta);
  assert.match(overwhelming.responseText!, /danger|strength|risk/i);
});

test('successful Insult starts a shared recipient cooldown without blocking Information or another recipient', () => {
  const { gossip } = makeHarness();
  assert.equal(insult(gossip, 'insult_judgment').success, true);
  assert.deepEqual(gossip.getInsultStatus(SOURCE, RECIPIENT, 100), {
    allowed: false, remainingRounds: INSULT_COOLDOWN_ROUNDS, failureReason: 'insult_cooldown_active',
  });
  const bypass = insult(gossip, 'threat_army_at_gates');
  assert.equal(bypass.success, false);
  if (!bypass.success) assert.equal(bypass.failureReason, 'insult_cooldown_active');
  assert.equal(gossip.execute({
    itemId: 'ask_agenda', sourceNationId: SOURCE, recipientNationId: RECIPIENT,
  }).success, true);
  assert.equal(insult(gossip, 'insult_judgment', OTHER_RECIPIENT).success, true);
});

test('Insult cooldown expires by round and survives save/restore independently', () => {
  const first = makeHarness();
  assert.equal(insult(first.gossip, 'insult_judgment').success, true);
  const second = makeHarness();
  second.gossip.restore(first.gossip.serialize());
  assert.equal(second.gossip.getInsultStatus(SOURCE, RECIPIENT, 104).remainingRounds, 1);
  assert.equal(second.gossip.getInsultStatus(SOURCE, RECIPIENT, 105).allowed, true);
  assert.equal(second.gossip.canManipulate(SOURCE, RECIPIENT, 100).allowed, true);
});

test('Insult effects clamp within existing diplomatic ranges', () => {
  const { diplomacy, gossip, setRelation } = makeHarness(300, 100);
  setRelation(RECIPIENT, SOURCE, { trust: 1, suspicion: 99, hostility: 99, affinity: 1, fear: 99 });
  const result = insult(gossip, 'threat_take_lands');
  assert.equal(result.success, true);
  const relation = diplomacy.getRelation(RECIPIENT, SOURCE);
  for (const key of ['trust', 'suspicion', 'hostility', 'affinity', 'fear'] as const) {
    assert.ok(relation[key] >= 0 && relation[key] <= 100, key);
  }
  assert.equal(relation.hostility, 100);
  assert.equal(relation.fear, 100);
});

test('threats never declare war or invoke high-level diplomatic actions', () => {
  const { diplomacy, gossip } = makeHarness(300, 100);
  let warsDeclared = 0;
  diplomacy.onWarDeclared(() => { warsDeclared += 1; });
  assert.equal(insult(gossip, 'threat_take_lands').success, true);
  assert.equal(diplomacy.getState(SOURCE, RECIPIENT), 'PEACE');
  assert.equal(warsDeclared, 0);
});

test('arbitrary source and recipient placeholders resolve in statements and responses', () => {
  const { gossip } = makeHarness();
  const result = insult(gossip, 'insult_judgment');
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.match(result.resolvedText, /Henry V/);
  assert.doesNotMatch(result.resolvedText, /\{recipientLeaderName\}/);
  assert.doesNotMatch(result.responseText!, /\{source(?:Leader|Nation)Name\}/);
  assert.match(result.responseText!, /Gustav Vasa|Sweden|words|wit|contempt/i);
});
