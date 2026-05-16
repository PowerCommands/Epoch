import type { City } from '../entities/City';
import type { UnitManager } from './UnitManager';

export const LEADER_RESIDENCE_DEFENSE_BONUS = 0.5;

export class CityDefenseSystem {
  constructor(private readonly unitManager: UnitManager) {}

  getLeaderDefenseBonus(city: City): number {
    if (!city.isResidenceCapital) return 0;
    const leader = this.unitManager.getUnitsByOwner(city.ownerId).find((unit) => (
      unit.unitType.id === 'leader' &&
      unit.tileX === city.tileX &&
      unit.tileY === city.tileY
    ));
    return leader ? LEADER_RESIDENCE_DEFENSE_BONUS : 0;
  }
}
