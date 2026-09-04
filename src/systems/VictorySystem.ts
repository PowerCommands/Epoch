import type { CityManager } from './CityManager';
import type { DiplomacyManager } from './DiplomacyManager';
import type { CorporationSystem } from './CorporationSystem';
import type { CurrencyStrength, CurrencySystem } from './CurrencySystem';
import type { NationManager } from './NationManager';
import type { ResearchSystem } from './ResearchSystem';
import type { ResourceAccessSystem } from './ResourceAccessSystem';
import type { TurnManager } from './TurnManager';
import type { WonderSystem } from './WonderSystem';
import type { CompletedGamesOfNationsRecord } from '../types/gamesOfNations';
import type { DiplomaticScoreBreakdown, WorldCouncilSystem } from './WorldCouncilSystem';
import { WORLD_COUNCIL_DIPLOMACY_SCORE_THRESHOLD } from '../types/worldCouncil';
import {
  CULTURAL_VICTORY_REQUIRED_CULTURE,
  CULTURAL_VICTORY_REQUIRED_WONDERS,
  OVERWHELMING_CULTURE_VICTORY_THRESHOLD,
  getOwnedWonderCount,
} from './CulturalVictory';
import {
  AEROSPACE_INDUSTRIES_ID,
  AEROSPACE_PARTS_ID,
  DEFAULT_REQUIRED_AEROSPACE_PARTS,
  SCIENCE_VICTORY_TECH_ID,
} from '../data/scienceVictory';
import {
  buildDominationRanking,
  getDominationProgress,
  resolveDominationLandPercent,
  resolveDominationRequiredVassals,
  type DominationProgress,
  type DominationRankingEntry,
  type DominationVictoryConfig,
  type LandControlLookup,
} from './DominationRanking';
import type { MapData } from '../types/map';

export type VictoryType = 'domination' | 'science' | 'cultural' | 'diplomatic';

type VictoryListener = (nationId: string, type: VictoryType) => void;
type VictoryLogger = (nationId: string, message: string) => void;

interface ScienceVictorySettings {
  enabled: boolean;
  requiredAerospaceParts: number;
}

interface ToggleableVictorySettings {
  enabled?: boolean;
}

interface VictoryConditionsConfig {
  domination?: Partial<DominationVictoryConfig> & ToggleableVictorySettings;
  science?: Partial<ScienceVictorySettings>;
  cultural?: ToggleableVictorySettings;
  diplomatic?: ToggleableVictorySettings;
}

export interface GamesOfNationsChampionSource {
  getLatestCompletedGames(): Pick<CompletedGamesOfNationsRecord, 'gamesNumber' | 'overallWinnerNationId'> | undefined;
}

/** Which victory types are currently active. Persisted in the save state. */
export interface EnabledVictoryConditions {
  domination: boolean;
  science: boolean;
  cultural: boolean;
  diplomatic: boolean;
}

/** Structured outcome once a nation has won. Exposed for diagnostics/autorun. */
export interface VictoryState {
  nationId: string;
  type: VictoryType;
  round: number;
}

export interface ScienceVictoryProgress {
  nationId: string;
  aerospaceParts: number;
  requiredAerospaceParts: number;
  hasRocketry: boolean;
  hasAluminum: boolean;
  hasFactory: boolean;
  hasAerospaceIndustries: boolean;
  fulfilledMilestones: number;
  scienceScore: number;
  researchPerTurn: number;
  researchedTechnologyCount: number;
}

export interface CulturalVictoryProgress {
  nationId: string;
  accumulatedCulture: number;
  requiredCulture: number;
  ownedWonders: number;
  requiredWonders: number;
  currencyStatus: CurrencyStrength | null;
  normalRequirementsMet: boolean;
  overwhelmingCultureThreshold: number;
  overwhelmingCultureThresholdMet: boolean;
  latestCompletedGamesNumber: number | null;
  reigningGamesChampionNationId: string | null;
  isReigningGamesChampion: boolean;
  victoryRoute: 'normal' | 'overwhelming' | null;
  victoryEligible: boolean;
}

export interface DiplomaticVictoryProgress {
  nationId: string;
  diplomacyScore: number;
  requiredDiplomacyScore: number;
  scoreBreakdown: DiplomaticScoreBreakdown;
}

