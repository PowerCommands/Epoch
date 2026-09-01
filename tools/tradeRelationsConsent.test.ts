import assert from 'node:assert/strict';
import test from 'node:test';

import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { DiplomaticProposalSystem } from '../src/systems/diplomacy/DiplomaticProposalSystem.ts';
import type { DiplomaticProposal } from '../src/systems/diplomacy/DiplomaticProposal.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';

const HUMAN = 'england';
const AI = 'china';

function turnManagerStub(getTurn: () => number): TurnManager {
  return { getCurrentRound: getTurn } as unknown as TurnManager;
}

/**
 * Sets up two nations with mutual embassies (the precondition for Trade
 * Relations) plus a proposal system wired exactly like GameScene: an accepted
 * `trade_relations` proposal establishes the relation, nothing else does.
 */
function makeHarness(turn = 1) {
  const diplomacy = new DiplomacyManager(turnManagerStub(() => turn));
  diplomacy.establishEmbassy(HUMAN, AI);
  diplomacy.establishEmbassy(AI, HUMAN);
  const proposals = new DiplomaticProposalSystem();
  // Mirror of the GameScene onAccepted routing for the new kind.
  proposals.onAccepted((proposal: DiplomaticProposal) => {
    if (proposal.payload.kind === 'trade_relations') {
      diplomacy.establishTradeRelations(proposal.fromNationId, proposal.toNationId);
    }
  });
  return { diplomacy, proposals };
}

function createOffer(proposals: DiplomaticProposalSystem, createdTurn = 1): DiplomaticProposal {
  return proposals.createProposal({
    fromNationId: AI,
    toNationId: HUMAN,
    kind: 'trade_relations',
    payload: { kind: 'trade_relations' },
    createdTurn,
    expiresTurn: createdTurn + 5,
  });
}

test('a pending Trade Relations offer does not establish relations until the human accepts', () => {
  const { diplomacy, proposals } = makeHarness();
  const offer = createOffer(proposals);
  // The offer is addressed to the human and is still awaiting an answer.
  assert.equal(offer.toNationId, HUMAN);
  assert.equal(diplomacy.hasTradeRelations(HUMAN, AI), false);
});

test('accepting the offer establishes mutual Trade Relations', () => {
  const { diplomacy, proposals } = makeHarness();
  const offer = createOffer(proposals);
  proposals.acceptProposal(offer.id);
  assert.equal(diplomacy.hasTradeRelations(HUMAN, AI), true);
  assert.equal(diplomacy.hasTradeRelations(AI, HUMAN), true);
});

test('rejecting the offer leaves Trade Relations closed', () => {
  const { diplomacy, proposals } = makeHarness();
  const offer = createOffer(proposals);
  proposals.rejectProposal(offer.id);
  assert.equal(diplomacy.hasTradeRelations(HUMAN, AI), false);
});

test('an unanswered offer that expires never establishes Trade Relations', () => {
  const { diplomacy, proposals } = makeHarness();
  createOffer(proposals, 1);
  proposals.update(10); // past expiresTurn
  assert.equal(diplomacy.hasTradeRelations(HUMAN, AI), false);
});

/**
 * Embassies follow the same consent pattern. Unlike Trade Relations they need no
 * pre-existing embassy, and establishment is directional (the proposer opens its
 * embassy in the human's territory).
 */
function makeEmbassyHarness(turn = 1) {
  const diplomacy = new DiplomacyManager(turnManagerStub(() => turn));
  const proposals = new DiplomaticProposalSystem();
  proposals.onAccepted((proposal: DiplomaticProposal) => {
    if (proposal.payload.kind === 'embassy') {
      diplomacy.establishEmbassy(proposal.fromNationId, proposal.toNationId);
    }
  });
  return { diplomacy, proposals };
}

function createEmbassyOffer(proposals: DiplomaticProposalSystem, createdTurn = 1): DiplomaticProposal {
  return proposals.createProposal({
    fromNationId: AI,
    toNationId: HUMAN,
    kind: 'embassy',
    payload: { kind: 'embassy' },
    createdTurn,
    expiresTurn: createdTurn + 5,
  });
}

test('a pending Embassy offer does not establish an embassy until the human accepts', () => {
  const { diplomacy, proposals } = makeEmbassyHarness();
  const offer = createEmbassyOffer(proposals);
  assert.equal(offer.toNationId, HUMAN);
  assert.equal(diplomacy.hasEmbassy(AI, HUMAN), false);
});

test('accepting the Embassy offer establishes the proposer\'s embassy in the human territory', () => {
  const { diplomacy, proposals } = makeEmbassyHarness();
  const offer = createEmbassyOffer(proposals);
  proposals.acceptProposal(offer.id);
  assert.equal(diplomacy.hasEmbassy(AI, HUMAN), true);
});

test('rejecting or letting the Embassy offer expire establishes no embassy', () => {
  const rejected = makeEmbassyHarness();
  const offerA = createEmbassyOffer(rejected.proposals);
  rejected.proposals.rejectProposal(offerA.id);
  assert.equal(rejected.diplomacy.hasEmbassy(AI, HUMAN), false);

  const expired = makeEmbassyHarness();
  createEmbassyOffer(expired.proposals, 1);
  expired.proposals.update(10);
  assert.equal(expired.diplomacy.hasEmbassy(AI, HUMAN), false);
});
