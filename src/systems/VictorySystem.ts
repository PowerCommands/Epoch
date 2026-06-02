import type { CityManager } from './CityManager';
import type { CorporationSystem } from './CorporationSystem';
import type { NationManager } from './NationManager';
import type { ResearchSystem } from './ResearchSystem';
import type { ResourceAccessSystem } from './ResourceAccessSystem';
import type { TurnManager } from './TurnManager';
import type { WonderSystem } from './WonderSystem';
import { getOwnedWonderCount, getRequiredCulturalVictoryWonderCount } from './CulturalVictory';

export type VictoryType = 'domination' | 'science' | 'cultural';

type VictoryListener = (nationId: string, type: VictoryType) => void;
type VictoryLogger = (nationId: string, message: string) => void;

interface ScienceVictorySettings {
  enabled: boolean;
  requiredAerospaceParts: number;
}

interface VictoryConditionsConfig {
  science?: Partial<ScienceVictorySettings>;
}

export interface ScienceVictoryProgress {
  nationId: string;
  aerospaceParts: number;
  requiredAerospaceParts: number;
  hasFlight: boolean;
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
  ownedWonders: number;
  requiredWonders: number;
}

const AEROSPACE_PARTS_ID = 'aerospace_parts';
const AEROSPACE_CORP_ID = 'aerospace_industries';
const SCIENCE_PROGRESS_INTERVAL = 25;
const CULTURAL_PROGRESS_INTERVAL = 25;

/**
 * VictorySystem checks for win conditions after each turn end.
 * Domination: one nation owns every active nation's original capital.
 * Science: one nation produces enough aerospace_parts.
 * Cultural: one nation owns at least 75% of all World Wonders (ownership is
 * derived from current city ownership, so conquest transfers it).
 */
export class VictorySystem {
  private readonly listeners: VictoryListener[] = [];
  private won = false;
  private readonly science: ScienceVictorySettings;
  private lastProgressRound = -SCIENCE_PROGRESS_INTERVAL;
  private lastCulturalProgressRound = -CULTURAL_PROGRESS_INTERVAL;

  constructor(
    private readonly cityManager: CityManager,
    private readonly nationManager: NationManager,
    turnManager: TurnManager,
    private readonly resourceAccessSystem?: ResourceAccessSystem,
    conditions: VictoryConditionsConfig = {},
    private readonly log?: VictoryLogger,
    private readonly researchSystem?: ResearchSystem,
    private readonly corporationSystem?: CorporationSystem,
    private readonly wonderSystem?: WonderSystem,
  ) {
    this.science = {
      enabled: conditions.science?.enabled ?? true,
      requiredAerospaceParts: conditions.science?.requiredAerospaceParts ?? 5,
    };

    turnManager.on('turnEnd', (e) => {
      if (this.won) return;

      const scienceWinner = this.checkScienceVictory();
      if (scienceWinner) {
        this.won = true;
        this.logScienceVictory(scienceWinner, e.round);
        for (const cb of this.listeners) cb(scienceWinner, 'science');
        return;
      }

      const culturalWinner = this.checkCulturalVictory();
      if (culturalWinner) {
        this.won = true;
        this.logCulturalVictory(culturalWinner, e.round);
        for (const cb of this.listeners) cb(culturalWinner, 'cultural');
        return;
      }

      const dominationWinner = this.checkDominationVictory();
      if (dominationWinner) {
        this.won = true;
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
      if (this.won || !this.wonderSystem) return;
      if (e.round - this.lastCulturalProgressRound < CULTURAL_PROGRESS_INTERVAL) return;
      this.lastCulturalProgressRound = e.round;
      this.logCulturalProgress(e.round);
    });
  }

  /** Public entry point kept for external callers. Checks domination only. */
  checkVictory(): string | null {
    return this.checkDominationVictory();
  }

  getScienceVictoryProgress(nationId: string): ScienceVictoryProgress {
    const aerospaceParts = this.resourceAccessSystem?.getManufacturedResourceSourceCount(
      nationId,
      AEROSPACE_PARTS_ID,
    ) ?? 0;

    const hasFlight = this.researchSystem?.isResearched(nationId, 'flight') ?? false;
    const hasAluminum = this.resourceAccessSystem?.hasResource(nationId, 'aluminum') ?? false;
    const hasFactory = this.cityManager.getCitiesByOwner(nationId).some(
      (city) => this.cityManager.getBuildings(city.id).has('factory'),
    );
    const hasAerospaceIndustries = this.corporationSystem
      ?.getFoundedCorporationsForNation(nationId)
      .some((c) => c.corporationId === AEROSPACE_CORP_ID) ?? false;

    const fulfilledMilestones = [hasFlight, hasAluminum, hasFactory, hasAerospaceIndustries]
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
      hasFlight,
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
    const ownedWonders = this.wonderSystem
      ? getOwnedWonderCount(nationId, this.wonderSystem, this.cityManager)
      : 0;
    return {
      nationId,
      ownedWonders,
      requiredWonders: getRequiredCulturalVictoryWonderCount(),
    };
  }

  /** Ranked by owned World Wonders (descending). UI ranking applies its own culture tie-break. */
  getCulturalVictoryRanking(): CulturalVictoryProgress[] {
    return this.nationManager.getAllNations()
      .map((n) => this.getCulturalVictoryProgress(n.id))
      .sort((a, b) => b.ownedWonders - a.ownedWonders);
  }

  private checkCulturalVictory(): string | null {
    if (!this.wonderSystem) return null;
    const required = getRequiredCulturalVictoryWonderCount();
    for (const nation of this.nationManager.getAllNations()) {
      if (getOwnedWonderCount(nation.id, this.wonderSystem, this.cityManager) >= required) {
        return nation.id;
      }
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
    const { ownedWonders, requiredWonders } = this.getCulturalVictoryProgress(nationId);
    this.log(nationId, `[r${round}] ${name} achieved Cultural Victory with ${ownedWonders}/${requiredWonders} World Wonders.`);
  }

  private logCulturalProgress(round: number): void {
    if (!this.log) return;
    const ranking = this.getCulturalVictoryRanking();
    if (ranking.length === 0) return;

    const required = getRequiredCulturalVictoryWonderCount();
    const lines = [`[r${round}] Cultural Victory progress (own ${required} World Wonders to win):`];
    for (const p of ranking) {
      const name = this.nationManager.getNation(p.nationId)?.name ?? p.nationId;
      lines.push(`- ${name}: ${p.ownedWonders}/${required} World Wonders`);
    }
    this.log(ranking[0].nationId, lines.join('\n'));
  }

  onVictory(callback: VictoryListener): void {
    this.listeners.push(callback);
  }
}
