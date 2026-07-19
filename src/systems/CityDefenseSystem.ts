import type { City } from '../entities/City';
import type { WonderSystem } from './WonderSystem';

export const WORLD_HERITAGE_DEFENSE_BONUS = 0.25;

export class CityDefenseSystem {
  private worldHeritageProtectionActive = false;

  constructor(
    private readonly wonderSystem?: WonderSystem,
  ) {}

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
