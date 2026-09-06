import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from 'canvas';

import { ALL_BUILDINGS, SEWERS } from '../src/data/buildings.ts';
import { getRequiredCultureNodeForBuilding } from '../src/data/cultureTree.ts';
import { POWER_PLANTS } from '../src/data/powerPlants.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { PowerPlantSystem, UNPOWERED_POPULATION_CAPACITY } from '../src/systems/PowerPlantSystem.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { ResearchSystem } from '../src/systems/ResearchSystem.ts';
import { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem.ts';
import { SaveLoadService, type SaveLoadContext } from '../src/systems/SaveLoadService.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { CultureSystem } from '../src/systems/culture/CultureSystem.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import type { SavedCity } from '../src/types/saveGame.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

const NATION_ID = 'sewers_test_nation';
const PROJECT_ROOT = new URL('../', import.meta.url);

function makeHarness() {
  const nationManager = new NationManager();
  const nation = new Nation({ id: NATION_ID, name: 'Sewer Test', color: 0x123456 });
  nationManager.addNation(nation);
  const cityManager = new CityManager();
  const city = new City({ id: 'sewers_city', name: 'Cloaca', ownerId: NATION_ID, tileX: 1, tileY: 1 });
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
  cityManager.addCity(city);
  const turnManager = new TurnManager(nationManager);
  const happiness = new HappinessSystem(nationManager, cityManager);
  const production = new ProductionSystem(cityManager, turnManager, happiness);
  const access = new ResourceAccessSystem(mapData, { getAllDeals: () => [] });
  const power = new PowerPlantSystem(cityManager, access, mapData, 1);
  return { nation, nationManager, city, cityManager, mapData, turnManager, happiness, production, access, power };
}

test('Sewers is a single Ancient normal building establishing capacity 8', () => {
  assert.equal(ALL_BUILDINGS.filter((building) => building.id === 'sewers').length, 1);
  assert.deepEqual({
    id: SEWERS.id,
    name: SEWERS.name,
    era: SEWERS.era,
    productionCost: SEWERS.productionCost,
    maintenance: SEWERS.maintenance,
    modifiers: SEWERS.modifiers,
  }, {
    id: 'sewers',
    name: 'Sewers',
    era: 'ancient',
    productionCost: 80,
    maintenance: 1,
    modifiers: { populationCapacity: 8 },
  });
  assert.match(SEWERS.description, /organized drainage and waste removal/i);
});

test('State Workforce gates Sewers for Human and AI through the shared building availability path', () => {
  for (const isHuman of [true, false]) {
    const nationManager = new NationManager();
    const nation = new Nation({ id: `${NATION_ID}_${isHuman}`, name: 'Test', color: 0, isHuman });
    nationManager.addNation(nation);
    const cityManager = new CityManager();
    const culture = new CultureSystem(nationManager, () => 1);
    const research = new ResearchSystem(nationManager, cityManager, () => 1);
    research.setCultureBuildingUnlockResolver((nationId, buildingId) =>
      culture.isBuildingCultureUnlocked(nationId, buildingId));

    assert.equal(getRequiredCultureNodeForBuilding('sewers')?.id, 'state_workforce');
    assert.equal(research.getRequiredTechnologyForBuilding('sewers'), undefined);
    assert.equal(research.isBuildingUnlocked(nation.id, 'sewers'), false);
    nation.unlockedCultureNodeIds.push('state_workforce');
    assert.equal(research.isBuildingUnlocked(nation.id, 'sewers'), true);
  }
});

test('Sewers establishes capacity 8 without stacking with stronger infrastructure', () => {
  const unpowered = makeHarness();
  assert.equal(unpowered.power.getCityPopulationCapacity(unpowered.city.id), UNPOWERED_POPULATION_CAPACITY);
  unpowered.cityManager.getBuildings(unpowered.city.id).add(SEWERS);
  assert.equal(unpowered.power.getCityPopulationCapacity(unpowered.city.id), 8);
  unpowered.cityManager.getBuildings(unpowered.city.id).setBroken(SEWERS.id, true);
  assert.equal(unpowered.power.getCityPopulationCapacity(unpowered.city.id), UNPOWERED_POPULATION_CAPACITY);

  for (const metadata of POWER_PLANTS) {
    const h = makeHarness();
    h.cityManager.getBuildings(h.city.id).add(ALL_BUILDINGS.find((b) => b.id === metadata.buildingId)!);
    h.power.restore([{ id: h.city.id, powerPlantAge: 0 }], 1);
    h.power.refreshAllocation(false);
    assert.equal(h.power.getCityPopulationCapacity(h.city.id), metadata.futurePopulationCap, metadata.buildingId);
    h.cityManager.getBuildings(h.city.id).add(SEWERS);
    assert.equal(h.power.getCityPopulationCapacity(h.city.id), metadata.futurePopulationCap, metadata.buildingId);
  }
});

test('an AI-unlocked Sewers can use normal production completion', () => {
  const h = makeHarness();
  h.nation.isHuman = false;
  const culture = new CultureSystem(h.nationManager, () => 1);
  const research = new ResearchSystem(h.nationManager, h.cityManager, () => 1);
  research.setCultureBuildingUnlockResolver((nationId, buildingId) =>
    culture.isBuildingCultureUnlocked(nationId, buildingId));
  assert.equal(research.isBuildingUnlocked(NATION_ID, SEWERS.id), false);
  h.nation.unlockedCultureNodeIds.push('state_workforce');
  assert.equal(research.isBuildingUnlocked(NATION_ID, SEWERS.id), true);

  h.production.onCompleted((cityId, item) => {
    if (item.kind === 'building') h.cityManager.getBuildings(cityId).add(item.buildingType);
  });
  h.production.enqueue(h.city.id, { kind: 'building', buildingType: SEWERS });
  assert.equal(h.production.completeCurrentProduction(h.city.id).kind, 'completed');
  assert.equal(h.cityManager.getBuildings(h.city.id).hasActive(SEWERS.id), true);
  assert.equal(h.power.getCityPopulationCapacity(h.city.id), 8);
});

test('save/load preserves constructed Sewers and its capacity effect', () => {
  const original = makeHarness();
  original.cityManager.getBuildings(original.city.id).add(SEWERS);
  const saved = SaveLoadService.serialize({
    mapKey: 'sewers-test',
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
  assert.ok(saved.cities[0].buildings.includes(SEWERS.id));

  const restored = makeHarness();
  const applyCitiesAndProduction = (SaveLoadService as unknown as {
    applyCitiesAndProduction: (
      cities: SavedCity[], cityManager: CityManager, productionSystem: ProductionSystem,
      mapData: MapData, gridSystem: HexGridSystem, gameSpeedId: 'standard',
    ) => void;
  }).applyCitiesAndProduction;
  applyCitiesAndProduction(saved.cities, restored.cityManager, restored.production, restored.mapData, new HexGridSystem(), 'standard');
  assert.equal(restored.cityManager.getBuildings(original.city.id).hasActive(SEWERS.id), true);
  assert.equal(restored.power.getCityPopulationCapacity(original.city.id), 8);
});

test('Sewers artwork and generated editor catalogue entry are valid', async () => {
  const path = fileURLToPath(new URL('../public/assets/sprites/buildings/sewers.png', import.meta.url));
  const image = await loadImage(path);
  assert.equal(image.width, 256);
  assert.equal(image.height, 256);
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
  assert.deepEqual(manifest.buildings.find((entry) => entry.id === SEWERS.id), {
    id: 'sewers',
    name: 'Sewers',
    era: 'ancient',
    placement: 'land',
    iconPath: 'assets/sprites/buildings/sewers.png',
  });
});
