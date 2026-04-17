import Phaser from 'phaser';
import { MapData, Tile, TileType } from '../types/map';
import { TerrainAutoTileResolver } from './TerrainAutoTileResolver';
import type { IGridLayout, TileRect, WorldPoint } from './gridLayout/IGridLayout';
import type { TerrainRenderStyle } from './TerrainAutoTileResolver';

const TERRAIN_DEPTH = 0;
const INNER_HEX_SCALE = 0.72;

/**
 * TileMap ansvarar för att hålla kartdata och rendera den till scenen.
 *
 * Designprincip: Den publika API:n är avsiktligt frikopplad från Phaser-
 * detaljer. Renderingsimplementationen (Graphics vs. rektanglar) är en
 * intern detalj som kan bytas ut, och `generatePlaceholder` är den enda
 * fabriksmetod som behöver ändras när vi byter till GeoJSON-baserad data.
 */
export class TileMap {
  private readonly data: MapData;
  private readonly layout: IGridLayout;

  constructor(scene: Phaser.Scene, data: MapData, layout: IGridLayout) {
    this.data = data;
    this.layout = layout;
    this.render(scene);
  }

  /** Kartans totala pixelstorlek i världskoordinater. */
  getWorldBounds(): { width: number; height: number } {
    return this.layout.getWorldBounds(this.data);
  }

  /** Tile-storleken i pixlar. Används av bl.a. SelectionManager för highlight-rendering. */
  getTileSize(): number {
    return this.layout.getTileSize(this.data);
  }

  /**
   * Konvertera världskoordinater till den tile som finns på den positionen.
   * Returnerar null om koordinaten ligger utanför kartan.
   */
  worldToTile(worldX: number, worldY: number): Tile | null {
    const coord = this.layout.worldToTileCoord({ x: worldX, y: worldY }, this.data);
    if (coord === null) return null;
    return this.getTileAt(coord.x, coord.y);
  }

  /**
   * Hämta tile via gridkoordinater. Returnerar null utanför kartans gränser.
   */
  getTileAt(tileX: number, tileY: number): Tile | null {
    if (tileX < 0 || tileY < 0 || tileX >= this.data.width || tileY >= this.data.height) {
      return null;
    }

    return this.data.tiles[tileY][tileX];
  }

  /**
   * Konvertera tile-gridkoordinater till tilens centerposition i världskoordinater.
   */
  tileToWorld(tileX: number, tileY: number): { x: number; y: number } {
    return this.layout.tileToWorld({ x: tileX, y: tileY }, this.data);
  }

  getTileRect(tileX: number, tileY: number): TileRect {
    return this.layout.getTileRect({ x: tileX, y: tileY }, this.data);
  }

  getTileOutlinePoints(tileX: number, tileY: number): WorldPoint[] {
    return this.layout.getTileOutlinePoints({ x: tileX, y: tileY }, this.data);
  }

  /**
   * Genererar en reproducerbar placeholder-karta.
   *
   * Layout:
   * - Yttersta raden runt om: Ocean
   * - Näst yttersta raden: Coast
   * - Inre tiles: deterministisk blandning av Plains, Forest, Mountain
   *   baserat på ett enkelt hash-mönster (inga externa beroenden, alltid
   *   samma resultat för samma bredd/höjd).
   */
  static generatePlaceholder(width: number, height: number, tileSize: number): MapData {
    const tiles: Tile[][] = [];

    for (let y = 0; y < height; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < width; x++) {
        row.push({ x, y, type: TileMap.pickTileType(x, y, width, height) });
      }
      tiles.push(row);
    }

