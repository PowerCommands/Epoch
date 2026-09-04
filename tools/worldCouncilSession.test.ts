import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeInfluence, sessionOutcomeLabel } from '../src/ui/hud/WorldCouncilSessionDialog';
import { WorldCouncilSystem } from '../src/systems/WorldCouncilSystem';
import { WorldCouncilResolutionSystem } from '../src/systems/WorldCouncilResolutionSystem';

// --- pure presentation helpers -----------------------------------------

test('sanitizeInfluence clamps to [0, max] and rejects invalid input', () => {
  assert.equal(sanitizeInfluence(50, 100), 50);
  assert.equal(sanitizeInfluence(-5, 100), 0);
  assert.equal(sanitizeInfluence(250, 100), 100);
  assert.equal(sanitizeInfluence(37.9, 100), 37);
  assert.equal(sanitizeInfluence(Number.NaN, 100), 0);
  assert.equal(sanitizeInfluence(10, Number.NaN), 0);
  assert.equal(sanitizeInfluence(10, -20), 0);
});

test('sessionOutcomeLabel maps canonical outcomes to user-facing labels', () => {
  assert.equal(sessionOutcomeLabel('passed'), 'PASSED');
  assert.equal(sessionOutcomeLabel('rejected'), 'REJECTED');
  assert.equal(sessionOutcomeLabel('no_target'), 'NO ELIGIBLE TARGET');
  assert.equal(sessionOutcomeLabel('unresolved'), 'UNRESOLVED');
});

// --- system-level deferral integration ---------------------------------

interface FakeNation { id: string; isHuman: boolean; name: string; color: number; }

function makeCouncil(options: { humanVoting: boolean }): {
  system: WorldCouncilSystem;
  humanVote: { support: boolean; influence: number } | null;
  setHumanVote: (vote: { support: boolean; influence: number } | null) => void;
} {
  const human: FakeNation = { id: 'you', isHuman: true, name: 'You', color: 0x3366cc };
  const nations = new Map<string, FakeNation>([['you', human]]);
  let humanVote: { support: boolean; influence: number } | null = { support: true, influence: 5 };

  const nationManager = {
    getNation: (id: string) => nations.get(id),
    getAllNations: () => [...nations.values()],
    getResources: () => ({ gold: 1000, goldPerTurn: 10, influence: 100 }),
  };
  const cityManager = { getCity: (id: string) => ({ id, name: 'Geneva', ownerId: 'you' }) };
  const resourceSystem = { addGold: () => {} };

  const resolutionSystem = new WorldCouncilResolutionSystem();
  resolutionSystem.setRuntime({
    isNationActive: () => true,
    getNationName: (id: string) => nations.get(id)?.name ?? id,
    getAvailableInfluence: () => 100,
    spendInfluence: (_id: string, amount: number) => amount,
    isHumanNation: (id: string) => nations.get(id)?.isHuman === true,
    requestHumanInfluenceVote: () => humanVote,
    getRelationMemory: () => ({ trust: 0, hostility: 0 }),
  } as never);

  const system = new WorldCouncilSystem(
    nationManager as never,
    cityManager as never,
    resourceSystem as never,
    resolutionSystem,
  );
  if (options.humanVoting) system.setHumanVotingDeferralEnabled(() => true);

  system.found({
    foundingCityId: 'geneva',
    foundingNationId: 'you',
    foundingTurn: 1,
    founderOffer: { gold: 0, sciencePercent: 5, culturePercent: 5 },
  });
  // Advance through construction so the council becomes active, then reach the
  // first regular meeting turn (founding + 50).
  for (let round = 2; round <= 51; round += 1) {
    system.handleTurnStart({ round, nation: { id: 'you' } } as never);
  }

  return { system, humanVote, setHumanVote: (vote) => { humanVote = vote; } };
}

test('interactive human meeting defers resolution until votes are submitted', () => {
  const { system } = makeCouncil({ humanVoting: true });
  const pending = system.getPendingHumanVoteMeeting();
  assert.ok(pending, 'a meeting should be waiting for human votes');
  assert.ok((pending!.proposals?.length ?? 0) > 0, 'the pending meeting has agenda items');
  assert.ok(
    pending!.proposals!.every((proposal) => proposal.resolved !== true),
    'proposals stay unresolved until the human votes',
  );

  const resolved = system.resolvePendingHumanVoteMeeting();
  assert.ok(resolved, 'resolving the pending meeting returns the resolved meeting');
  assert.ok(
    resolved!.proposals!.some((proposal) => proposal.resolved === true),
    'proposals resolve once the human submits votes',
  );
  assert.equal(system.getPendingHumanVoteMeeting(), null, 'no session remains pending after resolution');
});

test('AI-only / autorun meetings resolve synchronously (no deferral)', () => {
  const { system } = makeCouncil({ humanVoting: false });
  assert.equal(system.getPendingHumanVoteMeeting(), null, 'no human-vote session is opened');
  const state = system.getState();
  const meeting = state?.meetings.find((m) => m.kind === 'regular');
  assert.ok(meeting, 'a regular meeting was held');
  assert.ok(
    meeting!.proposals!.some((proposal) => proposal.resolved === true),
    'proposals resolve immediately without a human session',
  );
});

test('restoring a save with an unresolved meeting re-opens the human session', () => {
  const { system } = makeCouncil({ humanVoting: true });
  const saved = system.getState();
  assert.ok(saved, 'state exists to save');

  // A fresh system restores the saved (unresolved) meeting and reconstructs the
  // pending human session from canonical state.
  const human: FakeNation = { id: 'you', isHuman: true, name: 'You', color: 0x3366cc };
  const nationManager = {
    getNation: (id: string) => (id === 'you' ? human : undefined),
    getAllNations: () => [human],
    getResources: () => ({ gold: 1000, goldPerTurn: 10, influence: 100 }),
  };
  const restored = new WorldCouncilSystem(
    nationManager as never,
    { getCity: (id: string) => ({ id, name: 'Geneva', ownerId: 'you' }) } as never,
    { addGold: () => {} } as never,
    new WorldCouncilResolutionSystem(),
  );
  restored.setHumanVotingDeferralEnabled(() => true);
  restored.restore(saved!);
  assert.ok(restored.getPendingHumanVoteMeeting(), 'the pending vote session is reconstructed on load');
});
