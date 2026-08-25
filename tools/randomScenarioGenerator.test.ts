import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { NATION_DEFINITIONS } from '../src/data/nations.ts';
import { BARBARIAN_CAMP_BUILDING_ID } from '../src/data/barbarians.ts';
import { isBarbarianCamp } from '../src/data/buildings.ts';
import { getUnitTypeById } from '../src/data/units.ts';
import { ScenarioLoader } from '../src/systems/ScenarioLoader.ts';
import { SaveLoadService } from '../src/systems/SaveLoadService.ts';
import { initializeWorldNaturalResources } from '../src/systems/WorldResourceInitialization.ts';
import { MapGenerationValidator, buildLandComponentSizes, hexDistance, isValidStartTerrain } from '../src/systems/procedural/MapGenerationValidator.ts';
import { RandomScenarioGenerator } from '../src/systems/procedural/RandomScenarioGenerator.ts';
import {
  DEFAULT_RANDOM_BARBARIAN_CAMP_COUNT,
  DEFAULT_RANDOM_STARTING_SCOUT,
  DEFAULT_RANDOM_STARTING_WARRIOR,
  DEFAULT_RANDOM_TERRAIN_WEIGHTS,
  normalizeTerrainWeights,
  RANDOM_LAND_TERRAIN_TYPES,
  RANDOM_MAP_PROFILE_DEFINITIONS,
  RANDOM_MAP_SIZES,
  RANDOM_CAMP_MIN_CAMP_DISTANCE,
  RANDOM_CAMP_MIN_START_DISTANCE,
  validateRandomMapDimensions,
  type RandomMapType,
} from '../src/systems/procedural/RandomScenarioTypes.ts';
import { SAVED_GAME_VERSION, type SavedGameState } from '../src/types/saveGame.ts';
import type { ScenarioNation } from '../src/types/scenario.ts';
import { materializeScenarioNationReplacements } from '../src/utils/scenarioNationReplacements.ts';

const MAP_TYPES: RandomMapType[] = ['continents', 'archipelago', 'heartland'];
const MAP_SIZES = ['small', 'medium', 'large'] as const;

function nations(count = 10): ScenarioNation[] {
  return NATION_DEFINITIONS
    .filter((nation) => nation.id !== 'nation_pirate')
    .slice(0, count)
    .map((nation, index) => ({ ...nation, isHuman: index === 0, startTerritoryCenter: { q: 0, r: 0 } }));
}

function generate(
  mapType: RandomMapType,
  mapSize: keyof typeof RANDOM_MAP_SIZES,
  seed = 4837281,
  count = 8,
  startingWorld: Partial<{ barbarianCampCount: number; addStartingScout: boolean; addStartingWarrior: boolean }> = {},
) {
  const participants = nations(count);
  const dimensions = RANDOM_MAP_SIZES[mapSize];
  return RandomScenarioGenerator.generate({
    mapType,
    mapSize,
    ...dimensions,
    seed,
    terrainWeights: DEFAULT_RANDOM_TERRAIN_WEIGHTS,
    featureCount: RANDOM_MAP_PROFILE_DEFINITIONS[mapType].defaultFeatureCount,
    barbarianCampCount: startingWorld.barbarianCampCount ?? DEFAULT_RANDOM_BARBARIAN_CAMP_COUNT,
    addStartingScout: startingWorld.addStartingScout ?? DEFAULT_RANDOM_STARTING_SCOUT,
    addStartingWarrior: startingWorld.addStartingWarrior ?? DEFAULT_RANDOM_STARTING_WARRIOR,
    nations: participants,
  });
}

