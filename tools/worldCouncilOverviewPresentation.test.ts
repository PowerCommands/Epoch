import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectHistoricalProposals,
  formatSigned,
  outcomeLabel,
  partitionResolutions,
  sortMembersByScore,
  statusHeadline,
  targetLine,
  type WorldCouncilOverviewEnactedResolution,
  type WorldCouncilOverviewMeeting,
  type WorldCouncilOverviewMember,
  type WorldCouncilOverviewState,
} from '../src/ui/hud/WorldCouncilOverviewDialog';

function member(overrides: Partial<WorldCouncilOverviewMember> = {}): WorldCouncilOverviewMember {
  return {
    nationName: 'Nation',
    nationColor: '#888888',
    isHuman: false,
    diplomacyScore: 0,
    diplomacyScoreSinceLastRegularMeeting: 0,
    goldContributed: 0,
    scienceContributionPercent: 0,
    cultureContributionPercent: 0,
    ...overrides,
  };
}

function resolution(overrides: Partial<WorldCouncilOverviewEnactedResolution> = {}): WorldCouncilOverviewEnactedResolution {
  return {
    title: 'Shared Cartography',
    status: 'active',
    meetingKind: 'Regular',
    turn: 100,
    ...overrides,
  };
}

function meeting(overrides: Partial<WorldCouncilOverviewMeeting> = {}): WorldCouncilOverviewMeeting {
  return {
    kind: 'Regular',
    turn: 100,
    cityName: 'Beijing',
    proposals: [],
    ...overrides,
  };
}

function baseState(overrides: Partial<WorldCouncilOverviewState> = {}): WorldCouncilOverviewState {
  return {
    organizationName: 'World Council',
    status: 'active',
    foundingCityName: 'Beijing',
    foundingNationName: 'China',
    constructionTurnsRemaining: 0,
    diplomacyScoreThreshold: 5000,
    nextRegularMeetingTurn: 375,
    currentTurn: 357,
    canHumanLeave: false,
    members: [],
    enactedResolutions: [],
    meetings: [],
    ...overrides,
  };
}

test('partitionResolutions separates active law from expired/repealed history', () => {
  const { active, past } = partitionResolutions([
    resolution({ title: 'A', status: 'active' }),
    resolution({ title: 'B', status: 'expired' }),
    resolution({ title: 'C', status: 'repealed' }),
    resolution({ title: 'D', status: 'active' }),
  ]);
  assert.deepEqual(active.map((r) => r.title), ['A', 'D']);
  assert.deepEqual(past.map((r) => r.title), ['B', 'C']);
});

test('sortMembersByScore ranks by total diplomatic score descending', () => {
  const ordered = sortMembersByScore([
    member({ nationName: 'Low', diplomacyScore: 100 }),
    member({ nationName: 'High', diplomacyScore: 900 }),
    member({ nationName: 'Mid', diplomacyScore: 400 }),
  ]);
  assert.deepEqual(ordered.map((m) => m.nationName), ['High', 'Mid', 'Low']);
});

test('sortMembersByScore does not mutate the source array', () => {
  const source = [member({ diplomacyScore: 1 }), member({ diplomacyScore: 2 })];
  sortMembersByScore(source);
  assert.deepEqual(source.map((m) => m.diplomacyScore), [1, 2]);
});

test('collectHistoricalProposals surfaces rejected and unresolved proposals, newest first', () => {
  const meetings: WorldCouncilOverviewMeeting[] = [
    meeting({
      turn: 100,
      proposals: [
        { slot: 'host', title: 'Passed One', description: '', icon: '📃', votingType: 'influence', outcome: 'passed' },
        { slot: 'random', title: 'Rejected One', description: '', icon: '📃', votingType: 'influence', outcome: 'rejected' },
      ],
    }),
    meeting({
      turn: 150,
      proposals: [
        { slot: 'host', title: 'Unresolved One', description: '', icon: '📃', votingType: 'special', outcome: 'unresolved' },
      ],
    }),
  ];
  const history = collectHistoricalProposals(meetings);
  assert.deepEqual(history.map((entry) => entry.proposal.title), ['Unresolved One', 'Rejected One']);
  assert.equal(history[0].turn, 150);
});

test('passed proposals never appear in the rejected/unresolved history list', () => {
  const history = collectHistoricalProposals([
    meeting({ proposals: [{ slot: 'host', title: 'Won', description: '', icon: '📃', votingType: 'influence', outcome: 'passed' }] }),
  ]);
  assert.equal(history.length, 0);
});

test('statusHeadline reflects construction vs active headquarters', () => {
  assert.match(
    statusHeadline(baseState({ status: 'construction', constructionTurnsRemaining: 12 })),
    /Under construction — 12 turns remaining/,
  );
  assert.equal(
    statusHeadline(baseState({ status: 'active', foundingCityName: 'Beijing', foundingNationName: 'China' })),
    'Headquartered in Beijing, China',
  );
});

test('targetLine formats single, dual, and peacekeeping targets distinctly', () => {
  assert.equal(targetLine('international_embargo', 'Mongolia'), 'Target: Mongolia');
  assert.equal(targetLine('condemn_aggressive_war', 'A', 'B'), 'Target: A — B');
  assert.equal(targetLine('un_peacekeeping_mission', 'HostLand', 'ThreatLand'), 'Host: HostLand · Threat: ThreatLand');
});

test('outcomeLabel maps outcomes to human-readable status labels', () => {
  assert.equal(outcomeLabel('passed'), 'PASSED');
  assert.equal(outcomeLabel('rejected'), 'REJECTED');
  assert.equal(outcomeLabel('unresolved'), 'UNRESOLVED');
  assert.equal(outcomeLabel(undefined), 'PENDING');
});

test('formatSigned shows an explicit + for positive period scores', () => {
  assert.equal(formatSigned(42.9), '+42');
  assert.equal(formatSigned(0), '0');
  assert.equal(formatSigned(-7.2), '-8');
});