const SCIENCE_PROGRESS_INTERVAL = 25;
const CULTURAL_PROGRESS_INTERVAL = 25;
const DIPLOMATIC_PROGRESS_INTERVAL = 25;
const DOMINATION_PROGRESS_INTERVAL = 25;
export const DIPLOMATIC_VICTORY_SCORE_THRESHOLD = WORLD_COUNCIL_DIPLOMACY_SCORE_THRESHOLD;

/**
 * VictorySystem checks for win conditions after each turn end.
 * Domination: a nation satisfies EITHER the scenario's vassal-count route or its
 * land-control-percentage route (see DominationRanking).
 * Science: one nation produces enough aerospace_parts.
 * Cultural: one nation either meets the normal multi-part requirements or
 * reaches the overwhelming absolute Culture threshold.
 * Diplomatic: one nation reaches the Diplomatic Score threshold.
 */
export class VictorySystem {
  private readonly listeners: VictoryListener[] = [];
  private won = false;
  private victoryState: VictoryState | null = null;
  private readonly science: ScienceVictorySettings;
  private readonly domination: { enabled: boolean } & DominationVictoryConfig;
  private readonly culturalEnabled: boolean;
  private readonly diplomaticEnabled: boolean;
  private lastProgressRound = -SCIENCE_PROGRESS_INTERVAL;
  private lastCulturalProgressRound = -CULTURAL_PROGRESS_INTERVAL;
  private lastDiplomaticProgressRound = -DIPLOMATIC_PROGRESS_INTERVAL;
  private lastDominationProgressRound = -DOMINATION_PROGRESS_INTERVAL;

  constructor(
    private readonly cityManager: CityManager,
    private readonly nationManager: NationManager,
    private readonly turnManager: TurnManager,
    private readonly resourceAccessSystem?: ResourceAccessSystem,
    conditions: VictoryConditionsConfig = {},
    private readonly log?: VictoryLogger,
    private readonly researchSystem?: ResearchSystem,
    private readonly corporationSystem?: CorporationSystem,
    private readonly wonderSystem?: WonderSystem,
    private readonly worldCouncilSystem?: WorldCouncilSystem,
    private readonly currencySystem?: CurrencySystem,
    private readonly gamesOfNationsSystem?: GamesOfNationsChampionSource,
    private readonly diplomacyManager?: Pick<DiplomacyManager, 'getVassalHost'>,
    private readonly mapData?: MapData,
  ) {
    this.science = {
      enabled: conditions.science?.enabled ?? true,
      requiredAerospaceParts: conditions.science?.requiredAerospaceParts ?? DEFAULT_REQUIRED_AEROSPACE_PARTS,
    };
    this.domination = {
      enabled: conditions.domination?.enabled ?? true,
      requiredVassals: resolveDominationRequiredVassals(conditions.domination?.requiredVassals),
      requiredLandPercent: resolveDominationLandPercent(conditions.domination?.requiredLandPercent),
    };
    this.culturalEnabled = conditions.cultural?.enabled ?? true;
    this.diplomaticEnabled = conditions.diplomatic?.enabled ?? true;

    turnManager.on('turnEnd', (e) => {
      if (this.won) return;

      const scienceWinner = this.science.enabled ? this.checkScienceVictory() : null;
      if (scienceWinner) {
        this.recordVictory(scienceWinner, 'science', e.round);
        this.logScienceVictory(scienceWinner, e.round);
        this.logVictory(scienceWinner, 'science', e.round);
        for (const cb of this.listeners) cb(scienceWinner, 'science');
        return;
      }

      const culturalWinner = this.culturalEnabled ? this.checkCulturalVictory() : null;
      if (culturalWinner) {
        this.recordVictory(culturalWinner, 'cultural', e.round);
        this.logCulturalVictory(culturalWinner, e.round);
        this.logVictory(culturalWinner, 'cultural', e.round);
        for (const cb of this.listeners) cb(culturalWinner, 'cultural');
        return;
      }

      const diplomaticWinner = this.diplomaticEnabled ? this.checkDiplomaticVictory() : null;
      if (diplomaticWinner) {
        this.recordVictory(diplomaticWinner, 'diplomatic', e.round);
        this.logDiplomaticVictory(diplomaticWinner, e.round);
        this.logVictory(diplomaticWinner, 'diplomatic', e.round);
        for (const cb of this.listeners) cb(diplomaticWinner, 'diplomatic');
        return;
      }

      this.resolveDominationVictoryNow(e.round);
    });

    turnManager.on('roundEnd', (e) => {
      if (this.won || !this.science.enabled || !this.resourceAccessSystem) return;
      if (e.round - this.lastProgressRound < SCIENCE_PROGRESS_INTERVAL) return;
      this.lastProgressRound = e.round;
      this.logScienceProgress(e.round);
    });

    turnManager.on('roundEnd', (e) => {
      if (this.won || !this.culturalEnabled || !this.wonderSystem) return;
      if (e.round - this.lastCulturalProgressRound < CULTURAL_PROGRESS_INTERVAL) return;
      this.lastCulturalProgressRound = e.round;
      this.logCulturalProgress(e.round);
    });

    turnManager.on('roundEnd', (e) => {
      if (this.won || !this.diplomaticEnabled || !this.worldCouncilSystem) return;
      if (e.round - this.lastDiplomaticProgressRound < DIPLOMATIC_PROGRESS_INTERVAL) return;
      this.lastDiplomaticProgressRound = e.round;
      this.logDiplomaticProgress(e.round);
    });

    turnManager.on('roundEnd', (e) => {
      if (this.won || !this.domination.enabled || !this.diplomacyManager) return;
      if (e.round - this.lastDominationProgressRound < DOMINATION_PROGRESS_INTERVAL) return;
      this.lastDominationProgressRound = e.round;
      this.logDominationProgress(e.round);
    });
  }

