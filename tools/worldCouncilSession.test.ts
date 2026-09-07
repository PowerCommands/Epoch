import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeInfluence, sessionOutcomeLabel } from '../src/ui/hud/WorldCouncilSessionDialog';
import { parseGoldDonation } from '../src/ui/hud/DefenseSupportDonationDialog';
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

test('Defense Support donation input accepts only whole Gold within the allowed range', () => {
  assert.equal(parseGoldDonation('250', 1000), 250);
  assert.equal(parseGoldDonation(' 0250 ', 1000), 250);
  assert.equal(parseGoldDonation('0', 1000), 0);
  assert.equal(parseGoldDonation('-1', 1000), null);
  assert.equal(parseGoldDonation('1.5', 1000), null);
  assert.equal(parseGoldDonation('10gold', 1000), null);
  assert.equal(parseGoldDonation('1001', 1000), null);
  assert.equal(parseGoldDonation('', 1000), null);
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

test('interactive Defense Support defers, then replays the human donation into canonical resolution', () => {
  const nationData = [
    { id: 'human', isHuman: true, name: 'Sweden', color: 0x3366cc },
    { id: 'recipient', isHuman: false, name: 'China', color: 0xcc3333 },
    { id: 'aggressor', isHuman: false, name: 'France', color: 0xeeeeee },
  ];
  const nations = new Map(nationData.map((nation) => [nation.id, nation]));
  const resources = new Map(nationData.map((nation) => [nation.id, { gold: 1000, goldPerTurn: 10, influence: 0 }]));
  let selectedDonation: number | null = null;
  let humanDonationRequests = 0;

  const resolutionSystem = new WorldCouncilResolutionSystem();
  resolutionSystem.setRuntime({
    getDiplomacyState: (a: string, b: string) =>
      new Set([a, b]).size === 2 && [a, b].includes('recipient') && [a, b].includes('aggressor') ? 'WAR' : 'PEACE',
    getRelationMemory: () => ({ trust: 50, hostility: 0 }),
    getTreasury: (id: string) => resources.get(id)?.gold ?? 0,
    getGoldPerTurn: (id: string) => resources.get(id)?.goldPerTurn ?? 0,
    isAtWarWithAnyone: () => false,
    isHumanNation: (id: string) => id === 'human',
    requestHumanGoldDonation: () => {
      humanDonationRequests += 1;
      return selectedDonation;
    },
    transferGold: (from: string, to: string, amount: number) => {
      const fromResources = resources.get(from)!;
      const toResources = resources.get(to)!;
      if (fromResources.gold < amount) return false;
      fromResources.gold -= amount;
      toResources.gold += amount;
      return true;
    },
    getNationName: (id: string) => nations.get(id)?.name ?? id,
    isNationActive: () => true,
  } as never);

  const system = new WorldCouncilSystem(
    {
      getNation: (id: string) => nations.get(id),
      getAllNations: () => nationData,
      getResources: (id: string) => resources.get(id)!,
    } as never,
    { getCity: () => ({ id: 'geneva', name: 'Geneva', ownerId: 'human' }) } as never,
    { addGold: () => {} } as never,
    resolutionSystem,
  );
  system.setHumanVotingDeferralEnabled(() => true);
  system.restore({
    organizationKind: 'un',
    foundingCityId: 'geneva',
    foundingNationId: 'human',
    foundingTurn: 1,
    constructionStartedTurn: 1,
    constructionTurnsRemaining: 0,
    status: 'active',
    memberNationIds: nationData.map((nation) => nation.id),
    members: nationData.map((nation) => ({
      nationId: nation.id,
      goldContributed: 0,
      scienceContributionPercent: 0,
      cultureContributionPercent: 0,
      diplomacyScore: 0,
      diplomacyScoreSinceLastRegularMeeting: 0,
      diplomacyScoreFromProposals: 0,
      diplomacyScoreFromSupport: 0,
      diplomacyScoreFromGold: 0,
      diplomacyScoreFromScience: 0,
      diplomacyScoreFromCulture: 0,
      diplomacyScoreFromOther: 0,
    })),
    lastRegularMeetingTurn: 1,
    nextRegularMeetingTurn: 51,
    meetings: [],
    nextMeetingId: 1,
    enactedResolutions: [],
  });

  const created = system.triggerEmergencyMeeting(10, {
    eventType: 'warDeclared',
    aggressorNationId: 'aggressor',
    targetNationId: 'recipient',
  });
  assert.ok(created);
  assert.ok(system.getPendingHumanVoteMeeting(), 'Defense Support waits for the human dialog');
  assert.equal(created!.proposals?.[0]?.resolved, undefined, 'no transfer occurs before human input');

  selectedDonation = 123;
  const resolved = system.resolvePendingHumanVoteMeeting();
  const humanDonation = resolved?.proposals?.[0]?.donations?.find((entry) => entry.nationId === 'human');
  assert.equal(humanDonation?.gold, 123);
  assert.equal(resources.get('human')?.gold, 877);
  assert.equal(system.getPendingHumanVoteMeeting(), null);
  assert.equal(humanDonationRequests, 1);

  system.setHumanVotingDeferralEnabled(() => false);
  selectedDonation = null;
  const synchronous = system.triggerEmergencyMeeting(11, {
    eventType: 'warDeclared',
    aggressorNationId: 'aggressor',
    targetNationId: 'recipient',
  });
  assert.equal(system.getPendingHumanVoteMeeting(), null, 'AI-only/autoplay mode does not defer Defense Support');
  assert.equal(synchronous?.proposals?.[0]?.resolved, true, 'Defense Support still resolves synchronously without UI');
  assert.equal(humanDonationRequests, 2, 'the unchanged resolution path still evaluates the human nation once');
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

// --- lazily-resolved target preview for the voting UI --------------------

test('previewProposalTargets names the two warring nations for a ceasefire proposal', () => {
  const resolutionSystem = new WorldCouncilResolutionSystem();
  const wars = new Set(['alpha|beta']);
  resolutionSystem.setRuntime({
    getDiplomacyState: (a: string, b: string) =>
      wars.has([a, b].sort().join('|')) ? 'WAR' : 'PEACE',
    getRelationMemory: () => ({ trust: 0, hostility: 0 }),
  } as never);

  const members = ['alpha', 'beta', 'gamma'].map((nationId) => ({ nationId })) as never;
  const context = {
    meeting: { id: 1, kind: 'regular', turn: 51, cityId: 'geneva' },
    turn: 51,
    members,
    previousEmergencyMeetings: [],
    nextRegularMeetingTurn: 101,
  } as never;

  const targets = resolutionSystem.previewProposalTargets(
    { slot: 'random', resolutionId: 'ceasefire_resolution' },
    context,
  );
  assert.deepEqual(
    [targets.targetNationId, targets.secondaryTargetNationId].sort(),
    ['alpha', 'beta'],
    'the ceasefire preview surfaces exactly the two nations that are at war',
  );
});

test('previewProposalTargets returns no target when no members are at war', () => {
  const resolutionSystem = new WorldCouncilResolutionSystem();
  resolutionSystem.setRuntime({
    getDiplomacyState: () => 'PEACE',
    getRelationMemory: () => ({ trust: 0, hostility: 0 }),
  } as never);

  const members = ['alpha', 'beta'].map((nationId) => ({ nationId })) as never;
  const context = {
    meeting: { id: 1, kind: 'regular', turn: 51, cityId: 'geneva' },
    turn: 51,
    members,
    previousEmergencyMeetings: [],
    nextRegularMeetingTurn: 101,
  } as never;

  const targets = resolutionSystem.previewProposalTargets(
    { slot: 'random', resolutionId: 'ceasefire_resolution' },
    context,
  );
  assert.equal(targets.targetNationId, undefined, 'no ceasefire target without an active war');
  assert.equal(targets.secondaryTargetNationId, undefined, 'no secondary target without an active war');
});
