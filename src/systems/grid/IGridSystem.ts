import type { City } from '../../entities/City';
import type { GridCoord } from '../../types/grid';
import type { MapData, Tile } from '../../types/map';

export interface TilesInRangeOptions {
  includeCenter?: boolean;
}

/**
 * Hex-grid gameplay rules shared by movement, range, territory, and economy.
 * Coordinates use the internal tile index shape (`x` = axial q, `y` = axial r).
 */
export interface IGridSystem {
  getAdjacentCoords(coord: GridCoord): GridCoord[];
  getNeighbors(coord: GridCoord, mapData: MapData): Tile[];
  isAdjacent(a: GridCoord, b: GridCoord): boolean;
  getDistance(a: GridCoord, b: GridCoord): number;
  getTilesInRange(
    center: GridCoord,
    range: number,
    mapData: MapData,
    options?: TilesInRangeOptions,
  ): Tile[];
  getWorkableCityTiles(city: City, mapData: MapData): Tile[];
}