  /** Public entry point kept for external callers. Checks domination only. */
  checkVictory(): string | null {
    return this.checkDominationVictory();
  }

  /**
   * Resolve Domination immediately after a completed geopolitical transition.
   * Step 3 calls this only after every inherited-vassal decision and capital
   * restoration has completed, so no intermediate succession state can win.
   */
  resolveDominationVictoryNow(round = this.turnManager.getCurrentRound()): string | null {
    if (this.won || !this.domination.enabled) return null;
    const winner = this.checkDominationVictory();
    if (!winner) return null;
    this.recordVictory(winner, 'domination', round);
    this.logDominationVictory(winner, round);
    this.logVictory(winner, 'domination', round);
    for (const cb of this.listeners) cb(winner, 'domination');
    return winner;
  }

  /** Which victory types are active. Persisted so saves restore the same rules. */
  getEnabledConditions(): EnabledVictoryConditions {
    return {
      domination: this.domination.enabled,
      science: this.science.enabled,
      cultural: this.culturalEnabled,
      diplomatic: this.diplomaticEnabled,
    };
  }

  getScienceVictorySettings(): Readonly<ScienceVictorySettings> {
    return { ...this.science };
  }

  /** Scenario-configured Domination thresholds. Persisted so saves restore them. */
  getDominationVictorySettings(): Readonly<DominationVictoryConfig> {
    return {
      requiredVassals: this.domination.requiredVassals,
      requiredLandPercent: this.domination.requiredLandPercent,
    };
  }

  /** Updates thresholds consumed by subsequent normal Domination checks. */
  setDominationVictorySettings(settings: Partial<DominationVictoryConfig>): void {
    if (settings.requiredVassals !== undefined) {
      this.domination.requiredVassals = resolveDominationRequiredVassals(settings.requiredVassals);
    }
    if (settings.requiredLandPercent !== undefined) {
      this.domination.requiredLandPercent = resolveDominationLandPercent(settings.requiredLandPercent);
    }
  }

  /** Structured outcome once a nation has won, else null. */
  getVictoryState(): VictoryState | null {
    return this.victoryState ? { ...this.victoryState } : null;
  }

  private recordVictory(nationId: string, type: VictoryType, round: number): void {
    this.won = true;
    this.victoryState = { nationId, type, round };
  }

  /**
   * Stable, machine-detectable victory line emitted for every victory type.
   * Autorun greps for the "VICTORY:" prefix, so keep the phrasing stable.
   */
  private logVictory(nationId: string, type: VictoryType, round: number): void {
    if (!this.log) return;
    const name = this.nationManager.getNation(nationId)?.name ?? nationId;
    const dateLabel = this.turnManager.getGameDateLabel();
    const dominationDetail = type === 'domination'
      ? ` ${this.describeDominationRoute(nationId)}`
      : '';
    this.log(
      nationId,
      `VICTORY: ${name} won by ${type} victory on round ${round} (${dateLabel}).${dominationDetail}`,
    );
  }

