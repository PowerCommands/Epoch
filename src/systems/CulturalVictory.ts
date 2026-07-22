import type { WonderSystem } from './WonderSystem';

/** Current-state thresholds for Cultural Victory. All must be met together. */
export const CULTURAL_VICTORY_REQUIRED_CULTURE = 75_000;
export const CULTURAL_VICTORY_REQUIRED_WONDERS = 8;

/** Minimal city-ownership lookup, satisfied by CityManager. */
interface CityOwnerLookup {
  getCity(cityId: string): { ownerId: string } | undefined;
}

export function getRequiredCulturalVictoryWonderCount(): number {
  return CULTURAL_VICTORY_REQUIRED_WONDERS;
}

/**
 * How many completed World Wonders a nation currently owns. Ownership is always
 * derived from current city ownership — a completed wonder counts for whichever
 * nation owns the city containing it right now, so conquering or losing a wonder
 * city transfers ownership with no special tracking.
 */
export function getOwnedWonderCount(
  nationId: string,
  wonderSystem: WonderSystem,
  cityLookup: CityOwnerLookup,
): number {
  let owned = 0;
  for (const state of wonderSystem.getCompletedWonders()) {
    if (state.broken) continue; // broken wonders don't count toward cultural victory/ranking
    const city = cityLookup.getCity(state.cityId);
    if (city && city.ownerId === nationId) owned += 1;
  }
  return owned;
}
