import Phaser from 'phaser';
import { TileMap } from './TileMap';
import { CityManager } from './CityManager';
import { NationManager } from './NationManager';
import type { City } from '../entities/City';
import { HexTileMaskHelper } from './HexTileMaskHelper';

const CITY_DEPTH = 15;
const CITY_TILE_FILL_SCALE = 0.9;
const CAPITAL_SCALE_MULTIPLIER = 1.2;

const HIT_RADIUS = 20;

/**
 * CityRenderer draws a sprite for each city on the map.
 *
 * Uses `city_default` texture with nation color tint.
 * Capital cities rendered at 1.2x scale.
 */
export class CityRenderer {
  private readonly scene: Phaser.Scene;
  private readonly tileMap: TileMap;
  private readonly cityManager: CityManager;
  private readonly nationManager: NationManager;
  private readonly containers = new Map<string, Phaser.GameObjects.Container>();
  private readonly hexTileMaskHelper: HexTileMaskHelper;

  constructor(
    scene: Phaser.Scene,
    tileMap: TileMap,
    cityManager: CityManager,
    nationManager: NationManager,
  ) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.cityManager = cityManager;
    this.nationManager = nationManager;
    this.hexTileMaskHelper = new HexTileMaskHelper(scene, tileMap);

    for (const city of cityManager.getAllCities()) {
      this.renderCity(city);
    }
  }

  getCityContainer(cityId: string): Phaser.GameObjects.Container | undefined {
    return this.containers.get(cityId);
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

    const sprite = this.scene.add.image(0, 0, 'city_default');
    const scaleMultiplier = city.isCapital ? CAPITAL_SCALE_MULTIPLIER : 1;
    sprite.setDisplaySize(
      rect.width * CITY_TILE_FILL_SCALE * scaleMultiplier,
      rect.height * CITY_TILE_FILL_SCALE * scaleMultiplier,
    );
    this.hexTileMaskHelper.applyHexMask(sprite, city.tileX, city.tileY);

    const container = this.scene.add.container(worldX, worldY, [sprite]);
    container.setDepth(CITY_DEPTH);

    // Interactive hit area — circle matching old behavior
    container.setSize(HIT_RADIUS * 2, HIT_RADIUS * 2);
    container.setInteractive(
      new Phaser.Geom.Circle(0, 0, HIT_RADIUS),
      Phaser.Geom.Circle.Contains,
    );

    this.containers.set(city.id, container);
  }
}
