import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WorldCouncilResolutionSystem,
  selectAggressiveWarCondemnationTarget,
} from '../src/systems/WorldCouncilResolutionSystem';
import type { WorldCouncilMember, WorldCouncilMeeting } from '../src/types/worldCouncil';

function member(nationId: string): WorldCouncilMember {
  return {
    nationId, goldContributed: 0, scienceContributionPercent: 1, cultureContributionPercent: 1,
    diplomacyScore: 0, diplomacyScoreSinceLastRegularMeeting: 0,
    diplomacyScoreFromProposals: 0, diplomacyScoreFromSupport: 0, diplomacyScoreFromGold: 0,
    diplomacyScoreFromScience: 0, diplomacyScoreFromCulture: 0, diplomacyScoreFromOther: 0,
  };
}

function emergencyMeeting(id: number, aggressorNationId: string, targetNationId: string): WorldCouncilMeeting {
  return {
    id, kind: 'emergency', turn: id * 10, cityId: 'council',
    emergencyTrigger: { eventType: 'warDeclared', aggressorNationId, targetNationId },
  };
}

test('selectAggressiveWarCondemnationTarget picks the most recent member aggressor that is not the proposer', () => {
  const meetings = [
    emergencyMeeting(1, 'sweden', 'france'),
    emergencyMeeting(2, 'germany', 'england'),
  ];
  const members = ['france', 'england', 'sweden', 'germany'];
  assert.equal(selectAggressiveWarCondemnationTarget(meetings, members, 'france'), 'germany');
  // The proposer is skipped even if it is the most recent aggressor.
  assert.equal(selectAggressiveWarCondemnationTarget(meetings, members, 'germany'), 'sweden');
  // Aggressors no longer on the Council are ignored.
  assert.equal(selectAggressiveWarCondemnationTarget(meetings, ['france', 'england', 'sweden'], 'france'), 'sweden');
  // No emergency history means nothing to condemn.
  assert.equal(selectAggressiveWarCondemnationTarget([], members, 'france'), undefined);
});

test('condemnation is only eligible when a legitimate target exists', () => {
  const resolution = new WorldCouncilResolutionSystem();
  resolution.setRuntime({ getAggressiveWarCondemnationTarget: () => undefined });
  assert.equal(resolution.isProposalEligible('condemn_aggressive_war', 'france'), false);
  resolution.setRuntime({ getAggressiveWarCondemnationTarget: () => 'germany' });
  assert.equal(resolution.isProposalEligible('condemn_aggressive_war', 'france'), true);
});

test('prepareProposal bakes the authoritative target and it survives a save/load round-trip', () => {
  const resolution = new WorldCouncilResolutionSystem();
  resolution.setRuntime({ getAggressiveWarCondemnationTarget: (proposer) => (proposer === 'france' ? 'germany' : undefined) });
  const proposal = resolution.prepareProposal({
    slot: 'host', resolutionId: 'condemn_aggressive_war', proposerNationId: 'france',
  }, 7);
  assert.equal(proposal.targetNationId, 'germany');

  // A stored target is preserved verbatim across save/load, not re-derived.
  resolution.setRuntime({ getAggressiveWarCondemnationTarget: () => 'sweden' });
  const restored = resolution.prepareProposal(JSON.parse(JSON.stringify(proposal)), 999);
  assert.equal(restored.targetNationId, 'germany');
});

test('the human, the AI voters, and the applied effect all condemn the same baked target', () => {
  let condemned: { targetNationId: string; memberNationIds: readonly string[] } | undefined;
  const resolution = new WorldCouncilResolutionSystem();
  resolution.setRuntime({
    getAggressiveWarCondemnationTarget: () => 'germany',
    getAvailableInfluence: () => 100,
    spendInfluence: (_nationId, amount) => amount,
    getRelationMemory: (_voter, target) => ({ trust: target === 'germany' ? 0 : 80, hostility: target === 'germany' ? 90 : 0 }),
    // Germany is the condemned aggressor and is at war with the other members.
    getDiplomacyState: (a, b) => ((a === 'germany' || b === 'germany') ? 'WAR' : 'PEACE'),
    condemnAggressiveWar: (targetNationId, memberNationIds) => { condemned = { targetNationId, memberNationIds }; },
  });
  const prepared = resolution.prepareProposal({
    slot: 'host', resolutionId: 'condemn_aggressive_war', proposerNationId: 'france',
  }, 3);
  assert.equal(prepared.targetNationId, 'germany');

  const members = [member('france'), member('england'), member('germany')];
  const result = resolution.resolve(prepared, {
    meeting: { id: 5, kind: 'regular', turn: 120, cityId: 'council' },
    turn: 120,
    members,
    // No emergency history here: the baked target must still be honored.
    previousEmergencyMeetings: [],
  });
  assert.equal(result.proposal.targetNationId, 'germany');
  assert.equal(result.enacted?.targetNationId, 'germany');

  resolution.execute(result.proposal, {
    meetingId: 5, turn: 120, memberNationIds: ['france', 'england', 'germany'],
    targetNationId: result.proposal.targetNationId,
  });
  assert.equal(condemned?.targetNationId, 'germany');
});
