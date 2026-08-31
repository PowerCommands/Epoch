import assert from 'node:assert/strict';
import test from 'node:test';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';

/**
 * Regression coverage for the war city-loss recording bug.
 *
 * captureCity() transfers city ownership to the attacker BEFORE the onCityCombat
 * event is handled, so at handling time `city.ownerId === attacker.ownerId`. The
 * old GameScene guard used `getState(attacker, city.ownerId)` which degenerated
 * into `getState(attacker, attacker)` — never WAR — so `recordWarCityLoss` was
 * never called and `citiesLost` stayed 0 for real conquests.
 *
 * The fix records against the attacker and the PREVIOUS owner instead. These
 * tests exercise DiplomacyManager's recording contract directly (the pair the
 * fixed GameScene handler now passes) and confirm the value flows out through
 * getWarExhaustion, which is exactly what PeaceTreatySystem.computeWarPressure
 * and CapitulationSystem consume.
 */

function harness() {
  let currentTurn = 0;
  const turnStub = { getCurrentRound: () => currentTurn } as unknown as TurnManager;
  const diplomacy = new DiplomacyManager(turnStub);
  return {
    diplomacy,
    setTurn: (t: number) => { currentTurn = t; },
  };
}

test('conquest records exactly one city loss against the previous owner, not the attacker', () => {
  const h = harness();
  const attacker = 'nation_england';
  const previousOwner = 'nation_france';

  // A and B at war (England the aggressor), mirroring a real wartime siege.
  assert.equal(h.diplomacy.declareWar(attacker, previousOwner), true);

  // The degenerate guard the OLD code used: after capture city.ownerId is the
  // attacker, so the lookup was getState(attacker, attacker) — never WAR.
  assert.notEqual(h.diplomacy.getState(attacker, attacker), 'WAR');
  // The correct pair is genuinely at war.
  assert.equal(h.diplomacy.getState(attacker, previousOwner), 'WAR');

  // Record the loss against (previousOwner, attacker), as the fixed handler does.
  h.diplomacy.recordWarCityLoss(previousOwner, attacker);

  // The loser's counter increments; the attacker never receives the loss.
  assert.equal(h.diplomacy.getWarExhaustion(previousOwner, attacker).citiesLost, 1);
  assert.equal(h.diplomacy.getWarExhaustion(attacker, previousOwner).citiesLost, 0);

  // A second conquest in the same war increments again (no double-count, no cap).
  h.diplomacy.recordWarCityLoss(previousOwner, attacker);
  assert.equal(h.diplomacy.getWarExhaustion(previousOwner, attacker).citiesLost, 2);

  // Three cities lost in one war reports citiesLost = 3 (the report's example).
  h.diplomacy.recordWarCityLoss(previousOwner, attacker);
  assert.equal(h.diplomacy.getWarExhaustion(previousOwner, attacker).citiesLost, 3);
});

test('city loss outside a valid war context is not recorded', () => {
  const h = harness();
  const attacker = 'nation_china';
  const previousOwner = 'nation_mongolia';

  // Never at war: recording must be a no-op (mirrors the fixed handler's WAR guard
  // and DiplomacyManager's own internal guard).
  h.diplomacy.recordWarCityLoss(previousOwner, attacker);
  assert.equal(h.diplomacy.getWarExhaustion(previousOwner, attacker).citiesLost, 0);

  // The self-pair the old code produced after capture is likewise never WAR, so it
  // could never have recorded anything.
  assert.notEqual(h.diplomacy.getState(attacker, attacker), 'WAR');
  h.diplomacy.recordWarCityLoss(attacker, attacker);
  assert.equal(h.diplomacy.getWarExhaustion(attacker, attacker).citiesLost, 0);
});

test('a new war between the same pair resets the per-war city-loss counter', () => {
  // Documents (does not change) the existing per-war reset behaviour that the
  // corrected value now feeds into.
  const h = harness();
  const attacker = 'nation_england';
  const previousOwner = 'nation_france';

  h.setTurn(0);
  assert.equal(h.diplomacy.declareWar(attacker, previousOwner), true);
  h.diplomacy.recordWarCityLoss(previousOwner, attacker);
  assert.equal(h.diplomacy.getWarExhaustion(previousOwner, attacker).citiesLost, 1);

  // End the war, then re-declare later: the fresh conflict starts from zero.
  h.diplomacy.respondToPeace(previousOwner, attacker, true);
  h.setTurn(200);
  assert.equal(h.diplomacy.declareWar(previousOwner, attacker), true);
  assert.equal(h.diplomacy.getWarExhaustion(previousOwner, attacker).citiesLost, 0);
});
