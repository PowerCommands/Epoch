import Phaser from 'phaser';
import { TileMap } from './TileMap';
import type { ProductionSystem } from './ProductionSystem';
import type { MapData, Tile } from '../types/map';
import { HexTileMaskHelper } from './HexTileMaskHelper';

const TILE_BUILDING_DEPTH = 14;
const TILE_BUILDING_TEXT_DEPTH = 14.5;
const TILE_BUILDING_SCALE = 0.9;

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
        if (!tile.buildingId && !tile.buildingConstruction) continue;
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

    if (!tile?.buildingId && !tile?.buildingConstruction) {
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
    const buildingId = tile.buildingId ?? tile.buildingConstruction?.buildingId;
    if (!buildingId) return;

    const textureKey = this.getTextureKey(buildingId);
    const coordKey = this.getCoordKey(tile.x, tile.y);
    if (!this.ensureTexture(buildingId)) {
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
    sprite.setAlpha(tile.buildingConstruction ? 0.6 : 1);
    this.hexTileMaskHelper.applyHexMask(sprite, tile.x, tile.y);

    const label = this.labels.get(coordKey);
    if (!tile.buildingConstruction) {
      if (label) {
        label.destroy();
        this.labels.delete(coordKey);
      }
      return;
    }

    const progressText = `${this.getConstructionPercent(tile)}%`;
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

  private getConstructionPercent(tile: Tile): number {
    const construction = tile.buildingConstruction;
    if (!construction) return 0;

    const entry = this.productionSystem.getQueue(construction.cityId)
      .find((queueEntry) => (
        queueEntry.item.kind === 'building' && queueEntry.item.buildingType.id === construction.buildingId
      ));
    if (!entry || entry.cost <= 0) return 0;
    return Math.max(0, Math.min(100, Math.floor((entry.progress / entry.cost) * 100)));
  }

  private ensureTexture(buildingId: string): boolean {
    const textureKey = this.getTextureKey(buildingId);
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
    this.scene.load.image(textureKey, `assets/sprites/buildings/${buildingId}.png`);
    if (!this.scene.load.isLoading()) {
      this.scene.load.start();
    }
    return false;
  }

  private getTextureKey(buildingId: string): string {
    return `tile_building_${buildingId}`;
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
