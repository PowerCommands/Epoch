import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  GAMES_OF_NATIONS_PARTICIPATION_JUSTIFICATIONS,
  WorldCouncilResolutionSystem,
} from '../src/systems/WorldCouncilResolutionSystem';
import {
  GAMES_AND_RECREATION_CULTURE_ID,
  GamesOfNationsSystem,
  type GamesOfNationsDependencies,
  type GamesOfNationsExclusionEvent,
  type GamesOfNationsSportResolvedEvent,
} from '../src/systems/GamesOfNationsSystem';
import type { WorldCouncilMember, WorldCouncilMeeting } from '../src/types/worldCouncil';

function member(nationId: string): WorldCouncilMember {
  return {
    nationId, goldContributed: 0, scienceContributionPercent: 1, cultureContributionPercent: 1,
    diplomacyScore: 0, diplomacyScoreSinceLastRegularMeeting: 0,
    diplomacyScoreFromProposals: 0, diplomacyScoreFromSupport: 0, diplomacyScoreFromGold: 0,
    diplomacyScoreFromScience: 0, diplomacyScoreFromCulture: 0, diplomacyScoreFromOther: 0,
  };
}

const meeting: WorldCouncilMeeting = { id: 9, kind: 'regular', turn: 95, cityId: 'council' };

function harness(humanId?: string, extraNations: string[] = []) {
  let turn = 80;
  const exclusionEvents: GamesOfNationsExclusionEvent[] = [];
  const sportEvents: GamesOfNationsSportResolvedEvent[] = [];
  const cities: Record<string, Array<{ id: string; name: string; productionPerTurn: number; canConstructGrandStadium: boolean; hasGrandStadium: boolean }>> = {
    france: [{ id: 'paris', name: 'Paris', productionPerTurn: 10, canConstructGrandStadium: true, hasGrandStadium: true }],
    england: [{ id: 'london', name: 'London', productionPerTurn: 14, canConstructGrandStadium: true, hasGrandStadium: true }],
    sweden: [{ id: 'stockholm', name: 'Stockholm', productionPerTurn: 8, canConstructGrandStadium: true, hasGrandStadium: true }],
  };
  for (const nation of extraNations) {
    cities[nation] = [{ id: `${nation}-city`, name: nation, productionPerTurn: 10, canConstructGrandStadium: true, hasGrandStadium: true }];
  }
  const ownerByCity = new Map<string, string>();
  for (const [nation, nationCities] of Object.entries(cities)) {
    for (const city of nationCities) ownerByCity.set(city.id, nation);
  }
  const living = ['france', 'england', 'sweden', ...extraNations];
  const dependencies: GamesOfNationsDependencies = {
    getCurrentTurn: () => turn,
    getLivingNationIds: () => living,
    getNationName: (id) => id,
    getCapitalCity: (id) => cities[id]?.[0],
    getHostCityCandidates: (id) => cities[id] ?? [],
    getCityOwnerId: (id) => ownerByCity.get(id),
    hasGrandStadium: () => true,
    isHumanNation: (id) => id === humanId,
    getCultureOutput: () => 20,
    getProductionSources: (id) => [{ cityId: cities[id as keyof typeof cities][0].id, available: 20 }],
    onNationExcluded: (event) => exclusionEvents.push(event),
    onSportResolved: (event) => sportEvents.push(event),
  };
  const system = GamesOfNationsSystem.forNewGame(dependencies);
  system.handleCultureCompleted('france', GAMES_AND_RECREATION_CULTURE_ID, turn);
  const advance = (target: number) => {
    for (let next = turn + 1; next <= target; next += 1) {
      turn = next;
      system.handleRoundStart(next);
    }
  };
  return { system, dependencies, exclusionEvents, sportEvents, advance, setTurn: (value: number) => { turn = value; } };
}

