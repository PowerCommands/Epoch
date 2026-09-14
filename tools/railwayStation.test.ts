import { initializeUrbanDevelopment } from '../src/systems/UrbanDevelopment.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from 'canvas';

import { ALL_BUILDINGS, RAILWAY_STATION } from '../src/data/buildings.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { ResearchSystem } from '../src/systems/ResearchSystem.ts';
import { SaveLoadService, type SaveLoadContext } from '../src/systems/SaveLoadService.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import type { SavedCity } from '../src/types/saveGame.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

import { AISystem } from '../src/systems/AISystem.ts';
import { BuildingPlacementSystem } from '../src/systems/BuildingPlacementSystem.ts';
import { stationTrainPose, STATION_TRAIN_PERIOD, STATION_TRACK_Y } from '../src/systems/rendering/StationTrain.ts';
const NATION_ID = 'railway_test_nation';
const PROJECT_ROOT = new URL('../', import.meta.url);

function makeHarness() {
  const nationManager = new NationManager();
  const nation = new Nation({ id: NATION_ID, name: 'Railway Test', color: 0x123456 });
  nationManager.addNation(nation);
  const cityManager = new CityManager();
  const city = new City({ id: 'railway_city', name: 'Cloaca', ownerId: NATION_ID, tileX: 1, tileY: 1 });
  const resources = ['coal', 'oil', 'natural_gas', 'uranium'] as const;
  const tiles: Tile[][] = Array.from({ length: 3 }, (_, y) => (
    Array.from({ length: 3 }, (_, x): Tile => ({
      x,
      y,
      type: TileType.Plains,
      ownerId: NATION_ID,
      resourceId: resources[y * 3 + x] as Tile['resourceId'],
    }))
  ));
  const mapData: MapData = { width: 3, height: 3, tileSize: 1, tiles };
  city.ownedTileCoords = tiles.flat().map(({ x, y }) => ({ x, y }));
  initializeUrbanDevelopment(city, mapData);
  cityManager.addCity(city);
  const turnManager = new TurnManager(nationManager);
  const happiness = new HappinessSystem(nationManager, cityManager);
  const production = new ProductionSystem(cityManager, turnManager, happiness);
  return { nation, nationManager, city, cityManager, mapData, turnManager, happiness, production };
}

