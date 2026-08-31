/**
 * Focused tests for additive victory-critical natural-resource placement.
 * Run with: npx tsx --test tools/victoryResourceGuarantee.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { isResourceAllowedOnTile } from '../src/data/naturalResources.ts';
import { NaturalResourceSystem } from '../src/systems/NaturalResourceSystem.ts';
import { ScenarioLoader } from '../src/systems/ScenarioLoader.ts';
import {
  VictoryResourceGuaranteeSystem,
  getScienceVictoryResourceBonusCount,
  type VictoryResourceGuaranteeLogger,
} from '../src/systems/VictoryResourceGuaranteeSystem.ts';
import { initializeWorldNaturalResources } from '../src/systems/WorldResourceInitialization.ts';
import { TileType, type MapData } from '../src/types/map.ts';
import type { ScenarioData } from '../src/types/scenario.ts';

const SIX_NATIONS = ['a', 'b', 'c', 'd', 'e', 'f'];

function makeMap(width = 8, height = 6, type: TileType = TileType.Plains): MapData {
  return {
    width,
    height,
    tileSize: 32,
    tiles: Array.from({ length: height }, (_, y) => (
      Array.from({ length: width }, (_, x) => ({ x, y, type }))
    )),
  };
}

function cloneMap(mapData: MapData): MapData {
  return structuredClone(mapData);
}

function aluminumCoords(mapData: MapData): string[] {
  return mapData.tiles.flat()
    .filter((tile) => tile.resourceId === 'aluminum')
    .map((tile) => `${tile.x},${tile.y}`)
    .sort();
}

function makeLogger(): { logger: VictoryResourceGuaranteeLogger; info: string[]; warnings: string[] } {
  const info: string[] = [];
  const warnings: string[] = [];
  return {
    logger: { info: (message) => info.push(message), warn: (message) => warnings.push(message) },
    info,
    warnings,
  };
}

function applyScienceGuarantee(
  mapData: MapData,
  overrides: Partial<Parameters<VictoryResourceGuaranteeSystem['apply']>[1]> = {},
  logger?: VictoryResourceGuaranteeLogger,
) {
  return new VictoryResourceGuaranteeSystem(logger).apply(mapData, {
    mapKey: 'test_map',
    worldSeed: 'fixed-seed',
    activeNationIds: SIX_NATIONS,
    humanNationId: 'a',
    cityCoords: [],
    enabledVictories: { science: true },
    ...overrides,
  });
}

test('Science Victory enabled places the configured bonus Aluminum count', () => {
  const mapData = makeMap();
  const result = applyScienceGuarantee(mapData);
  const aluminum = result.resources[0];

  assert.equal(getScienceVictoryResourceBonusCount(6, 10), 3);
  assert.equal(aluminum.requested, 3);
  assert.equal(aluminum.placed, 3);
  assert.equal(aluminumCoords(mapData).length, 3);
});

test('Science Victory disabled places no bonus Aluminum', () => {
  const mapData = makeMap();
  const { logger, info } = makeLogger();
  const result = applyScienceGuarantee(
    mapData,
    { enabledVictories: { science: false } },
    logger,
  );

  assert.deepEqual(result.resources, []);
  assert.deepEqual(aluminumCoords(mapData), []);
  assert.ok(info.some((line) => line.includes('science disabled')));
});

test('bonus Aluminum is additive when ordinary Aluminum already exists', () => {
  const mapData = makeMap();
  mapData.tiles[0][0].resourceId = 'aluminum';
  mapData.tiles[1][1].resourceId = 'aluminum';

  const result = applyScienceGuarantee(mapData);
  assert.equal(result.resources[0].existingBefore, 2);
  assert.equal(result.resources[0].placed, 3);
  assert.equal(aluminumCoords(mapData).length, 5);
});

test('bonus count follows both nation count and configured Aerospace Part requirement', () => {
  assert.equal(getScienceVictoryResourceBonusCount(1, 10), 2);
  assert.equal(getScienceVictoryResourceBonusCount(6, 5), 2);
  assert.equal(getScienceVictoryResourceBonusCount(6, 10), 3);
  assert.equal(getScienceVictoryResourceBonusCount(7, 10), 4);
  assert.equal(getScienceVictoryResourceBonusCount(12, 10), 5);

  const shorterRace = applyScienceGuarantee(makeMap(), { requiredAerospaceParts: 5 });
  const currentRace = applyScienceGuarantee(makeMap(), { requiredAerospaceParts: 10 });
  assert.equal(shorterRace.resources[0].requested, 2);
  assert.equal(currentRace.resources[0].requested, 3);

  const mapData = makeMap(12, 8);
  const result = applyScienceGuarantee(mapData, {
    activeNationIds: Array.from({ length: 10 }, (_, index) => `n${index}`),
  });
  assert.equal(result.resources[0].requested, 5);
  assert.equal(result.resources[0].placed, 5);
});

test('existing resources and city tiles are never overwritten', () => {
  const mapData = makeMap();
  mapData.tiles[0][0].resourceId = 'wheat';
  mapData.tiles[0][1].resourceId = 'iron';

  applyScienceGuarantee(mapData, { cityCoords: [{ x: 2, y: 0 }] });

  assert.equal(mapData.tiles[0][0].resourceId, 'wheat');
  assert.equal(mapData.tiles[0][1].resourceId, 'iron');
  assert.equal(mapData.tiles[0][2].resourceId, undefined);
});

test('invalid Aluminum terrain is never used', () => {
  // Jungle is not in Aluminum's allowedTileTypes, so it is the invalid filler
  // that isolates the two valid tiles below (Forest/Mountain are now valid).
  const mapData = makeMap(6, 3, TileType.Jungle);
  mapData.tiles[0][0].type = TileType.Plains;
  mapData.tiles[2][5].type = TileType.Desert;

  applyScienceGuarantee(mapData);

  assert.deepEqual(aluminumCoords(mapData), ['0,0', '5,2']);
  assert.ok(mapData.tiles.flat()
    .filter((tile) => tile.type === TileType.Jungle)
    .every((tile) => tile.resourceId !== 'aluminum'));
});

test('guaranteed sources are non-adjacent when ample valid terrain exists', () => {
  const mapData = makeMap(15, 9);
  const result = applyScienceGuarantee(mapData, {
    activeNationIds: Array.from({ length: 9 }, (_, index) => `n${index}`),
  });
  const placements = result.resources[0].placements;
  assert.equal(placements.length, 4);

  for (let a = 0; a < placements.length; a++) {
    for (let b = a + 1; b < placements.length; b++) {
      const dx = placements[a].x - placements[b].x;
      const dy = placements[a].y - placements[b].y;
      const distance = (Math.abs(dx) + Math.abs(dy) + Math.abs(dx + dy)) / 2;
      assert.ok(distance > 1, `expected separated placements, got distance ${distance}`);
    }
  }
});

test('same seed and state produce identical placements', () => {
  const first = makeMap();
  const second = makeMap();

  applyScienceGuarantee(first);
  applyScienceGuarantee(second);

  assert.deepEqual(aluminumCoords(first), aluminumCoords(second));
});

test('different victory configurations enable and disable only the configured pass', () => {
  const enabled = makeMap();
  const disabled = makeMap();
  applyScienceGuarantee(enabled, { enabledVictories: { science: true } });
  applyScienceGuarantee(disabled, { enabledVictories: { science: false } });
  assert.equal(aluminumCoords(enabled).length, 3);
  assert.equal(aluminumCoords(disabled).length, 0);
});

test('loaded-game initialization does not generate or duplicate resources', () => {
  const mapData = makeMap();
  mapData.tiles[0][0].resourceId = 'aluminum';
  const before = cloneMap(mapData);

  const result = initializeWorldNaturalResources(mapData, {
    isLoadedGame: true,
    mapKey: 'test_map',
    activeNationIds: SIX_NATIONS,
    humanNationId: 'a',
    resourceAbundance: 'normal',
    cityCoords: [],
    worldSeed: 'fixed-seed',
    scienceVictoryEnabled: true,
  });

  assert.equal(result.ordinaryGenerationRan, false);
  assert.equal(result.guarantee, null);
  assert.deepEqual(mapData, before);
});

test('insufficient eligible tiles warns and places the available subset', () => {
  // Jungle filler is invalid Aluminum terrain, leaving a single valid tile.
  const mapData = makeMap(4, 2, TileType.Jungle);
  mapData.tiles[0][0].type = TileType.Plains;
  const { logger, warnings } = makeLogger();

  const result = applyScienceGuarantee(mapData, {}, logger);
  assert.equal(result.resources[0].requested, 3);
  assert.equal(result.resources[0].placed, 1);
  assert.deepEqual(aluminumCoords(mapData), ['0,0']);
  assert.ok(warnings.some((line) => line.includes('requested 3') && line.includes('only 1')));
});

test('ordinary resource generation is unchanged when Science Victory is disabled', () => {
  const initial = makeMap(12, 8);
  const baseline = cloneMap(initial);
  const initialized = cloneMap(initial);
  const ordinaryOptions = {
    mapKey: 'test_map',
    activeNationIds: [...SIX_NATIONS],
    humanNationId: 'a',
    resourceAbundance: 'normal' as const,
    cityCoords: [{ x: 5, y: 4 }],
    worldSeed: 'ordinary-generation-regression',
  };

  new NaturalResourceSystem().generate(baseline, ordinaryOptions);
  initializeWorldNaturalResources(initialized, {
    ...ordinaryOptions,
    isLoadedGame: false,
    scienceVictoryEnabled: false,
  }, makeLogger().logger);

  assert.deepEqual(initialized, baseline);
});

test('fresh initialization preserves ordinary placements before adding bonus Aluminum', () => {
  const initial = makeMap(14, 9);
  const baseline = cloneMap(initial);
  const initialized = cloneMap(initial);
  const ordinaryOptions = {
    mapKey: 'test_map',
    activeNationIds: [...SIX_NATIONS],
    humanNationId: 'a',
    resourceAbundance: 'normal' as const,
    cityCoords: [{ x: 6, y: 4 }],
    worldSeed: 'placement-order',
  };

  new NaturalResourceSystem().generate(baseline, ordinaryOptions);
  const result = initializeWorldNaturalResources(initialized, {
    ...ordinaryOptions,
    isLoadedGame: false,
    scienceVictoryEnabled: true,
  }, makeLogger().logger);

  for (const tile of baseline.tiles.flat().filter((candidate) => candidate.resourceId !== undefined)) {
    assert.equal(initialized.tiles[tile.y][tile.x].resourceId, tile.resourceId);
  }
  assert.equal(result.guarantee?.resources[0].existingBefore, aluminumCoords(baseline).length);
  assert.equal(aluminumCoords(initialized).length, aluminumCoords(baseline).length + 3);
});

test('Maritime Expansion fresh setup adds valid bonus Aluminum after ordinary generation', () => {
  const scenarioJson = JSON.parse(
    readFileSync('public/assets/maps/maritimeExpansion.json', 'utf8'),
  ) as ScenarioData;
  const baseline = ScenarioLoader.parse(structuredClone(scenarioJson));
  const initialized = ScenarioLoader.parse(structuredClone(scenarioJson));
  const activeNationIds = initialized.nations.map((nation) => nation.id);
  const humanNationId = activeNationIds.includes('nation_sweden') ? 'nation_sweden' : activeNationIds[0];
  const cityCoords = initialized.cities.map((city) => ({ x: city.q, y: city.r }));
  const ordinaryOptions = {
    mapKey: 'map_maritime_expansion',
    activeNationIds,
    humanNationId,
    resourceAbundance: 'normal' as const,
    cityCoords,
    worldSeed: 'science-victory-resource-guarantee-verification',
  };

  new NaturalResourceSystem().generate(baseline.mapData, ordinaryOptions);
  const before = aluminumCoords(baseline.mapData).length;
  const result = initializeWorldNaturalResources(initialized.mapData, {
    ...ordinaryOptions,
    isLoadedGame: false,
    scienceVictoryEnabled: true,
  }, makeLogger().logger);
  const resourceResult = result.guarantee?.resources[0];
  const after = aluminumCoords(initialized.mapData).length;
  const expectedBonus = getScienceVictoryResourceBonusCount(activeNationIds.length);

  assert.equal(resourceResult?.existingBefore, before);
  assert.equal(resourceResult?.requested, expectedBonus);
  assert.equal(resourceResult?.placed, expectedBonus);
  assert.equal(after, before + expectedBonus);
  for (const placement of resourceResult?.placements ?? []) {
    const tile = initialized.mapData.tiles[placement.y][placement.x];
    assert.equal(tile.resourceId, 'aluminum');
    assert.equal(isResourceAllowedOnTile('aluminum', tile.type), true);
  }
  for (const tile of baseline.mapData.tiles.flat().filter((candidate) => candidate.resourceId !== undefined)) {
    assert.equal(initialized.mapData.tiles[tile.y][tile.x].resourceId, tile.resourceId);
  }

  console.log(`[MaritimeVictoryResourceVerification] aluminum before=${before}, bonus=${resourceResult?.placed ?? 0}, final=${after}.`);
});