test('participation proposal has exactly ten fixed reasons, selects an eligible non-self target, and persists it', () => {
  assert.equal(GAMES_OF_NATIONS_PARTICIPATION_JUSTIFICATIONS.length, 10);
  const resolution = new WorldCouncilResolutionSystem();
  resolution.setRuntime({
    isNationActive: () => true,
    getGamesOfNationsParticipationContext: () => ({ gamesNumber: 6, eligibleNationIds: ['france', 'england', 'sweden'] }),
    getRelationMemory: (_a, b) => ({ trust: b === 'france' ? 0 : 90, hostility: b === 'france' ? 100 : 0 }),
  });
  const proposal = resolution.prepareProposal({
    slot: 'host', resolutionId: 'exclude_games_of_nations_participant', proposerNationId: 'sweden',
  }, 42);
  assert.equal(proposal.targetNationId, 'france');
  assert.equal(proposal.gamesNumber, 6);
  assert.ok(GAMES_OF_NATIONS_PARTICIPATION_JUSTIFICATIONS.includes(proposal.gamesParticipationJustification as never));
  const restored = resolution.prepareProposal(JSON.parse(JSON.stringify(proposal)), 999);
  assert.equal(restored.targetNationId, 'france');
  assert.equal(restored.gamesParticipationJustification, proposal.gamesParticipationJustification);
});

test('normal Influence voting strongly separates proposer and target and executes one exclusion', () => {
  let excluded: { nationId: string; reason: string } | undefined;
  const resolution = new WorldCouncilResolutionSystem();
  resolution.setRuntime({
    isNationActive: () => true,
    getGamesOfNationsParticipationContext: () => ({ gamesNumber: 2, eligibleNationIds: ['france', 'england', 'sweden'] }),
    getAvailableInfluence: () => 100,
    spendInfluence: (_nationId, amount) => amount,
    getRelationMemory: (voter, target) => ({
      trust: voter === 'sweden' && target === 'france' ? 0 : 75,
      hostility: voter === 'sweden' && target === 'france' ? 100 : 0,
    }),
    excludeGamesOfNationsParticipant: (nationId, reason) => { excluded = { nationId, reason }; return true; },
  });
  const prepared = resolution.prepareProposal({
    slot: 'host', resolutionId: 'exclude_games_of_nations_participant', proposerNationId: 'england',
    targetNationId: 'france',
  }, 12);
  const proposal = { ...prepared, targetNationId: 'france' };
  const result = resolution.resolve(proposal, {
    meeting, turn: 95, members: [member('england'), member('france'), member('sweden')], previousEmergencyMeetings: [],
  });
  assert.equal(result.proposal.votes?.find((vote) => vote.nationId === 'england')?.supportScore, 100);
  assert.equal(result.proposal.votes?.find((vote) => vote.nationId === 'france')?.supportScore, -100);
  assert.equal(result.proposal.passed, true);
  resolution.execute(result.proposal, { meetingId: 9, turn: 95, memberNationIds: ['england', 'france', 'sweden'] });
  assert.equal(excluded?.nationId, 'france');
  assert.equal(excluded?.reason, result.proposal.gamesParticipationJustification);
});

test('exclusion stops future commitments without refunds and stored GP has zero competitive effect', () => {
  const h = harness('england');
  h.advance(95);
  h.system.setNationCultureCommitment('england', 8);
  h.system.setNationProductionCommitment('england', 12);
  h.system.processNationPreparationTurn('england', 95);
  const before = h.system.getState().participants.find((entry) => entry.nationId === 'england')!;
  assert.equal(before.totalGamesPoints, 200);
  assert.equal(h.system.excludeNationFromUpcomingGames('england', GAMES_OF_NATIONS_PARTICIPATION_JUSTIFICATIONS[3]), true);
  const excluded = h.system.getState().participants.find((entry) => entry.nationId === 'england')!;
  assert.equal(excluded.cultureCommitment, 0);
  assert.equal(excluded.productionCommitment, 0);
  assert.equal(excluded.totalCultureInvested, 8);
  assert.equal(excluded.totalProductionInvested, 12);
  assert.equal(excluded.totalGamesPoints, 200);
  assert.equal(h.system.getEffectiveGamesPoints('england', 'Wrestling'), 0);
  h.system.processNationPreparationTurn('england', 96);
  assert.equal(h.system.getState().participants.find((entry) => entry.nationId === 'england')?.totalGamesPoints, 200);
  assert.equal(h.exclusionEvents.length, 1);
  const reloaded = GamesOfNationsSystem.fromSave(
    h.dependencies,
    JSON.parse(JSON.stringify(h.system.getState())),
    95,
  );
  assert.equal(reloaded.getState().excludedNationIds?.includes('england'), true);
  assert.equal(reloaded.getState().participants.find((entry) => entry.nationId === 'england')?.participating, false);
  assert.equal(h.exclusionEvents.length, 1, 'loading does not emit duplicate exclusion history');
});

