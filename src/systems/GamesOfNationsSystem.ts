import {
  GAMES_MEDAL_POINTS,
  type CompletedGamesOfNationsRecord,
  type GamesOfNationsHistoricalStanding,
  type GamesOfNationsParticipantState,
  type GamesOfNationsSport,
  type GamesOfNationsSportId,
  type GamesOfNationsIntroductionEra,
  type GamesOfNationsLeaderPreferences,
  type GamesOfNationsAuctionProposal,
  type GamesOfNationsSportAuction,
  type GamesOfNationsSportResult,
  type GamesOfNationsSportValues,
  type GamesOfNationsMedalStanding,
  type GamesOfNationsSummary,
  type SavedGamesOfNationsState,
} from '../types/gamesOfNations';
import {
  ADDITIONAL_GAMES_SPORT_IDS,
  ALL_GAMES_SPORTS,
  GAMES_OF_NATIONS_SPORT_DEFINITIONS,
  TRADITIONAL_GAMES_SPORT_IDS,
  getGamesSportById,
  getGamesSportByName,
  isGamesSportId,
  isGamesSportName,
} from '../data/gamesOfNationsSports';

export const GAMES_AND_RECREATION_CULTURE_ID = 'games_recreation';
export const GAMES_OF_NATIONS_INTERVAL = 25;
/** A Competition may only begin with at least this many actually eligible participants. */
export const GAMES_OF_NATIONS_MINIMUM_PARTICIPANTS = 3;
export const GAMES_OF_NATIONS_PREPARATION_TURNS = 10;
export const GAMES_OF_NATIONS_COMPETITION_TURNS = 5;
export const GAMES_OF_NATIONS_COOLDOWN_TURNS = 10;
export const GAMES_POINTS_PER_RESOURCE = 10;
export const HOST_GAMES_BONUS_RATE = 0.10;
/** Legacy/initial program. Runtime gameplay uses the frozen active-sport collection. */
export const GAMES_OF_NATIONS_SPORTS: readonly GamesOfNationsSport[] = TRADITIONAL_GAMES_SPORT_IDS
  .map((id) => getGamesSportById(id).name);
export const GAMES_OF_NATIONS_ALL_SPORTS: readonly GamesOfNationsSport[] = ALL_GAMES_SPORTS;

export const GAMES_OF_NATIONS_ERA_AUCTIONS: readonly GamesOfNationsIntroductionEra[] = [
  'renaissance', 'industrial', 'modern', 'atomic', 'information',
];
export const GAMES_AUCTION_BID_FRACTIONS = {
  favouriteMinimum: 0.16,
  favouriteRange: 0.10,
  fallbackMinimum: 0.08,
  fallbackRange: 0.08,
} as const;

export interface GamesOfNationsDependencies {
  getCurrentTurn: () => number;
  getLivingNationIds: () => readonly string[];
  getNationName: (nationId: string) => string | undefined;
  getCapitalCity: (nationId: string) => { id: string; name: string } | undefined;
  getHostCityCandidates?: (nationId: string) => readonly GamesOfNationsHostCityCandidate[];
  getCityOwnerId?: (cityId: string) => string | undefined;
  hasGrandStadium?: (cityId: string) => boolean;
  /** Physical presence, including a broken stadium. Used only to prevent duplicates. */
  hasGrandStadiumStructure?: (cityId: string) => boolean;
  getCityName?: (cityId: string) => string | undefined;
  getWorldDateForTurn?: (turn: number) => { worldYear: number; yearLabel: string };
  isHumanNation?: (nationId: string) => boolean;
  isAutoplayActive?: () => boolean;
  getCultureOutput?: (nationId: string) => number;
  getProductionSources?: (nationId: string) => readonly { cityId: string; available: number }[];
  getCulturalPriority?: (nationId: string) => number;
  getGold?: (nationId: string) => number;
  spendGold?: (nationId: string, amount: number) => boolean;
  /** Authoritative: true while any Historical World War is active (freezes the schedule). */
  hasActiveWorldWar?: () => boolean;
  /** Authoritative: true if the nation is the recorded aggressor in any active war. */
  isActiveWarAggressor?: (nationId: string) => boolean;
  getLeaderGamesPreferences?: (nationId: string) => GamesOfNationsLeaderPreferences | undefined;
  getWorldEra?: () => GamesOfNationsIntroductionEra | string;
  seed?: string;
  log?: (message: string) => void;
  onGoldMedal?: (event: GamesOfNationsGoldEvent) => void;
  onGamesCompleted?: (event: GamesOfNationsCompletedEvent) => void;
  onSportResolved?: (event: GamesOfNationsSportResolvedEvent) => void;
  onHostingConfirmed?: (event: GamesOfNationsHostingConfirmedEvent) => void;
  onGamesCancelled?: (event: GamesOfNationsCancelledEvent) => void;
  onSportIntroduced?: (event: GamesOfNationsSportIntroducedEvent) => void;
  onNationExcluded?: (event: GamesOfNationsExclusionEvent) => void;
}

export interface GamesOfNationsExclusionEvent {
  gamesNumber: number;
  excludedNationId: string;
  justification: string;
  retainedGamesPoints: number;
  turn: number;
}

export interface GamesOfNationsSportIntroducedEvent {
  sportId: GamesOfNationsSportId;
  sport: GamesOfNationsSport;
  introducingNationId: string;
  winningBid: number;
  era: GamesOfNationsIntroductionEra;
  turn: number;
  worldYear: number;
  yearLabel: string;
  introducedForGamesNumber: number;
}

export interface GamesOfNationsHostCityCandidate {
  id: string;
  name: string;
  productionPerTurn: number;
  canConstructGrandStadium: boolean;
  hasGrandStadium: boolean;
}

export interface GamesOfNationsHostingConfirmedEvent {
  gamesNumber: number;
  hostNationId: string;
  hostCityId: string;
  hostCityName: string;
  usedExistingGrandStadium: boolean;
  scheduledGamesTurn: number;
  turn: number;
  previousHostNationId?: string;
  worldCouncilReplacement?: boolean;
}

export interface GamesOfNationsUpcomingHostingContext {
  gamesNumber: number;
  hostNationId: string;
  hostCityId?: string;
}

export interface GamesOfNationsCancelledEvent {
  gamesNumber: number;
  hostNationId?: string;
  hostCityId?: string;
  hostCityName?: string;
  reason: string;
  turn: number;
}

export interface GamesOfNationsGoldEvent {
  gamesNumber: number;
  sport: GamesOfNationsSport;
  goldNationId: string;
  hostNationId?: string;
  hostCityId?: string;
  hostCityName?: string;
  turn: number;
}

export interface GamesOfNationsCompletedEvent {
  gamesNumber: number;
  hostNationId?: string;
  hostCityId?: string;
  hostCityName?: string;
  overallWinnerNationId?: string;
  medalTable: GamesOfNationsMedalStanding[];
  turn: number;
}

/** Immutable presentation snapshot emitted once, after a Competition sport is finalized. */
export interface GamesOfNationsSportResolvedEvent {
  gamesNumber: number;
  competitionDay: number;
  sport: GamesOfNationsSport;
  result: GamesOfNationsSportResult;
  hostNationId?: string;
  hostCityId?: string;
  hostCityName?: string;
  nextSport?: GamesOfNationsSport;
  nextSportCandidates: Array<{ nationId: string; gamesPoints: number }>;
  medalTable: GamesOfNationsMedalStanding[];
  overallWinnerNationId?: string;
  turn: number;
}

export class GamesOfNationsSystem {
  private state: SavedGamesOfNationsState;

  private constructor(
    private readonly dependencies: GamesOfNationsDependencies,
    state: SavedGamesOfNationsState,
  ) {
    this.state = normalizeState(state);
  }

  static forNewGame(dependencies: GamesOfNationsDependencies): GamesOfNationsSystem {
    return new GamesOfNationsSystem(dependencies, inactiveState(0));
  }

  static fromSave(
    dependencies: GamesOfNationsDependencies,
    savedState: SavedGamesOfNationsState | undefined,
    currentTurn: number,
  ): GamesOfNationsSystem {
    if (!savedState || typeof savedState !== 'object') {
      return new GamesOfNationsSystem(dependencies, inactiveState(currentTurn));
    }
    if (savedState.founded !== true) {
      return new GamesOfNationsSystem(dependencies, {
        ...inactiveState(currentTurn),
        processedSportIntroductionEras: savedState.processedSportIntroductionEras,
        futureFallbackActive: savedState.futureFallbackActive,
      });
    }
    const system = new GamesOfNationsSystem(dependencies, {
      ...savedState,
      lastProcessedTurn: Number.isFinite(savedState.lastProcessedTurn)
        ? savedState.lastProcessedTurn
        : currentTurn,
    });
    system.migrateStep1FirstGames(currentTurn);
    system.migrateHostBonusState();
    system.migrateCompletedStep4Games();
    system.migrateHostingState();
    system.migrateSportExpansionState();
    return system;
  }

  /** Returns true only for the one culture completion that founds the institution. */
  handleCultureCompleted(nationId: string, cultureNodeId: string, turn: number): boolean {
    if (cultureNodeId !== GAMES_AND_RECREATION_CULTURE_ID || this.state.founded) return false;

    const rotationOrder = unique(this.dependencies.getLivingNationIds());
    if (!rotationOrder.includes(nationId)) rotationOrder.push(nationId);
    const hostRotationIndex = Math.max(0, rotationOrder.indexOf(nationId));
    const firstGamesTurn = turn + GAMES_OF_NATIONS_INTERVAL;
    const processedSportIntroductionEras = [...(this.state.processedSportIntroductionEras ?? [])];
    this.state = {
      founded: true,
      founderNationId: nationId,
      foundedTurn: turn,
      firstGamesTurn,
      phase: 'waitingForFirstGames',
      competitionNumber: 1,
      phaseStartTurn: turn,
      nextTransitionTurn: firstGamesTurn - GAMES_OF_NATIONS_PREPARATION_TURNS,
      scheduledGamesTurn: firstGamesTurn,
      hostingSchemaVersion: 1,
      hostingGamesNumber: 1,
      offeredHostNationIds: [],
      declinedHostNationIds: [],
      hostRotationOrder: rotationOrder,
      hostRotationIndex,
      participants: this.createParticipants(),
      sportResults: createSportResults(),
      medalTable: [],
      completedGames: [],
      introducedAdditionalSportIds: [],
      sportIntroductionRecords: [],
      processedSportIntroductionEras,
      futureFallbackActive: this.dependencies.getWorldEra?.() === 'future',
      lastProcessedTurn: turn,
    };
    this.log(`Founded by ${this.nationName(nationId)} on turn ${turn}; first Games scheduled for turn ${firstGamesTurn}`);
    this.offerHostingFrom(hostRotationIndex);
    this.maybeStartFutureFallbackAuction(turn, 1);
    return true;
  }

  /** Called from Epoch's canonical per-nation era transition hook; each target era is global and one-shot. */
  handleEraReached(era: string, turn: number): boolean {
    if (!GAMES_OF_NATIONS_ERA_AUCTIONS.includes(era as GamesOfNationsIntroductionEra) && era !== 'future') return false;
    const introductionEra = era as GamesOfNationsIntroductionEra;
    if (introductionEra === 'future') {
      this.state.futureFallbackActive = true;
      return false;
    }
    if ((this.state.processedSportIntroductionEras ?? []).includes(introductionEra)) return false;
    this.state.processedSportIntroductionEras = [...(this.state.processedSportIntroductionEras ?? []), introductionEra];
    if (!this.state.founded || this.remainingAdditionalSportIds().length === 0) return false;
    return this.startSportAuction(introductionEra, 'era', turn, this.introductionGamesNumber());
  }

  isHumanSportAuctionPending(): boolean {
    return this.state.pendingSportAuction?.resolved === false
      && this.state.hostRotationOrder.some((nationId) =>
        this.dependencies.getLivingNationIds().includes(nationId)
        && this.isInteractiveHuman(nationId),
      );
  }

  submitHumanSportAuctionBid(nationId: string, sportId: GamesOfNationsSportId, bid: number): boolean {
    const auction = this.state.pendingSportAuction;
    if (!auction || auction.resolved || !this.isInteractiveHuman(nationId)) return false;
    if (!auction.candidateSportIds.includes(sportId) || !Number.isInteger(bid) || bid < 0) return false;
    const treasury = whole(this.dependencies.getGold?.(nationId) ?? 0);
    const currentLeader = selectAuctionWinner(auction.proposals, this.state.hostRotationOrder);
    if (bid > treasury || (currentLeader && bid <= currentLeader.bid)) return false;
    return this.resolveSportAuction({ nationId, sportId, bid, preferenceStrength: 0 });
  }

  abstainFromHumanSportAuction(nationId: string): boolean {
    const auction = this.state.pendingSportAuction;
    if (!auction || auction.resolved || !this.isInteractiveHuman(nationId)) return false;
    return this.resolveSportAuction();
  }

  private startSportAuction(
    era: GamesOfNationsIntroductionEra,
    trigger: GamesOfNationsSportAuction['trigger'],
    turn: number,
    gamesNumber: number,
  ): boolean {
    if (this.state.pendingSportAuction && !this.state.pendingSportAuction.resolved) return false;
    const candidates = this.remainingAdditionalSportIds();
    if (!this.state.founded || candidates.length === 0) return false;
    const living = unique(this.dependencies.getLivingNationIds());
    const proposals = living
      .filter((nationId) => !this.isInteractiveHuman(nationId))
      .map((nationId) => this.buildAIProposal(nationId, candidates, era, gamesNumber));
    this.state.pendingSportAuction = {
      id: `${trigger}-${era}-${turn}-${gamesNumber}`,
      triggerEra: era,
      trigger,
      turn,
      gamesNumber,
      proposals,
      candidateSportIds: [...candidates],
      resolved: false,
    };
    this.log(`${era} sport auction: ${proposals.map((proposal) => `${this.nationName(proposal.nationId)} — ${getGamesSportById(proposal.sportId).name} — ${proposal.bid} Gold`).join('; ')}`);
    const hasHuman = living.some((nationId) => this.isInteractiveHuman(nationId));
    return hasHuman ? true : this.resolveSportAuction();
  }

  private buildAIProposal(
    nationId: string,
    candidates: readonly GamesOfNationsSportId[],
    era: GamesOfNationsIntroductionEra,
    gamesNumber: number,
  ): GamesOfNationsAuctionProposal {
    const preference = this.dependencies.getLeaderGamesPreferences?.(nationId);
    const favourite = preference?.additionalFavourite;
    const isFavouriteAvailable = !!favourite && candidates.includes(favourite);
    const sportId = isFavouriteAvailable
      ? favourite!
      : candidates[Math.floor(stableUnit(`${this.dependencies.seed}|${era}|${gamesNumber}|${nationId}|nomination`) * candidates.length)]!;
    const treasury = whole(this.dependencies.getGold?.(nationId) ?? 0);
    const minimum = isFavouriteAvailable ? GAMES_AUCTION_BID_FRACTIONS.favouriteMinimum : GAMES_AUCTION_BID_FRACTIONS.fallbackMinimum;
    const range = isFavouriteAvailable ? GAMES_AUCTION_BID_FRACTIONS.favouriteRange : GAMES_AUCTION_BID_FRACTIONS.fallbackRange;
    const fraction = minimum + stableUnit(`${this.dependencies.seed}|${era}|${gamesNumber}|${nationId}|bid`) * range;
    return {
      nationId,
      sportId,
      bid: Math.min(treasury, Math.floor(treasury * fraction)),
      preferenceStrength: isFavouriteAvailable ? 2 : 1,
    };
  }

