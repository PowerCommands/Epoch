import type { CityManager } from './CityManager';
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
  domination?: ToggleableVictorySettings;
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
export const DIPLOMATIC_VICTORY_SCORE_THRESHOLD = WORLD_COUNCIL_DIPLOMACY_SCORE_THRESHOLD;

/**
 * VictorySystem checks for win conditions after each turn end.
 * Domination: one nation owns every active nation's original capital.
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
  private readonly dominationEnabled: boolean;
  private readonly culturalEnabled: boolean;
  private readonly diplomaticEnabled: boolean;
  private lastProgressRound = -SCIENCE_PROGRESS_INTERVAL;
  private lastCulturalProgressRound = -CULTURAL_PROGRESS_INTERVAL;
  private lastDiplomaticProgressRound = -DIPLOMATIC_PROGRESS_INTERVAL;

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
  ) {
    this.science = {
      enabled: conditions.science?.enabled ?? true,
      requiredAerospaceParts: conditions.science?.requiredAerospaceParts ?? DEFAULT_REQUIRED_AEROSPACE_PARTS,
    };
    this.dominationEnabled = conditions.domination?.enabled ?? true;
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

      const dominationWinner = this.dominationEnabled ? this.checkDominationVictory() : null;
      if (dominationWinner) {
        this.recordVictory(dominationWinner, 'domination', e.round);
        this.logVictory(dominationWinner, 'domination', e.round);
        for (const cb of this.listeners) cb(dominationWinner, 'domination');
      }
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
  }

  /** Public entry point kept for external callers. Checks domination only. */
  checkVictory(): string | null {
    return this.checkDominationVictory();
  }

  /** Which victory types are active. Persisted so saves restore the same rules. */
  getEnabledConditions(): EnabledVictoryConditions {
    return {
      domination: this.dominationEnabled,
      science: this.science.enabled,
      cultural: this.culturalEnabled,
      diplomatic: this.diplomaticEnabled,
    };
  }

  getScienceVictorySettings(): Readonly<ScienceVictorySettings> {
    return { ...this.science };
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
    this.log(nationId, `VICTORY: ${name} won by ${type} victory on round ${round} (${dateLabel}).`);
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

  private checkCulturalVictory(): string | null {
    for (const nation of this.nationManager.getAllNations()) {
      const progress = this.getCulturalVictoryProgress(nation.id);
      if (progress.victoryEligible) return nation.id;
    }
    return null;
  }

  private checkDominationVictory(): string | null {
    const activeNations = this.nationManager.getAllNations();
    if (activeNations.length < 2) return null;

    const activeNationIds = new Set(activeNations.map((nation) => nation.id));
    const capitals = this.cityManager.getAllCities()
      .filter((c) => c.isOriginalCapital && activeNationIds.has(c.originNationId));
    if (capitals.length < activeNations.length) return null;

    const owners = new Set(capitals.map((c) => c.ownerId));
    if (owners.size === 1) return capitals[0].ownerId;
    return null;
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
