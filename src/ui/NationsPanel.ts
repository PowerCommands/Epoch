import Phaser from 'phaser';
import { NationManager } from '../systems/NationManager';
import { ResourceSystem } from '../systems/ResourceSystem';
import { MapData } from '../types/map';

const MARGIN = 16;
const PADDING = 12;
const ROW_HEIGHT = 24;
const SWATCH_SIZE = 12;
const BG_COLOR = 0x000000;
const BG_ALPHA = 0.6;

/**
 * NationsPanel — fast panel i övre högra hörnet som listar alla nationer
 * med färgmarkering, antal ägda tiles och guldmängd.
 */
export class NationsPanel {
  private readonly nationManager: NationManager;
  private readonly mapData: MapData;
  private readonly labels: Phaser.GameObjects.Text[] = [];

  constructor(
    scene: Phaser.Scene,
    nationManager: NationManager,
    mapData: MapData,
    resourceSystem: ResourceSystem,
  ) {
    this.nationManager = nationManager;
    this.mapData = mapData;

    const nations = nationManager.getAllNations();
    const panelWidth = 280;
    const panelHeight = PADDING * 2 + nations.length * ROW_HEIGHT;
    const { width: screenWidth } = scene.scale;
    const panelX = screenWidth - panelWidth - MARGIN;
    const panelY = MARGIN;

    scene.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, BG_COLOR, BG_ALPHA)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);

    for (let i = 0; i < nations.length; i++) {
      const nation = nations[i];
      const rowY = panelY + PADDING + i * ROW_HEIGHT;

      scene.add
        .rectangle(
          panelX + PADDING,
          rowY + ROW_HEIGHT / 2,
          SWATCH_SIZE,
          SWATCH_SIZE,
          nation.color,
          1,
        )
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(101);

      const label = scene.add
        .text(panelX + PADDING + SWATCH_SIZE + 8, rowY + ROW_HEIGHT / 2, '', {
          fontSize: '13px',
          color: '#e8e8e8',
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(101);

      this.labels.push(label);
    }

    this.refresh();

    // Uppdatera vid varje resursändring
    resourceSystem.on(() => this.refresh());
  }

  /** Räkna om och uppdatera texten. */
  refresh(): void {
    const nations = this.nationManager.getAllNations();
    for (let i = 0; i < nations.length; i++) {
      const nation = nations[i];
      const count = this.nationManager.getTileCount(nation.id, this.mapData);
      const res = this.nationManager.getResources(nation.id);
      this.labels[i].setText(`${nation.name} (${count} tiles) — ${res.gold}g`);
    }
  }
}
