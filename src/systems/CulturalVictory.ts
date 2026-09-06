import type { WonderSystem } from './WonderSystem';

/** Current-state thresholds for the normal multi-part Cultural Victory route. */
export const CULTURAL_VICTORY_REQUIRED_CULTURE = 100_000;
export const CULTURAL_VICTORY_REQUIRED_WONDERS = 8;
/** Extreme fallback: Culture alone is sufficient at this absolute threshold. */
export const OVERWHELMING_CULTURE_VICTORY_THRESHOLD = 250_000;

/**
 * Resolve a scenario-authored normal-route Culture requirement (finite, > 0),
 * falling back to {@link CULTURAL_VICTORY_REQUIRED_CULTURE} when absent/invalid.
 */
export function resolveCulturalVictoryRequiredCulture(value: number | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return CULTURAL_VICTORY_REQUIRED_CULTURE;
}

/**
 * Resolve a scenario-authored overwhelming-route Culture threshold (finite, > 0),
 * falling back to {@link OVERWHELMING_CULTURE_VICTORY_THRESHOLD} when absent/invalid.
 */
export function resolveOverwhelmingCultureVictoryThreshold(value: number | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return OVERWHELMING_CULTURE_VICTORY_THRESHOLD;
}

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