  private resolveSportAuction(humanProposal?: GamesOfNationsAuctionProposal): boolean {
    const auction = this.state.pendingSportAuction;
    if (!auction || auction.resolved) return false;
    const proposals = humanProposal ? [...auction.proposals, humanProposal] : auction.proposals;
    const winner = selectAuctionWinner(proposals, this.state.hostRotationOrder);
    if (!winner) return false;
    const treasury = whole(this.dependencies.getGold?.(winner.nationId) ?? 0);
    if (winner.bid > treasury || this.dependencies.spendGold?.(winner.nationId, winner.bid) === false) return false;
    auction.proposals = proposals;
    auction.resolved = true;
    const sport = getGamesSportById(winner.sportId);
    this.state.introducedAdditionalSportIds = [...(this.state.introducedAdditionalSportIds ?? []), winner.sportId];
    const date = this.dependencies.getWorldDateForTurn?.(auction.turn)
      ?? { worldYear: 0, yearLabel: `Turn ${auction.turn}` };
    const record = {
      sportId: winner.sportId,
      introducingNationId: winner.nationId,
      winningBid: winner.bid,
      era: auction.triggerEra,
      turn: auction.turn,
      worldYear: date.worldYear,
      yearLabel: date.yearLabel,
      introducedForGamesNumber: auction.gamesNumber,
    };
    this.state.sportIntroductionRecords = [...(this.state.sportIntroductionRecords ?? []), record];
    this.log(`${this.nationName(winner.nationId)} wins the ${auction.triggerEra} sport auction for ${winner.bid} Gold; ${sport.name} will debut in Games #${auction.gamesNumber}`);
    this.dependencies.onSportIntroduced?.({ ...record, sport: sport.name });
    delete this.state.pendingSportAuction;
    return true;
  }

  getHostCityCandidates(nationId: string): GamesOfNationsHostCityCandidate[] {
    return this.validHostCities(nationId).map((city) => ({ ...city }));
  }

  handleAutoplayStarted(): void {
    this.resolveAutoplayHumanDecisions();
  }

  acceptHostingOffer(nationId: string): boolean {
    if (this.state.hostingDecision !== 'pendingDecision' || this.state.hostCandidateNationId !== nationId) return false;
    if (!this.isInteractiveHuman(nationId)) return false;
    if (this.validHostCities(nationId).length === 0) {
      this.declineHostingOffer(nationId);
      return false;
    }
    this.state.hostingDecision = 'pendingCity';
    this.log(`${this.nationName(nationId)} accepted hosting Games #${this.state.hostingGamesNumber}`);
    return true;
  }

  declineHostingOffer(nationId: string): boolean {
    if (this.state.hostingDecision !== 'pendingDecision' || this.state.hostCandidateNationId !== nationId) return false;
    this.log(`${this.nationName(nationId)} declined hosting Games #${this.state.hostingGamesNumber}`);
    this.state.declinedHostNationIds = unique([...(this.state.declinedHostNationIds ?? []), nationId]);
    const currentIndex = this.state.hostRotationOrder.indexOf(nationId);
    this.offerHostingFrom(currentIndex + 1);
    return true;
  }

  selectHostCity(nationId: string, cityId: string): boolean {
    if (this.state.hostingDecision !== 'pendingCity' || this.state.hostCandidateNationId !== nationId) return false;
    if (!this.isInteractiveHuman(nationId)) return false;
    const city = this.validHostCities(nationId).find((candidate) => candidate.id === cityId);
    if (!city) return false;
    this.confirmHosting(nationId, city);
    return true;
  }

  isHumanHostingPromptPending(): boolean {
    const candidate = this.state.hostCandidateNationId;
    return this.state.hostingDecision === 'pendingDecision'
      && !!candidate
      && this.isInteractiveHuman(candidate);
  }

  isHumanHostCitySelectionPending(): boolean {
    const candidate = this.state.hostCandidateNationId;
    return this.state.hostingDecision === 'pendingCity'
      && !!candidate
      && this.isInteractiveHuman(candidate);
  }

  canCityConstructGrandStadium(cityId: string, nationId: string): boolean {
    if (this.state.hostingDecision !== 'confirmed') return false;
    if (this.state.upcomingHostNationId !== nationId || this.state.upcomingHostCityId !== cityId) return false;
    if (this.dependencies.getCityOwnerId?.(cityId) !== undefined && this.dependencies.getCityOwnerId(cityId) !== nationId) return false;
    if (this.dependencies.hasGrandStadiumStructure?.(cityId) === true) return false;
    if (this.dependencies.hasGrandStadium?.(cityId) === true) return false;
    return this.dependencies.getCurrentTurn() < this.hostingDeadline();
  }

  getGrandStadiumPriorityCityId(nationId: string): string | null {
    const cityId = this.state.upcomingHostCityId;
    return cityId && this.canCityConstructGrandStadium(cityId, nationId) ? cityId : null;
  }

  /** Returns only a selected host for a Games whose Competition has not begun. */
  getUpcomingHostingContext(): GamesOfNationsUpcomingHostingContext | null {
    if (!this.state.founded || this.state.phase === 'competition' || this.state.hostingDecision !== 'confirmed') return null;
    const gamesNumber = this.state.hostingGamesNumber;
    const hostNationId = this.state.upcomingHostNationId;
    if (!gamesNumber || !hostNationId) return null;
    const isCurrentUpcoming = gamesNumber === this.state.competitionNumber
      && (this.state.phase === 'waitingForFirstGames' || this.state.phase === 'preparation');
    if (!isCurrentUpcoming && gamesNumber <= this.state.competitionNumber) return null;
    return { gamesNumber, hostNationId, hostCityId: this.state.upcomingHostCityId };
  }

  canNationTakeOverHosting(nationId: string): boolean {
    const context = this.getUpcomingHostingContext();
    return !!context
      && context.hostNationId !== nationId
      && this.dependencies.getLivingNationIds().includes(nationId)
      && this.validHostCities(nationId).length > 0;
  }

  getUpcomingParticipationContext(): { gamesNumber: number; eligibleNationIds: string[] } | null {
    if (!this.state.founded || this.state.phase === 'competition') return null;
    const gamesNumber = this.state.phase === 'waitingForFirstGames' || this.state.phase === 'preparation'
      ? this.state.competitionNumber
      : this.state.hostingGamesNumber ?? this.state.competitionNumber + 1;
    if (gamesNumber <= 0) return null;
    const living = this.dependencies.getLivingNationIds();
    const existingExclusions = this.state.excludedGamesNumber === gamesNumber
      ? new Set(this.state.excludedNationIds ?? [])
      : new Set<string>();
    const eligibleNationIds = living.filter((nationId) => {
      if (existingExclusions.has(nationId)) return false;
      if (gamesNumber !== this.state.competitionNumber) return true;
      return this.getParticipant(nationId)?.participating === true;
    });
    return eligibleNationIds.length > 0 ? { gamesNumber, eligibleNationIds } : null;
  }

  isNationExcludedFromUpcomingGames(nationId: string): boolean {
    const context = this.getUpcomingParticipationContext();
    const gamesNumber = context?.gamesNumber ?? this.state.excludedGamesNumber;
    return gamesNumber !== undefined
      && this.state.excludedGamesNumber === gamesNumber
      && (this.state.excludedNationIds ?? []).includes(nationId);
  }

  excludeNationFromUpcomingGames(nationId: string, justification: string): boolean {
    const context = this.getUpcomingParticipationContext();
    if (!context || !context.eligibleNationIds.includes(nationId)) return false;
    const excluded = this.state.excludedGamesNumber === context.gamesNumber
      ? [...(this.state.excludedNationIds ?? [])]
      : [];
    if (excluded.includes(nationId)) return false;
    excluded.push(nationId);
    this.state.excludedGamesNumber = context.gamesNumber;
    this.state.excludedNationIds = unique(excluded);
    const participant = this.getParticipant(nationId);
    const retainedGamesPoints = context.gamesNumber === this.state.competitionNumber
      ? participant?.totalGamesPoints ?? 0
      : 0;
    if (participant && context.gamesNumber === this.state.competitionNumber) {
      participant.participating = false;
      participant.cultureCommitment = 0;
      participant.productionCommitment = 0;
    }
    this.log(`${this.nationName(nationId)} excluded from Games #${context.gamesNumber}; future Culture/Production commitments stopped`);
    this.log(`${this.nationName(nationId)} retains ${retainedGamesPoints} previously generated GP but is ineligible for Competition`);
    this.dependencies.onNationExcluded?.({
      gamesNumber: context.gamesNumber,
      excludedNationId: nationId,
      justification,
      retainedGamesPoints,
      turn: this.dependencies.getCurrentTurn(),
    });
    return true;
  }

  /** Centralized reset used after a passed World Council hosting resolution. */
  replaceUpcomingHostFromWorldCouncil(proposerNationId: string): boolean {
    const context = this.getUpcomingHostingContext();
    const turn = this.dependencies.getCurrentTurn();
    if (!context || context.hostNationId === proposerNationId) return false;
    if (!this.dependencies.getLivingNationIds().includes(proposerNationId)) return false;
    const cities = this.validHostCities(proposerNationId);
    if (cities.length === 0) return false;

    const replacesCurrentPreparation = context.gamesNumber === this.state.competitionNumber;
    this.log(`Resetting upcoming Games #${context.gamesNumber} after World Council host replacement`);
    this.state.hostingGamesNumber = context.gamesNumber;
    this.state.hostCandidateNationId = proposerNationId;
    this.state.hostingDecision = 'pendingCity';
    this.state.offeredHostNationIds = [proposerNationId];
    this.state.declinedHostNationIds = [];
    delete this.state.upcomingHostNationId;
    delete this.state.upcomingHostCityId;
    delete this.state.upcomingHostUsedExistingGrandStadium;
    delete this.state.hostingCancellationReason;
    this.state.stadiumRequirementGrandfathered = false;
    this.state.scheduledGamesTurn = turn + GAMES_OF_NATIONS_INTERVAL;
    this.state.worldCouncilScheduleGamesNumber = context.gamesNumber;
    this.state.pendingWorldCouncilHostReplacement = {
      gamesNumber: context.gamesNumber,
      previousHostNationId: context.hostNationId,
      newHostNationId: proposerNationId,
    };
    delete this.state.excludedGamesNumber;
    this.state.excludedNationIds = [];

    if (replacesCurrentPreparation) {
      this.state.phase = 'waitingForFirstGames';
      this.state.phaseStartTurn = turn;
      this.state.nextTransitionTurn = turn + GAMES_OF_NATIONS_INTERVAL - GAMES_OF_NATIONS_PREPARATION_TURNS;
      if (context.gamesNumber === 1) this.state.firstGamesTurn = this.state.scheduledGamesTurn;
      delete this.state.hostNationId;
      delete this.state.hostCityId;
      delete this.state.hostUsedExistingGrandStadium;
      delete this.state.frozenSportIds;
      delete this.state.activeSportIndex;
      delete this.state.cancellationReason;
      delete this.state.overallWinnerNationId;
      this.state.participants = this.createParticipants();
      this.state.sportResults = createSportResults(this.programSportIds().map((id) => getGamesSportById(id).name));
      this.state.medalTable = [];
      this.state.hostBonusCalculated = false;
      this.state.totalExternalInitialGamesPoints = 0;
      this.state.hostBonusGamesPoints = 0;
      delete this.state.hostBonusSport;
      delete this.state.humanPreparationPromptAcknowledgedCompetitionNumber;
    } else if (this.state.phase === 'cooldown') {
      this.state.nextTransitionTurn = turn + GAMES_OF_NATIONS_INTERVAL - GAMES_OF_NATIONS_PREPARATION_TURNS;
    }

    this.log(`${this.nationName(proposerNationId)} becomes host of Games #${context.gamesNumber}; previous preparation discarded`);
    if (this.isInteractiveHuman(proposerNationId)) return true;
    const autoplayCity = this.isHumanNation(proposerNationId) && this.dependencies.isAutoplayActive?.() === true
      ? this.selectAutoplayHostCity(proposerNationId, cities)
      : undefined;
    const selected = autoplayCity ?? [...cities].sort((a, b) =>
      Number(b.hasGrandStadium) - Number(a.hasGrandStadium)
        || b.productionPerTurn - a.productionPerTurn
        || a.id.localeCompare(b.id))[0]!;
    this.confirmHosting(proposerNationId, selected);
    return true;
  }

  /**
   * True while an active Historical World War freezes the Games schedule. Only the
   * founded institution has a clock to freeze; pre-founding rounds advance nothing.
   */
  isSuspendedByWorldWar(): boolean {
    return this.state.founded && this.dependencies.hasActiveWorldWar?.() === true;
  }

  /**
   * Freeze the schedule for one suspended round by shifting every absolute turn
   * marker forward by the elapsed rounds, so relative distances (time until the
   * next phase, competition day, hosting deadline) are preserved exactly. This is
   * a deterministic paused clock: World War rounds consume zero Games cycle time.
   */
  private handleSuspendedRound(turn: number): void {
    const elapsed = turn - this.state.lastProcessedTurn;
    if (elapsed > 0) {
      this.shiftScheduleForward(elapsed);
      this.state.lastProcessedTurn = turn;
    }
    if (this.state.suspendedForWorldWar !== true) {
      this.state.suspendedForWorldWar = true;
      this.log('Suspended: active Historical World War');
    }
  }

  private shiftScheduleForward(delta: number): void {
    if (delta <= 0) return;
    if (this.state.firstGamesTurn !== undefined) this.state.firstGamesTurn += delta;
    if (this.state.phaseStartTurn !== undefined) this.state.phaseStartTurn += delta;
    if (this.state.nextTransitionTurn !== undefined) this.state.nextTransitionTurn += delta;
    if (this.state.scheduledGamesTurn !== undefined) this.state.scheduledGamesTurn += delta;
  }

