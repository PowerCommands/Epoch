import type { TechnologyDefinition } from '../data/technologies';
import { ALL_TECHNOLOGIES, getTechnologyById } from '../data/technologies';
import { getGameSpeedById, scaleGameSpeedCost, type GameSpeedDefinition } from '../data/gameSpeeds';
import { getLeaderByNationId } from '../data/leaders';
import { resolveLeaderEraStrategy } from '../data/aiLeaderEraStrategies';
import type { CityManager } from './CityManager';
import type { EventLogSystem } from './EventLogSystem';
import type { NationManager } from './NationManager';
import { pickBestAIResearchTechnology } from './ai/AIResearchPlanningSystem';
import { DEFAULT_AI_EARLY_GAME_TURN_LIMIT } from '../data/aiBaselinePriorities';
import type { AILogFormatter } from './ai/AILogFormatter';
import { getHighestEra } from './EraSystem';

export type Technology = TechnologyDefinition;
type ChangedListener = () => void;
export type ResearchCompletedListener = (event: {
  readonly nationId: string;
  readonly technologyId: string;
}) => void;
type ScienceProvider = (nationId: string) => number;

/**
 * Centralized national research rules.
 *
 * Phaser-free and deterministic: one current technology per nation, no overflow
 * carry, and a stable definition-order fallback while research UI is absent.
 */
export class ResearchSystem {
  private readonly listeners: ChangedListener[] = [];
  private readonly completedListeners: ResearchCompletedListener[] = [];

  constructor(
    private readonly nationManager: NationManager,
    private readonly cityManager: CityManager,
    private readonly eventLog: EventLogSystem,
    private readonly getCurrentRound: () => number,
    private readonly getBuildingSciencePerTurn: ScienceProvider = () => 0,
    private readonly gameSpeed: GameSpeedDefinition = getGameSpeedById(undefined),
    private readonly earlyGameTurnLimit: number = DEFAULT_AI_EARLY_GAME_TURN_LIMIT,
    private readonly formatLog?: AILogFormatter,
  ) {}

  canStartResearch(nationId: string, techId: string): boolean {
    const nation = this.nationManager.getNation(nationId);
    const technology = getTechnologyById(techId);
    if (!nation || !technology) return false;
    if (nation.currentResearchTechId === techId) return false;
    if (this.isResearched(nationId, techId)) return false;

    return technology.prerequisites.every((prerequisiteId) =>
      this.isResearched(nationId, prerequisiteId),
    );
  }

  startResearch(nationId: string, techId: string): boolean {
    if (!this.canStartResearch(nationId, techId)) return false;

    const nation = this.nationManager.getNation(nationId);
    const technology = getTechnologyById(techId);
    if (!nation || !technology) return false;

    nation.currentResearchTechId = techId;
    nation.researchProgress = 0;

    const message = `${nation.name} started researching ${technology.name}.`;
    this.eventLog.log(
      nation.isHuman ? message : this.formatAIResearchLog(nation.id, `started researching ${technology.name}.`, message),
      [nation.id],
      this.getCurrentRound(),
    );
    this.notifyChanged();

    return true;
  }

  advanceResearchForNation(nationId: string): void {
    const nation = this.nationManager.getNation(nationId);
    if (!nation?.currentResearchTechId) return;

    const technology = getTechnologyById(nation.currentResearchTechId);
    if (!technology) {
      nation.currentResearchTechId = undefined;
      nation.researchProgress = 0;
      this.notifyChanged();
      return;
    }

    nation.researchProgress += this.calculateResearchPerTurn(nationId);

    if (nation.researchProgress < this.getEffectiveCost(technology.id)) {
      this.notifyChanged();
      return;
    }

    const completedTechnologyId = technology.id;
    const didCompleteTechnology = !nation.researchedTechIds.includes(completedTechnologyId);
    if (didCompleteTechnology) {
      nation.researchedTechIds.push(technology.id);
    }
    nation.currentResearchTechId = undefined;
    nation.researchProgress = 0;

    this.logResearchDiscovery(nation.id, technology.name);
    if (didCompleteTechnology) {
      this.notifyCompleted(nation.id, completedTechnologyId);
    }
    this.notifyChanged();
  }

