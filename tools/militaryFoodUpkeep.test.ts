import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ALL_UNIT_TYPES,
  BATTLESHIP,
  CARRIER,
  MISSILE_CRUISER,
  INFANTRY,
  SCOUT,
  SCOUT_BOAT,
  SPY,
  WARRIOR,
  WORKER,
  SETTLER,
  WORK_BOAT,
  CARGO_SHIP,
  ARCHAEOLOGIST,
  TRANSPORT_SHIP,
  GUIDED_MISSILE,
  ATOMIC_BOMB,
  NUCLEAR_MISSILE,
} from '../src/data/units.ts';
import type { UnitType } from '../src/entities/UnitType.ts';
import {
  calculateMilitaryFoodUpkeep,
  distributeGrowthFood,
  getUnitFoodUpkeep,
  type CityFoodSurplus,
} from '../src/systems/MilitaryFoodUpkeep.ts';

const asUnits = (unitTypes: readonly UnitType[]): { readonly unitType: UnitType }[] =>
  unitTypes.map((unitType) => ({ unitType }));

// ─── Unit classification ──────────────────────────────────────────────────

test('every unit has a valid food-upkeep classification of 0–3', () => {
  for (const unitType of ALL_UNIT_TYPES) {
    assert.ok(
      [0, 1, 2, 3].includes(unitType.foodUpkeep),
      `${unitType.id} has invalid foodUpkeep ${unitType.foodUpkeep}`,
    );
  }
});

test('civilian units never contribute military food upkeep', () => {
  const civilians = ALL_UNIT_TYPES.filter((u) => u.category === 'civilian');
  assert.ok(civilians.length > 0);
  for (const unitType of civilians) {
    assert.equal(unitType.foodUpkeep, 0, `${unitType.id} should have 0 food upkeep`);
  }
  assert.equal(calculateMilitaryFoodUpkeep(asUnits(civilians)), 0);
});

test('representative units are classified as intended', () => {
  // 0 — civilian / stored ordnance
  for (const u of [WORKER, SETTLER, WORK_BOAT, CARGO_SHIP, ARCHAEOLOGIST, TRANSPORT_SHIP]) {
    assert.equal(getUnitFoodUpkeep(u), 0, `${u.id} should be 0`);
  }
  for (const u of [GUIDED_MISSILE, ATOMIC_BOMB, NUCLEAR_MISSILE]) {
    assert.equal(getUnitFoodUpkeep(u), 0, `${u.id} (munition) should be 0`);
  }
  // 1 — Low (recon / covert)
  for (const u of [SCOUT, SCOUT_BOAT, SPY]) {
    assert.equal(getUnitFoodUpkeep(u), 1, `${u.id} should be 1`);
  }
  // 2 — Medium (normal military)
  assert.equal(getUnitFoodUpkeep(WARRIOR), 2);
  assert.equal(getUnitFoodUpkeep(INFANTRY), 2);
  // 3 — High (major warships)
  for (const u of [BATTLESHIP, CARRIER, MISSILE_CRUISER]) {
    assert.equal(getUnitFoodUpkeep(u), 3, `${u.id} should be 3`);
  }
});

test('national military food upkeep is a plain sum of unit food upkeep', () => {
  // Task example: 4 Infantry × 2 + 1 Battleship × 3 = 11.
  const army = asUnits([INFANTRY, INFANTRY, INFANTRY, INFANTRY, BATTLESHIP]);
  assert.equal(calculateMilitaryFoodUpkeep(army), 11);
});

test('civilian units mixed into an army add nothing to upkeep', () => {
  const withCivilians = asUnits([WARRIOR, WORKER, SETTLER, WORK_BOAT]);
  assert.equal(calculateMilitaryFoodUpkeep(withCivilians), getUnitFoodUpkeep(WARRIOR));
});

// ─── Growth-food distribution (single city) ─────────────────────────────────

const oneCity = (surplus: number): CityFoodSurplus[] => [{ cityId: 'a', surplus }];
const growthOf = (surplus: number, upkeep: number): number =>
  distributeGrowthFood(oneCity(surplus), upkeep).growthFood;
