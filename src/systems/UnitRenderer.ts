import Phaser from 'phaser';
import { TileMap } from './TileMap';
import { UnitManager } from './UnitManager';
import { NationManager } from './NationManager';

const UNIT_DEPTH = 18;
const UNIT_RADIUS = 11;
const OUTLINE_THICKNESS = 3;
const CENTER_RADIUS = 4;

/**
 * UnitRenderer ritar kartans enheter och håller en stabil unitId -> container-map.
 */
export class UnitRenderer {
  private readonly scene: Phaser.Scene;
  private readonly tileMap: TileMap;
  private readonly unitManager: UnitManager;
  private readonly containers = new Map<string, Phaser.GameObjects.Container>();

  constructor(
    scene: Phaser.Scene,
    tileMap: TileMap,
    unitManager: UnitManager,
    nationManager: NationManager,
  ) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.unitManager = unitManager;

    for (const unit of unitManager.getAllUnits()) {
      const nation = nationManager.getNation(unit.ownerId);
      if (nation === undefined) continue;

      const container = this.createUnitSymbol(nation.color);
      const { x, y } = tileMap.tileToWorld(unit.tileX, unit.tileY);
      container.setPosition(x, y);
      container.setDepth(UNIT_DEPTH);

      this.containers.set(unit.id, container);
    }
  }

  getUnitContainer(unitId: string): Phaser.GameObjects.Container | undefined {
    return this.containers.get(unitId);
  }

  refreshUnitPosition(unitId: string): void {
    const unit = this.unitManager.getUnit(unitId);
    const container = this.containers.get(unitId);
    if (unit === undefined || container === undefined) return;

    const { x, y } = this.tileMap.tileToWorld(unit.tileX, unit.tileY);
    container.setPosition(x, y);
  }

  private createUnitSymbol(nationColor: number): Phaser.GameObjects.Container {
    const gfx = this.scene.add.graphics();

    gfx.fillStyle(nationColor, 1);
    gfx.fillCircle(0, 0, UNIT_RADIUS);

    gfx.lineStyle(OUTLINE_THICKNESS, 0xffffff, 1);
    gfx.strokeCircle(0, 0, UNIT_RADIUS);

    gfx.fillStyle(0x000000, 1);
    gfx.fillCircle(0, 0, CENTER_RADIUS);

    const container = this.scene.add.container(0, 0, [gfx]);
    container.setSize(UNIT_RADIUS * 2, UNIT_RADIUS * 2);
    container.setInteractive(
      new Phaser.Geom.Circle(0, 0, UNIT_RADIUS + OUTLINE_THICKNESS),
      Phaser.Geom.Circle.Contains,
    );

    return container;
  }
}