  unlockTechnology(nationId: string, techId: string): boolean {
    const nation = this.nationManager.getNation(nationId);
    const technology = getTechnologyById(techId);
    if (!nation || !technology) return false;
    if (nation.researchedTechIds.includes(technology.id)) return false;

    nation.researchedTechIds.push(technology.id);
    if (nation.currentResearchTechId === technology.id) {
      nation.currentResearchTechId = undefined;
      nation.researchProgress = 0;
    }

    this.logResearchDiscovery(nation.id, technology.name);
    this.notifyCompleted(nation.id, technology.id);
    this.notifyChanged();
    return true;
  }

  completeCurrentResearch(nationId: string): Technology | null {
    const nation = this.nationManager.getNation(nationId);
    if (!nation?.currentResearchTechId) return null;

    const technology = getTechnologyById(nation.currentResearchTechId);
    if (!technology) {
      nation.currentResearchTechId = undefined;
      nation.researchProgress = 0;
      this.notifyChanged();
      return null;
    }

    const completedTechnologyId = technology.id;
    const didCompleteTechnology = !nation.researchedTechIds.includes(completedTechnologyId);
    if (didCompleteTechnology) {
      nation.researchedTechIds.push(technology.id);
    }
    nation.currentResearchTechId = undefined;
    nation.researchProgress = 0;

    this.logResearchDiscovery(nation.id, technology.name);
    if (didCompleteTechnology) {
      this.notifyCompleted(nation.id, completedTechnologyId);
    }
    this.notifyChanged();

    return technology;
  }

  ensureResearchSelected(nationId: string): boolean {
    const nation = this.nationManager.getNation(nationId);
    if (!nation || nation.currentResearchTechId) return false;

    const availableTechnologies = this.getAvailableTechnologies(nationId);
    const nextTechnology = nation.isHuman
      ? availableTechnologies[0]
      : pickBestAIResearchTechnology({
        nation,
        availableTechnologies,
        currentTurn: this.getCurrentRound(),
        earlyGameTurnLimit: this.earlyGameTurnLimit,
        formatLog: this.formatLog,
        eraStrategy: this.getActiveEraStrategy(nationId),
      });
    if (!nextTechnology) return false;

    if (!nation.isHuman) {
      const eraStrategy = this.getActiveEraStrategy(nationId);
      console.log(
        this.formatLog?.(
          nationId,
          `selected research ${nextTechnology.name} (strategy: ${eraStrategy.id})`,
        ) ?? `${nation.name} selected research ${nextTechnology.name} (strategy: ${eraStrategy.id})`,
      );
    }
    return this.startResearch(nationId, nextTechnology.id);
  }

  isResearched(nationId: string, techId: string): boolean {
    const nation = this.nationManager.getNation(nationId);
    return nation?.researchedTechIds.includes(techId) ?? false;
  }

  getRequiredTechnologyForImprovement(improvementId: string): Technology | undefined {
    return ALL_TECHNOLOGIES.find((technology) =>
      technology.unlocks.some((unlock) => unlock.kind === 'improvement' && unlock.id === improvementId),
    );
  }

  getRequiredTechnologyForUnit(unitId: string): Technology | undefined {
    return ALL_TECHNOLOGIES.find((technology) =>
      technology.unlocks.some((unlock) => unlock.kind === 'unit' && unlock.id === unitId),
    );
  }

  getRequiredTechnologyForBuilding(buildingId: string): Technology | undefined {
    return ALL_TECHNOLOGIES.find((technology) =>
      technology.unlocks.some((unlock) => unlock.kind === 'building' && unlock.id === buildingId),
    );
  }

  getRequiredTechnologyForWonder(wonderId: string): Technology | undefined {
    return ALL_TECHNOLOGIES.find((technology) =>
      technology.unlocks.some((unlock) => unlock.kind === 'wonder' && unlock.id === wonderId),
    );
  }

