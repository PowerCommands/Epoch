import Phaser from 'phaser';
import type { HudResourceEntry } from './NationHudDataProvider';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

const DEPTH = 140;
const EDGE_MARGIN = 16;
const ENTRY_GAP = 8;
const ENTRY_HEIGHT = 34;
const ENTRY_COUNT = 7;
const HUD_TEXT_RESOLUTION = getHudTextResolution();

interface ResourceEntryView {
  background: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

export class TopResourceBar {
  private readonly entries: ResourceEntryView[] = [];
  private readonly values: HudResourceEntry[] = [];
  private readonly tooltipBackground: Phaser.GameObjects.Rectangle;
  private readonly tooltipText: Phaser.GameObjects.Text;
  private hoveredIndex: number | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    addOwned: AddOwned,
  ) {
    for (let index = 0; index < ENTRY_COUNT; index += 1) {
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
        .setScrollFactor(0)
        .setResolution(HUD_TEXT_RESOLUTION);

      this.entries.push({ background, text });

      background.on(Phaser.Input.Events.POINTER_OVER, () => {
        this.hoveredIndex = index;
        this.refreshTooltip();
      });
      background.on(Phaser.Input.Events.POINTER_OUT, () => {
        if (this.hoveredIndex === index) {
          this.hoveredIndex = null;
          this.hideTooltip();
        }
      });
    }

    this.tooltipBackground = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x081018, 0.96))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 20)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0xb59a5a, 0.65)
      .setVisible(false);

    this.tooltipText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#f4f1e7',
      wordWrap: { width: 280, useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 21)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);
  }

  setEntries(entries: HudResourceEntry[]): void {
    this.values.length = 0;
    this.values.push(...entries);
    for (let index = 0; index < this.entries.length; index += 1) {
      const view = this.entries[index];
      const value = entries[index];
      if (!value) {
        view.background.setVisible(false);
        view.background.disableInteractive();
        view.text.setVisible(false);
        continue;
      }

      view.background.setVisible(true);
      view.text.setVisible(true);
      view.text.setText(formatEntryText(value));
      view.text.setColor(value.textColor ?? '#f4f1e7');
      if (value.tooltip) {
        if (!view.background.input?.enabled) view.background.setInteractive({ cursor: 'help' });
      } else {
        view.background.disableInteractive();
      }
    }
    this.refreshTooltip();
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

      view.background.setPosition(Math.round(x), Math.round(y)).setDisplaySize(width, ENTRY_HEIGHT);
      view.text.setPosition(Math.round(x + 12), Math.round(y + (ENTRY_HEIGHT / 2)));

      x += width + ENTRY_GAP;
    }
    this.refreshTooltip();
  }

  destroy(): void {
    for (const entry of this.entries) {
      entry.background.destroy();
      entry.text.destroy();
    }
    this.tooltipBackground.destroy();
    this.tooltipText.destroy();
  }

  private refreshTooltip(): void {
    if (this.hoveredIndex === null) {
      this.hideTooltip();
      return;
    }

    const value = this.values[this.hoveredIndex];
    const view = this.entries[this.hoveredIndex];
    if (!value?.tooltip || !view?.background.visible) {
      this.hideTooltip();
      return;
    }

    const paddingX = 10;
    const paddingY = 7;
    this.tooltipText.setText(value.tooltip);
    const width = this.tooltipText.width + paddingX * 2;
    const height = this.tooltipText.height + paddingY * 2;
    const left = Phaser.Math.Clamp(
      view.background.x,
      EDGE_MARGIN,
      Math.max(EDGE_MARGIN, this.scene.scale.width - width - EDGE_MARGIN),
    );
    const top = view.background.y + ENTRY_HEIGHT + 6;

    this.tooltipBackground
      .setPosition(Math.round(left), Math.round(top))
      .setDisplaySize(width, height)
      .setVisible(true);
    this.tooltipText
      .setPosition(Math.round(left + paddingX), Math.round(top + paddingY))
      .setVisible(true);
  }

  private hideTooltip(): void {
    this.tooltipBackground.setVisible(false);
    this.tooltipText.setVisible(false);
  }
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

function formatEntryText(value: HudResourceEntry): string {
  if (value.key === 'turn') {
    return `${value.value}`;
  }

  if (value.displayMode === 'deltaOnly') {
    return `${value.icon} ${formatSigned(value.delta)}/turn`;
  }

  if (value.displayMode === 'happinessState') {
    const numeric = typeof value.value === 'number' ? value.value : 0;
    const stateLabel = value.stateLabel ?? '';
    return `${value.icon} ${formatSigned(numeric)}${stateLabel ? ` (${stateLabel})` : ''}`;
  }

  return `${value.icon} ${value.value} (${formatSigned(value.delta)})`;
}

function getHudTextResolution(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}
