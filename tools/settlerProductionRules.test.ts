import assert from 'node:assert/strict';
import test from 'node:test';

import { getGameSpeedById } from '../src/data/gameSpeeds.ts';
import { SETTLER } from '../src/data/units.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import {
  calculateSettlerProductionCost,
  ProductionSystem,
  SETTLER_PRODUCTION_SLOT_BLOCK_REASON,
} from '../src/systems/ProductionSystem.ts';
import { SaveLoadService, type SaveLoadContext } from '../src/systems/SaveLoadService.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { UnitManager } from '../src/systems/UnitManager.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import type { SavedNation } from '../src/types/saveGame.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

const FIRST_NATION = 'france';
const SECOND_NATION = 'england';
const SETTLER_ITEM = { kind: 'unit' as const, unitType: SETTLER };

function makeHarness() {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: FIRST_NATION, name: 'France', color: 0x0000ff, isHuman: true }));
  nations.addNation(new Nation({ id: SECOND_NATION, name: 'England', color: 0xff0000 }));
  const cities = new CityManager();
  for (const [id, ownerId, tileX] of [
    ['paris', FIRST_NATION, 0],
    ['orleans', FIRST_NATION, 1],
    ['london', SECOND_NATION, 2],
  ] as const) {
    cities.addCity(new City({ id, name: id, ownerId, tileX, tileY: 0 }));
  }
  const turns = new TurnManager(nations, getGameSpeedById('marathon'));
  const happiness = new HappinessSystem(nations, cities);
  const production = new ProductionSystem(
    cities,
    turns,
    happiness,
    getGameSpeedById('marathon'),
    undefined,
    nations,
  );
  return { nations, cities, turns, happiness, production };
}

test('Settler costs start at base and grow linearly from completed production only', () => {
  const h = makeHarness();
  assert.equal(SETTLER.productionCost, 106);
  assert.equal(h.production.getCost(SETTLER_ITEM, 'paris'), 106);
  assert.deepEqual(
    Array.from({ length: 7 }, (_, count) => calculateSettlerProductionCost(SETTLER.productionCost, count)),
    [106, 133, 159, 186, 212, 239, 265],
  );

  h.production.enqueue('paris', SETTLER_ITEM);
  assert.equal(h.production.completeCurrentProduction('paris').kind, 'completed');
  assert.equal(h.nations.getNation(FIRST_NATION)!.settlersProduced, 1);
  assert.equal(h.production.getCost(SETTLER_ITEM, 'paris'), 133);

  h.production.enqueue('paris', SETTLER_ITEM);
  assert.equal(h.production.completeCurrentProduction('paris').kind, 'completed');
  assert.equal(h.nations.getNation(FIRST_NATION)!.settlersProduced, 2);
  assert.equal(h.production.getCost(SETTLER_ITEM, 'paris'), 159);
  assert.equal(h.production.getCost(SETTLER_ITEM, 'london'), 106);
});

test('starting, granted, lost, and cancelled Settlers do not alter production history', () => {
  const h = makeHarness();
  const units = new UnitManager(4, 1);
  const starting = units.createUnit({ type: SETTLER, ownerId: FIRST_NATION, tileX: 0, tileY: 0 });
  const granted = units.createUnit({ type: SETTLER, ownerId: FIRST_NATION, tileX: 1, tileY: 0 });
  assert.equal(h.nations.getNation(FIRST_NATION)!.settlersProduced, 0);
  assert.equal(units.getUnitsByOwner(FIRST_NATION).length, 2);

  h.production.enqueue('paris', SETTLER_ITEM);
  h.production.removeFromQueue('paris', 0);
  units.removeUnit(starting.id);
  units.removeUnit(granted.id);
  assert.equal(h.nations.getNation(FIRST_NATION)!.settlersProduced, 0);
  assert.equal(h.production.getCost(SETTLER_ITEM, 'paris'), 106);

  h.production.enqueue('paris', SETTLER_ITEM);
  h.production.completeCurrentProduction('paris');
  const produced = units.createUnit({ type: SETTLER, ownerId: FIRST_NATION, tileX: 2, tileY: 0 });
  units.removeUnit(produced.id);
  assert.equal(h.nations.getNation(FIRST_NATION)!.settlersProduced, 1);
  assert.equal(h.production.getCost(SETTLER_ITEM, 'paris'), 133);
});

