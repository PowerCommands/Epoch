export interface DominationRankableNation {
  id: string;
  name: string;
}

export interface DominationRankableCapital {
  ownerId: string;
}

export interface DominationRankingEntry {
  nationId: string;
  capitalCount: number;
  militaryStrength: number;
}

/** Shared ordering used by the Domination leaderboard and newspaper tie-breaks. */
export function buildDominationRanking(
  nations: readonly DominationRankableNation[],
  capitals: readonly DominationRankableCapital[],
  getMilitaryStrength: (nationId: string) => number,
): DominationRankingEntry[] {
  return nations.map((nation) => ({
    nationId: nation.id,
    capitalCount: capitals.filter((capital) => capital.ownerId === nation.id).length,
    militaryStrength: getMilitaryStrength(nation.id),
    nationName: nation.name,
  })).sort((a, b) =>
    b.capitalCount - a.capitalCount
      || b.militaryStrength - a.militaryStrength
      || a.nationName.localeCompare(b.nationName),
  ).map(({ nationName: _nationName, ...entry }) => entry);
}
