import assert from 'node:assert/strict';
import test from 'node:test';

import { Nation } from '../src/entities/Nation';
import { createAIWarDeclarationDialogueRequest } from '../src/systems/ai/AIWarDeclarationDialogue';
import { AllianceManager } from '../src/systems/diplomacy/AllianceManager';
import { DiplomacyManager } from '../src/systems/DiplomacyManager';
import { HistoricalTimelineService } from '../src/systems/HistoricalTimelineService';
import { NewspaperSystem } from '../src/systems/NewspaperSystem';
import { NationManager } from '../src/systems/NationManager';
import { ScenarioHistoricalEventPresentationSystem } from '../src/systems/ScenarioHistoricalEventPresentationSystem';
import {
  ScenarioHistoricalEventSystem,
  type SavedScenarioHistoricalEventsState,
} from '../src/systems/ScenarioHistoricalEventSystem';
import { TurnManager } from '../src/systems/TurnManager';
import type { AIDiplomacyDecisionReason } from '../src/types/aiDiplomacy';
import type { HistoricalEvent } from '../src/types/historicalTimeline';
import type { ScenarioWorldWarHistoricalEvent } from '../src/types/scenario';
import type { WorldWarAnnouncement } from '../src/systems/ScenarioHistoricalEventPresentationSystem';

const GERMANY = 'germany';
const ENGLAND = 'england';
const FRANCE = 'france';
const ITALY = 'italy';
const POLAND = 'poland';
const SWEDEN = 'sweden';
const NAMES: Record<string, string> = {
  [GERMANY]: 'Germany', [ENGLAND]: 'England', [FRANCE]: 'France',
  [ITALY]: 'Italy', [POLAND]: 'Poland', [SWEDEN]: 'Sweden',
};

function definition(overrides: Partial<ScenarioWorldWarHistoricalEvent> = {}): ScenarioWorldWarHistoricalEvent {
  return {
    id: 'world-war-ii',
    type: 'worldWar',
    name: 'World War II',
    description: "Germany's invasion of Poland has plunged Europe into war.",
    startYear: 1939,
    startMonth: 9,
    startYearIsBC: false,
    conflicts: [
      { nationAId: GERMANY, nationBId: POLAND },
      { nationAId: GERMANY, nationBId: ENGLAND },
      { nationAId: GERMANY, nationBId: FRANCE },
      { nationAId: ITALY, nationBId: ENGLAND },
      { nationAId: ITALY, nationBId: FRANCE },
    ],
    endConditionNationId: GERMANY,
    ...overrides,
  };
}

function harness(events = [definition()], collectAnnouncements = true) {
  const nations = new NationManager();
  for (const id of Object.keys(NAMES)) nations.addNation(new Nation({ id, name: NAMES[id]!, color: 0 }));
  const turns = new TurnManager(nations, undefined, {
    name: 'Presentation', version: 1, startYear: 1938, startYearIsBC: false,
    timeProgression: { mode: 'staticYear', staticYearStep: 2 },
  });
  const diplomacy = new DiplomacyManager(turns);
  const alliances = new AllianceManager();
  const timeline = new HistoricalTimelineService(
    () => turns.getCurrentRound(),
    () => turns.getGameDateLabel(),
    (id) => NAMES[id],
  );
  const runtime = new ScenarioHistoricalEventSystem(events, turns, diplomacy, alliances, {
    isNationActive: (id) => nations.getNation(id) !== undefined,
    isNationEliminated: (id) => nations.getNation(id) === undefined,
    getNationName: (id) => NAMES[id] ?? id,
    log: () => {},
  });
  const presentation = new ScenarioHistoricalEventPresentationSystem(runtime, timeline, {
    humanNationId: ENGLAND,
    getNationName: (id) => NAMES[id] ?? id,
  });
  const announcements: WorldWarAnnouncement[] = [];
  if (collectAnnouncements) {
    presentation.onAnnouncement((announcement) => announcements.push(announcement));
  }
  const advanceRound = () => {
    const round = turns.getCurrentRound();
    while (turns.getCurrentRound() === round) turns.endCurrentTurn();
  };
  return { nations, turns, diplomacy, timeline, runtime, presentation, announcements, advanceRound };
}

function worldWarHistory(events: readonly HistoricalEvent[], type: 'worldWarStarted' | 'worldWarEnded') {
  return events.filter((event) => event.type === type);
}

test('A/B: activation emits one announcement and one major History/Chronicle candidate for five wars', () => {
  const h = harness();
  h.turns.start();
  h.advanceRound();
  assert.equal(h.announcements.length, 1);
  assert.equal(h.announcements[0].kind, 'started');
  assert.equal(h.announcements[0].conflicts.length, 5);
  assert.equal(h.announcements[0].description, definition().description);
  const history = worldWarHistory(h.timeline.getEvents(), 'worldWarStarted');
  assert.equal(history.length, 1);
  assert.equal(history[0].text, 'World War II begins');
  assert.equal(history[0].newsImportance, 0);
  for (let i = 0; i < 3; i += 1) h.advanceRound();
  assert.equal(h.announcements.length, 1);
  assert.equal(worldWarHistory(h.timeline.getEvents(), 'worldWarStarted').length, 1);
});

