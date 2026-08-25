import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { NATION_DEFINITIONS } from '../src/data/nations.ts';
import { isResourceAllowedOnTile } from '../src/data/naturalResources.ts';
import { getUnitTypeById } from '../src/data/units.ts';
import { ScenarioLoader } from '../src/systems/ScenarioLoader.ts';
import { SaveLoadService } from '../src/systems/SaveLoadService.ts';
import { MapGenerationValidator, buildLandComponentSizes, hexDistance, isValidStartTerrain } from '../src/systems/procedural/MapGenerationValidator.ts';
import { RandomScenarioGenerator } from '../src/systems/procedural/RandomScenarioGenerator.ts';
import { RANDOM_MAP_SIZES, type RandomMapSize, type RandomMapType } from '../src/systems/procedural/RandomScenarioTypes.ts';
import { SAVED_GAME_VERSION, type SavedGameState } from '../src/types/saveGame.ts';
import type { ScenarioNation } from '../src/types/scenario.ts';

const MAP_TYPES: RandomMapType[] = ['continents', 'archipelago', 'heartland'];
const MAP_SIZES: RandomMapSize[] = ['small', 'medium', 'large'];

function nations(count = 10): ScenarioNation[] {
  return NATION_DEFINITIONS
    .filter((nation) => nation.id !== 'nation_pirate')
    .slice(0, count)
    .map((nation, index) => ({ ...nation, isHuman: index === 0, startTerritoryCenter: { q: 0, r: 0 } }));
}

function generate(mapType: RandomMapType, mapSize: RandomMapSize, seed = 4837281, count = 10) {
  const participants = nations(count);
  return RandomScenarioGenerator.generate({
    mapType,
    mapSize,
    seed,
    nations: participants,
    humanNationId: participants[0]!.id,
    resourceAbundance: 'normal',
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

test('every nation starts with one canonical Settler, no city, and no other unit', () => {
  const generated = generate('archipelago', 'medium', 82117, 16);
  assert.equal(generated.scenario.cities.length, 0);
  assert.equal(getUnitTypeById('settler')?.canFound, true);
  for (const nation of generated.scenario.nations) {
    const units = generated.scenario.units.filter((unit) => unit.nationId === nation.id);
    assert.deepEqual(units.map((unit) => unit.unitTypeId), ['settler']);
    assert.deepEqual(nation.startTerritoryCenter, { q: units[0]!.q, r: units[0]!.r });
  }
});

test('starts are viable land and obey the generated minimum separation', () => {
  const generated = generate('continents', 'large', 99881, 16);
  const parsed = ScenarioLoader.parse(generated.scenario);
  for (const unit of generated.scenario.units) {
    assert.equal(isValidStartTerrain(parsed.mapData.tiles[unit.r]![unit.q]!.type), true);
  }
  for (let first = 0; first < generated.scenario.units.length; first += 1) {
    for (let second = first + 1; second < generated.scenario.units.length; second += 1) {
      const a = generated.scenario.units[first]!;
      const b = generated.scenario.units[second]!;
      assert.ok(hexDistance(a, b) >= generated.metadata.minimumStartDistance);
    }
  }
});

test('every generated resource uses its canonical allowed terrain', () => {
  for (const mapType of MAP_TYPES) {
    const generated = generate(mapType, 'small', 44119);
    const parsed = ScenarioLoader.parse(generated.scenario);
    for (const tile of parsed.mapData.tiles.flat()) {
      if (tile.resourceId) assert.equal(isResourceAllowedOnTile(tile.resourceId, tile.type), true);
    }
  }
});

test('Game Setup resource abundance controls generated resource density', () => {
  const participants = nations();
  const make = (resourceAbundance: 'scarce' | 'abundant') => RandomScenarioGenerator.generate({
    mapType: 'continents', mapSize: 'small', seed: 91919, nations: participants,
    humanNationId: participants[0]!.id, resourceAbundance,
  });
  const resources = (generated: ReturnType<typeof make>) => generated.scenario.map.tiles.filter((tile) => tile.resourceId).length;
  assert.ok(resources(make('abundant')) > resources(make('scarce')));
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
    assert.ok(basic / landTiles.length >= 0.65 && basic / landTiles.length <= 0.75);
  }
});

test('generated ScenarioData passes through ScenarioLoader without editor functionality', () => {
  const generated = generate('archipelago', 'small', 62291);
  const parsed = ScenarioLoader.parse(generated.scenario);
  assert.equal(parsed.mapData.width, 80);
  assert.equal(parsed.mapData.height, 50);
  assert.equal(parsed.nations.length, generated.scenario.nations.length);
  assert.equal(parsed.units.length, generated.scenario.nations.length);
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

  const saveSource = readFileSync(new URL('../src/systems/SaveLoadService.ts', import.meta.url), 'utf8');
  const sceneSource = readFileSync(new URL('../src/scenes/GameScene.ts', import.meta.url), 'utf8');
  assert.match(saveSource, /generatedScenario,/);
  assert.match(sceneSource, /savedState\?\.generatedScenario/);
  assert.match(sceneSource, /!data\.generatedScenario.*spawnStartingScouts/s);
});

test('Game Setup exposes exactly the three v1 profiles and focused dialog controls', () => {
  const menu = readFileSync(new URL('../src/scenes/MainMenuScene.ts', import.meta.url), 'utf8');
  const dialog = readFileSync(new URL('../src/ui/RandomScenarioDialog.ts', import.meta.url), 'utf8');
  for (const type of MAP_TYPES) assert.match(menu, new RegExp(`data-random-map-type="${type}"`));
  assert.match(dialog, /\['small', 'medium', 'large'\]/);
  assert.deepEqual(RANDOM_MAP_SIZES.small, { width: 80, height: 50 });
  assert.match(dialog, /size === 'medium'/);
  assert.deepEqual(RANDOM_MAP_SIZES.medium, { width: 100, height: 60 });
  assert.deepEqual(RANDOM_MAP_SIZES.large, { width: 120, height: 80 });
  assert.match(dialog, /random-scenario-seed/);
  assert.match(dialog, /Randomize/);
  assert.match(dialog, /Cancel/);
  assert.match(dialog, /Generate/);
  assert.doesNotMatch(dialog, /climate|rainfall|temperature|world age|preview/i);
});
