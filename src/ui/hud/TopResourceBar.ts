import Phaser from 'phaser';
import type { HudResourceEntry } from './NationHudDataProvider';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

const DEPTH = 140;
const EDGE_MARGIN = 16;
const ENTRY_GAP = 8;
const ENTRY_HEIGHT = 34;

interface ResourceEntryView {
  background: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

export class TopResourceBar {
  private readonly entries: ResourceEntryView[] = [];
  private readonly values: HudResourceEntry[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    addOwned: AddOwned,
  ) {
    for (let index = 0; index < 4; index += 1) {
      const background = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, ENTRY_HEIGHT, 0x0b1118, 0.84))
        .setOrigin(0, 0)
        .setDepth(DEPTH)
        .setScrollFactor(0)
        .setStrokeStyle(1, 0xb59a5a, 0.45);

      const text = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
        fontFamily: 'sans-serif',
        fontSize: '16px',
        color: '#f4f1e7',
      }))
        .setOrigin(0, 0.5)
        .setDepth(DEPTH + 1)
        .setScrollFactor(0);

      this.entries.push({ background, text });
    }
  }

  setEntries(entries: HudResourceEntry[]): void {
    this.values.length = 0;
    this.values.push(...entries);
    for (let index = 0; index < this.entries.length; index += 1) {
      const view = this.entries[index];
      const value = entries[index];
      if (!value) {
        view.background.setVisible(false);
        view.text.setVisible(false);
        continue;
      }

      view.background.setVisible(true);
      view.text.setVisible(true);
      view.text.setText(`${value.icon} ${value.value} (${formatSigned(value.delta)})`);
    }
  }

  layout(): void {
    let x = EDGE_MARGIN;
    const y = EDGE_MARGIN;

    for (let index = 0; index < this.entries.length; index += 1) {
      const view = this.entries[index];
      const value = this.values[index];
      if (!value) continue;

      const textWidth = Math.ceil(view.text.width);
      const width = textWidth + 24;

      view.background.setPosition(x, y).setDisplaySize(width, ENTRY_HEIGHT);
      view.text.setPosition(x + 12, y + ENTRY_HEIGHT / 2);

      x += width + ENTRY_GAP;
    }
  }

  destroy(): void {
    for (const entry of this.entries) {
      entry.background.destroy();
      entry.text.destroy();
    }
  }
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}
