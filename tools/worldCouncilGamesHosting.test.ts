import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GAMES_OF_NATIONS_HOSTING_JUSTIFICATIONS,
  WorldCouncilResolutionSystem,
} from '../src/systems/WorldCouncilResolutionSystem';
import type { WorldCouncilMember, WorldCouncilMeeting } from '../src/types/worldCouncil';
import {
  GAMES_AND_RECREATION_CULTURE_ID,
  GamesOfNationsSystem,
  type GamesOfNationsDependencies,
  type GamesOfNationsHostingConfirmedEvent,
} from '../src/systems/GamesOfNationsSystem';

function member(nationId: string): WorldCouncilMember {
  return {
    nationId, goldContributed: 0, scienceContributionPercent: 1, cultureContributionPercent: 1,
    diplomacyScore: 0, diplomacyScoreSinceLastRegularMeeting: 0,
    diplomacyScoreFromProposals: 0, diplomacyScoreFromSupport: 0, diplomacyScoreFromGold: 0,
    diplomacyScoreFromScience: 0, diplomacyScoreFromCulture: 0, diplomacyScoreFromOther: 0,
  };
}

const meeting: WorldCouncilMeeting = { id: 1, kind: 'regular', turn: 80, cityId: 'council' };

test('hosting resolution has exactly ten fixed flavor reasons and captures deterministic proposal metadata', () => {
  assert.equal(GAMES_OF_NATIONS_HOSTING_JUSTIFICATIONS.length, 10);
  const system = new WorldCouncilResolutionSystem();
  system.setRuntime({
    isNationActive: () => true,
    getGamesOfNationsHostingContext: () => ({ gamesNumber: 6, hostNationId: 'france', hostCityId: 'paris' }),
    canNationTakeOverGamesHosting: () => true,
  });
  assert.equal(system.isProposalEligible('games_of_nations_hosting', 'france'), false);
  assert.equal(system.isProposalEligible('games_of_nations_hosting', 'england'), true);
  const proposal = system.prepareProposal({
    slot: 'host', resolutionId: 'games_of_nations_hosting', proposerNationId: 'england',
  }, 1234);
  const reopened = system.prepareProposal(JSON.parse(JSON.stringify(proposal)), 9999);
  assert.equal(proposal.targetNationId, 'france');
  assert.equal(proposal.gamesNumber, 6);
  assert.ok(GAMES_OF_NATIONS_HOSTING_JUSTIFICATIONS.includes(proposal.gamesHostingJustification as never));
  assert.equal(reopened.gamesHostingJustification, proposal.gamesHostingJustification, 'stored reason is never rerolled');
});

test('normal Influence voting makes proposer strongly support and current host strongly oppose', () => {
  const spent = new Map<string, number>();
  let replacedBy: string | undefined;
  const system = new WorldCouncilResolutionSystem();
  system.setRuntime({
    isNationActive: () => true,
    getGamesOfNationsHostingContext: () => ({ gamesNumber: 2, hostNationId: 'france' }),
    canNationTakeOverGamesHosting: () => true,
    getAvailableInfluence: () => 100,
    spendInfluence: (nationId, amount) => { spent.set(nationId, amount); return amount; },
    getRelationMemory: (voter, other) => ({
      trust: voter === 'sweden' && other === 'england' ? 100 : 25,
      hostility: voter === 'sweden' && other === 'france' ? 80 : 0,
    }),
    replaceGamesOfNationsHost: (nationId) => { replacedBy = nationId; return true; },
  });
  const proposal = system.prepareProposal({
    slot: 'host', resolutionId: 'games_of_nations_hosting', proposerNationId: 'england',
  }, 7);
  const result = system.resolve(proposal, {
    meeting, turn: 80, members: [member('england'), member('france'), member('sweden')], previousEmergencyMeetings: [],
  });
  assert.equal(result.proposal.votes?.find((vote) => vote.nationId === 'england')?.supportScore, 100);
  assert.equal(result.proposal.votes?.find((vote) => vote.nationId === 'france')?.supportScore, -100);
  assert.equal(result.proposal.passed, true);
  assert.equal(spent.size, 3, 'uses the ordinary Influence spending path');
  system.execute(result.proposal, { meetingId: 1, turn: 80, memberNationIds: ['england', 'france', 'sweden'] });
  assert.equal(replacedBy, 'england');
});

