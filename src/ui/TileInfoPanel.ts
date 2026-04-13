import Phaser from 'phaser';
import { Tile } from '../types/map';
import { NationManager } from '../systems/NationManager';

const PANEL_WIDTH = 200;
const PANEL_HEIGHT = 110;
const PADDING = 12;
const MARGIN = 16;
const BG_COLOR = 0x000000;
const BG_ALPHA = 0.6;

/**
 * TileInfoPanel — fast panel i nedre högra hörnet som visar info
 * om den aktuellt valda tilen, inklusive ägande nation.
 * Döljs när något annat än en tile är valt.
 */
export class TileInfoPanel {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly nationManager: NationManager;

  constructor(scene: Phaser.Scene, nationManager: NationManager) {
    this.nationManager = nationManager;

    const { width, height } = scene.scale;
    const panelX = width - PANEL_WIDTH - MARGIN;
    const panelY = height - PANEL_HEIGHT - MARGIN;

    this.bg = scene.add
      .rectangle(panelX, panelY, PANEL_WIDTH, PANEL_HEIGHT, BG_COLOR, BG_ALPHA)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.label = scene.add
      .text(panelX + PADDING, panelY + PADDING, '', {
        fontSize: '16px',
        color: '#e8e8e8',
        lineSpacing: 6,
      })
      .setScrollFactor(0)
      .setDepth(101);

    // Dölj vid start
    this.setVisible(false);
  }

  /** Uppdatera panelen. null döljer den. */
  update(tile: Tile | null): void {
    if (tile === null) {
      this.setVisible(false);
      return;
    }

    const typeName = tile.type.charAt(0).toUpperCase() + tile.type.slice(1);

    let ownerName = 'Unclaimed';
    if (tile.ownerId !== undefined) {
      const nation = this.nationManager.getNation(tile.ownerId);
      if (nation !== undefined) {
        ownerName = nation.name;
      }
    }

    this.label.setText([
      `Tile (${tile.x}, ${tile.y})`,
      `Type: ${typeName}`,
      `Owner: ${ownerName}`,
    ]);
    this.label.setColor('#e8e8e8');
    this.setVisible(true);
  }

  private setVisible(visible: boolean): void {
    this.bg.setVisible(visible);
    this.label.setVisible(visible);
  }
}
