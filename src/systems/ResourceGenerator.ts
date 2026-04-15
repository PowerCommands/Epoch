import type { Nation } from '../entities/Nation';
import type { City } from '../entities/City';
import type { CityBuildings } from '../entities/CityBuildings';
import { getBuildingById } from '../data/buildings';

/**
 * Interface for resource generation. Pluggable — swap implementation
 * without touching ResourceSystem.
 */
export interface IResourceGenerator {
  calculateNationGoldPerTurn(
    nation: Nation,
    cities: City[],
    buildingsLookup: (cityId: string) => CityBuildings,
  ): number;
  calculateCityFoodPerTurn(city: City, buildings: CityBuildings): number;
  calculateCityProductionPerTurn(city: City, buildings: CityBuildings): number;
}

/**
 * Simple implementation: flat amount per city + building modifiers.
 */
export class FlatResourceGenerator implements IResourceGenerator {
  static readonly GOLD_PER_CITY = 3;
  static readonly FOOD_PER_CITY = 2;
  static readonly PRODUCTION_PER_CITY = 2;

  calculateNationGoldPerTurn(
    _nation: Nation,
    cities: City[],
    buildingsLookup: (cityId: string) => CityBuildings,
  ): number {
    let total = cities.length * FlatResourceGenerator.GOLD_PER_CITY;
    for (const city of cities) {
      const b = buildingsLookup(city.id);
      for (const id of b.getAll()) {
        const def = getBuildingById(id);
        if (def?.modifiers.goldPerTurn) total += def.modifiers.goldPerTurn;
      }
    }
    return total;
  }

  calculateCityFoodPerTurn(_city: City, buildings: CityBuildings): number {
    let base = FlatResourceGenerator.FOOD_PER_CITY;
    for (const id of buildings.getAll()) {
      const b = getBuildingById(id);
      if (b?.modifiers.foodPerTurn) base += b.modifiers.foodPerTurn;
    }
    return base;
  }

  calculateCityProductionPerTurn(_city: City, buildings: CityBuildings): number {
    let base = FlatResourceGenerator.PRODUCTION_PER_CITY;
    for (const id of buildings.getAll()) {
      const b = getBuildingById(id);
      if (b?.modifiers.productionPerTurn) base += b.modifiers.productionPerTurn;
    }
    return base;
  }
}
