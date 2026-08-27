import assert from 'node:assert/strict';
import test from 'node:test';
import { NEWSPAPER_EVENT_DEFINITIONS } from '../src/data/newspaperContent';
import {
  isNewspaperRound,
  NewspaperSystem,
  type NewspaperSystemDependencies,
} from '../src/systems/NewspaperSystem';
import { buildDominationRanking } from '../src/systems/DominationRanking';
import type { HistoricalEvent, HistoricalEventType } from '../src/types/historicalTimeline';
import type { SavedNewspaperState } from '../src/types/newspaper';

function event(
  id: number,
  type: HistoricalEventType,
  round: number,
  nations: string[],
  metadata?: HistoricalEvent['metadata'],
): HistoricalEvent {
  return {
    id,
    type,
    round,
    dateLabel: `Round ${round}`,
    icon: '',
    text: `event ${id}`,
    eventNationIds: nations,
    visibleToNationIds: nations,
    discoveredTurn: round,
    metadata,
  };
}

function worldWarStart(id: number, round: number): HistoricalEvent {
  return event(id, 'worldWarStarted', round, ['high', 'human'], {
    scenarioHistoricalEventId: 'world-war-ii',
    scenarioHistoricalEventName: 'World War II',
    scenarioHistoricalEventDescription: "Germany's invasion of Poland has plunged Europe into war.",
    worldWarConflictNames: ['Highland ↔ Humania'],
    nationNames: ['Highland', 'Humania'],
  });
}

function harness(
  events: HistoricalEvent[],
  ranking = ['high', 'human', 'low'],
  saved?: SavedNewspaperState,
  currentRound = 1,
): NewspaperSystem {
  const dependencies: NewspaperSystemDependencies = {
    humanNationId: 'human',
    getTimelineEvents: () => events,
    getDominationRanking: () => ranking,
    getNationName: (id) => ({ human: 'Humania', high: 'Highland', low: 'Lowland', other: 'Otherland' })[id],
    getLeaderName: (id) => ({ human: 'Helena', high: 'Hector', low: 'Lucius', other: 'Octavia' })[id],
    seed: 'test-seed',
  };
  return saved
    ? NewspaperSystem.fromSave(dependencies, saved, currentRound)
    : NewspaperSystem.forNewGame(dependencies);
}

test('newspaper schedule is rounds ending in 1 beginning at 11', () => {
  assert.equal(isNewspaperRound(10), false);
  assert.equal(isNewspaperRound(11), true);
  assert.equal(isNewspaperRound(12), false);
  assert.equal(isNewspaperRound(20), false);
  assert.equal(isNewspaperRound(21), true);
  assert.equal(isNewspaperRound(31), true);
});

test('A: a World War registered in the publication round becomes that issue main headline', () => {
  const issue = harness([
    event(1, 'cityFounded', 10, ['human'], { cityName: 'Home City' }),
    worldWarStart(2, 11),
  ]).consumeDueIssue(11, 'September 1939')!;

  assert.equal(issue.mainArticle.eventType, 'worldWarStarted');
  assert.equal(issue.mainArticle.headline, 'WORLD WAR II BEGINS');
  assert.equal(issue.coverageEndRound, 11);
});

test('B: a World War starting after publication waits for the next scheduled issue', () => {
  const events: HistoricalEvent[] = [];
  const system = harness(events);
  const current = system.consumeDueIssue(11, 'Issue 1')!;
  events.push(worldWarStart(1, 12));
  const next = system.consumeDueIssue(21, 'Issue 2')!;

  assert.notEqual(current.mainArticle.eventType, 'worldWarStarted');
  assert.equal(next.mainArticle.eventType, 'worldWarStarted');
});

test('C: a World War starting one round before publication appears normally', () => {
  const issue = harness([worldWarStart(1, 10)]).consumeDueIssue(11, 'Issue')!;
  assert.equal(issue.mainArticle.eventType, 'worldWarStarted');
});

test('D: a same-round World War headline is not repeated in the following issue', () => {
  const system = harness([worldWarStart(1, 11)]);
  assert.equal(system.consumeDueIssue(11, 'Issue 1')!.mainArticle.eventType, 'worldWarStarted');
  const next = system.consumeDueIssue(21, 'Issue 2')!;
  assert.notEqual(next.mainArticle.eventType, 'worldWarStarted');
  assert.equal(next.secondaryArticles.some((article) => article.eventType === 'worldWarStarted'), false);
});

