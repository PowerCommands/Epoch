/**
 * Focused deterministic tests for the AI-only normal-expansion Settler cooldown.
 *
 * The cooldown gives an AI capital a 20-turn head start before normal
 * territorial expansion, then a 10-turn minimum interval between subsequent
 * city foundings. Expedition-driven settlement is exempt (it never routes
 * through this decision) and human Settler production is unaffected.
 *
 * Run with: npx tsx --test tools/aiExpansionCooldown.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CAPITAL_EXPANSION_SETTLER_COOLDOWN_TURNS,
  SUBSEQUENT_EXPANSION_SETTLER_COOLDOWN_TURNS,
  isNormalExpansionSettlerOnCooldown,
} from '../src/systems/ai/utils/AIExpansionUtils.ts';

test('a nation that never founded a city in-game is never on cooldown', () => {
  assert.equal(
    isNormalExpansionSettlerOnCooldown({
      lastCityFoundedTurn: undefined,
      cityCount: 1,
      currentTurn: 5,
    }),
    false,
  );
});

test('normal expansion is blocked during the 20-turn post-capital cooldown', () => {
  // Capital founded on turn 1; still a single city.
  for (let turn = 1; turn < 1 + CAPITAL_EXPANSION_SETTLER_COOLDOWN_TURNS; turn++) {
    assert.equal(
      isNormalExpansionSettlerOnCooldown({
        lastCityFoundedTurn: 1,
        cityCount: 1,
        currentTurn: turn,
      }),
      true,
      `expected cooldown active on turn ${turn}`,
    );
  }
});

test('normal expansion resumes once the 20-turn capital cooldown elapses', () => {
  const readyTurn = 1 + CAPITAL_EXPANSION_SETTLER_COOLDOWN_TURNS; // turn 21
  assert.equal(
    isNormalExpansionSettlerOnCooldown({
      lastCityFoundedTurn: 1,
      cityCount: 1,
      currentTurn: readyTurn,
    }),
    false,
  );
});

test('founding a subsequent city starts a 10-turn cooldown', () => {
  // Second city founded on turn 30; nation now has two cities.
  const foundedTurn = 30;
  for (let offset = 0; offset < SUBSEQUENT_EXPANSION_SETTLER_COOLDOWN_TURNS; offset++) {
    assert.equal(
      isNormalExpansionSettlerOnCooldown({
        lastCityFoundedTurn: foundedTurn,
        cityCount: 2,
        currentTurn: foundedTurn + offset,
      }),
      true,
      `expected cooldown active ${offset} turns after founding`,
    );
  }
  // Exactly 10 turns later, normal expansion is eligible again.
  assert.equal(
    isNormalExpansionSettlerOnCooldown({
      lastCityFoundedTurn: foundedTurn,
      cityCount: 2,
      currentTurn: foundedTurn + SUBSEQUENT_EXPANSION_SETTLER_COOLDOWN_TURNS,
    }),
    false,
  );
});

test('the subsequent-city interval is shorter than the capital interval', () => {
  assert.ok(
    SUBSEQUENT_EXPANSION_SETTLER_COOLDOWN_TURNS < CAPITAL_EXPANSION_SETTLER_COOLDOWN_TURNS,
  );
  // At two cities, turn 12 after a turn-1 founding is already eligible, whereas
  // a single-city nation (capital) would still be on cooldown at the same point.
  assert.equal(
    isNormalExpansionSettlerOnCooldown({ lastCityFoundedTurn: 1, cityCount: 2, currentTurn: 12 }),
    false,
  );
  assert.equal(
    isNormalExpansionSettlerOnCooldown({ lastCityFoundedTurn: 1, cityCount: 1, currentTurn: 12 }),
    true,
  );
});
