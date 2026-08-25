/** Focused Information Gossip expansion tests. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GOSSIP_DEFINITIONS } from '../src/data/gossip.ts';
import { Nation } from '../src/entities/Nation.ts';
import { DiplomacyManager, type DiplomaticMemoryValues } from '../src/systems/DiplomacyManager.ts';
import { GossipSystem } from '../src/systems/GossipSystem.ts';
import {
  calculateGossipRivalryScore,
  calculateGossipWarRiskScore,
} from '../src/systems/gossip/GossipInformationResolver.ts';
import { NationManager } from '../src/systems/NationManager.ts';

const SWEDEN = 'nation_sweden';
const ENGLAND = 'nation_england';
const FRANCE = 'nation_france';
const HRE = 'nation_hre';
const OTTOMAN = 'nation_ottoman';

function pairKey(a: string, b: string): string { return a < b ? `${a}|${b}` : `${b}|${a}`; }

function makeHarness(knownPairs?: readonly (readonly [string, string])[]) {
  const nations = new NationManager();
  const configs = [
    { id: SWEDEN, name: 'Sweden', isHuman: true, aiStrategyId: 'balanced' },
    { id: ENGLAND, name: 'England', isHuman: false, aiStrategyId: 'baseline', aiNationalAgendaId: 'naval_power' as const },
    { id: FRANCE, name: 'France', isHuman: false, aiStrategyId: 'economic' },
    { id: HRE, name: 'Holy Roman Empire', isHuman: false, aiStrategyId: 'defensive' },
    { id: OTTOMAN, name: 'Ottoman Empire', isHuman: false, aiStrategyId: 'aggressive' },
  ];
  for (const config of configs) nations.addNation(new Nation({ ...config, color: 0 }));
  const diplomacy = new DiplomacyManager();
  const known = new Set((knownPairs ?? configs
    .filter((nation) => nation.id !== ENGLAND)
    .map((nation) => [ENGLAND, nation.id] as const))
    .map(([a, b]) => pairKey(a, b)));
  // The player knows every target used by ask_opinion.
  for (const nation of configs) known.add(pairKey(SWEDEN, nation.id));
  const gateway = {
    spendInfluence: () => 0,
  };
  const gossip = new GossipSystem(nations, diplomacy, gateway, () => 100, {
    hasMet: (a, b) => a === b || known.has(pairKey(a, b)),
  });
  const relation = (a: string, b: string, values: Partial<DiplomaticMemoryValues>) => {
    const current = diplomacy.getRelation(a, b);
    diplomacy.setMemoryValues(a, b, {
      trust: values.trust ?? current.trust,
      fear: values.fear ?? current.fear,
      hostility: values.hostility ?? current.hostility,
      affinity: values.affinity ?? current.affinity,
      suspicion: values.suspicion ?? current.suspicion,
    });
  };
  return { nations, diplomacy, gossip, relation };
}

function unlock(nations: NationManager, cultureId: string): void {
  nations.getNation(SWEDEN)!.unlockedCultureNodeIds.push(cultureId);
}

function ask(gossip: GossipSystem, itemId: string) {
  return gossip.execute({ itemId, sourceNationId: SWEDEN, recipientNationId: ENGLAND });
}

test('all eight Information definitions have the intended unlock progression', () => {
  const information = GOSSIP_DEFINITIONS.filter((item) => item.type === 'information');
  assert.equal(information.length, 8);
  const requirements = Object.fromEntries(information.map((item) => [item.id, item.requiredCultureNodeId]));
  assert.deepEqual(requirements, {
    ask_opinion: undefined,
    ask_agenda: 'political_philosophy',
    ask_most_trusted: 'political_philosophy',
    ask_least_trusted: 'political_philosophy',
    ask_most_feared: 'defensive_tactics',
    ask_greatest_rival: 'nationalism',
    ask_war_risk: 'cold_war',
    ask_sports_preferences: undefined,
  });
});

test('culture requirements belong to the human source and centrally gate execution', () => {
  const { nations, gossip } = makeHarness();
  nations.getNation(ENGLAND)!.unlockedCultureNodeIds.push('political_philosophy');
  assert.deepEqual(gossip.getItemAvailability(SWEDEN, 'ask_agenda'), {
    available: false,
    failureReason: 'culture_locked',
    requiredCultureNodeId: 'political_philosophy',
    requiredCultureNodeName: 'Political Philosophy',
  });
  const locked = ask(gossip, 'ask_agenda');
  assert.equal(locked.success, false);
  if (!locked.success) assert.equal(locked.failureReason, 'culture_locked');
  unlock(nations, 'political_philosophy');
  assert.equal(gossip.getItemAvailability(SWEDEN, 'ask_agenda').available, true);
  assert.equal(ask(gossip, 'ask_agenda').success, true);
});

test('Information questions do not mutate diplomatic relations', () => {
  const { nations, gossip, diplomacy, relation } = makeHarness();
  nations.getNation(SWEDEN)!.unlockedCultureNodeIds.push(
    'political_philosophy', 'defensive_tactics', 'nationalism', 'cold_war',
  );
  relation(ENGLAND, FRANCE, { trust: 12, fear: 44, hostility: 55, suspicion: 30, affinity: 2 });
  const before = diplomacy.getAllStates();
  for (const item of GOSSIP_DEFINITIONS.filter((definition) => (
    definition.type === 'information'
    && definition.id !== 'ask_opinion'
    && definition.id !== 'ask_sports_preferences'
  ))) {
    assert.equal(ask(gossip, item.id).success, true);
  }
  assert.deepEqual(diplomacy.getAllStates(), before);
});

test('most- and least-trusted use recipient relations and return structured subjects', () => {
  const { nations, gossip, relation } = makeHarness();
  unlock(nations, 'political_philosophy');
  relation(ENGLAND, SWEDEN, { trust: 65 });
  relation(ENGLAND, FRANCE, { trust: 90 });
  relation(ENGLAND, HRE, { trust: 10 });
  const most = ask(gossip, 'ask_most_trusted');
  const least = ask(gossip, 'ask_least_trusted');
  assert.equal(most.success, true);
  assert.equal(least.success, true);
  if (!most.success || !least.success) return;
  assert.equal(most.resolvedSubjectNationId, FRANCE);
  assert.equal(most.resolvedSubjectNationName, 'France');
  assert.equal(most.resolvedSubjectLeaderId, 'leader_charles_vii');
  assert.equal(most.resolvedSubjectLeaderName, 'Charles VII');
  assert.equal(least.resolvedSubjectNationId, HRE);
  assert.match(least.responseText!, /Sigismund/);
});

test('most-feared chooses highest fear and names no one when every fear is zero', () => {
  const first = makeHarness();
  unlock(first.nations, 'defensive_tactics');
  first.relation(ENGLAND, FRANCE, { fear: 30 });
  first.relation(ENGLAND, HRE, { fear: 70 });
  const feared = ask(first.gossip, 'ask_most_feared');
  assert.equal(feared.success, true);
  if (feared.success) assert.equal(feared.resolvedSubjectNationId, HRE);

  const second = makeHarness();
  unlock(second.nations, 'defensive_tactics');
  const noFear = ask(second.gossip, 'ask_most_feared');
  assert.equal(noFear.success, true);
  if (noFear.success) {
    assert.equal(noFear.resolvedSubjectNationId, undefined);
    assert.match(noFear.responseText!, /no one|no one particularly/i);
  }
});

test('greatest rival uses the combined named-weight relation score', () => {
  const { nations, gossip, diplomacy, relation } = makeHarness();
  unlock(nations, 'nationalism');
  relation(ENGLAND, FRANCE, { trust: 5, fear: 20, hostility: 75, suspicion: 60, affinity: 0 });
  relation(ENGLAND, HRE, { trust: 20, fear: 10, hostility: 45, suspicion: 30, affinity: 0 });
  assert.ok(calculateGossipRivalryScore(diplomacy.getRelation(ENGLAND, FRANCE))
    > calculateGossipRivalryScore(diplomacy.getRelation(ENGLAND, HRE)));
  const result = ask(gossip, 'ask_greatest_rival');
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.resolvedSubjectNationId, FRANCE);
});

test('war risk combines recipient threat signals with actual candidate aggression', () => {
  const { nations, gossip, diplomacy, relation } = makeHarness();
  unlock(nations, 'cold_war');
  relation(ENGLAND, OTTOMAN, { hostility: 20, suspicion: 20, fear: 10 });
  relation(ENGLAND, FRANCE, { hostility: 20, suspicion: 20, fear: 10 });
  const ottomanSignals = {
    relation: diplomacy.getRelation(ENGLAND, OTTOMAN),
    leaderAggressionBias: 20,
    ideologyWarBias: 30,
    strategyAggression: 1.8,
  };
  const franceSignals = {
    relation: diplomacy.getRelation(ENGLAND, FRANCE),
    leaderAggressionBias: -12,
    ideologyWarBias: 6,
    strategyAggression: 0.8,
  };
  assert.ok(calculateGossipWarRiskScore(ottomanSignals) > calculateGossipWarRiskScore(franceSignals));
  const result = ask(gossip, 'ask_war_risk');
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.resolvedSubjectNationId, OTTOMAN);
});

test('unmet civilizations are not leaked and equal scores break ties by nation id', () => {
  const { nations, gossip, relation } = makeHarness([[ENGLAND, SWEDEN], [ENGLAND, HRE]]);
  unlock(nations, 'political_philosophy');
  relation(ENGLAND, FRANCE, { trust: 100 }); // unknown to England
  relation(ENGLAND, SWEDEN, { trust: 50 });
  relation(ENGLAND, HRE, { trust: 50 });
  const result = ask(gossip, 'ask_most_trusted');
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.resolvedSubjectNationId, HRE);
});

test('agenda reflects current strategy and changes when that strategy changes', () => {
  const { nations, gossip } = makeHarness();
  unlock(nations, 'political_philosophy');
  const recipient = nations.getNation(ENGLAND)!;
  recipient.aiStrategyId = 'economic';
  const economic = ask(gossip, 'ask_agenda');
  recipient.aiStrategyId = 'aggressive';
  const aggressive = ask(gossip, 'ask_agenda');
  assert.equal(economic.success, true);
  assert.equal(aggressive.success, true);
  if (!economic.success || !aggressive.success) return;
  assert.match(economic.responseText!, /economy|infrastructure/);
  assert.match(aggressive.responseText!, /Strength/);
  assert.notEqual(economic.responseText, aggressive.responseText);
});

test('unknown strategy falls back to the recipient National Agenda', () => {
  const { nations, gossip } = makeHarness();
  unlock(nations, 'political_philosophy');
  nations.getNation(ENGLAND)!.aiStrategyId = 'unknown_strategy';
  const result = ask(gossip, 'ask_agenda');
  assert.equal(result.success, true);
  if (result.success) assert.match(result.responseText!, /seas/);
});
