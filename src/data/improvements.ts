import { TileType } from '../types/map';
import type { TileYield } from './terrainYields';

export interface TileImprovementDefinition {
  id: string;
  name: string;
  allowedTileTypes: TileType[];
  yieldBonus: TileYield;
  /** Fixed build duration; omitted improvements retain the normal era scale. */
  buildTurns?: number;
  /** Capability required instead of the ordinary Worker build capability. */
  requiredBuilderCapability?: string;
  /**
   * When set, the capable builder must be cargo aboard this unit type. The
   * carrier is the unit that supplies movement and remains on the target tile.
   */
  requiredCargoTransportUnitTypeId?: string;
  /** Optional map sprite loaded from assets/sprites/improvements/{id}.png. */
  spriteKey?: string;
}

export const FARM: TileImprovementDefinition = {
  id: 'farm',
  name: 'Farm',
  allowedTileTypes: [TileType.Plains, TileType.Beach, TileType.Meadow],
  yieldBonus: { food: 2, production: 0, gold: 0 },
};

export const LUMBER_MILL: TileImprovementDefinition = {
  id: 'lumber_mill',
  name: 'LumberMill',
  allowedTileTypes: [TileType.Forest],
  yieldBonus: { food: 0, production: 2, gold: 0 },
};

export const PLANTATION: TileImprovementDefinition = {
  id: 'plantation',
  name: 'Plantation',
  allowedTileTypes: [TileType.Plains, TileType.Beach, TileType.Meadow, TileType.Forest, TileType.Jungle],
  yieldBonus: { food: 2, production: 0, gold: 0 },
};

export const MINE: TileImprovementDefinition = {
  id: 'mine',
  name: 'Mine',
  allowedTileTypes: [TileType.Plains, TileType.Beach, TileType.Meadow, TileType.Forest, TileType.Mountain, TileType.Ice, TileType.Desert],
  yieldBonus: { food: 0, production: 2, gold: 0 },
};

export const PASTURE: TileImprovementDefinition = {
  id: 'pasture',
  name: 'Pasture',
  allowedTileTypes: [TileType.Plains, TileType.Beach, TileType.Meadow, TileType.Forest, TileType.Desert],
  yieldBonus: { food: 1, production: 1, gold: 0 },
};

export const OIL_WELL: TileImprovementDefinition = {
  id: 'oil_well',
  name: 'Oil Well',
  allowedTileTypes: [TileType.Plains, TileType.Beach, TileType.Meadow, TileType.Desert, TileType.Ice],
  yieldBonus: { food: 0, production: 3, gold: 0 },
};

export const FISHING_BOATS: TileImprovementDefinition = {
  id: 'fishing_boats',
  name: 'Fishing Boats',
  allowedTileTypes: [TileType.Coast, TileType.Ocean],
  yieldBonus: { food: 2, production: 0, gold: 1 },
};

export const OFFSHORE_PLATFORM: TileImprovementDefinition = {
  id: 'offshore_platform',
  name: 'Offshore Platform',
  allowedTileTypes: [TileType.Coast, TileType.Ocean],
  yieldBonus: { food: 0, production: 4, gold: 0 },
};

export const ARCHAEOLOGICAL_DIG: TileImprovementDefinition = {
  id: 'archaeological_dig',
  name: 'Archaeological Dig',
  allowedTileTypes: [
    TileType.Plains,
    TileType.Meadow,
    TileType.Desert,
    TileType.Forest,
    TileType.Beach,
    TileType.Mountain,
  ],
  yieldBonus: { food: 0, production: 0, gold: 0 },
  buildTurns: 3,
  requiredBuilderCapability: 'dig',
  spriteKey: 'improvement_archaeological_dig',
};

export const UNDERWATER_ARCHAEOLOGICAL_SITE: TileImprovementDefinition = {
  id: 'underwater_archaeological_site',
  name: 'Underwater Archaeological Site',
  allowedTileTypes: [TileType.Coast, TileType.Ocean],
  yieldBonus: { food: 0, production: 0, gold: 0 },
  buildTurns: 4,
  requiredBuilderCapability: 'dig',
  requiredCargoTransportUnitTypeId: 'transport_ship',
  spriteKey: 'improvement_underwater_archaeological_site',
};

export const ALL_IMPROVEMENTS: TileImprovementDefinition[] = [
  FARM,
  LUMBER_MILL,
  PLANTATION,
  MINE,
  PASTURE,
  OIL_WELL,
  FISHING_BOATS,
  OFFSHORE_PLATFORM,
  ARCHAEOLOGICAL_DIG,
  UNDERWATER_ARCHAEOLOGICAL_SITE,
];

export function getImprovementById(id: string): TileImprovementDefinition | undefined {
  return ALL_IMPROVEMENTS.find((improvement) => improvement.id === id);
}

export function getImprovementForTileType(tileType: TileType): TileImprovementDefinition | undefined {
  return ALL_IMPROVEMENTS.find((improvement) => improvement.allowedTileTypes.includes(tileType));
}
