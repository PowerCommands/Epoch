import type { GridCoord } from '../../types/grid';
import type { MapData } from '../../types/map';

export interface WorldPoint {
  x: number;
  y: number;
}

export interface TileRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Hex projection contract used by rendering and pointer hit-testing.
 * Coordinates use the internal tile index shape (`x` = axial q, `y` = axial r).
 */
export interface IGridLayout {
  getWorldBounds(mapData: MapData): { width: number; height: number };
  getTileSize(mapData: MapData): number;
  tileToWorld(coord: GridCoord, mapData: MapData): WorldPoint;
  worldToTileCoord(world: WorldPoint, mapData: MapData): GridCoord | null;
  getTileRect(coord: GridCoord, mapData: MapData): TileRect;
  getTileOutlinePoints(coord: GridCoord, mapData: MapData): WorldPoint[];
}
