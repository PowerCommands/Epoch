import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildHistoricalMedalStandings,
  GamesOfNationsSystem,
  GAMES_OF_NATIONS_SPORTS,
  type GamesOfNationsDependencies,
} from '../src/systems/GamesOfNationsSystem';
import { buildGamesOfNationsLeaderboardSections } from '../src/ui/phaser/GamesOfNationsLeaderboardContent';
import type {
  CompletedGamesOfNationsRecord,
  GamesOfNationsParticipantState,
  GamesOfNationsSportResult,
  GamesOfNationsSportValues,
  SavedGamesOfNationsState,
} from '../src/types/gamesOfNations';

const IDS = ['england', 'sweden', 'china'] as const;
const sportValues = (value: number): GamesOfNationsSportValues => ({
  Wrestling: value,
  Marathon: value,
  Swimming: value,
  Javelin: value,
  'Long Jump': value,
});

function participant(nationId: string, value: number): GamesOfNationsParticipantState {
  return {
    nationId,
    participating: true,
    cultureCommitment: 0,
    productionCommitment: 0,
    unallocatedGamesPoints: 0,
    gamesPointsBySport: sportValues(value),
    totalGamesPoints: value * 5,
    totalCultureInvested: 0,
    totalProductionInvested: 0,
    failedCultureCommitmentTurns: 0,
    failedProductionCommitmentTurns: 0,
    strategyInitialized: true,
  };
}

function competitionState(gamesNumber = 1, completedGames?: CompletedGamesOfNationsRecord[]): SavedGamesOfNationsState {
  return {
    founded: true,
    founderNationId: 'england',
    foundedTurn: 70,
    firstGamesTurn: 100,
    phase: 'competition',
    competitionNumber: gamesNumber,
    phaseStartTurn: 100 + (gamesNumber - 1) * 25,
    nextTransitionTurn: 105 + (gamesNumber - 1) * 25,
    scheduledGamesTurn: 100 + (gamesNumber - 1) * 25,
    hostNationId: gamesNumber === 1 ? 'england' : 'sweden',
    hostCityId: gamesNumber === 1 ? 'london' : 'stockholm',
    hostRotationOrder: [...IDS],
    hostRotationIndex: gamesNumber - 1,
    participants: IDS.map((id, index) => participant(id, 300 - index * 75)),
    sportResults: GAMES_OF_NATIONS_SPORTS.map((sport) => ({ sport, resolved: false })),
    medalTable: [],
    completedGames,
    lastProcessedTurn: 99 + (gamesNumber - 1) * 25,
  };
}

function dependencies(turnRef: { value: number }): GamesOfNationsDependencies {
  const names: Record<string, string> = { england: 'England', sweden: 'Sweden', china: 'China' };
  const cities: Record<string, string> = { england: 'London', sweden: 'Stockholm', china: 'Beijing' };
  return {
    getCurrentTurn: () => turnRef.value,
    getLivingNationIds: () => IDS,
    getNationName: (id) => names[id],
    getCapitalCity: (id) => ({ id: id === 'england' ? 'london' : id === 'sweden' ? 'stockholm' : 'beijing', name: cities[id]! }),
    getCityName: (id) => ({ london: 'London', stockholm: 'Stockholm', beijing: 'Beijing' })[id],
    getWorldDateForTurn: (turn) => ({ worldYear: 900 - turn * 2, yearLabel: `${900 - turn * 2} BC` }),
    seed: 'history-test',
  };
}

function playTo(system: GamesOfNationsSystem, turnRef: { value: number }, turn: number): void {
  turnRef.value = turn;
  system.handleRoundStart(turn);
}

test('a canonical record is created only after the fifth sport and only once', () => {
  const turn = { value: 99 };
  const system = GamesOfNationsSystem.fromSave(dependencies(turn), competitionState(), turn.value);
  for (let current = 100; current <= 103; current += 1) playTo(system, turn, current);
  assert.equal(system.getCompletedGames().length, 0);
  playTo(system, turn, 104);
  playTo(system, turn, 104);
  const [record] = system.getCompletedGames();
  assert.equal(system.getCompletedGames().length, 1);
  assert.equal(record?.gamesNumber, 1);
  assert.equal(record?.tournamentStartTurn, 100);
  assert.equal(record?.completionTurn, 104);
  assert.equal(record?.worldYear, 700);
  assert.equal(record?.yearLabel, '700 BC');
  assert.equal(record?.hostNationId, 'england');
  assert.equal(record?.hostNationName, 'England');
  assert.equal(record?.hostCityId, 'london');
  assert.equal(record?.hostCityName, 'London');
  assert.ok(record?.overallWinnerNationId);
  assert.ok(record?.overallWinnerNationName);
  assert.deepEqual(record?.medalTable.map((row) => row.nationName).sort(), ['China', 'England', 'Sweden']);
});

