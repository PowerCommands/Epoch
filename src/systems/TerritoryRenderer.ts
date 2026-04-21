import Phaser from 'phaser';
import { TileMap } from './TileMap';
import { NationManager } from './NationManager';
import { MapData } from '../types/map';
import type { IGridSystem } from './grid/IGridSystem';

const OVERLAY_ALPHA = 0.35;
const OVERLAY_DEPTH = 5;
const BORDER_DEPTH = 6;
const NORMAL_BORDER_ALPHA = 0.84;
const NORMAL_BORDER_WIDTH = 3;
const CITY_VIEW_BORDER_ALPHA = 0.96;
const CITY_VIEW_BORDER_WIDTH = 4;

interface Point {
  x: number;
  y: number;
}

const HEX_EDGE_INDEX_BY_DELTA = new Map<string, number>([
  ['1,0', 0],
  ['0,1', 1],
  ['-1,1', 2],
  ['-1,0', 3],
  ['0,-1', 4],
  ['1,-1', 5],
]);

/**
 * TerritoryRenderer ritar en semi-transparent färgad overlay ovanpå
 * varje tile som ägs av en nation.
 *
 * Overlayen ligger ovanpå terrängen (depth 0) men under hover/selection-
 * highlights. Borders ritas bara på exponerade ytterkanter där grannen
 * saknar samma ownerId.
 */
export class TerritoryRenderer {
  private readonly scene: Phaser.Scene;
  private readonly tileMap: TileMap;
  private readonly nationManager: NationManager;
  private readonly mapData: MapData;
  private readonly overlayGfx: Phaser.GameObjects.Graphics;
  private readonly borderGfx: Phaser.GameObjects.Graphics;
  private mode: 'normal' | 'cityView' = 'normal';

  constructor(
    scene: Phaser.Scene,
    tileMap: TileMap,
    nationManager: NationManager,
    mapData: MapData,
    private readonly gridSystem: IGridSystem,
  ) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.nationManager = nationManager;
    this.mapData = mapData;
    this.overlayGfx = scene.add.graphics().setDepth(OVERLAY_DEPTH);
    this.borderGfx = scene.add.graphics().setDepth(BORDER_DEPTH);
  }

  /** Rita om hela territory-overlayen. */
  render(): void {
    this.overlayGfx.clear();
    this.borderGfx.clear();

    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (tile.ownerId === undefined) continue;

        const nation = this.nationManager.getNation(tile.ownerId);
        if (nation === undefined) continue;

        const outline = this.tileMap.getTileOutlinePoints(tile.x, tile.y);

        this.overlayGfx.fillStyle(nation.color, OVERLAY_ALPHA);
        this.fillPolygon(outline);
      }
    }

    const borderSegments = new Map<string, { ownerId: string; start: Point; end: Point }>();

    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (tile.ownerId === undefined) continue;

        const x = tile.x;
        const y = tile.y;
        const outline = this.tileMap.getTileOutlinePoints(x, y);
        const adjacent = this.gridSystem.getAdjacentCoords({ x, y });

        for (const neighbor of adjacent) {
          if (!this.shouldDrawBorder(tile.ownerId, neighbor.x, neighbor.y)) continue;

          const edge = this.getHexEdgePoints(outline, x, y, neighbor);
          const key = this.segmentKey(edge[0], edge[1]);
          if (!borderSegments.has(key)) {
            borderSegments.set(key, { ownerId: tile.ownerId, start: edge[0], end: edge[1] });
          }
        }
      }
    }

    for (const segment of borderSegments.values()) {
      const nationColor = this.nationManager.getNation(segment.ownerId)?.color ?? 0x111111;
      this.borderGfx.lineStyle(this.getBorderWidth(), nationColor, this.getBorderAlpha());
      this.borderGfx.lineBetween(segment.start.x, segment.start.y, segment.end.x, segment.end.y);
    }
  }

  setMode(mode: 'normal' | 'cityView'): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.render();
  }

  private shouldDrawBorder(ownerId: string, x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.mapData.width || y >= this.mapData.height) {
      return true;
    }

    return this.mapData.tiles[y][x].ownerId !== ownerId;
  }

  private segmentKey(a: Point, b: Point): string {
    const first = this.pointKey(a);
    const second = this.pointKey(b);
    return first < second ? `${first},${second}` : `${second},${first}`;
  }

  private pointKey(point: Point): string {
    return `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
  }

  private getHexEdgePoints(outline: Point[], x: number, y: number, neighbor: Point): [Point, Point] {
    if (outline.length !== 6) {
      throw new Error(`TerritoryRenderer expected hex outline with 6 points, got ${outline.length}`);
    }

    const deltaKey = `${neighbor.x - x},${neighbor.y - y}`;
    const edgeIndex = HEX_EDGE_INDEX_BY_DELTA.get(deltaKey);
    if (edgeIndex === undefined) {
      throw new Error(`TerritoryRenderer received non-hex neighbor delta ${deltaKey}`);
    }

    return [outline[edgeIndex], outline[(edgeIndex + 1) % outline.length]];
  }

  private fillPolygon(points: Point[]): void {
    if (points.length === 0) return;
    this.overlayGfx.beginPath();
    this.overlayGfx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) {
      this.overlayGfx.lineTo(point.x, point.y);
    }
    this.overlayGfx.closePath();
    this.overlayGfx.fillPath();
  }

  private getBorderAlpha(): number {
    return this.mode === 'cityView' ? CITY_VIEW_BORDER_ALPHA : NORMAL_BORDER_ALPHA;
  }

  private getBorderWidth(): number {
    return this.mode === 'cityView' ? CITY_VIEW_BORDER_WIDTH : NORMAL_BORDER_WIDTH;
  }
}
