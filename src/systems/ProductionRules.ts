import type { City } from '../entities/City';
import type { UnitType } from '../entities/UnitType';
import { TileType, type MapData } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';
import type { StrategicResourceCapacitySystem } from './StrategicResourceCapacitySystem';

export interface UnitProductionRuleContext {
  strategicResourceCapacitySystem?: StrategicResourceCapacitySystem;
}

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
  context: UnitProductionRuleContext = {},
): boolean {
  return getCityUnitProductionBlockReason(city, unitType, mapData, gridSystem, context) === undefined;
}

export function getCityUnitProductionBlockReason(
  city: City,
  unitType: UnitType,
  mapData: MapData,
  gridSystem: IGridSystem,
  context: UnitProductionRuleContext = {},
): string | undefined {
  if (unitType.isNaval === true) {
    if (!hasAdjacentWater(city, mapData, gridSystem)) return 'Requires adjacent water';
  }

  return context.strategicResourceCapacitySystem?.getMissingRequirementReason(city.ownerId, unitType);
}
