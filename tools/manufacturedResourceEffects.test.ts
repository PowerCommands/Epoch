/**
 * Focused checks for the manufactured-resource gameplay effects. Every effect
 * is driven by resource *access*, so domestic and imported units behave
 * identically and losing access removes the effect. Happiness and Gold are
 * national totals; Food and Production are distributed across cities with one
 * shared deterministic mechanism.
 *
 * Run with: npx tsx --test tools/manufacturedResourceEffects.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getManufacturedEffectTotal,
  getManufacturedResourceEffect,
  getManufacturedResourceEffectSummary,
  distributeAcrossCities,
  getCityCreationOrder,
  type ManufacturedResourceAccess,
  type DistributableCity,
} from '../src/systems/ManufacturedResourceEffects.ts';
import { getManufacturedResourceById } from '../src/data/manufacturedResources.ts';

/** Minimal access stub: a fixed per-resource quantity per nation. */
function accessStub(quantities: Record<string, number>): ManufacturedResourceAccess {
  return {
    getResourceSourceCount: (_nationId: string, resourceId: string) => quantities[resourceId] ?? 0,
  };
}

function city(
  id: string,
  population: number,
  canGrow: boolean,
  creationOrder = getCityCreationOrder(id),
): DistributableCity {
  return { id, population, canGrow, creationOrder };
}

function total(distribution: ReadonlyMap<string, number>): number {
  let sum = 0;
  for (const value of distribution.values()) sum += value;
  return sum;
}

// --- Effect table: per-unit amounts --------------------------------------------

test('effect table matches the required per-unit amounts and kinds', () => {
  const expected: Record<string, [string, number]> = {
    trade_goods: ['happiness', 1],
    maritime_goods: ['food', 1],
    engineered_goods: ['production', 1], // Tools
    colonial_goods: ['happiness', 2],
    banking_services: ['gold', 10],
    refined_fuel: ['production', 10],
    steel_goods: ['production', 5],
    vehicles: ['happiness', 5],
    chips: ['production', 20],
    media: ['happiness', 10],
  };
  for (const [id, [kind, amount]] of Object.entries(expected)) {
    const effect = getManufacturedResourceEffect(id);
    assert.equal(effect?.effect, kind, `${id} effect kind`);
    assert.equal(effect?.amountPerUnit, amount, `${id} per-unit amount`);
  }
});

test('Aerospace Parts have no manufactured-resource effect', () => {
  assert.equal(getManufacturedResourceEffect('aerospace_parts'), undefined);
  assert.equal(getManufacturedResourceEffectSummary('aerospace_parts'), undefined);
});

// --- Happiness (national total, stacks) ----------------------------------------

test('Happiness stacks across all happiness resources by current access', () => {
  const access = accessStub({
    trade_goods: 3,
    colonial_goods: 2,
    vehicles: 1,
    media: 1,
  });
  // 3*1 + 2*2 + 1*5 + 1*10 = 22
  assert.equal(getManufacturedEffectTotal(access, 'n', 'happiness'), 22);
});

test('individual happiness resources contribute their per-unit rate', () => {
  assert.equal(getManufacturedEffectTotal(accessStub({ colonial_goods: 3 }), 'n', 'happiness'), 6);
  assert.equal(getManufacturedEffectTotal(accessStub({ vehicles: 3 }), 'n', 'happiness'), 15);
  assert.equal(getManufacturedEffectTotal(accessStub({ media: 3 }), 'n', 'happiness'), 30);
});

// --- Gold (national total) -----------------------------------------------------

test('Banking Services contributes +10 Gold/turn per unit', () => {
  assert.equal(getManufacturedEffectTotal(accessStub({ banking_services: 1 }), 'n', 'gold'), 10);
  assert.equal(getManufacturedEffectTotal(accessStub({ banking_services: 4 }), 'n', 'gold'), 40);
  assert.equal(getManufacturedEffectTotal(accessStub({ banking_services: 0 }), 'n', 'gold'), 0);
});

// --- Production total (fed into distribution) ----------------------------------

test('Production total sums Tools, Refined Fuel, Steel Goods and Chips', () => {
  assert.equal(getManufacturedEffectTotal(accessStub({ engineered_goods: 5 }), 'n', 'production'), 5);
  assert.equal(getManufacturedEffectTotal(accessStub({ refined_fuel: 3 }), 'n', 'production'), 30);
  assert.equal(getManufacturedEffectTotal(accessStub({ steel_goods: 4 }), 'n', 'production'), 20);
  assert.equal(getManufacturedEffectTotal(accessStub({ chips: 3 }), 'n', 'production'), 60);
  // Mixed stack: 5*1 + 2*10 + 2*5 + 1*20 = 55
  assert.equal(
    getManufacturedEffectTotal(
      accessStub({ engineered_goods: 5, refined_fuel: 2, steel_goods: 2, chips: 1 }),
      'n',
      'production',
    ),
    55,
  );
});

// --- Domestic vs imported / losing access --------------------------------------

