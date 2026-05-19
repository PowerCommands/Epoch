import type { CityManager } from './CityManager';
import type { IGridSystem } from './grid/IGridSystem';

const FREE_CITY_COUNT = 3;
const DISTANCE_THRESHOLD = 12;
const DISTANCE_STEP = 6;

export class ImperialOverstretchSystem {
  constructor(
    private readonly cityManager: CityManager,
    private readonly gridSystem: IGridSystem,
  ) {}

  getCityCountPressure(nationId: string): number {
    const cityCount = this.cityManager.getCitiesByOwner(nationId).length;
    return Math.max(0, cityCount - FREE_CITY_COUNT);
  }

  getDistancePressure(nationId: string): number {
    const capital = this.cityManager.getResidenceCapital(nationId);
    if (!capital) return 0;

    const capitalCoord = { x: capital.tileX, y: capital.tileY };
    let total = 0;

    for (const city of this.cityManager.getCitiesByOwner(nationId)) {
      if (city.id === capital.id) continue;
      const dist = this.gridSystem.getDistance(capitalCoord, { x: city.tileX, y: city.tileY });
      if (dist > DISTANCE_THRESHOLD) {
        total += Math.floor((dist - DISTANCE_THRESHOLD) / DISTANCE_STEP);
      }
    }

    return total;
  }
}