test('new Games state starts with empty canonical history', () => {
  const turn = { value: 1 };
  const system = GamesOfNationsSystem.forNewGame(dependencies(turn));
  assert.deepEqual(system.getCompletedGames(), []);
  assert.deepEqual(system.getHistoricalMedalStandings(), []);
});

test('save/load preserves prior records and the next Games appends without mutation', () => {
  const turn = { value: 99 };
  const first = GamesOfNationsSystem.fromSave(dependencies(turn), competitionState(), turn.value);
  for (let current = 100; current <= 104; current += 1) playTo(first, turn, current);
  const archivedFirst = structuredClone(first.getCompletedGames()[0]!);
  const saved = JSON.parse(JSON.stringify(first.getState())) as SavedGamesOfNationsState;
  const loaded = GamesOfNationsSystem.fromSave(dependencies(turn), saved, turn.value);
  assert.deepEqual(loaded.getCompletedGames()[0], archivedFirst);

  const secondState = competitionState(2, loaded.getState().completedGames);
  const second = GamesOfNationsSystem.fromSave(dependencies(turn), secondState, 124);
  for (let current = 125; current <= 129; current += 1) playTo(second, turn, current);
  assert.deepEqual(second.getCompletedGames()[0], archivedFirst);
  assert.deepEqual(second.getCompletedGames().map((games) => games.gamesNumber), [1, 2]);
});

test('reigning champion is derived from the latest completed Games across save/load', () => {
  const turn = { value: 150 };
  const records = [
    recordWithTable([
      ['england', 'England', 4, 0, 0],
      ['sweden', 'Sweden', 0, 1, 0],
    ], 1, 'england'),
    recordWithTable([
      ['england', 'England', 0, 1, 0],
      ['sweden', 'Sweden', 1, 0, 0],
      ['china', 'China', 0, 0, 1],
    ], 2, 'sweden'),
  ];
  const loaded = GamesOfNationsSystem.fromSave(
    dependencies(turn),
    competitionState(3, structuredClone(records)),
    turn.value,
  );

  assert.equal(loaded.getLatestCompletedGames()?.gamesNumber, 2);
  assert.equal(loaded.getReigningChampionNationId(), 'sweden');
  assert.equal(loaded.getHistoricalMedalStandings()[0]?.nationId, 'england');

  const reloaded = GamesOfNationsSystem.fromSave(dependencies(turn), loaded.getState(), turn.value);
  assert.equal(reloaded.getReigningChampionNationId(), 'sweden');
  assert.equal(reloaded.getLatestCompletedGames()?.overallWinnerNationId, 'sweden');
});

test('old saves default safely and a fully resolved Step 4 cooldown migrates once', () => {
  const turn = { value: 105 };
  const oldCompetition = competitionState();
  delete oldCompetition.completedGames;
  assert.deepEqual(GamesOfNationsSystem.fromSave(dependencies(turn), oldCompetition, turn.value).getCompletedGames(), []);

  const resolved = competitionState();
  resolved.phase = 'cooldown';
  resolved.phaseStartTurn = 105;
  resolved.nextTransitionTurn = 115;
  resolved.lastProcessedTurn = 105;
  resolved.sportResults = resolvedResults();
  resolved.overallWinnerNationId = 'england';
  delete resolved.completedGames;
  const migrated = GamesOfNationsSystem.fromSave(dependencies(turn), resolved, turn.value);
  assert.equal(migrated.getCompletedGames().length, 1);
  assert.equal(migrated.getCompletedGames()[0]?.tournamentStartTurn, 100);
  const reloaded = GamesOfNationsSystem.fromSave(dependencies(turn), migrated.getState(), turn.value);
  assert.equal(reloaded.getCompletedGames().length, 1);
});

