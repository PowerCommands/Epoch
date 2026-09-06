import { MUSEUM, getBuildingById } from '../data/buildings';
import {
  getNaturalResourceById,
  getNaturalResourceImprovementIdForTile,
} from '../data/naturalResources';
import type { CityManager } from './CityManager';
import { getImprovementOwnerId } from './ImprovementOwnership';
import type { MapData } from '../types/map';
import { getCityIntegrationProgress } from './CityIntegrationSystem';

export interface ArchaeologicalCultureSummary {
  /** A currently working Museum exists in at least one owned city. */
  readonly hasFunctioningMuseum: boolean;
  /** Number of controlled sites with their resource's completed improvement. */
  readonly exploitedSiteCount: number;
  /** Sum of eligible resource metadata before the Museum prerequisite/modifiers. */
  readonly potentialCulturePerTurn: number;
  /** Enabled flat Culture before normal Culture percentage modifiers. */
  readonly baseCulturePerTurn: number;
}

/**
 * Derives a nation's archaeological Culture from live map and city state.
 * Nothing here is persisted: ownership, completed improvements, and working
 * Museums remain the authoritative state after conquest, sabotage, and load.
 */
export class ArchaeologicalCultureSystem {
  constructor(
    private readonly mapData: MapData,
    private readonly cityManager: CityManager,
    private readonly getCurrentRound: () => number = () => 0,
  ) {}

  calculateForNation(nationId: string): ArchaeologicalCultureSummary {
    const hasFunctioningMuseum = this.cityManager.getCitiesByOwner(nationId)
      .some((city) => (
        getCityIntegrationProgress(city, this.getCurrentRound()).state !== 'occupied'
        && this.cityManager.getBuildings(city.id).hasActive(MUSEUM.id)
      ));

    let exploitedSiteCount = 0;
    let potentialCulturePerTurn = 0;
    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (!tile.resourceId) continue;
        const resource = getNaturalResourceById(tile.resourceId);
        if (resource?.archaeological !== true) continue;

        // Each resource identifies its own completed excavation improvement.
        const requiredImprovementId = getNaturalResourceImprovementIdForTile(resource, tile.type);
        if (!requiredImprovementId || tile.improvementId !== requiredImprovementId) continue;
        if (getImprovementOwnerId(tile) !== nationId) continue;

        exploitedSiteCount += 1;
        potentialCulturePerTurn += resource.archaeologicalCultureValue ?? 0;
      }
    }

    return {
      hasFunctioningMuseum,
      exploitedSiteCount,
      potentialCulturePerTurn,
      baseCulturePerTurn: hasFunctioningMuseum ? potentialCulturePerTurn : 0,
    };
  }
}

/** Apply active building percentages in the same order/flooring as CityEconomy. */
export function applyBuildingCulturePercentages(
  culture: number,
  nationId: string,
  cityManager: CityManager,
  currentRound = 0,
): number {
  let result = culture;
  for (const city of cityManager.getCitiesByOwner(nationId)) {
    if (getCityIntegrationProgress(city, currentRound).state === 'occupied') continue;
    for (const buildingId of cityManager.getBuildings(city.id).getAll()) {
      const percent = getBuildingById(buildingId)?.modifiers.culturePercent;
      if (percent !== undefined) result = Math.floor(result * (1 + percent / 100));
    }
  }
  return result;
}
