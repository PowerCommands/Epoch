/**
 * Verifies the redesigned Stable building effect: each active Stable adds +2 to
 * the nation's usable Horse supply, but only while the nation has genuine
 * (non-Stable) Horse access. Construction is gated on that same access; the
 * bonus is derived dynamically (never persisted) so it can never satisfy its own
 * requirement, stacks across cities, and toggles cleanly with access loss/regain.
 *
 * Run with: npx tsx --test tools/stableHorseSupply.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { STABLE, STABLE_HORSE_CAPACITY_BONUS } from '../src/data/buildings.ts';
import { getBuildingRequiredResourceId } from '../src/data/buildingResourceRequirements.ts';
import { CAVALRY } from '../src/data/units.ts';
import { Unit } from '../src/entities/Unit.ts';
import { BuildingResourceCapacitySystem } from '../src/systems/BuildingResourceCapacitySystem.ts';
import { BuildingResourceRequirementSystem } from '../src/systems/BuildingResourceRequirementSystem.ts';
import { ResourceAccessSystem } from '../src/systems/ResourceAccessSystem.ts';
import {
  STRATEGIC_RESOURCE_CAPACITY_PER_SOURCE,
  StrategicResourceCapacitySystem,
} from '../src/systems/StrategicResourceCapacitySystem.ts';
import { TileType, type MapData, type Tile } from '../src/types/map.ts';
import type { TradeDeal } from '../src/types/tradeDeal.ts';

const NATION = 'nation_test';
const HORSES = 'horses';

/** Mutable map with `horseTiles` bare Horse tiles owned by NATION (quantity 1 each). */
function makeMap(horseTiles: number): { data: MapData; horseTileRefs: Tile[] } {
  const width = 6;
  const height = 4;
  const tiles = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x): Tile => ({ x, y, type: TileType.Plains })));
  const horseTileRefs: Tile[] = [];
  for (let i = 0; i < horseTiles; i += 1) {
    Object.assign(tiles[0][i], { resourceId: HORSES, ownerId: NATION });
    horseTileRefs.push(tiles[0][i]);
  }
  return { data: { width, height, tileSize: 1, tiles }, horseTileRefs };
}

/** Lightweight stand-in for CityManager (only the members the systems touch). */
class FakeCities {
  private readonly cities = new Map<string, { id: string; ownerId: string }>();
  private readonly buildings = new Map<string, string[]>();

  addCity(id: string, ownerId: string): void {
    this.cities.set(id, { id, ownerId });
    this.buildings.set(id, []);
  }

  addBuilding(cityId: string, buildingId: string): void {
    this.buildings.get(cityId)!.push(buildingId);
  }

  getCity(cityId: string): { id: string; ownerId: string } | undefined {
    return this.cities.get(cityId);
  }

  getCitiesByOwner(ownerId: string): ReadonlyArray<{ readonly id: string }> {
    return [...this.cities.values()].filter((c) => c.ownerId === ownerId);
  }

  getBuildings(cityId: string): { getAll(): readonly string[] } {
    const ids = this.buildings.get(cityId) ?? [];
    return { getAll: () => ids };
  }
}

interface Harness {
  access: ResourceAccessSystem;
  capacity: BuildingResourceCapacitySystem;
  cities: FakeCities;
  deals: TradeDeal[];
  horseTileRefs: Tile[];
  horses(): number;
}

/** Build a fully-wired resource-access + building-capacity harness. */
function makeHarness(horseTiles: number, stablesPerCity: readonly number[]): Harness {
  const { data, horseTileRefs } = makeMap(horseTiles);
  const deals: TradeDeal[] = [];
  const access = new ResourceAccessSystem(data, { getAllDeals: () => deals });
  const cities = new FakeCities();
  stablesPerCity.forEach((stables, index) => {
    const cityId = `city_${index}`;
    cities.addCity(cityId, NATION);
    for (let s = 0; s < stables; s += 1) cities.addBuilding(cityId, STABLE.id);
  });
  const capacity = new BuildingResourceCapacitySystem(
    cities,
    (nationId, resourceId) => access.getBaseResourceSourceCount(nationId, resourceId) >= 1,
  );
  access.setBuildingResourceCapacityBonusProvider((nationId, resourceId) =>
    capacity.getResourceCapacityBonus(nationId, resourceId),
  );
  return {
    access,
    capacity,
    cities,
    deals,
    horseTileRefs,
    horses: () => access.getResourceSourceCount(NATION, HORSES),
  };
}

