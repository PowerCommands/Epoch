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
const PANEL_WIDTH = 430;
const PADDING_X = 24;
const PADDING_Y = 20;
const BUTTON_HEIGHT = 32;
const ROW_GAP = 10;
const HUD_TEXT_RESOLUTION = getHudTextResolution();

interface DialogButton {
  background: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  hitArea: Phaser.GameObjects.Zone;
}

export class WorldCouncilContributionDialog {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly valueText: Phaser.GameObjects.Text;
  private readonly buttons: DialogButton[] = [];
  private current: WorldCouncilContributionDialogState | null = null;
  private gold = 0;
  private sciencePercent = 0;
  private culturePercent = 0;
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
    this.panel = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, PANEL_WIDTH, 10, 0x101923, 0.98))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setVisible(false);
    this.titleText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, 'World Council Contributions', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#d8bd72',
      fontStyle: 'bold',
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);
    this.bodyText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#f4f1e7',
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
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);

    for (const [label, onClick] of [
      ['Gold -25', () => this.adjustGold(-25)],
      ['Gold +25', () => this.adjustGold(25)],
      ['Science -5%', () => this.adjustScience(-5)],
      ['Science +5%', () => this.adjustScience(5)],
      ['Culture -5%', () => this.adjustCulture(-5)],
      ['Culture +5%', () => this.adjustCulture(5)],
      ['Confirm', () => this.confirm()],
      ['Minimum', () => this.minimumContribution()],
    ] as const) {
      this.buttons.push(this.createButton(addOwned, label, label === 'Minimum' ? 0x46613d : 0x355f76, onClick));
    }
  }

  setOnConfirm(listener: (offer: WorldCouncilFoundationOffer) => void): void {
    this.confirmListener = listener;
  }

  show(state: WorldCouncilContributionDialogState): void {
    this.current = state;
    this.sciencePercent = clamp(state.currentSciencePercent, 0, 100);
    this.culturePercent = clamp(state.currentCulturePercent, 0, 100);
    this.effectiveMaxGold = this.getEffectiveMaxGold();
    this.gold = clamp(state.currentGold, 0, this.effectiveMaxGold);
    this.titleText.setText(`${state.organizationName} Contributions`);
    this.bodyText.setText(`${state.nationName}, choose new ${state.organizationName} contributions. Minimum keeps a symbolic commitment.`);
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
    const panelHeight = 332;
    const left = Math.round((width - PANEL_WIDTH) / 2);
    const top = Math.round((height - panelHeight) / 2);
    this.panel.setPosition(left, top).setDisplaySize(PANEL_WIDTH, panelHeight);
    this.titleText.setPosition(left + PADDING_X, top + PADDING_Y);
    this.bodyText.setPosition(left + PADDING_X, this.titleText.y + this.titleText.height + 12);
    this.valueText.setPosition(left + PADDING_X, this.bodyText.y + this.bodyText.height + 16);

    const buttonWidth = Math.floor((PANEL_WIDTH - PADDING_X * 2 - 12) / 2);
    let y = this.valueText.y + this.valueText.height + 18;
    for (let i = 0; i < this.buttons.length; i += 2) {
      this.layoutButton(this.buttons[i], left + PADDING_X, y, buttonWidth);
      this.layoutButton(this.buttons[i + 1], left + PADDING_X + buttonWidth + 12, y, buttonWidth);
      y += BUTTON_HEIGHT + ROW_GAP;
    }
  }

  destroy(): void {
    this.overlay.destroy();
    this.panel.destroy();
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
    this.sciencePercent = clamp(this.sciencePercent + delta, 0, 100);
    this.effectiveMaxGold = this.getEffectiveMaxGold();
    this.gold = clamp(this.gold, 0, this.effectiveMaxGold);
    this.refreshValues();
  }

  private adjustCulture(delta: number): void {
    this.culturePercent = clamp(this.culturePercent + delta, 0, 100);
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
    this.confirmListener?.({ gold: 0, sciencePercent: 1, culturePercent: 1 });
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
    this.titleText.setVisible(visible);
    this.bodyText.setVisible(visible);
    this.valueText.setVisible(visible);
    for (const button of this.buttons) {
      button.background.setVisible(visible);
      button.text.setVisible(visible);
      button.hitArea.setVisible(visible);
      if (visible) button.hitArea.setInteractive({ cursor: 'pointer' });
      else button.hitArea.disableInteractive();
    }
  }

  private createButton(addOwned: AddOwned, label: string, color: number, onClick: () => void): DialogButton {
    const background = addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, 10, BUTTON_HEIGHT, color, 0.95))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setVisible(false);
    const text = addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, label, {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#f4f1e7',
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
    hitArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
    });
    hitArea.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
      onClick();
    });
    return { background, text, hitArea };
  }

  private layoutButton(button: DialogButton, x: number, y: number, width: number): void {
    button.background.setPosition(x, y).setDisplaySize(width, BUTTON_HEIGHT);
    button.text.setPosition(x + width / 2, y + BUTTON_HEIGHT / 2);
    button.hitArea.setPosition(x, y).setSize(width, BUTTON_HEIGHT);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function getHudTextResolution(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}
