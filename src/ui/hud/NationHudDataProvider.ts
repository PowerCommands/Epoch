import type { CityManager } from '../../systems/CityManager';
import type { HappinessSystem } from '../../systems/HappinessSystem';
import type { NationManager } from '../../systems/NationManager';
import type { PolicySystem } from '../../systems/PolicySystem';
import type { ResearchSystem } from '../../systems/ResearchSystem';
import type { TurnManager } from '../../systems/TurnManager';
import { getPolicyById } from '../../data/policies';

export interface HudResourceEntry {
  key: 'turn' | 'happiness' | 'production' | 'culture' | 'gold';
  icon: string;
  value: number | string;
  delta: number;
}

export interface HudResearchOption {
  id: string;
  name: string;
  cost: number;
}

export interface HudResearchState {
  currentName: string;
  progress: number;
  cost: number;
  progressPercent: number;
  sciencePerTurn: number;
  available: HudResearchOption[];
  researchedNames: string[];
}

export interface HudPolicyEntry {
  id: string;
  name: string;
  description: string;
  effectiveCost: number;
  isUnlocked: boolean;
  isActive: boolean;
  isAvailable: boolean;
  prerequisiteNames: string[];
  missingPrerequisiteNames: string[];
}

export interface HudPolicyTreeState {
  id: string;
  name: string;
  description?: string;
  policies: HudPolicyEntry[];
}

export interface HudPolicyState {
  currentName: string;
  progress: number;
  cost: number;
  progressPercent: number;
  culturePerTurn: number;
  trees: HudPolicyTreeState[];
}

/**
 * Read-only adapter for HUD widgets. It only gathers already-calculated state
 * from existing systems so scene orchestration stays thin.
 */
export class NationHudDataProvider {
  constructor(
    private readonly nationManager: NationManager,
    private readonly cityManager: CityManager,
    private readonly happinessSystem: HappinessSystem,
    private readonly researchSystem: ResearchSystem,
    private readonly policySystem: PolicySystem,
    private readonly turnManager: TurnManager,
    private readonly getTurnLabel: (turn: number) => string,
  ) {}

  getResourceEntries(nationId: string): HudResourceEntry[] {
    const nationResources = this.nationManager.getResources(nationId);
    const productionPerTurn = this.cityManager.getCitiesByOwner(nationId)
      .reduce((sum, city) => sum + this.cityManager.getResources(city.id).productionPerTurn, 0);

    return [
      {
        key: 'turn',
        icon: '',
        value: this.getTurnLabel(this.turnManager.getCurrentRound()),
        delta: 0,
      },
      {
        key: 'happiness',
        icon: '😀',
        value: this.happinessSystem.getNetHappiness(nationId),
        delta: nationResources.happinessPerTurn,
      },
      {
        key: 'production',
        icon: '⚙️',
        value: 0,
        delta: productionPerTurn,
      },
      {
        key: 'culture',
        icon: '⭐',
        value: nationResources.culture,
        delta: nationResources.culturePerTurn,
      },
      {
        key: 'gold',
        icon: '💰',
        value: nationResources.gold,
        delta: nationResources.goldPerTurn,
      },
    ];
  }

  getResearchState(nationId: string): HudResearchState {
    const current = this.researchSystem.getCurrentResearch(nationId);
    return {
      currentName: current?.name ?? 'None',
      progress: this.researchSystem.getResearchProgress(nationId),
      cost: current?.cost ?? 0,
      progressPercent: current?.cost ? Math.max(0, Math.min(100, Math.round((this.researchSystem.getResearchProgress(nationId) / current.cost) * 100))) : 0,
      sciencePerTurn: this.researchSystem.getResearchPerTurn(nationId),
      available: this.researchSystem.getAvailableTechnologies(nationId).map((technology) => ({
        id: technology.id,
        name: technology.name,
        cost: technology.cost,
      })),
      researchedNames: this.researchSystem.getResearchedTechnologies(nationId).map((technology) => technology.name),
    };
  }

  getPolicyState(nationId: string): HudPolicyState {
    const current = this.policySystem.getCurrentPolicy(nationId);
    const viewState = this.policySystem.getPolicyViewState(nationId);
    const trees = new Map<string, HudPolicyTreeState>();

    for (const entry of viewState) {
      const existingTree = trees.get(entry.tree.id);
      const treeState = existingTree ?? {
        id: entry.tree.id,
        name: entry.tree.name,
        description: entry.tree.description,
        policies: [],
      };

      treeState.policies.push({
        id: entry.policy.id,
        name: entry.policy.name,
        description: entry.policy.description,
        effectiveCost: entry.effectiveCost,
        isUnlocked: entry.isUnlocked,
        isActive: entry.isActive,
        isAvailable: entry.isAvailable,
        prerequisiteNames: entry.policy.prerequisites.map((id) => getPolicyById(id)?.name ?? id),
        missingPrerequisiteNames: entry.missingPrerequisiteIds.map((id) => getPolicyById(id)?.name ?? id),
      });

      if (!existingTree) {
        trees.set(entry.tree.id, treeState);
      }
    }

    return {
      currentName: current?.name ?? 'None selected',
      progress: this.policySystem.getPolicyProgress(nationId),
      cost: current ? this.policySystem.getEffectiveCost(nationId, current.id) : 0,
      progressPercent: current
        ? Math.max(0, Math.min(100, Math.round((this.policySystem.getPolicyProgress(nationId) / this.policySystem.getEffectiveCost(nationId, current.id)) * 100)))
        : 0,
      culturePerTurn: this.policySystem.getPolicyCulturePerTurn(nationId),
      trees: Array.from(trees.values()),
    };
  }
}
