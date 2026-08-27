import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import type {
  ScenarioData,
  ScenarioWorldWarHistoricalEvent,
} from '../src/types/scenario';

const WORLD_WAR: ScenarioWorldWarHistoricalEvent = {
  id: 'historical-event-world-war-ii',
  type: 'worldWar',
  name: 'World War II',
  description: 'test description',
  startYear: 1939,
  startMonth: 9,
  startYearIsBC: false,
  conflicts: [
    { nationAId: 'nation_germany', nationBId: 'nation_poland' },
    { nationAId: 'nation_germany', nationBId: 'nation_england' },
  ],
  endConditionNationId: 'nation_germany',
};

function scenarioWith(events?: ScenarioData['historicalEvents']): ScenarioData {
  return {
    meta: { name: 'Historical events test', version: 1, startYear: 1920, startYearIsBC: false },
    map: { width: 1, height: 1, tileSize: 64, tiles: [{ q: 0, r: 0, type: 'plains' }] },
    nations: [
      { id: 'nation_germany', name: 'Germany', color: '#222222', isHuman: false, startTerritoryCenter: { q: 0, r: 0 } },
      { id: 'nation_poland', name: 'Poland', color: '#d4213d', isHuman: true, startTerritoryCenter: { q: 0, r: 0 } },
      { id: 'nation_england', name: 'England', color: '#dd203f', isHuman: false, startTerritoryCenter: { q: 0, r: 0 } },
    ],
    cities: [],
    units: [],
    worldMarkers: [{ id: 'marker_test', type: 'islandDiscovery', name: 'Test', x: 0, y: 0, radius: 1 }],
    nationDetails: {
      nation_germany: { researchedTechIds: ['writing'], unlockedCultureNodeIds: [] },
    },
    initialDiplomacy: [],
    ...(events === undefined ? {} : { historicalEvents: events }),
  };
}

test('older scenarios without historicalEvents load as an empty authored-event list', () => {
  const parsed = ScenarioLoader.parse(scenarioWith());
  assert.deepEqual(parsed.historicalEvents, []);
});

test('World War definitions retain dates, stable nation IDs, conflicts, and event ID through JSON and loading', () => {
  const serialized = JSON.stringify(scenarioWith([WORLD_WAR]));
  const restored = JSON.parse(serialized) as ScenarioData;
  assert.deepEqual(restored.historicalEvents, [WORLD_WAR]);

  const parsed = ScenarioLoader.parse(restored);
  assert.deepEqual(parsed.historicalEvents, [WORLD_WAR]);
  assert.equal(parsed.historicalEvents[0].startMonth, 9);
  assert.equal(parsed.historicalEvents[0].id, 'historical-event-world-war-ii');
});

test('authored World War definitions contain no runtime lifecycle state', () => {
  assert.deepEqual(Object.keys(WORLD_WAR).sort(), [
    'conflicts',
    'description',
    'endConditionNationId',
    'id',
    'name',
    'startMonth',
    'startYear',
    'startYearIsBC',
    'type',
  ]);
});

test('standalone editor exposes complete World War authoring and preserves scenario-level data', () => {
  const editor = fs.readFileSync('public/editor.html', 'utf8');
  for (const id of [
    'sd-add-event-btn',
    'sd-events-list',
    'historical-event-overlay',
    'he-type',
    'he-name',
    'he-description',
    'he-start-month',
    'he-start-year',
    'he-start-era',
    'he-conflict-a',
    'he-conflict-b',
    'he-add-conflict-btn',
    'he-end-condition-nation',
  ]) {
    assert.match(editor, new RegExp(`id="${id}"`), id);
  }

  assert.match(editor, /HISTORICAL_EVENT_MONTHS[\s\S]*'September'/);
  assert.match(editor, /scenarioWorldWarConflictKey/);
  assert.match(editor, /reversed nation order counts as the same conflict/);
  assert.match(editor, /starts before the scenario start date/);
  assert.match(editor, /end-condition nation does not participate in any listed conflict/);
  assert.match(editor, /scenarioDetailsHistoricalEventsDraft = structuredCloneCompat\(scenario\.historicalEvents \|\| \[\]\)/);
  assert.match(editor, /historicalEventEditingIndex === null[\s\S]*scenarioDetailsHistoricalEventsDraft\[historicalEventEditingIndex\]/);

  const outputFunction = editor.slice(editor.indexOf('function buildScenarioOutput()'), editor.indexOf('// ─── Scenario Details dialog'));
  assert.match(outputFunction, /\.\.\.scenario/);
  assert.match(outputFunction, /worldMarkers: scenario\.worldMarkers/);
  assert.match(outputFunction, /nationDetails/);
  assert.match(outputFunction, /initialDiplomacy/);
  assert.match(outputFunction, /historicalEvents: structuredCloneCompat/);
});

test('standalone editor does not add runtime World War behavior', () => {
  const editor = fs.readFileSync('public/editor.html', 'utf8');
  const historicalEventSection = editor.slice(editor.indexOf('function scenarioHistoricalDateOrdinal'), editor.indexOf('document.getElementById(\'back-to-menu-btn\')'));
  assert.doesNotMatch(historicalEventSection, /declareWar|triggeredTurn|completedTurn|HistoricalTimelineService|Chronicle/);
});
