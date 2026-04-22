import type { CityManager } from '../../systems/CityManager';
import type { HappinessSystem } from '../../systems/HappinessSystem';
import type { NationManager } from '../../systems/NationManager';
import type { ResearchSystem } from '../../systems/ResearchSystem';

export interface HudResourceEntry {
  key: 'happiness' | 'production' | 'culture' | 'gold';
  icon: string;
  value: number;
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
  sciencePerTurn: number;
  available: HudResearchOption[];
  researchedNames: string[];
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
  ) {}

  getResourceEntries(nationId: string): HudResourceEntry[] {
    const nationResources = this.nationManager.getResources(nationId);
    const productionPerTurn = this.cityManager.getCitiesByOwner(nationId)
      .reduce((sum, city) => sum + this.cityManager.getResources(city.id).productionPerTurn, 0);

    return [
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
      sciencePerTurn: this.researchSystem.getResearchPerTurn(nationId),
      available: this.researchSystem.getAvailableTechnologies(nationId).map((technology) => ({
        id: technology.id,
        name: technology.name,
        cost: technology.cost,
      })),
      researchedNames: this.researchSystem.getResearchedTechnologies(nationId).map((technology) => technology.name),
    };
  }
}