  /** Advance explicit phase boundaries and the active sport at round start. */
  handleRoundStart(turn: number): void {
    if (this.isSuspendedByWorldWar()) {
      this.handleSuspendedRound(turn);
      return;
    }
    if (this.state.suspendedForWorldWar === true) {
      this.state.suspendedForWorldWar = false;
      this.log('Resumed after World War');
    }
    this.resolveAutoplayHumanDecisions();
    if (this.state.phase === 'preparation') {
      this.initializeMissingAIStrategies();
      this.initializeHostBonusForPreparation();
    }
    if (this.state.phase === 'competition') this.resolveDueCompetitionSports(turn);
    if (turn <= this.state.lastProcessedTurn) return;
    this.pruneInvalidParticipants();
    if (!this.state.founded) {
      this.state.lastProcessedTurn = turn;
      return;
    }

    while (this.state.nextTransitionTurn !== undefined && turn >= this.state.nextTransitionTurn) {
      const transitionTurn = this.state.nextTransitionTurn;
      if (this.state.phase === 'waitingForFirstGames') {
        this.beginFirstPreparation(transitionTurn);
      } else if (this.state.phase === 'preparation') {
        this.beginCompetition(transitionTurn);
      } else if (this.state.phase === 'competition') {
        this.resolveDueCompetitionSports(transitionTurn - 1);
        this.beginCooldown(transitionTurn);
      } else if (this.state.phase === 'cancelled') {
        this.beginCooldown(transitionTurn);
      } else if (this.state.phase === 'cooldown') {
        this.beginPreparation(transitionTurn);
      } else {
        break;
      }
    }

    if (this.state.phase === 'competition' && this.state.phaseStartTurn !== undefined) {
      const cycleSports = this.cycleSports();
      const sportIndex = Math.max(0, Math.min(
        cycleSports.length - 1,
        turn - this.state.phaseStartTurn,
      ));
      if (sportIndex !== this.state.activeSportIndex) {
        this.state.activeSportIndex = sportIndex;
        this.logCompetitionSport();
      }
      this.resolveDueCompetitionSports(turn);
    }
    this.state.lastProcessedTurn = turn;
  }

  /** Future human opt-out UI can use this without changing the cycle model. */
  setParticipation(nationId: string, participating: boolean): boolean {
    const entry = this.state.participants.find((participant) => participant.nationId === nationId);
    if (!entry || this.isExcludedFromGames(nationId, this.state.competitionNumber)) return false;
    if (nationId === this.state.hostNationId && !participating) return false;
    entry.participating = participating;
    return true;
  }

  acknowledgeHumanPreparationPrompt(competitionNumber: number): boolean {
    if (
      this.state.phase !== 'preparation'
      || competitionNumber !== this.state.competitionNumber
    ) return false;
    const human = this.state.participants.find((participant) => this.isInteractiveHuman(participant.nationId));
    if (!human) return false;
    return this.confirmHumanPreparationConfiguration(human.nationId, competitionNumber);
  }

  confirmHumanPreparationConfiguration(
    nationId: string,
    competitionNumber: number,
    hostBonusSport?: GamesOfNationsSport,
  ): boolean {
    if (this.state.phase !== 'preparation' || competitionNumber !== this.state.competitionNumber) return false;
    const participant = this.getParticipant(nationId);
    if (!participant || !this.isInteractiveHuman(nationId) || this.isExcludedFromGames(nationId, competitionNumber)) return false;
    this.captureInitialCommitment(participant);
    this.calculateHostBonusIfReady();
    if (nationId === this.state.hostNationId) {
      if (!this.state.hostBonusCalculated || !hostBonusSport || !this.cycleSports().includes(hostBonusSport)) return false;
      if (this.state.hostBonusSport && this.state.hostBonusSport !== hostBonusSport) return false;
      if (!this.state.hostBonusSport) {
        this.state.hostBonusSport = hostBonusSport;
        this.log(`${this.nationName(nationId)} assigned ${this.state.hostBonusGamesPoints ?? 0} host bonus GP to ${hostBonusSport}`);
      }
    }
    this.assignAIHostBonusSportIfReady();
    if (!this.state.hostBonusCalculated || !this.state.hostBonusSport) return false;
    this.state.humanPreparationPromptAcknowledgedCompetitionNumber = competitionNumber;
    return true;
  }

  isHumanPreparationPromptPending(): boolean {
    const human = this.state.participants.find((participant) => this.isInteractiveHuman(participant.nationId));
    return this.dependencies.isAutoplayActive?.() !== true
      && this.state.phase === 'preparation'
      && !!human
      && !this.isExcludedFromGames(human.nationId, this.state.competitionNumber)
      && this.state.humanPreparationPromptAcknowledgedCompetitionNumber !== this.state.competitionNumber;
  }

  setNationCultureCommitment(nationId: string, commitment: number): boolean {
    const participant = this.getParticipant(nationId);
    if (!participant || this.isExcludedFromGames(nationId, this.state.competitionNumber) || !Number.isFinite(commitment) || commitment < 0) return false;
    participant.cultureCommitment = Math.floor(commitment);
    return true;
  }

  setNationProductionCommitment(nationId: string, commitment: number): boolean {
    const participant = this.getParticipant(nationId);
    if (!participant || this.isExcludedFromGames(nationId, this.state.competitionNumber) || !Number.isFinite(commitment) || commitment < 0) return false;
    participant.productionCommitment = Math.floor(commitment);
    return true;
  }

  setNationGamesPointsStrategy(nationId: string, strategy: GamesOfNationsSportValues): boolean {
    const participant = this.getParticipant(nationId);
    if (!participant || this.state.phase !== 'preparation' || !participant.participating
      || this.isExcludedFromGames(nationId, this.state.competitionNumber)) return false;
    if (ALL_GAMES_SPORTS.some((sport) => (
      !Number.isFinite(strategy[sport])
      || !Number.isInteger(strategy[sport])
      || strategy[sport] < 0
    ))) return false;
    const normalized = normalizeSportTotals(strategy);
    const activeSports = this.cycleSports();
    const activeSet = new Set<GamesOfNationsSport>(activeSports);
    if (ALL_GAMES_SPORTS.some((sport) => !activeSet.has(sport) && normalized[sport] !== 0)) return false;
    const budget = (participant.cultureCommitment + participant.productionCommitment) * GAMES_POINTS_PER_RESOURCE;
    const planned = activeSports.reduce((sum, sport) => sum + normalized[sport], 0);
    if (planned !== budget) return false;
    participant.gamesPointsStrategyBySport = normalized;
    participant.strategyInitialized = true;
    delete participant.strategyAdjustmentPending;
    if (participant.unallocatedGamesPoints > 0) {
      this.allocatePoolByHumanStrategy(participant, participant.unallocatedGamesPoints);
    }
    return true;
  }

  acknowledgeHumanStrategyAdjustment(nationId: string): boolean {
    const participant = this.getParticipant(nationId);
    if (!participant || !this.isInteractiveHuman(nationId) || participant.strategyAdjustmentPending !== true) return false;
    delete participant.strategyAdjustmentPending;
    return true;
  }

  allocateGamesPoints(nationId: string, sport: GamesOfNationsSport, amount: number): boolean {
    const participant = this.getParticipant(nationId);
    if (
      this.state.phase !== 'preparation'
      || !participant?.participating
      || this.isExcludedFromGames(nationId, this.state.competitionNumber)
      || !this.cycleSports().includes(sport)
      || !Number.isInteger(amount)
      || amount <= 0
      || amount > participant.unallocatedGamesPoints
    ) return false;
    participant.unallocatedGamesPoints -= amount;
    participant.gamesPointsBySport[sport] += amount;
    this.log(`${this.nationName(nationId)} allocated ${amount} GP to ${sport}; ${participant.unallocatedGamesPoints} GP remain unallocated`);
    return true;
  }

  distributeRemainingGamesPointsEvenly(nationId: string): boolean {
    if (this.state.phase !== 'preparation') return false;
    const participant = this.getParticipant(nationId);
    if (!participant?.participating || this.isExcludedFromGames(nationId, this.state.competitionNumber)) return false;
    return this.distributeParticipantPoolEvenly(participant, 'manually distributed');
  }

  /** Called once for each nation's turn, after yields are refreshed and before production/culture advance. */
  processNationPreparationTurn(nationId: string, turn: number): void {
    if (this.state.phase !== 'preparation' || this.isSuspendedByWorldWar()) return;
    const participant = this.getParticipant(nationId);
    if (!participant?.participating || this.isExcludedFromGames(nationId, this.state.competitionNumber) || participant.lastInvestmentTurn === turn) return;
    participant.lastInvestmentTurn = turn;
    participant.gamesPointsGeneratedThisTurn = 0;
    delete participant.cultureDiversionThisTurn;
    delete participant.productionDiversionByCity;

    let investedCulture = 0;
    const availableCulture = whole(this.dependencies.getCultureOutput?.(nationId) ?? 0);
    if (participant.cultureCommitment > 0) {
      if (availableCulture >= participant.cultureCommitment) {
        investedCulture = participant.cultureCommitment;
        participant.totalCultureInvested += investedCulture;
        participant.cultureDiversionThisTurn = investedCulture;
      } else {
        participant.failedCultureCommitmentTurns += 1;
        this.log(`${this.nationName(nationId)} could not meet Culture commitment ${participant.cultureCommitment}; available ${availableCulture}; 0 Culture Games Points awarded`);
      }
    }

    let investedProduction = 0;
    const productionSources = (this.dependencies.getProductionSources?.(nationId) ?? [])
      .map((source) => ({ cityId: source.cityId, available: whole(source.available) }));
    const availableProduction = productionSources.reduce((sum, source) => sum + source.available, 0);
    if (participant.productionCommitment > 0) {
      if (availableProduction >= participant.productionCommitment) {
        investedProduction = participant.productionCommitment;
        participant.totalProductionInvested += investedProduction;
        participant.productionDiversionByCity = allocateProductionDiversion(
          productionSources,
          investedProduction,
        );
      } else {
        participant.failedProductionCommitmentTurns += 1;
        this.log(`${this.nationName(nationId)} could not meet Production commitment ${participant.productionCommitment}; available ${availableProduction}; 0 Production Games Points awarded`);
      }
    }

    const generatedPoints = (investedCulture + investedProduction) * GAMES_POINTS_PER_RESOURCE;
    if (generatedPoints > 0) {
      participant.unallocatedGamesPoints += generatedPoints;
      participant.totalGamesPoints += generatedPoints;
      participant.gamesPointsGeneratedThisTurn = generatedPoints;
      this.log(`${this.nationName(nationId)} generated ${generatedPoints} GP; unallocated pool now ${participant.unallocatedGamesPoints} GP`);
      if (!this.isInteractiveHuman(nationId)) {
        this.allocateAIGamesPoints(participant, generatedPoints);
      }
    }
    if (this.isInteractiveHuman(nationId) && participant.strategyInitialized) {
      this.allocateHumanGamesPointsByStrategy(participant, generatedPoints);
    }
  }

  getCultureDiversionForTurn(nationId: string, turn: number): number {
    const participant = this.getParticipant(nationId);
    return this.state.phase === 'preparation'
      && participant?.lastInvestmentTurn === turn
      ? participant.cultureDiversionThisTurn ?? 0
      : 0;
  }

  getProductionDiversionForTurn(nationId: string, cityId: string, turn: number): number {
    const participant = this.getParticipant(nationId);
    if (this.state.phase !== 'preparation' || participant?.lastInvestmentTurn !== turn) return 0;
    return participant.productionDiversionByCity?.[cityId] ?? 0;
  }

  getState(): SavedGamesOfNationsState {
    return cloneState(this.state);
  }

  getCompletedGames(): CompletedGamesOfNationsRecord[] {
    return (this.state.completedGames ?? []).map(cloneCompletedGamesRecord);
  }

  /** The canonical source for the temporary Cultural Victory eligibility window. */
  getLatestCompletedGames(): CompletedGamesOfNationsRecord | undefined {
    const completedGames = this.state.completedGames ?? [];
    const latest = [...completedGames].reverse().find((games) => games.status === 'completed');
    return latest ? cloneCompletedGamesRecord(latest) : undefined;
  }

  /** Derived from completed tournament history; never from the cumulative medal leaderboard. */
  getReigningChampionNationId(): string | null {
    const completedGames = this.state.completedGames ?? [];
    return [...completedGames].reverse().find((games) => games.status === 'completed')?.overallWinnerNationId ?? null;
  }

  getHistoricalMedalStandings(): GamesOfNationsHistoricalStanding[] {
    return buildHistoricalMedalStandings(this.state.completedGames ?? []);
  }

  getEffectiveGamesPoints(nationId: string, sport: GamesOfNationsSport): number {
    if (this.isExcludedFromGames(nationId, this.state.competitionNumber)) return 0;
    const base = whole(this.getParticipant(nationId)?.gamesPointsBySport[sport] ?? 0);
    return base + (
      nationId === this.state.hostNationId && sport === this.state.hostBonusSport
        ? whole(this.state.hostBonusGamesPoints ?? 0)
        : 0
    );
  }

