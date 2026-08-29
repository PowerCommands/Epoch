import assert from 'node:assert/strict';
import test from 'node:test';

import { MARKET, MINT } from '../src/data/buildings.ts';
import { getGameSpeedById } from '../src/data/gameSpeeds.ts';
import { ECONOMIC_DEVELOPMENT } from '../src/data/projects.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import {
  canFundEconomicRecoveryInvestment,
  pickBestEconomicRecoveryInvestment,
} from '../src/systems/AISystem.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { BuildingPlacementSystem } from '../src/systems/BuildingPlacementSystem.ts';
import { HappinessSystem } from '../src/systems/HappinessSystem.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { ProductionPurchaseSystem } from '../src/systems/ProductionPurchaseSystem.ts';
import { ProductionSystem } from '../src/systems/ProductionSystem.ts';
import { ResourceSystem } from '../src/systems/ResourceSystem.ts';
import { TileResourceGenerator } from '../src/systems/ResourceGenerator.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { HexGridSystem } from '../src/systems/grid/HexGridSystem.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';

const NATION_ID = 'usa';
const CITY_ID = 'boston';

function makeHarness() {
  const nations = new NationManager();
  nations.addNation(new Nation({ id: NATION_ID, name: 'USA', color: 0x3344aa }));
  const cities = new CityManager();
  const city = new City({ id: CITY_ID, name: 'Boston', ownerId: NATION_ID, tileX: 1, tileY: 1 });
  city.population = 4;
  const tiles: Tile[][] = Array.from({ length: 3 }, (_, y) => (
    Array.from({ length: 3 }, (_, x): Tile => ({ x, y, type: TileType.Plains, ownerId: NATION_ID }))
  ));
  city.ownedTileCoords = tiles.flat().map(({ x, y }) => ({ x, y }));
  cities.addCity(city);
  const mapData: MapData = { width: 3, height: 3, tileSize: 1, tiles };
  const turns = new TurnManager(nations, getGameSpeedById('marathon'));
  const happiness = new HappinessSystem(nations, cities);
  const resources = new ResourceSystem(
    nations,
    cities,
    turns,
    new TileResourceGenerator(),
    mapData,
    new HexGridSystem(),
    happiness,
  );
  const production = new ProductionSystem(
    cities,
    turns,
    happiness,
    getGameSpeedById('marathon'),
    undefined,
    nations,
  );
  const buildingPlacement = new BuildingPlacementSystem();
  production.onCompleted((cityId, item) => {
    if (item.kind !== 'building') return true;
    if (
      item.buildingType.placement !== 'city'
      && !buildingPlacement.finalizeReservedBuilding(cityId, item.buildingType.id, mapData)
    ) return false;
    cities.getBuildings(cityId).add(item.buildingType);
    resources.recalculateForNation(NATION_ID);
    return true;
  });
  const purchases = new ProductionPurchaseSystem(
    cities,
    nations,
    production,
    resources,
    () => turns.getCurrentRound(),
  );
  resources.recalculateForNation(NATION_ID);
  return { nations, cities, city, mapData, buildingPlacement, resources, production, purchases };
}

test('normal purchase pipeline buys a GPT building and leaves Economic Development active', () => {
  const h = makeHarness();
  h.production.setProduction(CITY_ID, { kind: 'project', projectType: ECONOMIC_DEVELOPMENT });
  const improvement = h.purchases.getBuildingGoldPerTurnImprovement(CITY_ID, MARKET);
  assert.ok(improvement > 0);

  const item = { kind: 'building' as const, buildingType: MARKET };
  const cost = h.production.getNewItemBuyCost(CITY_ID, item);
  assert.ok(cost !== null && cost > 0);
  h.nations.getResources(NATION_ID).gold = cost + 250;
  const goldBefore = h.nations.getResources(NATION_ID).gold;
  const gptBefore = h.nations.getResources(NATION_ID).goldPerTurn;

  const placement = h.buildingPlacement.reserveFirstValidPlacement(h.city, MARKET, h.mapData);
  assert.ok(placement);
  h.production.enqueueFront(CITY_ID, item, { placement });
  const result = h.purchases.purchase(CITY_ID, 0);
  assert.equal(result.ok, true);
  assert.equal(h.nations.getResources(NATION_ID).gold, goldBefore - cost);
  assert.equal(h.cities.getBuildings(CITY_ID).has(MARKET.id), true);
  assert.equal(h.nations.getResources(NATION_ID).goldPerTurn - gptBefore, improvement);
  assert.equal(h.production.getQueue(CITY_ID)[0]?.item.kind, 'project');
});

test('recovery selection prefers structural GPT improvement per purchase gold', () => {
  const h = makeHarness();
  const selected = pickBestEconomicRecoveryInvestment([
    { city: h.city, building: MARKET, cost: 500, goldPerTurnImprovement: 5 },
    { city: h.city, building: MINT, cost: 300, goldPerTurnImprovement: 4 },
  ]);
  assert.equal(selected?.building.id, MINT.id);
});

test('recovery affordability preserves the existing AI reserve', () => {
  assert.equal(canFundEconomicRecoveryInvestment(520, 420, 100), true);
  assert.equal(canFundEconomicRecoveryInvestment(519, 420, 100), false);
});
