import {
  GAMES_MEDAL_POINTS,
  type CompletedGamesOfNationsRecord,
  type GamesOfNationsHistoricalStanding,
  type GamesOfNationsParticipantState,
  type GamesOfNationsSport,
  type GamesOfNationsSportResult,
  type GamesOfNationsSportValues,
  type GamesOfNationsMedalStanding,
  type GamesOfNationsSummary,
  type SavedGamesOfNationsState,
} from '../types/gamesOfNations';

export const GAMES_AND_RECREATION_CULTURE_ID = 'games_recreation';
export const GAMES_OF_NATIONS_INTERVAL = 25;
export const GAMES_OF_NATIONS_PREPARATION_TURNS = 10;
export const GAMES_OF_NATIONS_COMPETITION_TURNS = 5;
export const GAMES_OF_NATIONS_COOLDOWN_TURNS = 10;
export const GAMES_POINTS_PER_RESOURCE = 10;
export const HOST_GAMES_BONUS_RATE = 0.10;
export const GAMES_OF_NATIONS_SPORTS: readonly GamesOfNationsSport[] = [
  'Wrestling',
  'Marathon',
  'Swimming',
  'Javelin',
  'Long Jump',
];

export interface GamesOfNationsDependencies {
  getCurrentTurn: () => number;
  getLivingNationIds: () => readonly string[];
  getNationName: (nationId: string) => string | undefined;
  getCapitalCity: (nationId: string) => { id: string; name: string } | undefined;
  getCityName?: (cityId: string) => string | undefined;
  getWorldDateForTurn?: (turn: number) => { worldYear: number; yearLabel: string };
  isHumanNation?: (nationId: string) => boolean;
  getCultureOutput?: (nationId: string) => number;
  getProductionSources?: (nationId: string) => readonly { cityId: string; available: number }[];
  getCulturalPriority?: (nationId: string) => number;
  seed?: string;
  log?: (message: string) => void;
  onGoldMedal?: (event: GamesOfNationsGoldEvent) => void;
  onGamesCompleted?: (event: GamesOfNationsCompletedEvent) => void;
  onSportResolved?: (event: GamesOfNationsSportResolvedEvent) => void;
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
    if (!savedState || typeof savedState !== 'object' || savedState.founded !== true) {
      return new GamesOfNationsSystem(dependencies, inactiveState(currentTurn));
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
    return system;
  }

