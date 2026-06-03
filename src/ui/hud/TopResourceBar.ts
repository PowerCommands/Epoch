import Phaser from 'phaser';
import type { ScreenRect } from '../../types/screenRect';
import type { HudResourceEntry } from './NationHudDataProvider';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

const DEPTH = 140;
const EDGE_MARGIN = 16;
const ENTRY_GAP = 8;
const ENTRY_HEIGHT = 34;
const ICON_SIZE = 20;
const ICON_TEXT_GAP = 6;
const HUD_TEXT_RESOLUTION = getHudTextResolution();

// Gold reward emphasis (count-up + temporary highlight) tuning.
const GOLD_COUNT_UP_MS = 700;
const GOLD_HIGHLIGHT_HOLD_MS = 3000;
const GOLD_HIGHLIGHT_SCALE = 1.18;
const GOLD_HIGHLIGHT_COLOR = '#ffe27a';

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
  // While a gold reward animation owns the gold entry's text/style, setEntries
  // updates the stored value but leaves the visible text to the animation so the
  // count-up/highlight isn't clobbered by a routine HUD refresh.
  private goldRewardActive = false;

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
      view.text.setVisible(true);
      // The gold reward animation owns the gold text + color while it runs.
      if (!(this.goldRewardActive && value.key === 'gold')) {
        view.text.setText(formatEntryText(value));
        view.text.setColor(value.textColor ?? '#f4f1e7');
      }
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

  /**
   * Screen-space rectangle of a visible resource entry (e.g. 'gold'), or null
   * when that entry is not currently shown. Lets overlays anchor to the live
   * laid-out position instead of recomputing it.
   */
  getEntryRect(key: HudResourceEntry['key']): ScreenRect | null {
    for (let index = 0; index < this.entries.length; index += 1) {
      const value = this.values[index];
      const view = this.entries[index];
      if (value?.key !== key || !view.background.visible) continue;
      const width = view.background.displayWidth;
      const height = view.background.displayHeight;
      // Entry backgrounds use a (0,0) origin, so x/y is the top-left corner.
      return {
        centerX: view.background.x + width / 2,
        centerY: view.background.y + height / 2,
        width,
        height,
      };
    }
    return null;
  }

  /**
   * Plays the gold-gain feedback on the existing gold entry: the displayed value
   * counts up from (current - amount) to the current value, and the text is
   * emphasized (scale + highlight color) for ~3s before reverting. Safe no-op if
   * the gold entry is not currently shown. Reuses the live gold text object — no
   * parallel indicator is created.
   */
  playGoldReward(amount: number): void {
    const index = this.findEntryIndex('gold');
    if (index === null) return;
    const view = this.entries[index];
    const value = this.values[index];
    const target = typeof value.value === 'number' ? value.value : Number(value.value) || 0;
    const start = Math.max(0, target - amount);

    this.goldRewardActive = true;
    view.text.setColor(GOLD_HIGHLIGHT_COLOR);

    // Count the visible number up to its new value.
    const counter = { n: start };
    this.scene.tweens.add({
      targets: counter,
      n: target,
      duration: GOLD_COUNT_UP_MS,
      ease: 'Cubic.out',
      onUpdate: () => {
        const current = this.values[index];
        if (current?.key !== 'gold') return;
        view.text.setText(formatEntryText({ ...current, value: Math.round(counter.n) }));
      },
      onComplete: () => {
        const current = this.values[index];
        if (current?.key === 'gold') view.text.setText(formatEntryText(current));
      },
    });

    // Briefly emphasize, then ease back to normal scale/color after ~3s.
    this.scene.tweens.add({
      targets: view.text,
      scale: GOLD_HIGHLIGHT_SCALE,
      duration: 180,
      ease: 'Sine.out',
      yoyo: true,
      hold: GOLD_HIGHLIGHT_HOLD_MS,
      onComplete: () => {
        view.text.setScale(1);
        this.goldRewardActive = false;
        const current = this.values[index];
        if (current?.key === 'gold') {
          view.text.setColor(current.textColor ?? '#f4f1e7');
          view.text.setText(formatEntryText(current));
        }
      },
    });
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

  private findEntryIndex(key: HudResourceEntry['key']): number | null {
    for (let index = 0; index < this.values.length; index += 1) {
      if (this.values[index]?.key === key && this.entries[index]?.background.visible) return index;
    }
    return null;
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

  if (value.key === 'gold' && value.upkeep !== undefined && value.upkeep > 0) {
    return `${value.icon} ${value.value} (${formatSigned(value.delta)} - ${value.upkeep})`;
  }

  return `${value.icon} ${value.value} (${formatSigned(value.delta)})`;
}

function getHudTextResolution(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}
