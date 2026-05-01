import Phaser from 'phaser';
import { TileMap } from './TileMap';
import { UnitManager } from './UnitManager';
import { NationManager } from './NationManager';
import type { Unit } from '../entities/Unit';
import { getUnitActionSpriteKey, getUnitSpriteKey } from '../utils/assetPaths';
import { isEmbarked } from './UnitMovementRules';
import type { MapData } from '../types/map';

const UNIT_DEPTH = 18;
const PROGRESS_TEXT_DEPTH = UNIT_DEPTH + 1.5;
const UNIT_TILE_FILL_SCALE = 0.9;

const HP_BAR_WIDTH = 32;
const HP_BAR_HEIGHT = 4;
const HP_BAR_OFFSET_Y = 20;
const HP_BAR_BG_COLOR = 0x400000;

const HIT_RADIUS = 16;

const FALLBACK_TEXTURE_KEY = 'unit_warrior';

interface UnitVisual {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  maskGraphics: Phaser.GameObjects.Graphics;
  progressText?: Phaser.GameObjects.Text;
}

/**
 * UnitRenderer draws sprites for units on the map.
 *
 * Uses per-unit-type textures. When a unit has an active action with an
 * override sprite (e.g. worker_action_improvement), the override is shown
 * and a build-progress percentage is drawn over it.
 */
export class UnitRenderer {
  private readonly scene: Phaser.Scene;
  private readonly tileMap: TileMap;
  private readonly unitManager: UnitManager;
  private readonly nationManager: NationManager;
  private readonly visuals = new Map<string, UnitVisual>();
  private readonly hpBars = new Map<string, Phaser.GameObjects.Graphics>();