test('one nation-wide Settler queue slot is shared by Human and AI production paths', () => {
  const h = makeHarness();
  h.production.enqueue('paris', SETTLER_ITEM); // Human queue path
  assert.equal(
    h.production.getItemProductionBlockReason('orleans', SETTLER_ITEM),
    SETTLER_PRODUCTION_SLOT_BLOCK_REASON,
  );
  h.production.setProduction('orleans', SETTLER_ITEM); // AI replacement path
  assert.equal(h.production.getQueue('orleans').length, 0);

  h.production.removeFromQueue('paris', 0);
  h.production.setProduction('orleans', SETTLER_ITEM);
  assert.equal(h.production.getQueue('orleans').length, 1);
  h.production.enqueue('paris', SETTLER_ITEM);
  assert.equal(h.production.getQueue('paris').length, 0);

  h.production.completeCurrentProduction('orleans');
  h.production.enqueue('paris', SETTLER_ITEM);
  assert.equal(h.production.getQueue('paris').length, 1);
});

test('a waiting Settler reserves the slot, while completed Settlers do not impose a unit cap', () => {
  const h = makeHarness();
  const dummyBuilding = {
    id: 'test_building', name: 'Test Building', productionCost: 10, era: 'ancient' as const,
    requiredTechnologyId: undefined, modifiers: {}, description: '', placement: 'city' as const,
  };
  h.production.enqueue('paris', { kind: 'building', buildingType: dummyBuilding });
  h.production.enqueue('paris', SETTLER_ITEM);
  h.production.enqueue('orleans', SETTLER_ITEM);
  assert.equal(h.production.getQueue('paris').length, 2);
  assert.equal(h.production.getQueue('orleans').length, 0);

  h.production.clearProduction('paris');
  const units = new UnitManager(4, 1);
  units.createUnit({ type: SETTLER, ownerId: FIRST_NATION, tileX: 0, tileY: 0 });
  units.createUnit({ type: SETTLER, ownerId: FIRST_NATION, tileX: 1, tileY: 0 });
  assert.equal(units.getUnitsByOwner(FIRST_NATION).filter((unit) => unit.unitType.id === SETTLER.id).length, 2);
  h.production.enqueue('orleans', SETTLER_ITEM);
  assert.equal(h.production.getQueue('orleans').length, 1);
});

test('completed Settler history persists per nation and old saves default to zero', () => {
  const h = makeHarness();
  h.nations.getNation(FIRST_NATION)!.settlersProduced = 4;
  h.nations.getNation(SECOND_NATION)!.settlersProduced = 1;
  h.production.enqueue('paris', SETTLER_ITEM);
  const tiles: Tile[][] = [[0, 1, 2].map((x): Tile => ({ x, y: 0, type: TileType.Plains }))];
  const mapData: MapData = { width: 3, height: 1, tileSize: 1, tiles };
  const saved = SaveLoadService.serialize({
    mapKey: 'settler-test', humanNationId: FIRST_NATION,
    activeNationIds: [FIRST_NATION, SECOND_NATION], gameSpeedId: 'marathon',
    mapData, nationManager: h.nations, cityManager: h.cities,
    unitManager: { getAllUnits: () => [] }, productionSystem: h.production,
    policySystem: { getActivePolicyAssignments: () => [] },
    diplomacyManager: { getAllStates: () => [], getPendingPeaceProposals: () => [] },
    discoverySystem: { getAllMetPairs: () => [] }, turnManager: h.turns,
    gridSystem: new HexGridSystem(), wonderSystem: { getCompletedWonders: () => [] },
  } as unknown as SaveLoadContext);
  assert.equal(saved.nations.find((nation) => nation.id === FIRST_NATION)?.settlersProduced, 4);
  assert.equal(saved.nations.find((nation) => nation.id === SECOND_NATION)?.settlersProduced, 1);
  assert.equal(saved.cities.find((city) => city.id === 'paris')?.productionQueue[0]?.lockedProductionCost, 212);

  const restored = new NationManager();
  restored.addNation(new Nation({ id: FIRST_NATION, name: 'France', color: 0x0000ff }));
  restored.addNation(new Nation({ id: SECOND_NATION, name: 'England', color: 0xff0000 }));
  const applyNations = (SaveLoadService as unknown as {
    applyNations: (nations: SavedNation[], manager: NationManager) => void;
  }).applyNations;
  applyNations(saved.nations, restored);
  assert.equal(restored.getNation(FIRST_NATION)!.settlersProduced, 4);
  assert.equal(restored.getNation(SECOND_NATION)!.settlersProduced, 1);

  const legacy = saved.nations.map(({ settlersProduced: _omitted, ...nation }) => nation);
  applyNations(legacy, restored);
  assert.equal(restored.getNation(FIRST_NATION)!.settlersProduced, 0);
  assert.equal(restored.getNation(SECOND_NATION)!.settlersProduced, 0);
});
