import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PEACE_TREATY_COOLDOWN_TURNS,
  DiplomacyManager,
  PEACE_TREATY_COOLING_PER_ROUND,
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

function beginCoolingTest(cooldownTurns: number, values = {
  trust: 44,
  fear: 30,
  hostility: 80,
  affinity: 12,
  suspicion: 55,
}) {
  const clock = turnStub();
  const dm = new DiplomacyManager(clock.manager, cooldownTurns);
  clock.set(1);
  dm.declareWar('a', 'b');
  clock.set(20);
  dm.respondToPeace('a', 'b', true);
  dm.setMemoryValues('a', 'b', values);
  return { clock, dm };
}

test('active Peace Treaty cooldown cools hostility, suspicion, and fear by exactly 2 per turn', () => {
  assert.equal(PEACE_TREATY_COOLING_PER_ROUND, 2);
  const { dm } = beginCoolingTest(10);

  dm.processDiplomaticUpkeep(21);
  assert.deepEqual(
    (({ hostility, suspicion, fear }) => ({ hostility, suspicion, fear }))(dm.getRelation('a', 'b')),
    { hostility: 78, suspicion: 53, fear: 28 },
  );

  for (let round = 22; round <= 30; round += 1) dm.processDiplomaticUpkeep(round);
  const afterTen = dm.getRelation('a', 'b');
  assert.equal(afterTen.hostility, 60);
  assert.equal(afterTen.suspicion, 35);
  assert.equal(afterTen.fear, 10);
  assert.equal(afterTen.trust, 44, 'trust is unchanged');
  assert.equal(afterTen.affinity, 12, 'affinity is unchanged');
});

test('cooling clamps negative memories at zero', () => {
  const { dm } = beginCoolingTest(2, {
    trust: 50, fear: 1, hostility: 0, affinity: 7, suspicion: 1,
  });
  dm.processDiplomaticUpkeep(21);
  dm.processDiplomaticUpkeep(22);
  const relation = dm.getRelation('a', 'b');
  assert.equal(relation.hostility, 0);
  assert.equal(relation.suspicion, 0);
  assert.equal(relation.fear, 0);
  assert.equal(relation.trust, 50);
  assert.equal(relation.affinity, 7);
});

test('one round-start upkeep pass cools each treaty pair once, regardless of pair direction', () => {
  const { dm } = beginCoolingTest(3);
  dm.processDiplomaticUpkeep(21);
  assert.equal(dm.getRelation('a', 'b').hostility, 78);
  assert.equal(dm.getRelation('b', 'a').hostility, 78, 'one symmetric pair record, not two directional passes');
});

test('cooling lasts exactly the scenario-configured duration, then normal upkeep resumes', () => {
  const { dm } = beginCoolingTest(3);
  for (let round = 21; round <= 23; round += 1) dm.processDiplomaticUpkeep(round);
  let relation = dm.getRelation('a', 'b');
  assert.equal(relation.hostility, 74, 'three configured turns provide six hostility cooling');
  assert.equal(relation.fear, 24);
  assert.equal(relation.suspicion, 49);

  dm.processDiplomaticUpkeep(24);
  relation = dm.getRelation('a', 'b');
  assert.equal(relation.hostility, 74, 'treaty hostility cooling stopped');
  assert.equal(relation.fear, 24, 'treaty fear cooling stopped');
  assert.equal(relation.suspicion, 48, 'pre-existing ordinary suspicion drift continues');
});

test('a 30-turn configured cooldown can provide 60 points of diplomatic cooling', () => {
  const { dm } = beginCoolingTest(30);
  for (let round = 21; round <= 50; round += 1) dm.processDiplomaticUpkeep(round);
  const relation = dm.getRelation('a', 'b');
  assert.equal(relation.hostility, 20);
  assert.equal(relation.suspicion, 0);
  assert.equal(relation.fear, 0);
});

test('live diplomatic changes during cooldown are preserved and cooling continues from them', () => {
  const { dm } = beginCoolingTest(3, {
    trust: 40, fear: 20, hostility: 70, affinity: 5, suspicion: 30,
  });
  dm.processDiplomaticUpkeep(21);
  let relation = dm.getRelation('a', 'b');
  dm.setMemoryValues('a', 'b', {
    trust: relation.trust,
    fear: relation.fear,
    hostility: relation.hostility + 10,
    affinity: relation.affinity,
    suspicion: relation.suspicion,
  });
  dm.processDiplomaticUpkeep(22);
  relation = dm.getRelation('a', 'b');
  assert.equal(relation.hostility, 76, '70 - 2 + 10 - 2');
  assert.equal(relation.fear, 16);
  assert.equal(relation.suspicion, 26);
});

test('save/load during active cooldown continues deterministically from live values', () => {
  const uninterrupted = beginCoolingTest(5);
  uninterrupted.dm.processDiplomaticUpkeep(21);
  uninterrupted.dm.processDiplomaticUpkeep(22);
  const saved = uninterrupted.dm.getAllStates();

  const reloadClock = turnStub();
  const reloaded = new DiplomacyManager(reloadClock.manager, 99);
  for (const entry of saved) reloaded.restoreState(entry.keys[0], entry.keys[1], entry.relation);

  for (let round = 23; round <= 25; round += 1) {
    uninterrupted.dm.processDiplomaticUpkeep(round);
    reloaded.processDiplomaticUpkeep(round);
  }
  assert.deepEqual(reloaded.getRelation('a', 'b'), uninterrupted.dm.getRelation('a', 'b'));
  assert.equal(reloaded.getRelation('a', 'b').hostility, 70, 'saved until-turn, not new manager duration, is authoritative');
});

test('older active treaty state without a start stamp still cools from its authoritative until-turn', () => {
  const dm = new DiplomacyManager();
  dm.restoreState('a', 'b', {
    state: 'PEACE',
    peaceTreatyUntilTurn: 30,
    lastPeaceProposalTurn: null,
    hostility: 40,
    suspicion: 20,
    fear: 10,
  });
  dm.processDiplomaticUpkeep(25);
  const relation = dm.getRelation('a', 'b');
  assert.equal(relation.hostility, 38);
  assert.equal(relation.suspicion, 18);
  assert.equal(relation.fear, 8);
});
