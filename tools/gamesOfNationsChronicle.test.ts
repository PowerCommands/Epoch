import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildGamesOfNationsEdition,
  GAMES_OF_NATIONS_ATHLETE_NAMES,
  GAMES_OF_NATIONS_SPORT_IMAGES,
  selectNextSportFavorite,
} from '../src/systems/GamesOfNationsChronicle';
import {
  GamesOfNationsSystem,
  type GamesOfNationsDependencies,
  type GamesOfNationsSportResolvedEvent,
} from '../src/systems/GamesOfNationsSystem';
import { NewspaperSystem } from '../src/systems/NewspaperSystem';
import type {
  GamesOfNationsParticipantState,
  GamesOfNationsSportValues,
  SavedGamesOfNationsState,
} from '../src/types/gamesOfNations';

const NAMES: Record<string, string> = {
  a: 'Sweden', b: 'France', c: 'England', d: 'China', host: 'India',
};

function event(overrides: Partial<GamesOfNationsSportResolvedEvent> = {}): GamesOfNationsSportResolvedEvent {
  return {
    gamesNumber: 3,
    competitionDay: 1,
    sport: 'Wrestling',
    result: {
      sport: 'Wrestling', resolved: true, competitionTurn: 1,
      goldNationId: 'a', silverNationId: 'b', bronzeNationId: 'c',
      weights: { a: 200, b: 150, c: 100 },
    },
    hostNationId: 'host',
    hostCityId: 'delhi',
    hostCityName: 'Delhi',
    nextSport: 'Marathon',
    nextSportCandidates: [
      { nationId: 'a', gamesPoints: 50 },
      { nationId: 'c', gamesPoints: 300 },
      { nationId: 'b', gamesPoints: 120 },
    ],
    medalTable: [
      { nationId: 'a', gold: 1, silver: 0, bronze: 0 },
      { nationId: 'b', gold: 0, silver: 1, bronze: 0 },
      { nationId: 'c', gold: 0, silver: 0, bronze: 1 },
    ],
    turn: 87,
    ...overrides,
  };
}

function edition(input = event()) {
  return buildGamesOfNationsEdition({
    event: input,
    dateLabel: 'January 413',
    worldYear: 413,
    getNationName: (id) => NAMES[id],
    seed: 'chronicle-tests',
  });
}

test('the reusable fictional athlete pool contains exactly 100 unique names', () => {
  assert.equal(GAMES_OF_NATIONS_ATHLETE_NAMES.length, 100);
  assert.equal(new Set(GAMES_OF_NATIONS_ATHLETE_NAMES).size, 100);
});

test('special edition uses actual Gold, podium, host, city, and next sport facts', () => {
  const issue = edition();
  assert.equal(issue.issueType, 'gamesSpecial');
  assert.match(issue.mainArticle.headline, /SWEDEN/);
  assert.match(issue.mainArticle.headline, /WRESTLING/);
  assert.equal(issue.mainArticle.imagePath, GAMES_OF_NATIONS_SPORT_IMAGES.Wrestling);
  assert.match(issue.secondaryArticles[0].headline, /FRANCE/);
  assert.match(issue.secondaryArticles[0].headline, /ENGLAND/);
  assert.match(issue.secondaryArticles[1].headline + issue.secondaryArticles[1].body, /India/i);
  assert.match(issue.secondaryArticles[1].headline + issue.secondaryArticles[1].body, /Delhi/i);
  assert.match(issue.secondaryArticles[2].headline, /MARATHON/);
  assert.match(issue.secondaryArticles[2].headline, /ENGLAND/);
});

test('Gold, Silver, Bronze, and favorite athletes are fictional and distinct within one edition', () => {
  const issue = edition();
  const copy = [issue.mainArticle, ...issue.secondaryArticles].map((article) => article.body).join(' ');
  const used = GAMES_OF_NATIONS_ATHLETE_NAMES.filter((name) => copy.includes(name));
  assert.equal(used.length, 4);
  assert.equal(new Set(used).size, 4);
});

test('favorite is highest positive next-sport GP with stable tie order and no gameplay mutation', () => {
  assert.equal(selectNextSportFavorite([
    { nationId: 'first', gamesPoints: 100 },
    { nationId: 'second', gamesPoints: 100 },
    { nationId: 'zero', gamesPoints: 0 },
  ]), 'first');
  assert.equal(selectNextSportFavorite([{ nationId: 'zero', gamesPoints: 0 }]), undefined);
  const input = event();
  const before = structuredClone(input);
  const first = edition(input);
  const second = edition(input);
  assert.deepEqual(input, before);
  assert.deepEqual(second, first);
  assert.equal(input.nextSportCandidates[1]?.gamesPoints, 300);
});

test('preview is neutral when no positive-GP favorite exists', () => {
  const issue = edition(event({ nextSportCandidates: [] }));
  assert.match(issue.secondaryArticles[2].headline, /WIDE OPEN/);
  assert.doesNotMatch(issue.secondaryArticles[2].body, /Games Points|GP/);
});

test('limited fields never invent medalists', () => {
  const input = event({
    result: { sport: 'Wrestling', resolved: true, goldNationId: 'a', silverNationId: 'b' },
  });
  const issue = edition(input);
  assert.match(issue.secondaryArticles[0].body, /no Bronze medal was awarded/i);
  assert.doesNotMatch(issue.secondaryArticles[0].body, /England/);

  const goldOnly = edition(event({
    result: { sport: 'Wrestling', resolved: true, goldNationId: 'a' },
  }));
  assert.match(goldOnly.secondaryArticles[0].headline, /EMPTY STEPS/);
});

