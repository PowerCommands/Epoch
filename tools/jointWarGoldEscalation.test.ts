import assert from 'node:assert/strict';
import test from 'node:test';

import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import {
  JOIN_WAR_GOLD_ESCALATION_STEP,
  JOIN_WAR_MINIMUM_GOLD_RESERVE,
  JointWarSystem,
  type JointWarEconomy,
} from '../src/systems/diplomacy/JointWarSystem.ts';
import type { AllianceManager } from '../src/systems/diplomacy/AllianceManager.ts';
import type { DiplomaticEvaluationSystem } from '../src/systems/diplomacy/DiplomaticEvaluationSystem.ts';
import type { AIMilitaryEvaluationSystem } from '../src/systems/ai/AIMilitaryEvaluationSystem.ts';
import type { NationManager } from '../src/systems/NationManager.ts';
import type { JointWarProposal } from '../src/types/jointWar.ts';

const ENGLAND = 'nation_england';
const FRANCE = 'nation_france';
const GERMANY = 'nation_germany';
const SPAIN = 'nation_spain';

function proposal(targetNationId = GERMANY): JointWarProposal {
  return {
    proposerNationId: ENGLAND,
    receiverNationId: FRANCE,
    targetNationId,
    kind: 'join',
  };
}

function harness(startingGold = 100_000): {
  system: JointWarSystem;
  diplomacy: DiplomacyManager;
  balances: Map<string, number>;
} {
  const diplomacy = new DiplomacyManager();
  diplomacy.declareWar(ENGLAND, GERMANY);
  const balances = new Map([
    [ENGLAND, startingGold],
    [FRANCE, 1_000],
    [GERMANY, 1_000],
    [SPAIN, 1_000],
  ]);
  const economy: JointWarEconomy = {
    getGold: (nationId) => balances.get(nationId) ?? 0,
    transferGold: (fromNationId, toNationId, amount) => {
      const from = balances.get(fromNationId) ?? 0;
      if (from < amount) return false;
      balances.set(fromNationId, from - amount);
      balances.set(toNationId, (balances.get(toNationId) ?? 0) + amount);
      return true;
    },
  };
  const evaluation = {
    evaluateAttitude: (viewer: string, other: string) => (
      viewer === ENGLAND && other === FRANCE ? 'friendly' : 'neutral'
    ),
  } as unknown as DiplomaticEvaluationSystem;
  const military = {
    isNationActive: () => true,
    getMilitaryStrength: () => ({ totalStrength: 100 }),
    getDefensiveWarPowerAgainst: () => 100,
  } as unknown as AIMilitaryEvaluationSystem;
  const alliances = { areAllied: () => false } as unknown as AllianceManager;
  const nations = {
    getAllNations: () => [ENGLAND, FRANCE, GERMANY, SPAIN].map((id) => ({ id })),
  } as unknown as NationManager;
  return {
    system: new JointWarSystem(diplomacy, evaluation, military, alliances, nations, () => true, economy),
    diplomacy,
    balances,
  };
}

test('initial Join War offer and acceptance behavior are unchanged at zero gold', () => {
  const { system } = harness();
  assert.equal(system.getGoldOffer(ENGLAND, FRANCE, GERMANY), 0);
  assert.equal(
    system.shouldAccept(FRANCE, ENGLAND, GERMANY, 'join', false),
    system.shouldAccept(FRANCE, ENGLAND, GERMANY, 'join', false, 0),
  );
});

test('the zero-gold initial attempt is not blocked by the escalation reserve', () => {
  const { system } = harness(5_000);
  const initial = system.findAIProposal(ENGLAND);
  assert.ok(initial);
  assert.equal(initial.offeredGold, 0);
  assert.equal(initial.goldOfferBlockedByReserve, false);
});

test('rejections escalate linearly by 10,000 and never double', () => {
  const { system } = harness();
  const offers = [system.getGoldOffer(ENGLAND, FRANCE, GERMANY)];
  for (let i = 0; i < 4; i++) {
    system.recordRejectedProposal(proposal());
    offers.push(system.getGoldOffer(ENGLAND, FRANCE, GERMANY));
  }
  assert.deepEqual(offers, [0, 10_000, 20_000, 30_000, 40_000]);
  assert.equal(JOIN_WAR_GOLD_ESCALATION_STEP, 10_000);
});

test('gold is additive and does not disturb existing offer-term evaluation', () => {
  const { system } = harness();
  const original = system.shouldAccept(FRANCE, ENGLAND, GERMANY, 'join', false, 0);
  const withRights = system.shouldAccept(FRANCE, ENGLAND, GERMANY, 'join', true, 0);
  const withGoldAndRights = system.shouldAccept(FRANCE, ENGLAND, GERMANY, 'join', true, 20_000);
  assert.equal(original, false);
  // France's configured exploitation interest may give no tip; the important
  // invariant is that supplying the term still follows the existing path.
  assert.equal(withRights, system.shouldAccept(FRANCE, ENGLAND, GERMANY, 'join', true));
  assert.equal(withGoldAndRights, true);
});

test('an unaffordable fixed retry is marked skipped and is not reduced', () => {
  const { system } = harness(45_000);
  for (let i = 0; i < 3; i++) system.recordRejectedProposal(proposal());
  const next = system.findAIProposal(ENGLAND);
  assert.ok(next);
  assert.equal(next.offeredGold, 30_000);
  assert.equal(next.goldOfferBlockedByReserve, true);
  assert.equal((next.proposerTreasury ?? 0) - (next.offeredGold ?? 0), 15_000);
  assert.equal(JOIN_WAR_MINIMUM_GOLD_RESERVE, 20_000);
});

test('accepted escalated gold uses the economy transfer and retains the reserve', () => {
  const { system, balances } = harness(50_000);
  const accepted = { ...proposal(), offeredGold: 30_000 };
  assert.equal(system.transferAcceptedGold(accepted), true);
  assert.equal(balances.get(ENGLAND), 20_000);
  assert.equal(balances.get(FRANCE), 31_000);

  balances.set(ENGLAND, 49_999);
  assert.equal(system.transferAcceptedGold(accepted), false);
  assert.equal(balances.get(ENGLAND), 49_999);
});

test('escalation is isolated by enemy and cleared when its war ends', () => {
  const { system, diplomacy } = harness();
  system.recordRejectedProposal(proposal(GERMANY));
  system.recordRejectedProposal(proposal(GERMANY));
  assert.equal(system.getGoldOffer(ENGLAND, FRANCE, GERMANY), 20_000);
  assert.equal(system.getGoldOffer(ENGLAND, FRANCE, SPAIN), 0);

  diplomacy.enforceCeasefire(ENGLAND, GERMANY, 5);
  assert.equal(system.getGoldOffer(ENGLAND, FRANCE, GERMANY), 0);
});

test('Join War rejection escalation survives save/load restoration', () => {
  const first = harness().system;
  first.recordRejectedProposal(proposal());
  first.recordRejectedProposal(proposal());
  const saved = JSON.parse(JSON.stringify(first.serialize()));

  const restored = harness().system;
  restored.restore(saved);
  assert.equal(restored.getRejectionCount(ENGLAND, FRANCE, GERMANY), 2);
  assert.equal(restored.getGoldOffer(ENGLAND, FRANCE, GERMANY), 20_000);
  restored.clearAcceptedProposal(proposal());
  assert.equal(restored.getGoldOffer(ENGLAND, FRANCE, GERMANY), 0);
});
