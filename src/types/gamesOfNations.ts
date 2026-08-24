export type GamesOfNationsPhase =
  | 'inactive'
  | 'waitingForFirstGames'
  | 'preparation'
  | 'competition'
  | 'cooldown';

export type GamesOfNationsSport =
  | 'Wrestling'
  | 'Marathon'
  | 'Swimming'
  | 'Javelin'
  | 'Long Jump';

export type GamesOfNationsSportValues = Record<GamesOfNationsSport, number>;

export interface GamesOfNationsSportResult {
  sport: GamesOfNationsSport;
  resolved: boolean;
  competitionTurn?: number;
  goldNationId?: string;
  silverNationId?: string;
  bronzeNationId?: string;
  /** Diagnostic snapshot proving eligibility and lottery weights at resolution. */
  weights?: Record<string, number>;
}

export interface GamesOfNationsMedalStanding {
  nationId: string;
  gold: number;
  silver: number;
  bronze: number;
}

export const GAMES_MEDAL_POINTS = {
  gold: 5,
  silver: 3,
  bronze: 1,
} as const;

export interface CompletedGamesOfNationsRecord {
  gamesNumber: number;
  tournamentStartTurn: number;
  completionTurn: number;
  worldYear: number;
  yearLabel: string;
  hostNationId?: string;
  hostNationName: string;
  hostCityId?: string;
  hostCityName: string;
  overallWinnerNationId?: string;
  overallWinnerNationName?: string;
  hostBonusGamesPoints?: number;
  hostBonusSport?: GamesOfNationsSport;
  medalTable: Array<GamesOfNationsMedalStanding & { nationName: string }>;
}

export interface GamesOfNationsHistoricalStanding extends GamesOfNationsMedalStanding {
  nationName: string;
  totalMedals: number;
  points: number;
}

/** Per-cycle participation and preparation investment state. */
export interface GamesOfNationsParticipantState {
  nationId: string;
  participating: boolean;
  cultureCommitment: number;
  productionCommitment: number;
  sportAllocation: GamesOfNationsSportValues;
  gamesPointsBySport: GamesOfNationsSportValues;
  totalGamesPoints: number;
  totalCultureInvested: number;
  totalProductionInvested: number;
  failedCultureCommitmentTurns: number;
  failedProductionCommitmentTurns: number;
  strategyInitialized: boolean;
  /** Immutable values captured for this cycle's host-bonus calculation. */
  initialCultureCommitment?: number;
  initialProductionCommitment?: number;
  lastInvestmentTurn?: number;
  cultureDiversionThisTurn?: number;
  productionDiversionByCity?: Record<string, number>;
}

/** Plain serializable lifecycle state; contains no manager or UI references. */
export interface SavedGamesOfNationsState {
  founded: boolean;
  founderNationId?: string;
  foundedTurn?: number;
  firstGamesTurn?: number;
  phase: GamesOfNationsPhase;
  competitionNumber: number;
  phaseStartTurn?: number;
  nextTransitionTurn?: number;
  scheduledGamesTurn?: number;
  hostNationId?: string;
  hostCityId?: string;
  hostRotationOrder: string[];
  hostRotationIndex: number;
  participants: GamesOfNationsParticipantState[];
  activeSportIndex?: number;
  sportResults?: GamesOfNationsSportResult[];
  medalTable?: GamesOfNationsMedalStanding[];
  overallWinnerNationId?: string;
  hostBonusCalculated?: boolean;
  totalExternalInitialGamesPoints?: number;
  hostBonusGamesPoints?: number;
  hostBonusSport?: GamesOfNationsSport;
  completedGames?: CompletedGamesOfNationsRecord[];
  /** Last Games cycle for which the human answered the one-time Preparation prompt. */
  humanPreparationPromptAcknowledgedCompetitionNumber?: number;
  lastProcessedTurn: number;
}

export interface GamesOfNationsSummary {
  founded: boolean;
  founderNationId: string | null;
  foundedTurn: number | null;
  firstGamesTurn: number | null;
  phase: GamesOfNationsPhase;
  competitionNumber: number;
  hostNationId: string | null;
  hostCityId: string | null;
  phaseStartTurn: number | null;
  nextTransitionTurn: number | null;
  turnsUntilNextPhase: number | null;
  nextGamesTurn: number | null;
  turnsUntilGames: number | null;
  activeSport: GamesOfNationsSport | null;
  phaseProgressTurn: number | null;
  phaseTotalTurns: number | null;
  preparationActive: boolean;
  humanPreparationPromptAcknowledgedCompetitionNumber: number | null;
  sportResults: GamesOfNationsSportResult[];
  medalTable: GamesOfNationsMedalStanding[];
  overallWinnerNationId: string | null;
  competitionComplete: boolean;
  hostBonusCalculated: boolean;
  hostBonusRate: number;
  totalExternalInitialGamesPoints: number;
  hostBonusGamesPoints: number;
  hostBonusSport: GamesOfNationsSport | null;
  hostEffectiveGamesPoints: number | null;
  completedGamesCount: number;
  completedGames: CompletedGamesOfNationsRecord[];
  historicalMedalStandings: GamesOfNationsHistoricalStanding[];
  participatingNationIds: string[];
  participants: GamesOfNationsParticipantState[];
}