  getSummary(): GamesOfNationsSummary {
    const currentTurn = this.dependencies.getCurrentTurn();
    const cycleSports = this.cycleSports();
    const cycleSportIds = this.cycleSportIds();
    const phaseTotalTurns = this.state.phase === 'preparation'
      ? GAMES_OF_NATIONS_PREPARATION_TURNS
      : this.state.phase === 'competition'
        ? cycleSports.length
        : this.state.phase === 'cancelled'
          ? cycleSports.length
        : this.state.phase === 'cooldown'
          ? GAMES_OF_NATIONS_COOLDOWN_TURNS
          : null;
    const phaseProgressTurn = phaseTotalTurns !== null && this.state.phaseStartTurn !== undefined
      ? clamp(currentTurn - this.state.phaseStartTurn + 1, 1, phaseTotalTurns)
      : null;
    const nextGamesTurn = this.state.founded
      ? (this.state.phase === 'competition' || this.state.phase === 'cancelled'
        ? (this.state.scheduledGamesTurn ?? currentTurn) + this.currentCycleTurns()
        : this.state.scheduledGamesTurn ?? null)
      : null;
    return {
      founded: this.state.founded,
      humanInteractionSuppressed: this.dependencies.isAutoplayActive?.() === true,
      founderNationId: this.state.founderNationId ?? null,
      foundedTurn: this.state.foundedTurn ?? null,
      firstGamesTurn: this.state.firstGamesTurn ?? null,
      phase: this.state.phase,
      competitionNumber: this.state.competitionNumber,
      hostNationId: this.state.hostNationId ?? null,
      hostCityId: this.state.hostCityId ?? null,
      hostingGamesNumber: this.state.hostingGamesNumber ?? null,
      hostCandidateNationId: this.state.hostCandidateNationId ?? null,
      offeredHostNationIds: [...(this.state.offeredHostNationIds ?? [])],
      declinedHostNationIds: [...(this.state.declinedHostNationIds ?? [])],
      hostingDecision: this.state.hostingDecision ?? null,
      ...(this.state.excludedGamesNumber !== undefined ? {
        excludedGamesNumber: this.state.excludedGamesNumber,
        excludedNationIds: [...(this.state.excludedNationIds ?? [])],
      } : {}),
      upcomingHostNationId: this.state.upcomingHostNationId ?? null,
      upcomingHostCityId: this.state.upcomingHostCityId ?? null,
      stadiumExists: this.state.upcomingHostCityId ? this.dependencies.hasGrandStadium?.(this.state.upcomingHostCityId) === true : false,
      stadiumCompleted: this.state.stadiumRequirementGrandfathered === true
        || (this.state.upcomingHostCityId ? this.dependencies.hasGrandStadium?.(this.state.upcomingHostCityId) === true : false),
      ...(this.state.upcomingHostUsedExistingGrandStadium === true ? { stadiumExistingInfrastructure: true } : {}),
      competitionDeadline: this.state.founded ? this.hostingDeadline() : null,
      cancellationReason: this.state.cancellationReason ?? this.state.hostingCancellationReason ?? null,
      stadiumRequirementGrandfathered: this.state.stadiumRequirementGrandfathered === true,
      phaseStartTurn: this.state.phaseStartTurn ?? null,
      nextTransitionTurn: this.state.nextTransitionTurn ?? null,
      turnsUntilNextPhase: this.state.nextTransitionTurn === undefined
        ? null
        : Math.max(0, this.state.nextTransitionTurn - currentTurn),
      suspendedForWorldWar: this.isSuspendedByWorldWar(),
      nextGamesTurn,
      turnsUntilGames: nextGamesTurn === null ? null : Math.max(0, nextGamesTurn - currentTurn),
      activeSport: this.getActiveSport(),
      activeSports: [...cycleSports],
      activeSportIds: [...cycleSportIds],
      introducedAdditionalSportIds: [...(this.state.introducedAdditionalSportIds ?? [])],
      remainingAdditionalSportIds: this.remainingAdditionalSportIds(),
      sportIntroductionRecords: (this.state.sportIntroductionRecords ?? []).map((record) => ({ ...record })),
      processedSportIntroductionEras: [...(this.state.processedSportIntroductionEras ?? [])],
      futureFallbackActive: this.state.futureFallbackActive === true,
      pendingSportAuction: this.state.pendingSportAuction ? cloneAuction(this.state.pendingSportAuction) : null,
      phaseProgressTurn,
      phaseTotalTurns,
      preparationActive: this.state.phase === 'preparation',
      humanPreparationPromptAcknowledgedCompetitionNumber:
        this.state.humanPreparationPromptAcknowledgedCompetitionNumber ?? null,
      sportResults: (this.state.sportResults ?? []).map(cloneSportResult),
      medalTable: (this.state.medalTable ?? []).map((standing) => ({ ...standing })),
      overallWinnerNationId: this.state.overallWinnerNationId ?? null,
      competitionComplete: (this.state.sportResults ?? []).length === cycleSports.length
        && (this.state.sportResults ?? []).every((result) => result.resolved),
      hostBonusCalculated: this.state.hostBonusCalculated === true,
      hostBonusRate: HOST_GAMES_BONUS_RATE,
      totalExternalInitialGamesPoints: whole(this.state.totalExternalInitialGamesPoints ?? 0),
      hostBonusGamesPoints: whole(this.state.hostBonusGamesPoints ?? 0),
      hostBonusSport: this.state.hostBonusSport ?? null,
      hostEffectiveGamesPoints: this.state.hostNationId && this.state.hostBonusSport
        ? this.getEffectiveGamesPoints(this.state.hostNationId, this.state.hostBonusSport)
        : null,
      completedGamesCount: this.state.completedGames?.length ?? 0,
      completedGames: this.getCompletedGames(),
      historicalMedalStandings: this.getHistoricalMedalStandings(),
      participatingNationIds: this.state.participants
        .filter((participant) => participant.participating
          && !this.isExcludedFromGames(participant.nationId, this.state.competitionNumber))
        .map((participant) => participant.nationId),
      participants: this.state.participants.map(cloneParticipant),
      effectiveGamesPointsByNation: Object.fromEntries(this.state.participants.map((participant) => [
        participant.nationId,
        Object.fromEntries(ALL_GAMES_SPORTS.map((sport) => [
          sport,
          this.getEffectiveGamesPoints(participant.nationId, sport),
        ])) as GamesOfNationsSportValues,
      ])),
    };
  }

  private beginFirstPreparation(turn: number): void {
    this.promoteUpcomingHost();
    this.freezeCurrentProgram();
    this.state.phase = 'preparation';
    this.state.phaseStartTurn = turn;
    this.state.nextTransitionTurn = this.state.scheduledGamesTurn ?? this.state.firstGamesTurn;
    this.initializeCycleParticipants();
    this.applyCurrentCycleExclusions();
    this.log(`Preparation for Games #1 begins; competition starts on turn ${this.state.scheduledGamesTurn ?? this.state.firstGamesTurn}`);
  }

  private beginCompetition(turn: number): void {
    this.promoteUpcomingHost();
    this.autoDistributeAllRemainingGamesPoints();
    const cancellationReason = this.validateHostAtDeadline();
    if (cancellationReason) {
      this.cancelGames(turn, cancellationReason);
      this.startNextHostingSelection();
      return;
    }
    this.pruneInvalidParticipants();
    // Eligibility is evaluated only here, at the exact competition-start boundary.
    this.excludeWartimeAggressors();
    const eligibleParticipants = this.countEligibleParticipants();
    if (eligibleParticipants < GAMES_OF_NATIONS_MINIMUM_PARTICIPANTS) {
      this.log(`Competition cancelled: only ${eligibleParticipants} eligible participant${eligibleParticipants === 1 ? '' : 's'}`);
      this.cancelGames(turn, `Fewer than ${GAMES_OF_NATIONS_MINIMUM_PARTICIPANTS} nations were eligible to participate`);
      this.startNextHostingSelection();
      return;
    }
    this.state.phase = 'competition';
    this.state.phaseStartTurn = turn;
    this.state.nextTransitionTurn = turn + this.cycleSports().length;
    this.state.scheduledGamesTurn = turn;
    this.state.activeSportIndex = 0;
    const cityName = this.currentHostCityName();
    const location = cityName ? ` in ${cityName}` : '';
    this.log(`Games #${this.state.competitionNumber} begin${location} on turn ${turn}`);
    this.logCompetitionSport();
    this.resolveDueCompetitionSports(turn);
    this.startNextHostingSelection();
  }

  private beginCooldown(turn: number): void {
    const wasCancelled = this.state.phase === 'cancelled';
    this.state.phase = 'cooldown';
    this.state.phaseStartTurn = turn;
    if (this.state.excludedGamesNumber === this.state.competitionNumber) {
      delete this.state.excludedGamesNumber;
      this.state.excludedNationIds = [];
    }
    const nextGamesNumber = this.state.competitionNumber + 1;
    const councilSchedule = this.state.worldCouncilScheduleGamesNumber === nextGamesNumber;
    this.state.nextTransitionTurn = councilSchedule
      ? Math.max(turn, (this.state.scheduledGamesTurn ?? turn) - GAMES_OF_NATIONS_PREPARATION_TURNS)
      : turn + GAMES_OF_NATIONS_COOLDOWN_TURNS;
    if (!councilSchedule) this.state.scheduledGamesTurn = (this.state.scheduledGamesTurn ?? turn) + this.currentCycleTurns();
    delete this.state.activeSportIndex;
    this.log(`Games #${this.state.competitionNumber} ${wasCancelled ? 'cancelled' : 'completed'}; entering cooldown`);
  }

  private beginPreparation(turn: number): void {
    const nextGamesNumber = this.state.competitionNumber + 1;
    if (this.state.hostingGamesNumber !== nextGamesNumber) {
      this.state.hostingGamesNumber = nextGamesNumber;
      this.state.offeredHostNationIds = [];
      this.state.declinedHostNationIds = [];
      this.state.stadiumRequirementGrandfathered = false;
      this.selectNextHost();
    }
    this.state.phase = 'preparation';
    this.state.phaseStartTurn = turn;
    const councilSchedule = this.state.worldCouncilScheduleGamesNumber === nextGamesNumber;
    this.state.nextTransitionTurn = councilSchedule
      ? this.state.scheduledGamesTurn ?? turn + GAMES_OF_NATIONS_PREPARATION_TURNS
      : turn + GAMES_OF_NATIONS_PREPARATION_TURNS;
    if (councilSchedule) delete this.state.worldCouncilScheduleGamesNumber;
    this.state.competitionNumber = nextGamesNumber;
    this.freezeCurrentProgram();
    delete this.state.cancellationReason;
    this.promoteUpcomingHost();
    this.initializeCycleParticipants();
    this.applyCurrentCycleExclusions();
    this.log(`Preparation for Games #${this.state.competitionNumber} begins; competition starts on turn ${this.state.scheduledGamesTurn}`);
  }

  private selectNextHost(): void {
    this.offerHostingFrom(this.state.hostRotationIndex + 1);
  }

  private validHostCities(nationId: string): GamesOfNationsHostCityCandidate[] {
    const supplied = this.dependencies.getHostCityCandidates?.(nationId);
    if (supplied) {
      return supplied
        .filter((city) => city && typeof city.id === 'string' && (city.canConstructGrandStadium || city.hasGrandStadium))
        .map((city) => ({ ...city }));
    }
    const capital = this.dependencies.getCapitalCity(nationId);
    return capital ? [{ ...capital, productionPerTurn: 0, canConstructGrandStadium: true, hasGrandStadium: false }] : [];
  }

  private offerHostingFrom(startIndex: number): void {
    const order = this.state.hostRotationOrder;
    const living = new Set(this.dependencies.getLivingNationIds());
    const offered = new Set(this.state.offeredHostNationIds ?? []);
    delete this.state.hostCandidateNationId;
    for (let offset = 0; offset < order.length; offset += 1) {
      const index = ((startIndex + offset) % order.length + order.length) % order.length;
      const nationId = order[index]!;
      if (!living.has(nationId) || offered.has(nationId)) continue;
      offered.add(nationId);
      this.state.offeredHostNationIds = [...offered];
      this.state.hostCandidateNationId = nationId;
      this.state.hostingDecision = 'pendingDecision';
      const cities = this.validHostCities(nationId);
      if (cities.length === 0) {
        this.state.declinedHostNationIds = unique([...(this.state.declinedHostNationIds ?? []), nationId]);
        this.log(`${this.nationName(nationId)} cannot host Games #${this.state.hostingGamesNumber}: no valid host city`);
        continue;
      }
      if (this.isInteractiveHuman(nationId)) return;
      const autoplayCapital = this.isHumanNation(nationId) && this.dependencies.isAutoplayActive?.() === true
        ? this.selectAutoplayHostCity(nationId, cities)
        : undefined;
      const selected = autoplayCapital ?? [...cities].sort((a, b) =>
        Number(b.hasGrandStadium) - Number(a.hasGrandStadium)
          || b.productionPerTurn - a.productionPerTurn
          || a.id.localeCompare(b.id),
      )[0]!;
      this.log(`${this.nationName(nationId)} accepted hosting Games #${this.state.hostingGamesNumber}`);
      this.confirmHosting(nationId, selected);
      return;
    }
    delete this.state.hostCandidateNationId;
    delete this.state.upcomingHostNationId;
    delete this.state.upcomingHostCityId;
    delete this.state.upcomingHostUsedExistingGrandStadium;
    this.state.hostingDecision = 'cancelled';
    this.state.hostingCancellationReason = 'No eligible nation accepted hosting';
    this.log(`Games #${this.state.hostingGamesNumber} has no host: ${this.state.hostingCancellationReason}`);
  }

  private confirmHosting(nationId: string, city: GamesOfNationsHostCityCandidate): void {
    const gamesNumber = this.state.hostingGamesNumber ?? this.state.competitionNumber;
    this.state.hostingDecision = 'confirmed';
    this.state.upcomingHostNationId = nationId;
    this.state.upcomingHostCityId = city.id;
    this.state.upcomingHostUsedExistingGrandStadium = city.hasGrandStadium;
    this.state.hostRotationIndex = Math.max(0, this.state.hostRotationOrder.indexOf(nationId));
    if (gamesNumber === this.state.competitionNumber) {
      this.state.hostNationId = nationId;
      this.state.hostCityId = city.id;
      this.state.hostUsedExistingGrandStadium = city.hasGrandStadium;
    }
    this.state.stadiumRequirementGrandfathered = false;
    this.log(city.hasGrandStadium
      ? `${city.name} selected as host city for Games #${gamesNumber}; existing Grand Stadium satisfies hosting requirement`
      : `${city.name} selected as host city for Games #${gamesNumber}; Grand Stadium construction required`);
    if (!city.hasGrandStadium) this.log(`Grand Stadium required in ${city.name} before turn ${this.hostingDeadline()}`);
    const replacement = this.state.pendingWorldCouncilHostReplacement?.gamesNumber === gamesNumber
      ? this.state.pendingWorldCouncilHostReplacement
      : undefined;
    if (replacement || this.state.hostingAnnouncementEmittedGamesNumber !== gamesNumber) {
      this.state.hostingAnnouncementEmittedGamesNumber = gamesNumber;
      this.dependencies.onHostingConfirmed?.({
        gamesNumber,
        hostNationId: nationId,
        hostCityId: city.id,
        hostCityName: city.name,
        usedExistingGrandStadium: city.hasGrandStadium,
        scheduledGamesTurn: this.hostingDeadline(),
        turn: this.dependencies.getCurrentTurn(),
        previousHostNationId: replacement?.previousHostNationId,
        worldCouncilReplacement: replacement !== undefined,
      });
    }
    if (replacement) {
      this.log(`${city.name} selected as replacement host city; Competition rescheduled for turn ${this.hostingDeadline()}`);
      delete this.state.pendingWorldCouncilHostReplacement;
    }
  }

  private promoteUpcomingHost(): void {
    if (this.state.hostingGamesNumber !== this.state.competitionNumber) return;
    this.state.hostNationId = this.state.upcomingHostNationId;
    this.state.hostCityId = this.state.upcomingHostCityId;
    this.state.hostUsedExistingGrandStadium = this.state.upcomingHostUsedExistingGrandStadium;
  }

  private startNextHostingSelection(): void {
    this.state.hostingGamesNumber = this.state.competitionNumber + 1;
    this.state.offeredHostNationIds = [];
    this.state.declinedHostNationIds = [];
    delete this.state.hostCandidateNationId;
    delete this.state.upcomingHostNationId;
    delete this.state.upcomingHostCityId;
    delete this.state.upcomingHostUsedExistingGrandStadium;
    delete this.state.hostingCancellationReason;
    this.state.stadiumRequirementGrandfathered = false;
    this.selectNextHost();
    this.maybeStartFutureFallbackAuction(this.dependencies.getCurrentTurn(), this.state.hostingGamesNumber);
  }

  private maybeStartFutureFallbackAuction(turn: number, gamesNumber: number): void {
    const inFuture = this.state.futureFallbackActive === true || this.dependencies.getWorldEra?.() === 'future';
    if (!inFuture || this.remainingAdditionalSportIds().length === 0) return;
    this.state.futureFallbackActive = true;
    if (this.state.lastFutureFallbackHostingGamesNumber === gamesNumber) return;
    this.state.lastFutureFallbackHostingGamesNumber = gamesNumber;
    this.startSportAuction('future', 'futureHostingCycle', turn, gamesNumber);
  }

  private introductionGamesNumber(): number {
    return this.state.phase === 'waitingForFirstGames'
      ? this.state.competitionNumber
      : this.state.competitionNumber + 1;
  }

