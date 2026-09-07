import { getBuildingById } from '../data/buildings';
import { getWonderById } from '../data/wonders';
import type { MapData } from '../types/map';
import type { CityManager } from './CityManager';
import type { CovertDetectionSource } from './HumanUnitVisibility';
import type { RangedVisibilitySource } from './VisibilitySystem';
import type { WonderSystem } from './WonderSystem';

export interface StructureObservationSource extends RangedVisibilitySource, CovertDetectionSource {}

/** Derives active observation sources from canonical structure, location and ownership state. */
export class StructureObservationSystem {
  constructor(
    private readonly mapData: MapData,
    private readonly cityManager: CityManager,
    private readonly wonderSystem: WonderSystem,
  ) {}

  getSourcesForNation(nationId: string): StructureObservationSource[] {
    const sources: StructureObservationSource[] = [];
    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      const buildings = this.cityManager.getBuildings(city.id);
      for (const coord of city.ownedTileCoords) {
        const buildingId = this.mapData.tiles[coord.y]?.[coord.x]?.buildingId;
        if (!buildingId || !buildings.hasActive(buildingId)) continue;
        const building = getBuildingById(buildingId);
        if (building?.visibilityRadius === undefined || building.covertDetectionRadius === undefined) continue;
        sources.push({
          tileX: coord.x,
          tileY: coord.y,
          visibilityRadius: building.visibilityRadius,
          covertDetectionRadius: building.covertDetectionRadius,
        });
      }
    }

    for (const state of this.wonderSystem.getCompletedWonders()) {
      if (state.broken || state.tileX === undefined || state.tileY === undefined) continue;
      const hostCity = this.cityManager.getCity(state.cityId);
      if (!hostCity || hostCity.ownerId !== nationId) continue;
      const wonder = getWonderById(state.wonderId);
      if (wonder?.visibilityRadius === undefined || wonder.covertDetectionRadius === undefined) continue;
      sources.push({
        tileX: state.tileX,
        tileY: state.tileY,
        visibilityRadius: wonder.visibilityRadius,
        covertDetectionRadius: wonder.covertDetectionRadius,
      });
    }
    return sources;
  }
}
