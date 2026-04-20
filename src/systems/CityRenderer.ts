import Phaser from 'phaser';
import { TileMap } from './TileMap';
import { CityManager } from './CityManager';
import { NationManager } from './NationManager';
import { CITY_BASE_HEALTH } from '../data/cities';
import type { City } from '../entities/City';

const CITY_DEPTH = 15;

const HP_BAR_WIDTH = 40;
const HP_BAR_HEIGHT = 4;
const HP_BAR_OFFSET_Y = 20;
const HP_BAR_BG_COLOR = 0x400000;

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
  private readonly hpBars = new Map<string, Phaser.GameObjects.Graphics>();

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

    for (const city of cityManager.getAllCities()) {
      this.renderCity(city);
    }
  }

  getCityContainer(cityId: string): Phaser.GameObjects.Container | undefined {
    return this.containers.get(cityId);
  }

  /**
   * Destroy every rendered container + HP bar and re-render from the
   * live CityManager. Used after a save is loaded, when the city set
   * has been replaced wholesale.
   */
  rebuildAll(): void {
    for (const container of this.containers.values()) container.destroy();
    this.containers.clear();
    for (const gfx of this.hpBars.values()) gfx.destroy();
    this.hpBars.clear();

    for (const city of this.cityManager.getAllCities()) {
      this.renderCity(city);
      this.refreshHpBar(city);
    }
  }

  /**
   * Re-render city symbol (e.g. after ownership change) and HP bar.
   */
  refreshCity(city: City): void {
    const oldContainer = this.containers.get(city.id);
    if (oldContainer) {
      oldContainer.destroy();
      this.containers.delete(city.id);
    }

    this.renderCity(city);
    this.refreshHpBar(city);
  }

  private renderCity(city: City): void {
    const nation = this.nationManager.getNation(city.ownerId);
    if (!nation) return;

    const { x: worldX, y: worldY } = this.tileMap.tileToWorld(city.tileX, city.tileY);

    const sprite = this.scene.add.image(0, 0, 'city_default');
    sprite.setTint(nation.color);

    if (city.isCapital) {
      sprite.setScale(1.2);
    }

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

  refreshHpBar(city: City): void {
    if (city.health >= CITY_BASE_HEALTH) {
      const existing = this.hpBars.get(city.id);
      if (existing) {
        existing.destroy();
        this.hpBars.delete(city.id);
      }
      return;
    }

    const { x, y } = this.tileMap.tileToWorld(city.tileX, city.tileY);
    let gfx = this.hpBars.get(city.id);
    if (!gfx) {
      gfx = this.scene.add.graphics();
      gfx.setDepth(CITY_DEPTH + 1);
      this.hpBars.set(city.id, gfx);
    }

    gfx.clear();
    gfx.setPosition(x, y);

    const hpRatio = city.health / CITY_BASE_HEALTH;
    const barX = -HP_BAR_WIDTH / 2;
    const barY = HP_BAR_OFFSET_Y;

    gfx.fillStyle(HP_BAR_BG_COLOR, 0.8);
    gfx.fillRect(barX, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT);

    let color: number;
    if (hpRatio > 0.66) {
      color = 0x40c040;
    } else if (hpRatio > 0.33) {
      color = 0xd0c040;
    } else {
      color = 0xd04040;
    }

    gfx.fillStyle(color, 1);
    gfx.fillRect(barX, barY, HP_BAR_WIDTH * hpRatio, HP_BAR_HEIGHT);
  }
}
