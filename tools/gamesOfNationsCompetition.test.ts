import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { NEWSPAPER_EVENT_DEFINITIONS } from '../src/data/newspaperContent';
import {
  buildMedalTable,
  drawSportMedals,
  GamesOfNationsSystem,
  GAMES_OF_NATIONS_SPORTS,
  type GamesOfNationsCompletedEvent,
  type GamesOfNationsDependencies,
  type GamesOfNationsGoldEvent,
} from '../src/systems/GamesOfNationsSystem';
import { getSelectionPriority, NewspaperSystem } from '../src/systems/NewspaperSystem';
import type { HistoricalEvent } from '../src/types/historicalTimeline';
import type {
  GamesOfNationsParticipantState,
  GamesOfNationsSportResult,
  GamesOfNationsSportValues,
  SavedGamesOfNationsState,
} from '../src/types/gamesOfNations';

const IDS = ['a', 'b', 'c', 'd'] as const;
const points = (value: number): GamesOfNationsSportValues => ({
  Wrestling: value, Marathon: value, Swimming: value, Javelin: value, 'Long Jump': value,
});

function participant(
  nationId: string,
  sportPoints: GamesOfNationsSportValues,
  participating = true,
): GamesOfNationsParticipantState {
  return {
    nationId,
    participating,
    cultureCommitment: 0,
    productionCommitment: 0,
    unallocatedGamesPoints: 0,
    gamesPointsBySport: { ...sportPoints },
    totalGamesPoints: Object.values(sportPoints).reduce((sum, value) => sum + value, 0),
    totalCultureInvested: 0,
    totalProductionInvested: 0,
    failedCultureCommitmentTurns: 0,
    failedProductionCommitmentTurns: 0,
    strategyInitialized: true,
  };
}

function competitionState(participants: GamesOfNationsParticipantState[]): SavedGamesOfNationsState {
  return {
    founded: true,
    founderNationId: 'a',
    foundedTurn: 80,
    firstGamesTurn: 105,
    phase: 'competition',
    competitionNumber: 1,
    phaseStartTurn: 105,
    nextTransitionTurn: 110,
    scheduledGamesTurn: 105,
    hostNationId: 'a',
    hostCityId: 'a-city',
    hostRotationOrder: [...IDS],
    hostRotationIndex: 0,
    participants,
    lastProcessedTurn: 104,
  };
}

function harness(options: {
  participants?: GamesOfNationsParticipantState[];
  state?: SavedGamesOfNationsState;
  seed?: string;
} = {}) {
  let turn = options.state?.lastProcessedTurn ?? 104;
  let living = [...IDS] as string[];
  const goldEvents: GamesOfNationsGoldEvent[] = [];
  const completedEvents: GamesOfNationsCompletedEvent[] = [];
  const dependencies: GamesOfNationsDependencies = {
    getCurrentTurn: () => turn,
    getLivingNationIds: () => living,
    getNationName: (id) => id.toUpperCase(),
    getCapitalCity: (id) => ({ id: `${id}-city`, name: `${id.toUpperCase()} City` }),
    seed: options.seed ?? 'competition-tests',
    onGoldMedal: (event) => goldEvents.push(event),
    onGamesCompleted: (event) => completedEvents.push(event),
  };
  const state = options.state ?? competitionState(options.participants ?? [
    participant('a', points(400)),
    participant('b', points(250)),
    participant('c', points(100)),
    participant('d', points(50)),
  ]);
  const system = GamesOfNationsSystem.fromSave(dependencies, state, turn);
  return {
    system,
    goldEvents,
    completedEvents,
    setLiving(ids: string[]) { living = [...ids]; },
    advance(nextTurn: number) { turn = nextTurn; system.handleRoundStart(nextTurn); },
  };
}

test('Competition resolves exactly one sport per turn in fixed order', () => {
  const game = harness();
  for (let offset = 0; offset < 5; offset += 1) {
    game.advance(105 + offset);
    const resolved = game.system.getSummary().sportResults.filter((result) => result.resolved);
    assert.equal(resolved.length, offset + 1);
    assert.deepEqual(resolved.map((result) => result.sport), GAMES_OF_NATIONS_SPORTS.slice(0, offset + 1));
    assert.equal(game.goldEvents.length, offset + 1);
  }
  assert.equal(game.completedEvents.length, 1);
});

