import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';
import type { TradeDeal } from '../src/types/tradeDeal.ts';

const SELLER = 'nation_seller';

function makeMap(riceTiles: number): MapData {
  const width = 4;
  const height = 4;
  const tiles = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x): Tile => ({ x, y, type: TileType.Plains })));
  // Bare rice tiles each contribute quantity 1, so `riceTiles` == owned quantity.
  for (let i = 0; i < riceTiles; i += 1) {
    Object.assign(tiles[0][i], { resourceId: 'rice', ownerId: SELLER });
  }
  return { width, height, tileSize: 1, tiles };
}

function exportDeal(seller: string, buyer: string, resourceId: string, n: number): TradeDeal {
  return {
    id: `deal_${seller}_${buyer}_${resourceId}_${n}`,
    sellerNationId: seller,
    buyerNationId: buyer,
    resourceId,
    goldPerTurn: 2,
    startTurn: 0,
    remainingTurns: 5,
  };
}

test('canExportResource caps simultaneous exports at the owned quantity', () => {
  const deals: TradeDeal[] = [];
  const system = new ResourceAccessSystem(makeMap(2), { getAllDeals: () => deals });

  // Two owned Rice = export budget of 2, while internal access stays 2.
  assert.equal(system.getOwnedResourceSourceCount(SELLER, 'rice'), 2);
  assert.equal(system.canExportResource(SELLER, 'rice'), true);

  // First export still leaves room for one more.
  deals.push(exportDeal(SELLER, 'buyer_1', 'rice', 1));
  assert.equal(system.canExportResource(SELLER, 'rice'), true);
  // Internal access is unaffected by exporting.
  assert.equal(system.getResourceSourceCount(SELLER, 'rice'), 2);

  // Second export uses the full budget — no third export allowed.
  deals.push(exportDeal(SELLER, 'buyer_2', 'rice', 2));
  assert.equal(system.canExportResource(SELLER, 'rice'), false);
  assert.equal(system.getResourceSourceCount(SELLER, 'rice'), 2);

  // Another nation's Rice exports do not consume this seller's budget.
  deals.push(exportDeal('nation_other', 'buyer_3', 'rice', 3));
  assert.equal(system.canExportResource(SELLER, 'rice'), false);
});

test('a single owned resource permits exactly one export', () => {
  const deals: TradeDeal[] = [];
  const system = new ResourceAccessSystem(makeMap(1), { getAllDeals: () => deals });

  assert.equal(system.canExportResource(SELLER, 'rice'), true);
  deals.push(exportDeal(SELLER, 'buyer_1', 'rice', 1));
  assert.equal(system.canExportResource(SELLER, 'rice'), false);
});

test('a nation with none of a resource cannot export it', () => {
  const system = new ResourceAccessSystem(makeMap(0), { getAllDeals: () => [] });
  assert.equal(system.canExportResource(SELLER, 'rice'), false);
});
