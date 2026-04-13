import Phaser from 'phaser';
import { Unit } from '../entities/Unit';
import { NationManager } from '../systems/NationManager';
import { UnitManager } from '../systems/UnitManager';

const PANEL_WIDTH = 220;
const PANEL_HEIGHT = 130;
const PADDING = 12;
const MARGIN = 16;
const BG_COLOR = 0x000000;
const BG_ALPHA = 0.6;

/**
 * UnitInfoPanel — fast panel i nedre vänstra hörnet.
 * Visas bara när en enhet är vald.
 */
export class UnitInfoPanel {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly nameLabel: Phaser.GameObjects.Text;
  private readonly detailLabel: Phaser.GameObjects.Text;
  private currentUnit: Unit | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly nationManager: NationManager,
    unitManager: UnitManager,
  ) {
    const { height } = scene.scale;
    const panelX = MARGIN;
    const panelY = height - PANEL_HEIGHT - MARGIN;

    this.bg = scene.add
      .rectangle(panelX, panelY, PANEL_WIDTH, PANEL_HEIGHT, BG_COLOR, BG_ALPHA)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.nameLabel = scene.add
      .text(panelX + PADDING, panelY + PADDING, '', {
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#e8e8e8',
      })
      .setScrollFactor(0)
      .setDepth(101);

    this.detailLabel = scene.add
      .text(panelX + PADDING, panelY + PADDING + 32, '', {
        fontSize: '15px',
        color: '#c8c8c8',
        lineSpacing: 6,
      })
      .setScrollFactor(0)
      .setDepth(101);

    this.setVisible(false);

    unitManager.onUnitChanged((event) => {
      if (this.currentUnit?.id === event.unit.id) {
        this.render(event.unit);
      }
    });
  }

  update(unit: Unit | null): void {
    this.currentUnit = unit;
    if (unit === null) {
      this.setVisible(false);
      return;
    }

    this.render(unit);
    this.setVisible(true);
  }

  private render(unit: Unit): void {
    const nation = this.nationManager.getNation(unit.ownerId);
    const ownerName = nation?.name ?? 'Unknown';

    this.nameLabel.setText(unit.name);
    this.detailLabel.setText([
      `Owner: ${ownerName}`,
      `Location: (${unit.tileX}, ${unit.tileY})`,
      `Movement: ${unit.movementPoints} / ${unit.maxMovementPoints}`,
    ]);
  }

  private setVisible(visible: boolean): void {
    this.bg.setVisible(visible);
    this.nameLabel.setVisible(visible);
    this.detailLabel.setVisible(visible);
  }
}
