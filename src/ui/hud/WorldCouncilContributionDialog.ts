import Phaser from 'phaser';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';
import type { WorldCouncilFoundationOffer } from './WorldCouncilFoundationDialog';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

export interface WorldCouncilContributionDialogState {
  readonly organizationName: string;
  readonly nationName: string;
  readonly maxGold: number;
  readonly currentGold: number;
  readonly currentSciencePercent: number;
  readonly currentCulturePercent: number;
  readonly getMaxGold?: (sciencePercent: number, culturePercent: number) => number;
}

const DEPTH = 212;
const PANEL_WIDTH = 448;
const PADDING_X = 26;
const PADDING_Y = 24;
const BUTTON_HEIGHT = 40;
const ROW_GAP = 10;
const BUTTON_GAP = 12;
const PANEL_RADIUS = 14;
const BUTTON_RADIUS = 8;
const CARD_RADIUS = 10;
const CARD_PADDING = 14;
const MIN_PERCENT = 1;
const MAX_PERCENT = 100;
const GOLD_STEP = 100;
const GOLD_BIG_STEP = 1000;
const PERCENT_STEP = 5;
const HUD_TEXT_RESOLUTION = getHudTextResolution();

// Palette borrowed from the city view / start screen so every dialog reads the same.
const COLOR_PANEL_TOP = 0x10283e;
const COLOR_PANEL_BOTTOM = 0x050d16;
const COLOR_BORDER_GOLD = 0xb88a43;
const COLOR_CARD_FILL = 0x030c16;

type ButtonVariant = 'adjust' | 'muted' | 'gold' | 'confirm';

interface ButtonStyle {
  readonly fill: number;
  readonly fillAlpha: number;
  readonly hoverFill: number;
  readonly border: number;
  readonly borderAlpha: number;
  readonly textColor: string;
}

const BUTTON_STYLES: Record<ButtonVariant, ButtonStyle> = {
  adjust: { fill: 0x183148, fillAlpha: 0.85, hoverFill: 0x28465f, border: COLOR_BORDER_GOLD, borderAlpha: 0.5, textColor: '#eef5f2' },
  muted: { fill: 0x111f2f, fillAlpha: 0.85, hoverFill: 0x1b3047, border: 0x6f7f8c, borderAlpha: 0.5, textColor: '#cfdae4' },
  gold: { fill: 0x3a2f18, fillAlpha: 0.9, hoverFill: 0x4a3c1f, border: 0xe8c789, borderAlpha: 0.9, textColor: '#ffe08f' },
  confirm: { fill: 0x21432c, fillAlpha: 0.92, hoverFill: 0x2c5738, border: 0x7bbf6a, borderAlpha: 0.9, textColor: '#eafce6' },
};

interface ButtonSpec {
  readonly label: string;
  readonly variant: ButtonVariant;
  readonly fullWidth?: boolean;
  readonly onClick: () => void;
}

interface DialogButton {
  readonly background: Phaser.GameObjects.Graphics;
  readonly text: Phaser.GameObjects.Text;
  readonly hitArea: Phaser.GameObjects.Zone;
  readonly style: ButtonStyle;
  x: number;
  y: number;
  width: number;
  hovered: boolean;
}

