import { TileType } from '../types/map';

export const TERRAIN_COLORS: Record<TileType, number> = {
  [TileType.NuclearWaste]: 0x8a942e,
  [TileType.Ocean]: 0x1a557d,
  [TileType.Coast]: 0x4f8da7,
  [TileType.Plains]: 0x83b865,
  [TileType.Forest]: 0x2f7440,
  [TileType.Mountain]: 0x777b7b,
  [TileType.Ice]: 0xc8e6e8,
  [TileType.Jungle]: 0x236f50,
  [TileType.Desert]: 0xcdb65e,
  [TileType.Beach]: 0xe4d6a0,
  [TileType.Meadow]: 0x9bcf74,
};