test('excluded nation cannot medal or become Chronicle favorite despite dominant stored GP', () => {
  const h = harness(undefined, ['italy']); // a fourth nation keeps three eligible after the exclusion
  const state = h.system.getState();
  state.phase = 'preparation';
  state.phaseStartTurn = 95;
  state.nextTransitionTurn = 105;
  state.scheduledGamesTurn = 105;
  state.lastProcessedTurn = 104;
  const england = state.participants.find((entry) => entry.nationId === 'england')!;
  england.gamesPointsBySport.Wrestling = 10000;
  england.gamesPointsBySport.Marathon = 10000;
  england.totalGamesPoints = 20000;
  const france = state.participants.find((entry) => entry.nationId === 'france')!;
  france.gamesPointsBySport.Wrestling = 100;
  france.gamesPointsBySport.Marathon = 100;
  const restored = GamesOfNationsSystem.fromSave(h.dependencies, state, 104);
  h.setTurn(104);
  restored.excludeNationFromUpcomingGames('england', GAMES_OF_NATIONS_PARTICIPATION_JUSTIFICATIONS[0]);
  h.setTurn(105);
  restored.handleRoundStart(105);
  const wrestling = restored.getState().sportResults?.[0];
  assert.equal(wrestling?.weights?.england, undefined);
  assert.notEqual(wrestling?.goldNationId, 'england');
  assert.equal(h.sportEvents[0]?.nextSportCandidates.some((candidate) => candidate.nationId === 'england'), false);
});

test('host may be excluded while host, city, stadium requirement, and prior champion remain unchanged', () => {
  const h = harness();
  h.advance(95);
  const before = h.system.getState();
  before.completedGames = [{
    gamesNumber: 0, tournamentStartTurn: 50, completionTurn: 54, worldYear: -1000, yearLabel: '1000 BC',
    hostNationName: 'England', hostCityName: 'London', overallWinnerNationId: 'france',
    overallWinnerNationName: 'France', medalTable: [],
  }];
  const restored = GamesOfNationsSystem.fromSave(h.dependencies, before, 95);
  assert.equal(restored.excludeNationFromUpcomingGames('france', GAMES_OF_NATIONS_PARTICIPATION_JUSTIFICATIONS[5]), true);
  assert.equal(restored.getState().hostNationId, 'france');
  assert.equal(restored.getState().hostCityId, 'paris');
  assert.equal(restored.getSummary().stadiumCompleted, true);
  assert.equal(restored.getEffectiveGamesPoints('france', 'Wrestling'), 0);
  assert.equal(restored.getReigningChampionNationId(), 'france');
});

test('host replacement clears exclusions, while ordinary completion permits new-cycle exclusions', () => {
  const h = harness();
  h.advance(95);
  h.system.excludeNationFromUpcomingGames('england', GAMES_OF_NATIONS_PARTICIPATION_JUSTIFICATIONS[1]);
  assert.equal(h.system.replaceUpcomingHostFromWorldCouncil('sweden'), true);
  assert.deepEqual(h.system.getState().excludedNationIds, []);
  assert.equal(h.system.getState().participants.find((entry) => entry.nationId === 'england')?.participating, true);

  const cycle = harness();
  cycle.advance(110);
  assert.equal(cycle.system.getState().phase, 'cooldown');
  assert.equal(cycle.system.getUpcomingParticipationContext()?.gamesNumber, 2);
  assert.equal(cycle.system.excludeNationFromUpcomingGames('england', GAMES_OF_NATIONS_PARTICIPATION_JUSTIFICATIONS[2]), true);
});