// --- Data / definition ------------------------------------------------------

test('Stable declares the Horse capacity bonus and drops its old generic modifiers', () => {
  assert.deepEqual(STABLE.resourceCapacityBonus, {
    resourceId: HORSES,
    amount: STABLE_HORSE_CAPACITY_BONUS,
    requiresResourceAccessTo: HORSES,
  });
  assert.equal(STABLE_HORSE_CAPACITY_BONUS, 2);
  // Old placeholder Production %/Happiness effects are gone.
  assert.equal(STABLE.modifiers.productionPercent ?? 0, 0);
  assert.equal(STABLE.modifiers.happinessPerTurn ?? 0, 0);
  // Player-facing description communicates the requirement and the +2 effect.
  assert.match(STABLE.description, /Horses/);
  assert.match(STABLE.description, /\+2/);
});

// --- Core supply arithmetic (verification points 1, 3-7) --------------------

test('1. Nation with 0 Horse and 0 Stable has 0 Horse', () => {
  assert.equal(makeHarness(0, []).horses(), 0);
});

test('3. Nation with 1 base Horse and 0 Stable has 1 Horse', () => {
  assert.equal(makeHarness(1, [0]).horses(), 1);
});

test('4. Nation with 1 base Horse and 1 Stable has 3 Horses', () => {
  assert.equal(makeHarness(1, [1]).horses(), 3);
});

test('5. Nation with 1 base Horse and 2 Stables has 5 Horses', () => {
  assert.equal(makeHarness(1, [2]).horses(), 5);
});

test('6. Nation with 2 base Horses and 2 Stables has 6 Horses', () => {
  assert.equal(makeHarness(2, [2]).horses(), 6);
});

test('7. Stable bonuses stack across different cities (1 base + 3 Stables in 3 cities = 7)', () => {
  const harness = makeHarness(1, [1, 1, 1]);
  assert.equal(harness.horses(), 7);
});

// --- Access loss / regain (verification points 8, 9, 10, 11) ----------------

test('8/9/10. Losing the last Horse source disables Stable bonuses; regaining restores them', () => {
  const harness = makeHarness(1, [1, 1, 1]); // 1 base + 3 Stables = 7
  assert.equal(harness.horses(), 7);

  // Lose the only underlying Horse source (the Stables stay built).
  harness.horseTileRefs[0].ownerId = undefined;
  assert.equal(harness.access.getBaseResourceSourceCount(NATION, HORSES), 0);
  assert.equal(harness.horses(), 0, 'all Stable bonuses go dormant with no base access');

  // 9. Stables are not destroyed — they still physically exist.
  assert.equal(
    harness.cities.getBuildings('city_0').getAll().filter((id) => id === STABLE.id).length,
    1,
  );

  // 10. Regaining access reactivates every Stable bonus automatically.
  harness.horseTileRefs[0].ownerId = NATION;
  assert.equal(harness.horses(), 7);
});

test('11. Stable-generated Horses cannot satisfy their own underlying requirement', () => {
  // Stables present, but no genuine Horse source.
  const harness = makeHarness(0, [1, 1]);
  assert.equal(harness.access.getBaseResourceSourceCount(NATION, HORSES), 0);
  assert.equal(harness.horses(), 0);
  assert.equal(harness.access.hasResource(NATION, HORSES), false);
});

// --- Construction gating (verification points 2, 13, 14) --------------------

test('2/13/14. Stable construction requires genuine Horse access (shared human + AI gate)', () => {
  // Single source of truth consulted by both the human production block-reason
  // provider and the AI's canConstruct check.
  assert.equal(getBuildingRequiredResourceId(STABLE.id), HORSES);

  const cities = new FakeCities();
  cities.addCity('city_0', NATION);

  // No Horse access -> blocked.
  const noAccess = makeHarness(0, [0]);
  const gateBlocked = new BuildingResourceRequirementSystem(cities as never, noAccess.access);
  assert.equal(gateBlocked.hasRequiredResourceAccess(NATION, STABLE.id), false);
  assert.equal(gateBlocked.getConstructionBlockReason('city_0', STABLE.id), 'Requires Horses');

  // With Horse access -> allowed.
  const withAccess = makeHarness(1, [0]);
  const gateOpen = new BuildingResourceRequirementSystem(cities as never, withAccess.access);
  assert.equal(gateOpen.hasRequiredResourceAccess(NATION, STABLE.id), true);
  assert.equal(gateOpen.getConstructionBlockReason('city_0', STABLE.id), undefined);
});

