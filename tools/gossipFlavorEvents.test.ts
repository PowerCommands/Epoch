/** Focused tests for presentation-only AI Gossip flavor events. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Nation } from '../src/entities/Nation.ts';
import { DiplomacyManager, type DiplomaticMemoryValues } from '../src/systems/DiplomacyManager.ts';
import {
  deterministicFlavorRoll,
  GOSSIP_FLAVOR_EVENT_ICON,
  GOSSIP_FLAVOR_EVENT_TYPE,
  GOSSIP_FLAVOR_PAIR_COOLDOWN_ROUNDS,
  GossipFlavorEventSystem,
} from '../src/systems/GossipFlavorEventSystem.ts';
import { GossipSystem } from '../src/systems/GossipSystem.ts';
import { HistoricalTimelineService } from '../src/systems/HistoricalTimelineService.ts';
import { NationManager } from '../src/systems/NationManager.ts';

const HUMAN = 'nation_sweden';
const ENGLAND = 'nation_england';
const FRANCE = 'nation_france';
const HRE = 'nation_hre';

function makeHarness(options: {
  readonly selectionRoll?: number;
  readonly sourcePower?: number;
  readonly recipientPower?: number;
  readonly useDefaultSeededRoll?: boolean;
} = {}) {
  const nations = new NationManager();
  for (const [id, name, isHuman] of [
    [HUMAN, 'Sweden', true],
    [ENGLAND, 'England', false],
    [FRANCE, 'France', false],
    [HRE, 'Holy Roman Empire', false],
  ] as const) nations.addNation(new Nation({ id, name, isHuman, color: 0, aiStrategyId: 'balanced' }));
  nations.getResources(HUMAN).influence = 123;
  const diplomacy = new DiplomacyManager();
  let round = 100;
  const timeline = new HistoricalTimelineService(() => round, () => '1000 AD');
  const active = new Set([HUMAN, ENGLAND, FRANCE, HRE]);
  const powers: Record<string, number> = {
    [HUMAN]: 100,
    [ENGLAND]: options.sourcePower ?? 100,
    [FRANCE]: options.recipientPower ?? 100,
    [HRE]: 100,
  };
  const generatedLogs: string[] = [];
  const flavor = new GossipFlavorEventSystem({
    nationManager: nations,
    diplomacyManager: diplomacy,
    historicalTimeline: timeline,
    getRound: () => round,
    getMilitaryPower: (nationId) => powers[nationId] ?? 0,
    isNationActive: (nationId) => active.has(nationId),
    randomSeed: 'focused-test-seed',
    roll: options.useDefaultSeededRoll
      ? undefined
      : (key) => key.endsWith('|chance') ? 0 : options.selectionRoll ?? 0,
    logGenerated: (result) => generatedLogs.push(
      `${result.round}|${result.trigger}|${result.speakerNationId}|${result.recipientNationId}|${result.insultId}`,
    ),
  });
  const gossip = new GossipSystem(
    nations, diplomacy, { spendInfluence: () => 0 }, () => round,
  );
  const setRelation = (a: string, b: string, values: Partial<DiplomaticMemoryValues>) => {
    const current = diplomacy.getRelation(a, b);
    diplomacy.setMemoryValues(a, b, {
      trust: values.trust ?? current.trust,
      fear: values.fear ?? current.fear,
      hostility: values.hostility ?? current.hostility,
      affinity: values.affinity ?? current.affinity,
      suspicion: values.suspicion ?? current.suspicion,
    });
  };
  return {
    nations, diplomacy, timeline, flavor, gossip, active, powers, generatedLogs, setRelation,
    setRound: (value: number) => { round = value; },
  };
}

test('war declaration can create an AI-to-AI contextual flavor insult', () => {
  const h = makeHarness();
  assert.equal(h.diplomacy.declareWar(ENGLAND, FRANCE), true);
  const result = h.flavor.handleWarDeclared(ENGLAND, FRANCE);
  assert.equal(result?.trigger, 'war_declaration');
  assert.equal(result?.speakerNationId, ENGLAND);
  assert.equal(result?.recipientNationId, FRANCE);
  assert.equal(result?.recipientIsHuman, false);
});

test('city capture produces an eligible provocation with correct winner, loser and city context', () => {
  const h = makeHarness({ selectionRoll: 0.99 });
  h.diplomacy.declareWar(ENGLAND, FRANCE);
  const result = h.flavor.handleCityCaptured(ENGLAND, FRANCE, 'Paris');
  assert.equal(result?.trigger, 'city_capture');
  assert.equal(result?.insultSubtype, 'provocation');
  assert.match(result?.historyText ?? '', /After the fall of Paris/);
  assert.deepEqual(h.timeline.getEvents()[0]?.eventNationIds, [ENGLAND, FRANCE]);
});

test('periodic evaluation supports ongoing war insults only on its configured cadence', () => {
  const h = makeHarness();
  h.diplomacy.declareWar(ENGLAND, FRANCE);
  assert.deepEqual(h.flavor.handlePeriodicRound(101), []);
  const results = h.flavor.handlePeriodicRound(100);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.trigger, 'ongoing_war');
});

test('severely hostile peace may produce flavor while friendly peace never does', () => {
  const hostile = makeHarness();
  hostile.setRelation(ENGLAND, FRANCE, { hostility: 80, suspicion: 70, trust: 5, affinity: 0 });
  const results = hostile.flavor.handlePeriodicRound(100);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.trigger, 'hostile_peacetime');

  const friendly = makeHarness();
  friendly.setRelation(ENGLAND, FRANCE, { hostility: 0, suspicion: 0, trust: 90, affinity: 80 });
  assert.deepEqual(friendly.flavor.handlePeriodicRound(100), []);
  assert.equal(friendly.timeline.getEvents().length, 0);
});

test('AI-to-Human is supported but automatic Human-to-AI flavor is rejected', () => {
  const aiSpeaker = makeHarness();
  aiSpeaker.diplomacy.declareWar(ENGLAND, HUMAN);
  const result = aiSpeaker.flavor.handleWarDeclared(ENGLAND, HUMAN);
  assert.equal(result?.recipientIsHuman, true);
  assert.equal(result?.speakerNationId, ENGLAND);

  const humanSpeaker = makeHarness();
  humanSpeaker.diplomacy.declareWar(HUMAN, ENGLAND);
  assert.equal(humanSpeaker.flavor.handleWarDeclared(HUMAN, ENGLAND), undefined);
  assert.equal(humanSpeaker.timeline.getEvents().length, 0);
});

test('generated flavor changes no diplomacy, strategy, Influence, or interactive Gossip state', () => {
  const h = makeHarness();
  h.diplomacy.declareWar(ENGLAND, FRANCE);
  const relationBefore = h.diplomacy.getRelation(ENGLAND, FRANCE);
  const stateBefore = h.diplomacy.getState(ENGLAND, FRANCE);
  const influenceBefore = h.nations.getResources(HUMAN).influence;
  const strategiesBefore = h.nations.getAllNations().map((nation) => [nation.id, nation.aiStrategyId]);
  const gossipBefore = h.gossip.serialize();
  assert.ok(h.flavor.handleWarDeclared(ENGLAND, FRANCE));
  assert.deepEqual(h.diplomacy.getRelation(ENGLAND, FRANCE), relationBefore);
  assert.equal(h.diplomacy.getState(ENGLAND, FRANCE), stateBefore);
  assert.equal(h.nations.getResources(HUMAN).influence, influenceBefore);
  assert.deepEqual(h.nations.getAllNations().map((nation) => [nation.id, nation.aiStrategyId]), strategiesBefore);
  assert.deepEqual(h.gossip.serialize(), gossipBefore);
  assert.equal(h.gossip.getInsultStatus(HUMAN, ENGLAND).allowed, true);
  assert.equal(h.gossip.canManipulate(HUMAN, ENGLAND).allowed, true);
});

test('symmetric pair cooldown prevents reverse spam while leaving another pair available', () => {
  const h = makeHarness();
  h.diplomacy.declareWar(ENGLAND, FRANCE);
  h.diplomacy.declareWar(ENGLAND, HRE);
  assert.ok(h.flavor.handleWarDeclared(ENGLAND, FRANCE));
  assert.equal(h.flavor.tryGenerate({
    trigger: 'war_declaration', speakerNationId: FRANCE, recipientNationId: ENGLAND,
  }), undefined);
  assert.ok(h.flavor.handleWarDeclared(ENGLAND, HRE));
  assert.equal(h.timeline.getEvents().length, 2);
});

test('threat content reuses credibility: weak AI keeps provocations but cannot select threats', () => {
  const weak = makeHarness({ sourcePower: 10, recipientPower: 100 });
  weak.diplomacy.declareWar(ENGLAND, FRANCE);
  const weakEligible = weak.flavor.getEligibleDefinitions('war_declaration', ENGLAND, FRANCE);
  assert.ok(weakEligible.some((definition) => definition.insultSubtype === 'provocation'));
  assert.ok(weakEligible.every((definition) => definition.insultSubtype !== 'threat'));
  assert.equal(weak.flavor.handleWarDeclared(ENGLAND, FRANCE)?.insultSubtype, 'provocation');

  const strong = makeHarness({ sourcePower: 200, recipientPower: 100, selectionRoll: 0.99 });
  strong.diplomacy.declareWar(ENGLAND, FRANCE);
  assert.ok(strong.flavor.getEligibleDefinitions('war_declaration', ENGLAND, FRANCE)
    .some((definition) => definition.insultSubtype === 'threat'));
  assert.equal(strong.flavor.handleWarDeclared(ENGLAND, FRANCE)?.insultSubtype, 'threat');
});

test('context metadata filters inappropriate content and ignores player Culture gates', () => {
  const h = makeHarness();
  h.diplomacy.declareWar(ENGLAND, FRANCE);
  const cityDefinitions = h.flavor.getEligibleDefinitions('city_capture', ENGLAND, FRANCE);
  assert.ok(cityDefinitions.length > 0);
  assert.ok(cityDefinitions.every((definition) => definition.insultSubtype === 'provocation'));
  assert.ok(cityDefinitions.some((definition) => definition.requiredCultureNodeId === 'nationalism'));
  assert.equal(h.nations.getNation(ENGLAND)!.unlockedCultureNodeIds.length, 0);
});

test('History entry resolves arbitrary leaders and uses the dedicated type and speech icon', () => {
  const h = makeHarness();
  h.diplomacy.declareWar(ENGLAND, FRANCE);
  const result = h.flavor.handleWarDeclared(ENGLAND, FRANCE)!;
  const event = h.timeline.getEvents()[0]!;
  assert.equal(event.type, GOSSIP_FLAVOR_EVENT_TYPE);
  assert.equal(event.icon, GOSSIP_FLAVOR_EVENT_ICON);
  assert.match(event.text, /Henry V of England/);
  assert.match(event.text, /Charles VII of France/);
  assert.doesNotMatch(result.resolvedText, /\{(?:source|recipient)/);
  assert.equal(h.generatedLogs.length, 1);
  assert.match(h.generatedLogs[0]!, /war_declaration.*nation_england.*nation_france/);
});

test('invalid, self, eliminated, and stale-war triggers cannot emit flavor', () => {
  const h = makeHarness();
  assert.equal(h.flavor.handleWarDeclared('missing', FRANCE), undefined);
  assert.equal(h.flavor.handleWarDeclared(ENGLAND, ENGLAND), undefined);
  h.diplomacy.declareWar(ENGLAND, FRANCE);
  h.active.delete(ENGLAND);
  assert.equal(h.flavor.handleWarDeclared(ENGLAND, FRANCE), undefined);

  const peace = makeHarness();
  assert.equal(peace.flavor.tryGenerate({
    trigger: 'ongoing_war', speakerNationId: ENGLAND, recipientNationId: FRANCE,
  }), undefined);
});

test('seeded roll and selection are deterministic across identical worlds', () => {
  assert.equal(deterministicFlavorRoll('same-seed'), deterministicFlavorRoll('same-seed'));
  const first = makeHarness({ useDefaultSeededRoll: true });
  const second = makeHarness({ useDefaultSeededRoll: true });
  first.diplomacy.declareWar(ENGLAND, FRANCE);
  second.diplomacy.declareWar(ENGLAND, FRANCE);
  assert.deepEqual(first.flavor.handleWarDeclared(ENGLAND, FRANCE), second.flavor.handleWarDeclared(ENGLAND, FRANCE));
});

test('save/load preserves the flavor-only pair cooldown', () => {
  const first = makeHarness();
  first.diplomacy.declareWar(ENGLAND, FRANCE);
  assert.ok(first.flavor.handleWarDeclared(ENGLAND, FRANCE));
  const saved = first.flavor.serialize();
  assert.equal(saved.pairCooldowns[0]?.availableAtRound, 100 + GOSSIP_FLAVOR_PAIR_COOLDOWN_ROUNDS);

  const second = makeHarness();
  second.diplomacy.declareWar(ENGLAND, FRANCE);
  second.flavor.restore(saved);
  assert.equal(second.flavor.handleWarDeclared(FRANCE, ENGLAND), undefined);
  second.setRound(100 + GOSSIP_FLAVOR_PAIR_COOLDOWN_ROUNDS);
  assert.ok(second.flavor.handleWarDeclared(FRANCE, ENGLAND));
});
