/** Focused deterministic tests for Gossip Step 1. Run with: npm run test:gossip */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GOSSIP_DEFINITIONS } from '../src/data/gossip.ts';
import { Nation } from '../src/entities/Nation.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import {
  GossipSystem,
  MANIPULATION_ACCEPTANCE_SCORE_THRESHOLD,
  MANIPULATION_COOLDOWN_ROUNDS,
} from '../src/systems/GossipSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { formatGossipText } from '../src/utils/gossipText.ts';

const SWEDEN = 'nation_sweden';
const ENGLAND = 'nation_england';
const HRE = 'nation_hre';
const FRANCE = 'nation_france';

function makeHarness() {
  const nations = new NationManager();
  for (const [id, name, isHuman] of [
    [SWEDEN, 'Sweden', true],
    [ENGLAND, 'England', false],
    [HRE, 'Holy Roman Empire', false],
    [FRANCE, 'France', false],
  ] as const) {
    nations.addNation(new Nation({ id, name, isHuman, color: 0 }));
  }
  nations.getResources(SWEDEN).influence = 100;
  const diplomacy = new DiplomacyManager();
  let round = 100;
  const influenceGateway = {
    spendInfluence(nationId: string, amount: number): number {
      const resources = nations.getResources(nationId);
      const spent = Math.min(resources.influence, Math.max(0, Math.floor(amount)));
      resources.influence -= spent;
      return spent;
    },
  };
  const gossip = new GossipSystem(nations, diplomacy, influenceGateway, () => round);
  return { nations, diplomacy, gossip, setRound: (next: number) => { round = next; } };
}

test('catalog preserves the initial Manipulation and Insult definitions and has seven Information items', () => {
  assert.deepEqual(
    GOSSIP_DEFINITIONS.filter((item) => item.type === 'information').map(({ id }) => id),
    [
      'ask_opinion',
      'ask_agenda',
      'ask_most_trusted',
      'ask_least_trusted',
      'ask_most_feared',
      'ask_greatest_rival',
      'ask_war_risk',
    ],
  );
  assert.equal(GOSSIP_DEFINITIONS.find((item) => item.id === 'spread_distrust')?.type, 'manipulation');
  assert.equal(GOSSIP_DEFINITIONS.find((item) => item.id === 'insult_judgment')?.type, 'insult');
});

test('formatter resolves all supported names and leaves unknown placeholders obvious', () => {
  const result = formatGossipText(
    '{sourceLeaderName} of {sourceNationName} addresses {recipientLeaderName} of {recipientNationName} about {targetLeaderName} of {targetNationName}. {unknown}',
    {
      sourceLeaderName: 'Gustav Vasa', sourceNationName: 'Sweden',
      recipientLeaderName: 'Henry V', recipientNationName: 'England',
      targetLeaderName: 'Charles VII', targetNationName: 'France',
    },
  );
  assert.equal(result, 'Gustav Vasa of Sweden addresses Henry V of England about Charles VII of France. {unknown}');
});

