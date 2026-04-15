import Phaser from 'phaser';
import { TileMap } from './TileMap';
import { CityManager } from './CityManager';
import { NationManager } from './NationManager';
import { CITY_BASE_HEALTH } from '../data/cities';
import type { City } from '../entities/City';

const CITY_DEPTH = 15;
const OUTER_RADIUS = 14;
const RING_THICKNESS = 4;
const INNER_DOT_RADIUS = 4;

const HP_BAR_WIDTH = 40;
const HP_BAR_HEIGHT = 4;
const HP_BAR_OFFSET_Y = OUTER_RADIUS + 6;
const HP_BAR_BG_COLOR = 0x400000;

/**
 * CityRenderer ritar en symbol för varje stad på kartan.
 *
 * Varje stad representeras av en Phaser Container som innehåller:
 *   1. Vit fylld cirkel (bas)
 *   2. Ring i nationens färg
 *   3. Svart prick i mitten (kontrast)
 *
 * Containern lever i världskoordinater och skalar/flyttas automatiskt
 * med kameran.
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
   * Rita om en stads symbol (t.ex. efter ägarbyte) och HP-bar.
   */
  refreshCity(city: City): void {
    // Destroy old container
    const oldContainer = this.containers.get(city.id);
    if (oldContainer) {
      oldContainer.destroy();
      this.containers.delete(city.id);
    }

    // Rerender with current owner color
    this.renderCity(city);

    // Refresh HP bar
    this.refreshHpBar(city);
  }

  private renderCity(city: City): void {
    const nation = this.nationManager.getNation(city.ownerId);
    if (!nation) return;

    const { x: worldX, y: worldY } = this.tileMap.tileToWorld(city.tileX, city.tileY);
    const container = this.createCitySymbol(nation.color);
    container.setPosition(worldX, worldY);
    container.setDepth(CITY_DEPTH);

    this.containers.set(city.id, container);
  }

  private refreshHpBar(city: City): void {
    // Only show if damaged
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

    // Background
    gfx.fillStyle(HP_BAR_BG_COLOR, 0.8);
    gfx.fillRect(barX, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT);

    // Foreground — color based on HP ratio
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

  private createCitySymbol(
    nationColor: number,
  ): Phaser.GameObjects.Container {
    const gfx = this.scene.add.graphics();

    // 1. Vit fylld cirkel
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(0, 0, OUTER_RADIUS);

    // 2. Ring i nationens färg
    gfx.lineStyle(RING_THICKNESS, nationColor, 1);
    gfx.strokeCircle(0, 0, OUTER_RADIUS);

    // 3. Svart prick i mitten
    gfx.fillStyle(0x000000, 1);
    gfx.fillCircle(0, 0, INNER_DOT_RADIUS);

    const container = this.scene.add.container(0, 0, [gfx]);

    // Cirkulär hit area för klick/hover
    container.setSize(OUTER_RADIUS * 2, OUTER_RADIUS * 2);
    container.setInteractive(
      new Phaser.Geom.Circle(0, 0, OUTER_RADIUS + RING_THICKNESS / 2),
      Phaser.Geom.Circle.Contains,
    );

    return container;
  }
}
