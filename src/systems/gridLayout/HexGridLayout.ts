import type { GridCoord } from '../../types/grid';
import type { MapData } from '../../types/map';
import type { IGridLayout, TileRect, WorldPoint } from './IGridLayout';

const SQRT_3 = Math.sqrt(3);

interface CubeCoord {
  x: number;
  y: number;
  s: number;
}

/**
 * Pointy-top axial hex projection.
 * Internal tile coordinates use x as axial q and y as axial r.
 *
 * Center projection:
 *   worldX = size * sqrt(3) * (q + r / 2)
 *   worldY = size * 3/2 * r
 *
 * The implementation offsets all centers by one hex radius so tile (0,0)
 * has a positive center and a non-negative bounding box.
 */
export class HexGridLayout implements IGridLayout {
  getWorldBounds(mapData: MapData): { width: number; height: number } {
    if (mapData.width <= 0 || mapData.height <= 0) {
      return { width: 0, height: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        const rect = this.getTileRect({ x, y }, mapData);
        minX = Math.min(minX, rect.x);
        minY = Math.min(minY, rect.y);
        maxX = Math.max(maxX, rect.x + rect.width);
        maxY = Math.max(maxY, rect.y + rect.height);
      }
    }

    return {
      width: maxX - Math.min(0, minX),
      height: maxY - Math.min(0, minY),
    };
  }

  getTileSize(mapData: MapData): number {
    return mapData.tileSize;
  }

  tileToWorld(coord: GridCoord, mapData: MapData): WorldPoint {
    const size = this.getHexSize(mapData);

    return {
      x: size * SQRT_3 * (coord.x + coord.y / 2) + size,
      y: size * 1.5 * coord.y + size,
    };
  }

  worldToTileCoord(world: WorldPoint, mapData: MapData): GridCoord | null {
    const size = this.getHexSize(mapData);
    const localX = world.x - size;
    const localY = world.y - size;

    const q = (SQRT_3 / 3 * localX - 1 / 3 * localY) / size;
    const r = (2 / 3 * localY) / size;
    const coord = this.roundAxial({ x: q, y: r });

    if (coord.x < 0 || coord.y < 0 || coord.x >= mapData.width || coord.y >= mapData.height) {
      return null;
    }

    return coord;
  }

  getTileRect(coord: GridCoord, mapData: MapData): TileRect {
    const center = this.tileToWorld(coord, mapData);
    const size = this.getHexSize(mapData);
    const width = SQRT_3 * size;
    const height = 2 * size;

    return {
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
    };
  }

  getTileOutlinePoints(coord: GridCoord, mapData: MapData): WorldPoint[] {
    const center = this.tileToWorld(coord, mapData);
    const size = this.getHexSize(mapData);

    return Array.from({ length: 6 }, (_, i) => {
      const angle = Math.PI / 180 * (60 * i - 30);
      return {
        x: center.x + size * Math.cos(angle),
        y: center.y + size * Math.sin(angle),
      };
    });
  }

  private getHexSize(mapData: MapData): number {
    return mapData.tileSize / 2;
  }

  private roundAxial(coord: GridCoord): GridCoord {
    const cube = this.roundCube({
      x: coord.x,
      y: coord.y,
      s: -coord.x - coord.y,
    });
    return { x: cube.x, y: cube.y };
  }

  private roundCube(coord: CubeCoord): CubeCoord {
    let x = Math.round(coord.x);
    let y = Math.round(coord.y);
    let s = Math.round(coord.s);

    const xDiff = Math.abs(x - coord.x);
    const yDiff = Math.abs(y - coord.y);
    const sDiff = Math.abs(s - coord.s);

    if (xDiff > yDiff && xDiff > sDiff) {
      x = -y - s;
    } else if (yDiff > sDiff) {
      y = -x - s;
    } else {
      s = -x - y;
    }

    return { x, y, s };
  }
}