function gamesHarness(humanId?: string) {
  let turn = 80;
  const events: GamesOfNationsHostingConfirmedEvent[] = [];
  const cities = {
    france: [{ id: 'paris', name: 'Paris', productionPerTurn: 10, canConstructGrandStadium: true, hasGrandStadium: false }],
    england: [{ id: 'london', name: 'London', productionPerTurn: 14, canConstructGrandStadium: true, hasGrandStadium: false }],
    sweden: [{ id: 'stockholm', name: 'Stockholm', productionPerTurn: 8, canConstructGrandStadium: true, hasGrandStadium: true }],
  };
  const owners = new Map([['paris', 'france'], ['london', 'england'], ['stockholm', 'sweden']]);
  const dependencies: GamesOfNationsDependencies = {
    getCurrentTurn: () => turn,
    getLivingNationIds: () => ['france', 'england', 'sweden'],
    getNationName: (id) => id,
    getCapitalCity: (id) => cities[id as keyof typeof cities]?.[0],
    getHostCityCandidates: (id) => cities[id as keyof typeof cities] ?? [],
    getCityOwnerId: (id) => owners.get(id),
    hasGrandStadium: (id) => id === 'paris' || id === 'stockholm',
    isHumanNation: (id) => id === humanId,
    onHostingConfirmed: (event) => events.push(event),
  };
  const system = GamesOfNationsSystem.forNewGame(dependencies);
  system.handleCultureCompleted('france', GAMES_AND_RECREATION_CULTURE_ID, turn);
  return { system, events, dependencies, setTurn: (value: number) => { turn = value; } };
}

test('passed takeover resets the same upcoming cycle, loses GP, preserves program/history, and schedules 25 fresh turns', () => {
  const h = gamesHarness();
  const saved = h.system.getState();
  saved.participants[0]!.unallocatedGamesPoints = 90;
  saved.participants[0]!.gamesPointsBySport.Wrestling = 40;
  saved.participants[0]!.totalGamesPoints = 130;
  saved.introducedAdditionalSportIds = ['boxing'];
  saved.completedGames = [{
    gamesNumber: 0, tournamentStartTurn: 50, completionTurn: 54, worldYear: -1000, yearLabel: '1000 BC',
    hostNationName: 'Old', hostCityName: 'Old City', overallWinnerNationId: 'england',
    overallWinnerNationName: 'england', medalTable: [],
  }];
  h.setTurn(90);
  const restored = GamesOfNationsSystem.fromSave(h.dependencies, saved, 90);
  assert.equal(restored.replaceUpcomingHostFromWorldCouncil('sweden'), true);
  const state = restored.getState();
  assert.equal(state.hostingGamesNumber, 1);
  assert.equal(state.upcomingHostNationId, 'sweden');
  assert.equal(state.upcomingHostCityId, 'stockholm');
  assert.equal(state.scheduledGamesTurn, 115);
  assert.equal(state.participants.every((entry) => entry.totalGamesPoints === 0 && entry.unallocatedGamesPoints === 0), true);
  assert.deepEqual(state.introducedAdditionalSportIds, ['boxing']);
  assert.equal(state.completedGames?.[0]?.overallWinnerNationId, 'england');
  assert.equal(restored.getReigningChampionNationId(), 'england');
  assert.equal(h.events.filter((event) => event.worldCouncilReplacement).length, 1);
  assert.equal(restored.getGrandStadiumPriorityCityId('sweden'), null, 'existing stadium satisfies the requirement');
});

test('human proposer auto-accepts into city selection and save/load does not repeat the reset or event', () => {
  const h = gamesHarness('england');
  assert.equal(h.system.replaceUpcomingHostFromWorldCouncil('england'), true);
  assert.equal(h.system.isHumanHostingPromptPending(), false);
  assert.equal(h.system.isHumanHostCitySelectionPending(), true);
  assert.equal(h.system.getState().scheduledGamesTurn, 105);
  const pending = GamesOfNationsSystem.fromSave(h.dependencies, JSON.parse(JSON.stringify(h.system.getState())), 80);
  assert.equal(pending.isHumanHostCitySelectionPending(), true);
  assert.equal(pending.selectHostCity('england', 'london'), true);
  assert.equal(h.events.filter((event) => event.worldCouncilReplacement).length, 1);
  const confirmed = GamesOfNationsSystem.fromSave(h.dependencies, JSON.parse(JSON.stringify(pending.getState())), 80);
  assert.equal(confirmed.isHumanHostCitySelectionPending(), false);
  assert.equal(h.events.filter((event) => event.worldCouncilReplacement).length, 1);
});

