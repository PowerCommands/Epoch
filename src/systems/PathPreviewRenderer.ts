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
    const tileSize = this.tileMap.getTileSize();
    const inset = 4;

    this.reachableGfx.fillStyle(REACHABLE_COLOR, 0.16);
    this.reachableGfx.lineStyle(1, REACHABLE_COLOR, 0.4);

    for (const key of tiles) {
      const [x, y] = key.split(',').map(Number);
      const world = this.tileMap.tileToWorld(x, y);
      const half = tileSize / 2;
      this.reachableGfx.fillRect(
        world.x - half + inset,
        world.y - half + inset,
        tileSize - inset * 2,
        tileSize - inset * 2,
      );
      this.reachableGfx.strokeRect(
        world.x - half + inset,
        world.y - half + inset,
        tileSize - inset * 2,
        tileSize - inset * 2,
      );
    }
  }

  showPath(path: Tile[]): void {
    this.pathGfx.clear();
    if (path.length === 0) return;

    const tileSize = this.tileMap.getTileSize();
    const inset = 10;

    this.pathGfx.fillStyle(PATH_COLOR, 0.28);
    this.pathGfx.lineStyle(4, PATH_COLOR, 0.95);

    for (const tile of path) {
      const world = this.tileMap.tileToWorld(tile.x, tile.y);
      const half = tileSize / 2;
      this.pathGfx.fillRect(
        world.x - half + inset,
        world.y - half + inset,
        tileSize - inset * 2,
        tileSize - inset * 2,
      );
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
}