  getScienceVictoryProgress(nationId: string): ScienceVictoryProgress {
    const aerospaceParts = this.resourceAccessSystem?.getManufacturedResourceSourceCount(
      nationId,
      AEROSPACE_PARTS_ID,
    ) ?? 0;

    const hasRocketry = this.researchSystem?.isResearched(nationId, SCIENCE_VICTORY_TECH_ID) ?? false;
    const hasAluminum = this.resourceAccessSystem?.hasResource(nationId, 'aluminum') ?? false;
    const hasFactory = this.cityManager.getCitiesByOwner(nationId).some(
      (city) => this.cityManager.getBuildings(city.id).hasActive('factory'),
    );
    const hasAerospaceIndustries = this.corporationSystem
      ?.isFounded(AEROSPACE_INDUSTRIES_ID) ?? false;

    const fulfilledMilestones = [hasRocketry, hasAluminum, hasFactory, hasAerospaceIndustries]
      .filter(Boolean).length;

    const researchedTechnologyCount = this.researchSystem
      ?.getResearchedTechnologies(nationId).length ?? 0;
    const researchPerTurn = this.researchSystem?.getResearchPerTurn(nationId) ?? 0;

    const researchProgress = this.researchSystem?.getResearchProgress(nationId) ?? 0;
    const currentTech = this.researchSystem?.getCurrentResearch(nationId);
    const techCost = currentTech
      ? Math.max(1, this.researchSystem!.getEffectiveCost(currentTech.id))
      : 1;
    const scienceScore = researchedTechnologyCount * 100
      + (currentTech ? Math.round((researchProgress / techCost) * 100) : 0);

    return {
      nationId,
      aerospaceParts,
      requiredAerospaceParts: this.science.requiredAerospaceParts,
      hasRocketry,
      hasAluminum,
      hasFactory,
      hasAerospaceIndustries,
      fulfilledMilestones,
      scienceScore,
      researchPerTurn,
      researchedTechnologyCount,
    };
  }

  getScienceVictoryRanking(): ScienceVictoryProgress[] {
    return this.nationManager.getAllNations()
      .map((n) => this.getScienceVictoryProgress(n.id))
      .sort((a, b) => {
        if (b.aerospaceParts !== a.aerospaceParts) return b.aerospaceParts - a.aerospaceParts;
        if (b.fulfilledMilestones !== a.fulfilledMilestones) return b.fulfilledMilestones - a.fulfilledMilestones;
        if (b.scienceScore !== a.scienceScore) return b.scienceScore - a.scienceScore;
        if (b.researchPerTurn !== a.researchPerTurn) return b.researchPerTurn - a.researchPerTurn;
        return b.researchedTechnologyCount - a.researchedTechnologyCount;
      });
  }

  getCulturalVictoryProgress(nationId: string): CulturalVictoryProgress {
    const accumulatedCulture = this.nationManager.getResources(nationId)?.culture ?? 0;
    const ownedWonders = this.wonderSystem
      ? getOwnedWonderCount(nationId, this.wonderSystem, this.cityManager)
      : 0;
    const currencyStatus = this.currencySystem?.getCurrencyState(nationId)?.strength ?? null;
    const normalRequirementsMet = accumulatedCulture >= CULTURAL_VICTORY_REQUIRED_CULTURE
      && ownedWonders >= CULTURAL_VICTORY_REQUIRED_WONDERS
      && currencyStatus === 'Dominant';
    const latestGames = this.gamesOfNationsSystem?.getLatestCompletedGames();
    const reigningGamesChampionNationId = latestGames?.overallWinnerNationId ?? null;
    const isReigningGamesChampion = reigningGamesChampionNationId === nationId;
    const normalVictoryEligible = normalRequirementsMet && isReigningGamesChampion;
    const overwhelmingCultureThresholdMet = accumulatedCulture
      >= OVERWHELMING_CULTURE_VICTORY_THRESHOLD;
    const victoryRoute = normalVictoryEligible
      ? 'normal' as const
      : overwhelmingCultureThresholdMet
        ? 'overwhelming' as const
        : null;
    return {
      nationId,
      accumulatedCulture,
      requiredCulture: CULTURAL_VICTORY_REQUIRED_CULTURE,
      ownedWonders,
      requiredWonders: CULTURAL_VICTORY_REQUIRED_WONDERS,
      currencyStatus,
      normalRequirementsMet,
      overwhelmingCultureThreshold: OVERWHELMING_CULTURE_VICTORY_THRESHOLD,
      overwhelmingCultureThresholdMet,
      latestCompletedGamesNumber: latestGames?.gamesNumber ?? null,
      reigningGamesChampionNationId,
      isReigningGamesChampion,
      victoryRoute,
      victoryEligible: victoryRoute !== null,
    };
  }

