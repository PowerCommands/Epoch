export type GamesOfNationsPhase =
  | 'inactive'
  | 'waitingForFirstGames'
  | 'preparation'
  | 'competition'
  | 'cancelled'
  | 'cooldown';

export type GamesOfNationsHostingDecision =
  | 'pendingDecision'
  | 'pendingCity'
  | 'confirmed'
  | 'cancelled';

export type GamesOfNationsSport =
  | 'Wrestling'
  | 'Marathon'
  | 'Swimming'
  | 'Javelin'
  | 'Long Jump'
  | 'Horse Racing'
  | 'Boxing'
  | '100 Metres'
  | 'Pole Vault'
  | 'Fencing';

export type GamesOfNationsSportId =
  | 'wrestling'
  | 'marathon'
  | 'swimming'
  | 'javelin'
  | 'long_jump'
  | 'horse_racing'
  | 'boxing'
  | 'hundred_metres'
  | 'pole_vault'
  | 'fencing';

export type GamesOfNationsIntroductionEra =
  | 'renaissance' | 'industrial' | 'modern' | 'atomic' | 'information' | 'future';

export interface GamesOfNationsLeaderPreferences {
  traditionalFavourite: GamesOfNationsSportId;
  additionalFavourite: GamesOfNationsSportId;
}

export interface GamesOfNationsAuctionProposal {
  nationId: string;
  sportId: GamesOfNationsSportId;
  bid: number;
  preferenceStrength: number;
}

export interface GamesOfNationsSportAuction {
  id: string;
  triggerEra: GamesOfNationsIntroductionEra;
  trigger: 'era' | 'futureHostingCycle';
  turn: number;
  gamesNumber: number;
  proposals: GamesOfNationsAuctionProposal[];
  candidateSportIds: GamesOfNationsSportId[];
  resolved: boolean;
}

export interface GamesOfNationsSportIntroductionRecord {
  sportId: GamesOfNationsSportId;
  introducingNationId: string;
  winningBid: number;
  era: GamesOfNationsIntroductionEra;
  turn: number;
  worldYear: number;
  yearLabel: string;
  introducedForGamesNumber: number;
}

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
  /** Omitted by legacy saves and treated as completed during normalization. */
  status?: 'completed' | 'cancelled';
  cancellationReason?: string;
  gamesNumber: number;
  tournamentStartTurn: number;
  completionTurn: number;
  worldYear: number;
  yearLabel: string;
  hostNationId?: string;
  hostNationName: string;
  hostCityId?: string;
  hostCityName: string;
  /** Diagnostic/flavor metadata; true when hosting reused infrastructure present at selection. */
  usedExistingGrandStadium?: boolean;
  overallWinnerNationId?: string;
  overallWinnerNationName?: string;
  hostBonusGamesPoints?: number;
  hostBonusSport?: GamesOfNationsSport;
  sportIds?: GamesOfNationsSportId[];
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
  /** @deprecated Legacy percentage-save input only; discarded during normalization. */
  sportAllocation?: GamesOfNationsSportValues;
  /** Earned normal GP not yet irreversibly committed to a sport. */
  unallocatedGamesPoints: number;
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
  gamesPointsGeneratedThisTurn?: number;
}

/** Plain serializable lifecycle state; contains no manager or UI references. */
export interface SavedGamesOfNationsState {
  hostingSchemaVersion?: 1;
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
  hostingGamesNumber?: number;
  hostCandidateNationId?: string;
  offeredHostNationIds?: string[];
  declinedHostNationIds?: string[];
  hostingDecision?: GamesOfNationsHostingDecision;
  upcomingHostNationId?: string;
  upcomingHostCityId?: string;
  hostUsedExistingGrandStadium?: boolean;
  upcomingHostUsedExistingGrandStadium?: boolean;
  hostingCancellationReason?: string;
  cancellationReason?: string;
  stadiumRequirementGrandfathered?: boolean;
  hostingAnnouncementEmittedGamesNumber?: number;
  /** A Council-delayed future cycle whose schedule must survive the current cycle ending. */
  worldCouncilScheduleGamesNumber?: number;
  pendingWorldCouncilHostReplacement?: {
    gamesNumber: number;
    previousHostNationId: string;
    newHostNationId: string;
  };
  /** One-Games political exclusions; the number prevents leakage into later cycles. */
  excludedGamesNumber?: number;
  excludedNationIds?: string[];
  cancellationEventEmittedGamesNumber?: number;
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
  introducedAdditionalSportIds?: GamesOfNationsSportId[];
  sportIntroductionRecords?: GamesOfNationsSportIntroductionRecord[];
  processedSportIntroductionEras?: GamesOfNationsIntroductionEra[];
  frozenSportIds?: GamesOfNationsSportId[];
  pendingSportAuction?: GamesOfNationsSportAuction;
  futureFallbackActive?: boolean;
  lastFutureFallbackHostingGamesNumber?: number;
  /** Last Games cycle for which the human answered the one-time Preparation prompt. */
  humanPreparationPromptAcknowledgedCompetitionNumber?: number;
  lastProcessedTurn: number;
}

export interface GamesOfNationsSummary {
  founded: boolean;
  humanInteractionSuppressed: boolean;
  founderNationId: string | null;
  foundedTurn: number | null;
  firstGamesTurn: number | null;
  phase: GamesOfNationsPhase;
  competitionNumber: number;
  hostNationId: string | null;
  hostCityId: string | null;
  hostingGamesNumber: number | null;
  hostCandidateNationId: string | null;
  offeredHostNationIds: string[];
  declinedHostNationIds: string[];
  hostingDecision: GamesOfNationsHostingDecision | null;
  excludedGamesNumber?: number | null;
  excludedNationIds?: string[];
  upcomingHostNationId: string | null;
  upcomingHostCityId: string | null;
  stadiumExists: boolean;
  stadiumCompleted: boolean;
  stadiumExistingInfrastructure?: boolean;
  competitionDeadline: number | null;
  cancellationReason: string | null;
  stadiumRequirementGrandfathered: boolean;
  phaseStartTurn: number | null;
  nextTransitionTurn: number | null;
  turnsUntilNextPhase: number | null;
  nextGamesTurn: number | null;
  turnsUntilGames: number | null;
  activeSport: GamesOfNationsSport | null;
  activeSports: GamesOfNationsSport[];
  activeSportIds: GamesOfNationsSportId[];
  introducedAdditionalSportIds: GamesOfNationsSportId[];
  remainingAdditionalSportIds: GamesOfNationsSportId[];
  sportIntroductionRecords: GamesOfNationsSportIntroductionRecord[];
  processedSportIntroductionEras: GamesOfNationsIntroductionEra[];
  futureFallbackActive: boolean;
  pendingSportAuction: GamesOfNationsSportAuction | null;
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
  /** Diagnostic effective weights: committed normal GP plus any locked host bonus. */
  effectiveGamesPointsByNation: Record<string, GamesOfNationsSportValues>;
}
