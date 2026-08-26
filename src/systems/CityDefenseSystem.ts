import type { City } from '../entities/City';
import type { CityBuildings } from '../entities/CityBuildings';
import { CITY_BASE_DEFENSE } from '../data/cities';
import { getBuildingById } from '../data/buildings';
import type { CityManager } from './CityManager';
import type { WonderSystem } from './WonderSystem';

export const WORLD_HERITAGE_DEFENSE_BONUS = 0.25;
export const CITY_FORTIFICATION_BUILDING_IDS = ['walls', 'castle', 'arsenal'] as const;

export function getCityFortificationLevel(
  buildings: Pick<CityBuildings, 'hasActive'>,
): 0 | 1 | 2 | 3 {
  const level = CITY_FORTIFICATION_BUILDING_IDS.reduce(
    (total, buildingId) => total + Number(buildings.hasActive(buildingId)),
    0,
  );
  return level as 0 | 1 | 2 | 3;
}

export class CityDefenseSystem {
  private worldHeritageProtectionActive = false;

  constructor(
    private readonly wonderSystem?: WonderSystem,
    private readonly cityManager?: CityManager,
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

  /** Additive percentage supplied by active, city-bound fortifications. */
  getFortificationDefensePercent(city: City): number {
    const buildings = this.cityManager?.getBuildings(city.id);
    if (!buildings) return 0;
    return buildings.getAll().reduce(
      (total, buildingId) => total + (getBuildingById(buildingId)?.modifiers.cityDefensePercent ?? 0),
      0,
    );
  }

  getFortificationLevel(city: City): 0 | 1 | 2 | 3 {
    const buildings = this.cityManager?.getBuildings(city.id);
    return buildings ? getCityFortificationLevel(buildings) : 0;
  }

  getDefenseMultiplier(city: City): number {
    return 1
      + this.getFortificationDefensePercent(city) / 100
      + this.getWorldHeritageDefenseBonus(city);
  }

  getDamageTakenMultiplier(city: City): number {
    return 1 / this.getDefenseMultiplier(city);
  }

  getEffectiveDefense(city: City, flatDefenseBonus = 0): number {
    return Math.max(1, Math.floor((CITY_BASE_DEFENSE + flatDefenseBonus) * this.getDefenseMultiplier(city)));
  }
}