  private remainingAdditionalSportIds(): GamesOfNationsSportId[] {
    const introduced = new Set(this.state.introducedAdditionalSportIds ?? []);
    return ADDITIONAL_GAMES_SPORT_IDS.filter((id) => !introduced.has(id));
  }

  private programSportIds(): GamesOfNationsSportId[] {
    return [...TRADITIONAL_GAMES_SPORT_IDS, ...(this.state.introducedAdditionalSportIds ?? [])];
  }

  private cycleSportIds(): GamesOfNationsSportId[] {
    return this.state.frozenSportIds?.length ? this.state.frozenSportIds : this.programSportIds();
  }

  private cycleSports(): GamesOfNationsSport[] {
    return this.cycleSportIds().map((id) => getGamesSportById(id).name);
  }

  private freezeCurrentProgram(): void {
    this.state.frozenSportIds = this.programSportIds();
  }

  private hostingDeadline(): number {
    const scheduled = this.state.scheduledGamesTurn ?? this.state.firstGamesTurn ?? this.dependencies.getCurrentTurn();
    if (this.state.worldCouncilScheduleGamesNumber === this.state.hostingGamesNumber) return scheduled;
    const selectingNextDuringCurrentGames = (this.state.hostingGamesNumber ?? this.state.competitionNumber) > this.state.competitionNumber
      && (this.state.phase === 'competition' || this.state.phase === 'cancelled');
    return selectingNextDuringCurrentGames ? scheduled + this.currentCycleTurns() : scheduled;
  }

  private currentCycleTurns(): number {
    return GAMES_OF_NATIONS_PREPARATION_TURNS + this.cycleSports().length + GAMES_OF_NATIONS_COOLDOWN_TURNS;
  }

  private validateHostAtDeadline(): string | null {
    if (this.state.stadiumRequirementGrandfathered) return null;
    if (this.state.hostingDecision === 'cancelled') return this.state.hostingCancellationReason ?? 'No nation accepted hosting';
    const nationId = this.state.hostNationId;
    const cityId = this.state.hostCityId;
    if (!nationId || !this.dependencies.getLivingNationIds().includes(nationId)) return 'Confirmed host nation is no longer valid';
    if (!cityId) return 'Confirmed host city is no longer valid';
    const owner = this.dependencies.getCityOwnerId?.(cityId);
    if (owner !== undefined && owner !== nationId) return `${this.currentHostCityName() ?? 'Host city'} is no longer owned by the confirmed host`;
    if (this.dependencies.hasGrandStadium && !this.dependencies.hasGrandStadium(cityId)) {
      return `Grand Stadium incomplete in ${this.currentHostCityName() ?? 'host city'} at competition deadline`;
    }
    return null;
  }

  private cancelGames(turn: number, reason: string): void {
    this.state.phase = 'cancelled';
    this.state.phaseStartTurn = turn;
    this.state.nextTransitionTurn = turn + this.cycleSports().length;
    this.state.scheduledGamesTurn = turn;
    this.state.cancellationReason = reason;
    delete this.state.activeSportIndex;
    this.state.sportResults = createSportResults(this.cycleSports());
    this.state.medalTable = [];
    delete this.state.overallWinnerNationId;
    this.archiveCancelledGames(turn, reason);
    this.log(`Games #${this.state.competitionNumber} cancelled: ${reason}`);
    if (this.state.cancellationEventEmittedGamesNumber !== this.state.competitionNumber) {
      this.state.cancellationEventEmittedGamesNumber = this.state.competitionNumber;
      this.dependencies.onGamesCancelled?.({
        gamesNumber: this.state.competitionNumber,
        hostNationId: this.state.hostNationId,
        hostCityId: this.state.hostCityId,
        hostCityName: this.currentHostCityName(),
        reason,
        turn,
      });
    }
  }

  private resolveScheduledHost(): void {
    const currentHostValid = this.state.hostNationId !== undefined
      && this.dependencies.getLivingNationIds().includes(this.state.hostNationId)
      && this.dependencies.getCapitalCity(this.state.hostNationId) !== undefined;
    if (currentHostValid) {
      this.state.hostCityId = this.dependencies.getCapitalCity(this.state.hostNationId!)?.id;
      return;
    }
    this.resolveHostFrom(this.state.hostRotationIndex + 1);
  }

  private resolveHostFrom(startIndex: number): void {
    const order = this.state.hostRotationOrder;
    const living = new Set(this.dependencies.getLivingNationIds());
    for (let offset = 0; offset < order.length; offset += 1) {
      const index = ((startIndex + offset) % order.length + order.length) % order.length;
      const nationId = order[index]!;
      const capital = living.has(nationId) ? this.dependencies.getCapitalCity(nationId) : undefined;
      if (!capital) continue;
      this.state.hostRotationIndex = index;
      this.state.hostNationId = nationId;
      this.state.hostCityId = capital.id;
      return;
    }
    delete this.state.hostNationId;
    delete this.state.hostCityId;
  }

  private createParticipants(): GamesOfNationsParticipantState[] {
    return unique(this.dependencies.getLivingNationIds()).map((nationId) => newParticipant(nationId));
  }

  private pruneInvalidParticipants(): void {
    const living = new Set(this.dependencies.getLivingNationIds());
    this.state.participants = this.state.participants.filter((participant) => living.has(participant.nationId));
  }

  /**
   * At competition start, drop every nation that is the recorded aggressor in an
   * active war. Committed investment is not refunded — the nation simply forfeits
   * its participation. Being a defender never triggers exclusion. The host is
   * subject to the same rule as everyone else.
   */
  private excludeWartimeAggressors(): void {
    if (!this.dependencies.isActiveWarAggressor) return;
    for (const participant of this.state.participants) {
      if (!participant.participating) continue;
      if (this.isExcludedFromGames(participant.nationId, this.state.competitionNumber)) continue;
      if (!this.dependencies.isActiveWarAggressor(participant.nationId)) continue;
      participant.participating = false;
      this.log(`${this.nationName(participant.nationId)} excluded from competition: active war aggressor`);
    }
  }

  /** Final participant set after opt-out, World Council exclusion and aggressor exclusion. */
  private countEligibleParticipants(): number {
    const living = new Set(this.dependencies.getLivingNationIds());
    return this.state.participants.filter((participant) =>
      participant.participating
      && living.has(participant.nationId)
      && !this.isExcludedFromGames(participant.nationId, this.state.competitionNumber),
    ).length;
  }

  private getActiveSport(): GamesOfNationsSport | null {
    if (this.state.phase !== 'competition' || this.state.activeSportIndex === undefined) return null;
    return this.cycleSports()[this.state.activeSportIndex] ?? null;
  }

  private logCompetitionSport(): void {
    const sport = this.getActiveSport();
    if (sport) this.log(`Games #${this.state.competitionNumber} competition: ${sport}`);
  }

  private initializeCycleParticipants(): void {
    this.state.participants = this.createParticipants();
    this.state.sportResults = createSportResults(this.cycleSports());
    this.state.medalTable = [];
    delete this.state.overallWinnerNationId;
    delete this.state.hostBonusCalculated;
    delete this.state.totalExternalInitialGamesPoints;
    delete this.state.hostBonusGamesPoints;
    delete this.state.hostBonusSport;
    this.initializeMissingAIStrategies();
    this.initializeHostBonusForPreparation();
  }

  private resolveDueCompetitionSports(turn: number): void {
    if (this.state.phase !== 'competition' || this.state.phaseStartTurn === undefined) return;
    const lastDueIndex = Math.min(
      this.cycleSports().length - 1,
      Math.max(-1, turn - this.state.phaseStartTurn),
    );
    for (let index = 0; index <= lastDueIndex; index += 1) this.resolveSport(index, turn);
  }

  private resolveSport(sportIndex: number, resolutionTurn: number): void {
    const cycleSports = this.cycleSports();
    const sport = cycleSports[sportIndex];
    if (!sport) return;
    const results = this.state.sportResults ?? (this.state.sportResults = createSportResults(cycleSports));
    const result = results[sportIndex];
    if (!result || result.resolved) return;

    const living = new Set(this.dependencies.getLivingNationIds());
    const weighted = this.state.participants
      .filter((participant) => participant.participating
        && living.has(participant.nationId)
        && !this.isExcludedFromGames(participant.nationId, this.state.competitionNumber))
      .map((participant) => ({
        nationId: participant.nationId,
        weight: this.getEffectiveGamesPoints(participant.nationId, sport),
      }))
      .filter((entry) => entry.weight > 0);
    const medals = drawSportMedals(
      weighted,
      `${this.dependencies.seed ?? 'games'}|${this.state.competitionNumber}|${sport}|medals`,
    );
    result.resolved = true;
    result.competitionTurn = sportIndex + 1;
    result.weights = Object.fromEntries(weighted.map((entry) => [entry.nationId, entry.weight]));
    if (medals.goldNationId) result.goldNationId = medals.goldNationId;
    if (medals.silverNationId) result.silverNationId = medals.silverNationId;
    if (medals.bronzeNationId) result.bronzeNationId = medals.bronzeNationId;

    this.state.medalTable = buildMedalTable(
      results,
      this.state.hostRotationOrder,
      this.state.participants
        .filter((participant) => participant.participating
          && !this.isExcludedFromGames(participant.nationId, this.state.competitionNumber))
        .map((participant) => participant.nationId),
    );
    const medalText = [
      result.goldNationId ? `Gold ${this.nationName(result.goldNationId)}` : 'no Gold',
      result.silverNationId ? `Silver ${this.nationName(result.silverNationId)}` : 'no Silver',
      result.bronzeNationId ? `Bronze ${this.nationName(result.bronzeNationId)}` : 'no Bronze',
    ].join(', ');
    this.log(`Games #${this.state.competitionNumber} ${sport}: ${medalText}`);

    if (result.goldNationId) {
      this.dependencies.onGoldMedal?.({
        gamesNumber: this.state.competitionNumber,
        sport,
        goldNationId: result.goldNationId,
        hostNationId: this.state.hostNationId,
        hostCityId: this.state.hostCityId,
        hostCityName: this.currentHostCityName(),
        turn: (this.state.phaseStartTurn ?? 0) + sportIndex,
      });
    }

    if (sportIndex === cycleSports.length - 1) this.finalizeCompetition();
    const scheduledSportTurn = (this.state.phaseStartTurn ?? 0) + sportIndex;
    if (resolutionTurn === scheduledSportTurn) this.emitSportResolved(sportIndex, result, living);
  }

  private emitSportResolved(
    sportIndex: number,
    result: GamesOfNationsSportResult,
    living: ReadonlySet<string>,
  ): void {
    const nextSport = this.cycleSports()[sportIndex + 1];
    const nextSportCandidates = nextSport
      ? this.state.participants
        .filter((participant) => participant.participating
          && living.has(participant.nationId)
          && !this.isExcludedFromGames(participant.nationId, this.state.competitionNumber))
        .map((participant) => ({
          nationId: participant.nationId,
          gamesPoints: this.getEffectiveGamesPoints(participant.nationId, nextSport),
        }))
        .filter((candidate) => candidate.gamesPoints > 0)
      : [];
    this.dependencies.onSportResolved?.({
      gamesNumber: this.state.competitionNumber,
      competitionDay: sportIndex + 1,
      sport: result.sport,
      result: cloneSportResult(result),
      hostNationId: this.state.hostNationId,
      hostCityId: this.state.hostCityId,
      hostCityName: this.currentHostCityName(),
      nextSport,
      nextSportCandidates,
      medalTable: (this.state.medalTable ?? []).map((standing) => ({ ...standing })),
      overallWinnerNationId: this.state.overallWinnerNationId,
      turn: (this.state.phaseStartTurn ?? 0) + sportIndex,
    });
  }

  private finalizeCompetition(): void {
    const standings = this.state.medalTable ?? [];
    const winner = standings.find((standing) => standing.gold + standing.silver + standing.bronze > 0);
    if (winner) this.state.overallWinnerNationId = winner.nationId;
    else delete this.state.overallWinnerNationId;
    const winnerText = winner
      ? `${this.nationName(winner.nationId)} wins overall with ${winner.gold} Gold, ${winner.silver} Silver, ${winner.bronze} Bronze`
      : 'no overall winner; no medals were awarded';
    this.log(`Games #${this.state.competitionNumber} complete: ${winnerText}`);
    this.archiveCompletedGames(winner?.nationId);
    this.dependencies.onGamesCompleted?.({
      gamesNumber: this.state.competitionNumber,
      hostNationId: this.state.hostNationId,
      hostCityId: this.state.hostCityId,
      hostCityName: this.currentHostCityName(),
      overallWinnerNationId: winner?.nationId,
      medalTable: standings.map((standing) => ({ ...standing })),
      turn: (this.state.phaseStartTurn ?? 0) + this.cycleSports().length - 1,
    });
  }

  private archiveCompletedGames(overallWinnerNationId: string | undefined): void {
    const completedGames = this.state.completedGames ?? (this.state.completedGames = []);
    if (completedGames.some((record) => record.gamesNumber === this.state.competitionNumber)) return;
    const tournamentStartTurn = this.state.phaseStartTurn ?? this.dependencies.getCurrentTurn();
    const completionTurn = tournamentStartTurn + this.cycleSports().length - 1;
    const date = this.dependencies.getWorldDateForTurn?.(tournamentStartTurn)
      ?? { worldYear: 0, yearLabel: `Turn ${tournamentStartTurn}` };
    const hostNationId = this.state.hostNationId;
    const hostCityId = this.state.hostCityId;
    const historicalHostCityName = hostCityId
      ? this.dependencies.getCityName?.(hostCityId) ?? 'Unknown city'
      : 'Unknown city';
    completedGames.push({
      status: 'completed',
      gamesNumber: this.state.competitionNumber,
      tournamentStartTurn,
      completionTurn,
      worldYear: date.worldYear,
      yearLabel: date.yearLabel,
      hostNationId,
      hostNationName: hostNationId ? this.nationName(hostNationId) : 'Unknown host',
      hostCityId,
      hostCityName: historicalHostCityName,
      ...(this.state.hostUsedExistingGrandStadium === true ? { usedExistingGrandStadium: true } : {}),
      overallWinnerNationId,
      overallWinnerNationName: overallWinnerNationId ? this.nationName(overallWinnerNationId) : undefined,
      hostBonusGamesPoints: whole(this.state.hostBonusGamesPoints ?? 0),
      sportIds: [...this.cycleSportIds()],
      ...(this.state.hostBonusSport ? { hostBonusSport: this.state.hostBonusSport } : {}),
      medalTable: (this.state.medalTable ?? []).map((standing) => ({
        ...standing,
        nationName: this.nationName(standing.nationId),
      })),
    });
    completedGames.sort((a, b) => a.gamesNumber - b.gamesNumber);
  }

