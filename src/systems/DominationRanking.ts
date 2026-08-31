export interface DominationRankableNation {
  id: string;
  name: string;
}

export interface DominationProgress {
  nationId: string;
  directVassalCount: number;
  otherLivingNationCount: number;
  fulfilled: boolean;
}

export interface DominationRankingEntry extends DominationProgress {
  militaryStrength: number;
}

export type VassalHostResolver = (nationId: string) => string | undefined;

/**
 * Authoritative, current-state Domination calculation. `nations` must be the
 * game's living participant list; eliminated nations therefore disappear from
 * both numerator and denominator without permanent conquest bookkeeping.
 */
export function getDominationProgress(
  nations: readonly DominationRankableNation[],
  candidateNationId: string,
  getVassalHost: VassalHostResolver,
): DominationProgress {
  const candidateIsLiving = nations.some((nation) => nation.id === candidateNationId);
  const otherLivingNations = candidateIsLiving
    ? nations.filter((nation) => nation.id !== candidateNationId)
    : [];
  const directVassalCount = otherLivingNations.filter(
    (nation) => getVassalHost(nation.id) === candidateNationId,
  ).length;
  const otherLivingNationCount = otherLivingNations.length;
  return {
    nationId: candidateNationId,
    directVassalCount,
    otherLivingNationCount,
    // A sole surviving nation does not win Domination by default.
    fulfilled: candidateIsLiving
      && otherLivingNationCount > 0
      && directVassalCount === otherLivingNationCount,
  };
}

/** Shared ordering used by victory checks/UI diagnostics and newspaper tie-breaks. */
export function buildDominationRanking(
  nations: readonly DominationRankableNation[],
  getVassalHost: VassalHostResolver,
  getMilitaryStrength: (nationId: string) => number,
): DominationRankingEntry[] {
  return nations.map((nation) => ({
    ...getDominationProgress(nations, nation.id, getVassalHost),
    militaryStrength: getMilitaryStrength(nation.id),
    nationName: nation.name,
  })).sort((a, b) =>
    b.directVassalCount - a.directVassalCount
      || b.militaryStrength - a.militaryStrength
      || a.nationName.localeCompare(b.nationName),
  ).map(({ nationName: _nationName, ...entry }) => entry);
}
