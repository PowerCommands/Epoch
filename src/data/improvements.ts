import { TileType } from '../types/map';
import type { TileYield } from './terrainYields';

export interface TileImprovementDefinition {
  id: string;
  name: string;
  allowedTileTypes: TileType[];
  yieldBonus: TileYield;
}

export const FARM: TileImprovementDefinition = {
  id: 'farm',
  name: 'Farm',
  allowedTileTypes: [TileType.Plains],
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
  allowedTileTypes: [TileType.Plains, TileType.Forest, TileType.Jungle],
  yieldBonus: { food: 2, production: 0, gold: 0 },
};

export const MINE: TileImprovementDefinition = {
  id: 'mine',
  name: 'Mine',
  allowedTileTypes: [TileType.Plains, TileType.Forest, TileType.Mountain, TileType.Ice, TileType.Desert],
  yieldBonus: { food: 0, production: 2, gold: 0 },
};

export const PASTURE: TileImprovementDefinition = {
  id: 'pasture',
  name: 'Pasture',
  allowedTileTypes: [TileType.Plains, TileType.Forest],
  yieldBonus: { food: 1, production: 1, gold: 0 },
};

export const OIL_WELL: TileImprovementDefinition = {
  id: 'oil_well',
  name: 'Oil Well',
  allowedTileTypes: [TileType.Plains, TileType.Desert, TileType.Ice],
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

export const ALL_IMPROVEMENTS: TileImprovementDefinition[] = [
  FARM,
  LUMBER_MILL,
  PLANTATION,
  MINE,
  PASTURE,
  OIL_WELL,
  FISHING_BOATS,
  OFFSHORE_PLATFORM,
];

export function getImprovementById(id: string): TileImprovementDefinition | undefined {
  return ALL_IMPROVEMENTS.find((improvement) => improvement.id === id);
}

export function getImprovementForTileType(tileType: TileType): TileImprovementDefinition | undefined {
  return ALL_IMPROVEMENTS.find((improvement) => improvement.allowedTileTypes.includes(tileType));
}