// --- Consumption interaction (verification point 12) ------------------------

test('12. Strategic-resource consumption sees the increased Horse supply', () => {
  const harness = makeHarness(1, [2]); // 1 base + 2 Stables = 5 sources
  const units: Unit[] = [];
  const strategic = new StrategicResourceCapacitySystem(harness.access, { getUnitsByOwner: () => units });

  const capacity = strategic.getCapacity(NATION, HORSES);
  assert.equal(capacity.sources, 5);
  assert.equal(capacity.capacity, 5 * STRATEGIC_RESOURCE_CAPACITY_PER_SOURCE);
  assert.deepEqual(CAVALRY.requiredResource, { resourceId: HORSES, amount: 1 });
  assert.equal(strategic.canProduceUnit(NATION, CAVALRY), true);

  // Fill the whole 20-unit budget, then the 21st is refused — normal shortage
  // behavior over the enlarged supply (no attrition, no debt).
  for (let i = 0; i < capacity.capacity; i += 1) {
    units.push(new Unit({ id: `cav_${i}`, name: CAVALRY.name, ownerId: NATION, tileX: 0, tileY: 0, unitType: CAVALRY }));
  }
  assert.equal(strategic.getCapacity(NATION, HORSES).available, 0);
  assert.equal(strategic.canProduceUnit(NATION, CAVALRY), false);
});

// --- UI display + save/load derivation (verification points 15, 16) ---------

test('15. Resource display quantity equals the bonus-inclusive Horse total', () => {
  // The HUD/right-panel both read getResourceSourceCount for the shown quantity.
  const harness = makeHarness(1, [1]);
  assert.equal(harness.access.getResourceSourceCount(NATION, HORSES), 3);
});

test('16. Save/load never duplicates or loses Stable-generated capacity (pure derivation)', () => {
  // The bonus holds no persisted counter — reconstructing the systems from the
  // same building + access state yields the identical total.
  const { data } = makeMap(1);
  const deals: TradeDeal[] = [];
  const cities = new FakeCities();
  cities.addCity('city_0', NATION);
  cities.addBuilding('city_0', STABLE.id);
  cities.addCity('city_1', NATION);
  cities.addBuilding('city_1', STABLE.id);

  const build = (): number => {
    const access = new ResourceAccessSystem(data, { getAllDeals: () => deals });
    const capacity = new BuildingResourceCapacitySystem(
      cities,
      (nationId, resourceId) => access.getBaseResourceSourceCount(nationId, resourceId) >= 1,
    );
    access.setBuildingResourceCapacityBonusProvider((nationId, resourceId) =>
      capacity.getResourceCapacityBonus(nationId, resourceId),
    );
    return access.getResourceSourceCount(NATION, HORSES);
  };

  const before = build();
  const afterReload = build();
  assert.equal(before, 5); // 1 base + 2 Stables
  assert.equal(afterReload, before);
});

// --- Semantics of "genuine access" (imports count) --------------------------

test('Imported Horses count as genuine access under the canonical resource semantics', () => {
  const harness = makeHarness(0, [1]); // no owned Horse tiles, one Stable
  assert.equal(harness.horses(), 0, 'no domestic Horses, so the Stable is dormant');

  // Import one Horse via a trade deal — the canonical access path.
  harness.deals.push({
    id: 'deal_horse_import',
    sellerNationId: 'nation_seller',
    buyerNationId: NATION,
    resourceId: HORSES,
    goldPerTurn: 2,
    startTurn: 0,
    remainingTurns: 5,
  });
  assert.equal(harness.access.getBaseResourceSourceCount(NATION, HORSES), 1);
  assert.equal(harness.horses(), 3, 'imported Horse access activates the Stable bonus (+2)');
});
