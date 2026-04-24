import type { City } from '../entities/City';
import type { UnitType } from '../entities/UnitType';
import { TileType, type MapData } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';

export function hasAdjacentWater(
  city: City,
  mapData: MapData,
  gridSystem: IGridSystem,
): boolean {
  return gridSystem
    .getAdjacentCoords({ x: city.tileX, y: city.tileY })
    .some((coord) => {
      const tile = mapData.tiles[coord.y]?.[coord.x];
      return tile?.type === TileType.Coast || tile?.type === TileType.Ocean;
    });
}

export function canCityProduceUnit(
  city: City,
  unitType: UnitType,
  mapData: MapData,
  gridSystem: IGridSystem,
): boolean {
  if (unitType.isNaval === true) {
    return hasAdjacentWater(city, mapData, gridSystem);
  }

  return true;
}