test('E: World War priority beats same-round ordinary Chronicle candidates', () => {
  const issue = harness([
    event(1, 'warDeclared', 11, ['human', 'low']),
    event(2, 'nationEliminated', 11, ['high']),
    worldWarStart(3, 11),
  ]).consumeDueIssue(11, 'Issue')!;
  assert.equal(issue.mainArticle.eventType, 'worldWarStarted');
});

test('F: terminal victory still replaces a same-round World War main headline', () => {
  const system = harness([worldWarStart(1, 11)]);
  assert.equal(system.consumeDueIssue(11, 'Issue', false, 1939)!.mainArticle.eventType, 'worldWarStarted');
  const victory = system.consumeVictoryIssue({
    round: 11,
    worldYear: 1939,
    dateLabel: 'September 1939',
    nationId: 'human',
    victoryType: 'domination',
  });
  assert.equal(victory.issueType, 'victory');
  assert.equal(victory.mainArticle.eventType, undefined);
  assert.match(victory.mainArticle.headline, /HUMANIA/);
});

test('G: ordinary Chronicle cadence and candidate selection remain unchanged without Historical Events', () => {
  const system = harness([event(1, 'cityFounded', 11, ['human'], { cityName: 'Home City' })]);
  assert.equal(system.consumeDueIssue(10, 'Too early'), null);
  assert.equal(system.consumeDueIssue(11, 'Issue')!.mainArticle.eventType, 'cityFounded');
  assert.equal(system.consumeDueIssue(12, 'Too early'), null);
  assert.ok(system.consumeDueIssue(21, 'Next issue'));
});

test('publication cursor survives save/load and retains later same-round events', () => {
  const events = [worldWarStart(1, 11)];
  const original = harness(events);
  original.consumeDueIssue(11, 'Issue 1');
  events.push(event(2, 'peace', 11, ['high', 'human']));
  const restored = harness(events, undefined, original.getState(), 11);
  const next = restored.consumeDueIssue(21, 'Issue 2')!;
  assert.equal(next.mainArticle.historicalEventId, 2);
  assert.equal(next.secondaryArticles.some((article) => article.historicalEventId === 1), false);
});

test('shared Domination ranking orders capitals, military strength, then name', () => {
  const ranking = buildDominationRanking(
    [{ id: 'low', name: 'Zulu' }, { id: 'high', name: 'Alpha' }, { id: 'other', name: 'Beta' }],
    [{ ownerId: 'low' }, { ownerId: 'high' }, { ownerId: 'other' }, { ownerId: 'other' }],
    (id) => ({ low: 20, high: 50, other: 1 })[id] ?? 0,
  );
  assert.deepEqual(ranking.map((entry) => entry.nationId), ['other', 'high', 'low']);
});

test('higher base priority beats a lower-priority human event', () => {
  const issue = harness([
    event(1, 'warDeclared', 6, ['high', 'low']),
    event(2, 'cityFounded', 9, ['human']),
  ]).consumeDueIssue(11, 'January 1000 BC');
  assert.equal(issue?.mainArticle.historicalEventId, 1);
});

test('human nation wins a same-priority tie', () => {
  const issue = harness([
    event(1, 'cityFounded', 9, ['high'], { cityName: 'High City' }),
    event(2, 'cityFounded', 3, ['human'], { cityName: 'Home City' }),
  ]).consumeDueIssue(11, 'Date');
  assert.equal(issue?.mainArticle.historicalEventId, 2);
});

test('higher Domination-ranked nation wins a same-priority non-human tie', () => {
  const issue = harness([
    event(1, 'firstContact', 9, ['low', 'other']),
    event(2, 'firstContact', 3, ['high', 'other']),
  ]).consumeDueIssue(11, 'Date');
  assert.equal(issue?.mainArticle.historicalEventId, 2);
});

test('insults cannot become the main article and outrank normal secondary stories', () => {
  const issue = harness([
    event(1, 'warDeclared', 3, ['high', 'low']),
    event(2, 'leaderInsult', 7, ['low', 'human'], {
      aggressorNationId: 'low', targetNationId: 'human', leaderInsultSubtype: 'threat', leaderInsultText: 'Yield while you can.',
    }),
    event(3, 'allianceFormed', 8, ['high', 'other']),
  ]).consumeDueIssue(11, 'Date')!;
  assert.equal(issue.mainArticle.historicalEventId, 1);
  assert.equal(issue.secondaryArticles[0].historicalEventId, 2);
  assert.equal(issue.secondaryArticles[0].body, '“Yield while you can.”');
});