test('host replacement is unavailable during active Competition and becomes available in Cooldown', () => {
  const h = gamesHarness();
  for (let turn = 81; turn <= 105; turn += 1) {
    h.setTurn(turn);
    h.system.handleRoundStart(turn);
  }
  assert.equal(h.system.getState().phase, 'competition');
  const resolvedBefore = h.system.getState().sportResults?.filter((result) => result.resolved).length;
  h.setTurn(106);
  assert.equal(h.system.getUpcomingHostingContext(), null);
  assert.equal(h.system.replaceUpcomingHostFromWorldCouncil('sweden'), false);
  assert.equal(h.system.getState().scheduledGamesTurn, 105);
  assert.equal(h.system.getState().sportResults?.filter((result) => result.resolved).length, resolvedBefore);
  for (let turn = 106; turn <= 121; turn += 1) {
    h.setTurn(turn);
    h.system.handleRoundStart(turn);
  }
  assert.equal(h.system.getState().phase, 'preparation');
  assert.equal(h.system.getState().competitionNumber, 2);
  assert.equal(h.system.getState().nextTransitionTurn, 130);
});

test('hosting proposal created in Preparation has no effect when its vote resolves during Competition', () => {
  const h = gamesHarness();
  for (let turn = 81; turn <= 95; turn += 1) {
    h.setTurn(turn);
    h.system.handleRoundStart(turn);
  }
  assert.equal(h.system.getState().phase, 'preparation');
  const resolution = new WorldCouncilResolutionSystem();
  resolution.setRuntime({
    isNationActive: () => true,
    getGamesOfNationsHostingContext: () => h.system.getUpcomingHostingContext(),
    canNationTakeOverGamesHosting: (nationId) => h.system.canNationTakeOverHosting(nationId),
    getAvailableInfluence: () => 100,
    spendInfluence: (_nationId, amount) => amount,
    replaceGamesOfNationsHost: (nationId) => h.system.replaceUpcomingHostFromWorldCouncil(nationId),
  });
  const proposal = resolution.prepareProposal({
    slot: 'host', resolutionId: 'games_of_nations_hosting', proposerNationId: 'england',
  }, 55);
  assert.equal(proposal.targetNationId, 'france');

  for (let turn = 96; turn <= 105; turn += 1) {
    h.setTurn(turn);
    h.system.handleRoundStart(turn);
  }
  assert.equal(h.system.getState().phase, 'competition');
  const beforeResolution = h.system.getState();
  const result = resolution.resolve(proposal, {
    meeting: { ...meeting, turn: 105 },
    turn: 105,
    members: [member('england'), member('france'), member('sweden')],
    previousEmergencyMeetings: [],
  });
  assert.equal(result.proposal.passed, false);
  assert.deepEqual(result.proposal.votes, []);
  resolution.execute(result.proposal, { meetingId: 1, turn: 105, memberNationIds: ['england', 'france', 'sweden'] });
  assert.deepEqual(h.system.getState(), beforeResolution, 'resolve-time guard prevents host replacement');

  resolution.execute({ ...proposal, passed: true, resolved: true }, {
    meetingId: 1, turn: 105, memberNationIds: ['england', 'france', 'sweden'],
  });
  assert.deepEqual(h.system.getState(), beforeResolution, 'GoN execution guard also rejects a stale passed proposal');
});

test('rejected takeover executes no GoN mutation', () => {
  const h = gamesHarness();
  const before = h.system.getState();
  const resolution = new WorldCouncilResolutionSystem();
  resolution.setRuntime({ replaceGamesOfNationsHost: (nationId) => h.system.replaceUpcomingHostFromWorldCouncil(nationId) });
  resolution.execute({
    slot: 'host', resolutionId: 'games_of_nations_hosting', proposerNationId: 'england',
    targetNationId: 'france', gamesNumber: 1, gamesHostingJustification: GAMES_OF_NATIONS_HOSTING_JUSTIFICATIONS[0],
    resolved: true, passed: false,
  }, { meetingId: 1, turn: 80, memberNationIds: ['france', 'england'] });
  assert.deepEqual(h.system.getState(), before);
});
