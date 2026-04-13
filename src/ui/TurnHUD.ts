import Phaser from 'phaser';
import { TurnManager } from '../systems/TurnManager';

const PANEL_WIDTH = 280;
const PANEL_HEIGHT = 60;
const BG_COLOR = 0x000000;
const BG_ALPHA = 0.6;

/**
 * TurnHUD — panel i övre mitten som visar nuvarande varv och aktiv nation.
 * Uppdateras via turnStart-event, inte polling.
 */
export class TurnHUD {
  private readonly roundLabel: Phaser.GameObjects.Text;
  private readonly nationLabel: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, turnManager: TurnManager) {
    const { width } = scene.scale;
    const panelX = (width - PANEL_WIDTH) / 2;
    const panelY = 12;

    scene.add
      .rectangle(
        panelX, panelY,
        PANEL_WIDTH, PANEL_HEIGHT,
        BG_COLOR, BG_ALPHA,
      )
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.roundLabel = scene.add
      .text(panelX + PANEL_WIDTH / 2, panelY + 14, '', {
        fontSize: '16px',
        color: '#c8c8c8',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(101);

    this.nationLabel = scene.add
      .text(panelX + PANEL_WIDTH / 2, panelY + 36, '', {
        fontSize: '17px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(101);

    // Initiera med nuvarande tillstånd
    this.refresh(turnManager);

    // Prenumerera på framtida turstarter
    turnManager.on('turnStart', () => this.refresh(turnManager));
  }

  private refresh(tm: TurnManager): void {
    this.roundLabel.setText(`Round ${tm.getCurrentRound()}`);

    const nation = tm.getCurrentNation();
    this.nationLabel.setText(`${nation.name}'s Turn`);
    this.nationLabel.setColor(`#${nation.color.toString(16).padStart(6, '0')}`);
  }
}