test('configured conflict overview removes symmetric duplicates without changing mechanics', () => {
  const event = definition({
    conflicts: [
      { nationAId: GERMANY, nationBId: ENGLAND },
      { nationAId: ENGLAND, nationBId: GERMANY },
    ],
  });
  const h = harness([event]);
  h.turns.start();
  h.advanceRound();
  assert.equal(h.announcements[0].conflicts.length, 1);
  assert.equal(h.diplomacy.getState(GERMANY, ENGLAND), 'WAR');
});

test('C: multiple historical conflicts involving the human consolidate into one source-aware announcement', () => {
  const h = harness();
  const sources: string[] = [];
  h.diplomacy.onWarDeclared((_a, _b, metadata) => sources.push(metadata.source));
  h.turns.start();
  h.advanceRound();
  assert.equal(h.announcements.length, 1);
  assert.equal(h.announcements[0].humanInvolved, true);
  assert.deepEqual(new Set(sources), new Set(['scenarioHistoricalEvent']));
  assert.equal(sources.length, 5);
});

test('D: an ordinary AI-to-human war decision still creates its leader-specific request', () => {
  const decision: AIDiplomacyDecisionReason = {
    action: 'declareWar', actorNationId: 'nation_england', targetNationId: 'nation_sweden',
    attitude: 'hostile', militaryComparison: 'stronger', threatLevel: 'none', relationState: 'PEACE',
    trust: 5, fear: 5, hostility: 90, affinity: 0, suspicion: 30,
    warDeclarationReason: 'hostility', reasonText: 'ordinary AI decision',
  };
  assert.ok(createAIWarDeclarationDialogueRequest(decision, 'nation_sweden', 10));
});

test('E: completion by peace emits factual ending presentation and History', () => {
  const event = definition({ conflicts: [{ nationAId: GERMANY, nationBId: ENGLAND }] });
  const h = harness([event]);
  h.turns.start();
  h.advanceRound();
  assert.equal(h.diplomacy.enforceCeasefire(GERMANY, ENGLAND, 1), true);
  h.advanceRound();
  const ending = h.announcements.find((announcement) => announcement.kind === 'completed')!;
  assert.equal(ending.completionReason, 'peace');
  assert.equal(ending.completionMessage, 'Germany is no longer at war with any nation.');
  assert.equal(ending.timelineMessage, 'Normal historical time progression has resumed.');
  assert.equal(worldWarHistory(h.timeline.getEvents(), 'worldWarEnded').length, 1);
});

test('F: completion by canonical elimination emits only known factual wording', () => {
  const event = definition({ conflicts: [{ nationAId: GERMANY, nationBId: ENGLAND }] });
  const h = harness([event]);
  h.turns.start();
  h.advanceRound();
  h.nations.removeNation(GERMANY);
  h.turns.removeNation(GERMANY);
  h.advanceRound();
  const ending = h.announcements.find((announcement) => announcement.kind === 'completed')!;
  assert.equal(ending.completionReason, 'elimination');
  assert.equal(ending.completionMessage, 'Germany has been eliminated.');
  assert.equal(worldWarHistory(h.timeline.getEvents(), 'worldWarEnded')[0].metadata?.worldWarCompletionReason, 'elimination');
});

test('G/H: restoring active or completed state emits no replay announcement or History entry', () => {
  const active = harness([definition({ conflicts: [{ nationAId: GERMANY, nationBId: ENGLAND }] })]);
  active.turns.start();
  active.advanceRound();
  const activeSave = JSON.parse(JSON.stringify(active.runtime.serialize())) as SavedScenarioHistoricalEventsState;

  const loadedActive = harness([definition({ conflicts: [{ nationAId: GERMANY, nationBId: ENGLAND }] })]);
  loadedActive.turns.restoreTurnState(active.turns.getCurrentRound(), 0);
  loadedActive.runtime.restore(activeSave);
  loadedActive.turns.start();
  assert.equal(loadedActive.announcements.length, 0);
  assert.equal(loadedActive.timeline.getEvents().length, 0);

  active.diplomacy.enforceCeasefire(GERMANY, ENGLAND, 1);
  active.advanceRound();
  const completedSave = JSON.parse(JSON.stringify(active.runtime.serialize())) as SavedScenarioHistoricalEventsState;
  const loadedCompleted = harness([definition({ conflicts: [{ nationAId: GERMANY, nationBId: ENGLAND }] })]);
  loadedCompleted.turns.restoreTurnState(active.turns.getCurrentRound(), 0);
  loadedCompleted.runtime.restore(completedSave);
  loadedCompleted.turns.start();
  assert.equal(loadedCompleted.announcements.length, 0);
  assert.equal(loadedCompleted.timeline.getEvents().length, 0);
});

