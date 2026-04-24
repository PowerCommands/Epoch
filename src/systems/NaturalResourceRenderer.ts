import Phaser from 'phaser';
import { getNaturalResourceById } from '../data/naturalResources';
import type { MapData, Tile } from '../types/map';
import { TileMap } from './TileMap';

const RESOURCE_DEPTH = 5.5;

export class NaturalResourceRenderer {
  private readonly sprites = new Map<string, Phaser.GameObjects.Image>();
  private readonly labels = new Map<string, Phaser.GameObjects.Text>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    private readonly mapData: MapData,
  ) {
    this.rebuildAll();
  }

  rebuildAll(): void {
    const seen = new Set<string>();

    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (!tile.resourceId) continue;
        const key = this.coordKey(tile.x, tile.y);
        seen.add(key);
        this.renderTile(tile);
      }
    }

    for (const [key, sprite] of this.sprites) {
      if (seen.has(key)) continue;
      sprite.destroy();
      this.sprites.delete(key);
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
    if (!tile?.resourceId) {
      this.sprites.get(key)?.destroy();
      this.sprites.delete(key);
      this.labels.get(key)?.destroy();
      this.labels.delete(key);
      return;
    }
    this.renderTile(tile);
  }

  shutdown(): void {
    for (const sprite of this.sprites.values()) sprite.destroy();
    for (const label of this.labels.values()) label.destroy();
    this.sprites.clear();
    this.labels.clear();
  }

  private renderTile(tile: Tile): void {
    const resource = tile.resourceId ? getNaturalResourceById(tile.resourceId) : undefined;
    if (!resource) return;

    const key = this.coordKey(tile.x, tile.y);
    const { x, y } = this.tileMap.tileToWorld(tile.x, tile.y);
    const rect = this.tileMap.getTileRect(tile.x, tile.y);
    const centerY = y - rect.height * 0.08;

    if (this.scene.textures.exists(resource.iconKey)) {
      this.labels.get(key)?.destroy();
      this.labels.delete(key);

      let sprite = this.sprites.get(key);
      if (!sprite) {
        sprite = this.scene.add.image(x, centerY, resource.iconKey);
        sprite.setDepth(RESOURCE_DEPTH);
        this.sprites.set(key, sprite);
      }
      sprite.setTexture(resource.iconKey);
      sprite.setPosition(x, centerY);
      sprite.setDisplaySize(rect.width * 0.32, rect.height * 0.32);
      sprite.setAlpha(0.95);
      return;
    }

    this.sprites.get(key)?.destroy();
    this.sprites.delete(key);

    let label = this.labels.get(key);
    if (!label) {
      label = this.scene.add.text(x, centerY, this.getFallbackLabel(resource.name), {
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
    label.setPosition(x, centerY);
    label.setVisible(true);
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
