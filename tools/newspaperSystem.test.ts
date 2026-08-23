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

test('every recurring event definition has exactly ten comments', () => {
  for (const definition of Object.values(NEWSPAPER_EVENT_DEFINITIONS)) {
    assert.equal(definition.comments.length, 10);
  }
});
