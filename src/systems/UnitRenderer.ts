import Phaser from 'phaser';
import { TileMap } from './TileMap';
import { UnitManager } from './UnitManager';
import { NationManager } from './NationManager';

const UNIT_DEPTH = 18;
const UNIT_RADIUS = 11;
const OUTLINE_THICKNESS = 3;
const CENTER_RADIUS = 4;

const HP_BAR_WIDTH = 32;
const HP_BAR_HEIGHT = 4;
const HP_BAR_OFFSET_Y = UNIT_RADIUS + 6;
const HP_BAR_BG_COLOR = 0x400000;

/**
 * UnitRenderer ritar kartans enheter, HP-bars, och håller en stabil
 * unitId -> container-map.
 */
export class UnitRenderer {
  private readonly scene: Phaser.Scene;
  private readonly tileMap: TileMap;
  private readonly unitManager: UnitManager;
  private readonly nationManager: NationManager;
  private readonly containers = new Map<string, Phaser.GameObjects.Container>();
  private readonly hpBars = new Map<string, Phaser.GameObjects.Graphics>();

  constructor(
    scene: Phaser.Scene,
    tileMap: TileMap,
    unitManager: UnitManager,
    nationManager: NationManager,
  ) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.unitManager = unitManager;
    this.nationManager = nationManager;

    for (const unit of unitManager.getAllUnits()) {
      this.renderUnit(unit.id);
    }

    unitManager.onUnitChanged((event) => {
      if (event.reason === 'created') {
        this.renderUnit(event.unit.id);
      } else if (event.reason === 'removed') {
        this.removeUnit(event.unit.id);
      } else if (event.reason === 'damaged') {
        this.refreshHpBar(event.unit.id);
      } else if (event.reason === 'moved') {
        this.refreshUnitPosition(event.unit.id);
      }
    });
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

    // Move HP bar too
    const hpBar = this.hpBars.get(unitId);
    if (hpBar) {
      hpBar.setPosition(x, y);
    }
  }

  removeUnit(unitId: string): void {
    const container = this.containers.get(unitId);
    if (container) {
      container.destroy();
      this.containers.delete(unitId);
    }

    const hpBar = this.hpBars.get(unitId);
    if (hpBar) {
      hpBar.destroy();
      this.hpBars.delete(unitId);
    }
  }

  private renderUnit(unitId: string): void {
    if (this.containers.has(unitId)) return;

    const unit = this.unitManager.getUnit(unitId);
    if (unit === undefined) return;

    const nation = this.nationManager.getNation(unit.ownerId);
    if (nation === undefined) return;

    const container = this.createUnitSymbol(nation.color);
    const { x, y } = this.tileMap.tileToWorld(unit.tileX, unit.tileY);
    container.setPosition(x, y);
    container.setDepth(UNIT_DEPTH);

    this.containers.set(unit.id, container);
  }

  private refreshHpBar(unitId: string): void {
    const unit = this.unitManager.getUnit(unitId);
    if (!unit) return;

    // Only show HP bar if damaged
    if (unit.health >= unit.unitType.baseHealth) {
      const existing = this.hpBars.get(unitId);
      if (existing) {
        existing.destroy();
        this.hpBars.delete(unitId);
      }
      return;
    }

    const { x, y } = this.tileMap.tileToWorld(unit.tileX, unit.tileY);
    let gfx = this.hpBars.get(unitId);
    if (!gfx) {
      gfx = this.scene.add.graphics();
      gfx.setDepth(UNIT_DEPTH + 1);
      this.hpBars.set(unitId, gfx);
    }

    gfx.clear();
    gfx.setPosition(x, y);

    const hpRatio = unit.health / unit.unitType.baseHealth;
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