export class WorldCouncilContributionDialog {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly valueCard: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly valueText: Phaser.GameObjects.Text;
  private readonly buttons: DialogButton[] = [];
  // Buttons laid out top-to-bottom; each entry lists the buttons that share a row.
  private readonly rows: DialogButton[][] = [];
  private current: WorldCouncilContributionDialogState | null = null;
  private gold = 0;
  private sciencePercent = MIN_PERCENT;
  private culturePercent = MIN_PERCENT;
  private effectiveMaxGold = 0;
  private confirmListener: ((offer: WorldCouncilFoundationOffer) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    addOwned: AddOwned,
    private readonly worldInputGate: WorldInputGate,
  ) {
    this.overlay = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x000000, 0.55))
      .setOrigin(0, 0)
      .setDepth(DEPTH)
      .setScrollFactor(0)
      .setVisible(false);
    this.panel = addOwned(new Phaser.GameObjects.Graphics(scene))
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setVisible(false);
    this.valueCard = addOwned(new Phaser.GameObjects.Graphics(scene))
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setVisible(false);
    this.titleText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, 'World Council Contributions', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: '24px',
      color: '#e8c789',
      fontStyle: 'bold',
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);
    this.bodyText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: '"Segoe UI", Arial, sans-serif',
      fontSize: '15px',
      color: '#e6edf3',
      lineSpacing: 3,
      wordWrap: { width: PANEL_WIDTH - PADDING_X * 2, useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);
    this.valueText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#f4f1e7',
      lineSpacing: 4,
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);

    const specs: readonly ButtonSpec[][] = [
      [
        { label: 'Gold -1000', variant: 'adjust', onClick: () => this.adjustGold(-GOLD_BIG_STEP) },
        { label: 'Gold +1000', variant: 'adjust', onClick: () => this.adjustGold(GOLD_BIG_STEP) },
      ],
      [
        { label: 'Gold -100', variant: 'adjust', onClick: () => this.adjustGold(-GOLD_STEP) },
        { label: 'Gold +100', variant: 'adjust', onClick: () => this.adjustGold(GOLD_STEP) },
      ],
      [
        { label: 'Science -5%', variant: 'adjust', onClick: () => this.adjustScience(-PERCENT_STEP) },
        { label: 'Science +5%', variant: 'adjust', onClick: () => this.adjustScience(PERCENT_STEP) },
      ],
      [
        { label: 'Culture -5%', variant: 'adjust', onClick: () => this.adjustCulture(-PERCENT_STEP) },
        { label: 'Culture +5%', variant: 'adjust', onClick: () => this.adjustCulture(PERCENT_STEP) },
      ],
      [
        { label: 'Minimum', variant: 'muted', onClick: () => this.minimumContribution() },
        { label: 'Maximum', variant: 'gold', onClick: () => this.maximumContribution() },
      ],
      [
        { label: 'Confirm', variant: 'confirm', fullWidth: true, onClick: () => this.confirm() },
      ],
    ];
    for (const rowSpecs of specs) {
      const row = rowSpecs.map((spec) => this.createButton(addOwned, spec));
      this.rows.push(row);
      this.buttons.push(...row);
    }
  }

  setOnConfirm(listener: (offer: WorldCouncilFoundationOffer) => void): void {
    this.confirmListener = listener;
  }

  show(state: WorldCouncilContributionDialogState): void {
    this.current = state;
    this.sciencePercent = clamp(state.currentSciencePercent, MIN_PERCENT, MAX_PERCENT);
    this.culturePercent = clamp(state.currentCulturePercent, MIN_PERCENT, MAX_PERCENT);
    this.effectiveMaxGold = this.getEffectiveMaxGold();
    this.gold = clamp(state.currentGold, 0, this.effectiveMaxGold);
    this.titleText.setText(`${state.organizationName} Contributions`);
    this.bodyText.setText(`${state.nationName}, choose new ${state.organizationName} contributions. Minimum keeps a symbolic commitment; Maximum commits everything allowed.`);
    this.refreshValues();
    this.setVisible(true);
    this.layout();
  }

  hide(): void {
    this.current = null;
    this.setVisible(false);
  }

  isShowing(): boolean {
    return this.current !== null;
  }

  layout(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    this.overlay.setPosition(0, 0).setDisplaySize(width, height);

    const cardHeight = this.valueText.height + CARD_PADDING * 2;
    const buttonsHeight = this.rows.length * BUTTON_HEIGHT + (this.rows.length - 1) * ROW_GAP;
    const panelHeight = PADDING_Y
      + this.titleText.height + 14
      + this.bodyText.height + 16
      + cardHeight + 20
      + buttonsHeight
      + PADDING_Y;

    const left = Math.round((width - PANEL_WIDTH) / 2);
    const top = Math.round((height - panelHeight) / 2);

    this.drawPanel(left, top, panelHeight);
    this.titleText.setPosition(left + PADDING_X, top + PADDING_Y);
    this.bodyText.setPosition(left + PADDING_X, this.titleText.y + this.titleText.height + 14);

    const cardTop = this.bodyText.y + this.bodyText.height + 16;
    const cardWidth = PANEL_WIDTH - PADDING_X * 2;
    this.drawValueCard(left + PADDING_X, cardTop, cardWidth, cardHeight);
    this.valueText.setPosition(left + PADDING_X + CARD_PADDING, cardTop + CARD_PADDING);

    const fullWidth = PANEL_WIDTH - PADDING_X * 2;
    const halfWidth = Math.floor((fullWidth - BUTTON_GAP) / 2);
    let y = cardTop + cardHeight + 20;
    for (const row of this.rows) {
      if (row.length === 1) {
        this.layoutButton(row[0], left + PADDING_X, y, fullWidth);
      } else {
        this.layoutButton(row[0], left + PADDING_X, y, halfWidth);
        this.layoutButton(row[1], left + PADDING_X + halfWidth + BUTTON_GAP, y, halfWidth);
      }
      y += BUTTON_HEIGHT + ROW_GAP;
    }
  }

  destroy(): void {
    this.overlay.destroy();
    this.panel.destroy();
    this.valueCard.destroy();
    this.titleText.destroy();
    this.bodyText.destroy();
    this.valueText.destroy();
    for (const button of this.buttons) {
      button.background.destroy();
      button.text.destroy();
      button.hitArea.destroy();
    }
  }

  private adjustGold(delta: number): void {
    if (!this.current) return;
    this.effectiveMaxGold = this.getEffectiveMaxGold();
    this.gold = clamp(this.gold + delta, 0, this.effectiveMaxGold);
    this.refreshValues();
  }

  private adjustScience(delta: number): void {
    this.sciencePercent = clamp(this.sciencePercent + delta, MIN_PERCENT, MAX_PERCENT);
    this.effectiveMaxGold = this.getEffectiveMaxGold();
    this.gold = clamp(this.gold, 0, this.effectiveMaxGold);
    this.refreshValues();
  }

  private adjustCulture(delta: number): void {
    this.culturePercent = clamp(this.culturePercent + delta, MIN_PERCENT, MAX_PERCENT);
    this.effectiveMaxGold = this.getEffectiveMaxGold();
    this.gold = clamp(this.gold, 0, this.effectiveMaxGold);
    this.refreshValues();
  }

  private confirm(): void {
    this.confirmListener?.({
      gold: this.gold,
      sciencePercent: this.sciencePercent,
      culturePercent: this.culturePercent,
    });
  }

  private minimumContribution(): void {
    this.confirmListener?.({ gold: 0, sciencePercent: MIN_PERCENT, culturePercent: MIN_PERCENT });
  }

  private maximumContribution(): void {
    if (!this.current) return;
    const sciencePercent = MAX_PERCENT;
    const culturePercent = MAX_PERCENT;
    const maxGold = this.current.getMaxGold?.(sciencePercent, culturePercent) ?? this.current.maxGold;
    this.confirmListener?.({
      gold: clamp(maxGold, 0, this.current.maxGold),
      sciencePercent,
      culturePercent,
    });
  }

  private refreshValues(): void {
    this.effectiveMaxGold = this.getEffectiveMaxGold();
    this.gold = clamp(this.gold, 0, this.effectiveMaxGold);
    this.valueText.setText([
      `Gold:    ${this.gold} / ${this.effectiveMaxGold}`,
      `Science: ${this.sciencePercent}%`,
      `Culture: ${this.culturePercent}%`,
    ].join('\n'));
  }

  private getEffectiveMaxGold(): number {
    if (!this.current) return 0;
    const maxGold = this.current.getMaxGold?.(this.sciencePercent, this.culturePercent) ?? this.current.maxGold;
    return clamp(maxGold, 0, this.current.maxGold);
  }

  private setVisible(visible: boolean): void {
    this.overlay.setVisible(visible);
    this.panel.setVisible(visible);
    this.valueCard.setVisible(visible);
    this.titleText.setVisible(visible);
    this.bodyText.setVisible(visible);
    this.valueText.setVisible(visible);
    for (const button of this.buttons) {
      button.background.setVisible(visible);
      button.text.setVisible(visible);
      button.hitArea.setVisible(visible);
      button.hovered = false;
      this.drawButton(button);
      if (visible) button.hitArea.setInteractive({ cursor: 'pointer' });
      else button.hitArea.disableInteractive();
    }
  }

  private drawPanel(left: number, top: number, panelHeight: number): void {
    this.panel.clear();
    this.panel.fillGradientStyle(COLOR_PANEL_TOP, COLOR_PANEL_TOP, COLOR_PANEL_BOTTOM, COLOR_PANEL_BOTTOM, 0.98);
    this.panel.fillRoundedRect(left, top, PANEL_WIDTH, panelHeight, PANEL_RADIUS);
    this.panel.lineStyle(1.5, COLOR_BORDER_GOLD, 1);
    this.panel.strokeRoundedRect(left + 0.75, top + 0.75, PANEL_WIDTH - 1.5, panelHeight - 1.5, PANEL_RADIUS);
  }

  private drawValueCard(x: number, y: number, width: number, cardHeight: number): void {
    this.valueCard.clear();
    this.valueCard.fillStyle(COLOR_CARD_FILL, 0.55);
    this.valueCard.fillRoundedRect(x, y, width, cardHeight, CARD_RADIUS);
    this.valueCard.lineStyle(1, COLOR_BORDER_GOLD, 0.22);
    this.valueCard.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, cardHeight - 1, CARD_RADIUS);
  }

  private createButton(addOwned: AddOwned, spec: ButtonSpec): DialogButton {
    const style = BUTTON_STYLES[spec.variant];
    const background = addOwned(new Phaser.GameObjects.Graphics(this.scene))
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setVisible(false);
    const text = addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, spec.label, {
      fontFamily: '"Segoe UI", Arial, sans-serif',
      fontSize: '14px',
      color: style.textColor,
      fontStyle: 'bold',
    }))
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH + 3)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);
    const hitArea = addOwned(new Phaser.GameObjects.Zone(this.scene, 0, 0, 10, BUTTON_HEIGHT))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 4)
      .setScrollFactor(0)
      .setVisible(false);
    const button: DialogButton = { background, text, hitArea, style, x: 0, y: 0, width: 10, hovered: false };
    hitArea.on(Phaser.Input.Events.POINTER_OVER, () => {
      button.hovered = true;
      this.drawButton(button);
    });
    hitArea.on(Phaser.Input.Events.POINTER_OUT, () => {
      button.hovered = false;
      this.drawButton(button);
    });
    hitArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
    });
    hitArea.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
      spec.onClick();
    });
    return button;
  }

  private layoutButton(button: DialogButton, x: number, y: number, width: number): void {
    button.x = x;
    button.y = y;
    button.width = width;
    this.drawButton(button);
    button.text.setPosition(x + width / 2, y + BUTTON_HEIGHT / 2);
    button.hitArea.setPosition(x, y).setSize(width, BUTTON_HEIGHT);
  }

  private drawButton(button: DialogButton): void {
    const { background, style, x, y, width, hovered } = button;
    background.clear();
    background.fillStyle(hovered ? style.hoverFill : style.fill, style.fillAlpha);
    background.fillRoundedRect(x, y, width, BUTTON_HEIGHT, BUTTON_RADIUS);
    background.lineStyle(1, style.border, style.borderAlpha);
    background.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, BUTTON_HEIGHT - 1, BUTTON_RADIUS);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function getHudTextResolution(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}
