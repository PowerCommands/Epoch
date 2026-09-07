import { getBuildingById } from '../data/buildings';

/** Minimal city/building view this system needs (satisfied by CityManager). */
export interface BuildingResourceCapacityCityProvider {
  getCitiesByOwner(ownerId: string): ReadonlyArray<{ readonly id: string }>;
  getBuildings(cityId: string): { getAll(): readonly string[] };
}

/**
 * True when the nation has genuine, non-amplified access to a resource — i.e.
 * from map ownership, imports or manufacturing, NOT from a building bonus. Must
 * be backed by {@link ../systems/ResourceAccessSystem#getBaseResourceSourceCount}
 * so a building bonus can never satisfy its own requirement.
 */
export type BaseResourceAccessPredicate = (nationId: string, resourceId: string) => boolean;

/**
 * Aggregates the data-driven {@link BuildingType.resourceCapacityBonus} of a
 * nation's active buildings into an additive strategic-resource supply bonus.
 *
 * The single rule (no per-building special casing anywhere): each active
 * building that declares a `resourceCapacityBonus` for the queried resource adds
 * its `amount`, but only while the nation has genuine underlying access to that
 * bonus's `requiresResourceAccessTo` resource. A building whose gating resource
 * is unavailable simply contributes nothing — it is never removed, and its bonus
 * reactivates automatically when access returns.
 *
 * This is the sole consumer of `resourceCapacityBonus`; the resource systems
 * read only the aggregate through {@link ResourceAccessSystem}.
 */
export class BuildingResourceCapacitySystem {
  constructor(
    private readonly cityProvider: BuildingResourceCapacityCityProvider,
    private readonly hasBaseResourceAccess: BaseResourceAccessPredicate,
  ) {}

  /** Total additive supply of `resourceId` granted by the nation's active buildings. */
  getResourceCapacityBonus(nationId: string, resourceId: string): number {
    // Cache per-gating-resource access checks so multiple contributing buildings
    // (e.g. many Stables all gated on Horses) resolve the gate at most once.
    const accessCache = new Map<string, boolean>();
    const hasAccess = (gatingResourceId: string): boolean => {
      const cached = accessCache.get(gatingResourceId);
      if (cached !== undefined) return cached;
      const value = this.hasBaseResourceAccess(nationId, gatingResourceId);
      accessCache.set(gatingResourceId, value);
      return value;
    };

    let bonus = 0;
    for (const city of this.cityProvider.getCitiesByOwner(nationId)) {
      for (const buildingId of this.cityProvider.getBuildings(city.id).getAll()) {
        const capacityBonus = getBuildingById(buildingId)?.resourceCapacityBonus;
        if (!capacityBonus || capacityBonus.resourceId !== resourceId) continue;
        if (!hasAccess(capacityBonus.requiresResourceAccessTo)) continue;
        bonus += capacityBonus.amount;
      }
    }
    return bonus;
  }
}
