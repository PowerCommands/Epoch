import assert from 'node:assert/strict';
import test from 'node:test';
import { HistoricalMapRecorder, decodeOwnership } from '../src/systems/HistoricalMapRecorder';
import { HistoricalTimelineService } from '../src/systems/HistoricalTimelineService';
import { WorldHistoryMilestones } from '../src/systems/WorldHistoryMilestones';
import { NewspaperSystem } from '../src/systems/NewspaperSystem';
import { WORLD_FIRSTS, WORLD_ERAS } from '../src/data/worldHistory';
import { SCOUT_BOAT, FIGHTER, ATOMIC_BOMB, NUCLEAR_MISSILE } from '../src/data/units';
import { getBuildingById } from '../src/data/buildings';
import { TileType, type MapData } from '../src/types/map';
import { historyFrames, mapAtRound } from '../src/ui/HistoryTimelineViewer';
import type { Producible } from '../src/types/producible';
import type { Era } from '../src/data/technologies';
import { existsSync } from 'node:fs';

function harness() {
  let round = 1;
  const map: MapData = { width: 4, height: 2, tileSize: 32, tiles: Array.from({ length: 2 }, (_, y) => Array.from({ length: 4 }, (_, x) => ({ x, y, type: TileType.Plains, ownerId: x < 2 ? 'a' : undefined }))) };
  const nations = [{ id: 'a', name: 'Alpha', color: 0xff0000 }, { id: 'b', name: 'Beta', color: 0x0000ff }];
  const history = new HistoricalTimelineService(() => round, () => `Year ${round}`, id => nations.find(n => n.id === id)?.name);
  const recorder = new HistoricalMapRecorder(map, () => nations, () => ({ round, year: round, dateLabel: `Year ${round}`, eventId: history.getEvents()[history.getEvents().length - 1]?.id ?? 0 }));
  history.onRecorded(e => recorder.observe(e));
  const news = NewspaperSystem.forNewGame({ humanNationId: 'a', seed: 'test', getTimelineEvents: () => history.getEvents(), getNationName: id => nations.find(n => n.id === id)?.name, getLeaderName: () => undefined, getWorldEra: () => 'ancient', getDominationRanking: () => ['a', 'b'] });
  return { map, history, recorder, news, nations, advance: (value: number) => { round = value; } };
}

test('compact initial ownership, five-round cadence, transition recording, no state mutation', () => {
  const h = harness(); const original = JSON.stringify(h.map);
  h.recorder.initialize();
  assert.deepEqual(h.recorder.getState().snapshots[0].owners, [1, 2, 0, 2, 1, 2, 0, 2]);
  for (let round = 2; round <= 11; round++) { h.advance(round); h.recorder.interval(round); }
  assert.deepEqual(h.recorder.getState().snapshots.map(s => s.round), [1, 6, 11]);
  assert.equal(JSON.stringify(h.map), original);
  h.advance(12); h.map.tiles[0][0].ownerId = 'b';
  h.history.record({ type: 'cityCaptured', icon: '', text: 'Beta captured a city', eventNationIds: ['b', 'a'] });
  assert.equal(decodeOwnership(h.recorder.getState().snapshots[3])[0], 2);
  const before = h.recorder.getState(); h.recorder.getCurrentHistory();
  assert.deepEqual(h.recorder.getState(), before);
});

