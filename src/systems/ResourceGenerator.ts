import type { Nation } from '../entities/Nation';
import type { City } from '../entities/City';
import type { CityBuildings } from '../entities/CityBuildings';
import type { MapData } from '../types/map';
import { calculateCityEconomy } from './CityEconomy';

/**
 * Interface for resource generation. Pluggable — swap implementation
 * without touching ResourceSystem.
 */
export interface IResourceGenerator {
  calculateNationGoldPerTurn(
    nation: Nation,
    cities: City[],
    buildingsLookup: (cityId: string) => CityBuildings,
    mapData: MapData,
  ): number;
  calculateCityFoodPerTurn(city: City, buildings: CityBuildings, mapData: MapData): number;
  calculateCityProductionPerTurn(city: City, buildings: CityBuildings, mapData: MapData): number;
  calculateCityGoldPerTurn(city: City, buildings: CityBuildings, mapData: MapData): number;
}

/**
 * Simple map-driven implementation: city output comes from worked local tiles
 * plus building modifiers.
 */
export class TileResourceGenerator implements IResourceGenerator {
  calculateNationGoldPerTurn(
    _nation: Nation,
    cities: City[],
    buildingsLookup: (cityId: string) => CityBuildings,
    mapData: MapData,
  ): number {
    let total = 0;
    for (const city of cities) {
      total += this.calculateCityGoldPerTurn(city, buildingsLookup(city.id), mapData);
    }
    return total;
  }

  calculateCityFoodPerTurn(city: City, buildings: CityBuildings, mapData: MapData): number {
    return calculateCityEconomy(city, mapData, buildings).food;
  }

  calculateCityProductionPerTurn(city: City, buildings: CityBuildings, mapData: MapData): number {
    return calculateCityEconomy(city, mapData, buildings).production;
  }

  calculateCityGoldPerTurn(city: City, buildings: CityBuildings, mapData: MapData): number {
    return calculateCityEconomy(city, mapData, buildings).gold;
  }
}