test('same configuration and seed produce byte-identical ScenarioData', () => {
  const first = generate('continents', 'medium', 77219);
  const second = generate('continents', 'medium', 77219);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test('different seeds produce different geography', () => {
  const first = generate('heartland', 'small', 1001);
  const second = generate('heartland', 'small', 1002);
  assert.notEqual(JSON.stringify(first.scenario.map.tiles), JSON.stringify(second.scenario.map.tiles));
});

test('all map profiles and exact v1 dimensions generate and validate', () => {
  for (const mapType of MAP_TYPES) {
    for (const mapSize of MAP_SIZES) {
      const generated = generate(mapType, mapSize);
      assert.equal(generated.scenario.map.width, RANDOM_MAP_SIZES[mapSize].width);
      assert.equal(generated.scenario.map.height, RANDOM_MAP_SIZES[mapSize].height);
      assert.deepEqual(MapGenerationValidator.validate(generated.scenario, generated.metadata), { valid: true, errors: [] });
    }
  }
});

test('every nation receives the configured canonical starting package and no city', () => {
  const generated = generate('archipelago', 'medium', 82117, 16);
  assert.equal(generated.scenario.cities.length, 0);
  assert.equal(getUnitTypeById('settler')?.canFound, true);
  for (const nation of generated.scenario.nations) {
    const units = generated.scenario.units.filter((unit) => unit.nationId === nation.id);
    assert.deepEqual(units.map((unit) => unit.unitTypeId).sort(), ['scout', 'settler', 'warrior']);
    assert.deepEqual(nation.startTerritoryCenter, { q: units[0]!.q, r: units[0]!.r });
  }
});

test('Barbarian Camp count supports zero and exact deterministic placement', () => {
  const none = generate('continents', 'medium', 88001, 6, { barbarianCampCount: 0 });
  const first = generate('continents', 'medium', 88002, 6, { barbarianCampCount: 6 });
  const second = generate('continents', 'medium', 88002, 6, { barbarianCampCount: 6 });
  const camps = (generated: typeof first) => generated.scenario.map.tiles
    .filter((tile) => tile.buildingId === BARBARIAN_CAMP_BUILDING_ID)
    .map((tile) => ({ q: tile.q, r: tile.r }));
  assert.equal(camps(none).length, 0);
  assert.equal(camps(first).length, 6);
  assert.deepEqual(camps(first), camps(second));
});

test('camps use legal terrain, avoid starts and units, keep spacing, and balance pressure', () => {
  const generated = generate('continents', 'medium', 99117, 6, { barbarianCampCount: 9 });
  const camps = generated.scenario.map.tiles.filter((tile) => tile.buildingId === BARBARIAN_CAMP_BUILDING_ID);
  const legalTerrain = new Set(['plains', 'meadow', 'beach', 'forest', 'desert', 'jungle']);
  const unitTiles = new Set(generated.scenario.units.map((unit) => `${unit.q},${unit.r}`));
  const starts = generated.scenario.nations.map((nation) => nation.startTerritoryCenter);
  const pressure = starts.map(() => 0);
  for (const camp of camps) {
    assert.equal(legalTerrain.has(camp.type), true);
    assert.equal(unitTiles.has(`${camp.q},${camp.r}`), false);
    const distances = starts.map((start) => hexDistance(start, camp));
    assert.ok(Math.min(...distances) >= RANDOM_CAMP_MIN_START_DISTANCE);
    pressure[distances.indexOf(Math.min(...distances))]! += 1;
  }
  for (let first = 0; first < camps.length; first += 1) {
    for (let second = first + 1; second < camps.length; second += 1) {
      assert.ok(hexDistance(camps[first]!, camps[second]!) >= RANDOM_CAMP_MIN_CAMP_DISTANCE);
    }
  }
  assert.ok(Math.max(...pressure) - Math.min(...pressure) <= 1);
});

test('Scout and Warrior switches independently control equal starting packages', () => {
  for (const addStartingScout of [false, true]) {
    for (const addStartingWarrior of [false, true]) {
      const generated = generate('heartland', 'small', 77441, 6, {
        barbarianCampCount: 0,
        addStartingScout,
        addStartingWarrior,
      });
      const occupied = new Set<string>();
      for (const nation of generated.scenario.nations) {
        const units = generated.scenario.units.filter((unit) => unit.nationId === nation.id);
        assert.equal(units.filter((unit) => unit.unitTypeId === 'settler').length, 1);
        assert.equal(units.filter((unit) => unit.unitTypeId === 'scout').length, Number(addStartingScout));
        assert.equal(units.filter((unit) => unit.unitTypeId === 'warrior').length, Number(addStartingWarrior));
        const settler = units.find((unit) => unit.unitTypeId === 'settler')!;
        for (const unit of units) {
          const position = `${unit.q},${unit.r}`;
          assert.equal(occupied.has(position), false);
          occupied.add(position);
          if (unit !== settler) assert.equal(hexDistance(unit, settler), 1);
          const tile = generated.scenario.map.tiles.find((entry) => entry.q === unit.q && entry.r === unit.r)!;
          assert.ok(!['ocean', 'coast', 'mountain', 'ice'].includes(tile.type));
        }
      }
    }
  }
});

test('nation replacement transfers every generated starting unit without moving it', () => {
  const generated = generate('continents', 'small', 54119, 6);
  const replacedSlot = generated.scenario.nations[0]!.id;
  const before = generated.scenario.units.filter((unit) => unit.nationId === replacedSlot)
    .map((unit) => ({ type: unit.unitTypeId, q: unit.q, r: unit.r }));
  const replacement = materializeScenarioNationReplacements(generated.scenario, {
    [replacedSlot]: 'nation_germany',
  }).scenario;
  const after = replacement.units.filter((unit) => unit.nationId === 'nation_germany')
    .map((unit) => ({ type: unit.unitTypeId, q: unit.q, r: unit.r }));
  assert.deepEqual(after, before);
  assert.equal(JSON.stringify(replacement.map), JSON.stringify(generated.scenario.map));
});

test('existing No Barbarians startup path recognizes generated canonical camps', () => {
  assert.equal(isBarbarianCamp(BARBARIAN_CAMP_BUILDING_ID), true);
  const sceneSource = readFileSync(new URL('../src/scenes/GameScene.ts', import.meta.url), 'utf8');
  assert.match(sceneSource, /data\.noBarbarians.*!data\.savedState[\s\S]*isBarbarianCamp\(tile\.buildingId\)[\s\S]*tile\.buildingId = undefined/);
  assert.doesNotMatch(sceneSource, /generatedScenario.*noBarbarians|noBarbarians.*generatedScenario/);
});

test('validation rejects missing optional units and camp collisions', () => {
  const generated = generate('continents', 'small', 64001, 6, { barbarianCampCount: 1 });
  const missingScout = structuredClone(generated.scenario);
  missingScout.units = missingScout.units.filter((unit) => !(
    unit.nationId === missingScout.nations[0]!.id && unit.unitTypeId === 'scout'
  ));
  assert.equal(MapGenerationValidator.validate(missingScout, generated.metadata).valid, false);

  const collision = structuredClone(generated.scenario);
  const existingCamp = collision.map.tiles.find((tile) => tile.buildingId === BARBARIAN_CAMP_BUILDING_ID)!;
  delete existingCamp.buildingId;
  const settler = collision.units.find((unit) => unit.unitTypeId === 'settler')!;
  collision.map.tiles.find((tile) => tile.q === settler.q && tile.r === settler.r)!.buildingId = BARBARIAN_CAMP_BUILDING_ID;
  const result = MapGenerationValidator.validate(collision, generated.metadata);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /overlaps a starting unit|too close/.test(error)));
});

