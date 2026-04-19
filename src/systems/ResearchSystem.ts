import type { TechnologyDefinition } from '../data/technologies';
import { ALL_TECHNOLOGIES, getTechnologyById } from '../data/technologies';
import type { CityManager } from './CityManager';
import type { EventLogSystem } from './EventLogSystem';
import type { NationManager } from './NationManager';

export type Technology = TechnologyDefinition;
type ChangedListener = () => void;
type ScienceProvider = (nationId: string) => number;

/**
 * Centralized national research rules.
 *
 * Phaser-free and deterministic: one current technology per nation, no overflow
 * carry, and a stable definition-order fallback while research UI is absent.
 */
export class ResearchSystem {
  private readonly listeners: ChangedListener[] = [];

  constructor(
    private readonly nationManager: NationManager,
    private readonly cityManager: CityManager,
    private readonly eventLog: EventLogSystem,
    private readonly getCurrentRound: () => number,
    private readonly getBuildingSciencePerTurn: ScienceProvider = () => 0,
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

    this.eventLog.log(
      `${nation.name} started researching ${technology.name}.`,
      [nation.id],
      this.getCurrentRound(),
    );
    this.notifyChanged();

    return true;
  }

  advanceResearchForNation(nationId: string): void {
    this.ensureResearchSelected(nationId);

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

    if (nation.researchProgress < technology.cost) {
      this.notifyChanged();
      return;
    }

    if (!nation.researchedTechIds.includes(technology.id)) {
      nation.researchedTechIds.push(technology.id);
    }
    nation.currentResearchTechId = undefined;
    nation.researchProgress = 0;

    this.eventLog.log(
      `${nation.name} discovered ${technology.name}.`,
      [nation.id],
      this.getCurrentRound(),
    );
    this.notifyChanged();
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

    if (!nation.researchedTechIds.includes(technology.id)) {
      nation.researchedTechIds.push(technology.id);
    }
    nation.currentResearchTechId = undefined;
    nation.researchProgress = 0;

    this.eventLog.log(
      `${nation.name} discovered ${technology.name}.`,
      [nation.id],
      this.getCurrentRound(),
    );
    this.notifyChanged();

    return technology;
  }

  ensureResearchSelected(nationId: string): boolean {
    const nation = this.nationManager.getNation(nationId);
    if (!nation || nation.currentResearchTechId) return false;

    const nextTechnology = this.getAvailableTechnologies(nationId)[0];
    if (!nextTechnology) return false;

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

  getResearchProgress(nationId: string): number {
    return this.nationManager.getNation(nationId)?.researchProgress ?? 0;
  }

  getResearchPerTurn(nationId: string): number {
    return this.calculateResearchPerTurn(nationId);
  }

  onChanged(cb: ChangedListener): void {
    this.listeners.push(cb);
  }

  private calculateResearchPerTurn(nationId: string): number {
    return 1 + this.cityManager.getCitiesByOwner(nationId).length + this.getBuildingSciencePerTurn(nationId);
  }

  private notifyChanged(): void {
    for (const cb of this.listeners) cb();
  }
}
