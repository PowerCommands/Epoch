import assert from 'node:assert/strict';
import test from 'node:test';

import { BROADCAST_TOWER, HOTEL, MUSEUM } from '../src/data/buildings.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { ArchaeologicalCultureSystem } from '../src/systems/ArchaeologicalCultureSystem.ts';
import { calculateCityEconomy } from '../src/systems/CityEconomy.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { TileResourceGenerator } from '../src/systems/ResourceGenerator.ts';
import { ResourceSystem } from '../src/systems/ResourceSystem.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { formatArchaeologicalCultureLine } from '../src/ui/hud/NationHudDataProvider.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

const FRANCE = 'france';
const ENGLAND = 'england';

function tile(x: number, resourceId?: string, improvementId?: string, ownerId = FRANCE): Tile {
  return { x, y: 0, type: TileType.Plains, ownerId, resourceId, improvementId };
}

function makeWorld(tiles: Tile[]) {
  const nationManager = new NationManager();
  nationManager.addNation(new Nation({ id: FRANCE, name: 'France', color: 0x2244aa, isHuman: true }));
  nationManager.addNation(new Nation({ id: ENGLAND, name: 'England', color: 0xaa2233, isHuman: false }));
  const cityManager = new CityManager();
  const paris = new City({ id: 'paris', name: 'Paris', ownerId: FRANCE, tileX: 0, tileY: 0 });
  const london = new City({ id: 'london', name: 'London', ownerId: ENGLAND, tileX: Math.max(0, tiles.length - 1), tileY: 0 });
  cityManager.addCity(paris);
  cityManager.addCity(london);
  const mapData: MapData = { width: tiles.length, height: 1, tileSize: 32, tiles: [tiles] };
  return { nationManager, cityManager, paris, london, mapData };
}

test('resource metadata drives every land discovery value and Shipwreck remains ineligible', () => {
  const sites = [
    tile(0, 'ancient_pottery', 'archaeological_dig'),
    tile(1, 'ancient_coins', 'archaeological_dig'),
    tile(2, 'ancient_weapons', 'archaeological_dig'),
    tile(3, 'royal_relics', 'archaeological_dig'),
    tile(4, 'ancient_treasure', 'archaeological_dig'),
    { ...tile(5, 'shipwreck', 'archaeological_dig'), type: TileType.Coast },
  ];
  const world = makeWorld(sites);
  const archaeology = new ArchaeologicalCultureSystem(world.mapData, world.cityManager);

  assert.deepEqual(archaeology.calculateForNation(FRANCE), {
    hasFunctioningMuseum: false,
    exploitedSiteCount: 5,
    potentialCulturePerTurn: 40,
    baseCulturePerTurn: 0,
  });

  world.cityManager.getBuildings(world.paris.id).add(MUSEUM);
  assert.deepEqual(archaeology.calculateForNation(FRANCE), {
    hasFunctioningMuseum: true,
    exploitedSiteCount: 5,
    potentialCulturePerTurn: 40,
    baseCulturePerTurn: 40,
  });
});

test('no, wrong, and under-construction excavations contribute zero', () => {
  const none = tile(0, 'ancient_pottery');
  const wrong = tile(1, 'ancient_coins', 'farm');
  const underConstruction = tile(2, 'ancient_weapons');
  underConstruction.improvementConstruction = {
    improvementId: 'archaeological_dig', unitId: 'archaeologist', ownerId: FRANCE,
    remainingTurns: 1, totalTurns: 3,
  };
  const world = makeWorld([none, wrong, underConstruction]);
  world.cityManager.getBuildings(world.paris.id).add(MUSEUM);

  assert.deepEqual(new ArchaeologicalCultureSystem(world.mapData, world.cityManager).calculateForNation(FRANCE), {
    hasFunctioningMuseum: true,
    exploitedSiteCount: 0,
    potentialCulturePerTurn: 0,
    baseCulturePerTurn: 0,
  });
});

test('Museum availability is binary, active-state aware, and does not scale by count', () => {
  const world = makeWorld([tile(0, 'ancient_treasure', 'archaeological_dig')]);
  const secondFrenchCity = new City({ id: 'lyon', name: 'Lyon', ownerId: FRANCE, tileX: 0, tileY: 0 });
  world.cityManager.addCity(secondFrenchCity);
  const archaeology = new ArchaeologicalCultureSystem(world.mapData, world.cityManager);

  world.cityManager.getBuildings(world.paris.id).add(MUSEUM);
  assert.equal(archaeology.calculateForNation(FRANCE).baseCulturePerTurn, 15);
  world.cityManager.getBuildings(secondFrenchCity.id).add(MUSEUM);
  assert.equal(archaeology.calculateForNation(FRANCE).baseCulturePerTurn, 15);

  world.cityManager.getBuildings(world.paris.id).setBroken(MUSEUM.id, true);
  assert.equal(archaeology.calculateForNation(FRANCE).baseCulturePerTurn, 15);
  world.cityManager.getBuildings(secondFrenchCity.id).setBroken(MUSEUM.id, true);
  assert.equal(archaeology.calculateForNation(FRANCE).baseCulturePerTurn, 0);
  world.cityManager.getBuildings(world.paris.id).setBroken(MUSEUM.id, false);
  assert.equal(archaeology.calculateForNation(FRANCE).baseCulturePerTurn, 15);
});

