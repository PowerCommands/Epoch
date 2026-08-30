/**
 * Focused tests for the Strategic Resource Demand → exploration decision layer.
 * Run with: npx tsx --test tools/resourceExplorationNeed.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  evaluateResourceExplorationNeed,
  MEANINGFUL_RESOURCE_DEMAND_SCORE,
  RESOURCE_EXPLORATION_LAND_SCOUT_CAP,
  RESOURCE_EXPLORATION_SEA_SCOUT_CAP,
  type ResourceExplorationDemand,
} from '../src/systems/ai/resourceExplorationNeed.ts';

const IRON: ResourceExplorationDemand = { resourceId: 'iron', resourceName: 'Iron', score: 92 };
const COAL: ResourceExplorationDemand = { resourceId: 'coal', resourceName: 'Coal', score: 60 };
const HORSES: ResourceExplorationDemand = { resourceId: 'horses', resourceName: 'Horses', score: 25 };

function evaluate(overrides: Partial<Parameters<typeof evaluateResourceExplorationNeed>[0]> = {}) {
  return evaluateResourceExplorationNeed({
    demands: [IRON],
    hasKnownSource: () => false,
    landScoutCapacity: 0,
    seaScoutCapacity: 0,
    canExploreSea: false,
    ...overrides,
  });
}

test('1. Significant Iron demand with no known source creates land exploration need', () => {
  const need = evaluate();
  assert.equal(need.active, true);
  assert.equal(need.wantScout, true);
  assert.deepEqual(need.unresolved.map((d) => d.resourceId), ['iron']);
});

test('2. Coal demand contributes to the same national need', () => {
  const need = evaluate({ demands: [IRON, COAL] });
  assert.equal(need.active, true);
  assert.deepEqual(need.unresolved.map((d) => d.resourceId), ['iron', 'coal']);
});

test('3. Multiple missing resources do not create one Scout per resource', () => {
  const need = evaluate({ demands: [IRON, COAL, { ...HORSES, score: 80 }] });
  // The decision is a single national want, not one per unresolved resource.
  assert.equal(need.wantScout, true);
  assert.equal(typeof need.wantScout, 'boolean');
  assert.equal(need.unresolved.length, 3);
});

test('4. Existing Scouts at the cap eliminate the need for another', () => {
  assert.equal(evaluate({ landScoutCapacity: RESOURCE_EXPLORATION_LAND_SCOUT_CAP }).wantScout, false);
  assert.equal(evaluate({ landScoutCapacity: RESOURCE_EXPLORATION_LAND_SCOUT_CAP - 1 }).wantScout, true);
});

test('5. Existing Scout Boats count toward the naval cap', () => {
  const base = { canExploreSea: true } as const;
  assert.equal(evaluate({ ...base, seaScoutCapacity: 0 }).wantScoutBoat, true);
  assert.equal(evaluate({ ...base, seaScoutCapacity: RESOURCE_EXPLORATION_SEA_SCOUT_CAP }).wantScoutBoat, false);
});

test('Scout Boat is not requested when the nation cannot explore by sea', () => {
  assert.equal(evaluate({ canExploreSea: false, seaScoutCapacity: 0 }).wantScoutBoat, false);
});

test('6. A known Iron source prevents unnecessary Iron-driven exploration', () => {
  const need = evaluate({ hasKnownSource: (id) => id === 'iron' });
  assert.equal(need.active, false);
  assert.equal(need.wantScout, false);
});

test('7. Finding Iron reduces pressure while unresolved Coal keeps it active', () => {
  const need = evaluate({ demands: [IRON, COAL], hasKnownSource: (id) => id === 'iron' });
  assert.equal(need.active, true);
  assert.deepEqual(need.unresolved.map((d) => d.resourceId), ['coal']);
});

test('Demand below the significance threshold does not drive exploration', () => {
  assert.equal(MEANINGFUL_RESOURCE_DEMAND_SCORE, 40);
  const need = evaluate({ demands: [HORSES] }); // score 25 < 40
  assert.equal(need.active, false);
  assert.equal(need.wantScout, false);
});

test('14. No explorer is wanted (Economic Development → Gold continues) at full capacity', () => {
  const need = evaluate({
    demands: [IRON, COAL],
    canExploreSea: true,
    landScoutCapacity: RESOURCE_EXPLORATION_LAND_SCOUT_CAP,
    seaScoutCapacity: RESOURCE_EXPLORATION_SEA_SCOUT_CAP,
  });
  assert.equal(need.active, true); // demand still unresolved...
  assert.equal(need.wantScout, false); // ...but no further explorer is requested
  assert.equal(need.wantScoutBoat, false);
});
