import { MapData, TileType } from '../types/map';

const DEFAULT_TERRAIN_TEXTURES: Record<TileType, string> = {
  [TileType.Ocean]: 'terrain_ocean',
  [TileType.Coast]: 'terrain_coast',
  [TileType.Plains]: 'terrain_plains',
  [TileType.Forest]: 'terrain_forest',
  [TileType.Mountain]: 'terrain_mountain',
  [TileType.Ice]: 'terrain_ice',
  [TileType.Jungle]: 'terrain_jungle',
  [TileType.Desert]: 'terrain_desert',
};

const LAND_TYPES = new Set<TileType>([
  TileType.Plains,
  TileType.Forest,
  TileType.Mountain,
  TileType.Ice,
  TileType.Jungle,
  TileType.Desert,
]);

/**
 * Rendering-only coast resolver. It keeps tile data unchanged and only picks
 * a shoreline sprite based on 4-directional adjacent land.
 */
export class TerrainAutoTileResolver {
  static getTerrainSpriteKey(mapData: MapData, x: number, y: number): string {
    const tile = mapData.tiles[y]?.[x];
    if (!tile) return DEFAULT_TERRAIN_TEXTURES[TileType.Ocean];
    if (tile.type !== TileType.Coast) return DEFAULT_TERRAIN_TEXTURES[tile.type];

    const suffix = TerrainAutoTileResolver.getCoastSuffix(mapData, x, y);
    return suffix ? `terrain_coast_${suffix}` : DEFAULT_TERRAIN_TEXTURES[TileType.Coast];
  }

  private static getCoastSuffix(mapData: MapData, x: number, y: number): string {
    const parts: string[] = [];
    if (TerrainAutoTileResolver.isLand(mapData, x, y - 1)) parts.push('n');
    if (TerrainAutoTileResolver.isLand(mapData, x + 1, y)) parts.push('e');
    if (TerrainAutoTileResolver.isLand(mapData, x, y + 1)) parts.push('s');
    if (TerrainAutoTileResolver.isLand(mapData, x - 1, y)) parts.push('w');
    return parts.join('');
  }

  private static isLand(mapData: MapData, x: number, y: number): boolean {
    const tile = mapData.tiles[y]?.[x];
    return tile ? LAND_TYPES.has(tile.type) : false;
  }
}