test('both GoN resolutions are absent during Competition and return after it ends; ordinary resolutions remain', () => {
  const h = harness();
  h.advance(105);
  assert.equal(h.system.getState().phase, 'competition');
  const resolution = new WorldCouncilResolutionSystem();
  resolution.setRuntime({
    isNationActive: () => true,
    getGamesOfNationsHostingContext: () => h.system.getUpcomingHostingContext(),
    canNationTakeOverGamesHosting: (id) => h.system.canNationTakeOverHosting(id),
    getGamesOfNationsParticipationContext: () => h.system.getUpcomingParticipationContext(),
  });
  const during = resolution.getEligibleDefinitions('worldCouncil', 'sweden').map((definition) => definition.id);
  assert.equal(during.includes('games_of_nations_hosting'), false);
  assert.equal(during.includes('exclude_games_of_nations_participant'), false);
  assert.equal(during.includes('shared_cartography'), true);

  h.advance(110);
  assert.equal(h.system.getState().phase, 'cooldown');
  const after = resolution.getEligibleDefinitions('worldCouncil', 'sweden').map((definition) => definition.id);
  assert.equal(after.includes('games_of_nations_hosting'), true);
  assert.equal(after.includes('exclude_games_of_nations_participant'), true);
});

test('exclusion proposal created in Preparation has no effect when its vote resolves during Competition', () => {
  const h = harness();
  h.advance(95);
  assert.equal(h.system.getState().phase, 'preparation');
  const resolution = new WorldCouncilResolutionSystem();
  resolution.setRuntime({
    isNationActive: () => true,
    getGamesOfNationsParticipationContext: () => h.system.getUpcomingParticipationContext(),
    getAvailableInfluence: () => 100,
    spendInfluence: (_nationId, amount) => amount,
    excludeGamesOfNationsParticipant: (nationId, reason) =>
      h.system.excludeNationFromUpcomingGames(nationId, reason),
  });
  const proposal = resolution.prepareProposal({
    slot: 'host', resolutionId: 'exclude_games_of_nations_participant', proposerNationId: 'england',
    targetNationId: 'france',
  }, 88);
  assert.equal(proposal.targetNationId, 'france');

  h.advance(105);
  assert.equal(h.system.getState().phase, 'competition');
  const beforeResolution = h.system.getState();
  const eventCount = h.exclusionEvents.length;
  const result = resolution.resolve(proposal, {
    meeting: { ...meeting, turn: 105 },
    turn: 105,
    members: [member('england'), member('france'), member('sweden')],
    previousEmergencyMeetings: [],
  });
  assert.equal(result.proposal.passed, false);
  assert.deepEqual(result.proposal.votes, []);
  resolution.execute(result.proposal, { meetingId: 9, turn: 105, memberNationIds: ['england', 'france', 'sweden'] });
  assert.deepEqual(h.system.getState(), beforeResolution, 'resolve-time guard prevents participant exclusion');
  assert.equal(h.exclusionEvents.length, eventCount);

  resolution.execute({ ...proposal, passed: true, resolved: true }, {
    meetingId: 9, turn: 105, memberNationIds: ['england', 'france', 'sweden'],
    gamesNumber: proposal.gamesNumber,
    gamesParticipationJustification: proposal.gamesParticipationJustification,
  });
  assert.deepEqual(h.system.getState(), beforeResolution, 'GoN execution guard also rejects a stale passed proposal');
  assert.equal(h.exclusionEvents.length, eventCount);
});

test('human exclusion UI stays visible but read-only, and successful exclusion is importance-3 History', () => {
  const ui = readFileSync(new URL('../src/ui/GamesOfNationsDialog.ts', import.meta.url), 'utf8');
  const scene = readFileSync(new URL('../src/scenes/GameScene.ts', import.meta.url), 'utf8');
  assert.match(ui, /Excluded from Games of Nations/);
  assert.match(ui, /resources already invested will not be returned/);
  assert.match(scene, /type: 'gamesParticipantExcluded'[\s\S]*?newsImportance: 3/);
});