test('starts are viable land and obey the generated minimum separation', () => {
  const generated = generate('continents', 'large', 99881, 16);
  const parsed = ScenarioLoader.parse(generated.scenario);
  const settlers = generated.scenario.units.filter((unit) => unit.unitTypeId === 'settler');
  for (const unit of settlers) {
    assert.equal(isValidStartTerrain(parsed.mapData.tiles[unit.r]![unit.q]!.type), true);
  }
  for (let first = 0; first < settlers.length; first += 1) {
    for (let second = first + 1; second < settlers.length; second += 1) {
      const a = settlers[first]!;
      const b = settlers[second]!;
      assert.ok(hexDistance(a, b) >= generated.metadata.minimumStartDistance);
    }
  }
});

test('generation leaves resources for ordinary Game Setup initialization', () => {
  for (const mapType of MAP_TYPES) {
    const generated = generate(mapType, 'small', 44119);
    assert.equal(generated.scenario.map.tiles.some((tile) => tile.resourceId), false);
  }
});

test('Game Setup resource abundance controls generated resource density', () => {
  const generated = generate('continents', 'small', 91919);
  const resources = (resourceAbundance: 'scarce' | 'abundant') => {
    const parsed = ScenarioLoader.parse(structuredClone(generated.scenario));
    initializeWorldNaturalResources(parsed.mapData, {
      isLoadedGame: false,
      mapKey: generated.mapKey,
      activeNationIds: generated.scenario.nations.map((nation) => nation.id),
      humanNationId: generated.scenario.nations[0]!.id,
      resourceAbundance,
      cityCoords: [],
      worldSeed: `generated-world-${generated.metadata.seed}`,
      scienceVictoryEnabled: false,
    });
    return parsed.mapData.tiles.flat().filter((tile) => tile.resourceId).length;
  };
  assert.ok(resources('abundant') > resources('scarce'));
});

