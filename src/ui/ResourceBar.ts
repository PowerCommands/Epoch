import Phaser from 'phaser';
import { NationManager } from '../systems/NationManager';
import { TurnManager } from '../systems/TurnManager';
import { ResourceSystem } from '../systems/ResourceSystem';

const PANEL_WIDTH = 280;
const PANEL_HEIGHT = 50;
const PADDING = 10;
const MARGIN_LEFT = 10;
const MARGIN_TOP = 10;
const SWATCH_SIZE = 12;
const BG_COLOR = 0x000000;
const BG_ALPHA = 0.6;
const GOLD_COLOR = '#f0c040';

/**
 * ResourceBar — visar den aktiva nationens guld i övre vänstra hörnet.
 * Uppdateras via turnStart- och resourceChanged-events.
 */
export class ResourceBar {
  private readonly nationManager: NationManager;
  private readonly nationSwatch: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private activeNationId: string;

  constructor(
    scene: Phaser.Scene,
    nationManager: NationManager,
    turnManager: TurnManager,
    resourceSystem: ResourceSystem,
  ) {
    this.nationManager = nationManager;
    this.activeNationId = turnManager.getCurrentNation().id;

    scene.add
      .rectangle(MARGIN_LEFT, MARGIN_TOP, PANEL_WIDTH, PANEL_HEIGHT, BG_COLOR, BG_ALPHA)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.nationSwatch = scene.add
      .rectangle(
        MARGIN_LEFT + PADDING,
        MARGIN_TOP + PANEL_HEIGHT / 2,
        SWATCH_SIZE,
        SWATCH_SIZE,
        0xffffff,
        1,
      )
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(101);

    this.label = scene.add
      .text(MARGIN_LEFT + PADDING + SWATCH_SIZE + 8, MARGIN_TOP + PANEL_HEIGHT / 2, '', {
        fontSize: '16px',
        fontStyle: 'bold',
        color: GOLD_COLOR,
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(101);

    // Initiera med nuvarande värden
    this.refresh();

    // Uppdatera vid turbyte och resursändringar
    turnManager.on('turnStart', (e) => {
      this.activeNationId = e.nation.id;
      this.refresh();
    });
    resourceSystem.on(() => this.refresh());
  }

  private refresh(): void {
    const nation = this.nationManager.getNation(this.activeNationId);
    if (nation !== undefined) {
      this.nationSwatch.setFillStyle(nation.color, 1);
    }

    const res = this.nationManager.getResources(this.activeNationId);
    this.label.setText(`Gold: ${res.gold} (+${res.goldPerTurn}/turn)`);
  }
}
