import type { City } from '../entities/City';
import type { UnitType } from '../entities/UnitType';
import type { Era } from '../data/technologies';
import { TileType, type MapData } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';
import type { StrategicResourceCapacitySystem } from './StrategicResourceCapacitySystem';
import { getEraRank } from './EraSystem';

export interface UnitProductionRuleContext {
  strategicResourceCapacitySystem?: StrategicResourceCapacitySystem;
  unitUpkeepAffordability?: {
    getUnitUpkeepAffordabilityReason(nationId: string, unitType: UnitType, turns: number): string | undefined;
  };
  upkeepAffordabilityTurns?: number;
  hasActiveUnitOfType?: (nationId: string, unitTypeId: string) => boolean;
  isResidenceCapital?: (city: City) => boolean;
  getNationEra?: (nationId: string) => Era;
  getUnitProductionRestrictionReason?: (nationId: string, unitTypeId: string) => string | undefined;
}

const ERA_OBSOLESCENCE_GRACE = 1;
const ERA_OBSOLESCENCE_MILITARY_CATEGORIES = new Set<UnitType['category']>([
  'melee',
  'ranged',
  'mounted',
  'siege',
  'naval_melee',
  'naval_ranged',
  'air',
]);

export function isUnitObsoleteForNationEra(
  unitEra: Era,
  nationEra: Era,
): boolean {
  return getEraRank(unitEra) < getEraRank(nationEra) - ERA_OBSOLESCENCE_GRACE;
}

export function isMilitaryProductionUnit(unitType: UnitType): boolean {
  return ERA_OBSOLESCENCE_MILITARY_CATEGORIES.has(unitType.category);
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

  const productionRestrictionReason = context.getUnitProductionRestrictionReason?.(city.ownerId, unitType.id);
  if (productionRestrictionReason) return productionRestrictionReason;

  const nationEra = context.getNationEra?.(city.ownerId);
  if (
    nationEra !== undefined &&
    isMilitaryProductionUnit(unitType) &&
    isUnitObsoleteForNationEra(unitType.era, nationEra)
  ) {
    return `${unitType.name} is obsolete for ${nationEra} era production`;
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