  /** Diagnostic ordering only; the normal route remains a strict conjunction. */
  getCulturalVictoryRanking(): CulturalVictoryProgress[] {
    return this.nationManager.getAllNations()
      .map((n) => this.getCulturalVictoryProgress(n.id))
      .sort((a, b) => b.accumulatedCulture - a.accumulatedCulture
        || b.ownedWonders - a.ownedWonders
        || Number(b.currencyStatus === 'Dominant') - Number(a.currencyStatus === 'Dominant')
        || a.nationId.localeCompare(b.nationId));
  }

  getDiplomaticVictoryProgress(nationId: string): DiplomaticVictoryProgress {
    const scoreBreakdown = this.getDiplomaticScoreBreakdown(nationId);
    return {
      nationId,
      diplomacyScore: scoreBreakdown.total,
      requiredDiplomacyScore: DIPLOMATIC_VICTORY_SCORE_THRESHOLD,
      scoreBreakdown,
    };
  }

  getDiplomaticVictoryRanking(): DiplomaticVictoryProgress[] {
    return this.nationManager.getAllNations()
      .map((nation) => this.getDiplomaticVictoryProgress(nation.id))
      .sort((a, b) =>
        b.diplomacyScore - a.diplomacyScore
        || a.nationId.localeCompare(b.nationId),
      );
  }

  getDominationVictoryProgress(nationId: string): DominationProgress {
    return getDominationProgress(
      this.nationManager.getAllNations(),
      nationId,
      (candidateId) => this.diplomacyManager?.getVassalHost(candidateId),
      this.getDominationVictorySettings(),
      this.buildLandControlLookup(),
    );
  }

  getDominationVictoryRanking(): DominationRankingEntry[] {
    return buildDominationRanking(
      this.nationManager.getAllNations(),
      (nationId) => this.diplomacyManager?.getVassalHost(nationId),
      this.getDominationVictorySettings(),
      this.buildLandControlLookup(),
      () => 0,
    );
  }

  /**
   * Build the authoritative land-ownership lookup from the same
   * {@link NationManager.getLandControlStats} data the territory UI/pie chart
   * uses. Stats are computed once here and reused across every candidate so a
   * full ranking stays a single O(tiles) sweep. When no map is wired (e.g. unit
   * tests that only exercise the vassal route) the lookup reports zero land.
   */
  private buildLandControlLookup(): LandControlLookup {
    if (!this.mapData) {
      return { totalLandTiles: 0, getControlledLandTiles: () => 0 };
    }
    const stats = this.nationManager.getLandControlStats(this.mapData);
    return {
      totalLandTiles: stats.totalLandTiles,
      getControlledLandTiles: (id) => stats.controlledLandTilesByNation.get(id) ?? 0,
    };
  }

  /** Human-readable statement of which route(s) satisfied Domination Victory. */
  private describeDominationRoute(nationId: string): string {
    const progress = this.getDominationVictoryProgress(nationId);
    const name = this.nationManager.getNation(nationId)?.name ?? nationId;
    const land = `land=${progress.landControlPercent.toFixed(1)}%/${progress.requiredLandControlPercent}%`;
    const vassals = `vassals=${progress.directVassalCount}/${progress.requiredVassalCount}`;
    if (progress.vassalRequirementMet && progress.landRequirementMet) {
      return `${name} achieved Domination Victory through both territorial control (${land}) and vassal control (${vassals}).`;
    }
    if (progress.landRequirementMet) {
      return `${name} achieved Domination Victory through territorial control: ${land}.`;
    }
    return `${name} achieved Domination Victory through vassal control: ${vassals}.`;
  }

  private checkCulturalVictory(): string | null {
    for (const nation of this.nationManager.getAllNations()) {
      const progress = this.getCulturalVictoryProgress(nation.id);
      if (progress.victoryEligible) return nation.id;
    }
    return null;
  }

