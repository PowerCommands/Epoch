import Phaser from 'phaser';
import { TileMap } from './TileMap';

type MaskableGameObject = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Mask;

interface TileMaskEntry {
  graphics: Phaser.GameObjects.Graphics;
  mask: Phaser.Display.Masks.GeometryMask;
  refCount: number;
}

interface SpriteMaskBinding {
  key: string;
  onDestroy: () => void;
}

/**
 * Shared hex mask lifecycle for any tile-filling image content.
 */
export class HexTileMaskHelper {
  private readonly tileMasks = new Map<string, TileMaskEntry>();
  private readonly spriteBindings = new WeakMap<MaskableGameObject, SpriteMaskBinding>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileMap: TileMap,
  ) {}

  applyHexMask(sprite: MaskableGameObject, tileX: number, tileY: number): void {
    const key = this.getCoordKey(tileX, tileY);
    const existingBinding = this.spriteBindings.get(sprite);
    if (existingBinding?.key === key) {
      return;
    }

    if (existingBinding) {
      this.releaseSprite(sprite, existingBinding);
    }

    const entry = this.acquireTileMask(tileX, tileY);
    sprite.setMask(entry.mask);

    const onDestroy = (): void => {
      const currentBinding = this.spriteBindings.get(sprite);
      if (!currentBinding) return;
      this.releaseSprite(sprite, currentBinding);
    };

    sprite.once(Phaser.GameObjects.Events.DESTROY, onDestroy);
    this.spriteBindings.set(sprite, { key, onDestroy });
  }

  clearMask(sprite: MaskableGameObject): void {
    const binding = this.spriteBindings.get(sprite);
    if (!binding) {
      sprite.clearMask();
      return;
    }

    this.releaseSprite(sprite, binding);
  }

  destroy(): void {
    for (const [key, entry] of this.tileMasks) {
      entry.mask.destroy();
      entry.graphics.destroy();
      this.tileMasks.delete(key);
    }
  }

  private acquireTileMask(tileX: number, tileY: number): TileMaskEntry {
    const key = this.getCoordKey(tileX, tileY);
    const existing = this.tileMasks.get(key);
    if (existing) {
      existing.refCount += 1;
      return existing;
    }

    const outline = this.tileMap.getTileOutlinePoints(tileX, tileY);
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0xffffff, 1);
    graphics.beginPath();
    graphics.moveTo(outline[0].x, outline[0].y);
    for (const point of outline.slice(1)) {
      graphics.lineTo(point.x, point.y);
    }
    graphics.closePath();
    graphics.fillPath();
    graphics.setVisible(false);

    const entry: TileMaskEntry = {
      graphics,
      mask: graphics.createGeometryMask(),
      refCount: 1,
    };
    this.tileMasks.set(key, entry);
    return entry;
  }

  private releaseSprite(sprite: MaskableGameObject, binding: SpriteMaskBinding): void {
    sprite.off(Phaser.GameObjects.Events.DESTROY, binding.onDestroy);
    sprite.clearMask();
    this.spriteBindings.delete(sprite);
    this.releaseTileMask(binding.key);
  }

  private releaseTileMask(key: string): void {
    const entry = this.tileMasks.get(key);
    if (!entry) return;

    entry.refCount -= 1;
    if (entry.refCount > 0) return;

    entry.mask.destroy();
    entry.graphics.destroy();
    this.tileMasks.delete(key);
  }

  private getCoordKey(x: number, y: number): string {
    return `${x},${y}`;
  }
}
