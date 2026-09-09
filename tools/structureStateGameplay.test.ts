import assert from 'node:assert/strict';
import test from 'node:test';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { Unit } from '../src/entities/Unit.ts';
import { GRANARY } from '../src/data/buildings.ts';
import { ALL_WONDERS } from '../src/data/wonders.ts';
import { AGENT, WORKER } from '../src/data/units.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { WonderSystem } from '../src/systems/WonderSystem.ts';
import { InfrastructureSabotageSystem } from '../src/systems/InfrastructureSabotageSystem.ts';
import { InfrastructureRepairSystem } from '../src/systems/InfrastructureRepairSystem.ts';
import { TileType, type MapData } from '../src/types/map.ts';

import { SaveLoadService } from '../src/systems/SaveLoadService.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import type { SavedCity, SavedTile, SavedWonder } from '../src/types/saveGame.ts';

for (const kind of ['building', 'wonder'] as const) test(`${kind}: sabotage and repair publish canonical state for visual refresh`, () => {
  const cityManager = new CityManager(), nations = new NationManager(), wonders = new WonderSystem();
  nations.addNation(new Nation({ id: 'owner', name: 'Owner', color: 0xffffff }));
  nations.addNation(new Nation({ id: 'enemy', name: 'Enemy', color: 0x000000 }));
  const city = new City({ id: 'city', name: 'Test', ownerId: 'owner', tileX: 0, tileY: 0 });
  city.ownedTileCoords = [{ x: 0, y: 0 }, { x: 1, y: 0 }]; cityManager.addCity(city);
  const map: MapData = { width: 2, height: 1, tileSize: 80, tiles: [[
    { x: 0, y: 0, type: TileType.Plains, ownerId: 'owner' },
    { x: 1, y: 0, type: TileType.Plains, ownerId: 'owner' },
  ]] };
  const tile = map.tiles[0][1], wonder = ALL_WONDERS[0];
  if (kind === 'building') { tile.buildingId = GRANARY.id; cityManager.getBuildings(city.id).add(GRANARY); }
  else { tile.wonderId = wonder.id; wonders.restoreCompletedWonder({ wonderId: wonder.id, cityId: city.id, ownerId: 'owner', tileX: 1, tileY: 0, completedTurn: 1 }); }
  const broken = () => kind === 'building' ? cityManager.getBuildings(city.id).isBroken(GRANARY.id) : wonders.isWonderBroken(wonder.id);
  const transitions: boolean[] = [];
  const sabotage = new InfrastructureSabotageSystem(map, cityManager, wonders, nations, () => {});
  const repair = new InfrastructureRepairSystem(map, cityManager, wonders, nations, () => {});
  const changed = (ids: readonly string[]) => { assert.deepEqual(ids, ['owner']); transitions.push(broken()); };
  sabotage.setInfrastructureChangedHandler(changed); repair.setInfrastructureChangedHandler(changed);
  const agent = new Unit({ id: 'agent', name: 'Agent', ownerId: 'enemy', tileX: 1, tileY: 0, unitType: AGENT });
  const worker = new Unit({ id: 'worker', name: 'Worker', ownerId: 'owner', tileX: 1, tileY: 0, unitType: WORKER });
  assert.equal(sabotage.destroyBuilding(agent), true);
  assert.equal(broken(), true);
  assert.equal(kind === 'building' ? tile.buildingId : tile.wonderId, kind === 'building' ? GRANARY.id : wonder.id);
  nations.getResources('owner').gold = 10000;
  assert.equal(repair.repair(worker), true);
  assert.equal(broken(), false);
  assert.deepEqual(transitions, [true, false]);
});

test('save loader restores construction, both broken-state sources and city health; normal saves clear stale damage', () => {
  const cities = new CityManager(), nations = new NationManager(), wonders = new WonderSystem();
  nations.addNation(new Nation({ id: 'owner', name: 'Owner', color: 0xffffff }));
  const production = new ProductionSystem(cities, new TurnManager(nations), new HappinessSystem(nations, cities));
  const map: MapData = { width: 5, height: 1, tileSize: 80,
    tiles: [Array.from({ length: 5 }, (_, x) => ({ x, y: 0, type: TileType.Plains, ownerId: 'owner' }))] };
  const wonder = ALL_WONDERS[0], constructingWonder = ALL_WONDERS[1];
  const savedTiles: SavedTile[] = [
    { q: 0, r: 0, ownerId: 'owner' },
    { q: 1, r: 0, ownerId: 'owner', buildingId: 'granary' },
    { q: 2, r: 0, ownerId: 'owner', buildingConstruction: { cityId: 'city', buildingId: 'library' } },
    { q: 3, r: 0, ownerId: 'owner', wonderId: wonder.id },
    { q: 4, r: 0, ownerId: 'owner', wonderConstruction: { cityId: 'city', wonderId: constructingWonder.id } },
  ];
  const savedCity: SavedCity = {
    id: 'city', name: 'Test', ownerId: 'owner', tileX: 0, tileY: 0,
    isCapital: true, isOriginalCapital: true, isResidenceCapital: true, originNationId: 'owner',
    health: 100, population: 2, foodStorage: 0, culture: 0, lastTurnAttacked: null,
    ownedTileCoords: map.tiles[0].map(t => ({ x: t.x, y: t.y })), workedTileCoords: [],
    buildings: [{ buildingId: 'granary', broken: true }],
    productionQueue: [
      { item: { kind: 'building', id: 'library' }, accumulated: 12 },
      { item: { kind: 'wonder', id: constructingWonder.id }, accumulated: 21, placement: { tileX: 4, tileY: 0 } },
    ],
  };
  const savedWonders: SavedWonder[] = [{ wonderId: wonder.id, ownerId: 'owner', cityId: 'city', completedTurn: 1, tileX: 3, tileY: 0, broken: true }];
  const loader = SaveLoadService as unknown as {
    applyCitiesAndProduction: (c: SavedCity[], cities: CityManager, production: ProductionSystem, map: MapData, grid: HexGridSystem, speed: 'standard') => void;
    applyWonders: (w: SavedWonder[], system: WonderSystem) => void;
  };
  const restore = () => {
    SaveLoadService.restoreTiles(JSON.parse(JSON.stringify(savedTiles)), map);
    loader.applyCitiesAndProduction(JSON.parse(JSON.stringify([savedCity])), cities, production, map, new HexGridSystem(), 'standard');
    loader.applyWonders(JSON.parse(JSON.stringify(savedWonders)), wonders);
  };
  restore();
  assert.equal(cities.getCity('city')?.health, 100);
  assert.equal(cities.getBuildings('city').isBroken('granary'), true);
  assert.equal(wonders.isWonderBroken(wonder.id), true);
  assert.equal(map.tiles[0][2].buildingConstruction?.buildingId, 'library');
  assert.equal(map.tiles[0][4].wonderConstruction?.wonderId, constructingWonder.id);
  assert.equal(production.getQueue('city').length, 2);
  savedCity.health = 101;
  savedCity.buildings = ['granary'];
  savedCity.productionQueue = [];
  savedWonders[0].broken = false;
  delete savedTiles[2].buildingConstruction;
  delete savedTiles[4].wonderConstruction;
  restore();
  assert.equal(cities.getCity('city')?.health, 101);
  assert.equal(cities.getBuildings('city').isBroken('granary'), false);
  assert.equal(wonders.isWonderBroken(wonder.id), false);
  assert.equal(map.tiles[0][2].buildingConstruction, undefined);
  assert.equal(map.tiles[0][4].wonderConstruction, undefined);
});
