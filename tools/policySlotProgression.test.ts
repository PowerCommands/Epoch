import assert from 'node:assert/strict';
import test from 'node:test';

import { CULTURE_TREE } from '../src/data/cultureTree.ts';
import { Nation } from '../src/entities/Nation.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { PolicySystem } from '../src/systems/PolicySystem.ts';
import type { PolicySlotCategory } from '../src/types/policy.ts';

function slotCountsFor(unlockedCultureNodeIds: readonly string[]) {
  const nations = new NationManager();
  nations.addNation(new Nation({
    id: 'human',
    name: 'Human',
    color: 0,
    isHuman: true,
    unlockedCultureNodeIds: [...unlockedCultureNodeIds],
  }));
  const policies = new PolicySystem(nations);
  return policies.getSlotCounts('human');
}

// Final intended slot progression, ordered slot 1 -> slot 3 per category.
const PROGRESSION: Record<PolicySlotCategory, readonly string[]> = {
  military: ['craftsmanship', 'defensive_tactics', 'totalitarianism'],
  economic: ['code_of_laws', 'feudalism', 'guilds'],
  culture: ['games_recreation', 'humanism', 'professional_sports'],
  diplomatic: ['foreign_trade', 'diplomatic_service', 'cold_war'],
  wildcard: ['mysticism', 'political_philosophy', 'near_future_governance'],
  ideology: [],
};

test('each culture node grants the expected slot for its category, cumulatively to 3', () => {
  for (const [category, nodeIds] of Object.entries(PROGRESSION) as [PolicySlotCategory, readonly string[]][]) {
    nodeIds.forEach((_nodeId, index) => {
      const cumulative = nodeIds.slice(0, index + 1);
      const counts = slotCountsFor(cumulative);
      assert.equal(
        counts[category],
        index + 1,
        `${cumulative[index]} should grant slot ${index + 1} for ${category}`,
      );
    });
  }
});

test('the example partial progression yields the documented slot counts', () => {
  const early = slotCountsFor(['code_of_laws', 'craftsmanship', 'mysticism']);
  assert.equal(early.economic, 1);
  assert.equal(early.military, 1);
  assert.equal(early.wildcard, 1);
  assert.equal(early.culture, 0);
  assert.equal(early.diplomatic, 0);

  const mid = slotCountsFor([
    'code_of_laws', 'craftsmanship', 'mysticism', 'games_recreation', 'foreign_trade',
  ]);
  assert.equal(mid.economic, 1);
  assert.equal(mid.military, 1);
  assert.equal(mid.wildcard, 1);
  assert.equal(mid.culture, 1);
  assert.equal(mid.diplomatic, 1);
});

test('unlocking every culture node grants exactly 3 slots per category and never more', () => {
  const counts = slotCountsFor(CULTURE_TREE.map((node) => node.id));
  assert.equal(counts.military, 3);
  assert.equal(counts.economic, 3);
  assert.equal(counts.culture, 3);
  assert.equal(counts.diplomatic, 3);
  assert.equal(counts.wildcard, 3);
  assert.equal(counts.ideology, 0);

  for (const value of Object.values(counts)) {
    assert.ok(value <= 3, `no category may exceed 3 slots, saw ${value}`);
  }
});

test('a single culture node may unlock both a policy card and a policy slot', () => {
  const nations = new NationManager();
  nations.addNation(new Nation({
    id: 'human',
    name: 'Human',
    color: 0,
    isHuman: true,
    unlockedCultureNodeIds: ['games_recreation'],
  }));
  const policies = new PolicySystem(nations);

  assert.equal(policies.getSlotCounts('human').culture, 1);
  assert.ok(policies.getUnlockedPolicies('human').some((policy) => policy.id === 'aleksandr_barelin'));
  assert.equal(policies.activatePolicy('human', 'aleksandr_barelin', 'culture'), true);
});
