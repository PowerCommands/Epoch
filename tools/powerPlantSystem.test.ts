import assert from 'node:assert/strict';
import test from 'node:test';

import { getBuildingById } from '../src/data/buildings.ts';
import { POWER_PLANTS } from '../src/data/powerPlants.ts';
import { City } from '../src/entities/City.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { BuildingPlacementSystem } from '../src/systems/BuildingPlacementSystem.ts';
import { PowerPlantSystem } from '../src/systems/PowerPlantSystem.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem.ts';
import type { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import type { TurnManager } from '../src/systems/TurnManager.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';
import type { TradeDeal } from '../src/types/tradeDeal.ts';

const NATION_ID = 'nation_a';

function createHarness(cityIds: readonly string[] = ['city_a']): {
  mapData: MapData;
  cityManager: CityManager;
  access: ResourceAccessSystem;
  system: PowerPlantSystem;
  events: string[];
  deals: TradeDeal[];
} {
  const width = 20;
  const tiles: Tile[][] = [Array.from({ length: width }, (_, x): Tile => ({
    x,
    y: 0,
    type: TileType.Plains,
  }))];
  const mapData: MapData = { width, height: 1, tileSize: 1, tiles };
  const cityManager = new CityManager();
  cityIds.forEach((id, index) => {
    const city = new City({ id, name: id, ownerId: NATION_ID, tileX: index, tileY: 0 });
    city.ownedTileCoords = [{ x: index, y: 0 }];
    tiles[0][index].ownerId = NATION_ID;
    cityManager.addCity(city);
  });
  const deals: TradeDeal[] = [];
  const access = new ResourceAccessSystem(mapData, { getAllDeals: () => deals });
  const events: string[] = [];
  const system = new PowerPlantSystem(cityManager, access, mapData, 1);
  system.onChanged((event) => events.push(event.kind));
  return { mapData, cityManager, access, system, events, deals };
}

function addResource(
  harness: ReturnType<typeof createHarness>,
  resourceId: string,
  x: number,
): void {
  Object.assign(harness.mapData.tiles[0][x], { ownerId: NATION_ID, resourceId });
  harness.access.invalidateResourceIndex();
}

function construct(
  harness: ReturnType<typeof createHarness>,
  cityId: string,
  buildingId: string,
): void {
  const city = harness.cityManager.getCity(cityId)!;
  const tile = harness.mapData.tiles[city.tileY][city.tileX];
  tile.buildingId = buildingId;
  const result = harness.system.completeConstruction(cityId, buildingId, { x: city.tileX, y: city.tileY });
  assert.equal(result.ok, true);
}

test('canonical power plant metadata contains the four exact runtime definitions', () => {
  assert.deepEqual(POWER_PLANTS, [
    { buildingId: 'coal_power_plant', requiredResourceId: 'coal', plantsPerResourceSource: 1, lifespanTurns: 20, futurePopulationCap: 16, futureProductionMultiplier: 2 },
    { buildingId: 'oil_power_plant', requiredResourceId: 'oil', plantsPerResourceSource: 1, lifespanTurns: 40, futurePopulationCap: 20, futureProductionMultiplier: 3 },
    { buildingId: 'gas_power_plant', requiredResourceId: 'natural_gas', plantsPerResourceSource: 1, lifespanTurns: 50, futurePopulationCap: 24, futureProductionMultiplier: 4 },
    { buildingId: 'nuclear_plant', requiredResourceId: 'uranium', plantsPerResourceSource: 1, lifespanTurns: 100, futurePopulationCap: 48, futureProductionMultiplier: 6 },
  ]);
});

test('each plant requires its canonical strategic resource for construction', () => {
  const expected = new Map([
    ['coal_power_plant', 'coal'],
    ['oil_power_plant', 'oil'],
    ['gas_power_plant', 'natural_gas'],
    ['nuclear_plant', 'uranium'],
  ]);
  for (const [buildingId, resourceId] of expected) {
    const harness = createHarness();
    assert.match(harness.system.getConstructionBlockReason('city_a', buildingId) ?? '', /Requires/);
    addResource(harness, resourceId, 19);
    assert.equal(harness.system.getConstructionBlockReason('city_a', buildingId), undefined);
  }
});

test('production enforces resource access both when queuing and when completing', () => {
  const harness = createHarness();
  const production = new ProductionSystem(
    harness.cityManager,
    { on: () => {} } as unknown as TurnManager,
    { getProductionModifier: () => 1 } as unknown as HappinessSystem,
  );
  production.setItemProductionBlockReasonProvider((cityId, item) => (
    item.kind === 'building'
      ? harness.system.getConstructionBlockReason(cityId, item.buildingType.id)
      : undefined
  ));
  const item = { kind: 'building' as const, buildingType: getBuildingById('coal_power_plant')! };

  production.enqueue('city_a', item);
  assert.equal(production.getQueue('city_a').length, 0);
  addResource(harness, 'coal', 19);
  production.enqueue('city_a', item);
  assert.equal(production.getQueue('city_a').length, 1);

  harness.mapData.tiles[0][19].resourceId = undefined;
  harness.access.invalidateResourceIndex();
  assert.deepEqual(production.completeCurrentProduction('city_a'), {
    kind: 'blocked',
    item,
    reason: 'Requires Coal',
  });
  assert.equal(production.getQueue('city_a')[0].blockedReason, 'Requires Coal');

  addResource(harness, 'coal', 19);
  assert.equal(production.completeCurrentProduction('city_a').kind, 'completed');
});

test('completing a new plant replaces the old plant and resets age', () => {
  const harness = createHarness();
  addResource(harness, 'coal', 18);
  addResource(harness, 'natural_gas', 19);
  construct(harness, 'city_a', 'coal_power_plant');
  harness.system.handleRoundStart(8);
  assert.equal(harness.system.getPowerPlantAge('city_a'), 7);

  construct(harness, 'city_a', 'gas_power_plant');
  assert.deepEqual(
    harness.cityManager.getBuildings('city_a').getAllEntries().map((entry) => entry.buildingId),
    ['gas_power_plant'],
  );
  assert.equal(harness.system.getPowerPlantAge('city_a'), 0);
  assert.equal(harness.system.getCityPowerPlant('city_a')?.buildingId, 'gas_power_plant');
  assert.ok(harness.events.includes('replaced'));
});

test('a replacement may use the existing plant tile when no other tile is free', () => {
  const harness = createHarness();
  addResource(harness, 'coal', 18);
  addResource(harness, 'natural_gas', 19);
  construct(harness, 'city_a', 'coal_power_plant');
  const city = harness.cityManager.getCity('city_a')!;
  const placement = new BuildingPlacementSystem();

  assert.deepEqual(
    placement.getValidPlacementCoords(city, getBuildingById('gas_power_plant')!, harness.mapData),
    [{ x: 0, y: 0 }],
  );
  assert.equal(placement.startPlacement(city, 'gas_power_plant', harness.mapData), true);
  assert.equal(placement.selectTile(city, { x: 0, y: 0 }, harness.mapData).status, 'reserved');
});

test('resource capacity is 1:1 and excess allocation is stable by city id', () => {
  const harness = createHarness(['city_c', 'city_a', 'city_b']);
  addResource(harness, 'coal', 18);
  construct(harness, 'city_c', 'coal_power_plant');
  construct(harness, 'city_a', 'coal_power_plant');
  construct(harness, 'city_b', 'coal_power_plant');

  assert.equal(harness.system.getNationPowerPlantResourceCapacity(NATION_ID, 'coal'), 1);
  assert.deepEqual(['city_a', 'city_b', 'city_c'].map((id) => harness.system.isCityPowerPlantActive(id)), [true, false, false]);

  addResource(harness, 'coal', 19);
  harness.system.refreshAllocation(true);
  assert.equal(harness.system.getNationPowerPlantResourceCapacity(NATION_ID, 'coal'), 2);
  assert.deepEqual(['city_a', 'city_b', 'city_c'].map((id) => harness.system.isCityPowerPlantActive(id)), [true, true, false]);
  harness.system.refreshAllocation(true);
  assert.deepEqual(harness.events.filter((kind) => kind === 'becameActive').length, 1);
});

test('canonical imported resource access contributes nation-wide plant capacity', () => {
  const harness = createHarness(['city_a', 'city_b']);
  harness.deals.push({
    id: 'coal_import',
    sellerNationId: 'nation_b',
    buyerNationId: NATION_ID,
    resourceId: 'coal',
    goldPerTurn: 5,
    startTurn: 1,
    remainingTurns: 10,
  });
  construct(harness, 'city_a', 'coal_power_plant');
  construct(harness, 'city_b', 'coal_power_plant');

  assert.equal(harness.system.getNationPowerPlantResourceCapacity(NATION_ID, 'coal'), 1);
  assert.deepEqual(['city_a', 'city_b'].map((id) => harness.system.isCityPowerPlantActive(id)), [true, false]);
});

test('resource loss preserves the inactive plant and its age until reactivation', () => {
  const harness = createHarness();
  addResource(harness, 'coal', 19);
  construct(harness, 'city_a', 'coal_power_plant');
  harness.system.handleRoundStart(13);
  assert.equal(harness.system.getPowerPlantAge('city_a'), 12);

  harness.mapData.tiles[0][19].resourceId = undefined;
  harness.access.invalidateResourceIndex();
  harness.system.refreshAllocation(true);
  assert.equal(harness.system.getPowerPlantInactiveReason('city_a'), 'missing_resource');
  assert.equal(harness.cityManager.getBuildings('city_a').has('coal_power_plant'), true);

  harness.system.handleRoundStart(18);
  assert.equal(harness.system.getPowerPlantAge('city_a'), 17);
  addResource(harness, 'coal', 19);
  harness.system.refreshAllocation(true);
  assert.equal(harness.system.isCityPowerPlantActive('city_a'), true);
  assert.equal(harness.system.getPowerPlantRemainingLifespan('city_a'), 3);
  assert.equal(harness.events.filter((kind) => kind === 'becameInactive').length, 1);
  assert.equal(harness.events.filter((kind) => kind === 'becameActive').length, 1);
});

test('every plant expires at its canonical lifespan and is removed', () => {
  for (const metadata of POWER_PLANTS) {
    const harness = createHarness();
    addResource(harness, metadata.requiredResourceId, 19);
    construct(harness, 'city_a', metadata.buildingId);
    harness.system.handleRoundStart(1 + metadata.lifespanTurns);
    assert.equal(harness.system.getCityPowerPlant('city_a'), undefined, metadata.buildingId);
    assert.equal(harness.cityManager.getBuildings('city_a').has(metadata.buildingId), false, metadata.buildingId);
    assert.equal(harness.mapData.tiles[0][0].buildingId, undefined, metadata.buildingId);
  }
});

test('restore preserves age, derives resource activity, and defaults legacy nuclear saves to age zero', () => {
  const harness = createHarness(['city_a', 'city_b']);
  const coal = getBuildingById('coal_power_plant')!;
  const nuclear = getBuildingById('nuclear_plant')!;
  harness.cityManager.getBuildings('city_a').add(coal);
  harness.cityManager.getBuildings('city_b').add(nuclear);
  harness.system.restore([
    { id: 'city_a', powerPlantAge: 12 },
    { id: 'city_b' },
  ], 30);

  assert.equal(harness.system.getPowerPlantAge('city_a'), 12);
  assert.equal(harness.system.getPowerPlantAge('city_b'), 0);
  assert.equal(harness.system.getPowerPlantInactiveReason('city_a'), 'missing_resource');
  assert.equal(harness.system.getPowerPlantInactiveReason('city_b'), 'missing_resource');
});
