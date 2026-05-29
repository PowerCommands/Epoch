import Phaser from 'phaser';
import { TileMap } from './TileMap';
import { CityManager } from './CityManager';
import { NationManager } from './NationManager';
import type { City } from '../entities/City';
import { HexTileMaskHelper } from './HexTileMaskHelper';
import type { Era } from '../data/technologies';
import { getCitySpriteKey } from '../utils/assetPaths';

const CITY_DEPTH = 15;
const CITY_TILE_FILL_SCALE = 0.9;
const CAPITAL_SCALE_MULTIPLIER = 1.2;

const HIT_RADIUS = 20;

/**
 * CityRenderer draws a sprite for each city on the map.
 *
 * Uses an era-specific city texture based on the owning nation's current era.
 * Original and residence capitals use separate indicators so conquest
 * preserves historical identity without implying political control.
 */
export class CityRenderer {
  private readonly scene: Phaser.Scene;
  private readonly tileMap: TileMap;
  private readonly cityManager: CityManager;
  private readonly nationManager: NationManager;
  private readonly getNationEra: (nationId: string) => Era;
  private readonly containers = new Map<string, Phaser.GameObjects.Container>();
  private readonly hexTileMaskHelper: HexTileMaskHelper;
  private visibilityPredicate: (tileX: number, tileY: number) => boolean = () => true;

  constructor(
    scene: Phaser.Scene,
    tileMap: TileMap,
    cityManager: CityManager,
    nationManager: NationManager,
    getNationEra: (nationId: string) => Era,
  ) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.cityManager = cityManager;
    this.nationManager = nationManager;
    this.getNationEra = getNationEra;
    this.hexTileMaskHelper = new HexTileMaskHelper(scene, tileMap);

    for (const city of cityManager.getAllCities()) {
      this.renderCity(city);
    }
  }

  getCityContainer(cityId: string): Phaser.GameObjects.Container | undefined {
    return this.containers.get(cityId);
  }

  setVisibilityPredicate(predicate: (tileX: number, tileY: number) => boolean): void {
    this.visibilityPredicate = predicate;
  }

  /** Update visibility of all city containers without rebuilding them. */
  refreshAllVisibility(): void {
    for (const city of this.cityManager.getAllCities()) {
      this.containers.get(city.id)?.setVisible(this.visibilityPredicate(city.tileX, city.tileY));
    }
  }

  /**
   * Destroy every rendered container and re-render from the
   * live CityManager. Used after a save is loaded, when the city set
   * has been replaced wholesale.
   */
  rebuildAll(): void {
    for (const container of this.containers.values()) container.destroy();
    this.containers.clear();

    for (const city of this.cityManager.getAllCities()) {
      this.renderCity(city);
    }
  }

  shutdown(): void {
    for (const container of this.containers.values()) {
      container.destroy();
    }
    this.containers.clear();
    this.hexTileMaskHelper.destroy();
  }

  /**
   * Re-render city symbol (e.g. after ownership change).
   */
  refreshCity(city: City): void {
    const oldContainer = this.containers.get(city.id);
    if (oldContainer) {
      oldContainer.destroy();
      this.containers.delete(city.id);
    }

    this.renderCity(city);
  }

  private renderCity(city: City): void {
    const nation = this.nationManager.getNation(city.ownerId);
    if (!nation) return;

    const { x: worldX, y: worldY } = this.tileMap.tileToWorld(city.tileX, city.tileY);
    const rect = this.tileMap.getTileRect(city.tileX, city.tileY);

    const sprite = this.scene.add.image(0, 0, getCitySpriteKey(this.getNationEra(city.ownerId)));
    const scaleMultiplier = city.isResidenceCapital ? CAPITAL_SCALE_MULTIPLIER : 1;
    sprite.setDisplaySize(
      rect.width * CITY_TILE_FILL_SCALE * scaleMultiplier,
      rect.height * CITY_TILE_FILL_SCALE * scaleMultiplier,
    );
    this.hexTileMaskHelper.applyHexMask(sprite, city.tileX, city.tileY);

    const children: Phaser.GameObjects.GameObject[] = [sprite];
    if (city.isOriginalCapital) {
      children.push(this.createOriginalCapitalRing(rect.width, rect.height));
    }
    if (city.isResidenceCapital) {
      children.push(this.createResidenceCrown(rect.width, rect.height));
    }

    const container = this.scene.add.container(worldX, worldY, children);
    container.setDepth(CITY_DEPTH);

    // Interactive hit area — circle matching old behavior
    container.setSize(HIT_RADIUS * 2, HIT_RADIUS * 2);
    container.setInteractive(
      new Phaser.Geom.Circle(0, 0, HIT_RADIUS),
      Phaser.Geom.Circle.Contains,
    );

    container.setVisible(this.visibilityPredicate(city.tileX, city.tileY));
    this.containers.set(city.id, container);
  }

  private createOriginalCapitalRing(tileWidth: number, tileHeight: number): Phaser.GameObjects.Graphics {
    const ring = this.scene.add.graphics();
    ring.lineStyle(2, 0xf6e58d, 0.92);
    ring.strokeEllipse(0, 0, tileWidth * 0.82, tileHeight * 0.64);
    ring.lineStyle(1, 0x332b11, 0.65);
    ring.strokeEllipse(0, 0, tileWidth * 0.9, tileHeight * 0.7);
    return ring;
  }

  private createResidenceCrown(tileWidth: number, tileHeight: number): Phaser.GameObjects.Graphics {
    const crown = this.scene.add.graphics();
    const y = -tileHeight * 0.34;
    const w = tileWidth * 0.34;
    crown.fillStyle(0xf8d36b, 0.96);
    crown.lineStyle(1, 0x43330d, 0.85);
    crown.beginPath();
    crown.moveTo(-w / 2, y + 8);
    crown.lineTo(-w * 0.32, y - 2);
    crown.lineTo(-w * 0.1, y + 5);
    crown.lineTo(0, y - 6);
    crown.lineTo(w * 0.1, y + 5);
    crown.lineTo(w * 0.32, y - 2);
    crown.lineTo(w / 2, y + 8);
    crown.closePath();
    crown.fillPath();
    crown.strokePath();
    return crown;
  }
}
