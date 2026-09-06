import Phaser from 'phaser';
import { TileMap } from '../systems/TileMap';
import type { MapData, Tile } from '../types/map';
import type { WorldPoint } from '../systems/gridLayout/IGridLayout';
import type { NationManager } from '../systems/NationManager';
import { getImprovementOwnerId } from '../systems/ImprovementOwnership';
import { getImprovementById } from '../data/improvements';

const OVERLAY_DEPTH = 13;
const COMPLETED_COLOR = 0xf5e6a3;
const COMPLETED_ALPHA = 0.55;
const CONSTRUCTION_COLOR = 0x66ccff;
const CONSTRUCTION_ALPHA = 0.6;
const LINE_WIDTH = 2;
const EDGE_INSET = 0.14;
const SEGMENT_LENGTH = 0.24;
const IMPROVEMENT_SPRITE_DEPTH = 5.75;
const IMPROVEMENT_SPRITE_SCALE = 0.82;

interface TileImprovementOverlay {
  graphics: Phaser.GameObjects.Graphics;
  sprite?: Phaser.GameObjects.Image;
}

export class TileImprovementOverlayRenderer {
  private readonly overlays = new Map<string, TileImprovementOverlay>();
  private visibilityPredicate: (tileX: number, tileY: number) => boolean = () => true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    private readonly mapData: MapData,
    private readonly nationManager: NationManager,
  ) {}

  setVisibilityPredicate(predicate: (tileX: number, tileY: number) => boolean): void {
    this.visibilityPredicate = predicate;
  }

  rebuildAll(): void {
    const seen = new Set<string>();

    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (!this.hasOverlay(tile)) continue;
        if (!this.visibilityPredicate(tile.x, tile.y)) continue;
        const key = this.coordKey(tile.x, tile.y);
        seen.add(key);
        this.renderTile(tile);
      }
    }

    for (const key of Array.from(this.overlays.keys())) {
      if (!seen.has(key)) this.clearTileByKey(key);
    }
  }

  refreshTile(tileX: number, tileY: number): void {
    const tile = this.mapData.tiles[tileY]?.[tileX];
    if (tile === undefined || !this.hasOverlay(tile) || !this.visibilityPredicate(tileX, tileY)) {
      this.clearTile(tileX, tileY);
      return;
    }

    this.renderTile(tile);
  }

  clearTile(tileX: number, tileY: number): void {
    this.clearTileByKey(this.coordKey(tileX, tileY));
  }

  shutdown(): void {
    for (const key of Array.from(this.overlays.keys())) {
      this.clearTileByKey(key);
    }
  }

  private renderTile(tile: Tile): void {
    const key = this.coordKey(tile.x, tile.y);
    this.clearTileByKey(key);

    const constructing = tile.improvementConstruction !== undefined;
    const graphics = this.scene.add.graphics();
    graphics.setDepth(OVERLAY_DEPTH);
    graphics.setAlpha(constructing ? CONSTRUCTION_ALPHA : COMPLETED_ALPHA);
    const improvementOwnerId = getImprovementOwnerId(tile);
    const isForeignOwned = improvementOwnerId !== undefined && improvementOwnerId !== tile.ownerId;
    const completedColor = isForeignOwned
      ? this.nationManager.getNation(improvementOwnerId)?.color ?? COMPLETED_COLOR
      : COMPLETED_COLOR;
    graphics.lineStyle(
      LINE_WIDTH,
      constructing ? CONSTRUCTION_COLOR : completedColor,
      1,
    );

    this.drawDashedHex(graphics, this.tileMap.getTileOutlinePoints(tile.x, tile.y));

    const improvementId = tile.improvementId ?? tile.improvementConstruction?.improvementId;
    const improvement = improvementId ? getImprovementById(improvementId) : undefined;
    let sprite: Phaser.GameObjects.Image | undefined;
    if (improvement?.spriteKey && this.scene.textures.exists(improvement.spriteKey)) {
      const center = this.tileMap.tileToWorld(tile.x, tile.y);
      const rect = this.tileMap.getTileRect(tile.x, tile.y);
      sprite = this.scene.add.image(center.x, center.y, improvement.spriteKey);
      sprite.setDepth(IMPROVEMENT_SPRITE_DEPTH);
      sprite.setDisplaySize(rect.width * IMPROVEMENT_SPRITE_SCALE, rect.height * IMPROVEMENT_SPRITE_SCALE);
      sprite.setAlpha(constructing ? 0.55 : 0.92);
    }

    this.overlays.set(key, { graphics, sprite });
  }

  private drawDashedHex(graphics: Phaser.GameObjects.Graphics, points: WorldPoint[]): void {
    if (points.length < 3) return;

    for (let i = 0; i < points.length; i += 1) {
      const start = points[i];
      const end = points[(i + 1) % points.length];
      this.drawEdgeSegments(graphics, start, end);
    }
  }

  private drawEdgeSegments(graphics: Phaser.GameObjects.Graphics, start: WorldPoint, end: WorldPoint): void {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const ranges: readonly [number, number][] = [
      [EDGE_INSET, EDGE_INSET + SEGMENT_LENGTH],
      [1 - EDGE_INSET - SEGMENT_LENGTH, 1 - EDGE_INSET],
    ];

    for (const [from, to] of ranges) {
      graphics.beginPath();
      graphics.moveTo(start.x + dx * from, start.y + dy * from);
      graphics.lineTo(start.x + dx * to, start.y + dy * to);
      graphics.strokePath();
    }
  }

  private hasOverlay(tile: Tile): boolean {
    return tile.improvementId !== undefined || tile.improvementConstruction !== undefined;
  }

  private clearTileByKey(key: string): void {
    const overlay = this.overlays.get(key);
    if (overlay === undefined) return;

    overlay.graphics.destroy();
    overlay.sprite?.destroy();
    this.overlays.delete(key);
  }

  private coordKey(x: number, y: number): string {
    return `${x},${y}`;
  }
}