  private archiveCancelledGames(turn: number, reason: string): void {
    const completedGames = this.state.completedGames ?? (this.state.completedGames = []);
    if (completedGames.some((record) => record.gamesNumber === this.state.competitionNumber)) return;
    const date = this.dependencies.getWorldDateForTurn?.(turn)
      ?? { worldYear: 0, yearLabel: `Turn ${turn}` };
    const hostNationId = this.state.hostNationId;
    const hostCityId = this.state.hostCityId;
    completedGames.push({
      status: 'cancelled',
      cancellationReason: reason,
      gamesNumber: this.state.competitionNumber,
      tournamentStartTurn: turn,
      completionTurn: turn,
      worldYear: date.worldYear,
      yearLabel: date.yearLabel,
      hostNationId,
      hostNationName: hostNationId ? this.nationName(hostNationId) : 'No confirmed host',
      hostCityId,
      hostCityName: hostCityId ? this.dependencies.getCityName?.(hostCityId) ?? 'Unknown city' : 'No host city',
      ...(this.state.hostUsedExistingGrandStadium === true ? { usedExistingGrandStadium: true } : {}),
      sportIds: [...this.cycleSportIds()],
      medalTable: [],
    });
    completedGames.sort((a, b) => a.gamesNumber - b.gamesNumber);
  }

  private currentHostCityName(): string | undefined {
    const savedHostCityName = this.state.hostCityId
      ? this.dependencies.getCityName?.(this.state.hostCityId)
      : undefined;
    if (savedHostCityName) return savedHostCityName;
    return this.state.hostNationId
      ? this.dependencies.getCapitalCity(this.state.hostNationId)?.name
      : undefined;
  }

  private initializeMissingAIStrategies(): void {
    for (const participant of this.state.participants) {
      if (this.isExcludedFromGames(participant.nationId, this.state.competitionNumber)) continue;
      if (this.isInteractiveHuman(participant.nationId)) continue;
      this.initializeAIStrategy(participant);
    }
  }

  private initializeHostBonusForPreparation(): void {
    if (this.state.phase !== 'preparation' || this.state.hostBonusCalculated) return;
    for (const participant of this.state.participants) {
      if (this.isExcludedFromGames(participant.nationId, this.state.competitionNumber)) continue;
      if (this.isInteractiveHuman(participant.nationId)) continue;
      this.captureInitialCommitment(participant);
    }
    this.calculateHostBonusIfReady();
    this.assignAIHostBonusSportIfReady();
  }

  private captureInitialCommitment(participant: GamesOfNationsParticipantState): void {
    if (participant.initialCultureCommitment === undefined) {
      participant.initialCultureCommitment = whole(participant.cultureCommitment);
    }
    if (participant.initialProductionCommitment === undefined) {
      participant.initialProductionCommitment = whole(participant.productionCommitment);
    }
  }

  private calculateHostBonusIfReady(): void {
    if (this.state.hostBonusCalculated || !this.state.hostNationId) return;
    const included = this.state.participants.filter((participant) =>
      participant.participating && participant.nationId !== this.state.hostNationId,
    );
    if (included.some((participant) =>
      participant.initialCultureCommitment === undefined
      || participant.initialProductionCommitment === undefined,
    )) return;
    const totalExternalInitialGamesPoints = included.reduce((sum, participant) =>
      sum + (
        whole(participant.initialCultureCommitment ?? 0)
        + whole(participant.initialProductionCommitment ?? 0)
      ) * GAMES_POINTS_PER_RESOURCE,
    0);
    this.state.totalExternalInitialGamesPoints = totalExternalInitialGamesPoints;
    this.state.hostBonusGamesPoints = Math.floor(totalExternalInitialGamesPoints * HOST_GAMES_BONUS_RATE);
    this.state.hostBonusCalculated = true;
    this.log(
      `Games #${this.state.competitionNumber} host bonus: ${this.nationName(this.state.hostNationId)} receives ${this.state.hostBonusGamesPoints} GP from ${totalExternalInitialGamesPoints} external initial GP`,
    );
  }

  private assignAIHostBonusSportIfReady(): void {
    if (!this.state.hostBonusCalculated || this.state.hostBonusSport || !this.state.hostNationId) return;
    if (this.isInteractiveHuman(this.state.hostNationId)) return;
    const host = this.getParticipant(this.state.hostNationId);
    if (!host) return;
    const activeSports = this.cycleSports();
    const weights = buildAISportWeights(
      `${this.dependencies.seed ?? 'games'}|${this.state.competitionNumber}|${host.nationId}|sports`,
      activeSports,
      this.dependencies.getLeaderGamesPreferences?.(host.nationId),
    );
    this.state.hostBonusSport = activeSports.reduce((best, sport) =>
      weights[sport] > weights[best] ? sport : best,
    activeSports[0]);
    this.log(`${this.nationName(host.nationId)} assigned ${this.state.hostBonusGamesPoints ?? 0} host bonus GP to ${this.state.hostBonusSport}`);
  }

  private initializeAIStrategy(participant: GamesOfNationsParticipantState): void {
    if (participant.strategyInitialized) return;
    const nationId = participant.nationId;
    const cultureOutput = whole(this.dependencies.getCultureOutput?.(nationId) ?? 0);
    const productionOutput = (this.dependencies.getProductionSources?.(nationId) ?? [])
      .reduce((sum, source) => sum + whole(source.available), 0);
    const priority = clamp(this.dependencies.getCulturalPriority?.(nationId) ?? 0.5, 0, 1);
    const cultureVariation = stableUnit(`${this.dependencies.seed ?? 'games'}|${this.state.competitionNumber}|${nationId}|culture`) - 0.5;
    const productionVariation = stableUnit(`${this.dependencies.seed ?? 'games'}|${this.state.competitionNumber}|${nationId}|production`) - 0.5;
    const cultureRate = clamp(0.10 + priority * 0.16 + cultureVariation * 0.06, 0.08, 0.30);
    const productionRate = clamp(0.07 + priority * 0.06 + productionVariation * 0.05, 0.05, 0.16);
    participant.cultureCommitment = conservativeCommitment(cultureOutput, cultureRate, 4);
    participant.productionCommitment = conservativeCommitment(productionOutput, productionRate, 6);
    participant.strategyInitialized = true;
    const gamesPreferences = this.dependencies.getLeaderGamesPreferences?.(nationId);
    if (gamesPreferences) {
      this.log(`${this.nationName(nationId)} leader favorites: Traditional ${getGamesSportById(gamesPreferences.traditionalFavourite).name}; Additional ${getGamesSportById(gamesPreferences.additionalFavourite).name}`);
    }
    this.log(`${this.nationName(nationId)} strategy: Culture ${participant.cultureCommitment}/turn, Production ${participant.productionCommitment}/turn`);
  }

  private allocateAIGamesPoints(participant: GamesOfNationsParticipantState, generatedPoints: number): void {
    const amount = Math.min(whole(generatedPoints), participant.unallocatedGamesPoints);
    if (amount <= 0) return;
    const activeSports = this.cycleSports();
    const weights = buildAISportWeights(
      `${this.dependencies.seed ?? 'games'}|${this.state.competitionNumber}|${participant.nationId}|sports`,
      activeSports,
      this.dependencies.getLeaderGamesPreferences?.(participant.nationId),
    );
    const distributed = distributeGamesPointsByWeights(amount, weights, activeSports);
    for (const sport of activeSports) participant.gamesPointsBySport[sport] += distributed[sport];
    participant.unallocatedGamesPoints -= amount;
    this.log(`${this.nationName(participant.nationId)} allocated ${amount} generated GP directly across active sports`);
  }

  private allocateHumanGamesPointsByStrategy(
    participant: GamesOfNationsParticipantState,
    generatedPoints: number,
  ): void {
    const activeSports = this.cycleSports();
    const planned = activeSports.reduce((sum, sport) => sum + participant.gamesPointsStrategyBySport[sport], 0);
    if (planned > generatedPoints) {
      participant.gamesPointsStrategyBySport = reduceGamesStrategyToBudget(
        participant.gamesPointsStrategyBySport,
        generatedPoints,
        activeSports,
      );
      this.log(`${this.nationName(participant.nationId)} Games strategy rebalanced from ${planned} to ${generatedPoints} GP after actual investment changed`);
    }
    if (planned !== generatedPoints) participant.strategyAdjustmentPending = true;
    const adjustedTotal = activeSports.reduce((sum, sport) => sum + participant.gamesPointsStrategyBySport[sport], 0);
    this.allocatePoolByHumanStrategy(participant, Math.min(generatedPoints, adjustedTotal));
  }

  private allocatePoolByHumanStrategy(
    participant: GamesOfNationsParticipantState,
    maximumAmount: number,
  ): void {
    const activeSports = this.cycleSports();
    const amount = Math.min(whole(maximumAmount), participant.unallocatedGamesPoints);
    if (amount <= 0) return;
    const strategyTotal = activeSports.reduce((sum, sport) => sum + participant.gamesPointsStrategyBySport[sport], 0);
    if (strategyTotal <= 0) return;
    const distributed = distributeGamesPointsByWeights(
      amount,
      participant.gamesPointsStrategyBySport,
      activeSports,
    );
    for (const sport of activeSports) participant.gamesPointsBySport[sport] += distributed[sport];
    participant.unallocatedGamesPoints -= amount;
    this.log(`${this.nationName(participant.nationId)} applied ${amount} GP using its recurring sport strategy`);
  }

  private distributeParticipantPoolEvenly(
    participant: GamesOfNationsParticipantState,
    reason: 'manually distributed' | 'auto-distributed',
  ): boolean {
    const amount = participant.unallocatedGamesPoints;
    if (amount <= 0) return true;
    const activeSports = this.cycleSports();
    const distributed = distributeGamesPointsEvenly(amount, activeSports);
    for (const sport of activeSports) participant.gamesPointsBySport[sport] += distributed[sport];
    participant.unallocatedGamesPoints = 0;
    this.log(`${this.nationName(participant.nationId)} ${reason} ${amount} remaining GP across ${activeSports.length} sports`);
    return true;
  }

  private autoDistributeAllRemainingGamesPoints(): void {
    for (const participant of this.state.participants) {
      if (!participant.participating || this.isExcludedFromGames(participant.nationId, this.state.competitionNumber)) continue;
      this.distributeParticipantPoolEvenly(participant, 'auto-distributed');
    }
    const remaining = this.state.participants.reduce((sum, participant) => sum + participant.unallocatedGamesPoints, 0);
    if (remaining > 0) this.log(`Invariant warning: Competition begins with ${remaining} unallocated GP`);
  }

  private getParticipant(nationId: string): GamesOfNationsParticipantState | undefined {
    return this.state.participants.find((participant) => participant.nationId === nationId);
  }

  private isExcludedFromGames(nationId: string, gamesNumber: number): boolean {
    return this.state.excludedGamesNumber === gamesNumber
      && (this.state.excludedNationIds ?? []).includes(nationId);
  }

  private applyCurrentCycleExclusions(): void {
    if (this.state.excludedGamesNumber !== this.state.competitionNumber) {
      delete this.state.excludedGamesNumber;
      this.state.excludedNationIds = [];
      return;
    }
    for (const participant of this.state.participants) {
      if (!this.isExcludedFromGames(participant.nationId, this.state.competitionNumber)) continue;
      participant.participating = false;
      participant.cultureCommitment = 0;
      participant.productionCommitment = 0;
    }
  }

  private migrateStep1FirstGames(currentTurn: number): void {
    if (this.state.phase !== 'waitingForFirstGames' || this.state.firstGamesTurn === undefined) return;
    const preparationTurn = this.state.firstGamesTurn - GAMES_OF_NATIONS_PREPARATION_TURNS;
    if (currentTurn < preparationTurn) {
      this.state.nextTransitionTurn = preparationTurn;
      return;
    }
    if (currentTurn < this.state.firstGamesTurn) {
      this.state.phase = 'preparation';
      this.state.phaseStartTurn = preparationTurn;
      this.state.nextTransitionTurn = this.state.firstGamesTurn;
      this.resolveScheduledHost();
      this.state.participants = this.createParticipants();
    }
  }

  /** Safely captures the one fully retained Step 4 cooldown result; never guesses older cycles. */
  private migrateCompletedStep4Games(): void {
    if (this.state.phase !== 'cooldown') return;
    if ((this.state.completedGames ?? []).some((record) => record.gamesNumber === this.state.competitionNumber)) return;
    if (!(this.state.sportResults ?? []).every((result) => result.resolved)) return;
    if (!this.state.overallWinnerNationId || this.state.phaseStartTurn === undefined) return;
    const cooldownStartTurn = this.state.phaseStartTurn;
    const originalPhaseStart = this.state.phaseStartTurn;
    this.state.phaseStartTurn = cooldownStartTurn - this.cycleSports().length;
    this.archiveCompletedGames(this.state.overallWinnerNationId);
    this.state.phaseStartTurn = originalPhaseStart;
  }

  private migrateHostBonusState(): void {
    if (this.state.hostBonusCalculated) {
      this.assignAIHostBonusSportIfReady();
      return;
    }
    if (this.state.phase === 'competition' || this.state.phase === 'cooldown') {
      for (const participant of this.state.participants) this.captureInitialCommitment(participant);
      this.state.totalExternalInitialGamesPoints = 0;
      this.state.hostBonusGamesPoints = 0;
      this.state.hostBonusCalculated = true;
      return;
    }
    if (this.state.phase !== 'preparation') return;
    this.initializeHostBonusForPreparation();
    const acknowledged = this.state.humanPreparationPromptAcknowledgedCompetitionNumber === this.state.competitionNumber;
    if (!acknowledged) return;
    const human = this.state.participants.find((participant) => this.isInteractiveHuman(participant.nationId));
    if (!human) return;
    if (human.nationId === this.state.hostNationId) {
      delete this.state.humanPreparationPromptAcknowledgedCompetitionNumber;
      return;
    }
    this.captureInitialCommitment(human);
    this.calculateHostBonusIfReady();
    this.assignAIHostBonusSportIfReady();
  }

  private migrateHostingState(): void {
    if (this.state.hostingSchemaVersion === 1) return;
    this.state.hostingSchemaVersion = 1;
    this.state.hostingGamesNumber = this.state.competitionNumber;
    this.state.offeredHostNationIds = this.state.hostNationId ? [this.state.hostNationId] : [];
    this.state.declinedHostNationIds = [];
    this.state.hostCandidateNationId = this.state.hostNationId;
    this.state.hostingDecision = this.state.hostNationId && this.state.hostCityId ? 'confirmed' : 'cancelled';
    this.state.upcomingHostNationId = this.state.hostNationId;
    this.state.upcomingHostCityId = this.state.hostCityId;
    this.state.stadiumRequirementGrandfathered = true;
    if (!this.state.hostNationId || !this.state.hostCityId) {
      this.state.hostingCancellationReason = 'Legacy Games cycle had no valid host';
    }
    this.log(`Legacy Games #${this.state.competitionNumber} grandfathered from Grand Stadium requirement`);
  }