test('save/load preserves old cities, built/broken stations and queued stations', () => {
  for (const state of ['old', 'built', 'broken', 'queued']) {
    const original = makeHarness();
    if (state === 'built' || state === 'broken') original.cityManager.getBuildings(original.city.id).add(RAILWAY_STATION);
    if (state === 'broken') original.cityManager.getBuildings(original.city.id).setBroken(RAILWAY_STATION.id, true);
    if (state === 'queued') original.production.enqueue(original.city.id, {kind:'building',buildingType:RAILWAY_STATION});
    const saved = SaveLoadService.serialize({
      mapKey: 'railway-test',
      humanNationId: NATION_ID,
      activeNationIds: [NATION_ID],
      gameSpeedId: 'standard',
      mapData: original.mapData,
      nationManager: original.nationManager,
      cityManager: original.cityManager,
      unitManager: { getAllUnits: () => [] },
      productionSystem: original.production,
      policySystem: { getActivePolicyAssignments: () => [] },
      diplomacyManager: { getAllStates: () => [], getAllVassalRelationships: () => [], getPendingPeaceProposals: () => [], getPeaceTreatyCooldownTurns: () => 0, getMinPeaceNegotiationTurns: () => 0 },
      discoverySystem: { getAllMetPairs: () => [] },
      turnManager: original.turnManager,
      gridSystem: new HexGridSystem(),
      wonderSystem: { getCompletedWonders: () => [] },
    } as unknown as SaveLoadContext);
    assert.equal(saved.cities[0].buildings.some(entry => entry.buildingId === RAILWAY_STATION.id), state === 'built' || state === 'broken');

    const restored = makeHarness();
    const applyCitiesAndProduction = (SaveLoadService as unknown as {
      applyCitiesAndProduction: (
        cities: SavedCity[], cityManager: CityManager, productionSystem: ProductionSystem,
        mapData: MapData, gridSystem: HexGridSystem, gameSpeedId: 'standard',
      ) => void;
    }).applyCitiesAndProduction;
    applyCitiesAndProduction(saved.cities, restored.cityManager, restored.production, restored.mapData, new HexGridSystem(), 'standard');
    assert.equal(restored.cityManager.getBuildings(original.city.id).hasActive(RAILWAY_STATION.id), state === 'built');
    assert.equal(restored.cityManager.getBuildings(original.city.id).isBroken(RAILWAY_STATION.id), state === 'broken');
    const queue = restored.production.getQueue(original.city.id);
    assert.equal(queue.length, state === 'queued' ? 1 : 0);
    if (state === 'queued') {
      assert.equal(queue[0].item.kind, 'building');
      if (queue[0].item.kind === 'building') assert.equal(queue[0].item.buildingType, RAILWAY_STATION);
    }
    }

  });

  test('Railway Station artwork and generated editor catalogue entry are valid', async () => {
    const path = fileURLToPath(new URL('../public/assets/sprites/buildings/railway_station.png', import.meta.url));
    const image = await loadImage(path);
    assert.equal(image.width, 256);
    assert.equal(image.height, 256);
  const broken = await loadImage(fileURLToPath(new URL('../public/assets/sprites/buildings/railway_station-broken.png', import.meta.url)));
  assert.equal(broken.width, image.width);
  assert.equal(broken.height, image.height);
    const canvas = createCanvas(256, 256);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, 256, 256).data;
    let transparent = 0;
    let visible = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] === 0) transparent += 1;
      if (pixels[index] > 0) visible += 1;
    }
    assert.ok(transparent > 0);
    assert.ok(visible > 0);

    const manifest = JSON.parse(readFileSync(new URL('public/assets/data/buildings-manifest.json', PROJECT_ROOT), 'utf8')) as {
      buildings: Array<{ id: string; iconPath: string }>;
    };
    assert.deepEqual(manifest.buildings.find((entry) => entry.id === RAILWAY_STATION.id), {
      id: 'railway_station',
      name: 'Railway Station',
      era: 'industrial',
      placement: 'land',
      iconPath: 'assets/sprites/buildings/railway_station.png',
    });
  });

  test('Railroad unlocks the standard station for human and AI production', () => {
    for (const isHuman of [true, false]) {
      const h = makeHarness();
      h.nation.isHuman = isHuman;
      const research = new ResearchSystem(h.nationManager, h.cityManager, () => 1);
      const ai = Object.create(AISystem.prototype);
      Object.assign(ai, {
        cityManager: h.cityManager, nationManager: h.nationManager,
        productionSystem: h.production, mapData: h.mapData,
        buildingPlacementSystem: new BuildingPlacementSystem(),
        canBuildBuilding: (nationId: string, id: string) => research.isBuildingUnlocked(nationId, id),
        pickBestAvailableWorldWonder: () => undefined,
      });
      const candidates = () => ai.getPeaceInfrastructureCandidates(h.city, h.nation.id, {}).filter(
        (candidate: { item: { kind: string; buildingType?: { id: string } } }) => candidate.item.buildingType?.id === RAILWAY_STATION.id);
      assert.equal(research.isBuildingUnlocked(h.nation.id, RAILWAY_STATION.id), false);
      assert.equal(candidates().length, 0);
      h.nation.researchedTechIds.push('railroad');
      assert.equal(research.isBuildingUnlocked(h.nation.id, RAILWAY_STATION.id), true);
      assert.equal(candidates().length, 1);
      assert.ok(candidates()[0].baseScore > 0);
      const item = candidates()[0].item;
      h.production.onCompleted((id, completed) => {
        if (completed.kind === 'building') h.cityManager.getBuildings(id).add(completed.buildingType);
      });
      h.production.enqueue(h.city.id, item);
      assert.equal(candidates().length, 0, 'queued station cannot be duplicated');
      assert.equal(h.production.completeCurrentProduction(h.city.id).kind, 'completed');
      assert.equal(h.cityManager.getBuildings(h.city.id).hasActive(RAILWAY_STATION.id), true);
      assert.equal(candidates().length, 0, 'completed station cannot be duplicated');
  }
});

test('station balance uses modest normal modifiers', () => {
  assert.equal(ALL_BUILDINGS.filter(b => b.id === RAILWAY_STATION.id).length, 1);
  assert.equal(RAILWAY_STATION.productionCost, 280);
  assert.equal(RAILWAY_STATION.maintenance, 2);
  assert.deepEqual(RAILWAY_STATION.modifiers, { productionPercent: 5, goldPercent: 10 });
});

test('train arrives left to right, stops its wheels, departs, rests and loops without drift', () => {
  const pose = (t: number) => stationTrainPose(t, 0);
  assert.ok(pose(0).x < 0);
  assert.ok(pose(16).x > 1);
  assert.deepEqual(pose(6), pose(9.9));
  assert.equal(pose(16).visible, false);
  assert.equal(pose(23.99).visible, false);
  assert.deepEqual(pose(0), pose(STATION_TRAIN_PERIOD));
  assert.ok(pose(5.99).x - pose(5.98).x < pose(1).x - pose(.99).x, 'decelerates into stop');
  assert.ok(pose(15).x - pose(14.99).x > pose(10.02).x - pose(10.01).x, 'accelerates out');
  for (let t = 0; t < 16; t += .05) {
    assert.ok(pose(t + .01).x >= pose(t).x);
    assert.equal(pose(t).y, STATION_TRACK_Y);
    const repeated = stationTrainPose(t + STATION_TRAIN_PERIOD * 100, .37);
    const first = stationTrainPose(t, .37);
    assert.ok(Math.abs(repeated.x - first.x) < 1e-10);
    assert.equal(repeated.visible, first.visible);
  }
});
