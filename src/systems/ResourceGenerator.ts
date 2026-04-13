import type { Nation } from '../entities/Nation';
import type { City } from '../entities/City';

/**
 * Interface för resursgenerering. Pluggbart — byt ut implementationen
 * utan att röra ResourceSystem.
 *
 * En framtida TileBasedResourceGenerator kan titta på omgivande terräng.
 */
export interface IResourceGenerator {
  calculateNationGoldPerTurn(nation: Nation, cities: City[]): number;
  calculateCityFoodPerTurn(city: City): number;
  calculateCityProductionPerTurn(city: City): number;
}

/**
 * Enkel implementation: fast mängd per stad.
 */
export class FlatResourceGenerator implements IResourceGenerator {
  private static readonly GOLD_PER_CITY = 3;
  private static readonly FOOD_PER_CITY = 2;
  private static readonly PRODUCTION_PER_CITY = 2;

  calculateNationGoldPerTurn(_nation: Nation, cities: City[]): number {
    return cities.length * FlatResourceGenerator.GOLD_PER_CITY;
  }

  calculateCityFoodPerTurn(_city: City): number {
    return FlatResourceGenerator.FOOD_PER_CITY;
  }

  calculateCityProductionPerTurn(_city: City): number {
    return FlatResourceGenerator.PRODUCTION_PER_CITY;
  }
}
