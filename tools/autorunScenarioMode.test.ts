/**
 * Focused test: Autorun (the __epochDiagnostics.startNewGame entry) must default
 * to Scenario Mode, so a scenario launched through Autorun keeps exactly the
 * resources stored in the scenario — no procedurally generated or guaranteed
 * resources are added. Mirrors how the diagnostic start path resolves the
 * resourceAbundance GameConfig flag that initializeWorldNaturalResources reads.
 *
 * Run with: npx tsx --test tools/autorunScenarioMode.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { initializeWorldNaturalResources } from '../src/systems/WorldResourceInitialization.ts';
import { TileType, type MapData } from '../src/types/map.ts';
import type { ResourceAbundance } from '../src/types/gameConfig.ts';

const NATIONS = ['a', 'b', 'c', 'd', 'e', 'f'];

function makePlainsMap(width = 20, height = 20): MapData {
  return {
    width,
    height,
    tileSize: 32,
    tiles: Array.from({ length: height }, (_, y) => (
      Array.from({ length: width }, (_, x) => ({ x, y, type: TileType.Plains }))
    )),
  };
}

function resourceCoords(mapData: MapData): string[] {
  return mapData.tiles.flat()
    .filter((tile) => tile.resourceId !== undefined)
    .map((tile) => `${tile.x},${tile.y}:${tile.resourceId}`)
    .sort();
}

function runInit(mapData: MapData, resourceAbundance: ResourceAbundance) {
  return initializeWorldNaturalResources(mapData, {
    isLoadedGame: false,
    mapKey: 'test_map',
    activeNationIds: NATIONS,
    humanNationId: 'a',
    resourceAbundance,
    cityCoords: [],
    worldSeed: 'fixed-seed',
    scienceVictoryEnabled: true, // would normally trigger the victory guarantee too
  });
}

/** Mirror of startDiagnosticGame's defaulting: options.resourceAbundance ?? default. */
function autorunResourceAbundance(explicit?: ResourceAbundance): ResourceAbundance {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenes', 'MainMenuScene.ts'),
    'utf8',
  );
  const match = source.match(/resourceAbundance:\s*options\.resourceAbundance\s*\?\?\s*'([a-z]+)'/);
  assert.ok(match, 'located the diagnostic startNewGame resourceAbundance default');
  return explicit ?? (match![1] as ResourceAbundance);
}

test('the Autorun/diagnostic start path defaults to Scenario Mode', () => {
  assert.equal(autorunResourceAbundance(), 'scenario');
});

test('launching a scenario through Autorun preserves its exact resource layout', () => {
  const mapData = makePlainsMap();
  // Scenario-authored resources (deliberately placed by the designer).
  mapData.tiles[0][0].resourceId = 'wheat';
  mapData.tiles[3][5].resourceId = 'iron';
  const before = resourceCoords(mapData);

  const result = runInit(mapData, autorunResourceAbundance());

  assert.equal(result.ordinaryGenerationRan, false, 'no procedural generation ran');
  assert.equal(result.guarantee, null, 'no victory-resource guarantee ran');
  assert.deepEqual(resourceCoords(mapData), before, 'resource set/locations are unchanged');
});

test('a resource-free scenario stays resource-free under the Autorun default', () => {
  // e.g. a scenario where the USA has no Horses placed near it stays that way —
  // no Horse (or any other) resource is injected at startup.
  const mapData = makePlainsMap();
  const result = runInit(mapData, autorunResourceAbundance());

  assert.equal(result.ordinaryGenerationRan, false);
  assert.equal(resourceCoords(mapData).length, 0, 'nothing was generated');
});

test('the OLD Autorun default (normal) WOULD have injected unscenarioed resources', () => {
  // Documents the fixed bug: the previous `?? 'normal'` default generated
  // resources absent from the scenario (a plausible source of USA Horsemen where
  // no Horse resource was placed).
  const mapData = makePlainsMap();
  const result = runInit(mapData, 'normal');

  assert.equal(result.ordinaryGenerationRan, true);
  assert.ok(resourceCoords(mapData).length > 0, 'normal mode adds resources not in the scenario');
});
