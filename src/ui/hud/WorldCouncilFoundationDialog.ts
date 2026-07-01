import Phaser from 'phaser';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

export interface WorldCouncilFoundationOffer {
  readonly gold: number;
  readonly sciencePercent: number;
  readonly culturePercent: number;
}

export interface WorldCouncilFoundationDialogState {
  readonly organizationName: string;
  readonly nationName: string;
  readonly cityName: string;
  readonly maxGold: number;
  readonly sciencePerTurn: number;
  readonly culturePerTurn: number;
}

const DEPTH = 210;
const PANEL_WIDTH = 430;
const PADDING_X = 24;
const PADDING_Y = 20;
const BUTTON_HEIGHT = 36;
const BUTTON_GAP = 12;
const HUD_TEXT_RESOLUTION = getHudTextResolution();

interface DialogButton {
  background: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  hitArea: Phaser.GameObjects.Zone;
  onClick: () => void;
}

export class WorldCouncilFoundationDialog {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly foundButton: DialogButton;
  private readonly declineButton: DialogButton;
  private current: WorldCouncilFoundationDialogState | null = null;
  private foundListener: ((offer: WorldCouncilFoundationOffer) => void) | null = null;
  private declineListener: (() => void) | null = null;

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
    this.titleText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, 'World Council', {
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
      fontSize: '16px',
      color: '#f4f1e7',
      wordWrap: { width: PANEL_WIDTH - PADDING_X * 2, useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);

    this.foundButton = this.createButton(addOwned, 'Contribute and Found', 0x355f76, () => {
      const state = this.current;
      if (!state) return;
      this.foundListener?.({
        gold: Math.min(state.maxGold, 100),
        sciencePercent: 10,
        culturePercent: 10,
      });
    });
    this.declineButton = this.createButton(addOwned, 'No Contribution', 0x5a3030, () => {
      this.declineListener?.();
    });
  }

  setOnFound(listener: (offer: WorldCouncilFoundationOffer) => void): void {
    this.foundListener = listener;
  }

  setOnDecline(listener: () => void): void {
    this.declineListener = listener;
  }

  show(state: WorldCouncilFoundationDialogState): void {
    this.current = state;
    this.titleText.setText(state.organizationName);
    this.bodyText.setText([
      `${state.nationName} will invite every nation to found the ${state.organizationName} in ${state.cityName}.`,
      '',
      'Your contribution:',
      `${Math.min(state.maxGold, 100)} gold`,
      `10% science output (${Math.floor(state.sciencePerTurn * 0.1)})`,
      `10% culture output (${Math.floor(state.culturePerTurn * 0.1)})`,
      '',
      'AI contributions are hidden.',
    ].join('\n'));
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
    const bodyHeight = this.bodyText.height;
    const panelHeight = PADDING_Y + this.titleText.height + 12 + bodyHeight + 18 + BUTTON_HEIGHT + PADDING_Y;
    const left = Math.round((width - PANEL_WIDTH) / 2);
    const top = Math.round((height - panelHeight) / 2);
    this.panel.setPosition(left, top).setDisplaySize(PANEL_WIDTH, panelHeight);
    this.titleText.setPosition(left + PADDING_X, top + PADDING_Y);
    this.bodyText.setPosition(left + PADDING_X, this.titleText.y + this.titleText.height + 12);
    const buttonWidth = Math.floor((PANEL_WIDTH - PADDING_X * 2 - BUTTON_GAP) / 2);
    const buttonY = top + panelHeight - PADDING_Y - BUTTON_HEIGHT;
    this.layoutButton(this.foundButton, left + PADDING_X, buttonY, buttonWidth);
    this.layoutButton(this.declineButton, left + PADDING_X + buttonWidth + BUTTON_GAP, buttonY, buttonWidth);
  }

  destroy(): void {
    this.overlay.destroy();
    this.panel.destroy();
    this.titleText.destroy();
    this.bodyText.destroy();
    this.destroyButton(this.foundButton);
    this.destroyButton(this.declineButton);
  }

  private setVisible(visible: boolean): void {
    this.overlay.setVisible(visible);
    this.panel.setVisible(visible);
    this.titleText.setVisible(visible);
    this.bodyText.setVisible(visible);
    for (const button of [this.foundButton, this.declineButton]) {
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
      fontSize: '14px',
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
    return { background, text, hitArea, onClick };
  }

  private layoutButton(button: DialogButton, x: number, y: number, width: number): void {
    button.background.setPosition(x, y).setDisplaySize(width, BUTTON_HEIGHT);
    button.text.setPosition(x + width / 2, y + BUTTON_HEIGHT / 2);
    button.hitArea.setPosition(x, y).setSize(width, BUTTON_HEIGHT);
  }

  private destroyButton(button: DialogButton): void {
    button.background.destroy();
    button.text.destroy();
    button.hitArea.destroy();
  }
}

function getHudTextResolution(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}