  /** Returns true only for the one culture completion that founds the institution. */
  handleCultureCompleted(nationId: string, cultureNodeId: string, turn: number): boolean {
    if (cultureNodeId !== GAMES_AND_RECREATION_CULTURE_ID || this.state.founded) return false;

    const rotationOrder = unique(this.dependencies.getLivingNationIds());
    if (!rotationOrder.includes(nationId)) rotationOrder.push(nationId);
    const hostRotationIndex = Math.max(0, rotationOrder.indexOf(nationId));
    const capital = this.dependencies.getCapitalCity(nationId);
    const firstGamesTurn = turn + GAMES_OF_NATIONS_INTERVAL;
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
      hostNationId: nationId,
      hostCityId: capital?.id,
      hostRotationOrder: rotationOrder,
      hostRotationIndex,
      participants: this.createParticipants(),
      sportResults: createSportResults(),
      medalTable: [],
      completedGames: [],
      lastProcessedTurn: turn,
    };
    this.log(`Founded by ${this.nationName(nationId)} on turn ${turn}; first Games scheduled for turn ${firstGamesTurn}`);
    return true;
  }

  /** Advance explicit phase boundaries and the active sport at round start. */
  handleRoundStart(turn: number): void {
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
      } else if (this.state.phase === 'cooldown') {
        this.beginPreparation(transitionTurn);
      } else {
        break;
      }
    }

    if (this.state.phase === 'competition' && this.state.phaseStartTurn !== undefined) {
      const sportIndex = Math.max(0, Math.min(
        GAMES_OF_NATIONS_SPORTS.length - 1,
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
    if (!entry) return false;
    if (nationId === this.state.hostNationId && !participating) return false;
    entry.participating = participating;
    return true;
  }

  acknowledgeHumanPreparationPrompt(competitionNumber: number): boolean {
    if (
      this.state.phase !== 'preparation'
      || competitionNumber !== this.state.competitionNumber
    ) return false;
    const human = this.state.participants.find((participant) => this.dependencies.isHumanNation?.(participant.nationId) === true);
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
    if (!participant || this.dependencies.isHumanNation?.(nationId) !== true) return false;
    this.captureInitialCommitment(participant);
    this.calculateHostBonusIfReady();
    if (nationId === this.state.hostNationId) {
      if (!this.state.hostBonusCalculated || !hostBonusSport || !GAMES_OF_NATIONS_SPORTS.includes(hostBonusSport)) return false;
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
    return this.state.phase === 'preparation'
      && this.state.humanPreparationPromptAcknowledgedCompetitionNumber !== this.state.competitionNumber;
  }

  setNationCultureCommitment(nationId: string, commitment: number): boolean {
    const participant = this.getParticipant(nationId);
    if (!participant || !Number.isFinite(commitment) || commitment < 0) return false;
    participant.cultureCommitment = Math.floor(commitment);
    return true;
  }

  setNationProductionCommitment(nationId: string, commitment: number): boolean {
    const participant = this.getParticipant(nationId);
    if (!participant || !Number.isFinite(commitment) || commitment < 0) return false;
    participant.productionCommitment = Math.floor(commitment);
    return true;
  }

  setNationSportAllocation(nationId: string, allocation: GamesOfNationsSportValues): boolean {
    const participant = this.getParticipant(nationId);
    if (!participant) return false;
    const normalized = normalizeAllocation(allocation);
    if (!normalized) return false;
    participant.sportAllocation = normalized;
    return true;
  }

  /** Called once for each nation's turn, after yields are refreshed and before production/culture advance. */
  processNationPreparationTurn(nationId: string, turn: number): void {
    if (this.state.phase !== 'preparation') return;
    const participant = this.getParticipant(nationId);
    if (!participant?.participating || participant.lastInvestmentTurn === turn) return;
    participant.lastInvestmentTurn = turn;
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
      const distributed = distributeGamesPoints(generatedPoints, participant.sportAllocation);
      for (const sport of GAMES_OF_NATIONS_SPORTS) {
        participant.gamesPointsBySport[sport] += distributed[sport];
      }
      participant.totalGamesPoints += generatedPoints;
    }
  }

  getCultureDiversionForTurn(nationId: string, turn: number): number {
    const participant = this.getParticipant(nationId);
    return this.state.phase === 'preparation'
      && participant?.participating === true
      && participant.lastInvestmentTurn === turn
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

  getHistoricalMedalStandings(): GamesOfNationsHistoricalStanding[] {
    return buildHistoricalMedalStandings(this.state.completedGames ?? []);
  }

  getEffectiveGamesPoints(nationId: string, sport: GamesOfNationsSport): number {
    const base = whole(this.getParticipant(nationId)?.gamesPointsBySport[sport] ?? 0);
    return base + (
      nationId === this.state.hostNationId && sport === this.state.hostBonusSport
        ? whole(this.state.hostBonusGamesPoints ?? 0)
        : 0
    );
  }

  getSummary(): GamesOfNationsSummary {
    const currentTurn = this.dependencies.getCurrentTurn();
    const phaseTotalTurns = this.state.phase === 'preparation'
      ? GAMES_OF_NATIONS_PREPARATION_TURNS
      : this.state.phase === 'competition'
        ? GAMES_OF_NATIONS_COMPETITION_TURNS
        : this.state.phase === 'cooldown'
          ? GAMES_OF_NATIONS_COOLDOWN_TURNS
          : null;
    const phaseProgressTurn = phaseTotalTurns !== null && this.state.phaseStartTurn !== undefined
      ? clamp(currentTurn - this.state.phaseStartTurn + 1, 1, phaseTotalTurns)
      : null;
    const nextGamesTurn = this.state.founded
      ? (this.state.phase === 'competition'
        ? (this.state.scheduledGamesTurn ?? currentTurn) + GAMES_OF_NATIONS_INTERVAL
        : this.state.scheduledGamesTurn ?? null)
      : null;
    return {
      founded: this.state.founded,
      founderNationId: this.state.founderNationId ?? null,
      foundedTurn: this.state.foundedTurn ?? null,
      firstGamesTurn: this.state.firstGamesTurn ?? null,
      phase: this.state.phase,
      competitionNumber: this.state.competitionNumber,
      hostNationId: this.state.hostNationId ?? null,
      hostCityId: this.state.hostCityId ?? null,
      phaseStartTurn: this.state.phaseStartTurn ?? null,
      nextTransitionTurn: this.state.nextTransitionTurn ?? null,
      turnsUntilNextPhase: this.state.nextTransitionTurn === undefined
        ? null
        : Math.max(0, this.state.nextTransitionTurn - currentTurn),
      nextGamesTurn,
      turnsUntilGames: nextGamesTurn === null ? null : Math.max(0, nextGamesTurn - currentTurn),
      activeSport: this.getActiveSport(),
      phaseProgressTurn,
      phaseTotalTurns,
      preparationActive: this.state.phase === 'preparation',
      humanPreparationPromptAcknowledgedCompetitionNumber:
        this.state.humanPreparationPromptAcknowledgedCompetitionNumber ?? null,
      sportResults: (this.state.sportResults ?? []).map(cloneSportResult),
      medalTable: (this.state.medalTable ?? []).map((standing) => ({ ...standing })),
      overallWinnerNationId: this.state.overallWinnerNationId ?? null,
      competitionComplete: (this.state.sportResults ?? []).length === GAMES_OF_NATIONS_SPORTS.length
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
        .filter((participant) => participant.participating)
        .map((participant) => participant.nationId),
      participants: this.state.participants.map(cloneParticipant),
    };
  }

  private beginFirstPreparation(turn: number): void {
    this.state.phase = 'preparation';
    this.state.phaseStartTurn = turn;
    this.state.nextTransitionTurn = this.state.firstGamesTurn;
    this.resolveScheduledHost();
    this.initializeCycleParticipants();
    this.log(`Preparation for Games #1 begins; competition starts on turn ${this.state.firstGamesTurn}`);
  }

  private beginCompetition(turn: number): void {
    this.resolveScheduledHost();
    this.pruneInvalidParticipants();
    this.state.phase = 'competition';
    this.state.phaseStartTurn = turn;
    this.state.nextTransitionTurn = turn + GAMES_OF_NATIONS_COMPETITION_TURNS;
    this.state.scheduledGamesTurn = turn;
    this.state.activeSportIndex = 0;
    const cityName = this.state.hostCityId
      ? this.dependencies.getCapitalCity(this.state.hostNationId ?? '')?.name
      : undefined;
    const location = cityName ? ` in ${cityName}` : '';
    this.log(`Games #${this.state.competitionNumber} begin${location} on turn ${turn}`);
    this.logCompetitionSport();
    this.resolveDueCompetitionSports(turn);
  }

  private beginCooldown(turn: number): void {
    this.state.phase = 'cooldown';
    this.state.phaseStartTurn = turn;
    this.state.nextTransitionTurn = turn + GAMES_OF_NATIONS_COOLDOWN_TURNS;
    this.state.scheduledGamesTurn = (this.state.scheduledGamesTurn ?? turn) + GAMES_OF_NATIONS_INTERVAL;
    delete this.state.activeSportIndex;
    this.log(`Games #${this.state.competitionNumber} completed; entering cooldown`);
  }

  private beginPreparation(turn: number): void {
    this.state.phase = 'preparation';
    this.state.phaseStartTurn = turn;
    this.state.nextTransitionTurn = turn + GAMES_OF_NATIONS_PREPARATION_TURNS;
    this.state.competitionNumber += 1;
    this.selectNextHost();
    this.initializeCycleParticipants();
    this.log(`Preparation for Games #${this.state.competitionNumber} begins; competition starts on turn ${this.state.scheduledGamesTurn}`);
  }

  private selectNextHost(): void {
    this.resolveHostFrom(this.state.hostRotationIndex + 1);
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

  private getActiveSport(): GamesOfNationsSport | null {
    if (this.state.phase !== 'competition' || this.state.activeSportIndex === undefined) return null;
    return GAMES_OF_NATIONS_SPORTS[this.state.activeSportIndex] ?? null;
  }

  private logCompetitionSport(): void {
    const sport = this.getActiveSport();
    if (sport) this.log(`Games #${this.state.competitionNumber} competition: ${sport}`);
  }

  private initializeCycleParticipants(): void {
    this.state.participants = this.createParticipants();
    this.state.sportResults = createSportResults();
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
      GAMES_OF_NATIONS_SPORTS.length - 1,
      Math.max(-1, turn - this.state.phaseStartTurn),
    );
    for (let index = 0; index <= lastDueIndex; index += 1) this.resolveSport(index, turn);
  }

  private resolveSport(sportIndex: number, resolutionTurn: number): void {
    const sport = GAMES_OF_NATIONS_SPORTS[sportIndex];
    if (!sport) return;
    const results = this.state.sportResults ?? (this.state.sportResults = createSportResults());
    const result = results[sportIndex];
    if (!result || result.resolved) return;

    const living = new Set(this.dependencies.getLivingNationIds());
    const weighted = this.state.participants
      .filter((participant) => participant.participating && living.has(participant.nationId))
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
      this.state.participants.filter((participant) => participant.participating).map((participant) => participant.nationId),
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

    if (sportIndex === GAMES_OF_NATIONS_SPORTS.length - 1) this.finalizeCompetition();
    const scheduledSportTurn = (this.state.phaseStartTurn ?? 0) + sportIndex;
    if (resolutionTurn === scheduledSportTurn) this.emitSportResolved(sportIndex, result, living);
  }

  private emitSportResolved(
    sportIndex: number,
    result: GamesOfNationsSportResult,
    living: ReadonlySet<string>,
  ): void {
    const nextSport = GAMES_OF_NATIONS_SPORTS[sportIndex + 1];
    const nextSportCandidates = nextSport
      ? this.state.participants
        .filter((participant) => participant.participating && living.has(participant.nationId))
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
      turn: (this.state.phaseStartTurn ?? 0) + GAMES_OF_NATIONS_SPORTS.length - 1,
    });
  }

  private archiveCompletedGames(overallWinnerNationId: string | undefined): void {
    const completedGames = this.state.completedGames ?? (this.state.completedGames = []);
    if (completedGames.some((record) => record.gamesNumber === this.state.competitionNumber)) return;
    const tournamentStartTurn = this.state.phaseStartTurn ?? this.dependencies.getCurrentTurn();
    const completionTurn = tournamentStartTurn + GAMES_OF_NATIONS_SPORTS.length - 1;
    const date = this.dependencies.getWorldDateForTurn?.(tournamentStartTurn)
      ?? { worldYear: 0, yearLabel: `Turn ${tournamentStartTurn}` };
    const hostNationId = this.state.hostNationId;
    const hostCityId = this.state.hostCityId;
    const historicalHostCityName = hostCityId
      ? this.dependencies.getCityName?.(hostCityId) ?? 'Unknown city'
      : 'Unknown city';
    completedGames.push({
      gamesNumber: this.state.competitionNumber,
      tournamentStartTurn,
      completionTurn,
      worldYear: date.worldYear,
      yearLabel: date.yearLabel,
      hostNationId,
      hostNationName: hostNationId ? this.nationName(hostNationId) : 'Unknown host',
      hostCityId,
      hostCityName: historicalHostCityName,
      overallWinnerNationId,
      overallWinnerNationName: overallWinnerNationId ? this.nationName(overallWinnerNationId) : undefined,
      hostBonusGamesPoints: whole(this.state.hostBonusGamesPoints ?? 0),
      ...(this.state.hostBonusSport ? { hostBonusSport: this.state.hostBonusSport } : {}),
      medalTable: (this.state.medalTable ?? []).map((standing) => ({
        ...standing,
        nationName: this.nationName(standing.nationId),
      })),
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
      if (this.dependencies.isHumanNation?.(participant.nationId) === true) continue;
      this.initializeAIStrategy(participant);
    }
  }

  private initializeHostBonusForPreparation(): void {
    if (this.state.phase !== 'preparation' || this.state.hostBonusCalculated) return;
    for (const participant of this.state.participants) {
      if (this.dependencies.isHumanNation?.(participant.nationId) === true) continue;
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
    if (this.dependencies.isHumanNation?.(this.state.hostNationId) === true) return;
    const host = this.getParticipant(this.state.hostNationId);
    if (!host) return;
    this.state.hostBonusSport = GAMES_OF_NATIONS_SPORTS.reduce((best, sport) =>
      host.sportAllocation[sport] > host.sportAllocation[best] ? sport : best,
    GAMES_OF_NATIONS_SPORTS[0]);
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
    participant.sportAllocation = buildAIAllocation(
      `${this.dependencies.seed ?? 'games'}|${this.state.competitionNumber}|${nationId}|sports`,
    );
    participant.strategyInitialized = true;
    this.log(`${this.nationName(nationId)} strategy: Culture ${participant.cultureCommitment}/turn, Production ${participant.productionCommitment}/turn`);
    this.log(`${this.nationName(nationId)} allocation: ${GAMES_OF_NATIONS_SPORTS.map((sport) => `${sport} ${participant.sportAllocation[sport]}%`).join(', ')}`);
  }

  private getParticipant(nationId: string): GamesOfNationsParticipantState | undefined {
    return this.state.participants.find((participant) => participant.nationId === nationId);
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
    this.state.phaseStartTurn = cooldownStartTurn - GAMES_OF_NATIONS_SPORTS.length;
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
    const human = this.state.participants.find((participant) => this.dependencies.isHumanNation?.(participant.nationId) === true);
    if (!human) return;
    if (human.nationId === this.state.hostNationId) {
      delete this.state.humanPreparationPromptAcknowledgedCompetitionNumber;
      return;
    }
    this.captureInitialCommitment(human);
    this.calculateHostBonusIfReady();
    this.assignAIHostBonusSportIfReady();
  }

  private nationName(nationId: string): string {
    return this.dependencies.getNationName(nationId) ?? nationId;
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
  if (!state.founded) return inactiveState(Number.isFinite(state.lastProcessedTurn) ? state.lastProcessedTurn : 0);
  const phase = ['waitingForFirstGames', 'preparation', 'competition', 'cooldown'].includes(state.phase)
    ? state.phase
    : 'waitingForFirstGames';
  const sportResults = normalizeSportResults(state.sportResults);
  const hostRotationOrder = unique(Array.isArray(state.hostRotationOrder) ? state.hostRotationOrder : []);
  const participants = Array.isArray(state.participants)
    ? state.participants
      .filter((participant) => participant && typeof participant.nationId === 'string')
      .map((participant) => normalizeParticipant(participant))
    : [];
  const savedHostParticipant = participants.find((participant) => participant.nationId === state.hostNationId);
  if (savedHostParticipant) savedHostParticipant.participating = true;
  const hasResolvedSport = sportResults.some((result) => result.resolved);
  const medalTable = hasResolvedSport || state.phase === 'competition' || state.phase === 'cooldown'
    ? buildMedalTable(
      sportResults,
      hostRotationOrder,
      participants.filter((participant) => participant.participating).map((participant) => participant.nationId),
    )
    : [];
  const hasMedals = medalTable.some((standing) => standing.gold + standing.silver + standing.bronze > 0);
  const completedGames = normalizeCompletedGames(state.completedGames);
  return {
    ...state,
    phase,
    competitionNumber: Math.max(1, Math.floor(state.competitionNumber || 1)),
    hostRotationOrder,
    hostRotationIndex: Number.isFinite(state.hostRotationIndex) ? Math.floor(state.hostRotationIndex) : -1,
    participants,
    sportResults,
    medalTable,
    completedGames,
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
    participants: state.participants.map(cloneParticipant),
    sportResults: (state.sportResults ?? []).map(cloneSportResult),
    medalTable: (state.medalTable ?? []).map((standing) => ({ ...standing })),
    completedGames: (state.completedGames ?? []).map(cloneCompletedGamesRecord),
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
      gamesNumber,
      tournamentStartTurn: Math.max(0, Math.floor(candidate.tournamentStartTurn || 0)),
      completionTurn: Math.max(0, Math.floor(candidate.completionTurn || 0)),
      worldYear: Number.isFinite(candidate.worldYear) ? Math.floor(candidate.worldYear) : 0,
      yearLabel: typeof candidate.yearLabel === 'string' ? candidate.yearLabel : 'Unknown year',
      hostNationId: stringOrUndefined(candidate.hostNationId),
      hostNationName: typeof candidate.hostNationName === 'string' ? candidate.hostNationName : candidate.hostNationId ?? 'Unknown host',
      hostCityId: stringOrUndefined(candidate.hostCityId),
      hostCityName: typeof candidate.hostCityName === 'string' ? candidate.hostCityName : candidate.hostCityId ?? 'Unknown city',
      overallWinnerNationId: stringOrUndefined(candidate.overallWinnerNationId),
      overallWinnerNationName: stringOrUndefined(candidate.overallWinnerNationName),
      ...(Number.isFinite(candidate.hostBonusGamesPoints)
        ? { hostBonusGamesPoints: whole(candidate.hostBonusGamesPoints!) }
        : {}),
      ...(isGamesSport(candidate.hostBonusSport) ? { hostBonusSport: candidate.hostBonusSport } : {}),
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
  return { ...record, medalTable: record.medalTable.map((standing) => ({ ...standing })) };
}

function createSportResults(): GamesOfNationsSportResult[] {
  return GAMES_OF_NATIONS_SPORTS.map((sport) => ({ sport, resolved: false }));
}

function normalizeSportResults(value: GamesOfNationsSportResult[] | undefined): GamesOfNationsSportResult[] {
  const saved = Array.isArray(value) ? value : [];
  return GAMES_OF_NATIONS_SPORTS.map((sport) => {
    const candidate = saved.find((result) => result?.sport === sport);
    if (!candidate?.resolved) return { sport, resolved: false };
    return {
      sport,
      resolved: true,
      competitionTurn: Number.isFinite(candidate.competitionTurn)
        ? Math.max(1, Math.min(5, Math.floor(candidate.competitionTurn!)))
        : GAMES_OF_NATIONS_SPORTS.indexOf(sport) + 1,
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
    sportAllocation: equalSportValues(20),
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
  participant.sportAllocation = normalizeAllocation(partial.sportAllocation ?? equalSportValues(20))
    ?? equalSportValues(20);
  participant.gamesPointsBySport = normalizeSportTotals(partial.gamesPointsBySport);
  participant.totalGamesPoints = whole(partial.totalGamesPoints
    ?? GAMES_OF_NATIONS_SPORTS.reduce((sum, sport) => sum + participant.gamesPointsBySport[sport], 0));
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
    sportAllocation: { ...participant.sportAllocation },
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
  };
}

function normalizeSportTotals(value: GamesOfNationsSportValues | undefined): GamesOfNationsSportValues {
  const totals = equalSportValues(0);
  if (!value || typeof value !== 'object') return totals;
  for (const sport of GAMES_OF_NATIONS_SPORTS) totals[sport] = whole(value[sport]);
  return totals;
}

function normalizeAllocation(value: GamesOfNationsSportValues): GamesOfNationsSportValues | null {
  if (!value || typeof value !== 'object') return null;
  const weights = GAMES_OF_NATIONS_SPORTS.map((sport) => Number(value[sport]));
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0)) return null;
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return null;
  const normalized = equalSportValues(0);
  let assigned = 0;
  for (let index = 0; index < GAMES_OF_NATIONS_SPORTS.length; index += 1) {
    const sport = GAMES_OF_NATIONS_SPORTS[index]!;
    normalized[sport] = Math.floor((weights[index]! / total) * 100);
    assigned += normalized[sport];
  }
  for (let index = 0; assigned < 100; index = (index + 1) % GAMES_OF_NATIONS_SPORTS.length) {
    normalized[GAMES_OF_NATIONS_SPORTS[index]!] += 1;
    assigned += 1;
  }
  return normalized;
}

export function distributeGamesPoints(
  points: number,
  allocation: GamesOfNationsSportValues,
): GamesOfNationsSportValues {
  const totalPoints = whole(points);
  const normalized = normalizeAllocation(allocation) ?? equalSportValues(20);
  const result = equalSportValues(0);
  let assigned = 0;
  for (const sport of GAMES_OF_NATIONS_SPORTS) {
    result[sport] = Math.floor(totalPoints * normalized[sport] / 100);
    assigned += result[sport];
  }
  for (let index = 0; assigned < totalPoints; index = (index + 1) % GAMES_OF_NATIONS_SPORTS.length) {
    result[GAMES_OF_NATIONS_SPORTS[index]!] += 1;
    assigned += 1;
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

function buildAIAllocation(seed: string): GamesOfNationsSportValues {
  const weights = equalSportValues(0);
  const favoredIndex = Math.floor(stableUnit(`${seed}|favored`) * GAMES_OF_NATIONS_SPORTS.length);
  GAMES_OF_NATIONS_SPORTS.forEach((sport, index) => {
    weights[sport] = 10 + Math.floor(stableUnit(`${seed}|${sport}`) * 21) + (index === favoredIndex ? 24 : 0);
  });
  return normalizeAllocation(weights)!;
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
  return typeof value === 'string' && GAMES_OF_NATIONS_SPORTS.includes(value as GamesOfNationsSport);
}

function whole(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