  private checkDominationVictory(): string | null {
    if (!this.diplomacyManager) return null;
    return this.getDominationVictoryRanking().find((entry) => entry.fulfilled)?.nationId ?? null;
  }

  private checkDiplomaticVictory(): string | null {
    for (const nation of this.nationManager.getAllNations()) {
      if (this.getDiplomacyScore(nation.id) >= DIPLOMATIC_VICTORY_SCORE_THRESHOLD) {
        return nation.id;
      }
    }
    return null;
  }

  private checkScienceVictory(): string | null {
    if (!this.science.enabled || !this.resourceAccessSystem) return null;

    for (const nation of this.nationManager.getAllNations()) {
      const count = this.resourceAccessSystem.getManufacturedResourceSourceCount(
        nation.id,
        AEROSPACE_PARTS_ID,
      );
      if (count >= this.science.requiredAerospaceParts) return nation.id;
    }
    return null;
  }

  private logScienceVictory(nationId: string, round: number): void {
    if (!this.log || !this.resourceAccessSystem) return;
    const nation = this.nationManager.getNation(nationId);
    const name = nation?.name ?? nationId;
    const count = this.resourceAccessSystem.getManufacturedResourceSourceCount(
      nationId,
      AEROSPACE_PARTS_ID,
    );
    this.log(nationId, `[r${round}] ${name} achieved Science Victory with ${count} aerospace parts.`);
  }

  private logDominationVictory(nationId: string, round: number): void {
    if (!this.log) return;
    this.log(nationId, `[r${round}] [Victory] ${this.describeDominationRoute(nationId)}`);
  }

  private logDominationProgress(round: number): void {
    if (!this.log) return;
    const ranking = this.getDominationVictoryRanking();
    if (ranking.length === 0) return;
    const lines = [`[r${round}] [Victory] Domination Victory Ranking:`];
    for (const progress of ranking) {
      const name = this.nationManager.getNation(progress.nationId)?.name ?? progress.nationId;
      lines.push(
        `- ${name}: vassals=${progress.directVassalCount}/${progress.requiredVassalCount} `
          + `land=${progress.landControlPercent.toFixed(1)}%/${progress.requiredLandControlPercent}% `
          + `vassalsMet=${progress.vassalRequirementMet} landMet=${progress.landRequirementMet} `
          + `fulfilled=${progress.fulfilled}`,
      );
    }
    this.log(ranking[0].nationId, lines.join('\n'));
  }

  private logScienceProgress(round: number): void {
    if (!this.log) return;
    const ranking = this.getScienceVictoryRanking();
    if (ranking.length === 0) return;

    const req = this.science.requiredAerospaceParts;
    const lines = [`[r${round}] Science Victory progress:`];
    for (const p of ranking) {
      const nation = this.nationManager.getNation(p.nationId);
      const name = nation?.name ?? p.nationId;
      lines.push(`- ${name}: ${p.aerospaceParts}/${req} parts, ${p.fulfilledMilestones}/4 milestones, science score ${p.scienceScore}`);
    }
    this.log(ranking[0].nationId, lines.join('\n'));
  }

  private logCulturalVictory(nationId: string, round: number): void {
    if (!this.log) return;
    const name = this.nationManager.getNation(nationId)?.name ?? nationId;
    const progress = this.getCulturalVictoryProgress(nationId);
    if (progress.victoryRoute === 'overwhelming') {
      this.log(
        nationId,
        `[r${round}] [Victory] ${name} achieved Cultural Victory through overwhelming cultural dominance: ${progress.accumulatedCulture.toLocaleString()} / ${progress.overwhelmingCultureThreshold.toLocaleString()} Culture.`,
      );
      return;
    }
    this.log(nationId,
      `[r${round}] ${name} achieved Cultural Victory: culture=${progress.accumulatedCulture}/${progress.requiredCulture} wonders=${progress.ownedWonders}/${progress.requiredWonders} currency=${progress.currencyStatus ?? 'Not established'} latestGames=${progress.latestCompletedGamesNumber ?? 'none'} reigningGoNChampion=true.`,
    );
  }

