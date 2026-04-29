import Phaser from 'phaser';
import type { Unit } from '../../entities/Unit';
import { getImprovementById } from '../../data/improvements';
import type { NationManager } from '../../systems/NationManager';
import type { SelectionManager } from '../../systems/SelectionManager';
import type { UnitManager } from '../../systems/UnitManager';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

const DEPTH = 1500;
const PADDING_X = 10;
const PADDING_Y = 8;
const LINE_GAP = 2;
const FONT_FAMILY = 'sans-serif';
const FONT_SIZE = '12px';
const TITLE_FONT_SIZE = '13px';
const TEXT_COLOR = '#e6ecf2';
const TITLE_COLOR = '#f2d38b';
const BG_COLOR = 0x071019;
const BG_ALPHA = 0.92;
const BORDER_COLOR = 0xd8e2ee;
const BORDER_ALPHA = 0.42;
const CURSOR_OFFSET_X = 16;
const CURSOR_OFFSET_Y = 16;
const SCREEN_MARGIN = 8;

/**
 * Screen-space tooltip that surfaces unit data while the mouse is over a
 * unit on the world map. Pure renderer — does not mutate gameplay state
 * and does not consume pointer input.
 */
export class UnitHoverDiagnosticHud {
  private readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly border: Phaser.GameObjects.Rectangle;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly handlePointerMove: (pointer: Phaser.Input.Pointer) => void;
  private readonly handleUnitChanged: () => void;
  private hoveredUnitId: string | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    addOwned: AddOwned,
    private readonly selectionManager: SelectionManager,
    private readonly unitManager: UnitManager,
    private readonly nationManager: NationManager,
  ) {
    this.background = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 200, 100, BG_COLOR, BG_ALPHA))
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.border = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 200, 100))
      .setOrigin(0, 0)
      .setStrokeStyle(1, BORDER_COLOR, BORDER_ALPHA)
      .setFillStyle(0x000000, 0)
      .setScrollFactor(0);
    this.titleText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: TITLE_FONT_SIZE,
      color: TITLE_COLOR,
    }))
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.bodyText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: FONT_SIZE,
      color: TEXT_COLOR,
      lineSpacing: LINE_GAP,
    }))
      .setOrigin(0, 0)
      .setScrollFactor(0);

    this.container = addOwned(new Phaser.GameObjects.Container(scene, 0, 0))
      .setDepth(DEPTH)
      .setScrollFactor(0)
      .setVisible(false);
    this.container.add([this.background, this.border, this.titleText, this.bodyText]);

    this.selectionManager.onHoverChanged((hovered) => {
      if (hovered?.kind === 'unit') {
        this.showForUnit(hovered.unit);
      } else {
        this.hide();
      }
    });

    this.handlePointerMove = (pointer) => {
      this.lastPointerX = pointer.x;
      this.lastPointerY = pointer.y;
      if (this.hoveredUnitId !== null) this.layout();
    };
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);

    // Re-render content when the hovered unit's state changes (e.g. build
    // progress ticks during the AI turn while the player keeps hovering).
    this.handleUnitChanged = () => {
      if (this.hoveredUnitId === null) return;
      const unit = this.unitManager.getUnit(this.hoveredUnitId);
      if (unit === undefined) {
        this.hide();
        return;
      }
      this.refreshContent(unit);
    };
    this.unitManager.onUnitChanged(() => this.handleUnitChanged());
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    this.container.destroy();
    this.background.destroy();
    this.border.destroy();
    this.titleText.destroy();
    this.bodyText.destroy();
  }

  private showForUnit(unit: Unit): void {
    this.hoveredUnitId = unit.id;
    this.refreshContent(unit);
    this.container.setVisible(true);
    this.layout();
  }

  private hide(): void {
    this.hoveredUnitId = null;
    this.container.setVisible(false);
  }

  private refreshContent(unit: Unit): void {
    const nation = this.nationManager.getNation(unit.ownerId);
    const ownerName = nation?.name ?? unit.ownerId;
    const lines: string[] = [];
    lines.push(`Owner: ${ownerName}`);
    lines.push(`HP: ${unit.health} / ${unit.unitType.baseHealth}`);
    lines.push(`Strength: ${unit.unitType.baseStrength}`);
    if ((unit.unitType.rangedStrength ?? 0) > 0) {
      lines.push(`Ranged: ${unit.unitType.rangedStrength}`);
    }
    lines.push(`Status: ${unit.actionStatus}`);
    if (unit.unitType.maxImprovementCharges !== undefined) {
      const remaining = unit.improvementCharges ?? unit.unitType.maxImprovementCharges;
      lines.push(`Charges: ${remaining}/${unit.unitType.maxImprovementCharges}`);
    }
    if (unit.isBuildingImprovement() && unit.buildAction !== undefined) {
      const name = getImprovementById(unit.buildAction.improvementId)?.name ?? unit.buildAction.improvementId;
      const percent = clampPercent(unit.buildAction.progress, unit.buildAction.requiredProgress);
      lines.push(`Building: ${name} (${percent}%)`);
    }

    this.titleText.setText(unit.name);
    this.bodyText.setText(lines.join('\n'));
    this.layout();
  }

  private layout(): void {
    const titleHeight = this.titleText.height;
    const bodyHeight = this.bodyText.height;
    const contentWidth = Math.max(this.titleText.width, this.bodyText.width);
    const width = contentWidth + PADDING_X * 2;
    const height = titleHeight + LINE_GAP + bodyHeight + PADDING_Y * 2;

    this.background.setSize(width, height);
    this.border.setSize(width, height);
    this.titleText.setPosition(PADDING_X, PADDING_Y);
    this.bodyText.setPosition(PADDING_X, PADDING_Y + titleHeight + LINE_GAP);

    const screenWidth = this.scene.scale.width;
    const screenHeight = this.scene.scale.height;
    let x = this.lastPointerX + CURSOR_OFFSET_X;
    let y = this.lastPointerY + CURSOR_OFFSET_Y;
    if (x + width + SCREEN_MARGIN > screenWidth) {
      x = this.lastPointerX - CURSOR_OFFSET_X - width;
    }
    if (y + height + SCREEN_MARGIN > screenHeight) {
      y = this.lastPointerY - CURSOR_OFFSET_Y - height;
    }
    x = Math.max(SCREEN_MARGIN, x);
    y = Math.max(SCREEN_MARGIN, y);
    this.container.setPosition(x, y);
  }
}

function clampPercent(progress: number, required: number): number {
  if (required <= 0) return 0;
  const ratio = progress / required;
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.min(100, Math.floor(ratio * 100)));
}