test('three insult slots are filled before ordinary stories', () => {
  const insults = [2, 3, 4].map((id) => event(id, 'leaderInsult', id + 2, ['high', 'low'], {
    aggressorNationId: 'high', targetNationId: 'low', leaderInsultSubtype: 'insult', leaderInsultText: `Insult ${id}`,
  }));
  const issue = harness([
    event(1, 'warDeclared', 2, ['high', 'low']),
    ...insults,
    event(5, 'allianceFormed', 9, ['human', 'other']),
  ]).consumeDueIssue(11, 'Date')!;
  assert.deepEqual(issue.secondaryArticles.map((article) => article.isInsult), [true, true, true]);
});

test('one historical event cannot occupy multiple slots', () => {
  const issue = harness([
    event(1, 'warDeclared', 2, ['high', 'low']),
    event(2, 'peace', 8, ['high', 'low']),
  ]).consumeDueIssue(11, 'Date')!;
  const ids = [issue.mainArticle, ...issue.secondaryArticles]
    .map((article) => article.historicalEventId)
    .filter((id): id is number => id !== undefined);
  assert.equal(new Set(ids).size, ids.length);
});

test('consumed issue state prevents replay after save/load', () => {
  const events = [event(1, 'warDeclared', 5, ['high', 'low'])];
  const first = harness(events);
  assert.ok(first.consumeDueIssue(11, 'Date'));
  const restored = harness(events, undefined, first.getState(), 11);
  assert.equal(restored.consumeDueIssue(11, 'Date'), null);
});

test('old saves consume past boundaries and wait for the next future one', () => {
  const system = NewspaperSystem.fromSave({
    humanNationId: 'human',
    getTimelineEvents: () => [],
    getDominationRanking: () => [],
    getNationName: () => undefined,
    getLeaderName: () => undefined,
    seed: 'old-save',
  }, undefined, 21);
  assert.equal(system.consumeDueIssue(21, 'Date'), null);
  assert.ok(system.consumeDueIssue(31, 'Later'));
});

test('comment selection is stable for the same issue and event', () => {
  const events = [event(7, 'warDeclared', 5, ['high', 'low'])];
  const first = harness(events).consumeDueIssue(11, 'Date')!;
  const second = harness(events).consumeDueIssue(11, 'Date')!;
  assert.equal(first.mainArticle.comment, second.mainArticle.comment);
});

test('wonder news uses the built wonder image from history metadata', () => {
  const issue = harness([
    event(1, 'wonderBuilt', 5, ['human'], { wonderId: 'great_lighthouse', wonderName: 'Great Lighthouse' }),
  ]).consumeDueIssue(11, 'Date')!;

  assert.equal(issue.mainArticle.imagePath, '/assets/sprites/wonders/great_lighthouse.png');
});

test('wonder news can infer an older history entry and otherwise uses the fallback image', () => {
  const inferred = event(1, 'wonderBuilt', 5, ['human']);
  inferred.text = 'Humania completed Angkor Wat';
  const inferredIssue = harness([inferred]).consumeDueIssue(11, 'Date')!;
  const fallbackIssue = harness([
    event(2, 'wonderBuilt', 5, ['human']),
  ]).consumeDueIssue(11, 'Date')!;

  assert.equal(inferredIssue.mainArticle.imagePath, '/assets/sprites/wonders/angkor-wat.png');
  assert.equal(fallbackIssue.mainArticle.imagePath, '/assets/sprites/news/wonder-built.png');
});

test('every recurring event definition has exactly ten comments', () => {
  for (const definition of Object.values(NEWSPAPER_EVENT_DEFINITIONS)) {
    assert.equal(definition.comments.length, 10);
  }
});

