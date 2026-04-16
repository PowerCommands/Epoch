import Phaser from 'phaser';
import { TileMap } from './TileMap';
import { NationManager } from './NationManager';
import { MapData } from '../types/map';

const OVERLAY_ALPHA = 0.35;
const OVERLAY_DEPTH = 5;
const BORDER_DEPTH = 6;
const BORDER_ALPHA = 0.72;
const BORDER_COLOR = 0x111111;
const BORDER_WIDTH = 2;

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

  constructor(
    scene: Phaser.Scene,
    tileMap: TileMap,
    nationManager: NationManager,
    mapData: MapData,
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

    const tileSize = this.tileMap.getTileSize();

    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (tile.ownerId === undefined) continue;

        const nation = this.nationManager.getNation(tile.ownerId);
        if (nation === undefined) continue;

        const px = tile.x * tileSize;
        const py = tile.y * tileSize;

        this.overlayGfx.fillStyle(nation.color, OVERLAY_ALPHA);
        this.overlayGfx.fillRect(px, py, tileSize, tileSize);
      }
    }

    this.borderGfx.lineStyle(BORDER_WIDTH, BORDER_COLOR, BORDER_ALPHA);
    const borderSegments = new Set<string>();

    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (tile.ownerId === undefined) continue;

        const x = tile.x;
        const y = tile.y;
        const px = x * tileSize;
        const py = y * tileSize;
        const right = px + tileSize;
        const bottom = py + tileSize;

        if (this.shouldDrawBorder(tile.ownerId, x, y - 1)) {
          borderSegments.add(`${px},${py},${right},${py}`);
        }
        if (this.shouldDrawBorder(tile.ownerId, x + 1, y)) {
          borderSegments.add(`${right},${py},${right},${bottom}`);
        }
        if (this.shouldDrawBorder(tile.ownerId, x, y + 1)) {
          borderSegments.add(`${px},${bottom},${right},${bottom}`);
        }
        if (this.shouldDrawBorder(tile.ownerId, x - 1, y)) {
          borderSegments.add(`${px},${py},${px},${bottom}`);
        }
      }
    }

    for (const segment of borderSegments) {
      const [x1, y1, x2, y2] = segment.split(',').map(Number);
      this.borderGfx.lineBetween(x1, y1, x2, y2);
    }
  }

  private shouldDrawBorder(ownerId: string, x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.mapData.width || y >= this.mapData.height) {
      return true;
    }

    return this.mapData.tiles[y][x].ownerId !== ownerId;
  }
}