test('ordinary Resource Abundance placement never overlaps generated camps', () => {
  const generated = generate('continents', 'small', 91920, 6, { barbarianCampCount: 8 });
  const parsed = ScenarioLoader.parse(structuredClone(generated.scenario));
  initializeWorldNaturalResources(parsed.mapData, {
    isLoadedGame: false,
    mapKey: generated.mapKey,
    activeNationIds: generated.scenario.nations.map((nation) => nation.id),
    humanNationId: generated.scenario.nations[0]!.id,
    resourceAbundance: 'abundant',
    cityCoords: [],
    worldSeed: `generated-world-${generated.metadata.seed}`,
    scienceVictoryEnabled: true,
  });
  assert.ok(parsed.mapData.tiles.flat()
    .filter((tile) => tile.buildingId === BARBARIAN_CAMP_BUILDING_ID)
    .every((tile) => tile.resourceId === undefined));
});

test('custom dimensions validate and generate without being a preset', () => {
  assert.equal(validateRandomMapDimensions(91, 57), null);
  assert.match(validateRandomMapDimensions(20, 57) ?? '', /Width/);
  assert.match(validateRandomMapDimensions(160, 101) ?? '', /Height/);
  const participants = nations(6);
  const generated = RandomScenarioGenerator.generate({
    mapType: 'continents', mapSize: 'custom', width: 91, height: 57, seed: 1212,
    terrainWeights: DEFAULT_RANDOM_TERRAIN_WEIGHTS, featureCount: 3, nations: participants,
    barbarianCampCount: 6, addStartingScout: true, addStartingWarrior: true,
  });
  assert.equal(generated.metadata.mapSize, 'custom');
  assert.equal(generated.scenario.map.width, 91);
  assert.equal(generated.scenario.map.height, 57);
});

test('terrain weights normalize and materially affect generated terrain', () => {
  const normalized = normalizeTerrainWeights({ ...DEFAULT_RANDOM_TERRAIN_WEIGHTS, plains: 60, meadow: 60 });
  assert.ok(Math.abs(Object.values(normalized).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  const participants = nations(6);
  const make = (forest: number) => RandomScenarioGenerator.generate({
    mapType: 'continents', mapSize: 'small', width: 80, height: 50, seed: 6767,
    terrainWeights: { ...DEFAULT_RANDOM_TERRAIN_WEIGHTS, forest }, featureCount: 3, nations: participants,
    barbarianCampCount: 6, addStartingScout: true, addStartingWarrior: true,
  });
  const countForest = (value: ReturnType<typeof make>) => value.scenario.map.tiles.filter((tile) => tile.type === 'forest').length;
  assert.ok(countForest(make(80)) > countForest(make(5)));
});

test('profile-specific feature counts are persisted and drive geography', () => {
  const participants = nations(6);
  const makeContinents = (featureCount: number) => RandomScenarioGenerator.generate({
    mapType: 'continents', mapSize: 'medium', width: 100, height: 60, seed: 31337,
    terrainWeights: DEFAULT_RANDOM_TERRAIN_WEIGHTS, featureCount, nations: participants,
    barbarianCampCount: 6, addStartingScout: true, addStartingWarrior: true,
  });
  const makeHeartland = (featureCount: number) => RandomScenarioGenerator.generate({
    mapType: 'heartland', mapSize: 'medium', width: 100, height: 60, seed: 31337,
    terrainWeights: DEFAULT_RANDOM_TERRAIN_WEIGHTS, featureCount, nations: participants,
    barbarianCampCount: 6, addStartingScout: true, addStartingWarrior: true,
  });
  const few = makeHeartland(2);
  const many = makeHeartland(8);
  assert.equal(few.metadata.requestedFeatureCount, 2);
  assert.equal(many.metadata.requestedFeatureCount, 8);
  assert.notEqual(JSON.stringify(few.scenario.map.tiles), JSON.stringify(many.scenario.map.tiles));
  const componentCount = (scenario: ReturnType<typeof makeContinents>['scenario']) => {
    const parsed = ScenarioLoader.parse(scenario);
    const sizes = [...buildLandComponentSizes(parsed.mapData.tiles.map((row) => row.map((tile) => tile.type))).values()];
    return Math.round(sizes.reduce((sum, size) => sum + 1 / size, 0));
  };
  assert.ok(componentCount(makeContinents(5).scenario) > componentCount(makeContinents(2).scenario));
  assert.equal(RANDOM_MAP_PROFILE_DEFINITIONS.continents.defaultFeatureCount, 3);
  assert.equal(RANDOM_MAP_PROFILE_DEFINITIONS.archipelago.defaultFeatureCount, 12);
  assert.equal(RANDOM_MAP_PROFILE_DEFINITIONS.heartland.defaultFeatureCount, 5);
});

test('all supported land terrain types are represented with coherent placement rules', () => {
  const generated = generate('continents', 'medium', 44881);
  const tiles = generated.scenario.map.tiles;
  for (const type of RANDOM_LAND_TERRAIN_TYPES) assert.ok(tiles.some((tile) => tile.type === type), `${type} should be generated`);
  const at = new Map(tiles.map((tile) => [`${tile.q},${tile.r}`, tile]));
  const directions = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]] as const;
  for (const beach of tiles.filter((tile) => tile.type === 'beach')) {
    assert.ok(directions.some(([dq, dr]) => ['ocean', 'coast'].includes(at.get(`${beach.q + dq},${beach.r + dr}`)?.type ?? '')));
  }
  const ice = tiles.filter((tile) => tile.type === 'ice');
  assert.ok(ice.every((tile) => Math.abs(tile.r / 59 - 0.5) * 2 > 0.65));
});

