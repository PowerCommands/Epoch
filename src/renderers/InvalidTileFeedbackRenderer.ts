import Phaser from 'phaser';
import type { TileMap } from '../systems/TileMap';

const FEEDBACK_DEPTH = 13;
const INVALID_COLOR = 0xff3b30;
const FLASH_DURATION_MS = 650;

/**
 * Brief red highlight shown when the player issues a move order to a tile the
 * selected unit can never occupy (land unit → water, naval unit → land). Pure
 * visual feedback: it owns no movement rules and simply flashes the clicked
 * hex, fading out on its own.
 */
export class InvalidTileFeedbackRenderer {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private tween: Phaser.Tweens.Tween | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileMap: TileMap,
  ) {
    this.gfx = scene.add.graphics().setDepth(FEEDBACK_DEPTH);
  }

  /** Flash the given tile red, fading out over a short duration. */
  flash(tileX: number, tileY: number): void {
    this.tween?.remove();
    this.tween = null;

    const outline = this.tileMap.getTileOutlinePoints(tileX, tileY);
    this.gfx.clear();
    this.gfx.setAlpha(1);
    this.gfx.fillStyle(INVALID_COLOR, 0.32);
    this.fillPolygon(outline);
    this.gfx.lineStyle(3, INVALID_COLOR, 0.95);
    this.strokePolygon(outline);

    this.tween = this.scene.tweens.add({
      targets: this.gfx,
      alpha: 0,
      duration: FLASH_DURATION_MS,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.gfx.clear();
        this.gfx.setAlpha(1);
        this.tween = null;
      },
    });
  }

  clear(): void {
    this.tween?.remove();
    this.tween = null;
    this.gfx.clear();
    this.gfx.setAlpha(1);
  }

  shutdown(): void {
    this.tween?.remove();
    this.tween = null;
    this.gfx.destroy();
  }

  private fillPolygon(points: { x: number; y: number }[]): void {
    if (points.length === 0) return;
    this.gfx.beginPath();
    this.gfx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) {
      this.gfx.lineTo(point.x, point.y);
    }
    this.gfx.closePath();
    this.gfx.fillPath();
  }

  private strokePolygon(points: { x: number; y: number }[]): void {
    if (points.length === 0) return;
    this.gfx.beginPath();
    this.gfx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) {
      this.gfx.lineTo(point.x, point.y);
    }
    this.gfx.closePath();
    this.gfx.strokePath();
  }
}