  private logCulturalProgress(round: number): void {
    if (!this.log) return;
    const ranking = this.getCulturalVictoryRanking();
    if (ranking.length === 0) return;

    const lines = [`[r${round}] Cultural Victory progress:`];
    for (const p of ranking) {
      const name = this.nationManager.getNation(p.nationId)?.name ?? p.nationId;
      const cultureReady = p.accumulatedCulture >= p.requiredCulture ? ' [READY]' : '';
      const wondersReady = p.ownedWonders >= p.requiredWonders ? ' [READY]' : '';
      const currencyReady = p.currencyStatus === 'Dominant' ? ' [READY]' : '';
      const overwhelmingReady = p.overwhelmingCultureThresholdMet ? ' [READY]' : '';
      lines.push(
        `- ${name}: culture=${p.accumulatedCulture}/${p.requiredCulture}${cultureReady} wonders=${p.ownedWonders}/${p.requiredWonders}${wondersReady} currency=${p.currencyStatus ?? 'Not established'}${currencyReady} normalRequirements=${p.normalRequirementsMet} latestGames=${p.latestCompletedGamesNumber ?? 'none'} reigningGoNChampion=${p.isReigningGamesChampion} overwhelmingCulture=${p.accumulatedCulture}/${p.overwhelmingCultureThreshold}${overwhelmingReady} victoryRoute=${p.victoryRoute ?? 'none'} victoryEligible=${p.victoryEligible}`,
      );
    }
    this.log(ranking[0].nationId, lines.join('\n'));
  }

  private logDiplomaticVictory(nationId: string, round: number): void {
    if (!this.log) return;
    const name = this.nationManager.getNation(nationId)?.name ?? nationId;
    const breakdown = this.getDiplomaticScoreBreakdown(nationId);
    this.log(nationId, [
      `[r${round}] ${name} achieved Diplomatic Victory with ${formatScore(breakdown.total)} Diplomatic Score.`,
      this.formatDiplomaticScoreBreakdown('Diplomatic Victory Final Score', [breakdown]),
    ].join('\n'));
  }

  private logDiplomaticProgress(round: number): void {
    if (!this.log) return;
    const ranking = this.getDiplomaticVictoryRanking();
    if (ranking.length === 0) return;
    const breakdowns = ranking.map((entry) => entry.scoreBreakdown);
    this.log(ranking[0].nationId, this.formatDiplomaticScoreBreakdown(
      `[r${round}] Diplomatic Victory Progress`,
      breakdowns,
    ));
  }

  private getDiplomacyScore(nationId: string): number {
    return this.getDiplomaticScoreBreakdown(nationId).total;
  }

  private getDiplomaticScoreBreakdown(nationId: string): DiplomaticScoreBreakdown {
    return this.worldCouncilSystem
      ?.getDiplomaticScoreBreakdown(nationId)
      ?? {
        nationId,
        total: 0,
        proposalScore: 0,
        supportScore: 0,
        contributionScore: 0,
        otherScore: 0,
      };
  }

  private formatDiplomaticScoreBreakdown(title: string, breakdowns: readonly DiplomaticScoreBreakdown[]): string {
    const lines = [title];
    for (const breakdown of breakdowns) {
      const name = this.nationManager.getNation(breakdown.nationId)?.name ?? breakdown.nationId;
      const display = getDisplayDiplomaticScoreBreakdown(breakdown);
      lines.push(
        '',
        name,
        `  Total Score............. ${formatScore(display.total)}`,
        `  Proposals Passed........ ${formatScore(display.proposalScore)}`,
        `  Resolution Support...... ${formatScore(display.supportScore)}`,
        `  Contributions........... ${formatScore(display.contributionScore)}`,
        `  Other................... ${formatScore(display.otherScore)}`,
      );
    }
    return lines.join('\n');
  }

  onVictory(callback: VictoryListener): void {
    this.listeners.push(callback);
  }
}

function formatScore(score: number): string {
  return Math.round(score).toLocaleString();
}

function getDisplayDiplomaticScoreBreakdown(breakdown: DiplomaticScoreBreakdown): DiplomaticScoreBreakdown {
  const total = Math.round(breakdown.total);
  const proposalScore = Math.floor(Math.max(0, breakdown.proposalScore));
  const supportScore = Math.floor(Math.max(0, breakdown.supportScore));
  const contributionScore = Math.floor(Math.max(0, breakdown.contributionScore));
  return {
    nationId: breakdown.nationId,
    total,
    proposalScore,
    supportScore,
    contributionScore,
    otherScore: total - proposalScore - supportScore - contributionScore,
  };
}
