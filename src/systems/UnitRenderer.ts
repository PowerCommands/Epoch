import Phaser from 'phaser';
import { TileMap } from './TileMap';
import { UnitManager } from './UnitManager';
import { NationManager } from './NationManager';

const UNIT_DEPTH = 18;

const HP_BAR_WIDTH = 32;
const HP_BAR_HEIGHT = 4;
const HP_BAR_OFFSET_Y = 20;
const HP_BAR_BG_COLOR = 0x400000;

const HIT_RADIUS = 16;

const TEXTURE_MAP: Record<string, string> = {
  warrior: 'unit_warrior',
  archer: 'unit_archer',
  cavalry: 'unit_cavalry',
  settler: 'unit_settler',
  fishing_boat: 'unit_fishing_boat',
  transport_ship: 'unit_transport_ship',
};

/**
 * UnitRenderer draws sprites for units on the map.
 *
 * Uses per-unit-type textures with nation color tint.
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

  /**
   * Destroy every rendered container + HP bar and re-render from the
   * live UnitManager. Used after a save is loaded, when the unit set
   * has been replaced wholesale.
   */
  rebuildAll(): void {
    for (const container of this.containers.values()) container.destroy();
    this.containers.clear();
    for (const gfx of this.hpBars.values()) gfx.destroy();
    this.hpBars.clear();

    for (const unit of this.unitManager.getAllUnits()) {
      this.renderUnit(unit.id);
      this.refreshHpBar(unit.id);
    }
  }

  refreshUnitPosition(unitId: string): void {
    const unit = this.unitManager.getUnit(unitId);
    const container = this.containers.get(unitId);
    if (unit === undefined || container === undefined) return;

    const { x, y } = this.getUnitWorldPosition(unitId);
    container.setPosition(x, y);
    container.setDepth(unit.transportId ? UNIT_DEPTH + 2 : UNIT_DEPTH);
    container.setScale(unit.transportId ? 0.75 : 1);

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

    const textureKey = TEXTURE_MAP[unit.unitType.id] ?? 'unit_warrior';
    const sprite = this.scene.add.image(0, 0, textureKey);
    sprite.setTint(nation.color);

    const container = this.scene.add.container(0, 0, [sprite]);
    container.setSize(HIT_RADIUS * 2, HIT_RADIUS * 2);
    container.setInteractive(
      new Phaser.Geom.Circle(0, 0, HIT_RADIUS),
      Phaser.Geom.Circle.Contains,
    );

    const { x, y } = this.getUnitWorldPosition(unit.id);
    container.setPosition(x, y);
    container.setDepth(unit.transportId ? UNIT_DEPTH + 2 : UNIT_DEPTH);
    container.setScale(unit.transportId ? 0.75 : 1);

    this.containers.set(unit.id, container);
  }

  private refreshHpBar(unitId: string): void {
    const unit = this.unitManager.getUnit(unitId);
    if (!unit) return;

    if (unit.health >= unit.unitType.baseHealth) {
      const existing = this.hpBars.get(unitId);
      if (existing) {
        existing.destroy();
        this.hpBars.delete(unitId);
      }
      return;
    }

    const { x, y } = this.getUnitWorldPosition(unitId);
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

  private getUnitWorldPosition(unitId: string): { x: number; y: number } {
    const unit = this.unitManager.getUnit(unitId);
    if (!unit) return { x: 0, y: 0 };

    const base = this.tileMap.tileToWorld(unit.tileX, unit.tileY);
    if (unit.transportId === undefined) return base;
    return { x: base.x + 12, y: base.y - 12 };
  }
}