  isImprovementUnlocked(nationId: string, improvementId: string): boolean {
    const requiredTechnology = this.getRequiredTechnologyForImprovement(improvementId);
    if (!requiredTechnology) return true;
    return this.isResearched(nationId, requiredTechnology.id);
  }

  isUnitUnlocked(nationId: string, unitId: string): boolean {
    const requiredTechnology = this.getRequiredTechnologyForUnit(unitId);
    if (!requiredTechnology) return true;
    return this.isResearched(nationId, requiredTechnology.id);
  }

  isBuildingUnlocked(nationId: string, buildingId: string): boolean {
    const requiredTechnology = this.getRequiredTechnologyForBuilding(buildingId);
    if (!requiredTechnology) return true;
    return this.isResearched(nationId, requiredTechnology.id);
  }

  isWonderUnlocked(nationId: string, wonderId: string): boolean {
    const requiredTechnology = this.getRequiredTechnologyForWonder(wonderId);
    if (!requiredTechnology) return true;
    return this.isResearched(nationId, requiredTechnology.id);
  }

  getCurrentResearch(nationId: string): Technology | undefined {
    const nation = this.nationManager.getNation(nationId);
    if (!nation?.currentResearchTechId) return undefined;
    return getTechnologyById(nation.currentResearchTechId);
  }

  getAvailableTechnologies(nationId: string): Technology[] {
    return ALL_TECHNOLOGIES.filter((technology) =>
      this.canStartResearch(nationId, technology.id),
    );
  }

  getResearchedTechnologies(nationId: string): Technology[] {
    return ALL_TECHNOLOGIES.filter((technology) =>
      this.isResearched(nationId, technology.id),
    );
  }

  private getActiveEraStrategy(nationId: string) {
    const nation = this.nationManager.getNation(nationId);
    const era = getHighestEra(
      (nation?.researchedTechIds ?? [])
        .map((technologyId) => getTechnologyById(technologyId)?.era)
        .filter((era): era is import('../data/technologies').Era => era !== undefined),
    );
    return resolveLeaderEraStrategy(getLeaderByNationId(nationId)?.id, era);
  }

  getResearchProgress(nationId: string): number {
    return this.nationManager.getNation(nationId)?.researchProgress ?? 0;
  }

  getResearchPerTurn(nationId: string): number {
    return this.calculateResearchPerTurn(nationId);
  }

  getEffectiveCost(techId: string): number {
    const technology = getTechnologyById(techId);
    return technology ? scaleGameSpeedCost(technology.cost, this.gameSpeed) : 0;
  }

  private logResearchDiscovery(nationId: string, technologyName: string): void {
    const nation = this.nationManager.getNation(nationId);
    if (!nation) return;
    const fallbackMessage = `${nation.name} discovered ${technologyName}.`;
    this.eventLog.log(
      nation.isHuman ? fallbackMessage : this.formatAIResearchLog(nation.id, `discovered ${technologyName}.`, fallbackMessage),
      [nation.id],
      this.getCurrentRound(),
    );
  }

  private formatAIResearchLog(nationId: string, aiMessage: string, fallbackMessage: string): string {
    return this.formatLog?.(nationId, aiMessage) ?? fallbackMessage;
  }

  onChanged(cb: ChangedListener): void {
    this.listeners.push(cb);
  }

  onCompleted(listener: ResearchCompletedListener): void {
    this.completedListeners.push(listener);
  }

  private calculateResearchPerTurn(nationId: string): number {
    return 1 + this.cityManager.getCitiesByOwner(nationId).length + this.getBuildingSciencePerTurn(nationId);
  }

  private notifyChanged(): void {
    for (const cb of this.listeners) cb();
  }

  private notifyCompleted(nationId: string, technologyId: string): void {
    for (const listener of this.completedListeners) {
      listener({ nationId, technologyId });
    }
  }
}