test('only participating, living, positive-GP nations enter unresolved sport lotteries', () => {
  const game = harness({ participants: [
    participant('a', points(100)),
    participant('b', points(50)),
    participant('c', points(0)),
    participant('d', points(100), false),
  ] });
  game.advance(105);
  const wrestling = game.system.getSummary().sportResults[0]!;
  assert.deepEqual(wrestling.weights, { a: 100, b: 50 });
  assert.ok(wrestling.goldNationId);
  assert.ok(wrestling.silverNationId);
  assert.equal(wrestling.bronzeNationId, undefined);
  game.setLiving(['a', 'c', 'd']);
  game.advance(106);
  const marathon = game.system.getSummary().sportResults[1]!;
  assert.deepEqual(marathon.weights, { a: 100 });
  assert.equal(marathon.goldNationId, 'a');
  assert.equal(marathon.silverNationId, undefined);
});

test('weighted medal draws are deterministic, without replacement, and handle 0–3 entrants', () => {
  const entries = [{ nationId: 'a', weight: 100 }, { nationId: 'b', weight: 60 }, { nationId: 'c', weight: 20 }];
  const first = drawSportMedals(entries, 'same-seed');
  const second = drawSportMedals(entries, 'same-seed');
  assert.deepEqual(second, first);
  assert.equal(new Set(Object.values(first).filter(Boolean)).size, 3);
  assert.deepEqual(drawSportMedals(entries.slice(0, 2), 'two'), {
    goldNationId: assertString(drawSportMedals(entries.slice(0, 2), 'two').goldNationId),
    silverNationId: assertString(drawSportMedals(entries.slice(0, 2), 'two').silverNationId),
    bronzeNationId: undefined,
  });
  assert.equal(drawSportMedals(entries.slice(0, 1), 'one').goldNationId, 'a');
  assert.deepEqual(drawSportMedals([], 'none'), { goldNationId: undefined, silverNationId: undefined, bronzeNationId: undefined });
});

test('higher GP is lottery weight rather than deterministic placement', () => {
  const weighted = [{ nationId: 'favorite', weight: 10 }, { nationId: 'underdog', weight: 9 }];
  const outcomes = new Set(Array.from({ length: 100 }, (_, index) => drawSportMedals(weighted, `variance-${index}`).goldNationId));
  assert.deepEqual(outcomes, new Set(['favorite', 'underdog']));
});

test('sport resolution does not consume Games Points', () => {
  const game = harness();
  const before = game.system.getSummary().participants.map((entry) => ({ id: entry.nationId, points: { ...entry.gamesPointsBySport } }));
  game.advance(105);
  const after = game.system.getSummary().participants.map((entry) => ({ id: entry.nationId, points: { ...entry.gamesPointsBySport } }));
  assert.deepEqual(after, before);
});

test('save/load preserves resolved results and does not emit their Gold event again', () => {
  const original = harness();
  original.advance(105);
  const wrestling = original.system.getSummary().sportResults[0];
  const saved = JSON.parse(JSON.stringify(original.system.getState())) as SavedGamesOfNationsState;
  const loaded = harness({ state: saved });
  loaded.advance(105);
  assert.deepEqual(loaded.system.getSummary().sportResults[0], wrestling);
  assert.equal(loaded.goldEvents.length, 0);
  loaded.advance(106);
  assert.equal(loaded.goldEvents.length, 1);
  assert.equal(loaded.goldEvents[0]?.sport, 'Marathon');
});

test('medal table ranks Gold, then Silver, then Bronze, then stable order without GP', () => {
  const results: GamesOfNationsSportResult[] = [
    { sport: 'Wrestling', resolved: true, goldNationId: 'b', silverNationId: 'a', bronzeNationId: 'c' },
    { sport: 'Marathon', resolved: true, goldNationId: 'b', silverNationId: 'a', bronzeNationId: 'c' },
    { sport: 'Swimming', resolved: true, goldNationId: 'a', silverNationId: 'c', bronzeNationId: 'b' },
    { sport: 'Javelin', resolved: true, goldNationId: 'c' },
  ];
  const table = buildMedalTable(results, ['c', 'b', 'a'], ['a', 'b', 'c', 'd']);
  assert.deepEqual(table.map((entry) => entry.nationId), ['b', 'a', 'c', 'd']);
  const tied = buildMedalTable([
    { sport: 'Wrestling', resolved: true, goldNationId: 'a', silverNationId: 'b' },
    { sport: 'Marathon', resolved: true, goldNationId: 'b', silverNationId: 'a' },
  ], ['b', 'a'], ['a', 'b']);
  assert.deepEqual(tied.map((entry) => entry.nationId), ['b', 'a']);
});

