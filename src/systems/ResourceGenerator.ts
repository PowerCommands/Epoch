import type { Nation } from '../entities/Nation';
import type { City } from '../entities/City';
import type { CityBuildings } from '../entities/CityBuildings';
import type { MapData } from '../types/map';
import { EMPTY_MODIFIERS, type ModifierSet } from '../types/modifiers';
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
    modifiers: Readonly<ModifierSet>,
  ): number;
  calculateCityFoodPerTurn(city: City, buildings: CityBuildings, mapData: MapData, gridSystem: IGridSystem, modifiers: Readonly<ModifierSet>): number;
  calculateCityProductionPerTurn(city: City, buildings: CityBuildings, mapData: MapData, gridSystem: IGridSystem, modifiers: Readonly<ModifierSet>): number;
  calculateCityGoldPerTurn(city: City, buildings: CityBuildings, mapData: MapData, gridSystem: IGridSystem, modifiers: Readonly<ModifierSet>): number;
  calculateCitySciencePerTurn(city: City, buildings: CityBuildings, mapData: MapData, gridSystem: IGridSystem, modifiers: Readonly<ModifierSet>): number;
  calculateCityCulturePerTurn(city: City, buildings: CityBuildings, mapData: MapData, gridSystem: IGridSystem, modifiers: Readonly<ModifierSet>): number;
  calculateCityHappinessPerTurn(city: City, buildings: CityBuildings, mapData: MapData, gridSystem: IGridSystem, modifiers: Readonly<ModifierSet>): number;
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
    modifiers: Readonly<ModifierSet> = EMPTY_MODIFIERS,
  ): number {
    let total = 0;
    for (const city of cities) {
      total += this.calculateCityGoldPerTurn(city, buildingsLookup(city.id), mapData, gridSystem, modifiers);
    }
    return total;
  }

  calculateCityFoodPerTurn(
    city: City,
    buildings: CityBuildings,
    mapData: MapData,
    gridSystem: IGridSystem,
    modifiers: Readonly<ModifierSet> = EMPTY_MODIFIERS,
  ): number {
    return calculateCityEconomy(city, mapData, buildings, gridSystem, modifiers).food;
  }

  calculateCityProductionPerTurn(
    city: City,
    buildings: CityBuildings,
    mapData: MapData,
    gridSystem: IGridSystem,
    modifiers: Readonly<ModifierSet> = EMPTY_MODIFIERS,
  ): number {
    return calculateCityEconomy(city, mapData, buildings, gridSystem, modifiers).production;
  }

  calculateCityGoldPerTurn(
    city: City,
    buildings: CityBuildings,
    mapData: MapData,
    gridSystem: IGridSystem,
    modifiers: Readonly<ModifierSet> = EMPTY_MODIFIERS,
  ): number {
    return calculateCityEconomy(city, mapData, buildings, gridSystem, modifiers).gold;
  }

  calculateCitySciencePerTurn(
    city: City,
    buildings: CityBuildings,
    mapData: MapData,
    gridSystem: IGridSystem,
    modifiers: Readonly<ModifierSet> = EMPTY_MODIFIERS,
  ): number {
    return calculateCityEconomy(city, mapData, buildings, gridSystem, modifiers).science;
  }

  calculateCityCulturePerTurn(
    city: City,
    buildings: CityBuildings,
    mapData: MapData,
    gridSystem: IGridSystem,
    modifiers: Readonly<ModifierSet> = EMPTY_MODIFIERS,
  ): number {
    return calculateCityEconomy(city, mapData, buildings, gridSystem, modifiers).culture;
  }

  calculateCityHappinessPerTurn(
    city: City,
    buildings: CityBuildings,
    mapData: MapData,
    gridSystem: IGridSystem,
    modifiers: Readonly<ModifierSet> = EMPTY_MODIFIERS,
  ): number {
    return calculateCityEconomy(city, mapData, buildings, gridSystem, modifiers).happiness;
  }
}
