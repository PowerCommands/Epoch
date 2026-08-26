import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { ALL_BUILDINGS, GRAND_STADIUM } from '../src/data/buildings';
import { CityManager } from '../src/systems/CityManager';
import { ScenarioLoader } from '../src/systems/ScenarioLoader';
import { TileType, type MapData } from '../src/types/map';
import type { ScenarioCity, ScenarioData } from '../src/types/scenario';

function map(width = 3, height = 3): MapData {
  return {
    width,
    height,
    tileSize: 64,
    tiles: Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => ({ x, y, type: TileType.Plains }))),
  };
}

test('authored q/r city territory and completed buildings initialize runtime x/y state', () => {
  const mapData = map();
  const city: ScenarioCity = {
    id: 'city_test', name: 'Test City', nationId: 'test', q: 1, r: 1, isCapital: true,
    ownedTileCoords: [{ q: 1, r: 1 }, { q: 2, r: 1 }],
    buildings: [{ buildingId: 'factory', q: 2, r: 1 }],
  };

  const manager = CityManager.loadFromScenario([city], mapData);
  const runtimeCity = manager.getCity(city.id)!;

  assert.deepEqual(runtimeCity.ownedTileCoords, [{ x: 1, y: 1 }, { x: 2, y: 1 }]);
  assert.equal(mapData.tiles[1][1].ownerId, 'test');
  assert.equal(mapData.tiles[1][2].ownerId, 'test');
  assert.equal(manager.getBuildings(city.id).hasActive('factory'), true);
  assert.equal(mapData.tiles[1][2].buildingId, 'factory');
});

test('cities without explicit territory retain the legacy empty pre-initialization state', () => {
  const mapData = map();
  const manager = CityManager.loadFromScenario([
    { id: 'legacy', name: 'Legacy', nationId: 'test', q: 1, r: 1, isCapital: true },
  ], mapData);
  assert.deepEqual(manager.getCity('legacy')!.ownedTileCoords, []);
});

test('ScenarioLoader preserves authored tile building ids for runtime rendering', () => {
  const scenario: ScenarioData = {
    meta: { name: 'Editor round trip', version: 1 },
    map: { width: 1, height: 1, tileSize: 64, tiles: [{ q: 0, r: 0, type: 'plains', buildingId: 'factory' }] },
    nations: [], cities: [], units: [], nationDetails: {}, initialDiplomacy: [],
  };
  const loaded = ScenarioLoader.parse(scenario);
  assert.equal(loaded.mapData.tiles[0][0].buildingId, 'factory');
});

test('browser building manifest mirrors canonical city buildings plus Grand Stadium only', () => {
  const manifest = JSON.parse(fs.readFileSync('public/assets/data/buildings-manifest.json', 'utf8')) as {
    buildings: Array<{ id: string }>;
  };
  assert.deepEqual(
    manifest.buildings.map((building) => building.id),
    [...ALL_BUILDINGS, GRAND_STADIUM].map((building) => building.id),
  );
  assert.equal(manifest.buildings.some((building) => building.id === 'barbarian-camp'), false);
});

test('standalone editor exposes separate Move and Edit City workflows', () => {
  const editor = fs.readFileSync('public/editor.html', 'utf8');
  assert.match(editor, /data-tool="move">Move City \/ Unit/);
  assert.match(editor, /data-tool="editCity">Edit City/);
  assert.match(editor, /None \/ Remove Building/);
  assert.match(editor, /ownedTileCoords: \[\{ q, r \}\]/);
});