test('Long Jump finalizes standings, while a no-GP Games has no overall winner', () => {
  const normal = harness();
  for (let turn = 105; turn <= 109; turn += 1) normal.advance(turn);
  assert.equal(normal.system.getSummary().competitionComplete, true);
  assert.ok(normal.system.getSummary().overallWinnerNationId);
  assert.equal(normal.completedEvents.length, 1);
  normal.advance(110);
  assert.equal(normal.system.getSummary().phase, 'cooldown');
  const cooldownSave = JSON.parse(JSON.stringify(normal.system.getState())) as SavedGamesOfNationsState;
  const cooldownLoaded = harness({ state: cooldownSave });
  assert.deepEqual(cooldownLoaded.system.getSummary().sportResults, normal.system.getSummary().sportResults);
  assert.deepEqual(cooldownLoaded.system.getSummary().medalTable, normal.system.getSummary().medalTable);
  assert.equal(cooldownLoaded.system.getSummary().overallWinnerNationId, normal.system.getSummary().overallWinnerNationId);

  const empty = harness({ participants: IDS.map((id) => participant(id, points(0))) });
  for (let turn = 105; turn <= 109; turn += 1) empty.advance(turn);
  assert.equal(empty.system.getSummary().overallWinnerNationId, null);
  assert.equal(empty.completedEvents[0]?.overallWinnerNationId, undefined);
  assert.equal(empty.goldEvents.length, 0);
});

test('one complete Games emits at most five Gold callbacks plus one final summary', () => {
  const game = harness();
  for (let turn = 105; turn <= 109; turn += 1) game.advance(turn);
  assert.equal(game.goldEvents.length, 5);
  assert.equal(game.completedEvents.length, 1);
  assert.equal(game.goldEvents.length + game.completedEvents.length, 6);
});

test('Games History events carry exact importance and newspaper uses the normal ranking pipeline', () => {
  const sceneSource = readFileSync(new URL('../src/scenes/GameScene.ts', import.meta.url), 'utf8');
  assert.match(sceneSource, /type: 'gamesGold'[\s\S]*?newsImportance: 5/);
  assert.match(sceneSource, /type: 'gamesCompleted'[\s\S]*?newsImportance: 3/);
  assert.equal(NEWSPAPER_EVENT_DEFINITIONS.gamesGold.priority, 50);
  assert.equal(NEWSPAPER_EVENT_DEFINITIONS.gamesCompleted.priority, 70);

  const events: HistoricalEvent[] = [
    historyEvent(1, 'gamesGold', 5, ['a'], 5),
    historyEvent(2, 'gamesCompleted', 6, ['a', 'b'], 3),
    historyEvent(3, 'warDeclared', 7, ['b', 'c']),
  ];
  const newspaper = NewspaperSystem.forNewGame({
    humanNationId: 'a',
    getTimelineEvents: () => events,
    getDominationRanking: () => ['a', 'b', 'c'],
    getNationName: (id) => id.toUpperCase(),
    getLeaderName: (id) => id,
    seed: 'news-test',
  });
  const issue = newspaper.consumeDueIssue(11, 'Date')!;
  assert.equal(getSelectionPriority(events[0]!), 50);
  assert.equal(getSelectionPriority(events[1]!), 70);
  assert.equal(issue.mainArticle.eventType, 'warDeclared');
  assert.ok(issue.secondaryArticles.some((article) => article.eventType === 'gamesCompleted'));
  assert.ok(issue.secondaryArticles.some((article) => article.eventType === 'gamesGold'));
});

function historyEvent(
  id: number,
  type: HistoricalEvent['type'],
  round: number,
  eventNationIds: string[],
  newsImportance?: number,
): HistoricalEvent {
  return {
    id, type, round, dateLabel: `Round ${round}`, icon: '🏆', text: `${type} event`, eventNationIds,
    visibleToNationIds: eventNationIds, discoveredTurn: round, newsImportance,
    metadata: { gamesNumber: 1, gamesSport: 'Wrestling', nationNames: eventNationIds.map((idValue) => idValue.toUpperCase()) },
  };
}

function assertString(value: string | undefined): string {
  assert.ok(value);
  return value;
}
