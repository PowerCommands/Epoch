import type { Nation } from '../entities/Nation';
import type { City } from '../entities/City';
import type { CityBuildings } from '../entities/CityBuildings';
import type { MapData } from '../types/map';
import { calculateCityEconomy } from './CityEconomy';
import type { IGridSystem } from './grid/IGridSystem';

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
    gridSystem: IGridSystem,
  ): number;
  calculateCityFoodPerTurn(city: City, buildings: CityBuildings, mapData: MapData, gridSystem: IGridSystem): number;
  calculateCityProductionPerTurn(city: City, buildings: CityBuildings, mapData: MapData, gridSystem: IGridSystem): number;
  calculateCityGoldPerTurn(city: City, buildings: CityBuildings, mapData: MapData, gridSystem: IGridSystem): number;
  calculateCitySciencePerTurn(city: City, buildings: CityBuildings, mapData: MapData, gridSystem: IGridSystem): number;
  calculateCityCulturePerTurn(city: City, buildings: CityBuildings, mapData: MapData, gridSystem: IGridSystem): number;
  calculateCityHappinessPerTurn(city: City, buildings: CityBuildings, mapData: MapData, gridSystem: IGridSystem): number;
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
    gridSystem: IGridSystem,
  ): number {
    let total = 0;
    for (const city of cities) {
      total += this.calculateCityGoldPerTurn(city, buildingsLookup(city.id), mapData, gridSystem);
    }
    return total;
  }

  calculateCityFoodPerTurn(city: City, buildings: CityBuildings, mapData: MapData, gridSystem: IGridSystem): number {
    return calculateCityEconomy(city, mapData, buildings, gridSystem).food;
  }

  calculateCityProductionPerTurn(city: City, buildings: CityBuildings, mapData: MapData, gridSystem: IGridSystem): number {
    return calculateCityEconomy(city, mapData, buildings, gridSystem).production;
  }

  calculateCityGoldPerTurn(city: City, buildings: CityBuildings, mapData: MapData, gridSystem: IGridSystem): number {
    return calculateCityEconomy(city, mapData, buildings, gridSystem).gold;
  }

  calculateCitySciencePerTurn(city: City, buildings: CityBuildings, mapData: MapData, gridSystem: IGridSystem): number {
    return calculateCityEconomy(city, mapData, buildings, gridSystem).science;
  }

  calculateCityCulturePerTurn(city: City, buildings: CityBuildings, mapData: MapData, gridSystem: IGridSystem): number {
    return calculateCityEconomy(city, mapData, buildings, gridSystem).culture;
  }

  calculateCityHappinessPerTurn(city: City, buildings: CityBuildings, mapData: MapData, gridSystem: IGridSystem): number {
    return calculateCityEconomy(city, mapData, buildings, gridSystem).happiness;
  }
}
