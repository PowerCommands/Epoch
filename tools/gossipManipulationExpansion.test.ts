/** Focused deterministic tests for the Manipulation Gossip expansion. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GOSSIP_DEFINITIONS } from '../src/data/gossip.ts';
import type { Era } from '../src/data/technologies.ts';
import { Nation } from '../src/entities/Nation.ts';
import { DiplomacyManager, type DiplomaticMemoryValues } from '../src/systems/DiplomacyManager.ts';
import {
  GOSSIP_MANIPULATION_ERA_MULTIPLIERS,
  GossipSystem,
  MANIPULATION_COOLDOWN_ROUNDS,
} from '../src/systems/GossipSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';

const SOURCE = 'nation_sweden';
const RECIPIENT = 'nation_england';
const OTHER_RECIPIENT = 'nation_hre';
const TARGET = 'nation_france';
const ITEMS = ['spread_distrust', 'spread_slander', 'spread_conspiracy', 'provoke_pride', 'spread_war_rumor'] as const;
const ALL_CULTURES = ['drama_civics', 'diplomatic_service', 'nationalism', 'cold_war'];

function makeHarness(options: { sourceEra?: Era; recipientEra?: Era; targetEra?: Era; influence?: number } = {}) {
  const nations = new NationManager();
  for (const [id, name, isHuman] of [
    [SOURCE, 'Sweden', true],
    [RECIPIENT, 'England', false],
    [OTHER_RECIPIENT, 'Holy Roman Empire', false],
    [TARGET, 'France', false],
  ] as const) nations.addNation(new Nation({ id, name, isHuman, color: 0 }));
  nations.getNation(SOURCE)!.unlockedCultureNodeIds.push(...ALL_CULTURES);
  nations.getResources(SOURCE).influence = options.influence ?? 10_000;
  const diplomacy = new DiplomacyManager();
  let round = 100;
  const eras: Record<string, Era> = {
    [SOURCE]: options.sourceEra ?? 'ancient',
    [RECIPIENT]: options.recipientEra ?? 'ancient',
    [TARGET]: options.targetEra ?? 'ancient',
  };
  const gateway = {
    spendInfluence(nationId: string, amount: number): number {
      const resources = nations.getResources(nationId);
      const spent = Math.min(resources.influence, Math.max(0, Math.floor(amount)));
      resources.influence -= spent;
      return spent;
    },
  };
  const gossip = new GossipSystem(
    nations, diplomacy, gateway, () => round, { hasMet: () => true },
    (nationId) => eras[nationId] ?? 'ancient',
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
  return { nations, diplomacy, gossip, setRelation, setRound: (value: number) => { round = value; } };
}

function execute(gossip: GossipSystem, itemId: typeof ITEMS[number], influence = 25, recipientNationId = RECIPIENT) {
  return gossip.execute({
    itemId, sourceNationId: SOURCE, recipientNationId,
    targetNationId: TARGET, influence,
  });
}

test('catalog defines all five weighted Manipulations and their intended culture progression', () => {
  const definitions = GOSSIP_DEFINITIONS.filter((item) => item.type === 'manipulation');
  assert.deepEqual(definitions.map((item) => item.id), ITEMS);
  assert.deepEqual(Object.fromEntries(definitions.map((item) => [item.id, item.manipulationWeight])), {
    spread_distrust: 1,
    spread_slander: 1.15,
    spread_conspiracy: 1.35,
    provoke_pride: 1.5,
    spread_war_rumor: 2,
  });
  assert.deepEqual(Object.fromEntries(definitions.map((item) => [item.id, item.requiredCultureNodeId])), {
    spread_distrust: undefined,
    spread_slander: 'drama_civics',
    spread_conspiracy: 'diplomatic_service',
    provoke_pride: 'nationalism',
    spread_war_rumor: 'cold_war',
  });
  assert.ok(definitions.every((item) => item.requiresTarget));
});

test('culture locks are enforced against the human source nation', () => {
  const { nations, gossip } = makeHarness();
  nations.getNation(SOURCE)!.unlockedCultureNodeIds.length = 0;
  nations.getNation(RECIPIENT)!.unlockedCultureNodeIds.push('drama_civics', 'diplomatic_service');
  assert.equal(gossip.getItemAvailability(SOURCE, 'spread_slander').available, false);
  assert.equal(execute(gossip, 'spread_conspiracy').success, false);
  nations.getNation(SOURCE)!.unlockedCultureNodeIds.push('drama_civics', 'diplomatic_service');
  assert.equal(gossip.getItemAvailability(SOURCE, 'spread_slander').available, true);
  assert.equal(execute(gossip, 'spread_conspiracy').success, true);
});

test('each profile changes only its intended recipient-to-target dimensions', () => {
  const intended: Record<typeof ITEMS[number], readonly (keyof DiplomaticMemoryValues)[]> = {
    spread_distrust: ['trust', 'suspicion'],
    spread_slander: ['suspicion', 'affinity'],
    spread_conspiracy: ['trust', 'suspicion', 'hostility'],
    provoke_pride: ['hostility', 'affinity'],
    spread_war_rumor: ['trust', 'suspicion', 'hostility', 'fear'],
  };
  for (const itemId of ITEMS) {
    const { diplomacy, gossip, setRelation } = makeHarness();
    setRelation(RECIPIENT, TARGET, { trust: 50, suspicion: 20, hostility: 20, affinity: 50, fear: 20 });
    const sourceTargetBefore = diplomacy.getRelation(SOURCE, TARGET);
    const before = diplomacy.getRelation(RECIPIENT, TARGET);
    const result = execute(gossip, itemId, 25);
    assert.equal(result.success, true, itemId);
    const after = diplomacy.getRelation(RECIPIENT, TARGET);
    for (const key of ['trust', 'suspicion', 'hostility', 'affinity', 'fear'] as const) {
      assert.equal(after[key] !== before[key], intended[itemId].includes(key), `${itemId}:${key}`);
    }
    assert.deepEqual(diplomacy.getRelation(SOURCE, TARGET), sourceTargetBefore);
    // Epoch stores diplomatic memory once per nation pair. The structured
    // effect still records which recipient was influenced about which target.
    if (result.success) {
      assert.equal(result.diplomaticEffect?.fromNationId, RECIPIENT);
      assert.equal(result.diplomaticEffect?.towardNationId, TARGET);
    }
  }
});

test('larger base investment produces stronger effects independent of actual price', () => {
  const low = makeHarness();
  const high = makeHarness();
  const lowResult = execute(low.gossip, 'spread_war_rumor', 10);
  const highResult = execute(high.gossip, 'spread_war_rumor', 50);
  assert.equal(lowResult.success, true);
  assert.equal(highResult.success, true);
  if (!lowResult.success || !highResult.success) return;
  assert.ok(highResult.diplomaticEffect!.fearDelta > lowResult.diplomaticEffect!.fearDelta);
  assert.ok(highResult.diplomaticEffect!.suspicionDelta > lowResult.diplomaticEffect!.suspicionDelta);
});

test('cost uses item weight, source era, centralized multipliers and upward rounding', () => {
  const ancient = makeHarness({ sourceEra: 'ancient' });
  assert.equal(ancient.gossip.getManipulationCost('spread_distrust', SOURCE, 25)?.actualCost, 25);
  assert.equal(ancient.gossip.getManipulationCost('spread_war_rumor', SOURCE, 25)?.actualCost, 50);
  const renaissance = makeHarness({ sourceEra: 'renaissance' });
  const preview = renaissance.gossip.getManipulationCost('spread_slander', SOURCE, 25);
  assert.equal(preview?.eraMultiplier, GOSSIP_MANIPULATION_ERA_MULTIPLIERS.renaissance);
  assert.equal(preview?.actualCost, Math.ceil(25 * 1.5 * 1.15));
});

test('recipient and target eras do not affect a cost determined by the human source era', () => {
  const earlyOthers = makeHarness({ sourceEra: 'modern', recipientEra: 'ancient', targetEra: 'classical' });
  const lateOthers = makeHarness({ sourceEra: 'modern', recipientEra: 'future', targetEra: 'information' });
  assert.deepEqual(
    earlyOthers.gossip.getManipulationCost('spread_conspiracy', SOURCE, 25),
    lateOthers.gossip.getManipulationCost('spread_conspiracy', SOURCE, 25),
  );
});

test('preview equals structured actual spend and successful execution starts category cooldown', () => {
  const { nations, gossip } = makeHarness({ sourceEra: 'industrial' });
  const preview = gossip.getManipulationCost('provoke_pride', SOURCE, 25)!;
  const before = nations.getResources(SOURCE).influence;
  const result = execute(gossip, 'provoke_pride', 25);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.influenceSpent, preview.actualCost);
  assert.equal(before - nations.getResources(SOURCE).influence, preview.actualCost);
  assert.deepEqual({
    itemId: result.itemId,
    weight: result.manipulationWeight,
    source: result.sourceNationId,
    recipient: result.recipientNationId,
    target: result.targetNationId,
    tier: result.selectedInfluenceTier,
    eraMultiplier: result.eraMultiplier,
    cooldown: result.cooldownRemainingRounds,
  }, {
    itemId: 'provoke_pride', weight: 1.5, source: SOURCE, recipient: RECIPIENT,
    target: TARGET, tier: 25, eraMultiplier: 1.75, cooldown: MANIPULATION_COOLDOWN_ROUNDS,
  });
  const bypass = execute(gossip, 'spread_distrust', 10);
  assert.equal(bypass.success, false);
  if (!bypass.success) assert.equal(bypass.failureReason, 'cooldown_active');
  assert.equal(execute(gossip, 'spread_distrust', 10, OTHER_RECIPIENT).success, true);
});

test('insufficient actual cost fails without spending or diplomatic mutation', () => {
  const { nations, diplomacy, gossip } = makeHarness({ sourceEra: 'information', influence: 49 });
  const beforeRelation = diplomacy.getRelation(RECIPIENT, TARGET);
  const result = execute(gossip, 'spread_war_rumor', 10); // 10 × 2.5 × 2 = 50
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.failureReason, 'insufficient_influence');
  assert.equal(nations.getResources(SOURCE).influence, 49);
  assert.deepEqual(diplomacy.getRelation(RECIPIENT, TARGET), beforeRelation);
});

test('recipient rejection remains deterministic and consumes nothing', () => {
  const { nations, gossip, setRelation } = makeHarness();
  setRelation(RECIPIENT, SOURCE, { trust: 0, affinity: 0, hostility: 100, suspicion: 100 });
  const before = nations.getResources(SOURCE).influence;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const result = execute(gossip, 'spread_distrust', 10);
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.failureReason, 'recipient_rejects');
  }
  assert.equal(nations.getResources(SOURCE).influence, before);
});

test('war rumor changes memory only, never declares war or invokes a high-level action', () => {
  const { diplomacy, gossip } = makeHarness();
  let warsDeclared = 0;
  diplomacy.onWarDeclared(() => { warsDeclared += 1; });
  assert.equal(diplomacy.getState(RECIPIENT, TARGET), 'PEACE');
  assert.equal(execute(gossip, 'spread_war_rumor', 50).success, true);
  assert.equal(diplomacy.getState(RECIPIENT, TARGET), 'PEACE');
  assert.equal(warsDeclared, 0);
});

test('all relation results clamp to the existing 0..100 range', () => {
  const { diplomacy, gossip, setRelation } = makeHarness();
  setRelation(RECIPIENT, TARGET, { trust: 1, suspicion: 99, hostility: 99, affinity: 1, fear: 99 });
  const result = execute(gossip, 'spread_war_rumor', 50);
  assert.equal(result.success, true);
  const relation = diplomacy.getRelation(RECIPIENT, TARGET);
  for (const key of ['trust', 'suspicion', 'hostility', 'affinity', 'fear'] as const) {
    assert.ok(relation[key] >= 0 && relation[key] <= 100, key);
  }
  assert.equal(relation.trust, 0);
  assert.equal(relation.suspicion, 100);
  assert.equal(relation.hostility, 100);
  assert.equal(relation.fear, 100);
});
