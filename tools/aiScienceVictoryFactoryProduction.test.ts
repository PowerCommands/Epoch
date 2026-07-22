/**
 * Focused tests for the public space-race first-Factory AI response.
 * Run with: npx tsx --test tools/aiScienceVictoryFactoryProduction.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AI_SPACE_RACE_FACTORY_BASE_SCORE,
  AI_SPACE_RACE_FIRST_FACTORY_BONUS,
  getAISpaceRaceFactoryPriority,
  type AISpaceRaceFactoryPriorityContext,
} from '../src/systems/ai/AIScienceVictoryFactoryProduction.ts';

const ELIGIBLE: AISpaceRaceFactoryPriorityContext = {
  scienceVictoryEnabled: true,
  spaceRaceGloballyUnlocked: true,
  hasFlight: true,
  hasAluminum: true,
  activeFactoryCount: 0,
  queuedFactoryCount: 0,
};

test('before AeroSpace Industries exists no space-race Factory priority applies', () => {
  assert.equal(getAISpaceRaceFactoryPriority({
    ...ELIGIBLE,
    spaceRaceGloballyUnlocked: false,
  }).applies, false);
});

test('global unlock plus Flight, Aluminum, and zero Factories activates priority', () => {
  const priority = getAISpaceRaceFactoryPriority(ELIGIBLE);
  assert.equal(priority.applies, true);
  assert.equal(priority.baseScore, AI_SPACE_RACE_FACTORY_BASE_SCORE);
  assert.equal(priority.scienceVictoryBonus, AI_SPACE_RACE_FIRST_FACTORY_BONUS);
  assert.equal(priority.resultingScore, 260);
});

test('missing Flight prevents the specific Factory priority', () => {
  assert.equal(getAISpaceRaceFactoryPriority({ ...ELIGIBLE, hasFlight: false }).applies, false);
});

test('missing Aluminum prevents the specific Factory priority', () => {
  assert.equal(getAISpaceRaceFactoryPriority({ ...ELIGIBLE, hasAluminum: false }).applies, false);
});

test('an active Factory stops the special first-Factory priority', () => {
  assert.equal(getAISpaceRaceFactoryPriority({ ...ELIGIBLE, activeFactoryCount: 1 }).applies, false);
});

test('an already queued Factory prevents duplicate special Factory production', () => {
  assert.equal(getAISpaceRaceFactoryPriority({ ...ELIGIBLE, queuedFactoryCount: 1 }).applies, false);
});

test('Science Victory disabled prevents the specific Factory priority', () => {
  assert.equal(getAISpaceRaceFactoryPriority({ ...ELIGIBLE, scienceVictoryEnabled: false }).applies, false);
});

test('Factory priority uses only the public unlock and the nation own state', () => {
  const withUnrelatedRivalProgress = {
    ...ELIGIBLE,
    rivalAerospaceParts: 9,
  };
  assert.deepEqual(
    getAISpaceRaceFactoryPriority(withUnrelatedRivalProgress),
    getAISpaceRaceFactoryPriority(ELIGIBLE),
  );
});
