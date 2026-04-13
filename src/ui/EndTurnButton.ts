import Phaser from 'phaser';
import { TurnManager } from '../systems/TurnManager';

const BTN_WIDTH = 200;
const BTN_HEIGHT = 60;
const BG_COLOR_IDLE = 0x333333;
const BG_COLOR_HOVER = 0x4a4a4a;
const BTN_DEPTH = 110;
const CORNER_RADIUS = 8;

/**
 * EndTurnButton — klickbar knapp i nedre mitten.
 * Visar "END TURN" och vilken nation som har turen härnäst.
 * Uppdateras via turnStart-event.
 */
export class EndTurnButton {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly mainLabel: Phaser.GameObjects.Text;
  private readonly nextLabel: Phaser.GameObjects.Text;
  private readonly hitZone: Phaser.GameObjects.Zone;

  // Sparas så hover-effekten kan rita om bakgrunden
  private readonly btnX: number;
  private readonly btnY: number;

  constructor(scene: Phaser.Scene, turnManager: TurnManager) {
    const { width, height } = scene.scale;
    this.btnX = (width - BTN_WIDTH) / 2;
    this.btnY = height - BTN_HEIGHT - 25;

    // Bakgrund (rundad rektangel via Graphics)
    this.bg = scene.add.graphics().setScrollFactor(0).setDepth(BTN_DEPTH);
    this.drawBg(BG_COLOR_IDLE);

    // "END TURN"-text
    this.mainLabel = scene.add
      .text(width / 2, this.btnY + 18, 'END TURN', {
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(BTN_DEPTH + 1);

    // "Next: ..."-text
    this.nextLabel = scene.add
      .text(width / 2, this.btnY + 42, '', {
        fontSize: '13px',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(BTN_DEPTH + 1);

    // Osynlig zon för klick/hover
    this.hitZone = scene.add
      .zone(this.btnX + BTN_WIDTH / 2, this.btnY + BTN_HEIGHT / 2, BTN_WIDTH, BTN_HEIGHT)
      .setScrollFactor(0)
      .setDepth(BTN_DEPTH + 2)
      .setInteractive({ useHandCursor: true });

    this.hitZone.on(Phaser.Input.Events.POINTER_OVER, () => this.drawBg(BG_COLOR_HOVER));
    this.hitZone.on(Phaser.Input.Events.POINTER_OUT, () => this.drawBg(BG_COLOR_IDLE));
    this.hitZone.on(Phaser.Input.Events.POINTER_DOWN, () => turnManager.endCurrentTurn());

    // Initiera "Next: ..." med nuvarande state
    this.refreshNext(turnManager);

    // Uppdatera vid varje ny tur
    turnManager.on('turnStart', () => this.refreshNext(turnManager));
  }

  private refreshNext(tm: TurnManager): void {
    const next = tm.getNextNation();
    this.nextLabel.setText(`Next: ${next.name}`);
    this.nextLabel.setColor(`#${next.color.toString(16).padStart(6, '0')}`);
  }

  private drawBg(color: number): void {
    this.bg.clear();
    this.bg.fillStyle(color, 0.9);
    this.bg.fillRoundedRect(this.btnX, this.btnY, BTN_WIDTH, BTN_HEIGHT, CORNER_RADIUS);
    // Tunn konturlinje
    this.bg.lineStyle(1, 0x666666, 0.8);
    this.bg.strokeRoundedRect(this.btnX, this.btnY, BTN_WIDTH, BTN_HEIGHT, CORNER_RADIUS);
  }
}
