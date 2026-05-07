import Phaser from 'phaser';
import type { MapData } from '../types/map';
import type { NationManager } from '../systems/NationManager';
import type { TileMap } from '../systems/TileMap';

const CULTURE_OVERLAY_DEPTH = 5.7;
const CULTURE_FILL_ALPHA = 0.38;
const FALLBACK_CULTURE_COLOR = 0xb59a5a;

/**
 * CultureLayerRenderer draws transparent nation-colored overlays on tiles
 * that have a `cultureOwnerId`. Pure visualization — reads tile state and
 * nation colors only, never mutates gameplay data.
 *
 * Hidden by default. GameScene toggles visibility in response to the
 * Culture Lens button and calls `refresh` after culture state changes.
 */
export class CultureLayerRenderer {
  private readonly gfx: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    private readonly nationManager: NationManager,
    private readonly mapData: MapData,
  ) {
    this.gfx = scene.add.graphics().setDepth(CULTURE_OVERLAY_DEPTH);
    this.gfx.setVisible(false);
  }

  refresh(): void {
    this.gfx.clear();

    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (tile.cultureOwnerId === undefined) continue;
        const outline = this.tileMap.getTileOutlinePoints(tile.x, tile.y);
        if (outline.length < 3) continue;
        const color = this.nationManager.getNation(tile.cultureOwnerId)?.color
          ?? FALLBACK_CULTURE_COLOR;

        this.gfx.fillStyle(color, CULTURE_FILL_ALPHA);
        this.gfx.beginPath();
        this.gfx.moveTo(outline[0].x, outline[0].y);
        for (const point of outline.slice(1)) {
          this.gfx.lineTo(point.x, point.y);
        }
        this.gfx.closePath();
        this.gfx.fillPath();
      }
    }
  }

  setVisible(visible: boolean): void {
    this.gfx.setVisible(visible);
  }

  isVisible(): boolean {
    return this.gfx.visible;
  }

  shutdown(): void {
    this.gfx.destroy();
  }
}