test('information returns recipient-target opinion without changing diplomacy', () => {
  const { gossip, diplomacy } = makeHarness();
  diplomacy.setMemoryValues(ENGLAND, FRANCE, {
    trust: 5, fear: 10, hostility: 70, affinity: 0, suspicion: 55,
  });
  const before = diplomacy.getRelation(ENGLAND, FRANCE);
  const result = gossip.execute({
    itemId: 'ask_opinion', sourceNationId: SWEDEN, recipientNationId: ENGLAND, targetNationId: FRANCE,
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.match(result.responseText!, /enemy|serious doubts/);
  assert.match(result.resolvedText, /Charles VII/);
  assert.deepEqual(diplomacy.getRelation(ENGLAND, FRANCE), before);
  assert.equal(result.influenceSpent, 0);
});

test('manipulation spends committed Influence and changes only the recipient-target pair', () => {
  const { gossip, diplomacy, nations } = makeHarness();
  const sourceTargetBefore = diplomacy.getRelation(SWEDEN, FRANCE);
  const sourceRecipientBefore = diplomacy.getRelation(SWEDEN, ENGLAND);
  const result = gossip.execute({
    itemId: 'spread_distrust', sourceNationId: SWEDEN, recipientNationId: ENGLAND,
    targetNationId: FRANCE, influence: 25,
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.influenceSpent, 25);
  assert.equal(nations.getResources(SWEDEN).influence, 75);
  assert.equal(diplomacy.getRelation(ENGLAND, FRANCE).trust, 45);
  assert.equal(diplomacy.getRelation(ENGLAND, FRANCE).suspicion, 10);
  assert.deepEqual(diplomacy.getRelation(SWEDEN, FRANCE), sourceTargetBefore);
  assert.deepEqual(diplomacy.getRelation(SWEDEN, ENGLAND), sourceRecipientBefore);
  assert.deepEqual(result.diplomaticEffect, {
    fromNationId: ENGLAND, towardNationId: FRANCE,
    trustDelta: -5, suspicionDelta: 10, hostilityDelta: 0, affinityDelta: 0, fearDelta: 0,
    trustAfter: 45, suspicionAfter: 10, hostilityAfter: 0, affinityAfter: 0, fearAfter: 0,
  });
});

test('manipulation fails without enough Influence and applies no effect', () => {
  const { gossip, diplomacy, nations } = makeHarness();
  nations.getResources(SWEDEN).influence = 10;
  const before = diplomacy.getRelation(ENGLAND, FRANCE);
  const result = gossip.execute({
    itemId: 'spread_distrust', sourceNationId: SWEDEN, recipientNationId: ENGLAND,
    targetNationId: FRANCE, influence: 25,
  });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.failureReason, 'insufficient_influence');
  assert.equal(nations.getResources(SWEDEN).influence, 10);
  assert.deepEqual(diplomacy.getRelation(ENGLAND, FRANCE), before);
});

test('recipient rejects manipulation when its relation to the human is below threshold', () => {
  const { gossip, diplomacy, nations } = makeHarness();
  diplomacy.setMemoryValues(ENGLAND, SWEDEN, {
    trust: 0, fear: 0, hostility: 80, affinity: 0, suspicion: 80,
  });
  assert.ok(0 - 80 - 80 < MANIPULATION_ACCEPTANCE_SCORE_THRESHOLD);
  const result = gossip.execute({
    itemId: 'spread_distrust', sourceNationId: SWEDEN, recipientNationId: ENGLAND,
    targetNationId: FRANCE, influence: 25,
  });
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.failureReason, 'recipient_rejects');
  assert.equal(nations.getResources(SWEDEN).influence, 100);
});

test('successful manipulation starts recipient cooldown but leaves other recipients available', () => {
  const { gossip } = makeHarness();
  const first = gossip.execute({
    itemId: 'spread_distrust', sourceNationId: SWEDEN, recipientNationId: ENGLAND,
    targetNationId: FRANCE, influence: 10,
  });
  assert.equal(first.success, true);
  assert.deepEqual(gossip.canManipulate(SWEDEN, ENGLAND, 100), {
    allowed: false, remainingRounds: MANIPULATION_COOLDOWN_ROUNDS,
  });
  const repeated = gossip.execute({
    itemId: 'spread_distrust', sourceNationId: SWEDEN, recipientNationId: ENGLAND,
    targetNationId: HRE, influence: 10,
  });
  assert.equal(repeated.success, false);
  if (!repeated.success) assert.equal(repeated.failureReason, 'cooldown_active');
  assert.equal(gossip.canManipulate(SWEDEN, HRE, 100).allowed, true);
  assert.equal(gossip.execute({
    itemId: 'spread_distrust', sourceNationId: SWEDEN, recipientNationId: HRE,
    targetNationId: FRANCE, influence: 10,
  }).success, true);
});

test('manipulation cooldown expires by game round and survives serialization', () => {
  const first = makeHarness();
  first.gossip.recordSuccessfulManipulation(SWEDEN, ENGLAND, 100);
  const saved = first.gossip.serialize();
  const second = makeHarness();
  second.gossip.restore(saved);
  assert.equal(second.gossip.canManipulate(SWEDEN, ENGLAND, 109).remainingRounds, 1);
  assert.equal(second.gossip.canManipulate(SWEDEN, ENGLAND, 110).allowed, true);
});

test('insult resolves dynamic recipient leader and nation placeholders', () => {
  const { gossip } = makeHarness();
  const result = gossip.execute({
    itemId: 'insult_judgment', sourceNationId: SWEDEN, recipientNationId: ENGLAND,
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.match(result.resolvedText, /Henry V/);
  assert.equal(result.influenceSpent, 0);
});

test('invalid nation roles and combinations fail cleanly', () => {
  const { gossip } = makeHarness();
  const invalidSource = gossip.execute({
    itemId: 'ask_opinion', sourceNationId: ENGLAND, recipientNationId: HRE, targetNationId: FRANCE,
  });
  assert.equal(invalidSource.success, false);
  if (!invalidSource.success) assert.equal(invalidSource.failureReason, 'invalid_source');

  const invalidRecipient = gossip.execute({
    itemId: 'insult_judgment', sourceNationId: SWEDEN, recipientNationId: SWEDEN,
  });
  assert.equal(invalidRecipient.success, false);
  if (!invalidRecipient.success) assert.equal(invalidRecipient.failureReason, 'invalid_recipient');

  const invalidTarget = gossip.execute({
    itemId: 'spread_distrust', sourceNationId: SWEDEN, recipientNationId: ENGLAND,
    targetNationId: ENGLAND, influence: 10,
  });
  assert.equal(invalidTarget.success, false);
  if (!invalidTarget.success) assert.equal(invalidTarget.failureReason, 'invalid_combination');
});
