/** Authored membership protects a particular government; the antagonist is a nation. */
export interface MutualFoeAgreement {
  id: string;
  name: string;
  antagonistNationId: string;
  supportPercent: number;
  memberLeaderIds: string[];
}

/** Only active crises are saved. Definitions and canonical geopolitical state live elsewhere. */
export interface MutualFoeCrisis {
  agreementId: string;
  antagonistNationId: string;
  defendedNationId: string;
  defendedLeaderId: string;
  /** Canonical relation's war-start round (Epoch has no separate war ID). */
  warStartedRound: number | null;
  /** Signatory leader IDs whose initial reserve transfer was processed (including zero Gold). */
  initialContributors: string[];
  /** Irreversible within this crisis, even after peace or a temporary leadership absence. */
  fulfilledByWarLeaderIds: string[];
  /** Prevent repeated income settlement for the same donor turn, including after load. */
  lastContributionRoundByNation: Record<string, number>;
}

export interface MutualFoeGoldBreakdown {
  outgoing: number;
  incoming: number;
}
