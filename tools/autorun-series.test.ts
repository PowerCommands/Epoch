/**
 * Focused unit tests for the pure report-building helpers.
 * Run with:  npx tsx --test tools/autorun-series.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  type BlockResult,
  type GameSave,
  type SeriesRunContext,
  type TimelineEvent,
  buildDiagnostics,
  buildSeriesReportModel,
  categorizeTimeline,
  checkpointFileName,
  computeEliminatedNations,
  computeRosterAttrition,
  prettifyResolutionId,
  renderSeriesReportMarkdown,
  summarizeCouncil,
} from './autorun-series-report.ts';

function timelineEvent(partial: Partial<TimelineEvent> & Pick<TimelineEvent, 'id' | 'type' | 'round'>): TimelineEvent {
  return { text: `event ${partial.id}`, dateLabel: 'January 100', ...partial };
}

test('categorizeTimeline counts every type and highlights only important ones', () => {
  const timeline: TimelineEvent[] = [
    timelineEvent({ id: 1, type: 'cityFounded', round: 1 }),
    timelineEvent({ id: 2, type: 'warDeclared', round: 5 }),
    timelineEvent({ id: 3, type: 'scoutMoved', round: 6 }), // unknown -> counted, not highlighted
    timelineEvent({ id: 4, type: 'peace', round: 8 }),
  ];
  const { events, counts } = categorizeTimeline(timeline);
  assert.equal(counts.cityFounded, 1);
  assert.equal(counts.warDeclared, 1);
  assert.equal(counts.scoutMoved, 1);
  assert.equal(events.length, 3); // cityFounded, warDeclared, peace
  assert.ok(!events.some((e) => e.type === 'scoutMoved'));
  // sorted by round
  assert.deepEqual(events.map((e) => e.round), [1, 5, 8]);
});

test('prettifyResolutionId humanises ids', () => {
  assert.equal(prettifyResolutionId('defense_support'), 'Defense Support');
  assert.equal(prettifyResolutionId('ceasefire_resolution'), 'Ceasefire');
  assert.equal(prettifyResolutionId('international_sanctions'), 'International Sanctions');
});

test('summarizeCouncil aggregates proposals, votes, and donations', () => {
  const save: GameSave = {
    worldCouncil: {
      organizationKind: 'un',
      status: 'active',
      foundingTurn: 300,
      memberNationIds: ['a', 'b', 'c'],
      meetings: [
        {
          id: 1, kind: 'emergency', turn: 305,
          proposals: [
            {
              resolutionId: 'defense_support', resolved: true, passed: true,
              donations: [{ nationId: 'a', gold: 100 }, { nationId: 'b', gold: 50 }],
            },
            { resolutionId: 'international_sanctions', resolved: true, passed: false, donations: [] },
          ],
        },
        {
          id: 2, kind: 'regular', turn: 320,
          proposals: [
            { resolutionId: 'defense_support', resolved: true, passed: true, donations: [{ nationId: 'a', gold: 25 }] },
          ],
        },
      ],
    },
  };
  const summary = summarizeCouncil(save);
  assert.equal(summary.founded, true);
  assert.equal(summary.meetingCount, 2);
  assert.equal(summary.resolutionsProposed, 3);
  assert.equal(summary.resolutionsPassed, 2);
  assert.equal(summary.resolutionsRejected, 1);
  assert.equal(summary.resolutionsByType.defense_support, 2);
  assert.equal(summary.defenseSupportGoldByNation.a, 125);
  assert.equal(summary.defenseSupportGoldByNation.b, 50);
  assert.equal(summary.totalDonatedGoldByNation.a, 125);
});

test('summarizeCouncil handles an absent council', () => {
  const summary = summarizeCouncil({ worldCouncil: null });
  assert.equal(summary.founded, false);
  assert.equal(summary.resolutionsProposed, 0);
});

test('computeEliminatedNations finds active nations with no cities', () => {
  const save: GameSave = {
    activeNationIds: ['a', 'b', 'c'],
    cities: [{ id: 'c1', ownerId: 'a' }, { id: 'c2', ownerId: 'c' }],
  };
  assert.deepEqual(computeEliminatedNations(save), ['b']);
});

test('computeRosterAttrition finds nations dropped from the roster', () => {
  const first = [
    { id: 'a', name: 'A', isHuman: false, era: 'ancient', technologyCount: 0, cultureNodeCount: 0, currentResearch: null, currentCulture: null, cityCount: 1, population: 1 },
    { id: 'b', name: 'B', isHuman: false, era: 'ancient', technologyCount: 0, cultureNodeCount: 0, currentResearch: null, currentCulture: null, cityCount: 1, population: 1 },
    { id: 'c', name: 'C', isHuman: false, era: 'ancient', technologyCount: 0, cultureNodeCount: 0, currentResearch: null, currentCulture: null, cityCount: 1, population: 1 },
  ];
  const final = [first[0], first[2]];
  assert.deepEqual(computeRosterAttrition(first, final), ['b']);
});

test('checkpointFileName uses actual final turn, falls back on unknown', () => {
  assert.equal(checkpointFileName(201, 2), 'checkpoint-turn-201.json');
  assert.equal(checkpointFileName(undefined, 3), 'checkpoint-block-003-unknown-turn.json');
});

test('buildDiagnostics flags runaways, no-war, and resolution monoculture', () => {
  const nations = [
    { id: 'a', name: 'Alpha', isHuman: false, era: 'modern', technologyCount: 40, cultureNodeCount: 30, currentResearch: null, currentCulture: null, cityCount: 8, population: 100 },
    { id: 'b', name: 'Beta', isHuman: false, era: 'classical', technologyCount: 20, cultureNodeCount: 10, currentResearch: null, currentCulture: null, cityCount: 3, population: 40 },
  ];
  const council = summarizeCouncil({
    worldCouncil: {
      foundingTurn: 300, meetings: [
        { id: 1, kind: 'regular', turn: 300, proposals: [
          { resolutionId: 'defense_support', resolved: true, passed: true },
          { resolutionId: 'defense_support', resolved: true, passed: true },
          { resolutionId: 'defense_support', resolved: true, passed: true },
          { resolutionId: 'defense_support', resolved: true, passed: true },
        ] },
      ],
    },
  });
  const notes = buildDiagnostics([], nations, council, { warDeclared: 0 });
  assert.ok(notes.some((n) => n.includes('Technology runaway')));
  assert.ok(notes.some((n) => n.includes('Culture runaway')));
  assert.ok(notes.some((n) => n.includes('No wars')));
  assert.ok(notes.some((n) => n.includes('Resolution monoculture')));
});

test('buildSeriesReportModel + markdown render end-to-end', () => {
  const blockSave: GameSave = {
    activeNationIds: ['a', 'b'],
    nations: [
      { id: 'a', influence: 500, gold: 200, culture: 999, aiStrategyId: 'aggressive', aiNationalAgendaId: 'naval_power' },
      { id: 'b', influence: 100, gold: 50 },
    ],
    cities: [{ id: 'c1', ownerId: 'a' }],
    diplomacy: [{ nationA: 'a', nationB: 'b', state: 'WAR' }],
    wonders: [{ wonderId: 'stonehenge', ownerId: 'a', completedTurn: 70 }],
    tradeConnections: [{}, {}],
    tradeDeals: [{}],
    worldCouncil: { foundingTurn: 90, organizationKind: 'world_council', status: 'active', memberNationIds: ['a', 'b'], meetings: [] },
    historicalTimeline: [
      timelineEvent({ id: 1, type: 'cityFounded', round: 1, text: 'A founded Capital' }),
      timelineEvent({ id: 2, type: 'warDeclared', round: 40, text: 'A declared war on B' }),
      timelineEvent({ id: 3, type: 'cityCaptured', round: 45, text: 'A captured B City' }),
      timelineEvent({ id: 4, type: 'worldCouncilFounded', round: 90, text: 'A founded the World Council' }),
    ],
  };
  const block: BlockResult = {
    blockNumber: 1,
    dir: 'block-001',
    exitCode: 0,
    save: blockSave,
    metadata: {
      scenario: 'map_maritime_expansion', requestedTurns: 100, completedTurns: 100,
      timestamp: '2026-01-01T00:00:00Z', success: true, durationMs: 60_000,
      startingTurn: 1, startingYear: -4000, finalTurn: 101, finalYear: 500,
      victoryDetected: false,
      stateSummary: {
        currentRound: 101, nationCount: 2, cityCount: 1, unitCount: 10,
        worldYearLabel: 'January 500',
        nations: [
          { id: 'a', name: 'Alpha', isHuman: true, era: 'classical', technologyCount: 15, cultureNodeCount: 12, currentResearch: 'Theology', currentCulture: 'Drama', cityCount: 1, population: 20 },
          { id: 'b', name: 'Beta', isHuman: false, era: 'ancient', technologyCount: 8, cultureNodeCount: 5, currentResearch: null, currentCulture: null, cityCount: 0, population: 0 },
        ],
      },
    },
    checkpointFile: 'checkpoint-turn-101.json',
  };
  const ctx: SeriesRunContext = {
    scenario: 'map_maritime_expansion', maxTurns: 800, blockSize: 100,
    enabledVictoryConditions: ['domination', 'science', 'cultural', 'diplomatic'],
    blocks: [block], totalDurationMs: 60_000, endReason: 'max-turns',
    generatedAt: '2026-07-17T00:00:00Z',
  };
  const model = buildSeriesReportModel(ctx);

  assert.equal(model.testSummary.scenario, 'map_maritime_expansion');
  assert.equal(model.testSummary.actualTurnsCompleted, 100);
  assert.equal(model.eventCounts.wars, 1);
  assert.equal(model.eventCounts.cityCaptures, 1);
  assert.equal(model.eventCounts.cityFoundations, 1);
  assert.equal(model.eventCounts.eliminatedNations, 1); // 'b' has no cities
  assert.equal(model.finalWorldState.nations.find((n) => n.id === 'b')?.eliminated, true);
  assert.equal(model.finalWorldState.wars.length, 1);
  assert.equal(model.finalWorldState.wondersCompleted, 1);
  assert.equal(model.nationProgression[0].nations.find((n) => n.id === 'a')?.influence, 500);

  const md = renderSeriesReportMarkdown(model, new Map([['a', 'Alpha'], ['b', 'Beta']]));
  assert.ok(md.includes('# Maritime Expansion'));
  assert.ok(md.includes('## 1. Test summary'));
  assert.ok(md.includes('## 7. Diagnostic observations'));
  assert.ok(md.includes('Alpha ⚔ Beta'));
});