    return { width, height, tileSize, tiles };
  }

  // ─── Privata hjälpmetoder ──────────────────────────────────────────────────

  private static pickTileType(x: number, y: number, w: number, h: number): TileType {
    const isOuterEdge =
      x === 0 || y === 0 || x === w - 1 || y === h - 1;
    const isCoastEdge =
      x === 1 || y === 1 || x === w - 2 || y === h - 2;

    if (isOuterEdge) return TileType.Ocean;
    if (isCoastEdge) return TileType.Coast;

    // Deterministiskt "organiskt" mönster utan slumpgenerator:
    // multiplicera koordinaterna med oreltade primtal och kombinera dem
    // till ett index i en fix fördelning.
    const hash = (x * 7 + y * 13 + x * y * 3) % 10;
    if (hash < 4) return TileType.Plains;   // 40 %
    if (hash < 7) return TileType.Forest;   // 30 %
    return TileType.Mountain;               // 30 %
  }

  /**
   * Renders terrain as true layout-provided hex polygons.
   */
  private render(scene: Phaser.Scene): void {
    const { width, height } = this.data;
    const terrain = scene.add.graphics();
    terrain.setDepth(TERRAIN_DEPTH);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.renderTerrainFill(terrain, x, y);
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.renderTerrainEdges(terrain, x, y);
      }
    }
  }

  private renderTerrainFill(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    const outline = this.getTileOutlinePoints(x, y);
    if (outline.length < 3) return;

    const style = TerrainAutoTileResolver.getTerrainStyle(this.data, x, y);

    this.fillPolygon(graphics, outline, style.fillColor, 1);

    const center = this.tileToWorld(x, y);
    this.fillPolygon(graphics, this.insetPolygon(outline, center, INNER_HEX_SCALE), style.innerColor, style.innerAlpha);
    this.renderTerrainTexture(graphics, x, y, center, style);
  }

  private fillPolygon(
    graphics: Phaser.GameObjects.Graphics,
    points: WorldPoint[],
    color: number,
    alpha: number,
  ): void {
    graphics.fillStyle(color, alpha);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);

    for (const point of points.slice(1)) {
      graphics.lineTo(point.x, point.y);
    }

    graphics.closePath();
    graphics.fillPath();
  }

  private insetPolygon(points: WorldPoint[], center: WorldPoint, scale: number): WorldPoint[] {
    return points.map((point) => ({
      x: center.x + (point.x - center.x) * scale,
      y: center.y + (point.y - center.y) * scale,
    }));
  }

  private renderTerrainTexture(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    center: WorldPoint,
    style: TerrainRenderStyle,
  ): void {
    const tile = this.data.tiles[y]?.[x];
    if (!tile) return;

    const radius = this.data.tileSize / 2;
    graphics.lineStyle(Math.max(1, radius * 0.045), style.textureColor, style.textureAlpha);

    switch (tile.type) {
      case TileType.Ocean:
        this.drawWaveMarks(graphics, x, y, center, radius);
        break;
      case TileType.Coast:
        this.drawSandMarks(graphics, x, y, center, radius);
        break;
      case TileType.Plains:
        this.drawGrassMarks(graphics, x, y, center, radius);
        break;
      case TileType.Forest:
        this.drawCanopyMarks(graphics, x, y, center, radius, 3);
        break;
      case TileType.Mountain:
        this.drawMountainMarks(graphics, x, y, center, radius);
        break;
      case TileType.Ice:
        this.drawIceMarks(graphics, x, y, center, radius);
        break;
      case TileType.Jungle:
        this.drawCanopyMarks(graphics, x, y, center, radius, 4);
        break;
      case TileType.Desert:
        this.drawDuneMarks(graphics, x, y, center, radius);
        break;
    }
  }

  private drawWaveMarks(graphics: Phaser.GameObjects.Graphics, x: number, y: number, center: WorldPoint, radius: number): void {
    if (this.hash(x, y, 5) !== 0) return;
    const offsets = [-0.2, 0.18];
    for (const offset of offsets) {
      const cy = center.y + offset * radius;
      graphics.beginPath();
      graphics.moveTo(center.x - radius * 0.28, cy);
      graphics.lineTo(center.x - radius * 0.08, cy - radius * 0.08);
      graphics.lineTo(center.x + radius * 0.12, cy);
      graphics.lineTo(center.x + radius * 0.28, cy + radius * 0.06);
      graphics.lineTo(center.x + radius * 0.4, cy - radius * 0.03);
      graphics.strokePath();
    }
  }

  private drawSandMarks(graphics: Phaser.GameObjects.Graphics, x: number, y: number, center: WorldPoint, radius: number): void {
    const dy = (this.hash(x, y, 5) - 2) * radius * 0.035;
    graphics.lineBetween(center.x - radius * 0.34, center.y + dy, center.x + radius * 0.34, center.y + dy - radius * 0.08);
  }

  private drawGrassMarks(graphics: Phaser.GameObjects.Graphics, x: number, y: number, center: WorldPoint, radius: number): void {
    const drift = (this.hash(x, y, 7) - 3) * radius * 0.025;
    graphics.lineBetween(center.x - radius * 0.2, center.y + radius * 0.18 + drift, center.x + radius * 0.18, center.y + radius * 0.04 + drift);
    if (this.hash(x + 3, y + 5, 2) === 0) {
      graphics.lineBetween(center.x - radius * 0.08, center.y - radius * 0.18, center.x + radius * 0.18, center.y - radius * 0.27);
    }
  }

  private drawCanopyMarks(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    center: WorldPoint,
    radius: number,
    count: number,
  ): void {
    const seed = this.hash(x, y, 6);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * (i + seed / 6)) / count;
      const px = center.x + Math.cos(angle) * radius * 0.22;
      const py = center.y + Math.sin(angle) * radius * 0.18;
      graphics.strokeCircle(px, py, radius * 0.08);
    }
  }

  private drawMountainMarks(graphics: Phaser.GameObjects.Graphics, x: number, y: number, center: WorldPoint, radius: number): void {
    const lift = (this.hash(x, y, 5) - 2) * radius * 0.02;
    graphics.beginPath();
    graphics.moveTo(center.x - radius * 0.3, center.y + radius * 0.22 + lift);
    graphics.lineTo(center.x - radius * 0.03, center.y - radius * 0.25 + lift);
    graphics.lineTo(center.x + radius * 0.26, center.y + radius * 0.22 + lift);
    graphics.strokePath();
    graphics.lineBetween(center.x - radius * 0.03, center.y - radius * 0.25 + lift, center.x + radius * 0.02, center.y + radius * 0.18 + lift);
  }

  private drawIceMarks(graphics: Phaser.GameObjects.Graphics, x: number, y: number, center: WorldPoint, radius: number): void {
    const tilt = (this.hash(x, y, 3) - 1) * radius * 0.04;
    graphics.lineBetween(center.x - radius * 0.28, center.y - radius * 0.08 + tilt, center.x + radius * 0.28, center.y - radius * 0.2 - tilt);
    graphics.lineBetween(center.x - radius * 0.14, center.y + radius * 0.18, center.x + radius * 0.24, center.y + radius * 0.1);
  }

  private drawDuneMarks(graphics: Phaser.GameObjects.Graphics, x: number, y: number, center: WorldPoint, radius: number): void {
    const shift = (this.hash(x, y, 5) - 2) * radius * 0.025;
    graphics.beginPath();
    graphics.moveTo(center.x - radius * 0.36, center.y + radius * 0.1 + shift);
    graphics.lineTo(center.x - radius * 0.12, center.y - radius * 0.04 + shift);
    graphics.lineTo(center.x + radius * 0.12, center.y - radius * 0.04 + shift);
    graphics.lineTo(center.x + radius * 0.36, center.y + radius * 0.1 + shift);
    graphics.strokePath();
  }

  private hash(x: number, y: number, mod: number): number {
    const value = Math.imul(x + 37, 73_856_093) ^ Math.imul(y + 91, 19_349_663);
    return Math.abs(value) % mod;
  }

  private renderTerrainEdges(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    const outline = this.getTileOutlinePoints(x, y);
    if (outline.length < 3) return;

    const style = TerrainAutoTileResolver.getTerrainStyle(this.data, x, y);

    graphics.lineStyle(1, style.borderColor, style.borderAlpha);
    graphics.beginPath();
    graphics.moveTo(outline[0].x, outline[0].y);

    for (const point of outline.slice(1)) {
      graphics.lineTo(point.x, point.y);
    }

    graphics.closePath();
    graphics.strokePath();
  }
}