test('I: overlapping endings identify whether monthly progression remains active', () => {
  const a = definition({ id: 'a', name: 'War A', startMonth: 9, conflicts: [{ nationAId: GERMANY, nationBId: ENGLAND }], endConditionNationId: GERMANY });
  const b = definition({ id: 'b', name: 'War B', startMonth: 10, conflicts: [{ nationAId: ITALY, nationBId: FRANCE }], endConditionNationId: ITALY });
  const h = harness([a, b]);
  h.turns.start();
  h.advanceRound();
  h.advanceRound();
  assert.equal(h.runtime.getActiveWorldWars().length, 2);
  h.diplomacy.enforceCeasefire(GERMANY, ENGLAND, 1);
  h.advanceRound();
  const aEnding = h.announcements.find((announcement) => announcement.kind === 'completed' && announcement.eventId === 'a')!;
  assert.match(aEnding.timelineMessage, /monthly progression continues/);
  h.diplomacy.enforceCeasefire(ITALY, FRANCE, 1);
  h.advanceRound();
  const bEnding = h.announcements.find((announcement) => announcement.kind === 'completed' && announcement.eventId === 'b')!;
  assert.equal(bEnding.timelineMessage, 'Normal historical time progression has resumed.');
});

test('J: World War outranks ordinary events and uses authored Chronicle content plus generic war image', () => {
  const h = harness([definition({ conflicts: [{ nationAId: GERMANY, nationBId: ENGLAND }] })]);
  h.timeline.record({ type: 'nationEliminated', icon: '', text: 'Ordinary candidate', eventNationIds: [SWEDEN] });
  h.turns.start();
  h.advanceRound();
  const newspaper = NewspaperSystem.forNewGame({
    humanNationId: ENGLAND,
    getTimelineEvents: () => h.timeline.getEvents(),
    getDominationRanking: () => [SWEDEN, GERMANY, ENGLAND],
    getNationName: (id) => NAMES[id],
    getLeaderName: (id) => NAMES[id],
    seed: 'world-war-presentation',
  });
  const issue = newspaper.consumeDueIssue(11, 'Issue Date')!;
  assert.equal(issue.mainArticle.eventType, 'worldWarStarted');
  assert.equal(issue.mainArticle.headline, 'WORLD WAR II BEGINS');
  assert.match(issue.mainArticle.body, /Germany's invasion of Poland has plunged Europe into war\./);
  assert.match(issue.mainArticle.body, /Germany ↔ England/);
  assert.equal(issue.mainArticle.imagePath, '/assets/sprites/news/war-declared.png');
});

test('same-round integration registers World War History before the human Chronicle turnStart', () => {
  const h = harness([definition({
    startYear: 1957,
    startMonth: 1,
    conflicts: [{ nationAId: GERMANY, nationBId: ENGLAND }],
  })]);
  const newspaper = NewspaperSystem.forNewGame({
    humanNationId: ENGLAND,
    getTimelineEvents: () => h.timeline.getEvents(),
    getDominationRanking: () => [GERMANY, ENGLAND],
    getNationName: (id) => NAMES[id],
    getLeaderName: (id) => NAMES[id],
    seed: 'same-round-world-war',
  });
  let issue: ReturnType<NewspaperSystem['consumeDueIssue']> = null;
  h.turns.on('turnStart', (event) => {
    if (event.nation.id !== ENGLAND) return;
    issue = newspaper.consumeDueIssue(event.round, h.turns.getGameDateLabel());
  });

  h.turns.start();
  for (let round = 1; round < 11; round += 1) h.advanceRound();
  assert.equal(h.turns.getCurrentRound(), 11);
  assert.equal(h.runtime.hasActiveWorldWar(), true);
  assert.equal(issue, null); // Germany acts first in the harness.
  h.turns.endCurrentTurn(); // England's turnStart publishes the due issue.

  assert.equal(issue?.issueRound, 11);
  assert.equal(issue?.mainArticle.eventType, 'worldWarStarted');
  assert.equal(issue?.mainArticle.headline, 'WORLD WAR II BEGINS');
});

test('K: lifecycle and History/Chronicle generation do not depend on a UI listener', () => {
  const h = harness([definition({ conflicts: [{ nationAId: GERMANY, nationBId: ENGLAND }] })], false);
  h.turns.start();
  h.advanceRound();
  assert.equal(h.runtime.hasActiveWorldWar(), true);
  assert.equal(worldWarHistory(h.timeline.getEvents(), 'worldWarStarted').length, 1);
});
