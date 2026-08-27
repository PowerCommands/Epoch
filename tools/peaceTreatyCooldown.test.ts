import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PEACE_TREATY_COOLDOWN_TURNS,
  DiplomacyManager,
  resolvePeaceTreatyCooldownTurns,
} from '../src/systems/DiplomacyManager.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';

/** Minimal turn source; DiplomacyManager only needs getCurrentRound(). */
function turnStub(): { manager: TurnManager; set(turn: number): void } {
  let round = 0;
  const manager = { getCurrentRound: () => round } as unknown as TurnManager;
  return { manager, set: (turn: number) => { round = turn; } };
}

test('resolvePeaceTreatyCooldownTurns falls back to 10 when absent or invalid', () => {
  assert.equal(DEFAULT_PEACE_TREATY_COOLDOWN_TURNS, 10);
  assert.equal(resolvePeaceTreatyCooldownTurns(undefined), 10); // scenario without the property
  assert.equal(resolvePeaceTreatyCooldownTurns(Number.NaN), 10);
  assert.equal(resolvePeaceTreatyCooldownTurns(-5), 10);
  assert.equal(resolvePeaceTreatyCooldownTurns(4), 4);
  assert.equal(resolvePeaceTreatyCooldownTurns(7.9), 7);
});

test('a default DiplomacyManager uses the 10-turn cooldown', () => {
  const dm = new DiplomacyManager();
  assert.equal(dm.getPeaceTreatyCooldownTurns(), 10);
});

test('peace starts the configured cooldown and blocks both directions of war', () => {
  const clock = turnStub();
  const dm = new DiplomacyManager(clock.manager, resolvePeaceTreatyCooldownTurns(6));

  clock.set(5);
  assert.equal(dm.declareWar('a', 'b'), true);
  clock.set(30);
  dm.respondToPeace('a', 'b', true); // accepted peace at turn 30 → cooldown until 36
  assert.equal(dm.getState('a', 'b'), 'PEACE');
  assert.equal(dm.isPeaceTreatyActive('a', 'b', 30), true);
  assert.equal(dm.getPeaceTreatyRemainingTurns('a', 'b', 30), 6);

  // Neither the original aggressor nor the defender can re-declare during the cooldown.
  assert.equal(dm.declareWar('a', 'b', ), false, 'A cannot re-declare on B');
  assert.equal(dm.declareWar('b', 'a'), false, 'B cannot re-declare on A');
  assert.equal(dm.getState('a', 'b'), 'PEACE');
});

test('the AI war-declaration path is blocked by the same authoritative check', () => {
  const clock = turnStub();
  const dm = new DiplomacyManager(clock.manager, 10);
  clock.set(1);
  dm.declareWar('ai', 'victim');
  clock.set(20);
  dm.respondToPeace('ai', 'victim', true);
  // AI declarations use the same declareWar() → transitionToWar() path as humans.
  clock.set(25);
  assert.equal(dm.declareWar('ai', 'victim'), false);
  assert.equal(dm.getState('ai', 'victim'), 'PEACE');
});

test('war can be declared again once the cooldown expires', () => {
  const clock = turnStub();
  const dm = new DiplomacyManager(clock.manager, 10);
  clock.set(1);
  dm.declareWar('a', 'b');
  clock.set(20);
  dm.respondToPeace('a', 'b', true); // cooldown until turn 30
  clock.set(29);
  assert.equal(dm.declareWar('a', 'b'), false, 'still inside cooldown');
  clock.set(30);
  assert.equal(dm.isPeaceTreatyActive('a', 'b', 30), false);
  assert.equal(dm.declareWar('a', 'b'), true, 'cooldown has expired');
});

test('save/load during an active treaty preserves the remaining restriction', () => {
  const clock = turnStub();
  const dm = new DiplomacyManager(clock.manager, 10);
  clock.set(1);
  dm.declareWar('a', 'b');
  clock.set(40);
  dm.respondToPeace('a', 'b', true); // cooldown until turn 50

  const saved = dm.getAllStates();
  assert.ok(saved.some((entry) => entry.relation.peaceTreatyUntilTurn === 50));

  // Reload into a fresh manager (the cooldown length even differs; the per-relation
  // until-turn is authoritative and must survive intact).
  const reloadClock = turnStub();
  const reloaded = new DiplomacyManager(reloadClock.manager, 3);
  for (const entry of saved) reloaded.restoreState(entry.keys[0], entry.keys[1], entry.relation);
  reloadClock.set(45);
  assert.equal(reloaded.isPeaceTreatyActive('a', 'b', 45), true);
  assert.equal(reloaded.declareWar('a', 'b'), false, 'restored treaty still blocks war');
  reloadClock.set(50);
  assert.equal(reloaded.declareWar('a', 'b'), true, 'restored treaty expires deterministically');
});

test('a capital-only nation can still open and complete a peace proposal', () => {
  const clock = turnStub();
  const dm = new DiplomacyManager(clock.manager, 10);
  clock.set(1);
  dm.declareWar('a', 'b');
  clock.set(20);
  // No offered city — the manager-level flow accepts an empty offer.
  dm.proposePeace('a', 'b');
  const proposal = dm.getPendingProposal('b');
  assert.ok(proposal);
  assert.equal(proposal?.offeredCityId, undefined);
  dm.respondToPeace('a', 'b', true);
  assert.equal(dm.getState('a', 'b'), 'PEACE');
  assert.equal(dm.isPeaceTreatyActive('a', 'b', 20), true);
});

test('forced scenario declarations still bypass the treaty (unchanged)', () => {
  const clock = turnStub();
  const dm = new DiplomacyManager(clock.manager, 10);
  clock.set(1);
  dm.declareWar('a', 'b');
  clock.set(20);
  dm.respondToPeace('a', 'b', true);
  clock.set(22);
  assert.equal(dm.declareWar('a', 'b'), false); // standard path blocked
  assert.equal(dm.forceDeclareWar('a', 'b'), true); // scenario/system path bypasses
  assert.equal(dm.getState('a', 'b'), 'WAR');
});
