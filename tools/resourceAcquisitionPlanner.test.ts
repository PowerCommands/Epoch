/**
 * Focused tests for the strategic-resource acquisition classifier (Prompt 3).
 * Run with: npx tsx --test tools/resourceAcquisitionPlanner.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { KnownResourceOpportunity } from '../src/systems/ai/AIExplorationSystem.ts';
import {
  classifyResourceAcquisition,
  isSignificantDemand,
  type ResourceAcquisitionContext,
} from '../src/systems/ai/resourceAcquisitionPlanner.ts';

const IRON_DEMAND = { resourceId: 'iron', resourceName: 'Iron', score: 92 };

function opp(overrides: Partial<KnownResourceOpportunity> & Pick<KnownResourceOpportunity, 'resourceId' | 'x' | 'y'>): KnownResourceOpportunity {
  return {
    isWater: false,
    ownerId: undefined,
    ownedBySelf: false,
    ownedByOther: false,
    neutral: true,
    ...overrides,
  };
}

function context(overrides: Partial<ResourceAcquisitionContext> = {}): ResourceAcquisitionContext {
  return {
    opportunities: [],
    canImproveDomesticTile: () => true,
    isReachableByLand: () => true,
    getKnownSuppliers: () => [],
    ...overrides,
  };
}

test('1. Owned unimproved improvable Iron → domestic improvement', () => {
  const plan = classifyResourceAcquisition(IRON_DEMAND, context({
    opportunities: [opp({ resourceId: 'iron', x: 3, y: 4, ownerId: 'france', ownedBySelf: true, neutral: false })],
  }));
  assert.equal(plan.path, 'domestic-improve');
  assert.deepEqual(plan.tile, { x: 3, y: 4 });
});

test('Owned Iron that cannot be improved does not classify as domestic', () => {
  const plan = classifyResourceAcquisition(IRON_DEMAND, context({
    opportunities: [opp({ resourceId: 'iron', x: 3, y: 4, ownerId: 'france', ownedBySelf: true, neutral: false })],
    canImproveDomesticTile: () => false,
    getKnownSuppliers: () => ['england'],
  }));
  assert.equal(plan.path, 'foreign-trade'); // falls through to next path
});

test('10. Known foreign supplier → resource trade', () => {
  const plan = classifyResourceAcquisition(IRON_DEMAND, context({ getKnownSuppliers: () => ['england'] }));
  assert.equal(plan.path, 'foreign-trade');
  assert.equal(plan.supplierNationId, 'england');
});

test('4. Neutral Iron reachable by land → expansion opportunity', () => {
  const plan = classifyResourceAcquisition(IRON_DEMAND, context({
    opportunities: [opp({ resourceId: 'iron', x: 7, y: 2, neutral: true })],
    isReachableByLand: () => true,
  }));
  assert.equal(plan.path, 'neutral-land-expand');
  assert.deepEqual(plan.tile, { x: 7, y: 2 });
});

test('8/9. Neutral Iron on another landmass → overseas (not land expansion)', () => {
  const plan = classifyResourceAcquisition(IRON_DEMAND, context({
    opportunities: [opp({ resourceId: 'iron', x: 20, y: 20, neutral: true })],
    isReachableByLand: () => false,
  }));
  assert.equal(plan.path, 'neutral-overseas');
});

test('A resource sitting on a water tile is treated as overseas', () => {
  const plan = classifyResourceAcquisition(IRON_DEMAND, context({
    opportunities: [opp({ resourceId: 'iron', x: 9, y: 9, isWater: true, neutral: true })],
    isReachableByLand: () => true, // even if the water tile itself were "reachable"
  }));
  assert.equal(plan.path, 'neutral-overseas');
});

test('No known source → none (exploration / Economic Development fallback)', () => {
  const plan = classifyResourceAcquisition(IRON_DEMAND, context());
  assert.equal(plan.path, 'none');
});

test('Priority ordering: domestic > foreign > neutral-land > overseas', () => {
  const all = context({
    opportunities: [
      opp({ resourceId: 'iron', x: 1, y: 1, ownerId: 'france', ownedBySelf: true, neutral: false }),
      opp({ resourceId: 'iron', x: 5, y: 5, neutral: true }),
    ],
    getKnownSuppliers: () => ['england'],
    isReachableByLand: () => true,
  });
  assert.equal(classifyResourceAcquisition(IRON_DEMAND, all).path, 'domestic-improve');

  const noDomestic = context({
    opportunities: [opp({ resourceId: 'iron', x: 5, y: 5, neutral: true })],
    getKnownSuppliers: () => ['england'],
    isReachableByLand: () => true,
  });
  assert.equal(classifyResourceAcquisition(IRON_DEMAND, noDomestic).path, 'foreign-trade');

  const noForeign = context({
    opportunities: [opp({ resourceId: 'iron', x: 5, y: 5, neutral: true })],
    isReachableByLand: () => true,
  });
  assert.equal(classifyResourceAcquisition(IRON_DEMAND, noForeign).path, 'neutral-land-expand');
});

test('Supplier selection is deterministic (sorted first)', () => {
  const plan = classifyResourceAcquisition(IRON_DEMAND, context({ getKnownSuppliers: () => ['england', 'aragon'] }));
  assert.equal(plan.supplierNationId, 'england'); // order is caller-provided; classifier picks [0]
});

test('Classification only reads provided opportunities (no hidden knowledge)', () => {
  // An opportunity for a different resource must not satisfy Iron demand.
  const plan = classifyResourceAcquisition(IRON_DEMAND, context({
    opportunities: [opp({ resourceId: 'coal', x: 2, y: 2, ownerId: 'france', ownedBySelf: true, neutral: false })],
  }));
  assert.equal(plan.path, 'none');
});

test('isSignificantDemand threshold', () => {
  assert.equal(isSignificantDemand(40), true);
  assert.equal(isSignificantDemand(39), false);
});
