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
  participatingNationIds: string[];
  participants: GamesOfNationsParticipantState[];
}
