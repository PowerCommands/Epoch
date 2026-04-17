import Phaser from 'phaser';
import type { Tile } from '../types/map';
import { TileMap } from './TileMap';

const PREVIEW_DEPTH = 12;
const REACHABLE_COLOR = 0x4fd3ff;
const PATH_COLOR = 0xffdd44;

export class PathPreviewRenderer {
  private readonly reachableGfx: Phaser.GameObjects.Graphics;
  private readonly pathGfx: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly tileMap: TileMap,
  ) {
    this.reachableGfx = scene.add.graphics().setDepth(PREVIEW_DEPTH);
    this.pathGfx = scene.add.graphics().setDepth(PREVIEW_DEPTH + 1);
  }

  showReachableTiles(tiles: Set<string>): void {
    this.reachableGfx.clear();
    const inset = 4;

    this.reachableGfx.fillStyle(REACHABLE_COLOR, 0.16);
    this.reachableGfx.lineStyle(1, REACHABLE_COLOR, 0.4);

    for (const key of tiles) {
      const [x, y] = key.split(',').map(Number);
      const outline = this.insetOutline(x, y, inset);
      this.fillPolygon(this.reachableGfx, outline);
      this.strokePolygon(this.reachableGfx, outline);
    }
  }

  showPath(path: Tile[]): void {
    this.pathGfx.clear();
    if (path.length === 0) return;

    const inset = 10;

    this.pathGfx.fillStyle(PATH_COLOR, 0.28);
    this.pathGfx.lineStyle(4, PATH_COLOR, 0.95);

    for (const tile of path) {
      this.fillPolygon(this.pathGfx, this.insetOutline(tile.x, tile.y, inset));
    }

    if (path.length < 2) return;

    const first = this.tileMap.tileToWorld(path[0].x, path[0].y);
    this.pathGfx.beginPath();
    this.pathGfx.moveTo(first.x, first.y);
    for (const tile of path.slice(1)) {
      const world = this.tileMap.tileToWorld(tile.x, tile.y);
      this.pathGfx.lineTo(world.x, world.y);
    }
    this.pathGfx.strokePath();
  }

  clear(): void {
    this.reachableGfx.clear();
    this.pathGfx.clear();
  }

  clearPath(): void {
    this.pathGfx.clear();
  }

  private insetOutline(tileX: number, tileY: number, inset: number): { x: number; y: number }[] {
    const center = this.tileMap.tileToWorld(tileX, tileY);
    return this.tileMap.getTileOutlinePoints(tileX, tileY).map((point) => {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length <= inset) return center;
      const scale = (length - inset) / length;
      return {
        x: center.x + dx * scale,
        y: center.y + dy * scale,
      };
    });
  }

  private fillPolygon(gfx: Phaser.GameObjects.Graphics, points: { x: number; y: number }[]): void {
    if (points.length === 0) return;
    gfx.beginPath();
    gfx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) {
      gfx.lineTo(point.x, point.y);
    }
    gfx.closePath();
    gfx.fillPath();
  }

  private strokePolygon(gfx: Phaser.GameObjects.Graphics, points: { x: number; y: number }[]): void {
    if (points.length === 0) return;
    gfx.beginPath();
    gfx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) {
      gfx.lineTo(point.x, point.y);
    }
    gfx.closePath();
    gfx.strokePath();
  }
}
