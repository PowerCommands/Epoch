import Phaser from 'phaser';
import { getNaturalResourceById } from '../data/naturalResources';
import type { MapData, Tile } from '../types/map';
import { HexTileMaskHelper } from './HexTileMaskHelper';
import { TileMap } from './TileMap';

const RESOURCE_DEPTH = 5.5;
const RESOURCE_TILE_FILL_SCALE = 0.9;

/** Predicate that controls whether a resource at a tile should be rendered. */
export type ResourceVisibilityPredicate = (tileX: number, tileY: number) => boolean;

export class NaturalResourceRenderer {
  private readonly sprites = new Map<string, Phaser.GameObjects.Image>();
  private readonly labels = new Map<string, Phaser.GameObjects.Text>();
  private readonly hexTileMaskHelper: HexTileMaskHelper;
  private visibilityPredicate: ResourceVisibilityPredicate = () => true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    private readonly mapData: MapData,
  ) {
    this.hexTileMaskHelper = new HexTileMaskHelper(scene, tileMap);
    this.rebuildAll();
  }

  /**
   * Set the tile-coordinate visibility predicate. Caller is responsible for
   * invoking `rebuildAll()` afterwards to apply the change.
   */
  setVisibilityPredicate(predicate: ResourceVisibilityPredicate): void {
    this.visibilityPredicate = predicate;
  }

  rebuildAll(): void {
    const seen = new Set<string>();

    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (!tile.resourceId) continue;
        if (!this.visibilityPredicate(tile.x, tile.y)) continue;
        const key = this.coordKey(tile.x, tile.y);
        seen.add(key);
        this.renderTile(tile);
      }
    }

    for (const [key, sprite] of this.sprites) {
      if (seen.has(key)) continue;
      this.destroyTileSprite(key, sprite);
    }

    for (const [key, label] of this.labels) {
      if (seen.has(key)) continue;
      label.destroy();
      this.labels.delete(key);
    }
  }

  refreshTile(tileX: number, tileY: number): void {
    const tile = this.mapData.tiles[tileY]?.[tileX];
    const key = this.coordKey(tileX, tileY);
    const visible = !!tile?.resourceId && this.visibilityPredicate(tileX, tileY);
    if (!visible) {
      const existing = this.sprites.get(key);
      if (existing) this.destroyTileSprite(key, existing);
      const label = this.labels.get(key);
      if (label) {
        label.destroy();
        this.labels.delete(key);
      }
      return;
    }
    this.renderTile(tile!);
  }

  shutdown(): void {
    for (const sprite of this.sprites.values()) {
      this.hexTileMaskHelper.clearMask(sprite);
      sprite.destroy();
    }
    this.sprites.clear();
    for (const label of this.labels.values()) label.destroy();
    this.labels.clear();
    this.hexTileMaskHelper.destroy();
  }

  private renderTile(tile: Tile): void {
    const resource = tile.resourceId ? getNaturalResourceById(tile.resourceId) : undefined;
    if (!resource) return;

    const key = this.coordKey(tile.x, tile.y);
    const { x, y } = this.tileMap.tileToWorld(tile.x, tile.y);
    const rect = this.tileMap.getTileRect(tile.x, tile.y);

    if (this.scene.textures.exists(resource.iconKey)) {
      const label = this.labels.get(key);
      if (label) {
        label.destroy();
        this.labels.delete(key);
      }

      let sprite = this.sprites.get(key);
      if (!sprite) {
        sprite = this.scene.add.image(x, y, resource.iconKey);
        sprite.setDepth(RESOURCE_DEPTH);
        this.sprites.set(key, sprite);
      }
      sprite.setTexture(resource.iconKey);
      const developed = !!(tile.improvementId || tile.improvementConstruction);
      const scale = developed ? 0.34 : RESOURCE_TILE_FILL_SCALE;
      sprite.setDepth(developed ? 5.9 : RESOURCE_DEPTH);
      sprite.setPosition(x + (developed ? rect.width * 0.25 : 0), y + (developed ? rect.height * 0.24 : 0));
      sprite.setDisplaySize(rect.width * scale, rect.height * scale);
      sprite.setAlpha(0.95);
      this.hexTileMaskHelper.applyHexMask(sprite, tile.x, tile.y);
      return;
    }

    const existingSprite = this.sprites.get(key);
    if (existingSprite) this.destroyTileSprite(key, existingSprite);

    let label = this.labels.get(key);
    if (!label) {
      label = this.scene.add.text(x, y, this.getFallbackLabel(resource.name), {
        fontFamily: 'Arial, sans-serif',
        fontSize: `${Math.max(9, Math.floor(rect.height * 0.16))}px`,
        fontStyle: 'bold',
        color: '#fff7cc',
        stroke: '#2b2112',
        strokeThickness: 3,
        align: 'center',
      });
      label.setOrigin(0.5, 0.5);
      label.setDepth(RESOURCE_DEPTH);
      label.setShadow(0, 1, '#000000', 2, false, true);
      this.labels.set(key, label);
    }

    label.setText(this.getFallbackLabel(resource.name));
    label.setDepth(tile.improvementId || tile.improvementConstruction ? 5.9 : RESOURCE_DEPTH);
    label.setPosition(x, y + (tile.improvementId || tile.improvementConstruction ? rect.height * 0.3 : 0));
    label.setVisible(true);
  }

  private destroyTileSprite(key: string, sprite: Phaser.GameObjects.Image): void {
    this.hexTileMaskHelper.clearMask(sprite);
    sprite.destroy();
    this.sprites.delete(key);
  }

  private getFallbackLabel(name: string): string {
    return name
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  private coordKey(x: number, y: number): string {
    return `${x},${y}`;
  }
}
