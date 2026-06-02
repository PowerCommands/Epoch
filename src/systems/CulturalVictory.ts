import { ALL_WONDERS } from '../data/wonders';
import type { WonderSystem } from './WonderSystem';

/**
 * Fraction of all World Wonders a nation must own to win a Cultural Victory.
 * Tuned to 0.74 with a floor so the canonical 12-wonder set requires 8
 * (floor(12 * 0.74) = 8) — "roughly three quarters" while keeping the magic
 * number a clean 8.
 */
export const CULTURAL_VICTORY_WONDER_FRACTION = 0.74;

/** Minimal city-ownership lookup, satisfied by CityManager. */
interface CityOwnerLookup {
  getCity(cityId: string): { ownerId: string } | undefined;
}

/**
 * World Wonders required to win a Cultural Victory: floor(74% of all defined
 * wonders) — 8 for the current 12. Derived from `ALL_WONDERS` so adding wonders
 * raises the threshold automatically. This is the single source of truth — use
 * it everywhere instead of duplicating the calculation.
 */
export function getRequiredCulturalVictoryWonderCount(): number {
  return Math.floor(ALL_WONDERS.length * CULTURAL_VICTORY_WONDER_FRACTION);
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
    const city = cityLookup.getCity(state.cityId);
    if (city && city.ownerId === nationId) owned += 1;
  }
  return owned;
}
