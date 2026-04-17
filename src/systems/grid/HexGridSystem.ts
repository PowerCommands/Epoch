import type { City } from '../../entities/City';
import type { GridCoord } from '../../types/grid';
import type { MapData, Tile } from '../../types/map';
import type { IGridSystem, TilesInRangeOptions } from './IGridSystem';

const AXIAL_DIRECTIONS: readonly GridCoord[] = [
  { x: 1, y: 0 },
  { x: 1, y: -1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
];

/**
 * Hex-grid gameplay implementation.
 * Internal tile coordinates use x as axial q and y as axial r.
 */
export class HexGridSystem implements IGridSystem {
  getAdjacentCoords(coord: GridCoord): GridCoord[] {
    return AXIAL_DIRECTIONS.map((direction) => ({
      x: coord.x + direction.x,
      y: coord.y + direction.y,
    }));
  }

  getNeighbors(coord: GridCoord, mapData: MapData): Tile[] {
    return this.getAdjacentCoords(coord)
      .map(({ x, y }) => this.getTile(mapData, x, y))
      .filter((tile): tile is Tile => tile !== null);
  }

  isAdjacent(a: GridCoord, b: GridCoord): boolean {
    return this.getDistance(a, b) === 1;
  }

  getDistance(a: GridCoord, b: GridCoord): number {
    const dq = a.x - b.x;
    const dr = a.y - b.y;
    const ds = -dq - dr;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
  }

  getTilesInRange(
    center: GridCoord,
    range: number,
    mapData: MapData,
    options: TilesInRangeOptions = {},
  ): Tile[] {
    const includeCenter = options.includeCenter ?? false;
    const tiles: Tile[] = [];

    for (let dq = -range; dq <= range; dq++) {
      const minDr = Math.max(-range, -dq - range);
      const maxDr = Math.min(range, -dq + range);

      for (let dr = minDr; dr <= maxDr; dr++) {
        if (!includeCenter && dq === 0 && dr === 0) continue;

        const coord = { x: center.x + dq, y: center.y + dr };
        const tile = this.getTile(mapData, coord.x, coord.y);
        if (tile) tiles.push(tile);
      }
    }

    return tiles;
  }

  getWorkableCityTiles(city: City, mapData: MapData): Tile[] {
    return this.getTilesInRange(
      { x: city.tileX, y: city.tileY },
      1,
      mapData,
      { includeCenter: true },
    );
  }

  private getTile(mapData: MapData, tileX: number, tileY: number): Tile | null {
    return mapData.tiles[tileY]?.[tileX] ?? null;
  }
}