  private migrateSportExpansionState(): void {
    if (this.state.processedSportIntroductionEras !== undefined) return;
    const currentEra = this.dependencies.getWorldEra?.();
    const rank = ['ancient', 'classical', 'medieval', ...GAMES_OF_NATIONS_ERA_AUCTIONS, 'future'].indexOf(currentEra ?? 'ancient');
    this.state.processedSportIntroductionEras = GAMES_OF_NATIONS_ERA_AUCTIONS.filter((era) =>
      ['ancient', 'classical', 'medieval', ...GAMES_OF_NATIONS_ERA_AUCTIONS, 'future'].indexOf(era) <= rank,
    );
    this.state.introducedAdditionalSportIds ??= [];
    this.state.sportIntroductionRecords ??= [];
    this.state.futureFallbackActive = currentEra === 'future';
    if (!this.state.frozenSportIds && this.state.phase !== 'waitingForFirstGames') this.freezeCurrentProgram();
    this.log(`Legacy sport program migrated with five traditional sports; past era auctions treated as processed`);
  }

  private nationName(nationId: string): string {
    return this.dependencies.getNationName(nationId) ?? nationId;
  }

  private isHumanNation(nationId: string): boolean {
    return this.dependencies.isHumanNation?.(nationId) === true;
  }

  private isInteractiveHuman(nationId: string): boolean {
    return this.isHumanNation(nationId) && this.dependencies.isAutoplayActive?.() !== true;
  }

  private selectAutoplayHostCity(
    nationId: string,
    cities: readonly GamesOfNationsHostCityCandidate[],
  ): GamesOfNationsHostCityCandidate | undefined {
    const capitalId = this.dependencies.getCapitalCity(nationId)?.id;
    return cities.find((city) => city.id === capitalId)
      ?? [...cities].sort((a, b) => b.productionPerTurn - a.productionPerTurn || a.id.localeCompare(b.id))[0];
  }

  /** Converts any already-open human GoN decision into its AI equivalent when autoplay starts. */
  private resolveAutoplayHumanDecisions(): void {
    if (this.dependencies.isAutoplayActive?.() !== true) return;
    const candidate = this.state.hostCandidateNationId;
    if (
      candidate
      && this.isHumanNation(candidate)
      && (this.state.hostingDecision === 'pendingDecision' || this.state.hostingDecision === 'pendingCity')
    ) {
      const selected = this.selectAutoplayHostCity(candidate, this.validHostCities(candidate));
      if (selected) this.confirmHosting(candidate, selected);
      else this.declineHostingOffer(candidate);
    }
    const auction = this.state.pendingSportAuction;
    if (!auction || auction.resolved) return;
    for (const nationId of this.dependencies.getLivingNationIds()) {
      if (!this.isHumanNation(nationId) || auction.proposals.some((proposal) => proposal.nationId === nationId)) continue;
      auction.proposals.push(this.buildAIProposal(
        nationId,
        auction.candidateSportIds,
        auction.triggerEra,
        auction.gamesNumber,
      ));
    }
    this.resolveSportAuction();
  }

  private log(message: string): void {
    this.dependencies.log?.(`[GamesOfNations] ${message}`);
  }
}

function inactiveState(lastProcessedTurn: number): SavedGamesOfNationsState {
  return {
    founded: false,
    phase: 'inactive',
    competitionNumber: 0,
    hostRotationOrder: [],
    hostRotationIndex: -1,
    participants: [],
    sportResults: [],
    medalTable: [],
    completedGames: [],
    lastProcessedTurn,
  };
}

function normalizeState(state: SavedGamesOfNationsState): SavedGamesOfNationsState {
  if (!state.founded) {
    return {
      ...inactiveState(Number.isFinite(state.lastProcessedTurn) ? state.lastProcessedTurn : 0),
      processedSportIntroductionEras: Array.isArray(state.processedSportIntroductionEras)
        ? unique(state.processedSportIntroductionEras).filter((era) => GAMES_OF_NATIONS_ERA_AUCTIONS.includes(era as GamesOfNationsIntroductionEra)) as GamesOfNationsIntroductionEra[]
        : [],
      futureFallbackActive: state.futureFallbackActive === true,
    };
  }
  const phase = ['waitingForFirstGames', 'preparation', 'competition', 'cancelled', 'cooldown'].includes(state.phase)
    ? state.phase
    : 'waitingForFirstGames';
  const introducedAdditionalSportIds = uniqueSportIds(state.introducedAdditionalSportIds, ADDITIONAL_GAMES_SPORT_IDS);
  const programSportIds = [...TRADITIONAL_GAMES_SPORT_IDS, ...introducedAdditionalSportIds];
  const frozenSportIds = uniqueSportIds(state.frozenSportIds, programSportIds);
  const activeSportIds = frozenSportIds.length > 0 ? frozenSportIds : programSportIds;
  const activeSports = activeSportIds.map((id) => getGamesSportById(id).name);
  const sportResults = normalizeSportResults(state.sportResults, activeSports);
  const hostRotationOrder = unique(Array.isArray(state.hostRotationOrder) ? state.hostRotationOrder : []);
  const participants = Array.isArray(state.participants)
    ? state.participants
      .filter((participant) => participant && typeof participant.nationId === 'string')
      .map((participant) => normalizeParticipant(participant))
    : [];
  const excludedGamesNumber = Number.isFinite(state.excludedGamesNumber)
    ? Math.max(1, Math.floor(state.excludedGamesNumber!))
    : undefined;
  const excludedNationIds = unique(Array.isArray(state.excludedNationIds) ? state.excludedNationIds : []);
  const savedHostParticipant = participants.find((participant) => participant.nationId === state.hostNationId);
  if (savedHostParticipant && !(excludedGamesNumber === state.competitionNumber && excludedNationIds.includes(savedHostParticipant.nationId))) {
    savedHostParticipant.participating = true;
  }
  const hasResolvedSport = sportResults.some((result) => result.resolved);
  const medalTable = hasResolvedSport || state.phase === 'competition' || state.phase === 'cooldown'
    ? buildMedalTable(
      sportResults,
      hostRotationOrder,
      participants.filter((participant) => participant.participating
        && !(excludedGamesNumber === state.competitionNumber && excludedNationIds.includes(participant.nationId)))
        .map((participant) => participant.nationId),
    )
    : [];
  const hasMedals = medalTable.some((standing) => standing.gold + standing.silver + standing.bronze > 0);
  const completedGames = normalizeCompletedGames(state.completedGames);
  return {
    ...state,
    phase,
    competitionNumber: Math.max(1, Math.floor(state.competitionNumber || 1)),
    hostRotationOrder,
    offeredHostNationIds: unique(Array.isArray(state.offeredHostNationIds) ? state.offeredHostNationIds : []),
    declinedHostNationIds: unique(Array.isArray(state.declinedHostNationIds) ? state.declinedHostNationIds : []),
    hostRotationIndex: Number.isFinite(state.hostRotationIndex) ? Math.floor(state.hostRotationIndex) : -1,
    participants,
    ...(excludedGamesNumber !== undefined ? { excludedGamesNumber } : {}),
    ...(state.excludedNationIds !== undefined ? { excludedNationIds } : {}),
    sportResults,
    medalTable,
    completedGames,
    introducedAdditionalSportIds,
    frozenSportIds: frozenSportIds.length > 0 ? frozenSportIds : undefined,
    sportIntroductionRecords: Array.isArray(state.sportIntroductionRecords)
      ? state.sportIntroductionRecords.filter((record) => record && isGamesSportId(record.sportId)).map((record) => ({ ...record }))
      : [],
    processedSportIntroductionEras: Array.isArray(state.processedSportIntroductionEras)
      ? unique(state.processedSportIntroductionEras).filter((era) => GAMES_OF_NATIONS_ERA_AUCTIONS.includes(era as GamesOfNationsIntroductionEra)) as GamesOfNationsIntroductionEra[]
      : undefined,
    pendingSportAuction: normalizeAuction(state.pendingSportAuction, introducedAdditionalSportIds),
    ...(state.hostBonusCalculated === true ? { hostBonusCalculated: true } : {}),
    ...(Number.isFinite(state.totalExternalInitialGamesPoints)
      ? { totalExternalInitialGamesPoints: whole(state.totalExternalInitialGamesPoints!) }
      : {}),
    ...(Number.isFinite(state.hostBonusGamesPoints)
      ? { hostBonusGamesPoints: whole(state.hostBonusGamesPoints!) }
      : {}),
    ...(isGamesSport(state.hostBonusSport) ? { hostBonusSport: state.hostBonusSport } : {}),
    ...(stringOrUndefined(state.overallWinnerNationId)
      ? { overallWinnerNationId: state.overallWinnerNationId }
      : sportResults.every((result) => result.resolved) && hasMedals && medalTable[0]
        ? { overallWinnerNationId: medalTable[0].nationId }
        : {}),
    lastProcessedTurn: Number.isFinite(state.lastProcessedTurn) ? state.lastProcessedTurn : 0,
  };
}

function cloneState(state: SavedGamesOfNationsState): SavedGamesOfNationsState {
  return {
    ...state,
    hostRotationOrder: [...state.hostRotationOrder],
    offeredHostNationIds: [...(state.offeredHostNationIds ?? [])],
    declinedHostNationIds: [...(state.declinedHostNationIds ?? [])],
    ...(state.excludedNationIds !== undefined
      ? { excludedNationIds: [...state.excludedNationIds] }
      : {}),
    participants: state.participants.map(cloneParticipant),
    sportResults: (state.sportResults ?? []).map(cloneSportResult),
    medalTable: (state.medalTable ?? []).map((standing) => ({ ...standing })),
    completedGames: (state.completedGames ?? []).map(cloneCompletedGamesRecord),
    introducedAdditionalSportIds: [...(state.introducedAdditionalSportIds ?? [])],
    frozenSportIds: state.frozenSportIds ? [...state.frozenSportIds] : undefined,
    sportIntroductionRecords: (state.sportIntroductionRecords ?? []).map((record) => ({ ...record })),
    processedSportIntroductionEras: [...(state.processedSportIntroductionEras ?? [])],
    pendingSportAuction: state.pendingSportAuction ? cloneAuction(state.pendingSportAuction) : undefined,
  };
}

export function buildHistoricalMedalStandings(
  completedGames: readonly CompletedGamesOfNationsRecord[],
): GamesOfNationsHistoricalStanding[] {
  const aggregate = new Map<string, GamesOfNationsHistoricalStanding>();
  for (const games of completedGames) {
    for (const standing of games.medalTable) {
      const current = aggregate.get(standing.nationId) ?? {
        nationId: standing.nationId,
        nationName: standing.nationName,
        gold: 0,
        silver: 0,
        bronze: 0,
        totalMedals: 0,
        points: 0,
      };
      current.gold += standing.gold;
      current.silver += standing.silver;
      current.bronze += standing.bronze;
      current.totalMedals = current.gold + current.silver + current.bronze;
      current.points = current.gold * GAMES_MEDAL_POINTS.gold
        + current.silver * GAMES_MEDAL_POINTS.silver
        + current.bronze * GAMES_MEDAL_POINTS.bronze;
      aggregate.set(standing.nationId, current);
    }
  }
  return [...aggregate.values()].sort((a, b) =>
    b.points - a.points
      || b.gold - a.gold
      || b.silver - a.silver
      || a.nationName.localeCompare(b.nationName),
  );
}

function normalizeCompletedGames(value: CompletedGamesOfNationsRecord[] | undefined): CompletedGamesOfNationsRecord[] {
  if (!Array.isArray(value)) return [];
  const byNumber = new Map<number, CompletedGamesOfNationsRecord>();
  for (const candidate of value) {
    if (!candidate || !Number.isFinite(candidate.gamesNumber) || !Array.isArray(candidate.medalTable)) continue;
    const gamesNumber = Math.max(1, Math.floor(candidate.gamesNumber));
    if (byNumber.has(gamesNumber)) continue;
    byNumber.set(gamesNumber, {
      status: candidate.status === 'cancelled' ? 'cancelled' : 'completed',
      ...(candidate.status === 'cancelled' && typeof candidate.cancellationReason === 'string'
        ? { cancellationReason: candidate.cancellationReason }
        : {}),
      gamesNumber,
      tournamentStartTurn: Math.max(0, Math.floor(candidate.tournamentStartTurn || 0)),
      completionTurn: Math.max(0, Math.floor(candidate.completionTurn || 0)),
      worldYear: Number.isFinite(candidate.worldYear) ? Math.floor(candidate.worldYear) : 0,
      yearLabel: typeof candidate.yearLabel === 'string' ? candidate.yearLabel : 'Unknown year',
      hostNationId: stringOrUndefined(candidate.hostNationId),
      hostNationName: typeof candidate.hostNationName === 'string' ? candidate.hostNationName : candidate.hostNationId ?? 'Unknown host',
      hostCityId: stringOrUndefined(candidate.hostCityId),
      hostCityName: typeof candidate.hostCityName === 'string' ? candidate.hostCityName : candidate.hostCityId ?? 'Unknown city',
      ...(candidate.usedExistingGrandStadium === true ? { usedExistingGrandStadium: true } : {}),
      overallWinnerNationId: stringOrUndefined(candidate.overallWinnerNationId),
      overallWinnerNationName: stringOrUndefined(candidate.overallWinnerNationName),
      ...(Number.isFinite(candidate.hostBonusGamesPoints)
        ? { hostBonusGamesPoints: whole(candidate.hostBonusGamesPoints!) }
        : {}),
      ...(isGamesSport(candidate.hostBonusSport) ? { hostBonusSport: candidate.hostBonusSport } : {}),
      sportIds: Array.isArray(candidate.sportIds)
        ? uniqueSportIds(candidate.sportIds, GAMES_OF_NATIONS_SPORT_DEFINITIONS.map((sport) => sport.id))
        : [...TRADITIONAL_GAMES_SPORT_IDS],
      medalTable: candidate.medalTable
        .filter((standing) => standing && typeof standing.nationId === 'string')
        .map((standing) => ({
          nationId: standing.nationId,
          nationName: typeof standing.nationName === 'string' ? standing.nationName : standing.nationId,
          gold: whole(standing.gold),
          silver: whole(standing.silver),
          bronze: whole(standing.bronze),
        })),
    });
  }
  return [...byNumber.values()].sort((a, b) => a.gamesNumber - b.gamesNumber);
}

function cloneCompletedGamesRecord(record: CompletedGamesOfNationsRecord): CompletedGamesOfNationsRecord {
  return { ...record, sportIds: record.sportIds ? [...record.sportIds] : undefined, medalTable: record.medalTable.map((standing) => ({ ...standing })) };
}

function createSportResults(sports: readonly GamesOfNationsSport[] = GAMES_OF_NATIONS_SPORTS): GamesOfNationsSportResult[] {
  return sports.map((sport) => ({ sport, resolved: false }));
}

