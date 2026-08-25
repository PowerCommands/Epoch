import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { isHumanInvolvedInCombat } from '../src/systems/CombatAnimationPolicy.ts';

test('camera impact is enabled when the human attacks', () => {
  assert.equal(isHumanInvolvedInCombat('human', 'human', 'ai-a'), true);
});

test('camera impact is enabled when the human defends', () => {
  assert.equal(isHumanInvolvedInCombat('human', 'ai-a', 'human'), true);
});

test('camera impact is disabled for AI versus AI combat', () => {
  assert.equal(isHumanInvolvedInCombat('human', 'ai-a', 'ai-b'), false);
});

test('camera impact is disabled for barbarian versus AI combat', () => {
  assert.equal(isHumanInvolvedInCombat('human', 'nation_barbarian', 'ai-a'), false);
});

test('camera impact is disabled when no human nation exists', () => {
  assert.equal(isHumanInvolvedInCombat(undefined, 'ai-a', 'ai-b'), false);
});

test('unit and city combat pass the human-involvement decision to guarded camera shake', () => {
  const scene = readFileSync(new URL('../src/scenes/GameScene.ts', import.meta.url), 'utf8');
  const animation = readFileSync(new URL('../src/systems/CombatAnimationSystem.ts', import.meta.url), 'utf8');
  assert.match(scene, /e\.attacker\.ownerId, e\.defender\.ownerId/);
  assert.match(scene, /e\.previousOwnerId \?\? e\.city\.ownerId/);
  assert.equal((animation.match(/if \(options\.shakeOnImpact\) this\.shake\(\);/g) ?? []).length, 2);
  assert.doesNotMatch(animation, /\n\s*this\.shake\(\);/);
});
