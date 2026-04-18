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
  allowedTileTypes: [TileType.Jungle],
  yieldBonus: { food: 2, production: 0, gold: 0 },
};

export const MINE: TileImprovementDefinition = {
  id: 'mine',
  name: 'Mine',
  allowedTileTypes: [TileType.Mountain],
  yieldBonus: { food: 0, production: 2, gold: 0 },
};

export const ALL_IMPROVEMENTS: TileImprovementDefinition[] = [
  FARM,
  LUMBER_MILL,
  PLANTATION,
  MINE,
];

export function getImprovementById(id: string): TileImprovementDefinition | undefined {
  return ALL_IMPROVEMENTS.find((improvement) => improvement.id === id);
}

export function getImprovementForTileType(tileType: TileType): TileImprovementDefinition | undefined {
  return ALL_IMPROVEMENTS.find((improvement) => improvement.allowedTileTypes.includes(tileType));
}
