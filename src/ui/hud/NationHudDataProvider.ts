import type { CityManager } from '../../systems/CityManager';
import type { HappinessSystem } from '../../systems/HappinessSystem';
import type { NationManager } from '../../systems/NationManager';
import type { CultureSystem } from '../../systems/culture/CultureSystem';
import type { ResearchSystem } from '../../systems/ResearchSystem';
import type { ResourceAccessSystem } from '../../systems/ResourceAccessSystem';
import type { TurnManager } from '../../systems/TurnManager';
import type { UnitUpkeepSystem } from '../../systems/UnitUpkeepSystem';
import { getCultureNodeById } from '../../data/cultureTree';
import { getNaturalResourceById } from '../../data/naturalResources';
import { getCultureSpriteKey, getCultureSpritePath } from '../../utils/assetPaths';
import {
  buildHappinessTooltip,
  formatHappinessStateLabel,
  happinessStateColor,
} from '../happinessFormat';

const STRATEGIC_RESOURCE_IDS = ['horses', 'iron', 'niter', 'coal', 'oil', 'aluminum', 'uranium'] as const;

export interface HudResourceEntry {
  key: 'turn' | 'happiness' | 'production' | 'culture' | 'gold' | 'science' | 'influence' | `strategic:${string}`;
  icon: string;
  iconKey?: string;
  value: number | string;
  delta: number;
  upkeep?: number;
  displayMode?: 'valueAndDelta' | 'deltaOnly' | 'happinessState' | 'valueOnly';
  stateLabel?: string;
  textColor?: string;
  tooltip?: string;
}

export interface HudResearchOption {
  id: string;
  name: string;
  era: string;
  cost: number;
  description: string;
}

export interface HudResearchState {
  currentName: string;
  progress: number;
  cost: number;
  progressPercent: number;
  sciencePerTurn: number;
  tooltip: string;
  available: HudResearchOption[];
  researchedNames: string[];
}

export interface HudCultureEntry {
  id: string;
  name: string;
  era: string;
  description: string;
  imageKey: string;
  imagePath: string;
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
  tooltip: string;
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
    private readonly resourceAccessSystem?: ResourceAccessSystem,
    private readonly unitUpkeepSystem?: UnitUpkeepSystem,
  ) {}

  getResourceEntries(nationId: string): HudResourceEntry[] {
    const nationResources = this.nationManager.getResources(nationId);
    const productionPerTurn = this.cityManager.getCitiesByOwner(nationId)
      .reduce((sum, city) => sum + this.cityManager.getResources(city.id).productionPerTurn, 0);
    const researchProgress = this.researchSystem.getResearchProgress(nationId);
    const researchPerTurn = this.researchSystem.getResearchPerTurn(nationId);
    const currentResearch = this.researchSystem.getCurrentResearch(nationId);
    const currentResearchCost = currentResearch ? this.researchSystem.getEffectiveCost(currentResearch.id) : 0;
    const researchTooltip = getResearchTooltip(currentResearch?.name, researchProgress, currentResearchCost);
    const currentCulture = this.cultureSystem.getCurrentCultureNode(nationId);
    const cultureProgress = this.cultureSystem.getCultureProgress(nationId);
    const currentCultureCost = currentCulture ? this.cultureSystem.getEffectiveCost(currentCulture.id) : 0;
    const cultureTooltip = getCultureTooltip(currentCulture?.name, cultureProgress, currentCultureCost);
    const happiness = this.happinessSystem.getNationState(nationId);
    const unitUpkeep = this.unitUpkeepSystem?.calculateUpkeep(nationId) ?? 0;

    const entries: HudResourceEntry[] = [
      {
        key: 'turn',
        icon: '',
        value: this.getTurnLabel(this.turnManager.getCurrentRound()),
        delta: 0,
      },
      {
        key: 'happiness',
        icon: '😀',
        value: happiness.netHappiness,
        delta: nationResources.happinessPerTurn,
        displayMode: 'happinessState',
        stateLabel: formatHappinessStateLabel(happiness.state),
        textColor: happinessStateColor(happiness.state),
        tooltip: buildHappinessTooltip(happiness),
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
        tooltip: researchTooltip,
      },
      {
        key: 'culture',
        icon: '⭐',
        value: nationResources.culture,
        delta: nationResources.culturePerTurn,
        tooltip: cultureTooltip,
      },
      {
        key: 'gold',
        icon: '💰',
        value: nationResources.gold,
        delta: nationResources.goldPerTurn,
        upkeep: unitUpkeep,
      },
      {
        key: 'influence',
        icon: '🕊️',
        value: nationResources.influence,
        delta: nationResources.influencePerTurn,
      },
    ];

    for (const resourceId of STRATEGIC_RESOURCE_IDS) {
      const quantity = this.resourceAccessSystem?.getResourceSourceCount(nationId, resourceId) ?? 0;
      if (quantity <= 0) continue;

      const resource = getNaturalResourceById(resourceId);
      entries.push({
        key: `strategic:${resourceId}`,
        icon: '',
        iconKey: resource?.iconKey,
        value: quantity,
        delta: 0,
        displayMode: 'valueOnly',
        tooltip: `${resource?.name ?? resourceId}: ${quantity}`,
      });
    }

    return entries;
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
      tooltip: getResearchTooltip(current?.name, this.researchSystem.getResearchProgress(nationId), currentCost),
      available: this.researchSystem.getAvailableTechnologies(nationId).map((technology) => ({
        id: technology.id,
        name: technology.name,
        era: technology.era,
        cost: this.researchSystem.getEffectiveCost(technology.id),
        description: technology.description,
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
        description: entry.node.description,
        imageKey: getCultureSpriteKey(entry.node.id),
        imagePath: getCultureSpritePath(entry.node.id),
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
      tooltip: getCultureTooltip(current?.name, this.cultureSystem.getCultureProgress(nationId), current ? this.cultureSystem.getEffectiveCost(current.id) : 0),
      eras: Array.from(eras.values()),
    };
  }
}

function formatEraName(era: string): string {
  return era.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getResearchTooltip(name: string | undefined, progress: number, cost: number): string {
  return name ? `Researching: ${name} (${progress}/${cost})` : 'Researching: None selected';
}

function getCultureTooltip(name: string | undefined, progress: number, cost: number): string {
  return name ? `Culture: ${name} (${progress}/${cost})` : 'Culture: None selected';
}
