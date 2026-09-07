import assert from 'node:assert/strict';
import test from 'node:test';

import { LIGHTHOUSE } from '../src/data/buildings';
import { GREAT_LIGHTHOUSE } from '../src/data/wonders';
import { AGENT, ALL_UNIT_TYPES, PARTISANS, REBELS, SPY } from '../src/data/units';
import { City } from '../src/entities/City';
import { Unit } from '../src/entities/Unit';
import { CityManager } from '../src/systems/CityManager';
import { passesHumanCovertDetection } from '../src/systems/HumanUnitVisibility';
import { StructureObservationSystem } from '../src/systems/StructureObservationSystem';
import { VisibilityState, VisibilitySystem } from '../src/systems/VisibilitySystem';
import { WonderSystem } from '../src/systems/WonderSystem';
import { SaveLoadService } from '../src/systems/SaveLoadService';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem';
import { TileType, type MapData, type Tile } from '../src/types/map';

const HUMAN = 'human';
const AI = 'ai';
const CENTER = 25;

function makeHarness() {
  const tiles: Tile[][] = Array.from({ length: 55 }, (_, y) => (
    Array.from({ length: 55 }, (_, x): Tile => ({ x, y, type: TileType.Plains, ownerId: HUMAN }))
  ));
  const mapData: MapData = { width: 55, height: 55, tileSize: 1, tiles };
  const cityManager = new CityManager();
  const city = new City({ id: 'coast', name: 'Beacon Bay', ownerId: HUMAN, tileX: CENTER, tileY: CENTER });
  city.ownedTileCoords = [{ x: CENTER, y: CENTER }];
  cityManager.addCity(city);
  const wonderSystem = new WonderSystem();
  const observation = new StructureObservationSystem(mapData, cityManager, wonderSystem);
  const grid = new HexGridSystem();
  return { mapData, cityManager, city, wonderSystem, observation, grid };
}

function hiddenUnit(id: string, x: number, y: number, unitType = SPY): Unit {
  return new Unit({ id, name: unitType.name, ownerId: AI, unitType, tileX: x, tileY: y });
}

test('Lighthouse data defines only its radius-10 observation identity', () => {
  assert.deepEqual(LIGHTHOUSE.modifiers, {});
  assert.equal(LIGHTHOUSE.visibilityRadius, 10);
  assert.equal(LIGHTHOUSE.covertDetectionRadius, 10);
  assert.match(LIGHTHOUSE.description, /Visibility Radius: 10/);
  assert.match(LIGHTHOUSE.description, /Covert Detection Radius: 10/);
});

test('Great Lighthouse adds radius-20 observation while retaining its Gold bonus', () => {
  assert.deepEqual(GREAT_LIGHTHOUSE.modifiers, { goldPerTurn: 1 });
  assert.equal(GREAT_LIGHTHOUSE.visibilityRadius, 20);
  assert.equal(GREAT_LIGHTHOUSE.covertDetectionRadius, 20);
  assert.match(GREAT_LIGHTHOUSE.description, /Visibility Radius: 20/);
  assert.match(GREAT_LIGHTHOUSE.description, /Covert Detection Radius: 20/);
});

test('Lighthouse provides current hex visibility through distance 10 but not 11', () => {
  const h = makeHarness();
  h.mapData.tiles[CENTER][CENTER].buildingId = LIGHTHOUSE.id;
  h.cityManager.getBuildings(h.city.id).add(LIGHTHOUSE);
  const sources = h.observation.getSourcesForNation(HUMAN);
  const visibility = new VisibilitySystem(h.mapData, h.grid);

  visibility.update([], [], sources);
  assert.equal(h.grid.getDistance({ x: CENTER, y: CENTER }, { x: CENTER + 10, y: CENTER }), 10);
  assert.equal(visibility.getState(CENTER + 10, CENTER), VisibilityState.Visible);
  assert.equal(visibility.getState(CENTER + 11, CENTER), VisibilityState.Unseen);

  h.cityManager.getBuildings(h.city.id).remove(LIGHTHOUSE.id);
  visibility.update([], [], h.observation.getSourcesForNation(HUMAN));
  assert.equal(visibility.getState(CENTER + 10, CENTER), VisibilityState.Explored);
});

test('Great Lighthouse provides current hex visibility through distance 20 but not 21', () => {
  const h = makeHarness();
  h.wonderSystem.completeWonder(h.city, GREAT_LIGHTHOUSE, 1, { tileX: CENTER, tileY: CENTER });
  const visibility = new VisibilitySystem(h.mapData, h.grid);

  visibility.update([], [], h.observation.getSourcesForNation(HUMAN));
  assert.equal(visibility.getState(CENTER + 20, CENTER), VisibilityState.Visible);
  assert.equal(visibility.getState(CENTER + 21, CENTER), VisibilityState.Unseen);
});

