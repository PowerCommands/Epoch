import type { CityManager } from '../../systems/CityManager';
import type { HappinessSystem } from '../../systems/HappinessSystem';
import type { NationManager } from '../../systems/NationManager';
import type { CultureSystem } from '../../systems/culture/CultureSystem';
import type { ResearchSystem } from '../../systems/ResearchSystem';
import type { TurnManager } from '../../systems/TurnManager';
import { getCultureNodeById } from '../../data/cultureTree';

export interface HudResourceEntry {
  key: 'turn' | 'happiness' | 'production' | 'culture' | 'gold' | 'science' | 'influence';
  icon: string;
  value: number | string;
  delta: number;
  displayMode?: 'valueAndDelta' | 'deltaOnly';
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

export interface HudCultureEntry {
  id: string;
  name: string;
  era: string;
  unlocks: string[];
  effectiveCost: number;
  isUnlocked: boolean;
  isActive: boolean;
  isAvailable: boolean;
  prerequisiteNames: string[];
  missingPrerequisiteNames: string[];
}

export interface HudCultureEraState {
  id: string;
  name: string;
  nodes: HudCultureEntry[];
}

export interface HudCultureState {
  currentName: string;
  progress: number;
  cost: number;
  progressPercent: number;
  culturePerTurn: number;
  eras: HudCultureEraState[];
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
    private readonly cultureSystem: CultureSystem,
    private readonly turnManager: TurnManager,
    private readonly getTurnLabel: (turn: number) => string,
  ) {}

  getResourceEntries(nationId: string): HudResourceEntry[] {
    const nationResources = this.nationManager.getResources(nationId);
    const productionPerTurn = this.cityManager.getCitiesByOwner(nationId)
      .reduce((sum, city) => sum + this.cityManager.getResources(city.id).productionPerTurn, 0);
    const researchProgress = this.researchSystem.getResearchProgress(nationId);
    const researchPerTurn = this.researchSystem.getResearchPerTurn(nationId);

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
        displayMode: 'deltaOnly',
      },
      {
        key: 'science',
        icon: '🔬',
        value: researchProgress,
        delta: researchPerTurn,
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
      {
        key: 'influence',
        icon: '🕊️',
        value: nationResources.influence,
        delta: nationResources.influencePerTurn,
      },
    ];
  }

  getResearchState(nationId: string): HudResearchState {
    const current = this.researchSystem.getCurrentResearch(nationId);
    const currentCost = current ? this.researchSystem.getEffectiveCost(current.id) : 0;
    return {
      currentName: current?.name ?? 'None',
      progress: this.researchSystem.getResearchProgress(nationId),
      cost: currentCost,
      progressPercent: currentCost > 0 ? Math.max(0, Math.min(100, Math.round((this.researchSystem.getResearchProgress(nationId) / currentCost) * 100))) : 0,
      sciencePerTurn: this.researchSystem.getResearchPerTurn(nationId),
      available: this.researchSystem.getAvailableTechnologies(nationId).map((technology) => ({
        id: technology.id,
        name: technology.name,
        cost: this.researchSystem.getEffectiveCost(technology.id),
      })),
      researchedNames: this.researchSystem.getResearchedTechnologies(nationId).map((technology) => technology.name),
    };
  }

  getCultureState(nationId: string): HudCultureState {
    const current = this.cultureSystem.getCurrentCultureNode(nationId);
    const viewState = this.cultureSystem.getCultureViewState(nationId)
      .filter((entry) => entry.isAvailable || entry.isActive);
    const eras = new Map<string, HudCultureEraState>();

    for (const entry of viewState) {
      const existingEra = eras.get(entry.node.era);
      const eraState = existingEra ?? {
        id: entry.node.era,
        name: formatEraName(entry.node.era),
        nodes: [],
      };

      eraState.nodes.push({
        id: entry.node.id,
        name: entry.node.name,
        era: entry.node.era,
        unlocks: entry.node.unlocks.map((unlock) => `${unlock.type}: ${unlock.value}`),
        effectiveCost: entry.effectiveCost,
        isUnlocked: entry.isUnlocked,
        isActive: entry.isActive,
        isAvailable: entry.isAvailable,
        prerequisiteNames: (entry.node.prerequisites ?? []).map((id) => getCultureNodeById(id)?.name ?? id),
        missingPrerequisiteNames: entry.missingPrerequisiteIds.map((id) => getCultureNodeById(id)?.name ?? id),
      });

      if (!existingEra) {
        eras.set(entry.node.era, eraState);
      }
    }

    return {
      currentName: current?.name ?? 'None selected',
      progress: this.cultureSystem.getCultureProgress(nationId),
      cost: current ? this.cultureSystem.getEffectiveCost(current.id) : 0,
      progressPercent: current
        ? Math.max(0, Math.min(100, Math.round((this.cultureSystem.getCultureProgress(nationId) / this.cultureSystem.getEffectiveCost(current.id)) * 100)))
        : 0,
      culturePerTurn: this.cultureSystem.getCulturePerTurn(nationId),
      eras: Array.from(eras.values()),
    };
  }
}

function formatEraName(era: string): string {
  return era.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
