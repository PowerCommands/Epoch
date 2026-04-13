import Phaser from 'phaser';
import { TileMap } from './TileMap';
import { CityManager } from './CityManager';
import { NationManager } from './NationManager';

const CITY_DEPTH = 15;
const OUTER_RADIUS = 14;
const RING_THICKNESS = 4;
const INNER_DOT_RADIUS = 4;

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
  private readonly containers = new Map<string, Phaser.GameObjects.Container>();

  constructor(
    scene: Phaser.Scene,
    tileMap: TileMap,
    cityManager: CityManager,
    nationManager: NationManager,
  ) {
    for (const city of cityManager.getAllCities()) {
      const nation = nationManager.getNation(city.ownerId);
      if (!nation) continue;

      const { x: worldX, y: worldY } = tileMap.tileToWorld(city.tileX, city.tileY);
      const container = this.createCitySymbol(scene, nation.color);
      container.setPosition(worldX, worldY);
      container.setDepth(CITY_DEPTH);

      this.containers.set(city.id, container);
    }
  }

  getCityContainer(cityId: string): Phaser.GameObjects.Container | undefined {
    return this.containers.get(cityId);
  }

  private createCitySymbol(
    scene: Phaser.Scene,
    nationColor: number,
  ): Phaser.GameObjects.Container {
    const gfx = scene.add.graphics();

    // 1. Vit fylld cirkel
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(0, 0, OUTER_RADIUS);

    // 2. Ring i nationens färg
    gfx.lineStyle(RING_THICKNESS, nationColor, 1);
    gfx.strokeCircle(0, 0, OUTER_RADIUS);

    // 3. Svart prick i mitten
    gfx.fillStyle(0x000000, 1);
    gfx.fillCircle(0, 0, INNER_DOT_RADIUS);

    const container = scene.add.container(0, 0, [gfx]);

    // Cirkulär hit area för klick/hover
    container.setSize(OUTER_RADIUS * 2, OUTER_RADIUS * 2);
    container.setInteractive(
      new Phaser.Geom.Circle(0, 0, OUTER_RADIUS + RING_THICKNESS / 2),
      Phaser.Geom.Circle.Contains,
    );

    return container;
  }
}
