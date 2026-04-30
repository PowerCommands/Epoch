import type { City } from '../entities/City';
import type { UnitType } from '../entities/UnitType';
import { TileType, type MapData } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';
import type { StrategicResourceCapacitySystem } from './StrategicResourceCapacitySystem';

export interface UnitProductionRuleContext {
  strategicResourceCapacitySystem?: StrategicResourceCapacitySystem;
}

export function cityHasWaterTile(
  city: City,
  mapData: MapData,
): boolean {
  return city.ownedTileCoords.some(({ x, y }) => {
    const tile = mapData.tiles[y]?.[x];
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
    if (!cityHasWaterTile(city, mapData)) return 'Requires city-owned water tile';
  }

  return context.strategicResourceCapacitySystem?.getMissingRequirementReason(city.ownerId, unitType);
}
