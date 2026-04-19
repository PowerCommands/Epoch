import Phaser from 'phaser';
import { TileMap } from './TileMap';

const PREVIEW_DEPTH = 12;
const TARGET_COLOR = 0xff3333;
const CURVE_COLOR = 0xff5a5a;

export class RangedPreviewRenderer {
  private readonly targetsGfx: Phaser.GameObjects.Graphics;
  private readonly curveGfx: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly tileMap: TileMap,
  ) {
    this.targetsGfx = scene.add.graphics().setDepth(PREVIEW_DEPTH);
    this.curveGfx = scene.add.graphics().setDepth(PREVIEW_DEPTH + 1);
  }

  showTargets(tiles: Set<string>): void {
    this.targetsGfx.clear();
    const inset = 4;

    this.targetsGfx.fillStyle(TARGET_COLOR, 0.22);
    this.targetsGfx.lineStyle(2, TARGET_COLOR, 0.75);

    for (const key of tiles) {
      const [x, y] = key.split(',').map(Number);
      const outline = this.insetOutline(x, y, inset);
      this.fillPolygon(this.targetsGfx, outline);
      this.strokePolygon(this.targetsGfx, outline);
    }
  }

  showCurve(from: { x: number; y: number }, to: { x: number; y: number }): void {
    this.curveGfx.clear();

    const start = this.tileMap.tileToWorld(from.x, from.y);
    const end = this.tileMap.tileToWorld(to.x, to.y);

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const mx = (start.x + end.x) / 2;
    const my = (start.y + end.y) / 2;
    const perpX = -dy / dist;
    const perpY = dx / dist;
    const arcHeight = Math.min(80, dist * 0.28);
    const controlX = mx + perpX * arcHeight;
    const controlY = my + perpY * arcHeight;

    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(start.x, start.y),
      new Phaser.Math.Vector2(controlX, controlY),
      new Phaser.Math.Vector2(end.x, end.y),
    );

    this.curveGfx.lineStyle(4, CURVE_COLOR, 0.9);
    curve.draw(this.curveGfx, 32);

    const arrow = this.arrowHead(
      { x: controlX, y: controlY },
      end,
      10,
    );
    this.curveGfx.fillStyle(CURVE_COLOR, 0.9);
    this.fillPolygon(this.curveGfx, arrow);
  }

  clearCurve(): void {
    this.curveGfx.clear();
  }

  clear(): void {
    this.targetsGfx.clear();
    this.curveGfx.clear();
  }

  private arrowHead(
    control: { x: number; y: number },
    tip: { x: number; y: number },
    size: number,
  ): { x: number; y: number }[] {
    const dx = tip.x - control.x;
    const dy = tip.y - control.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) return [];
    const ux = dx / len;
    const uy = dy / len;
    const perpX = -uy;
    const perpY = ux;
    const baseX = tip.x - ux * size;
    const baseY = tip.y - uy * size;
    return [
      { x: tip.x, y: tip.y },
      { x: baseX + perpX * (size * 0.6), y: baseY + perpY * (size * 0.6) },
      { x: baseX - perpX * (size * 0.6), y: baseY - perpY * (size * 0.6) },
    ];
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
