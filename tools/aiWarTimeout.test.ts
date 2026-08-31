/**
 * Focused deterministic tests for the 100-turn AI war timeout / peace rule.
 *
 * Rule: an AI attacker that has not forced the defender to capitulate within 100
 * turns sues for peace paying 20% of its current gold treasury. AI defenders
 * accept immediately through the normal peace-resolution path; a human defender
 * receives a normal peace offer to decide on. Human attackers are never forced.
 *
 * Run with: npx tsx --test tools/aiWarTimeout.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Nation } from '../src/entities/Nation.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { DiplomacyManager, type PeaceProposal } from '../src/systems/DiplomacyManager.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';
import {
  AIWarTimeoutSystem,
  WAR_TIMEOUT_TURNS,
  WAR_TIMEOUT_REPROPOSE_COOLDOWN_TURNS,
  type WarTimeoutPeaceSettler,
} from '../src/systems/diplomacy/AIWarTimeoutSystem.ts';

interface HarnessNation {
  id: string;
  isHuman?: boolean;
  gold?: number;
}

function makeHarness(nationConfigs: HarnessNation[]) {
  const nations = new NationManager();
  for (const cfg of nationConfigs) {
    nations.addNation(new Nation({ id: cfg.id, name: cfg.id, color: 0xffffff, isHuman: cfg.isHuman ?? false }));
    nations.getResources(cfg.id).gold = cfg.gold ?? 0;
  }

  let currentTurn = 0;
  const turnStub = { getCurrentRound: () => currentTurn } as unknown as TurnManager;
  const diplomacy = new DiplomacyManager(turnStub);

  // Faithful stand-in for PeaceTreatySystem.settleAcceptedPeace: transfer the
  // (treasury-capped) gold and end the war through the real DiplomacyManager path.
  const settledProposals: PeaceProposal[] = [];
  const peaceSettler: WarTimeoutPeaceSettler = {
    settleAcceptedPeace(proposal: PeaceProposal) {
      settledProposals.push(proposal);
      if (diplomacy.getState(proposal.fromNationId, proposal.toNationId) !== 'WAR') return;
      const requested = Math.max(0, Math.floor(proposal.goldReparations ?? 0));
      const treasury = Math.max(0, Math.floor(nations.getResources(proposal.fromNationId).gold));
      const gold = Math.min(requested, treasury);
      nations.getResources(proposal.fromNationId).gold -= gold;
      nations.getResources(proposal.toNationId).gold += gold;
      diplomacy.respondToPeace(proposal.fromNationId, proposal.toNationId, true);
    },
  };

  const logs: string[] = [];
  const system = new AIWarTimeoutSystem(
    diplomacy,
    nations,
    peaceSettler,
    () => currentTurn,
    (message) => logs.push(message),
  );

  return {
    nations,
    diplomacy,
    system,
    settledProposals,
    logs,
    setTurn: (value: number) => { currentTurn = value; },
    declareWarAt: (aggressorId: string, defenderId: string, turn: number) => {
      currentTurn = turn;
      assert.equal(diplomacy.declareWar(aggressorId, defenderId), true);
    },
  };
}

test('AI attacker at 100 turns without capitulation → peace triggers via the normal path', () => {
  const h = makeHarness([{ id: 'ai_a', gold: 1000 }, { id: 'ai_b' }]);
  h.declareWarAt('ai_a', 'ai_b', 0);

  h.setTurn(WAR_TIMEOUT_TURNS); // turn 100 → duration 100
  h.system.handleRoundStart();

  assert.equal(h.settledProposals.length, 1, 'peace should be settled exactly once');
  assert.equal(h.diplomacy.getState('ai_a', 'ai_b'), 'PEACE', 'war should end through the settler');
});

test('reparations equal exactly 20% of the attacker treasury at trigger time', () => {
  const h = makeHarness([{ id: 'ai_a', gold: 1234 }, { id: 'ai_b', gold: 50 }]);
  h.declareWarAt('ai_a', 'ai_b', 10);

  h.setTurn(10 + WAR_TIMEOUT_TURNS);
  h.system.handleRoundStart();

  const expected = Math.floor(1234 * 0.2); // 246
  assert.equal(h.settledProposals[0]?.goldReparations, expected);
  assert.equal(h.nations.getResources('ai_a').gold, 1234 - expected);
  assert.equal(h.nations.getResources('ai_b').gold, 50 + expected);
});

test('AI defender accepts automatically (no proposal is left pending)', () => {
  const h = makeHarness([{ id: 'ai_a', gold: 500 }, { id: 'ai_b' }]);
  h.declareWarAt('ai_a', 'ai_b', 0);

  h.setTurn(WAR_TIMEOUT_TURNS);
  h.system.handleRoundStart();

  assert.equal(h.diplomacy.getPendingProposal('ai_b'), null);
  assert.equal(h.diplomacy.getState('ai_a', 'ai_b'), 'PEACE');
});

test('below 100 turns → timeout does not trigger', () => {
  const h = makeHarness([{ id: 'ai_a', gold: 1000 }, { id: 'ai_b' }]);
  h.declareWarAt('ai_a', 'ai_b', 0);

  h.setTurn(WAR_TIMEOUT_TURNS - 1); // duration 99
  h.system.handleRoundStart();

  assert.equal(h.settledProposals.length, 0);
  assert.equal(h.diplomacy.getState('ai_a', 'ai_b'), 'WAR');
});

test('defender capitulates (war ends) before 100 turns → timeout never fires', () => {
  const h = makeHarness([{ id: 'ai_a', gold: 1000 }, { id: 'ai_b' }]);
  h.declareWarAt('ai_a', 'ai_b', 0);

  // Simulate capitulation ending the war at turn 50 (existing peace path).
  h.setTurn(50);
  h.diplomacy.respondToPeace('ai_a', 'ai_b', true);

  h.setTurn(200);
  h.system.handleRoundStart();

  assert.equal(h.settledProposals.length, 0, 'no timeout peace once the war already ended');
});

test('human attacker → no forced automatic peace', () => {
  const h = makeHarness([{ id: 'human', isHuman: true, gold: 1000 }, { id: 'ai_b' }]);
  h.declareWarAt('human', 'ai_b', 0);

  h.setTurn(WAR_TIMEOUT_TURNS + 20);
  h.system.handleRoundStart();

  assert.equal(h.settledProposals.length, 0);
  assert.equal(h.diplomacy.getPendingProposal('ai_b'), null);
  assert.equal(h.diplomacy.getState('human', 'ai_b'), 'WAR');
});

test('AI attacker vs human defender → proposes peace, human decides (no auto-accept)', () => {
  const h = makeHarness([{ id: 'ai_a', gold: 1000 }, { id: 'human', isHuman: true }]);
  h.declareWarAt('ai_a', 'human', 0);

  h.setTurn(WAR_TIMEOUT_TURNS);
  h.system.handleRoundStart();

  assert.equal(h.settledProposals.length, 0, 'must never settle on the human’s behalf');
  const pending = h.diplomacy.getPendingProposal('human');
  assert.notEqual(pending, null, 'a normal peace offer should be presented to the human');
  assert.equal(pending?.goldReparations, Math.floor(1000 * 0.2));
  assert.equal(h.diplomacy.getState('ai_a', 'human'), 'WAR', 'war continues until the human accepts');
});

test('rejected human offer is not repeated every turn (uses re-propose cooldown)', () => {
  const h = makeHarness([{ id: 'ai_a', gold: 1000 }, { id: 'human', isHuman: true }]);
  h.declareWarAt('ai_a', 'human', 0);

  h.setTurn(WAR_TIMEOUT_TURNS);
  h.system.handleRoundStart();
  assert.notEqual(h.diplomacy.getPendingProposal('human'), null);

  // Human rejects the offer.
  h.diplomacy.respondToPeace('ai_a', 'human', false);
  assert.equal(h.diplomacy.getPendingProposal('human'), null);

  // Next turn (within cooldown) → no immediate re-offer.
  h.setTurn(WAR_TIMEOUT_TURNS + 1);
  h.system.handleRoundStart();
  assert.equal(h.diplomacy.getPendingProposal('human'), null, 'should not re-offer within cooldown');

  // After the cooldown elapses → offer again.
  h.setTurn(WAR_TIMEOUT_TURNS + WAR_TIMEOUT_REPROPOSE_COOLDOWN_TURNS);
  h.system.handleRoundStart();
  assert.notEqual(h.diplomacy.getPendingProposal('human'), null, 'should re-offer once cooldown passes');
});

test('a later Join War keeps its own 100-turn timer instead of inheriting the older war', () => {
  const h = makeHarness([{ id: 'ai_a', gold: 1000 }, { id: 'ai_b' }, { id: 'ai_c', gold: 800 }]);
  h.declareWarAt('ai_a', 'ai_b', 200);
  h.declareWarAt('ai_c', 'ai_b', 250); // C joins against B 50 turns later

  // Turn 300: A→B has lasted 100 turns; C→B only 50.
  h.setTurn(300);
  h.system.handleRoundStart();
  assert.equal(h.diplomacy.getState('ai_a', 'ai_b'), 'PEACE', 'A/B resolves at its own +100');
  assert.equal(h.diplomacy.getState('ai_c', 'ai_b'), 'WAR', 'C/B keeps its own younger timer');
  assert.equal(h.settledProposals.length, 1);

  // Turn 350: C→B now reaches its own 100 turns.
  h.setTurn(350);
  h.system.handleRoundStart();
  assert.equal(h.diplomacy.getState('ai_c', 'ai_b'), 'PEACE', 'C/B resolves at 250+100');
  assert.equal(h.settledProposals.length, 2);
});