test('profiles have distinct v1 geographic identities', () => {
  const continents = generate('continents', 'medium', 73121).scenario.map.tiles;
  const archipelago = generate('archipelago', 'medium', 73121).scenario.map.tiles;
  const heartland = generate('heartland', 'medium', 73121).scenario.map.tiles;
  const count = (tiles: typeof continents, type: string) => tiles.filter((tile) => tile.type === type).length;
  assert.ok(count(archipelago, 'coast') > count(continents, 'coast'), 'Archipelago should have higher coastline density');
  const heartlandLand = heartland.length - count(heartland, 'ocean') - count(heartland, 'coast');
  const continentsLand = continents.length - count(continents, 'ocean') - count(continents, 'coast');
  assert.ok(heartlandLand > continentsLand, 'Heartland should have the largest land share');

  const componentSummary = (mapType: RandomMapType) => {
    const parsed = ScenarioLoader.parse(generate(mapType, 'medium', 73121).scenario);
    const sizes = [...buildLandComponentSizes(parsed.mapData.tiles.map((row) => row.map((tile) => tile.type))).values()];
    return {
      largest: Math.max(...sizes),
      land: sizes.length,
      count: Math.round(sizes.reduce((sum, size) => sum + 1 / size, 0)),
    };
  };
  const continentComponents = componentSummary('continents');
  const archipelagoComponents = componentSummary('archipelago');
  const heartlandComponents = componentSummary('heartland');
  assert.ok(continentComponents.count >= 3, 'Continents should retain several separated landmasses');
  assert.ok(archipelagoComponents.count > continentComponents.count, 'Archipelago should contain more islands');
  assert.ok(heartlandComponents.largest / heartlandComponents.land > 0.8, 'Heartland should have one dominant connected landmass');

  for (const tiles of [continents, archipelago, heartland]) {
    const landTiles = tiles.filter((tile) => tile.type !== 'ocean' && tile.type !== 'coast');
    const basic = landTiles.filter((tile) => tile.type === 'plains' || tile.type === 'meadow').length;
    assert.ok(basic / landTiles.length >= 0.45 && basic / landTiles.length <= 0.70);
  }
});

