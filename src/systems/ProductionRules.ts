import type { City } from '../entities/City';
import type { UnitType } from '../entities/UnitType';
import { TileType, type MapData } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';
import type { StrategicResourceCapacitySystem } from './StrategicResourceCapacitySystem';

export interface UnitProductionRuleContext {
  strategicResourceCapacitySystem?: StrategicResourceCapacitySystem;
  unitUpkeepAffordability?: {
    getUnitUpkeepAffordabilityReason(nationId: string, unitType: UnitType, turns: number): string | undefined;
  };
  upkeepAffordabilityTurns?: number;
  hasActiveUnitOfType?: (nationId: string, unitTypeId: string) => boolean;
  isResidenceCapital?: (city: City) => boolean;
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
  if (unitType.uniquePerNation === true && context.hasActiveUnitOfType?.(city.ownerId, unitType.id)) {
    return `Only one ${unitType.name} may be active`;
  }

  if (unitType.residenceCapitalOnly === true && context.isResidenceCapital?.(city) !== true) {
    return `${unitType.name} may only be produced in the residence capital`;
  }

  if (unitType.isNaval === true) {
    if (!cityHasWaterTile(city, mapData)) return 'Requires city-owned water tile';
  }

  const resourceReason = context.strategicResourceCapacitySystem?.getMissingRequirementReason(city.ownerId, unitType);
  if (resourceReason) return resourceReason;

  return context.unitUpkeepAffordability?.getUnitUpkeepAffordabilityReason(
    city.ownerId,
    unitType,
    context.upkeepAffordabilityTurns ?? 10,
  );
}