test('save round-trip retains colors and history after elimination; missing/corrupt history begins now', () => {
  const h = harness(); h.recorder.initialize(); h.advance(17); h.recorder.record();
  const saved = h.recorder.getState(); h.nations.splice(0, 1);
  h.recorder.initialize(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(h.recorder.getState(), saved);
  const corrupt = [undefined, null, {}, { ...saved, width: 999 }, { ...saved, snapshots: [null] },
    { ...saved, snapshots: [{ ...saved.snapshots[0], owners: [999, 8] }] },
    { ...saved, snapshots: [{ ...saved.snapshots[0], owners: [0, -8] }] }];
  for (const value of corrupt) {
    h.recorder.initialize(value);
    assert.deepEqual(h.recorder.getState().snapshots.map(s => s.round), [17]);
  }
});

test('viewer preserves within-round map changes and never uses future borders for intermediate news', () => {
  const h = harness(); h.recorder.initialize(); h.advance(2);
  h.history.record({ type: 'firstContact', icon: '', text: 'Contact', eventNationIds: ['a', 'b'] });
  h.map.tiles[0][0].ownerId = 'b';
  h.history.record({ type: 'cityCaptured', icon: '', text: 'Captured', eventNationIds: ['b', 'a'] });
  h.map.tiles[0][0].ownerId = 'a';
  h.history.record({ type: 'cityLiberated', icon: '', text: 'Liberated', eventNationIds: ['a', 'b'] });
  const state = h.recorder.getState(); const frames = historyFrames(state, h.history.getEvents());
  const eventFrames = frames.filter(f => f.events.length);
  assert.deepEqual(eventFrames.map(f => decodeOwnership(state.snapshots[f.snapshotIndex])[0]), [1, 2, 1]);
  assert.equal(mapAtRound(state, 1).round, 1);
});

const items: Producible[] = [SCOUT_BOAT, FIGHTER, ATOMIC_BOMB, NUCLEAR_MISSILE].map(unitType => ({ kind: 'unit', unitType }));
items.push({ kind: 'building', buildingType: getBuildingById('hospital')! });

test('all five world-firsts publish once globally, include attribution/art, and survive reload', () => {
  const h = harness(); const milestones = new WorldHistoryMilestones(h.history);
  milestones.initialize(undefined, [], 'ancient');
  for (const item of items) { milestones.completed('a', 'Alpha City', item); milestones.completed('b', 'Beta City', item); }
  assert.equal(h.history.getEvents().length, 5);
  for (const event of h.history.getEvents()) {
    assert.equal(event.type, 'worldFirst');
    const article = h.news.articleForHistory(event);
    assert.match(article.body, /Alpha.*Alpha City/);
    assert.ok(existsSync(`public${article.imagePath}`));
    assert.equal(event.round, 1); assert.equal(event.newsImportance, 0);
  }
  const restored = new WorldHistoryMilestones(h.history); restored.initialize(milestones.getState(), [], 'ancient');
  for (const item of items) restored.completed('b', 'Beta', item);
  assert.equal(h.history.getEvents().length, 5);
  assert.equal(WORLD_FIRSTS.length, 5);
});

test('existing scenario/legacy assets establish baseline without invented milestone articles', () => {
  const h = harness(); const milestones = new WorldHistoryMilestones(h.history);
  milestones.initialize(undefined, items, 'modern');
  for (const item of items) milestones.completed('b', 'Beta', item);
  milestones.reachedEra('b', 'industrial');
  assert.equal(h.history.getEvents().length, 0);
  milestones.reachedEra('b', 'atomic'); assert.equal(h.history.getEvents().length, 1);
});

test('every new era produces a single global article while national era news is retained', () => {
  const h = harness(); const milestones = new WorldHistoryMilestones(h.history);
  milestones.initialize(undefined, [], 'ancient');
  for (const era of Object.keys(WORLD_ERAS) as Era[]) {
    milestones.reachedEra('a', era); milestones.reachedEra('b', era);
  }
  assert.equal(h.history.getEvents().length, 8);
  assert.ok(h.news.articleForHistory(h.history.getEvents()[3]).body.includes('On the horizon:'));
  h.history.record({ type: 'eraReached', icon: '', text: 'Alpha reached industrial', eventNationIds: ['a'], metadata: { eraName: 'industrial' } });
  assert.equal(h.history.getEvents()[8].type, 'eraReached');
  assert.ok(h.news.consumeDueIssue(11, 'Date')?.mainArticle.headline);
});

test('newspaper archive is reused, unselected chronicle events remain available, reads do not consume issues', () => {
  const h = harness(); h.history.record({ type: 'warDeclared', icon: '', text: 'War', eventNationIds: ['a', 'b'] });
  const event = h.history.getEvents()[0]; const issue = h.news.consumeDueIssue(11, 'Date')!;
  const before = h.news.getState();
  assert.deepEqual(h.news.articleForHistory(event), issue.mainArticle);
  h.history.record({ type: 'worldCouncilMeeting', icon: '', text: 'Council meets', eventNationIds: ['a'] });
  assert.equal(h.news.articleForHistory(h.history.getEvents()[1]).body, 'Council meets');
  assert.deepEqual(h.news.getState(), before);
});

test('presentation events do not shift simulation seed sequence, including after save/load', () => {
  const h = harness();
  const input = { type: 'cityFounded' as const, icon: '', text: 'Founded', eventNationIds: ['a'] };
  h.history.record(input);
  const milestones = new WorldHistoryMilestones(h.history); milestones.initialize(undefined, [], 'ancient');
  milestones.completed('a', 'City', items[0]);
  h.history.record(input);
  assert.deepEqual(h.history.getEvents().map(e => e.simulationEventId), [1, undefined, 2]);
  h.history.restore(h.history.serialize()); h.history.record(input);
  assert.equal(h.history.getEvents()[3].simulationEventId, 3);
});

test('large uniform maps and thousands of turns remain compact', () => {
  const h = harness(); h.map.width = 100; h.map.height = 100;
  h.map.tiles = Array.from({ length: 100 }, (_, y) => Array.from({ length: 100 }, (_, x) => ({ x, y, type: TileType.Plains, ownerId: 'a' })));
  h.recorder.initialize();
  for (let round = 2; round <= 1001; round++) { h.advance(round); h.recorder.interval(round); }
  assert.equal(h.recorder.getState().snapshots.length, 201);
  assert.ok(JSON.stringify(h.recorder.getState()).length < 25000);
});

test('unpublished war art retains the era at the event instead of the viewer era', () => {
  let era: Era = 'ancient';
  const history = new HistoricalTimelineService(() => 1, () => 'Date', id => id, undefined, () => era);
  history.record({ type: 'warDeclared', icon: '', text: 'War', eventNationIds: ['a', 'b'] });
  era = 'future';
  const newspaper = NewspaperSystem.forNewGame({ humanNationId: 'a', seed: 'art', getTimelineEvents: () => history.getEvents(),
    getNationName: id => id, getLeaderName: () => undefined, getWorldEra: () => era, getDominationRanking: () => [] });
  assert.match(newspaper.articleForHistory(history.getEvents()[0]).imagePath!, /war-start-ancient/);
});
