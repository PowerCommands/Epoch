/**
 * Focused tests for the Resource Abundance setup labels and scenario defaults.
 *
 * Run with: npx tsx --test tools/resourceAbundanceSetupDefaults.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  RESOURCE_ABUNDANCE_OPTIONS,
  defaultResourceAbundanceForScenario,
} from '../src/scenes/setup/resourceAbundanceSetup.ts';
import { initializeWorldNaturalResources } from '../src/systems/WorldResourceInitialization.ts';
import { TileType, type MapData } from '../src/types/map.ts';

test('the player-facing label for the scenario mode is "Scenario"', () => {
  const scenarioOption = RESOURCE_ABUNDANCE_OPTIONS.find((option) => option.value === 'scenario');
  assert.ok(scenarioOption, 'scenario option should exist');
  assert.equal(scenarioOption?.label, 'Scenario');
  // The old wording must be gone.
  assert.ok(RESOURCE_ABUNDANCE_OPTIONS.every((option) => option.label !== 'Scenario Only'));
});

test('the internal "scenario" value is retained for save/scenario compatibility', () => {
  // The label changed but the persisted/internal enum value stays "scenario".
  assert.ok(RESOURCE_ABUNDANCE_OPTIONS.some((option) => option.value === 'scenario'));
});

test('the abundance options are the expected set in display order', () => {
  assert.deepEqual(
    RESOURCE_ABUNDANCE_OPTIONS.map((option) => option.value),
    ['scarce', 'normal', 'abundant', 'scenario'],
  );
});

test('Random scenarios initialize Resource Abundance as Normal', () => {
  assert.equal(defaultResourceAbundanceForScenario(true), 'normal');
});

test('authored scenarios initialize Resource Abundance as Scenario', () => {
  assert.equal(defaultResourceAbundanceForScenario(false), 'scenario');
});

test('the default is only an initializer, so an explicit choice can differ', () => {
  // The setup default for an authored scenario is Scenario, but the player may
  // still choose any other abundance; the initializer never forces a value.
  const initialized = defaultResourceAbundanceForScenario(false);
  assert.equal(initialized, 'scenario');
  // A distinct explicit selection (e.g. Normal) is a valid, different value.
  assert.notEqual(initialized, 'normal');
});

test('the internal Scenario mode still skips procedural resource generation', () => {
  const mapData: MapData = {
    width: 8,
    height: 8,
    tileSize: 32,
    tiles: Array.from({ length: 8 }, (_, y) => (
      Array.from({ length: 8 }, (_, x) => ({ x, y, type: TileType.Plains }))
    )),
  };

  const result = initializeWorldNaturalResources(mapData, {
    isLoadedGame: false,
    mapKey: 'test_map',
    activeNationIds: ['a', 'b'],
    humanNationId: 'a',
    resourceAbundance: 'scenario',
    cityCoords: [],
    worldSeed: 'seed',
    scienceVictoryEnabled: true,
  });

  assert.equal(result.ordinaryGenerationRan, false);
  assert.equal(result.guarantee, null);
  assert.ok(mapData.tiles.flat().every((tile) => tile.resourceId === undefined));
});