test('regular issues persist as immutable snapshots across save/load', () => {
  const events = [event(1, 'warDeclared', 5, ['high', 'low'])];
  const original = harness(events);
  const published = original.consumeDueIssue(11, 'January 1000 BC', false, -1000)!;
  const saved = JSON.parse(JSON.stringify(original.getState())) as SavedNewspaperState;
  const restored = harness([], undefined, saved, 11);
  const archived = restored.getIssues();

  assert.equal(archived.length, 1);
  assert.deepEqual(archived[0], published);
  assert.equal(archived[0]?.mainArticle.headline, published.mainArticle.headline);
  assert.equal(restored.consumeDueIssue(11, 'Changed Date'), null);
});

test('three regular issues retain chronological sequence and stable numbering', () => {
  const events = [
    event(1, 'cityFounded', 5, ['human'], { cityName: 'First' }),
    event(2, 'warDeclared', 15, ['high', 'low']),
    event(3, 'peace', 25, ['high', 'low']),
  ];
  const system = harness(events);
  system.consumeDueIssue(11, 'Date 11');
  system.consumeDueIssue(21, 'Date 21');
  system.consumeDueIssue(31, 'Date 31');
  assert.deepEqual(system.getIssues().map((issue) => [issue.issueNumber, issue.issueRound]), [
    [1, 11], [2, 21], [3, 31],
  ]);
});

test('victory issue is last, identifies an AI winner, and is created exactly once', () => {
  const system = harness([event(1, 'warDeclared', 45, ['high', 'low'])], undefined, {
    lastConsumedIssueRound: 41,
    issues: [],
  }, 47);
  const first = system.consumeVictoryIssue({
    round: 47, worldYear: 1967, dateLabel: 'March 1967', nationId: 'high', victoryType: 'science',
  });
  const repeated = system.consumeVictoryIssue({
    round: 47, worldYear: 1967, dateLabel: 'March 1967', nationId: 'high', victoryType: 'science',
  });

  assert.equal(system.getIssues().length, 1);
  assert.deepEqual(repeated, first);
  assert.equal(first.issueType, 'victory');
  assert.equal(first.victory?.nationId, 'high');
  assert.equal(first.victory?.nationName, 'Highland');
  assert.equal(first.victory?.leaderName, 'Hector');
  assert.equal(first.victory?.victoryType, 'science');
  assert.match(first.mainArticle.headline, /HIGHLAND/);
  assert.match(first.mainArticle.body, /Hector.*Science Victory.*March 1967/);
  assert.equal(first.coverageStartRound, 41);
  assert.equal(first.coverageEndRound, 47);
  assert.equal(first.secondaryArticles[0].historicalEventId, 1);
});

test('victory on a recurring boundary replaces that round regular issue', () => {
  const events = [event(1, 'warDeclared', 49, ['high', 'low'])];
  const system = harness(events, undefined, { lastConsumedIssueRound: 41, issues: [] }, 51);
  assert.ok(system.consumeDueIssue(51, 'Boundary', false, 2000));
  const finalIssue = system.consumeVictoryIssue({
    round: 51, worldYear: 2000, dateLabel: 'Boundary', nationId: 'human', victoryType: 'cultural',
  });
  const archive = system.getIssues();
  assert.equal(archive.length, 1);
  assert.equal(archive[0]?.id, finalIssue.id);
  assert.equal(archive[0]?.issueType, 'victory');
  assert.equal(finalIssue.coverageStartRound, 41);
});

test('old cursor-only saves start with an empty archive and publish future issues', () => {
  const system = harness([], undefined, { lastConsumedIssueRound: 21 }, 21);
  assert.deepEqual(system.getIssues(), []);
  assert.ok(system.consumeDueIssue(31, 'Future'));
  assert.equal(system.getIssues().length, 1);
});

test('suppressed presentation still archives the generated issue', () => {
  const system = harness([event(1, 'peace', 8, ['high', 'low'])]);
  assert.equal(system.consumeDueIssue(11, 'Date', true), null);
  assert.equal(system.getIssues().length, 1);
});

test('archive readers cannot mutate stored snapshots', () => {
  const system = harness([event(1, 'peace', 8, ['high', 'low'])]);
  system.consumeDueIssue(11, 'Date');
  const selected = system.getIssues();
  selected[0]!.mainArticle.headline = 'MUTATED';
  selected[0]!.mainArticle.involvedNationNames.push('MUTATED');
  assert.notEqual(system.getIssues()[0]?.mainArticle.headline, 'MUTATED');
  assert.equal(system.getIssues()[0]?.mainArticle.involvedNationNames.includes('MUTATED'), false);
});
