import { AmbientSprites } from '../systems/rendering/AmbientSprites';
import Phaser from 'phaser';
import { drawDamageFeedback } from './StructureDamageEffects';
import type { TileMap } from '../systems/TileMap';
import { TileType, type MapData, type Tile } from '../types/map';
import type { NationManager } from '../systems/NationManager';
import { getImprovementOwnerId } from '../systems/ImprovementOwnership';
import { getImprovementById } from '../data/improvements';

// Above terrain/rivers/culture, below resource badges, fog (7), buildings and units.
const DEPTH = 5.75;
const EFFECT_DURATION = 1800;
const MAX_EFFECTS = 32;
interface Overlay {
  signature: string;
  completed: boolean;
  sprite?: Phaser.GameObjects.Image;
  marker?: Phaser.GameObjects.Graphics;
}
interface Destruction {
  tile: Tile;
  age: number;
  sprite: Phaser.GameObjects.Image;
}

/** Static sprites are retained across visibility rebuilds. Destruction uses one
 * shared drawing surface and a bounded, short-lived list, never per-tile timers.
 * Improvements are removed outright by gameplay; this owns no persistent state.
 */
export class TileImprovementOverlayRenderer {
  private readonly overlays = new Map<string, Overlay>();
  private readonly effects = new Map<string, Destruction>();
  private effectGraphics?: Phaser.GameObjects.Graphics;
  private visibilityPredicate: (x: number, y: number) => boolean = () => true;
  private disposed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    private readonly mapData: MapData,
    private readonly nationManager: NationManager,
  ) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  setVisibilityPredicate(predicate: (x: number, y: number) => boolean): void {
    this.visibilityPredicate = predicate;
    this.rebuildAll();
  }

  rebuildAll(): void {
    for (const row of this.mapData.tiles) for (const tile of row) {
      if (tile.improvementId || tile.improvementConstruction || this.overlays.has(this.key(tile.x, tile.y))) {
        this.refreshTile(tile.x, tile.y);
      }
    }
    for (const [key, effect] of this.effects) {
      if (!this.visibilityPredicate(effect.tile.x, effect.tile.y)) this.clearEffect(key);
    }
  }

  refreshTile(x: number, y: number): void {
    if (this.disposed) return;
    const key = this.key(x, y);
    const tile = this.mapData.tiles[y]?.[x];
    if (!tile || !this.visibilityPredicate(x, y)) {
      this.clearTile(x, y);
      return;
    }
    const previous = this.overlays.get(key);
    if (!tile.improvementId && !tile.improvementConstruction) {
      if (previous?.completed && previous.sprite && tile.type !== TileType.NuclearWaste) {
        this.startDestruction(key, tile, previous.sprite);
        previous.sprite = undefined;
      }
      this.clearOverlay(key);
      return;
    }
    this.clearEffect(key);
    const constructing = !!tile.improvementConstruction;
    const id = tile.improvementId ?? tile.improvementConstruction?.improvementId;
    const definition = id ? getImprovementById(id) : undefined;
    const owner = getImprovementOwnerId(tile);
    const foreignColor = owner && owner !== tile.ownerId ? this.nationManager.getNation(owner)?.color : undefined;
    const texture = definition?.spriteKey && this.scene.textures.exists(definition.spriteKey) ? definition.spriteKey : undefined;
    const signature = JSON.stringify([id, constructing, tile.improvementConstruction?.remainingTurns, foreignColor, texture]);
    if (previous?.signature === signature) return;
    this.clearOverlay(key);
    const center = this.tileMap.tileToWorld(x, y);
    const rect = this.tileMap.getTileRect(x, y);
    const overlay: Overlay = { signature, completed: !!tile.improvementId };
    if (texture) {
      const sprite = this.scene.add.image(center.x, center.y, texture).setDepth(DEPTH);
      // Preserve the artwork's aspect ratio; fit inside the hex's central area.
      sprite.setScale(Math.min(rect.width * 0.82 / sprite.width, rect.height * 0.82 / sprite.height));
      sprite.setAlpha(constructing ? 0.5 : 1);
      overlay.sprite = sprite;
      AmbientSprites.forScene(this.scene).attach(sprite, 'improvement', key, () => [x, y],
        () => {
          const current = this.mapData.tiles[y]?.[x];
          return !!current?.improvementId && !current.improvementConstruction && !this.effects.has(key);
        }, false);
    }
    // Construction is a progress indicator, foreign ownership a small pennant.
    // Completed improvements have no placeholder perimeter underneath their art.
    if (constructing || foreignColor !== undefined) {
      const marker = this.scene.add.graphics().setDepth(DEPTH + 0.02);
      if (constructing) {
        const c = tile.improvementConstruction!;
        const progress = Math.max(0, Math.min(1, 1 - c.remainingTurns / Math.max(1, c.totalTurns)));
        marker.fillStyle(0x16232d, 0.85).fillRoundedRect(center.x - rect.width * 0.22, center.y + rect.height * 0.3, rect.width * 0.44, 3, 1);
        marker.fillStyle(0x66ccff, 0.9).fillRect(center.x - rect.width * 0.22, center.y + rect.height * 0.3, rect.width * 0.44 * progress, 3);
      }
      if (foreignColor !== undefined) {
        const px = center.x - rect.width * 0.29, py = center.y + rect.height * 0.12;
        marker.lineStyle(1, 0x242323, 1).lineBetween(px, py, px, py + rect.height * 0.17);
        marker.fillStyle(foreignColor, 1).fillTriangle(px, py, px + rect.width * 0.14, py + rect.height * 0.04, px, py + rect.height * 0.08);
      }
      overlay.marker = marker;
    }
    this.overlays.set(key, overlay);
  }

  clearTile(x: number, y: number): void {
    const key = this.key(x, y);
    this.clearOverlay(key);
    this.clearEffect(key);
  }

  shutdown(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    for (const key of this.overlays.keys()) this.clearOverlay(key);
    for (const key of this.effects.keys()) this.clearEffect(key);
    this.stopAnimation();
  }

  private startDestruction(key: string, tile: Tile, sprite: Phaser.GameObjects.Image): void {
    this.clearEffect(key);
    if (this.effects.size >= MAX_EFFECTS) this.clearEffect(this.effects.keys().next().value!);
    sprite.setTint(0x66635c);
    this.effects.set(key, { tile, sprite, age: 0 });
    if (!this.effectGraphics) {
      this.effectGraphics = this.scene.add.graphics().setDepth(DEPTH + 0.04);
      this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.updateEffects, this);
    }
  }

  private updateEffects(_time: number, delta: number): void {
    this.effectGraphics?.clear();
    for (const [key, effect] of this.effects) {
      effect.age += delta;
      if (effect.age >= EFFECT_DURATION || !this.visibilityPredicate(effect.tile.x, effect.tile.y)
        || effect.tile.improvementId || effect.tile.improvementConstruction) {
        this.clearEffect(key);
        continue;
      }
      const p = effect.age / EFFECT_DURATION;
      effect.sprite.setAlpha((1 - p) * 0.75);
      const { x, y } = this.tileMap.tileToWorld(effect.tile.x, effect.tile.y);
      const size = this.tileMap.getTileRect(effect.tile.x, effect.tile.y).height;
      const view = this.scene.cameras.main.worldView;
      if (x < view.left - size || x > view.right + size || y < view.top - size || y > view.bottom + size) continue;
      const gfx = this.effectGraphics!;
      gfx.fillStyle(0x282522, (1 - p) * 0.5).fillEllipse(x, y + size * 0.15, size * 0.4, size * 0.12);
      for (let i = 0; i < 4; i++) {
        gfx.fillStyle(0x504137, (1 - p) * 0.8).fillRect(x + (i - 2) * size * 0.07, y + size * (0.1 + (i % 2) * 0.06), size * 0.04, size * 0.025);
      }
      drawDamageFeedback(gfx, x, y, size, p, effect.age, 1 - p,
        effect.tile.type !== TileType.Ocean && effect.tile.type !== TileType.Coast && p < 0.65);
    }
    if (!this.effects.size) this.stopAnimation();
  }

  private clearOverlay(key: string): void {
    const overlay = this.overlays.get(key);
    overlay?.sprite?.destroy();
    overlay?.marker?.destroy();
    this.overlays.delete(key);
  }
  private clearEffect(key: string): void {
    this.effects.get(key)?.sprite.destroy();
    this.effects.delete(key);
    // Clear immediately on visibility changes, before the next animation frame.
    this.effectGraphics?.clear();
    if (!this.effects.size) this.stopAnimation();
  }
  private stopAnimation(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.updateEffects, this);
    this.effectGraphics?.destroy();
    this.effectGraphics = undefined;
  }
  private key(x: number, y: number): string { return `${x},${y}`; }
}
