import { constructionVisualForTerrain } from './rendering/ConstructionVisual';
import { AmbientSprites } from './rendering/AmbientSprites';
import Phaser from 'phaser';
import { TileMap } from './TileMap';
import type { ProductionSystem } from './ProductionSystem';
import { TileType, type MapData, type Tile } from '../types/map';
import { HexTileMaskHelper } from './HexTileMaskHelper';
import { getBuildingSpritePath, getWonderSpritePath } from '../utils/assetPaths';
import { StructureDamageEffects } from '../renderers/StructureDamageEffects';

const TILE_BUILDING_DEPTH = 14;
const TILE_BUILDING_SCALE = 0.9;
type VisualState = 'building' | 'normal' | 'broken';
type TileConstructionVisual = { kind: 'building' | 'wonder'; id: string; state: VisualState };

/** All state is derived from tiles and the canonical broken-state provider.
 * Texture-load callbacks always re-resolve current state (including fog). */
export class TileBuildingRenderer {
  private readonly sprites = new Map<string, Phaser.GameObjects.Image>();
  private readonly loadingTextures = new Map<string, () => void>();
  private readonly missingTextures = new Set<string>();
  private readonly hexTileMaskHelper: HexTileMaskHelper;
  private readonly damageEffects: StructureDamageEffects;
  private visibilityPredicate: (x: number, y: number) => boolean = () => true;
  private brokenPredicate: (x: number, y: number) => boolean = () => false;
  private disposed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tileMap: TileMap,
    private readonly mapData: MapData,
    _productionSystem: ProductionSystem,
  ) {
    this.hexTileMaskHelper = new HexTileMaskHelper(scene, tileMap);
    this.damageEffects = new StructureDamageEffects(scene, tileMap, TILE_BUILDING_DEPTH + 0.1,
      (x, y) => this.visibilityPredicate(x, y));
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.rebuildAll();
  }

  setVisibilityPredicate(predicate: (x: number, y: number) => boolean): void {
    this.visibilityPredicate = predicate;
    this.rebuildAll();
  }

  setBrokenPredicate(predicate: (x: number, y: number) => boolean): void {
    this.brokenPredicate = predicate;
    this.rebuildAll();
  }

  rebuildAll(): void {
    if (this.disposed) return;
    const seen = new Set<string>();
    for (const row of this.mapData.tiles) for (const tile of row) {
      if (!this.getTileVisual(tile) || !this.visibilityPredicate(tile.x, tile.y)) continue;
      seen.add(this.key(tile.x, tile.y));
      this.renderTile(tile);
    }
    for (const key of this.sprites.keys()) if (!seen.has(key)) this.clearTile(key);
  }

  refreshTile(x: number, y: number): void {
    if (this.disposed) return;
    const tile = this.mapData.tiles[y]?.[x];
    if (!tile || !this.getTileVisual(tile) || !this.visibilityPredicate(x, y)) {
      this.clearTile(this.key(x, y));
      return;
    }
    this.renderTile(tile);
  }

  shutdown(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    for (const cleanup of this.loadingTextures.values()) cleanup();
    this.loadingTextures.clear();
    for (const key of this.sprites.keys()) this.clearTile(key);
    this.damageEffects.shutdown();
    this.hexTileMaskHelper.destroy();
  }

  private renderTile(tile: Tile): void {
    const visual = this.getTileVisual(tile);
    if (!visual) return;
    const key = this.key(tile.x, tile.y);
    const broken = visual.state === 'broken';
    const construction=visual.state==='building'?constructionVisualForTerrain(tile.type):undefined;
    const texture = construction?.key??`tile_${visual.kind}_${visual.id}${broken ? '-broken' : ''}`;
    const path = construction?.path??(visual.kind === 'building'
      ? getBuildingSpritePath(visual.id, broken) : getWonderSpritePath(visual.id, broken));
    // Remove previous-state overlays immediately, even while a new image loads.
    if (!broken) this.damageEffects.remove(key);
    if (!this.ensureTexture(texture, path)) {
      this.clearTile(key);
      return;
    }
    // Warm the counterpart once a structure is represented on the map, so
    // subsequent sabotage/repair normally swaps textures without a network wait.
    if(!construction) this.ensureTexture(`tile_${visual.kind}_${visual.id}${broken ? '' : '-broken'}`,
      visual.kind === 'building' ? getBuildingSpritePath(visual.id, !broken) : getWonderSpritePath(visual.id, !broken));
    const { x, y } = this.tileMap.tileToWorld(tile.x, tile.y);
    const rect = this.tileMap.getTileRect(tile.x, tile.y);
    let sprite = this.sprites.get(key);
    if (!sprite) {
      sprite = this.scene.add.image(x, y, texture).setDepth(TILE_BUILDING_DEPTH);
      this.sprites.set(key, sprite);
    }
    sprite.setTexture(texture).setPosition(x, y);
    const scale=!construction && visual.kind==='building' && visual.id==='library'?1.45:TILE_BUILDING_SCALE;
    sprite.setDisplaySize(rect.width * scale, rect.height * scale);
    this.hexTileMaskHelper.applyHexMask(sprite, tile.x, tile.y);
    if (!sprite.getData('ambientAttached')) {
      sprite.setData('ambientAttached', true);
      AmbientSprites.forScene(this.scene).attach(sprite, visual.kind, key, () => [tile.x, tile.y],
        () => {
          const current = this.mapData.tiles[tile.y]?.[tile.x];
          return !!current && !!this.getTileVisual(current) && this.getTileVisual(current)?.state !== 'broken' && this.visibilityPredicate(tile.x, tile.y);
        });
    }
    this.damageEffects.set(key, tile.x, tile.y, broken,
      tile.type !== TileType.Ocean && tile.type !== TileType.Coast);
  }

  private ensureTexture(key: string, path: string): boolean {
    if (this.scene.textures.exists(key)) return true;
    if (this.loadingTextures.has(key) || this.missingTextures.has(key)) return false;
    const event = `filecomplete-image-${key}`;
    const cleanup = (): void => {
      this.scene.load.off(event, complete);
      this.scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, error);
      this.loadingTextures.delete(key);
    };
    const complete = (): void => {
      cleanup();
      if (!this.disposed) this.rebuildAll();
    };
    const error = (file: Phaser.Loader.File): void => {
      if (file.key !== key) return;
      cleanup();
      this.missingTextures.add(key);
    };
    this.loadingTextures.set(key, cleanup);
    this.scene.load.once(event, complete);
    this.scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, error);
    this.scene.load.image(key, path);
    if (!this.scene.load.isLoading()) this.scene.load.start();
    return false;
  }

  private getTileVisual(tile: Tile): TileConstructionVisual | null {
    const completedState = (): VisualState => this.brokenPredicate(tile.x, tile.y) ? 'broken' : 'normal';
    if (tile.buildingConstruction) return { kind: 'building', id: tile.buildingConstruction.buildingId, state: 'building' };
    if (tile.wonderConstruction) return { kind: 'wonder', id: tile.wonderConstruction.wonderId, state: 'building' };
    if (tile.buildingId) return { kind: 'building', id: tile.buildingId, state: completedState() };
    if (tile.wonderId) return { kind: 'wonder', id: tile.wonderId, state: completedState() };
    return null;
  }

  private clearTile(key: string): void {
    const sprite = this.sprites.get(key);
    if (sprite) {
      this.hexTileMaskHelper.clearMask(sprite);
      sprite.destroy();
      this.sprites.delete(key);
    }
    this.damageEffects.remove(key);
  }

  private key(x: number, y: number): string { return `${x},${y}`; }
}
