import Phaser from 'phaser';
import type { HudResourceEntry } from './NationHudDataProvider';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

const DEPTH = 140;
const EDGE_MARGIN = 16;
const ENTRY_GAP = 8;
const ENTRY_HEIGHT = 34;
const ICON_SIZE = 20;
const ICON_TEXT_GAP = 6;
const HUD_TEXT_RESOLUTION = getHudTextResolution();

interface ResourceEntryView {
  background: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
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
    private readonly addOwned: AddOwned,
  ) {
    this.tooltipBackground = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x081018, 0.96))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 20)
      .setScrollFactor(0)
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
    this.ensureEntryCount(entries.length);
    this.values.length = 0;
    this.values.push(...entries);
    for (let index = 0; index < this.entries.length; index += 1) {
      const view = this.entries[index];
      const value = entries[index];
      if (!value) {
        view.background.setVisible(false);
        view.background.disableInteractive();
        view.icon.setVisible(false);
        view.text.setVisible(false);
        continue;
      }

      view.background.setVisible(true);
      if (value.iconKey) {
        view.icon
          .setTexture(value.iconKey)
          .setVisible(true);
        const iconScale = Math.min(ICON_SIZE / view.icon.frame.width, ICON_SIZE / view.icon.frame.height);
        view.icon.setScale(iconScale);
      } else {
        view.icon.setVisible(false);
      }
      view.text.setText(formatEntryText(value));
      view.text.setColor(value.textColor ?? '#f4f1e7');
      view.text.setVisible(true);
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
      const hasImageIcon = Boolean(value.iconKey);
      const width = textWidth + 24 + (hasImageIcon ? ICON_SIZE + ICON_TEXT_GAP : 0);

      view.background.setPosition(Math.round(x), Math.round(y)).setDisplaySize(width, ENTRY_HEIGHT);
      if (hasImageIcon) {
        view.icon.setPosition(Math.round(x + 12 + (ICON_SIZE / 2)), Math.round(y + (ENTRY_HEIGHT / 2)));
        view.text.setPosition(Math.round(x + 12 + ICON_SIZE + ICON_TEXT_GAP), Math.round(y + (ENTRY_HEIGHT / 2)));
      } else {
        view.text.setPosition(Math.round(x + 12), Math.round(y + (ENTRY_HEIGHT / 2)));
      }

      x += width + ENTRY_GAP;
    }
    this.refreshTooltip();
  }

  destroy(): void {
    for (const entry of this.entries) {
      entry.background.destroy();
      entry.icon.destroy();
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

  private ensureEntryCount(count: number): void {
    while (this.entries.length < count) {
      this.entries.push(this.createEntry(this.entries.length));
    }
  }

  private createEntry(index: number): ResourceEntryView {
    const background = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, 10, ENTRY_HEIGHT, 0x0b1118, 0.84))
      .setOrigin(0, 0)
      .setDepth(DEPTH)
      .setScrollFactor(0);

    const icon = this.addOwned(new Phaser.GameObjects.Image(this.scene, 0, 0, 'resource_horses'))
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setVisible(false);

    const text = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#f4f1e7',
    }))
      .setOrigin(0, 0.5)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION);

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

    return { background, icon, text };
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

  if (value.displayMode === 'valueOnly') {
    return value.icon ? `${value.icon} ${value.value}` : `${value.value}`;
  }

  return `${value.icon} ${value.value} (${formatSigned(value.delta)})`;
}

function getHudTextResolution(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}