test('domestic and imported access give identical effects; losing access removes them', () => {
  // The access stub does not distinguish source: the same count -> same effect.
  assert.equal(getManufacturedEffectTotal(accessStub({ chips: 2 }), 'n', 'production'), 40);
  assert.equal(getManufacturedEffectTotal(accessStub({ chips: 0 }), 'n', 'production'), 0);
  assert.equal(getManufacturedEffectTotal(accessStub({ media: 2 }), 'n', 'happiness'), 20);
  assert.equal(getManufacturedEffectTotal(accessStub({ media: 0 }), 'n', 'happiness'), 0);
});

// --- Shared deterministic distribution (Food + Production) ----------------------

test('distribution total always equals the units handed in', () => {
  const cities = [city('city_n_capital', 8, true), city('city_n_founded_1', 4, true)];
  for (const units of [1, 4, 8, 55]) {
    assert.equal(total(distributeAcrossCities(cities, units)), units);
  }
});

test('smaller cities are prioritized and ordering repeats (Maritime spec example)', () => {
  const cities = [
    city('city_n_capital', 8, true),
    city('city_n_founded_1', 4, true), // City B
    city('city_n_founded_2', 2, true), // City C
  ];
  const d = distributeAcrossCities(cities, 5);
  assert.equal(d.get('city_n_founded_2'), 2); // City C
  assert.equal(d.get('city_n_founded_1'), 2); // City B
  assert.equal(d.get('city_n_capital'), 1); // Capital
});

test('Production reuses the same distribution as Food (Steel example: 5 units)', () => {
  const cities = [
    city('city_n_capital', 8, true),
    city('city_n_founded_1', 4, true),
    city('city_n_founded_2', 2, true),
  ];
  // 5 Steel Goods -> 25 Production points spread by the same priority.
  const productionTotal = getManufacturedEffectTotal(accessStub({ steel_goods: 5 }), 'n', 'production');
  assert.equal(productionTotal, 25);
  assert.equal(total(distributeAcrossCities(cities, productionTotal)), 25);
});

test('equal-population cities favor the youngest city first', () => {
  const older = city('city_n_founded_1', 4, true);
  const younger = city('city_n_founded_2', 4, true);
  const d = distributeAcrossCities([older, younger], 1);
  assert.equal(d.get('city_n_founded_2'), 1);
  assert.equal(d.get('city_n_founded_1'), undefined);
});

test('final tie-break is a stable deterministic city-id order', () => {
  const a = city('city_n_alpha', 3, true, 0);
  const b = city('city_n_beta', 3, true, 0);
  assert.equal(distributeAcrossCities([b, a], 1).get('city_n_alpha'), 1);
  assert.equal(distributeAcrossCities([a, b], 1).get('city_n_alpha'), 1);
});

test('growing cities are served before cities already at capacity', () => {
  const atCapacity = city('city_n_founded_1', 2, false);
  const growing = city('city_n_founded_2', 9, true);
  const d = distributeAcrossCities([atCapacity, growing], 1);
  assert.equal(d.get('city_n_founded_2'), 1);
  assert.equal(d.get('city_n_founded_1'), undefined);
});

test('when every city is at capacity, distribution still continues deterministically', () => {
  const cities = [city('city_n_capital', 5, false), city('city_n_founded_1', 3, false)];
  const d = distributeAcrossCities(cities, 3);
  assert.equal(d.get('city_n_founded_1'), 2);
  assert.equal(d.get('city_n_capital'), 1);
  assert.equal(total(d), 3);
});

test('no units or no cities yields nothing', () => {
  assert.equal(total(distributeAcrossCities([], 5)), 0);
  assert.equal(total(distributeAcrossCities([city('city_n_capital', 3, true)], 0)), 0);
});

// --- Player-facing summaries ---------------------------------------------------

test('effect summaries read correctly, including Gold /turn phrasing', () => {
  assert.equal(getManufacturedResourceEffectSummary('trade_goods'), '+1 Happiness per unit');
  assert.equal(getManufacturedResourceEffectSummary('maritime_goods'), '+1 Food per unit');
  assert.equal(getManufacturedResourceEffectSummary('engineered_goods'), '+1 Production per unit');
  assert.equal(getManufacturedResourceEffectSummary('colonial_goods'), '+2 Happiness per unit');
  assert.equal(getManufacturedResourceEffectSummary('banking_services'), '+10 Gold/turn per unit');
});

// --- Tools rename (id preserved) -----------------------------------------------

test('engineered_goods keeps its id but is displayed as Tools', () => {
  const resource = getManufacturedResourceById('engineered_goods');
  assert.equal(resource?.id, 'engineered_goods');
  assert.equal(resource?.name, 'Tools');
  assert.equal(getManufacturedResourceById('tools'), undefined);
});

// --- City creation order -------------------------------------------------------

test('city creation order: capitals are oldest, higher founded number is younger', () => {
  assert.equal(getCityCreationOrder('city_n_capital'), 0);
  assert.equal(getCityCreationOrder('city_n_founded_1'), 1);
  assert.ok(getCityCreationOrder('city_n_founded_12') > getCityCreationOrder('city_n_founded_3'));
});