function normalizeSportResults(value: GamesOfNationsSportResult[] | undefined, sports: readonly GamesOfNationsSport[]): GamesOfNationsSportResult[] {
  const saved = Array.isArray(value) ? value : [];
  return sports.map((sport) => {
    const candidate = saved.find((result) => result?.sport === sport);
    if (!candidate?.resolved) return { sport, resolved: false };
    return {
      sport,
      resolved: true,
      competitionTurn: Number.isFinite(candidate.competitionTurn)
        ? Math.max(1, Math.min(sports.length, Math.floor(candidate.competitionTurn!)))
        : sports.indexOf(sport) + 1,
      ...(stringOrUndefined(candidate.goldNationId) ? { goldNationId: candidate.goldNationId } : {}),
      ...(stringOrUndefined(candidate.silverNationId) ? { silverNationId: candidate.silverNationId } : {}),
      ...(stringOrUndefined(candidate.bronzeNationId) ? { bronzeNationId: candidate.bronzeNationId } : {}),
      weights: candidate.weights && typeof candidate.weights === 'object'
        ? Object.fromEntries(Object.entries(candidate.weights).map(([nationId, weight]) => [nationId, whole(weight)]))
        : undefined,
    };
  });
}

function cloneSportResult(result: GamesOfNationsSportResult): GamesOfNationsSportResult {
  return { ...result, weights: result.weights ? { ...result.weights } : undefined };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))];
}

function newParticipant(nationId: string): GamesOfNationsParticipantState {
  return {
    nationId,
    participating: true,
    cultureCommitment: 0,
    productionCommitment: 0,
    unallocatedGamesPoints: 0,
    gamesPointsStrategyBySport: equalSportValues(0),
    gamesPointsBySport: equalSportValues(0),
    totalGamesPoints: 0,
    totalCultureInvested: 0,
    totalProductionInvested: 0,
    failedCultureCommitmentTurns: 0,
    failedProductionCommitmentTurns: 0,
    strategyInitialized: false,
  };
}

function normalizeParticipant(value: GamesOfNationsParticipantState): GamesOfNationsParticipantState {
  const partial = value as Partial<GamesOfNationsParticipantState> & { nationId: string };
  const participant = newParticipant(partial.nationId);
  participant.participating = partial.participating !== false;
  participant.cultureCommitment = whole(partial.cultureCommitment ?? 0);
  participant.productionCommitment = whole(partial.productionCommitment ?? 0);
  // Legacy percentage preferences are intentionally discarded. Already committed
  // sport GP remain exact and future GP enters the new unallocated pool.
  participant.unallocatedGamesPoints = whole(partial.unallocatedGamesPoints ?? 0);
  participant.gamesPointsStrategyBySport = normalizeSportTotals(partial.gamesPointsStrategyBySport);
  if (partial.strategyAdjustmentPending === true) participant.strategyAdjustmentPending = true;
  participant.gamesPointsBySport = normalizeSportTotals(partial.gamesPointsBySport);
  participant.totalGamesPoints = whole(partial.totalGamesPoints
    ?? participant.unallocatedGamesPoints
      + ALL_GAMES_SPORTS.reduce((sum, sport) => sum + participant.gamesPointsBySport[sport], 0));
  participant.totalCultureInvested = whole(partial.totalCultureInvested ?? 0);
  participant.totalProductionInvested = whole(partial.totalProductionInvested ?? 0);
  participant.failedCultureCommitmentTurns = whole(partial.failedCultureCommitmentTurns ?? 0);
  participant.failedProductionCommitmentTurns = whole(partial.failedProductionCommitmentTurns ?? 0);
  participant.strategyInitialized = partial.strategyInitialized === true;
  if (Number.isFinite(partial.initialCultureCommitment)) {
    participant.initialCultureCommitment = whole(partial.initialCultureCommitment!);
  }
  if (Number.isFinite(partial.initialProductionCommitment)) {
    participant.initialProductionCommitment = whole(partial.initialProductionCommitment!);
  }
  if (Number.isFinite(partial.lastInvestmentTurn)) participant.lastInvestmentTurn = Math.floor(partial.lastInvestmentTurn!);
  if (Number.isFinite(partial.cultureDiversionThisTurn)) {
    participant.cultureDiversionThisTurn = whole(partial.cultureDiversionThisTurn!);
  }
  if (Number.isFinite(partial.gamesPointsGeneratedThisTurn)) {
    participant.gamesPointsGeneratedThisTurn = whole(partial.gamesPointsGeneratedThisTurn!);
  }
  if (partial.productionDiversionByCity && typeof partial.productionDiversionByCity === 'object') {
    participant.productionDiversionByCity = Object.fromEntries(
      Object.entries(partial.productionDiversionByCity).map(([cityId, amount]) => [cityId, whole(amount)]),
    );
  }
  return participant;
}

function cloneParticipant(participant: GamesOfNationsParticipantState): GamesOfNationsParticipantState {
  return {
    ...participant,
    gamesPointsStrategyBySport: { ...participant.gamesPointsStrategyBySport },
    gamesPointsBySport: { ...participant.gamesPointsBySport },
    productionDiversionByCity: participant.productionDiversionByCity
      ? { ...participant.productionDiversionByCity }
      : undefined,
  };
}

function equalSportValues(value: number): GamesOfNationsSportValues {
  return {
    Wrestling: value,
    Marathon: value,
    Swimming: value,
    Javelin: value,
    'Long Jump': value,
    'Horse Racing': value,
    Boxing: value,
    '100 Metres': value,
    'Pole Vault': value,
    Fencing: value,
  };
}

function normalizeSportTotals(value: GamesOfNationsSportValues | undefined): GamesOfNationsSportValues {
  const totals = equalSportValues(0);
  if (!value || typeof value !== 'object') return totals;
  for (const sport of ALL_GAMES_SPORTS) totals[sport] = whole(value[sport]);
  return totals;
}

/** Reduce the largest planned sport first until the recurring strategy fits its real GP budget. */
export function reduceGamesStrategyToBudget(
  strategy: GamesOfNationsSportValues,
  budget: number,
  sports: readonly GamesOfNationsSport[] = GAMES_OF_NATIONS_SPORTS,
): GamesOfNationsSportValues {
  const reduced = normalizeSportTotals(strategy);
  const target = whole(budget);
  let total = sports.reduce((sum, sport) => sum + reduced[sport], 0);
  while (total > target) {
    const highest = Math.max(...sports.map((sport) => reduced[sport]));
    const largest = sports.filter((sport) => reduced[sport] === highest);
    const nextHighest = Math.max(0, ...sports
      .filter((sport) => reduced[sport] < highest)
      .map((sport) => reduced[sport]));
    const deficit = total - target;
    const levelCost = (highest - nextHighest) * largest.length;
    if (levelCost > 0 && deficit >= levelCost) {
      for (const sport of largest) reduced[sport] = nextHighest;
      total -= levelCost;
      continue;
    }
    const evenReduction = Math.floor(deficit / largest.length);
    const remainder = deficit % largest.length;
    largest.forEach((sport, index) => {
      reduced[sport] -= evenReduction + (index < remainder ? 1 : 0);
    });
    total = target;
  }
  return reduced;
}

export function distributeGamesPointsByWeights(
  points: number,
  weights: GamesOfNationsSportValues,
  sports: readonly GamesOfNationsSport[] = GAMES_OF_NATIONS_SPORTS,
): GamesOfNationsSportValues {
  const totalPoints = whole(points);
  const normalizedWeights = sports.map((sport) => whole(weights[sport]));
  const totalWeight = normalizedWeights.reduce((sum, weight) => sum + weight, 0);
  const result = equalSportValues(0);
  if (totalPoints === 0 || totalWeight === 0) return result;
  let assigned = 0;
  for (let index = 0; index < sports.length; index += 1) {
    const sport = sports[index]!;
    result[sport] = Math.floor(totalPoints * normalizedWeights[index]! / totalWeight);
    assigned += result[sport];
  }
  for (let index = 0; assigned < totalPoints; index = (index + 1) % sports.length) {
    result[sports[index]!] += 1;
    assigned += 1;
  }
  return result;
}

/** Evenly distributes a pool, assigning remainder GP in canonical active-sport order. */
export function distributeGamesPointsEvenly(
  points: number,
  sports: readonly GamesOfNationsSport[] = GAMES_OF_NATIONS_SPORTS,
): GamesOfNationsSportValues {
  const totalPoints = whole(points);
  const result = equalSportValues(0);
  const each = sports.length > 0 ? Math.floor(totalPoints / sports.length) : 0;
  for (const sport of sports) result[sport] = each;
  let remainder = sports.length > 0 ? totalPoints % sports.length : 0;
  for (let index = 0; remainder > 0; index += 1, remainder -= 1) {
    result[sports[index]!] += 1;
  }
  return result;
}

export function drawSportMedals(
  weightedNations: readonly { nationId: string; weight: number }[],
  seed: string,
): Pick<GamesOfNationsSportResult, 'goldNationId' | 'silverNationId' | 'bronzeNationId'> {
  const uniqueWeights = new Map<string, number>();
  for (const entry of weightedNations) {
    const weight = whole(entry.weight);
    if (typeof entry.nationId !== 'string' || entry.nationId.length === 0 || weight <= 0) continue;
    uniqueWeights.set(entry.nationId, (uniqueWeights.get(entry.nationId) ?? 0) + weight);
  }
  const remaining = [...uniqueWeights].map(([nationId, weight]) => ({ nationId, weight }));
  const winners: string[] = [];
  for (let draw = 0; draw < 3 && remaining.length > 0; draw += 1) {
    const totalWeight = remaining.reduce((sum, entry) => sum + entry.weight, 0);
    let ticket = stableUnit(`${seed}|draw-${draw}`) * totalWeight;
    let selectedIndex = remaining.length - 1;
    for (let index = 0; index < remaining.length; index += 1) {
      ticket -= remaining[index]!.weight;
      if (ticket < 0) {
        selectedIndex = index;
        break;
      }
    }
    winners.push(remaining[selectedIndex]!.nationId);
    remaining.splice(selectedIndex, 1);
  }
  return {
    goldNationId: winners[0],
    silverNationId: winners[1],
    bronzeNationId: winners[2],
  };
}

export function buildMedalTable(
  results: readonly GamesOfNationsSportResult[],
  stableNationOrder: readonly string[],
  includedNationIds: readonly string[] = [],
): GamesOfNationsMedalStanding[] {
  const counts = new Map<string, GamesOfNationsMedalStanding>();
  for (const nationId of includedNationIds) {
    if (nationId) counts.set(nationId, { nationId, gold: 0, silver: 0, bronze: 0 });
  }
  const award = (nationId: string | undefined, medal: 'gold' | 'silver' | 'bronze'): void => {
    if (!nationId) return;
    const standing = counts.get(nationId) ?? { nationId, gold: 0, silver: 0, bronze: 0 };
    standing[medal] += 1;
    counts.set(nationId, standing);
  };
  for (const result of results) {
    if (!result.resolved) continue;
    award(result.goldNationId, 'gold');
    award(result.silverNationId, 'silver');
    award(result.bronzeNationId, 'bronze');
  }
  const stableIndex = new Map(stableNationOrder.map((nationId, index) => [nationId, index]));
  return [...counts.values()].sort((a, b) => (
    b.gold - a.gold
    || b.silver - a.silver
    || b.bronze - a.bronze
    || (stableIndex.get(a.nationId) ?? Number.MAX_SAFE_INTEGER)
      - (stableIndex.get(b.nationId) ?? Number.MAX_SAFE_INTEGER)
    || a.nationId.localeCompare(b.nationId)
  ));
}

function allocateProductionDiversion(
  sources: readonly { cityId: string; available: number }[],
  commitment: number,
): Record<string, number> {
  const result: Record<string, number> = {};
  let remaining = commitment;
  for (const source of sources) {
    if (remaining <= 0) break;
    const diverted = Math.min(source.available, remaining);
    if (diverted > 0) result[source.cityId] = (result[source.cityId] ?? 0) + diverted;
    remaining -= diverted;
  }
  return result;
}

export function buildAISportWeights(
  seed: string,
  sports: readonly GamesOfNationsSport[] = GAMES_OF_NATIONS_SPORTS,
  preferences?: GamesOfNationsLeaderPreferences,
): GamesOfNationsSportValues {
  const weights = equalSportValues(0);
  const favoredIndex = Math.floor(stableUnit(`${seed}|favored`) * sports.length);
  const favouriteNames = new Set([
    preferences?.traditionalFavourite,
    preferences?.additionalFavourite,
  ].filter((id): id is GamesOfNationsSportId => !!id).map((id) => getGamesSportById(id).name));
  sports.forEach((sport, index) => {
    weights[sport] = 10 + Math.floor(stableUnit(`${seed}|${sport}`) * 21)
      + (index === favoredIndex ? 12 : 0)
      + (favouriteNames.has(sport) ? 14 : 0);
  });
  return weights;
}

function conservativeCommitment(output: number, rate: number, minimumOutput: number): number {
  if (output < minimumOutput) return 0;
  return Math.max(1, Math.floor(output * rate));
}

function stableUnit(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x100000000;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isGamesSport(value: unknown): value is GamesOfNationsSport {
  return isGamesSportName(value);
}

function uniqueSportIds(
  values: readonly GamesOfNationsSportId[] | undefined,
  allowed: readonly GamesOfNationsSportId[],
): GamesOfNationsSportId[] {
  const allowedSet = new Set(allowed);
  return [...new Set((Array.isArray(values) ? values : []).filter((id): id is GamesOfNationsSportId =>
    isGamesSportId(id) && allowedSet.has(id),
  ))];
}

function cloneAuction(auction: GamesOfNationsSportAuction): GamesOfNationsSportAuction {
  return {
    ...auction,
    proposals: auction.proposals.map((proposal) => ({ ...proposal })),
    candidateSportIds: [...auction.candidateSportIds],
  };
}

function normalizeAuction(
  auction: GamesOfNationsSportAuction | undefined,
  introduced: readonly GamesOfNationsSportId[],
): GamesOfNationsSportAuction | undefined {
  if (!auction || auction.resolved || typeof auction.id !== 'string') return undefined;
  const introducedSet = new Set(introduced);
  const candidates = uniqueSportIds(auction.candidateSportIds, ADDITIONAL_GAMES_SPORT_IDS)
    .filter((id) => !introducedSet.has(id));
  if (candidates.length === 0) return undefined;
  return {
    ...auction,
    resolved: false,
    candidateSportIds: candidates,
    proposals: Array.isArray(auction.proposals) ? auction.proposals.filter((proposal) =>
      proposal && typeof proposal.nationId === 'string' && candidates.includes(proposal.sportId)
        && Number.isFinite(proposal.bid) && proposal.bid >= 0,
    ).map((proposal) => ({ ...proposal, bid: whole(proposal.bid) })) : [],
  };
}

export function selectAuctionWinner(
  proposals: readonly GamesOfNationsAuctionProposal[],
  stableNationOrder: readonly string[],
): GamesOfNationsAuctionProposal | undefined {
  const order = new Map(stableNationOrder.map((nationId, index) => [nationId, index]));
  return [...proposals].sort((a, b) =>
    b.bid - a.bid
      || b.preferenceStrength - a.preferenceStrength
      || (order.get(a.nationId) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.nationId) ?? Number.MAX_SAFE_INTEGER)
      || a.nationId.localeCompare(b.nationId),
  )[0];
}

function whole(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
