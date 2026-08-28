/**
 * Small, self-contained layer that turns a nation's *current access* to
 * manufactured resources into gameplay effects. Access is whatever the
 * ResourceAccessSystem reports, so domestically produced units and imported
 * units behave identically, and losing access (trade ended, boycott, embargo,
 * war) automatically removes the effect.
 *
 * Every effect is declared in one table below as `(resource, effect, amount
 * per unit)`. The four effect kinds reuse two integration paths:
 *   - `happiness` / `gold` are national totals (see getManufacturedEffectTotal).
 *   - `food` / `production` are national totals distributed across the nation's
 *     cities with the same deterministic ordering (see distributeAcrossCities).
 *
 * Aerospace Parts are intentionally absent: they keep their dedicated Science
 * Victory purpose and must not be routed through these effects.
 */

export const TRADE_GOODS_ID = 'trade_goods';
export const MARITIME_GOODS_ID = 'maritime_goods';

export type ManufacturedEffectType = 'happiness' | 'food' | 'production' | 'gold';

export interface ManufacturedResourceEffect {
  readonly resourceId: string;
  readonly effect: ManufacturedEffectType;
  /** Effect contributed by each available unit of the resource. */
  readonly amountPerUnit: number;
}

/**
 * The single source of truth for manufactured-resource gameplay effects. To
 * give a resource an effect (or tune one), edit this table — no other system
 * needs a resource-specific branch.
 */
export const MANUFACTURED_RESOURCE_EFFECTS: readonly ManufacturedResourceEffect[] = [
  { resourceId: TRADE_GOODS_ID, effect: 'happiness', amountPerUnit: 1 },
  { resourceId: MARITIME_GOODS_ID, effect: 'food', amountPerUnit: 1 },
  { resourceId: 'engineered_goods', effect: 'production', amountPerUnit: 1 }, // displayed as "Tools"
  { resourceId: 'colonial_goods', effect: 'happiness', amountPerUnit: 2 },
  { resourceId: 'banking_services', effect: 'gold', amountPerUnit: 10 },
  { resourceId: 'refined_fuel', effect: 'production', amountPerUnit: 10 },
  { resourceId: 'steel_goods', effect: 'production', amountPerUnit: 5 },
  { resourceId: 'vehicles', effect: 'happiness', amountPerUnit: 5 },
  { resourceId: 'chips', effect: 'production', amountPerUnit: 20 },
  { resourceId: 'media', effect: 'happiness', amountPerUnit: 10 },
];

const EFFECT_BY_RESOURCE_ID = new Map<string, ManufacturedResourceEffect>(
  MANUFACTURED_RESOURCE_EFFECTS.map((entry) => [entry.resourceId, entry]),
);

const EFFECT_LABELS: Readonly<Record<ManufacturedEffectType, string>> = {
  happiness: 'Happiness',
  food: 'Food',
  production: 'Production',
  gold: 'Gold',
};

export function getManufacturedResourceEffect(
  resourceId: string,
): ManufacturedResourceEffect | undefined {
  return EFFECT_BY_RESOURCE_ID.get(resourceId);
}

/** Short player-facing summary, e.g. "+2 Happiness per unit" or "+10 Gold/turn per unit". */
export function getManufacturedResourceEffectSummary(resourceId: string): string | undefined {
  const effect = EFFECT_BY_RESOURCE_ID.get(resourceId);
  if (!effect) return undefined;
  const suffix = effect.effect === 'gold' ? '/turn' : '';
  return `+${effect.amountPerUnit} ${EFFECT_LABELS[effect.effect]}${suffix} per unit`;
}

/**
 * The single fact this layer needs from the resource economy: how many units of
 * a manufactured resource the nation currently has access to. Kept as a narrow
 * interface so `ResourceAccessSystem` satisfies it without a hard dependency.
 */
export interface ManufacturedResourceAccess {
  getResourceSourceCount(nationId: string, resourceId: string): number;
}

/**
 * Sum, across every manufactured resource of the given effect type, the
 * nation's available quantity times that resource's per-unit amount. This is
 * the national bonus for `happiness`/`gold`, and the total number of units to
 * distribute for `food`/`production`.
 */
export function getManufacturedEffectTotal(
  access: ManufacturedResourceAccess,
  nationId: string,
  effect: ManufacturedEffectType,
): number {
  let total = 0;
  for (const entry of MANUFACTURED_RESOURCE_EFFECTS) {
    if (entry.effect !== effect) continue;
    total += access.getResourceSourceCount(nationId, entry.resourceId) * entry.amountPerUnit;
  }
  return total;
}

/** A city as seen by the deterministic per-city distributor. */
export interface DistributableCity {
  readonly id: string;
  readonly population: number;
  /** True when the city is below its effective population capacity. */
  readonly canGrow: boolean;
  /** Higher means the city was founded later (younger). */
  readonly creationOrder: number;
}

/**
 * Derive a deterministic, monotonically increasing creation order from a city
 * id. Founded cities carry an incrementing suffix (`..._founded_<n>`); scenario
 * capitals have none and are treated as the oldest (order 0). This is the
 * "youngest city" signal without adding new persisted state to City.
 */
export function getCityCreationOrder(cityId: string): number {
  const match = /_founded_(\d+)$/.exec(cityId);
  return match ? Number(match[1]) : 0;
}

/**
 * Distribute `totalUnits` points of a yield (Food or Production) across a
 * nation's cities using a deterministic priority:
 *   1. Cities that can still grow are served before cities already at capacity.
 *   2. Lowest population first.
 *   3. If tied, youngest city first.
 *   4. If still tied, stable city-id order.
 * The ordered pool is repeated until every unit is placed, so the total handed
 * out always equals `totalUnits`. When no city can grow, the same ordering
 * simply continues over all cities. (This is the mechanism originally built for
 * Maritime Goods Food; Production yields reuse it unchanged.)
 */
export function distributeAcrossCities(
  cities: readonly DistributableCity[],
  totalUnits: number,
): Map<string, number> {
  const distribution = new Map<string, number>();
  if (totalUnits <= 0 || cities.length === 0) return distribution;

  const growing = cities.filter((city) => city.canGrow);
  const pool = (growing.length > 0 ? growing : [...cities]).sort(compareDistributionPriority);

  for (let placed = 0; placed < totalUnits; placed += 1) {
    const city = pool[placed % pool.length];
    distribution.set(city.id, (distribution.get(city.id) ?? 0) + 1);
  }
  return distribution;
}

function compareDistributionPriority(a: DistributableCity, b: DistributableCity): number {
  if (a.population !== b.population) return a.population - b.population;
  if (a.creationOrder !== b.creationOrder) return b.creationOrder - a.creationOrder;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}
