import type { UnitType } from '../entities/UnitType';

/**
 * Military food upkeep — a national demographic cost of maintaining armed forces.
 *
 * This module is pure and rendering/manager free so the allocation math can be
 * tested in isolation. It deliberately does NOT reuse the gold-upkeep modifiers
 * (territory doubling, army oversize, distance, war): food upkeep is simply the
 * sum of the units' defined {@link UnitType.foodUpkeep} values.
 *
 * The national growth food is the combined positive per-city food surplus minus
 * this upkeep, floored at zero — military upkeep only suppresses population
 * growth, it never causes starvation, population loss or negative food storage.
 */

/** Food upkeep of a single unit type on the 0–3 scale. */
export function getUnitFoodUpkeep(unitType: UnitType): number {
  return unitType.foodUpkeep ?? 0;
}

/** Sums {@link getUnitFoodUpkeep} across the given (military + civilian) units. */
export function calculateMilitaryFoodUpkeep(
  units: readonly { readonly unitType: UnitType }[],
): number {
  return units.reduce((sum, unit) => sum + getUnitFoodUpkeep(unit.unitType), 0);
}

/** One city's positive food surplus available to drive population growth. */
export interface CityFoodSurplus {
  readonly cityId: string;
  /** Non-negative food this city contributes to the national growth pool. */
  readonly surplus: number;
}

export interface GrowthFoodAllocation {
  /** Growth food granted back to each city (keyed by city id). */
  readonly allocations: ReadonlyMap<string, number>;
  /** Combined positive city food surplus before military upkeep. */
  readonly civilianSurplus: number;
  /** National military food upkeep that was subtracted. */
  readonly militaryUpkeep: number;
  /** Growth food remaining after upkeep = max(0, civilianSurplus - upkeep). */
  readonly growthFood: number;
}

/**
 * Distributes the national growth food (combined positive city surplus minus
 * military upkeep) back to the cities that produced it.
 *
 * Properties (deterministic, integer-only):
 * - `growthFood = max(0, civilianSurplus - militaryUpkeep)` — never negative.
 * - `sum(allocations) === growthFood` whenever there is surplus to allocate.
 * - No city receives more than its own original positive surplus.
 * - Cities with a larger surplus receive a larger share (largest-remainder /
 *   Hamilton apportionment), with a stable city-id tie-break so map/iteration
 *   order can never change the result.
 */
export function distributeGrowthFood(
  citySurpluses: readonly CityFoodSurplus[],
  militaryUpkeep: number,
): GrowthFoodAllocation {
  const upkeep = Math.max(0, Math.floor(militaryUpkeep));
  const civilianSurplus = citySurpluses.reduce(
    (sum, city) => sum + Math.max(0, Math.floor(city.surplus)),
    0,
  );
  const growthFood = Math.max(0, civilianSurplus - upkeep);

  const allocations = new Map<string, number>();
  for (const city of citySurpluses) {
    allocations.set(city.cityId, 0);
  }

  if (civilianSurplus <= 0 || growthFood <= 0) {
    return { allocations, civilianSurplus, militaryUpkeep: upkeep, growthFood };
  }

  // When nothing is consumed each city simply keeps its full surplus.
  if (growthFood >= civilianSurplus) {
    for (const city of citySurpluses) {
      allocations.set(city.cityId, Math.max(0, Math.floor(city.surplus)));
    }
    return { allocations, civilianSurplus, militaryUpkeep: upkeep, growthFood };
  }

  // Proportional integer floors via exact integer arithmetic: the fractional
  // part of `surplus * growthFood / civilianSurplus` is captured as a remainder
  // so no floating-point rounding enters the deterministic result.
  const shares = citySurpluses.map((city) => {
    const surplus = Math.max(0, Math.floor(city.surplus));
    const scaled = surplus * growthFood;
    return {
      cityId: city.cityId,
      surplus,
      base: Math.floor(scaled / civilianSurplus),
      remainder: scaled % civilianSurplus,
    };
  });

  let assigned = 0;
  for (const share of shares) {
    allocations.set(share.cityId, share.base);
    assigned += share.base;
  }

  // Hand out the leftover units one at a time to the largest remainders first,
  // breaking ties by city id, and never exceeding a city's own surplus.
  let leftover = growthFood - assigned;
  const ordered = [...shares].sort((a, b) => {
    if (a.remainder !== b.remainder) return b.remainder - a.remainder;
    return a.cityId.localeCompare(b.cityId);
  });
  for (const share of ordered) {
    if (leftover <= 0) break;
    const current = allocations.get(share.cityId) ?? 0;
    if (current >= share.surplus) continue;
    allocations.set(share.cityId, current + 1);
    leftover -= 1;
  }

  return { allocations, civilianSurplus, militaryUpkeep: upkeep, growthFood };
}