test('final-day edition uses closing standings and never invents a sixth sport', () => {
  const issue = edition(event({
    competitionDay: 5,
    sport: 'Long Jump',
    result: { sport: 'Long Jump', resolved: true, competitionTurn: 5, goldNationId: 'b', silverNationId: 'a', bronzeNationId: 'c' },
    nextSport: undefined,
    nextSportCandidates: [],
    overallWinnerNationId: 'a',
    turn: 91,
  }));
  assert.equal(issue.mainArticle.imagePath, GAMES_OF_NATIONS_SPORT_IMAGES['Long Jump']);
  assert.match(issue.secondaryArticles[2].headline + issue.secondaryArticles[2].body, /CLOSING|closing/i);
  assert.doesNotMatch(issue.secondaryArticles[2].headline + issue.secondaryArticles[2].body, /TOMORROW|sixth sport/i);
});

test('Games system emits at most one ephemeral snapshot per newly resolved Competition sport', () => {
  const snapshots: GamesOfNationsSportResolvedEvent[] = [];
  let turn = 104;
  const dependencies: GamesOfNationsDependencies = {
    getCurrentTurn: () => turn,
    getLivingNationIds: () => ['a', 'b', 'c'],
    getNationName: (id) => NAMES[id],
    getCapitalCity: () => ({ id: 'delhi', name: 'Delhi' }),
    seed: 'chronicle-callbacks',
    onSportResolved: (snapshot) => snapshots.push(snapshot),
  };
  const system = GamesOfNationsSystem.fromSave(dependencies, competitionState(), turn);
  assert.equal(snapshots.length, 0);
  for (turn = 105; turn <= 109; turn += 1) {
    system.handleRoundStart(turn);
    system.handleRoundStart(turn);
    assert.equal(snapshots.length, turn - 104);
  }
  assert.deepEqual(snapshots.map((snapshot) => snapshot.sport), ['Wrestling', 'Marathon', 'Swimming', 'Javelin', 'Long Jump']);
  system.handleRoundStart(110);
  assert.equal(snapshots.length, 5);

  const loaded = GamesOfNationsSystem.fromSave({ ...dependencies, onSportResolved: (snapshot) => snapshots.push(snapshot) }, system.getState(), 110);
  loaded.handleRoundStart(110);
  assert.equal(snapshots.length, 5);
});

test('special generation changes neither newspaper state nor ordinary cadence/archive', () => {
  const newspaper = NewspaperSystem.forNewGame({
    humanNationId: 'a',
    getTimelineEvents: () => [],
    getDominationRanking: () => ['a', 'b', 'c'],
    getNationName: (id) => NAMES[id],
    getLeaderName: () => undefined,
    seed: 'ordinary-news',
  });
  const before = newspaper.getState();
  edition();
  assert.deepEqual(newspaper.getState(), before);
  assert.equal(newspaper.consumeDueIssue(10, 'Round 10'), null);
  assert.ok(newspaper.consumeDueIssue(11, 'Round 11'));
  assert.equal(newspaper.getIssues().length, 1);
  assert.equal(newspaper.consumeDueIssue(12, 'Round 12'), null);
  assert.ok(newspaper.consumeDueIssue(21, 'Round 21'));
  assert.equal(newspaper.getIssues().length, 2);
  assert.ok(newspaper.getIssues().every((issue) => issue.issueType !== ('gamesSpecial' as never)));
});

test('integration remains presentation-only and preserves Step 4 History importance', () => {
  const generatorSource = readFileSync(new URL('../src/systems/GamesOfNationsChronicle.ts', import.meta.url), 'utf8');
  const sceneSource = readFileSync(new URL('../src/scenes/GameScene.ts', import.meta.url), 'utf8');
  const dialogSource = readFileSync(new URL('../src/ui/NewspaperDialog.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(generatorSource, /HistoricalTimelineService|historicalTimeline\.record|NewspaperSystem/);
  assert.match(sceneSource, /type: 'gamesGold'[\s\S]*?newsImportance: 5/);
  assert.match(sceneSource, /type: 'gamesCompleted'[\s\S]*?newsImportance: 3/);
  assert.match(sceneSource, /onSportResolved: \(event\) => presentGamesOfNationsEdition\(event\)/);
  assert.match(sceneSource, /newspaperDialog\.present\(issue\)/);
  assert.match(dialogSource, /GAMES OF NATIONS EDITION/);
  assert.match(dialogSource, /this\.pending\.push/);
});

function competitionState(): SavedGamesOfNationsState {
  return {
    founded: true,
    founderNationId: 'host',
    foundedTurn: 80,
    firstGamesTurn: 105,
    phase: 'competition',
    competitionNumber: 1,
    phaseStartTurn: 105,
    nextTransitionTurn: 110,
    scheduledGamesTurn: 105,
    hostNationId: 'host',
    hostCityId: 'delhi',
    hostRotationOrder: ['host', 'a', 'b', 'c'],
    hostRotationIndex: 0,
    participants: [participant('a', 300), participant('b', 200), participant('c', 100)],
    lastProcessedTurn: 104,
  };
}

function participant(nationId: string, value: number): GamesOfNationsParticipantState {
  const gamesPointsBySport = sportValues(value);
  return {
    nationId,
    participating: true,
    cultureCommitment: 0,
    productionCommitment: 0,
    sportAllocation: sportValues(20),
    gamesPointsBySport,
    totalGamesPoints: value * 5,
    totalCultureInvested: 0,
    totalProductionInvested: 0,
    failedCultureCommitmentTurns: 0,
    failedProductionCommitmentTurns: 0,
    strategyInitialized: true,
  };
}

function sportValues(value: number): GamesOfNationsSportValues {
  return { Wrestling: value, Marathon: value, Swimming: value, Javelin: value, 'Long Jump': value };
}
