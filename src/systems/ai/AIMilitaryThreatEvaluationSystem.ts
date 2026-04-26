import type { City } from '../../entities/City';
import type { CityManager } from '../CityManager';
import type { IGridSystem } from '../grid/IGridSystem';
import type { UnitManager } from '../UnitManager';

export type ThreatLevel =
  | 'none'
  | 'low'
  | 'medium'
  | 'high';

const CAPITAL_THREAT_DISTANCE = 3;
const CITY_THREAT_DISTANCE = 3;
const EXTENDED_THREAT_DISTANCE = 6;

// Threat evaluation measures how close enemy forces are to cities.
// This complements military strength by adding geographic awareness.
export class AIMilitaryThreatEvaluationSystem {
  constructor(
    private readonly unitManager: UnitManager,
    private readonly cityManager: CityManager,
    private readonly mapSystem: IGridSystem,
  ) {}

  getThreatLevel(nationId: string, otherNationId: string): ThreatLevel {
    if (this.isCapitalThreatenedBy(nationId, otherNationId)) return 'high';
    if (this.isAnyCityThreatenedBy(nationId, otherNationId)) return 'medium';
    if (this.isEnemyWithinExtendedRange(nationId, otherNationId)) return 'low';
    return 'none';
  }

  isCapitalThreatened(nationId: string): boolean {
    return this.isCapitalThreatenedBy(nationId);
  }

  isAnyCityThreatened(nationId: string): boolean {
    return this.isAnyCityThreatenedBy(nationId);
  }

  private isCapitalThreatenedBy(nationId: string, otherNationId?: string): boolean {
    const capital = this.getCapital(nationId);
    if (!capital) return false;

    for (const unit of this.getThreateningUnits(nationId, otherNationId)) {
      const distance = this.mapSystem.getDistance(
        { x: unit.tileX, y: unit.tileY },
        { x: capital.tileX, y: capital.tileY },
      );
      if (distance <= CAPITAL_THREAT_DISTANCE) return true;
    }

    return false;
  }

  private isAnyCityThreatenedBy(nationId: string, otherNationId?: string): boolean {
    const cities = this.cityManager.getCitiesByOwner(nationId);
    if (cities.length === 0) return false;

    for (const unit of this.getThreateningUnits(nationId, otherNationId)) {
      for (const city of cities) {
        const distance = this.mapSystem.getDistance(
          { x: unit.tileX, y: unit.tileY },
          { x: city.tileX, y: city.tileY },
        );
        if (distance <= CITY_THREAT_DISTANCE) return true;
      }
    }

    return false;
  }

  private isEnemyWithinExtendedRange(nationId: string, otherNationId: string): boolean {
    const cities = this.cityManager.getCitiesByOwner(nationId);
    if (cities.length === 0) return false;

    for (const unit of this.getThreateningUnits(nationId, otherNationId)) {
      if (this.getMinimumDistanceToCities(unit, cities) <= EXTENDED_THREAT_DISTANCE) {
        return true;
      }
    }

    return false;
  }

  private getCapital(nationId: string): City | undefined {
    const cities = this.cityManager.getCitiesByOwner(nationId);
    return cities.find((city) => city.isCapital) ?? cities[0];
  }

  private getThreateningUnits(nationId: string, otherNationId?: string) {
    if (otherNationId !== undefined) {
      return this.unitManager.getUnitsByOwner(otherNationId);
    }
    return this.unitManager.getAllUnits().filter((unit) => unit.ownerId !== nationId);
  }

  private getMinimumDistanceToCities(
    unit: { tileX: number; tileY: number },
    cities: readonly City[],
  ): number {
    let minimumDistance = Infinity;
    for (const city of cities) {
      const distance = this.mapSystem.getDistance(
        { x: unit.tileX, y: unit.tileY },
        { x: city.tileX, y: city.tileY },
      );
      if (distance < minimumDistance) minimumDistance = distance;
    }
    return minimumDistance;
  }
}
