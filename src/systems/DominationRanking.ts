/** Default Domination land-control threshold (percent of all land tiles). */
export const DEFAULT_DOMINATION_LAND_PERCENT = 20;
/** Default number of direct vassal states required for Domination Victory. */
export const DEFAULT_DOMINATION_REQUIRED_VASSALS = 3;

/**
 * Resolve a scenario-authored Domination land-control percentage (1–100),
 * falling back to {@link DEFAULT_DOMINATION_LAND_PERCENT} when absent/invalid.
 */
export function resolveDominationLandPercent(value: number | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 100) {
    return value;
  }
  return DEFAULT_DOMINATION_LAND_PERCENT;
}

/**
 * Resolve a scenario-authored Domination required-vassal count (integer ≥ 1),
 * falling back to {@link DEFAULT_DOMINATION_REQUIRED_VASSALS} when absent/invalid.
 */
export function resolveDominationRequiredVassals(value: number | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 1) {
    return value;
  }
  return DEFAULT_DOMINATION_REQUIRED_VASSALS;
}

export interface DominationRankableNation {
  id: string;
  name: string;
}

/** Scenario-configured Domination Victory thresholds. Either route wins. */
export interface DominationVictoryConfig {
  /** Direct vassal states required to win (integer ≥ 1). */
  requiredVassals: number;
  /** Percentage (1–100) of all land tiles required to win. */
  requiredLandPercent: number;
}

/**
 * Authoritative land-ownership lookup shared by the victory check, the
 * leaderboard, and the land-control pie chart so they can never drift apart.
 * Built from {@link NationManager.getLandControlStats}.
 */
export interface LandControlLookup {
  /** Total existing land tiles on the map (neutral land included). */
  totalLandTiles: number;
  /** Land tiles currently owned by the given nation (0 when none). */
  getControlledLandTiles(nationId: string): number;
}

export interface DominationProgress {
  nationId: string;
  directVassalCount: number;
  requiredVassalCount: number;
  controlledLandTiles: number;
  totalLandTiles: number;
  landControlPercent: number;
  requiredLandControlPercent: number;
  vassalRequirementMet: boolean;
  landRequirementMet: boolean;
  fulfilled: boolean;
}

export interface DominationRankingEntry extends DominationProgress {
  militaryStrength: number;
}

export type VassalHostResolver = (nationId: string) => string | undefined;

/**
 * Authoritative, current-state Domination calculation. A nation fulfils the
 * condition when it satisfies EITHER configured route:
 *   direct vassals >= required vassals
 *   OR controlled land tiles / all land tiles >= required percentage.
 *
 * `nations` must be the game's living participant list; eliminated nations
 * therefore disappear from both the vassal tally and the land-control lookup
 * without permanent conquest bookkeeping.
 */
export function getDominationProgress(
  nations: readonly DominationRankableNation[],
  candidateNationId: string,
  getVassalHost: VassalHostResolver,
  config: DominationVictoryConfig,
  land: LandControlLookup,
): DominationProgress {
  const candidateIsLiving = nations.some((nation) => nation.id === candidateNationId);
  const directVassalCount = candidateIsLiving
    ? nations.filter(
        (nation) => nation.id !== candidateNationId && getVassalHost(nation.id) === candidateNationId,
      ).length
    : 0;

  const totalLandTiles = land.totalLandTiles;
  const controlledLandTiles = candidateIsLiving ? land.getControlledLandTiles(candidateNationId) : 0;
  const landControlPercent = totalLandTiles > 0 ? (controlledLandTiles / totalLandTiles) * 100 : 0;

  const requiredVassalCount = config.requiredVassals;
  const requiredLandControlPercent = config.requiredLandPercent;
  const vassalRequirementMet = candidateIsLiving && directVassalCount >= requiredVassalCount;
  const landRequirementMet = candidateIsLiving && landControlPercent >= requiredLandControlPercent;

  return {
    nationId: candidateNationId,
    directVassalCount,
    requiredVassalCount,
    controlledLandTiles,
    totalLandTiles,
    landControlPercent,
    requiredLandControlPercent,
    vassalRequirementMet,
    landRequirementMet,
    fulfilled: vassalRequirementMet || landRequirementMet,
  };
}

/**
 * Shared ordering used by victory checks/UI/diagnostics and newspaper tie-breaks.
 * Ranking is by direct vassal count, then land-control percentage, then a
 * deterministic name tie-breaker. Military strength is informational only and
 * never affects the order.
 */
export function buildDominationRanking(
  nations: readonly DominationRankableNation[],
  getVassalHost: VassalHostResolver,
  config: DominationVictoryConfig,
  land: LandControlLookup,
  getMilitaryStrength: (nationId: string) => number,
): DominationRankingEntry[] {
  return nations.map((nation) => ({
    ...getDominationProgress(nations, nation.id, getVassalHost, config, land),
    militaryStrength: getMilitaryStrength(nation.id),
    nationName: nation.name,
  })).sort((a, b) =>
    b.directVassalCount - a.directVassalCount
      || b.landControlPercent - a.landControlPercent
      || a.nationName.localeCompare(b.nationName),
  ).map(({ nationName: _nationName, ...entry }) => entry);
}
