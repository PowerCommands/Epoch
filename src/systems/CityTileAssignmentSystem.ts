import type { City } from '../entities/City';
import type { MapData } from '../types/map';
import { CityTerritorySystem } from './CityTerritorySystem';

export class CityTileAssignmentSystem {
  private readonly cityTerritorySystem = new CityTerritorySystem();

  updateWorkedTiles(city: City, mapData: MapData): void {
    this.cityTerritorySystem.updateWorkedTiles(city, mapData);
  }
}
