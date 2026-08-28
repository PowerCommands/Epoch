/**
 * Focused tests for the "Scenario Only" natural-resource distribution mode.
 *
 * Scenario Only must skip all procedural augmentation (ordinary generation and
 * the victory guarantee) while leaving scenario-authored resources untouched.
 * The existing Scarce / Normal / Abundant modes must be unaffected.
 *
 * Run with: npx tsx --test tools/scenarioOnlyResourceMode.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

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

function countResources(mapData: MapData): number {
  return mapData.tiles.flat().filter((tile) => tile.resourceId !== undefined).length;
}

function runInit(
  mapData: MapData,
  resourceAbundance: ResourceAbundance,
  scienceVictoryEnabled = true,
) {
  return initializeWorldNaturalResources(mapData, {
    isLoadedGame: false,
    mapKey: 'test_map',
    activeNationIds: NATIONS,
    humanNationId: 'a',
    resourceAbundance,
    cityCoords: [],
    worldSeed: 'fixed-seed',
    scienceVictoryEnabled,
  });
}

test('Scenario Only preserves scenario resources and adds nothing procedural', () => {
  const mapData = makePlainsMap();
  mapData.tiles[0][0].resourceId = 'wheat';
  mapData.tiles[3][5].resourceId = 'iron';
  const before = resourceCoords(mapData);

  // Science Victory enabled would normally add guaranteed resources — Scenario
  // Only must skip that pass too.
  const result = runInit(mapData, 'scenario', true);

  assert.equal(result.ordinaryGenerationRan, false);
  assert.equal(result.guarantee, null);
  assert.deepEqual(resourceCoords(mapData), before);
  assert.equal(countResources(mapData), 2);
});

test('Scenario Only on a resource-free scenario stays resource-free', () => {
  const mapData = makePlainsMap();
  const result = runInit(mapData, 'scenario', true);

  assert.equal(result.ordinaryGenerationRan, false);
  assert.equal(result.guarantee, null);
  assert.equal(countResources(mapData), 0);
});

test('Scarce still generates procedural resources', () => {
  const mapData = makePlainsMap();
  const result = runInit(mapData, 'scarce', false);

  assert.equal(result.ordinaryGenerationRan, true);
  assert.ok(countResources(mapData) > 0, 'expected Scarce to place resources');
});

test('Normal still generates procedural resources', () => {
  const mapData = makePlainsMap();
  const result = runInit(mapData, 'normal', false);

  assert.equal(result.ordinaryGenerationRan, true);
  assert.ok(countResources(mapData) > 0, 'expected Normal to place resources');
});

test('Abundant still generates procedural resources', () => {
  const mapData = makePlainsMap();
  const result = runInit(mapData, 'abundant', false);

  assert.equal(result.ordinaryGenerationRan, true);
  assert.ok(countResources(mapData) > 0, 'expected Abundant to place resources');
});

test('procedural density increases from Scarce to Abundant', () => {
  const scarce = makePlainsMap();
  const normal = makePlainsMap();
  const abundant = makePlainsMap();
  runInit(scarce, 'scarce', false);
  runInit(normal, 'normal', false);
  runInit(abundant, 'abundant', false);

  assert.ok(countResources(scarce) <= countResources(normal));
  assert.ok(countResources(normal) < countResources(abundant));
});

test('Scenario Only survives a serialize/deserialize round-trip of the setup value', () => {
  // Mirrors how GameScene reads the config: `data.resourceAbundance ?? 'normal'`.
  const stored = { resourceAbundance: 'scenario' as ResourceAbundance };
  const restored = JSON.parse(JSON.stringify(stored)) as { resourceAbundance?: ResourceAbundance };
  const resourceAbundance = restored.resourceAbundance ?? 'normal';
  assert.equal(resourceAbundance, 'scenario');

  const mapData = makePlainsMap();
  mapData.tiles[0][0].resourceId = 'wheat';
  const result = runInit(mapData, resourceAbundance, true);

  assert.equal(result.ordinaryGenerationRan, false);
  assert.equal(countResources(mapData), 1);
});

test('legacy setup state without the field falls back to a generating mode', () => {
  // Older saved setup data has no `resourceAbundance`; the `?? 'normal'` default
  // keeps it on a procedural mode rather than silently becoming Scenario Only.
  const restored = JSON.parse(JSON.stringify({})) as { resourceAbundance?: ResourceAbundance };
  const resourceAbundance = restored.resourceAbundance ?? 'normal';
  assert.equal(resourceAbundance, 'normal');

  const mapData = makePlainsMap();
  const result = runInit(mapData, resourceAbundance, false);
  assert.equal(result.ordinaryGenerationRan, true);
  assert.ok(countResources(mapData) > 0);
});
