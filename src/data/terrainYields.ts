import { TileType } from '../types/map';

export interface TileYield {
  food: number;
  production: number;
  gold: number;
}

export const TERRAIN_YIELDS: Record<TileType, TileYield> = {
  [TileType.Plains]: { food: 2, production: 1, gold: 0 },
  [TileType.Forest]: { food: 1, production: 2, gold: 0 },
  [TileType.Mountain]: { food: 0, production: 1, gold: 0 },
  [TileType.Ice]: { food: 0, production: 0, gold: 0 },
  [TileType.Jungle]: { food: 1, production: 1, gold: 0 },
  [TileType.Desert]: { food: 0, production: 0, gold: 0 },
  [TileType.Coast]: { food: 2, production: 1, gold: 1 },
  [TileType.Ocean]: { food: 1, production: 0, gold: 0 },
};

export function getTerrainYield(tileType: TileType): TileYield {
  return TERRAIN_YIELDS[tileType];
}