test('an occupied city Museum does not function until normal city effects resume', () => {
  const world = makeWorld([tile(0, 'ancient_pottery', 'archaeological_dig')]);
  world.cityManager.getBuildings(world.paris.id).add(MUSEUM);
  world.paris.integrationStartedRound = 1;
  const occupied = new ArchaeologicalCultureSystem(world.mapData, world.cityManager, () => 10);
  assert.equal(occupied.calculateForNation(FRANCE).hasFunctioningMuseum, false);
  assert.equal(occupied.calculateForNation(FRANCE).baseCulturePerTurn, 0);

  const recovering = new ArchaeologicalCultureSystem(world.mapData, world.cityManager, () => 26);
  assert.equal(recovering.calculateForNation(FRANCE).hasFunctioningMuseum, true);
  assert.equal(recovering.calculateForNation(FRANCE).baseCulturePerTurn, 3);
});

test('territorial conquest transfers an ordinary domestic dig without artifact state', () => {
  const discovery = tile(0, 'royal_relics', 'archaeological_dig');
  const world = makeWorld([discovery]);
  world.cityManager.getBuildings(world.paris.id).add(MUSEUM);
  world.cityManager.getBuildings(world.london.id).add(MUSEUM);
  const archaeology = new ArchaeologicalCultureSystem(world.mapData, world.cityManager);

  assert.equal(archaeology.calculateForNation(FRANCE).baseCulturePerTurn, 10);
  assert.equal(archaeology.calculateForNation(ENGLAND).baseCulturePerTurn, 0);
  discovery.ownerId = ENGLAND;
  assert.equal(archaeology.calculateForNation(FRANCE).baseCulturePerTurn, 0);
  assert.equal(archaeology.calculateForNation(ENGLAND).baseCulturePerTurn, 10);

  discovery.improvementOwnerId = FRANCE;
  assert.equal(archaeology.calculateForNation(FRANCE).baseCulturePerTurn, 10, 'explicit economic ownership remains authoritative');
  assert.equal(archaeology.calculateForNation(ENGLAND).baseCulturePerTurn, 0);
});

test('archaeological Culture is reconstructed from saved map and building state', () => {
  const original = makeWorld([tile(0, 'ancient_coins', 'archaeological_dig')]);
  original.cityManager.getBuildings(original.paris.id).add(MUSEUM);
  const savedTiles = JSON.parse(JSON.stringify(original.mapData.tiles)) as Tile[][];
  const restored = makeWorld(savedTiles[0]);
  restored.cityManager.getBuildings(restored.paris.id).addEntry(MUSEUM.id, false);

  const summary = new ArchaeologicalCultureSystem(restored.mapData, restored.cityManager)
    .calculateForNation(FRANCE);
  assert.equal(summary.baseCulturePerTurn, 5);
  assert.equal('archaeologicalCulture' in restored.nationManager.getResources(FRANCE), false);
});

test('ResourceSystem adds archaeology once, applies normal Culture percentages, and preserves Museum yields', () => {
  const world = makeWorld([tile(0, 'ancient_treasure', 'archaeological_dig')]);
  const buildings = world.cityManager.getBuildings(world.paris.id);
  buildings.add(MUSEUM);
  buildings.add(HOTEL);
  buildings.add(BROADCAST_TOWER);
  const grid = new HexGridSystem();
  const rawCity = calculateCityEconomy(world.paris, world.mapData, buildings, grid);
  assert.equal(MUSEUM.modifiers.culturePerTurn, 5);
  assert.equal(MUSEUM.modifiers.happinessPerTurn, 2);
  assert.equal(rawCity.happiness, 7, 'Museum, Hotel, and Broadcast Tower keep their ordinary happiness');

  const happiness = new HappinessSystem(world.nationManager, world.cityManager);
  const resources = new ResourceSystem(
    world.nationManager,
    world.cityManager,
    new TurnManager(world.nationManager),
    new TileResourceGenerator(),
    world.mapData,
    grid,
    happiness,
  );
  resources.recalculateForNation(FRANCE);
  const archaeology = resources.getArchaeologicalCultureBreakdown(FRANCE);
  // Existing percentage order: Hotel floor(15 * 1.10) = 16, then Broadcast
  // Tower floor(16 * 1.33) = 21.
  assert.equal(archaeology.baseCulturePerTurn, 15);
  assert.equal(archaeology.culturePerTurn, 21);
  assert.equal(world.nationManager.getResources(FRANCE).culturePerTurn, rawCity.culture + 21);
});

test('Culture UI explains both enabled discoveries and a missing Museum', () => {
  assert.equal(formatArchaeologicalCultureLine({
    hasFunctioningMuseum: true, exploitedSiteCount: 3, potentialCulturePerTurn: 25, culturePerTurn: 25,
  }), 'Archaeological discoveries: +25');
  assert.equal(formatArchaeologicalCultureLine({
    hasFunctioningMuseum: false, exploitedSiteCount: 3, potentialCulturePerTurn: 25, culturePerTurn: 0,
  }), 'Archaeological discoveries: +0 (Museum required)');
});