test('structure detection uses the canonical covert flag for every current hidden unit type', () => {
  const h = makeHarness();
  h.mapData.tiles[CENTER][CENTER].buildingId = LIGHTHOUSE.id;
  h.cityManager.getBuildings(h.city.id).add(LIGHTHOUSE);
  const [source] = h.observation.getSourcesForNation(HUMAN);
  assert.ok(source);
  const authoritativeHiddenTypes = ALL_UNIT_TYPES.filter((unitType) => unitType.covertDetectable === true);
  assert.deepEqual(authoritativeHiddenTypes.map((type) => type.id), [SPY, AGENT, REBELS, PARTISANS].map((type) => type.id));

  for (const unitType of authoritativeHiddenTypes) {
    assert.equal(
      passesHumanCovertDetection(hiddenUnit(`${unitType.id}-inside`, CENTER + 10, CENTER, unitType), HUMAN, [], h.grid, [source]),
      true,
    );
    assert.equal(
      passesHumanCovertDetection(hiddenUnit(`${unitType.id}-outside`, CENTER + 11, CENTER, unitType), HUMAN, [], h.grid, [source]),
      false,
    );
  }

  const unitDetector = new Unit({ id: 'detector', name: SPY.name, ownerId: HUMAN, unitType: SPY, tileX: CENTER, tileY: CENTER });
  assert.equal(passesHumanCovertDetection(hiddenUnit('existing-source', CENTER + 3, CENTER), HUMAN, [unitDetector], h.grid), true);
});

test('Great Lighthouse detection and ownership follow its live host city', () => {
  const h = makeHarness();
  h.city.ownedTileCoords.push({ x: CENTER - 1, y: CENTER });
  h.mapData.tiles[CENTER][CENTER - 1].buildingId = LIGHTHOUSE.id;
  h.cityManager.getBuildings(h.city.id).add(LIGHTHOUSE);
  h.wonderSystem.completeWonder(h.city, GREAT_LIGHTHOUSE, 1, { tileX: CENTER, tileY: CENTER });
  const source = h.observation.getSourcesForNation(HUMAN)
    .find((candidate) => candidate.covertDetectionRadius === 20);
  assert.ok(source);
  assert.equal(passesHumanCovertDetection(hiddenUnit('range-20', CENTER + 20, CENTER), HUMAN, [], h.grid, [source]), true);

  h.cityManager.transferOwnership(h.city.id, AI);
  h.wonderSystem.transferWondersForCity(h.city.id, AI);
  assert.deepEqual(h.observation.getSourcesForNation(HUMAN), []);
  assert.equal(h.observation.getSourcesForNation(AI).length, 2);
  assert.equal(h.wonderSystem.getCompletedWonder(GREAT_LIGHTHOUSE.id)?.ownerId, AI);

  h.wonderSystem.setWonderBroken(GREAT_LIGHTHOUSE.id, true);
  assert.equal(h.observation.getSourcesForNation(AI).length, 1);
});

test('restored canonical structure state reconstructs observation without saved visibility sources', () => {
  const source = makeHarness();
  source.mapData.tiles[CENTER][CENTER].buildingId = LIGHTHOUSE.id;
  source.cityManager.getBuildings(source.city.id).add(LIGHTHOUSE);
  source.wonderSystem.completeWonder(source.city, GREAT_LIGHTHOUSE, 4, {
    tileX: CENTER - 1,
    tileY: CENTER,
  });
  const savedTiles = SaveLoadService.serializeTiles(source.mapData);
  const savedWonders = source.wonderSystem.getCompletedWonders();

  const restored = makeHarness();
  SaveLoadService.restoreTiles(savedTiles, restored.mapData);
  restored.cityManager.getBuildings(restored.city.id).add(LIGHTHOUSE);
  for (const wonder of savedWonders) restored.wonderSystem.restoreCompletedWonder(wonder);
  const visibility = new VisibilitySystem(restored.mapData, restored.grid);
  visibility.update([], [], restored.observation.getSourcesForNation(HUMAN));

  assert.equal(visibility.getState(CENTER + 10, CENTER), VisibilityState.Visible);
  assert.equal(visibility.getState(CENTER + 19, CENTER), VisibilityState.Visible);
  assert.equal(restored.observation.getSourcesForNation(HUMAN).length, 2);
});
