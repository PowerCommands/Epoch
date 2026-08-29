/**
 * Validates that manufactured (corporation) resources participate in the AI
 * international resource economy the same way natural resources do:
 *   - a founded corporation's manufactured resource becomes an export candidate
 *     (via the generic ResourceAccessSystem.getExportableResourceQuantities the
 *     AI trade paths now consult),
 *   - it can be sold through the existing TradeDealSystem with treasury transfer,
 *   - the importer gains access and the existing manufactured-resource effect,
 *   - the exporter keeps its own domestic access, and
 *   - Aerospace Parts stay non-tradable (Science Victory safeguard).
 *
 * Run with: npx tsx --test tools/aiManufacturedResourceTrade.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MARKET } from '../src/data/buildings.ts';
import { getManufacturedResourceById } from '../src/data/manufacturedResources.ts';
import { AEROSPACE_PARTS_ID } from '../src/data/scienceVictory.ts';
import { City } from '../src/entities/City.ts';
import { Nation } from '../src/entities/Nation.ts';
import { CityManager } from '../src/systems/CityManager.ts';
import { CorporationSystem } from '../src/systems/CorporationSystem.ts';
import { DiplomacyManager } from '../src/systems/DiplomacyManager.ts';
import { NationManager } from '../src/systems/NationManager.ts';
import { ResearchSystem } from '../src/systems/ResearchSystem.ts';
import {
  ResourceAccessSystem,
  isResourceExportEligible,
} from '../src/systems/ResourceAccessSystem.ts';
import { TradeDealSystem } from '../src/systems/TradeDealSystem.ts';
import { TurnManager } from '../src/systems/TurnManager.ts';
import { getManufacturedEffectTotal } from '../src/systems/ManufacturedResourceEffects.ts';
import { TileType, type MapData } from '../src/types/map.ts';

const FOUNDER_ID = 'nation_founder';
const RIVAL_ID = 'nation_rival';
const TRADE_GOODS_ID = 'trade_goods';

function makeHarness() {
  const nationManager = new NationManager();
  nationManager.addNation(new Nation({
    id: FOUNDER_ID,
    name: 'Founder',
    color: 0x111111,
    isHuman: false,
    researchedTechIds: ['trade_networks'],
  }));
  nationManager.addNation(new Nation({
    id: RIVAL_ID,
    name: 'Rival',
    color: 0x222222,
    isHuman: false,
    researchedTechIds: ['trade_networks'],
  }));

  const cityManager = new CityManager();
  const founderCity = new City({
    id: 'founder_city', name: 'Founder City', ownerId: FOUNDER_ID, tileX: 0, tileY: 0, isCapital: true,
  });
  const rivalCity = new City({
    id: 'rival_city', name: 'Rival City', ownerId: RIVAL_ID, tileX: 1, tileY: 0, isCapital: true,
  });
  cityManager.addCity(founderCity);
  cityManager.addCity(rivalCity);
  // Silk Road Consortium needs an active market to both found and produce.
  cityManager.getBuildings(founderCity.id).add(MARKET);

  // Founder owns the silk tile the corporation requires; rival owns none.
  const mapData: MapData = {
    width: 2,
    height: 1,
    tileSize: 32,
    tiles: [[
      { x: 0, y: 0, type: TileType.Plains, ownerId: FOUNDER_ID, resourceId: 'silk' },
      { x: 1, y: 0, type: TileType.Plains, ownerId: RIVAL_ID },
    ]],
  };

  const turnManager = new TurnManager(nationManager);
  const researchSystem = new ResearchSystem(nationManager, cityManager, () => turnManager.getCurrentRound());

  const deals: import('../src/types/tradeDeal.ts').TradeDeal[] = [];
  let tradeDealSystem: TradeDealSystem;
  const resourceAccessSystem = new ResourceAccessSystem(mapData, {
    getAllDeals: () => tradeDealSystem.getAllDeals(),
  });

  const corporationSystem = new CorporationSystem(nationManager, cityManager, {
    researchSystem,
    resourceAccessSystem,
    getCurrentTurn: () => turnManager.getCurrentRound(),
  });
  // Aerospace Parts share this provider in GameScene; include them here so the
  // safeguard is tested against the same access surface the real game exposes.
  const aerospaceQuantities = new Map<string, number>();
  resourceAccessSystem.setManufacturedResourceProvider((nationId) => {
    const result = new Map(corporationSystem.getNationManufacturedResources(nationId));
    const parts = aerospaceQuantities.get(nationId) ?? 0;
    if (parts > 0) result.set(AEROSPACE_PARTS_ID, parts);
    return result;
  });

  const gold = new Map<string, number>([[FOUNDER_ID, 100], [RIVAL_ID, 100]]);
  const diplomacyManager = new DiplomacyManager(turnManager);
  tradeDealSystem = new TradeDealSystem(
    diplomacyManager,
    () => turnManager.getCurrentRound(),
    {
      getGold: (id) => gold.get(id) ?? 0,
      addGold: (id, amount) => gold.set(id, (gold.get(id) ?? 0) + amount),
    },
  );
  tradeDealSystem.setCanExportResource((seller, resourceId) =>
    resourceAccessSystem.canExportResource(seller, resourceId));

  // Minimum diplomacy so a deal can legally be created.
  diplomacyManager.establishEmbassy(FOUNDER_ID, RIVAL_ID);
  diplomacyManager.establishEmbassy(RIVAL_ID, FOUNDER_ID);
  diplomacyManager.establishTradeRelations(FOUNDER_ID, RIVAL_ID);

  return {
    nationManager, cityManager, resourceAccessSystem, corporationSystem,
    tradeDealSystem, gold, aerospaceQuantities, deals,
  };
}

test('a founded corporation produces a manufactured resource that becomes an export candidate', () => {
  const h = makeHarness();
  assert.equal(h.corporationSystem.foundCorporation(FOUNDER_ID, 'silk_road_consortium', 'founder_city'), true);

  // Domestic production works (pre-existing behavior).
  assert.equal(
    h.resourceAccessSystem.getManufacturedResourceSourceCount(FOUNDER_ID, TRADE_GOODS_ID),
    1,
  );

  // The generic exportable-resource list the AI trade paths now consult includes
  // the manufactured resource — this is what makes it enter the AI candidate pool.
  const exportable = h.resourceAccessSystem.getExportableResourceQuantities(FOUNDER_ID)
    .map((e) => e.resourceId);
  assert.ok(exportable.includes(TRADE_GOODS_ID), 'trade_goods should be exportable');
  assert.ok(exportable.includes('silk'), 'natural resources remain exportable');
  assert.equal(h.resourceAccessSystem.canExportResource(FOUNDER_ID, TRADE_GOODS_ID), true);
});

test('manufactured resource trades through TradeDealSystem: treasury, importer access + effect, exporter retention', () => {
  const h = makeHarness();
  h.corporationSystem.foundCorporation(FOUNDER_ID, 'silk_road_consortium', 'founder_city');

  // Rival lacks trade_goods before the deal.
  assert.equal(h.resourceAccessSystem.getResourceSourceCount(RIVAL_ID, TRADE_GOODS_ID), 0);

  // Pricing comes from the existing manufactured-resource trade price.
  const price = getManufacturedResourceById(TRADE_GOODS_ID)?.tradeGoldPerTurn ?? 0;
  assert.equal(price, 4);

  const result = h.tradeDealSystem.createDeal({
    sellerNationId: FOUNDER_ID,
    buyerNationId: RIVAL_ID,
    resourceId: TRADE_GOODS_ID,
    turns: 10,
    goldPerTurn: price,
  });
  assert.equal(result.ok, true);

  // Importer gains access, and the existing Happiness effect (Trade Goods = +1) applies.
  assert.equal(h.resourceAccessSystem.getResourceSourceCount(RIVAL_ID, TRADE_GOODS_ID), 1);
  assert.equal(getManufacturedEffectTotal(h.resourceAccessSystem, RIVAL_ID, 'happiness'), 1);

  // Exporter keeps its own domestic access and effect (export does not consume it).
  assert.equal(h.resourceAccessSystem.getResourceSourceCount(FOUNDER_ID, TRADE_GOODS_ID), 1);
  assert.equal(getManufacturedEffectTotal(h.resourceAccessSystem, FOUNDER_ID, 'happiness'), 1);

  // Treasury transfer behaves exactly like any resource deal.
  h.tradeDealSystem.advanceTurnForNation(RIVAL_ID);
  assert.equal(h.gold.get(RIVAL_ID), 100 - price);
  assert.equal(h.gold.get(FOUNDER_ID), 100 + price);
});

test('natural-resource export cap is unchanged: one owned silk permits exactly one export', () => {
  const h = makeHarness();
  assert.equal(h.resourceAccessSystem.canExportResource(FOUNDER_ID, 'silk'), true);
  const first = h.tradeDealSystem.createDeal({
    sellerNationId: FOUNDER_ID, buyerNationId: RIVAL_ID, resourceId: 'silk', turns: 10, goldPerTurn: 5,
  });
  assert.equal(first.ok, true);
  // Owned quantity 1 is now fully exported.
  assert.equal(h.resourceAccessSystem.canExportResource(FOUNDER_ID, 'silk'), false);
});

test('Aerospace Parts are never export-eligible (Science Victory safeguard)', () => {
  const h = makeHarness();
  // Founder holds an Aerospace Part (as if produced toward Science Victory).
  h.aerospaceQuantities.set(FOUNDER_ID, 3);
  assert.equal(
    h.resourceAccessSystem.getManufacturedResourceSourceCount(FOUNDER_ID, AEROSPACE_PARTS_ID),
    3,
  );

  // It is owned but must not appear as an export candidate.
  const exportable = h.resourceAccessSystem.getExportableResourceQuantities(FOUNDER_ID)
    .map((e) => e.resourceId);
  assert.ok(!exportable.includes(AEROSPACE_PARTS_ID), 'aerospace_parts must not be exportable');
  assert.equal(h.resourceAccessSystem.canExportResource(FOUNDER_ID, AEROSPACE_PARTS_ID), false);
  assert.equal(isResourceExportEligible(AEROSPACE_PARTS_ID), false);

  // A deal for it is rejected by the shared export-eligibility rule.
  const result = h.tradeDealSystem.createDeal({
    sellerNationId: FOUNDER_ID, buyerNationId: RIVAL_ID, resourceId: AEROSPACE_PARTS_ID, turns: 10, goldPerTurn: 10,
  });
  assert.equal(result.ok, false);
});