test('generated ScenarioData passes through ScenarioLoader without editor functionality', () => {
  const generated = generate('archipelago', 'small', 62291);
  const parsed = ScenarioLoader.parse(generated.scenario);
  assert.equal(parsed.mapData.width, 80);
  assert.equal(parsed.mapData.height, 50);
  assert.equal(parsed.nations.length, generated.scenario.nations.length);
  assert.equal(parsed.units.length, generated.scenario.nations.length * 3);
  const generatorSource = readFileSync(new URL('../src/systems/procedural/RandomScenarioGenerator.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(generatorSource, /editor|canvas|Math\.random/i);
});

test('save parsing preserves embedded generated geography and metadata exactly', () => {
  const generated = generate('heartland', 'small', 554433);
  const snapshot = { metadata: generated.metadata, scenario: generated.scenario };
  const save: SavedGameState = {
    version: SAVED_GAME_VERSION,
    savedAt: '2026-01-01T00:00:00.000Z',
    mapKey: generated.mapKey,
    generatedScenario: snapshot,
    humanNationId: generated.scenario.nations[0]!.id,
    activeNationIds: generated.scenario.nations.map((nation) => nation.id),
    turn: { currentRound: 1, currentTurnIndex: 0 },
    tiles: [],
    nations: [],
    cities: [],
    units: [],
    diplomacy: [],
    discovery: [],
    wonders: [],
  };
  const parsed = SaveLoadService.parse(JSON.stringify(save));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.state.generatedScenario, snapshot);
  assert.equal(JSON.stringify(parsed.state.generatedScenario?.scenario.map), JSON.stringify(generated.scenario.map));
  assert.equal(parsed.state.generatedScenario?.metadata.barbarianCampCount, 6);
  assert.equal(parsed.state.generatedScenario?.metadata.addStartingScout, true);
  assert.equal(parsed.state.generatedScenario?.metadata.addStartingWarrior, true);

  const saveSource = readFileSync(new URL('../src/systems/SaveLoadService.ts', import.meta.url), 'utf8');
  const sceneSource = readFileSync(new URL('../src/scenes/GameScene.ts', import.meta.url), 'utf8');
  assert.match(saveSource, /generatedScenario,/);
  assert.match(sceneSource, /savedState\?\.generatedScenario/);
  assert.match(sceneSource, /!data\.generatedScenario.*spawnStartingScouts/s);
});

test('Game Setup exposes exactly the three v1 profiles and focused dialog controls', () => {
  const menu = readFileSync(new URL('../src/scenes/MainMenuScene.ts', import.meta.url), 'utf8');
  const dialog = readFileSync(new URL('../src/ui/RandomScenarioDialog.ts', import.meta.url), 'utf8');
  assert.ok(menu.indexOf('label="Random Scenarios"') < menu.indexOf('label="Official Scenarios"'));
  for (const type of MAP_TYPES) assert.match(menu, new RegExp(`RANDOM_SCENARIO_OPTION_PREFIX.*${type}|${type}.*RANDOM_SCENARIO_OPTION_PREFIX`, 's'));
  assert.match(dialog, /\['small', 'medium', 'large'\]/);
  assert.deepEqual(RANDOM_MAP_SIZES.small, { width: 80, height: 50 });
  assert.match(dialog, /size === 'medium'/);
  assert.deepEqual(RANDOM_MAP_SIZES.medium, { width: 100, height: 60 });
  assert.deepEqual(RANDOM_MAP_SIZES.large, { width: 120, height: 80 });
  assert.match(dialog, /random-scenario-seed/);
  assert.match(dialog, /random-scenario-width/);
  assert.match(dialog, /random-scenario-height/);
  assert.match(dialog, /random-scenario-feature-count/);
  assert.match(dialog, /random-scenario-terrain-/);
  assert.match(dialog, /random-scenario-nations/);
  assert.match(dialog, /random-scenario-barbarian-camps/);
  assert.match(dialog, /random-scenario-add-scout/);
  assert.match(dialog, /random-scenario-add-warrior/);
  assert.match(dialog, /Randomize/);
  assert.match(dialog, /Cancel/);
  assert.match(dialog, /Generate/);
  assert.doesNotMatch(dialog, /climate|rainfall|temperature|world age|Resource Abundance|Game Speed|Victory Conditions/i);
  assert.match(menu, /mm-random-scenario-hidden/);
  assert.match(menu, /canvas\.hidden = Boolean\(generated\)/);
  assert.match(menu, /generatedScenario: this\.generatedRandomScenario/);
  assert.doesNotMatch(menu, /generateAndStartRandomScenario/);
});
