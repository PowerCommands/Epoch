/**
 * Focused tests for the Science Victory execution planner that forces an AI in
 * Science Victory Focus to found AeroSpace Industries and then manufacture
 * Aerospace Parts, so routine production cannot starve an available win path.
 * Run with: npx tsx --test tools/aiScienceVictoryExecution.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  planScienceVictoryProduction,
  type ScienceVictoryExecutionInput,
} from '../src/systems/ai/AIVictoryFocus.ts';

const BASE: ScienceVictoryExecutionInput = {
  inScienceFocus: true,
  hasAerospaceIndustries: false,
  canFoundAerospaceIndustries: true,
  aerospaceIndustriesInProduction: false,
  emergencyActive: false,
  accumulatedParts: 0,
  inFlightParts: 0,
  requiredParts: 10,
  corporationEligibleCities: [
    { cityId: 'cityA', idle: true, turns: 5 },
    { cityId: 'cityB', idle: true, turns: 3 },
  ],
  partEligibleIdleCityIds: [],
};

// 1. In focus + can found → commit the fastest idle eligible city immediately.
test('prioritizes founding AeroSpace Industries in the fastest idle eligible city', () => {
  const plan = planScienceVictoryProduction(BASE);
  assert.deepEqual(plan, { kind: 'foundAerospaceIndustries', cityId: 'cityB', immediate: true });
});

// 2. Routine production cannot indefinitely block: with no idle city and no
//    emergency, jump the queue of the fastest eligible (busy) city.
test('queues the corporation ahead of routine production when all eligible cities are busy', () => {
  const plan = planScienceVictoryProduction({
    ...BASE,
    corporationEligibleCities: [
      { cityId: 'cityA', idle: false, turns: 8 },
      { cityId: 'cityB', idle: false, turns: 4 },
    ],
  });
  assert.deepEqual(plan, { kind: 'foundAerospaceIndustries', cityId: 'cityB', immediate: false });
});

// Do not reshuffle: if it is already being produced/queued, take no action.
test('does not duplicate or reshuffle when the corporation is already in production', () => {
  const plan = planScienceVictoryProduction({ ...BASE, aerospaceIndustriesInProduction: true });
  assert.deepEqual(plan, { kind: 'none' });
});

// 3 & 4. After founding, prioritize Aerospace Parts in idle eligible cities,
//        bounded by the remaining requirement so parts accumulate to the target.
test('after founding, prioritizes Aerospace Parts in idle eligible cities', () => {
  const plan = planScienceVictoryProduction({
    ...BASE,
    hasAerospaceIndustries: true,
    canFoundAerospaceIndustries: false,
    accumulatedParts: 2,
    inFlightParts: 1,
    requiredParts: 10,
    partEligibleIdleCityIds: ['cityA', 'cityB', 'cityC'],
  });
  assert.deepEqual(plan, { kind: 'produceAerospaceParts', cityIds: ['cityA', 'cityB', 'cityC'] });
});

test('part production never exceeds the remaining Science Victory requirement', () => {
  const plan = planScienceVictoryProduction({
    ...BASE,
    hasAerospaceIndustries: true,
    canFoundAerospaceIndustries: false,
    accumulatedParts: 8,
    inFlightParts: 1,
    requiredParts: 10,
    partEligibleIdleCityIds: ['cityA', 'cityB', 'cityC'],
  });
  // Only 1 more part is needed (8 done + 1 in flight = 9 / 10).
  assert.deepEqual(plan, { kind: 'produceAerospaceParts', cityIds: ['cityA'] });
});

test('no part production once the requirement is already underway', () => {
  const plan = planScienceVictoryProduction({
    ...BASE,
    hasAerospaceIndustries: true,
    canFoundAerospaceIndustries: false,
    accumulatedParts: 7,
    inFlightParts: 3,
    requiredParts: 10,
    partEligibleIdleCityIds: ['cityA'],
  });
  assert.deepEqual(plan, { kind: 'none' });
});

// 5. Genuine emergency can override the queue jump (no idle city available).
test('an active emergency defers founding rather than jumping a busy city queue', () => {
  const plan = planScienceVictoryProduction({
    ...BASE,
    emergencyActive: true,
    corporationEligibleCities: [{ cityId: 'cityA', idle: false, turns: 4 }],
  });
  assert.deepEqual(plan, { kind: 'deferFounding', reason: 'all eligible cities busy while an emergency is active' });
});

test('an emergency does NOT stop committing a genuinely idle city (winning still dominates)', () => {
  const plan = planScienceVictoryProduction({
    ...BASE,
    emergencyActive: true,
    corporationEligibleCities: [
      { cityId: 'cityA', idle: false, turns: 4 },
      { cityId: 'cityB', idle: true, turns: 6 },
    ],
  });
  assert.deepEqual(plan, { kind: 'foundAerospaceIndustries', cityId: 'cityB', immediate: true });
});

// Guard rails: no false commitment.
test('no action when not in Science Victory Focus', () => {
  assert.deepEqual(planScienceVictoryProduction({ ...BASE, inScienceFocus: false }), { kind: 'none' });
});

test('no founding action when the requirements are not yet satisfied', () => {
  assert.deepEqual(
    planScienceVictoryProduction({ ...BASE, canFoundAerospaceIndustries: false }),
    { kind: 'none' },
  );
});

test('no action once the Science Victory part requirement is already fulfilled', () => {
  assert.deepEqual(
    planScienceVictoryProduction({
      ...BASE,
      hasAerospaceIndustries: true,
      canFoundAerospaceIndustries: false,
      accumulatedParts: 10,
      requiredParts: 10,
      partEligibleIdleCityIds: ['cityA'],
    }),
    { kind: 'none' },
  );
});
