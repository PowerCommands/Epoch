import type { City } from '../entities/City';
import type { UnitManager } from './UnitManager';
import type { WonderSystem } from './WonderSystem';

export const LEADER_RESIDENCE_DEFENSE_BONUS = 0.5;
export const WORLD_HERITAGE_DEFENSE_BONUS = 0.25;

export class CityDefenseSystem {
  private worldHeritageProtectionActive = false;

  constructor(
    private readonly unitManager: UnitManager,
    private readonly wonderSystem?: WonderSystem,
  ) {}

  getLeaderDefenseBonus(city: City): number {
    if (!city.isResidenceCapital) return 0;
    const leader = this.unitManager.getUnitsByOwner(city.ownerId).find((unit) => (
      unit.unitType.id === 'leader' &&
      unit.tileX === city.tileX &&
      unit.tileY === city.tileY
    ));
    return leader ? LEADER_RESIDENCE_DEFENSE_BONUS : 0;
  }

  setWorldHeritageProtectionActive(active: boolean): void {
    this.worldHeritageProtectionActive = active;
  }

  getWorldHeritageDefenseBonus(city: City): number {
    if (!this.worldHeritageProtectionActive || !this.wonderSystem) return 0;
    const hasProtectedWonder = this.wonderSystem
      .getCompletedWondersForCity(city.id)
      .some((wonder) => !wonder.broken);
    return hasProtectedWonder ? WORLD_HERITAGE_DEFENSE_BONUS : 0;
  }
}
