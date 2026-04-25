import Phaser from 'phaser';
import { TileMap } from './TileMap';
import type { ProductionSystem } from './ProductionSystem';
import type { MapData, Tile } from '../types/map';
import { HexTileMaskHelper } from './HexTileMaskHelper';
import { getBuildingSpritePath, getWonderSpritePath } from '../utils/assetPaths';

const TILE_BUILDING_DEPTH = 14;
const TILE_BUILDING_TEXT_DEPTH = 14.5;
const TILE_BUILDING_SCALE = 0.9;

type TileConstructionVisual =
  | { kind: 'building'; id: string; cityId?: string; constructing: boolean }
  | { kind: 'wonder'; id: string; cityId?: string; constructing: boolean };

export class TileBuildingRenderer {
  private readonly sprites = new Map<string, Phaser.GameObjects.Image>();
  private readonly labels = new Map<string, Phaser.GameObjects.Text>();
  private readonly loadingTextures = new Set<string>();
  private readonly missingTextures = new Set<string>();
  private readonly hexTileMaskHelper: HexTileMaskHelper;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    private readonly mapData: MapData,
    private readonly productionSystem: ProductionSystem,
  ) {
    this.hexTileMaskHelper = new HexTileMaskHelper(scene, tileMap);
    this.rebuildAll();
  }

  rebuildAll(): void {
    const seen = new Set<string>();

    for (const row of this.mapData.tiles) {
      for (const tile of row) {
        if (!this.getTileVisual(tile)) continue;
        const key = this.getCoordKey(tile.x, tile.y);
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
    const key = this.getCoordKey(tileX, tileY);

    if (!tile || !this.getTileVisual(tile)) {
      const existing = this.sprites.get(key);
      if (existing) {
        this.destroyTileSprite(key, existing);
      }
      const label = this.labels.get(key);
      if (label) {
        label.destroy();
        this.labels.delete(key);
      }
      return;
    }

    this.renderTile(tile);
  }

  shutdown(): void {
    for (const sprite of this.sprites.values()) {
      this.hexTileMaskHelper.clearMask(sprite);
      sprite.destroy();
    }
    this.sprites.clear();
    for (const label of this.labels.values()) {
      label.destroy();
    }
    this.labels.clear();
    this.hexTileMaskHelper.destroy();
  }

  private renderTile(tile: Tile): void {
    const visual = this.getTileVisual(tile);
    if (!visual) return;

    const textureKey = this.getTextureKey(visual);
    const coordKey = this.getCoordKey(tile.x, tile.y);
    if (!this.ensureTexture(visual)) {
      const existing = this.sprites.get(coordKey);
      if (existing && !this.scene.textures.exists(textureKey)) {
        this.destroyTileSprite(coordKey, existing);
      }
      return;
    }

    const { x, y } = this.tileMap.tileToWorld(tile.x, tile.y);
    const rect = this.tileMap.getTileRect(tile.x, tile.y);
    let sprite = this.sprites.get(coordKey);
    if (!sprite) {
      sprite = this.scene.add.image(x, y, textureKey);
      sprite.setDepth(TILE_BUILDING_DEPTH);
      this.sprites.set(coordKey, sprite);
    }

    sprite.setTexture(textureKey);
    sprite.setPosition(x, y);
    sprite.setDisplaySize(rect.width * TILE_BUILDING_SCALE, rect.height * TILE_BUILDING_SCALE);
    sprite.setAlpha(visual.constructing ? 0.6 : 1);
    this.hexTileMaskHelper.applyHexMask(sprite, tile.x, tile.y);

    const label = this.labels.get(coordKey);
    if (!visual.constructing) {
      if (label) {
        label.destroy();
        this.labels.delete(coordKey);
      }
      return;
    }

    const progressText = `${this.getConstructionPercent(visual)}%`;
    let text = label;
    if (!text) {
      text = this.scene.add.text(x, y, progressText, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#f6fbff',
        stroke: '#10202b',
        strokeThickness: 4,
        align: 'center',
      });
      text.setOrigin(0.5, 0.5);
      text.setDepth(TILE_BUILDING_TEXT_DEPTH);
      this.labels.set(coordKey, text);
    }

    text.setPosition(x, y);
    text.setText(progressText);
    text.setVisible(true);
  }

  private getConstructionPercent(visual: TileConstructionVisual): number {
    if (!visual.cityId) return 0;

    const entry = this.productionSystem.getQueue(visual.cityId)
      .find((queueEntry) => {
        if (visual.kind === 'building') {
          return queueEntry.item.kind === 'building' && queueEntry.item.buildingType.id === visual.id;
        }
        return queueEntry.item.kind === 'wonder' && queueEntry.item.wonderType.id === visual.id;
      });
    if (!entry || entry.cost <= 0) return 0;
    return Math.max(0, Math.min(100, Math.floor((entry.progress / entry.cost) * 100)));
  }

  private ensureTexture(visual: TileConstructionVisual): boolean {
    const textureKey = this.getTextureKey(visual);
    if (this.scene.textures.exists(textureKey)) return true;
    if (this.loadingTextures.has(textureKey) || this.missingTextures.has(textureKey)) return false;

    const onLoadError = (file: Phaser.Loader.File): void => {
      if (file.key !== textureKey) return;
      this.loadingTextures.delete(textureKey);
      this.missingTextures.add(textureKey);
      this.scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
    };

    this.loadingTextures.add(textureKey);
    this.scene.load.once(`filecomplete-image-${textureKey}`, () => {
      this.loadingTextures.delete(textureKey);
      this.scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
      this.rebuildAll();
    });
    this.scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
    this.scene.load.image(textureKey, this.getSpritePath(visual));
    if (!this.scene.load.isLoading()) {
      this.scene.load.start();
    }
    return false;
  }

  private getTextureKey(visual: TileConstructionVisual): string {
    return `tile_${visual.kind}_${visual.id}`;
  }

  private getSpritePath(visual: TileConstructionVisual): string {
    return visual.kind === 'building'
      ? getBuildingSpritePath(visual.id)
      : getWonderSpritePath(visual.id);
  }

  private getTileVisual(tile: Tile): TileConstructionVisual | null {
    if (tile.buildingId) {
      return { kind: 'building', id: tile.buildingId, constructing: false };
    }
    if (tile.buildingConstruction) {
      return {
        kind: 'building',
        id: tile.buildingConstruction.buildingId,
        cityId: tile.buildingConstruction.cityId,
        constructing: true,
      };
    }
    if (tile.wonderId) {
      return { kind: 'wonder', id: tile.wonderId, constructing: false };
    }
    if (tile.wonderConstruction) {
      return {
        kind: 'wonder',
        id: tile.wonderConstruction.wonderId,
        cityId: tile.wonderConstruction.cityId,
        constructing: true,
      };
    }
    return null;
  }

  private destroyTileSprite(key: string, sprite: Phaser.GameObjects.Image): void {
    this.hexTileMaskHelper.clearMask(sprite);
    sprite.destroy();
    this.sprites.delete(key);
  }

  private getCoordKey(x: number, y: number): string {
    return `${x},${y}`;
  }
}
