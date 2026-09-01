import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  createLegacyTurningPointEvents,
  resolveScenarioTurningPointTriggerYears,
} from '../src/systems/scenarioTurningPoints.ts';
import type { ScenarioHistoricalEvent } from '../src/types/scenario.ts';

test('legacy scenarios retain every old trigger year', () => {
  assert.deepEqual(resolveScenarioTurningPointTriggerYears({}), {
    culturalJealousy: 1500,
    reconciliation: 1800,
    luckyLoser: 1500,
    unluckyWinner: 1914,
  });
  assert.deepEqual(createLegacyTurningPointEvents().map(({ type, startYear }) => [type, startYear]), [
    ['culturalJealousy', 1500],
    ['reconciliation', 1800],
    ['luckyLoser', 1500],
    ['unluckyWinner', 1914],
  ]);
});

test('new-format scenario event presence is authoritative and years vary by scenario', () => {
  const events: ScenarioHistoricalEvent[] = [
    { id: 'cj', type: 'culturalJealousy', name: 'Cultural Jealousy', startYear: 1777 },
    { id: 'uw', type: 'unluckyWinner', name: 'Unlucky Winner', startYear: 2050 },
  ];
  assert.deepEqual(resolveScenarioTurningPointTriggerYears({
    turningPointEventsConfigured: true,
    historicalEvents: events,
  }), {
    culturalJealousy: 1777,
    reconciliation: null,
    luckyLoser: null,
    unluckyWinner: 2050,
  });
  assert.equal(resolveScenarioTurningPointTriggerYears({
    turningPointEventsConfigured: true,
    historicalEvents: [{ ...events[0]!, startYear: 2222 }],
  }).culturalJealousy, 2222);

  const roundTrip = JSON.parse(JSON.stringify({
    turningPointEventsConfigured: true,
    historicalEvents: events,
  })) as { turningPointEventsConfigured: true; historicalEvents: ScenarioHistoricalEvent[] };
  assert.deepEqual(roundTrip.historicalEvents, events);
  assert.deepEqual(resolveScenarioTurningPointTriggerYears(roundTrip), {
    culturalJealousy: 1777,
    reconciliation: null,
    luckyLoser: null,
    unluckyWinner: 2050,
  });
});

test('the editor reuses Historical Event UI, exposes all built-ins, hides irrelevant fields, and rejects duplicates', () => {
  const editor = fs.readFileSync('public/editor.html', 'utf8');
  for (const type of ['culturalJealousy', 'reconciliation', 'luckyLoser', 'unluckyWinner']) {
    assert.match(editor, new RegExp(`<option value="${type}">`));
  }
  assert.match(editor, /Only its trigger year is configured by the scenario/);
  assert.match(editor, /he-name-field'\)\.style\.display = builtIn/);
  assert.match(editor, /he-conflicts-section'\)\.style\.display = builtIn/);
  assert.match(editor, /can only be added once per scenario/);
  assert.match(editor, /turningPointEventsConfigured: true/);
  assert.match(editor, /migrateLegacyTurningPointEventsForEditor/);
});