const allocatedOf = (surplus: number, upkeep: number): number =>
  distributeGrowthFood(oneCity(surplus), upkeep).allocations.get('a') ?? 0;

test('no military: growth food equals the full surplus', () => {
  const result = distributeGrowthFood(oneCity(10), 0);
  assert.equal(result.civilianSurplus, 10);
  assert.equal(result.militaryUpkeep, 0);
  assert.equal(result.growthFood, 10);
  assert.equal(result.allocations.get('a'), 10);
});

test('partial military consumption reduces growth food', () => {
  assert.equal(growthOf(10, 4), 6);
  assert.equal(allocatedOf(10, 4), 6);
});

test('military consuming the entire surplus leaves zero growth food', () => {
  assert.equal(growthOf(5, 5), 0);
  assert.equal(allocatedOf(5, 5), 0);
});

test('military exceeding the surplus never goes negative (no starvation)', () => {
  const result = distributeGrowthFood(oneCity(5), 12);
  assert.equal(result.growthFood, 0);
  assert.equal(result.allocations.get('a'), 0);
  assert.ok(result.growthFood >= 0);
});

// ─── Growth-food distribution (multiple cities) ─────────────────────────────

test('growth food is distributed proportionally and totals exactly', () => {
  const cities: CityFoodSurplus[] = [
    { cityId: 'stockholm', surplus: 6 },
    { cityId: 'goteborg', surplus: 4 },
    { cityId: 'malmo', surplus: 3 },
  ];
  const result = distributeGrowthFood(cities, 5);
  assert.equal(result.civilianSurplus, 13);
  assert.equal(result.growthFood, 8);

  const stockholm = result.allocations.get('stockholm') ?? 0;
  const goteborg = result.allocations.get('goteborg') ?? 0;
  const malmo = result.allocations.get('malmo') ?? 0;

  // Allocated integer total exactly matches the remaining growth food.
  assert.equal(stockholm + goteborg + malmo, result.growthFood);
  // The most productive city keeps the largest share.
  assert.ok(stockholm >= goteborg && stockholm >= malmo);
  // No city receives more than its original surplus.
  assert.ok(stockholm <= 6 && goteborg <= 4 && malmo <= 3);
  // Concrete deterministic outcome for this input.
  assert.deepEqual([stockholm, goteborg, malmo], [4, 2, 2]);
});

test('distribution is independent of input / iteration order', () => {
  const forward: CityFoodSurplus[] = [
    { cityId: 'stockholm', surplus: 6 },
    { cityId: 'goteborg', surplus: 4 },
    { cityId: 'malmo', surplus: 3 },
  ];
  const reversed = [...forward].reverse();
  const a = distributeGrowthFood(forward, 5).allocations;
  const b = distributeGrowthFood(reversed, 5).allocations;
  for (const { cityId } of forward) {
    assert.equal(a.get(cityId), b.get(cityId), `mismatch for ${cityId}`);
  }
});

test('no allocation exceeds a city surplus even under heavy upkeep', () => {
  const cities: CityFoodSurplus[] = [
    { cityId: 'a', surplus: 10 },
    { cityId: 'b', surplus: 1 },
    { cityId: 'c', surplus: 0 },
  ];
  const result = distributeGrowthFood(cities, 4); // growthFood = 7
  assert.equal(result.growthFood, 7);
  let total = 0;
  for (const city of cities) {
    const allocated = result.allocations.get(city.cityId) ?? 0;
    assert.ok(allocated >= 0);
    assert.ok(allocated <= city.surplus, `${city.cityId} over-allocated`);
    total += allocated;
  }
  assert.equal(total, result.growthFood);
});

test('zero total surplus yields zero growth food and no allocation', () => {
  const result = distributeGrowthFood([{ cityId: 'a', surplus: 0 }], 3);
  assert.equal(result.civilianSurplus, 0);
  assert.equal(result.growthFood, 0);
  assert.equal(result.allocations.get('a'), 0);
});