  constructor(
    scene: Phaser.Scene,
    tileMap: TileMap,
    unitManager: UnitManager,
    nationManager: NationManager,
    private readonly mapData: MapData,
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
        this.refreshUnitVisual(event.unit.id);
      } else if (event.reason === 'actionChanged') {
        this.refreshUnitVisual(event.unit.id);
      }
    });
  }

  getUnitContainer(unitId: string): Phaser.GameObjects.Container | undefined {
    return this.visuals.get(unitId)?.container;
  }

  /**
   * Destroy every rendered container + HP bar and re-render from the
   * live UnitManager. Used after a save is loaded, when the unit set
   * has been replaced wholesale.
   */
  rebuildAll(): void {
    for (const visual of this.visuals.values()) this.destroyVisual(visual);
    this.visuals.clear();
    for (const gfx of this.hpBars.values()) gfx.destroy();
    this.hpBars.clear();

    for (const unit of this.unitManager.getAllUnits()) {
      this.renderUnit(unit.id);
      this.refreshHpBar(unit.id);
    }
  }

  refreshUnitPosition(unitId: string): void {
    const unit = this.unitManager.getUnit(unitId);
    const visual = this.visuals.get(unitId);
    if (unit === undefined || visual === undefined) return;

    const { x, y } = this.getUnitWorldPosition(unitId);
    visual.container.setPosition(x, y);
    visual.container.setDepth(unit.transportId ? UNIT_DEPTH + 2 : UNIT_DEPTH);
    visual.container.setScale(unit.transportId ? 0.75 : 1);
    visual.maskGraphics.setPosition(x, y);
    visual.maskGraphics.setScale(unit.transportId ? 0.75 : 1);

    const hpBar = this.hpBars.get(unitId);
    if (hpBar) {
      hpBar.setPosition(x, y);
    }
  }

  /**
   * Re-evaluate which sprite + progress overlay this unit should show.
   * Called on action-status changes (build start, build complete, sleep
   * toggle) and on movement (unit may have moved away from a build site).
   */
  refreshUnitVisual(unitId: string): void {
    const unit = this.unitManager.getUnit(unitId);
    const visual = this.visuals.get(unitId);
    if (unit === undefined || visual === undefined) return;

    const textureKey = this.resolveTextureKey(unit.unitType.id, unit.actionStatus, unit.buildAction !== undefined);
    if (visual.sprite.texture.key !== textureKey) {
      visual.sprite.setTexture(textureKey);
    }
    this.applyUnitTileSize(unit, visual.sprite);
    this.applyDerivedVisualState(unit, visual);

    if (unit.isBuildingImprovement() && unit.buildAction !== undefined) {
      const percent = clampPercent(unit.buildAction.progress, unit.buildAction.requiredProgress);
      const label = `${percent}%`;
      if (visual.progressText === undefined) {
        const text = this.scene.add.text(0, 0, label, {
          fontFamily: 'sans-serif',
          fontSize: '12px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3,
        });
        text.setOrigin(0.5, 0.5);
        text.setDepth(PROGRESS_TEXT_DEPTH);
        visual.container.add(text);
        visual.progressText = text;
      } else {
        visual.progressText.setText(label);
      }
    } else if (visual.progressText !== undefined) {
      visual.progressText.destroy();
      visual.progressText = undefined;
    }
  }

  removeUnit(unitId: string): void {
    const visual = this.visuals.get(unitId);
    if (visual) {
      this.destroyVisual(visual);
      this.visuals.delete(unitId);
    }

    const hpBar = this.hpBars.get(unitId);
    if (hpBar) {
      hpBar.destroy();
      this.hpBars.delete(unitId);
    }
  }

  private renderUnit(unitId: string): void {
    if (this.visuals.has(unitId)) return;

    const unit = this.unitManager.getUnit(unitId);
    if (unit === undefined) return;

    const nation = this.nationManager.getNation(unit.ownerId);
    if (nation === undefined) return;

    const textureKey = this.resolveTextureKey(unit.unitType.id, unit.actionStatus, unit.buildAction !== undefined);
    const sprite = this.scene.add.image(0, 0, textureKey);
    const maskGraphics = this.scene.add.graphics();
    sprite.setMask(maskGraphics.createGeometryMask());
    this.applyUnitTileSize(unit, sprite, maskGraphics);

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
    maskGraphics.setPosition(x, y);
    maskGraphics.setScale(unit.transportId ? 0.75 : 1);

    const visual: UnitVisual = { container, sprite, maskGraphics };
    this.visuals.set(unit.id, visual);

    this.refreshUnitVisual(unit.id);
  }

  private applyDerivedVisualState(unit: Unit, visual: UnitVisual): void {
    if (isEmbarked(unit, this.mapData)) {
      visual.sprite.setTint(0x66ccff);
      visual.sprite.setAlpha(0.88);
      return;
    }

    visual.sprite.clearTint();
    visual.sprite.setAlpha(1);
  }

  private resolveTextureKey(unitTypeId: string, actionStatus: string, hasBuildAction: boolean): string {
    if (actionStatus === 'building' && hasBuildAction) {
      const actionKey = getUnitActionSpriteKey(unitTypeId, 'improvement');
      if (this.scene.textures.exists(actionKey)) return actionKey;
    }
    const baseKey = getUnitSpriteKey(unitTypeId);
    if (this.scene.textures.exists(baseKey)) return baseKey;
    return FALLBACK_TEXTURE_KEY;
  }

  private applyUnitTileSize(
    unit: { tileX: number; tileY: number },
    sprite: Phaser.GameObjects.Image,
    maskGraphics?: Phaser.GameObjects.Graphics,
  ): void {
    const rect = this.tileMap.getTileRect(unit.tileX, unit.tileY);
    const size = Math.min(rect.width, rect.height) * UNIT_TILE_FILL_SCALE;
    sprite.setDisplaySize(size, size);

    const mask = maskGraphics ?? sprite.getData('circleMask') as Phaser.GameObjects.Graphics | undefined;
    if (mask === undefined) return;
    mask.clear();
    mask.fillStyle(0xffffff, 1);
    mask.fillCircle(0, 0, size / 2 - 1);
    mask.setVisible(false);
    sprite.setData('circleMask', mask);
  }

  private destroyVisual(visual: UnitVisual): void {
    visual.sprite.clearMask(false);
    visual.container.destroy();
    visual.maskGraphics.destroy();
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

function clampPercent(progress: number, required: number): number {
  if (required <= 0) return 0;
  const ratio = progress / required;
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.min(100, Math.floor(ratio * 100)));
}