test('historical league uses 5/3/1 scoring and exact tie-break order without Bronze', () => {
  const records: CompletedGamesOfNationsRecord[] = [recordWithTable([
    ['a', 'Alpha', 1, 0, 0],
    ['b', 'Beta', 0, 1, 2],
    ['c', 'Charlie', 0, 1, 2],
    ['d', 'Delta', 0, 1, 2],
  ]), recordWithTable([
    ['b', 'Beta', 0, 0, 0],
  ], 2)];
  const league = buildHistoricalMedalStandings(records);
  assert.deepEqual(league.map((row) => row.nationName), ['Alpha', 'Beta', 'Charlie', 'Delta']);
  assert.equal(league[0]?.points, 5);
  assert.equal(league[1]?.points, 5);
  assert.equal(league[1]?.totalMedals, 3);
  assert.ok(league.some((row) => row.nationId === 'd'), 'archived eliminated nations remain visible');
});

test('each medal has its central 5/3/1 value and medals aggregate across Games', () => {
  const records = [
    recordWithTable([
      ['gold', 'Gold Nation', 1, 0, 0],
      ['silver', 'Silver Nation', 0, 1, 0],
      ['bronze', 'Bronze Nation', 0, 0, 1],
    ]),
    recordWithTable([['gold', 'Gold Nation', 0, 1, 1]], 2),
  ];
  const byId = new Map(buildHistoricalMedalStandings(records).map((row) => [row.nationId, row]));
  assert.equal(byId.get('gold')?.points, 9);
  assert.equal(byId.get('gold')?.totalMedals, 3);
  assert.equal(byId.get('silver')?.points, 3);
  assert.equal(byId.get('bronze')?.points, 1);
});

test('GoN content renders both tables from archive data and has an empty state', () => {
  const empty = buildGamesOfNationsLeaderboardSections([], []);
  assert.deepEqual(empty.map((section) => section.title), [
    'Games of Nations Medal League',
    'Games of Nations Tournament History',
  ]);
  assert.equal(empty[0]?.rows[0]?.kind, 'text');

  const records = [recordWithTable([['a', 'Archived Alpha', 1, 0, 0]])];
  const sections = buildGamesOfNationsLeaderboardSections(buildHistoricalMedalStandings(records), records);
  assert.equal(sections[0]?.rows[0]?.kind, 'compactTable');
  assert.equal(sections[1]?.rows[0]?.kind, 'compactTable');
  if (sections[1]?.rows[0]?.kind === 'compactTable') {
    assert.deepEqual(sections[1].rows[0].rows[0], ['800 BC', 'Host', 'Capital', 'Archived Alpha']);
  }
});

test('Leaderboard keeps its four existing tabs unchanged and adds the Games tab', () => {
  const source = readFileSync(new URL('../src/ui/phaser/RightSidebarPanel.ts', import.meta.url), 'utf8');
  const categoryBlock = source.match(/export const LEADERBOARD_CATEGORIES[\s\S]*?\n\];/)?.[0] ?? '';
  assert.match(categoryBlock, /id: 'domination', label: '⚔️ Domination'/);
  assert.match(categoryBlock, /id: 'diplomacy', label: '🕊️ Diplomacy'/);
  assert.match(categoryBlock, /id: 'research', label: '💡 Research'/);
  assert.match(categoryBlock, /id: 'cultural', label: '🏛️ Cultural'/);
  assert.match(categoryBlock, /id: 'gon', label: 'Game of nations'/);
});

function resolvedResults(): GamesOfNationsSportResult[] {
  return GAMES_OF_NATIONS_SPORTS.map((sport, index) => ({
    sport,
    resolved: true,
    competitionTurn: index + 1,
    goldNationId: 'england',
    silverNationId: 'sweden',
    bronzeNationId: 'china',
  }));
}

function recordWithTable(
  rows: Array<[string, string, number, number, number]>,
  gamesNumber = 1,
  overallWinnerNationId = 'a',
): CompletedGamesOfNationsRecord {
  return {
    gamesNumber,
    tournamentStartTurn: 100,
    completionTurn: 104,
    worldYear: -800,
    yearLabel: '800 BC',
    hostNationId: 'host',
    hostNationName: 'Host',
    hostCityId: 'capital',
    hostCityName: 'Capital',
    overallWinnerNationId,
    overallWinnerNationName: rows.find(([nationId]) => nationId === overallWinnerNationId)?.[1] ?? overallWinnerNationId,
    medalTable: rows.map(([nationId, nationName, gold, silver, bronze]) => ({ nationId, nationName, gold, silver, bronze })),
  };
}
