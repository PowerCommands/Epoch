import { MapData, TileType } from '../types/map';

export interface TerrainRenderStyle {
  fillColor: number;
  borderColor: number;
  borderAlpha: number;
  innerColor: number;
  innerAlpha: number;
  textureColor: number;
  textureAlpha: number;
}

const DEFAULT_TERRAIN_STYLES: Record<TileType, TerrainRenderStyle> = {
  [TileType.Ocean]: {
    fillColor: 0x1a557d,
    borderColor: 0x123f61,
    borderAlpha: 0.42,
    innerColor: 0x246f9f,
    innerAlpha: 0.18,
    textureColor: 0x8fc5d7,
    textureAlpha: 0.18,
  },
  [TileType.Coast]: {
    fillColor: 0x4f8da7,
    borderColor: 0x2a617a,
    borderAlpha: 0.55,
    innerColor: 0x7db7b9,
    innerAlpha: 0.16,
    textureColor: 0xe1d28a,
    textureAlpha: 0.3,
  },
  [TileType.Plains]: {
    fillColor: 0x83b865,
    borderColor: 0x5f894b,
    borderAlpha: 0.34,
    innerColor: 0xa0cc78,
    innerAlpha: 0.16,
    textureColor: 0xd1d58b,
    textureAlpha: 0.22,
  },
  [TileType.Forest]: {
    fillColor: 0x2f7440,
    borderColor: 0x1e4c2d,
    borderAlpha: 0.46,
    innerColor: 0x3f8b4a,
    innerAlpha: 0.16,
    textureColor: 0x173d25,
    textureAlpha: 0.28,
  },
  [TileType.Mountain]: {
    fillColor: 0x777b7b,
    borderColor: 0x4a5051,
    borderAlpha: 0.58,
    innerColor: 0xa0a08f,
    innerAlpha: 0.2,
    textureColor: 0x34393c,
    textureAlpha: 0.35,
  },
  [TileType.Ice]: {
    fillColor: 0xc8e6e8,
    borderColor: 0x88b7bf,
    borderAlpha: 0.46,
    innerColor: 0xebfbfb,
    innerAlpha: 0.22,
    textureColor: 0x8fc5d0,
    textureAlpha: 0.26,
  },
  [TileType.Jungle]: {
    fillColor: 0x236f50,
    borderColor: 0x174a34,
    borderAlpha: 0.48,
    innerColor: 0x2d8f63,
    innerAlpha: 0.16,
    textureColor: 0x0f3626,
    textureAlpha: 0.32,
  },
  [TileType.Desert]: {
    fillColor: 0xcdb65e,
    borderColor: 0x9e8543,
    borderAlpha: 0.38,
    innerColor: 0xe2cd7a,
    innerAlpha: 0.18,
    textureColor: 0x9b7a39,
    textureAlpha: 0.2,
  },
};

/**
 * Rendering-only terrain resolver. Returns per-terrain fill/border colors for
 * the base hex polygon pass. Edge-based transitions (e.g. coastline strokes)
 * are handled by dedicated overlay renderers, not here.
 */
export class TerrainAutoTileResolver {
  static getTerrainStyle(mapData: MapData, x: number, y: number): TerrainRenderStyle {
    const tile = mapData.tiles[y]?.[x];
    return DEFAULT_TERRAIN_STYLES[tile?.type ?? TileType.Ocean];
  }
}
