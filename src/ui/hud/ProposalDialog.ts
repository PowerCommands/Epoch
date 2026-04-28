import Phaser from 'phaser';
import type { DiplomaticProposal } from '../../systems/diplomacy/DiplomaticProposal';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

export interface ProposalDialogContext {
  getNationName(nationId: string): string;
  getNationColor(nationId: string): number;
  getResourceName(resourceId: string): string;
}

export type ProposalDialogDecisionListener = (proposalId: string) => void;

const DEPTH = 200;
const PANEL_WIDTH = 420;
const PANEL_PADDING_X = 24;
const PANEL_PADDING_Y = 20;
const TITLE_GAP = 6;
const BODY_GAP = 16;
const BUTTON_HEIGHT = 36;
const BUTTON_GAP = 12;
const HUD_TEXT_RESOLUTION = getHudTextResolution();

interface DialogButton {
  background: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  hitArea: Phaser.GameObjects.Zone;
  baseColor: number;
  hoverColor: number;
  pressColor: number;
  hovered: boolean;
  pressed: boolean;
  onClick: () => void;
}

/**
 * Phaser-rendered modal that asks the human player to accept or reject one
 * incoming diplomatic proposal at a time. The dialog has no game logic — it
 * delegates the decision to its registered listeners.
 */
export class ProposalDialog {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly acceptButton: DialogButton;
  private readonly rejectButton: DialogButton;
  private current: DiplomaticProposal | null = null;
  private acceptListener: ProposalDialogDecisionListener | null = null;
  private rejectListener: ProposalDialogDecisionListener | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    addOwned: AddOwned,
    private readonly worldInputGate: WorldInputGate,
    private readonly context: ProposalDialogContext,
  ) {
    this.overlay = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x000000, 0.55))
      .setOrigin(0, 0)
      .setDepth(DEPTH)
      .setScrollFactor(0)
      .setVisible(false);

    this.panel = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, PANEL_WIDTH, 10, 0x0f1824, 0.97))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0xb59a5a, 0.85)
      .setVisible(false);

    this.titleText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#b59a5a',
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
      wordWrap: { width: PANEL_WIDTH - PANEL_PADDING_X * 2, useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);

    this.acceptButton = this.createButton(addOwned, 'Accept', 0x3a7b3a, 0x4f9a4f, 0x2d5f2d, () => {
      const proposal = this.current;
      if (!proposal) return;
      this.acceptListener?.(proposal.id);
    });

    this.rejectButton = this.createButton(addOwned, 'Reject', 0x7a3030, 0x9c4242, 0x5e2424, () => {
      const proposal = this.current;
      if (!proposal) return;
      this.rejectListener?.(proposal.id);
    });
  }

  setOnAccept(listener: ProposalDialogDecisionListener): void {
    this.acceptListener = listener;
  }

  setOnReject(listener: ProposalDialogDecisionListener): void {
    this.rejectListener = listener;
  }

  isShowing(): boolean {
    return this.current !== null;
  }

  getCurrentProposalId(): string | null {
    return this.current?.id ?? null;
  }

  showProposal(proposal: DiplomaticProposal): void {
    this.current = proposal;
    const fromName = this.context.getNationName(proposal.fromNationId);
    const accentColor = this.context.getNationColor(proposal.fromNationId);

    this.titleText.setText(`Proposal from ${fromName}`.toUpperCase());
    this.bodyText.setText(this.formatBody(proposal, fromName));
    this.panel.setStrokeStyle(2, accentColor, 0.95);

    this.overlay.setVisible(true);
    this.panel.setVisible(true);
    this.titleText.setVisible(true);
    this.bodyText.setVisible(true);
    this.setButtonVisible(this.acceptButton, true);
    this.setButtonVisible(this.rejectButton, true);
    this.layout();
  }

  /**
   * Hide the dialog without triggering a decision. Call when the active
   * proposal expires externally or when shutting down.
   */
  hide(): void {
    this.current = null;
    this.overlay.setVisible(false);
    this.panel.setVisible(false);
    this.titleText.setVisible(false);
    this.bodyText.setVisible(false);
    this.setButtonVisible(this.acceptButton, false);
    this.setButtonVisible(this.rejectButton, false);
  }

  layout(): void {
    if (!this.current) return;
    const { width, height } = this.scene.scale;
    this.overlay.setPosition(0, 0).setDisplaySize(width, height);

    const titleHeight = Math.ceil(this.titleText.height);
    const bodyHeight = Math.ceil(this.bodyText.height);
    const panelHeight =
      PANEL_PADDING_Y
      + titleHeight
      + TITLE_GAP
      + bodyHeight
      + BODY_GAP
      + BUTTON_HEIGHT
      + PANEL_PADDING_Y;

    const panelX = Math.round((width - PANEL_WIDTH) / 2);
    const panelY = Math.round((height - panelHeight) / 2);

    this.panel.setPosition(panelX, panelY).setDisplaySize(PANEL_WIDTH, panelHeight);

    this.titleText.setPosition(panelX + PANEL_PADDING_X, panelY + PANEL_PADDING_Y);
    this.bodyText.setPosition(panelX + PANEL_PADDING_X, panelY + PANEL_PADDING_Y + titleHeight + TITLE_GAP);

    const buttonY = panelY + panelHeight - PANEL_PADDING_Y - BUTTON_HEIGHT;
    const usableWidth = PANEL_WIDTH - PANEL_PADDING_X * 2;
    const buttonWidth = Math.floor((usableWidth - BUTTON_GAP) / 2);
    const acceptX = panelX + PANEL_PADDING_X;
    const rejectX = acceptX + buttonWidth + BUTTON_GAP;

    this.placeButton(this.acceptButton, acceptX, buttonY, buttonWidth, BUTTON_HEIGHT);
    this.placeButton(this.rejectButton, rejectX, buttonY, buttonWidth, BUTTON_HEIGHT);
  }

  destroy(): void {
    this.overlay.destroy();
    this.panel.destroy();
    this.titleText.destroy();
    this.bodyText.destroy();
    this.destroyButton(this.acceptButton);
    this.destroyButton(this.rejectButton);
  }

  private formatBody(proposal: DiplomaticProposal, fromName: string): string {
    switch (proposal.payload.kind) {
      case 'open_borders':
        return `${fromName} proposes Open Borders.`;
      case 'embassy':
        return `${fromName} proposes to establish an Embassy.`;
      case 'peace':
        return `${fromName} sues for peace.`;
      case 'resource_trade': {
        const resource = this.context.getResourceName(proposal.payload.resourceId);
        const totalGold = proposal.payload.goldPerTurn * proposal.payload.turns;
        return `${fromName} offers:\n+ ${resource} (${proposal.payload.turns} turns)\nFor:\n- ${totalGold} gold (${proposal.payload.goldPerTurn}/turn)`;
      }
      case 'gold_trade':
        return `${fromName} offers:\n+ ${proposal.payload.goldAmount} gold`;
    }
  }

  private createButton(
    addOwned: AddOwned,
    label: string,
    baseColor: number,
    hoverColor: number,
    pressColor: number,
    onClick: () => void,
  ): DialogButton {
    const background = addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, 10, BUTTON_HEIGHT, baseColor, 1))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0x000000, 0.5)
      .setVisible(false);

    const text = addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, label, {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#ffffff',
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
      .setScrollFactor(0);

    const button: DialogButton = {
      background,
      text,
      hitArea,
      baseColor,
      hoverColor,
      pressColor,
      hovered: false,
      pressed: false,
      onClick,
    };

    hitArea.on(Phaser.Input.Events.POINTER_OVER, (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      button.hovered = true;
      this.refreshButtonVisual(button);
    });
    hitArea.on(Phaser.Input.Events.POINTER_OUT, (
      _pointer: Phaser.Input.Pointer,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      button.hovered = false;
      button.pressed = false;
      this.refreshButtonVisual(button);
    });
    hitArea.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      this.worldInputGate.claimPointer(pointer.id);
      button.pressed = true;
      consumePointerEvent(pointer);
      this.refreshButtonVisual(button);
    });
    hitArea.on(Phaser.Input.Events.POINTER_UP, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      consumePointerEvent(pointer);
      const shouldClick = button.pressed;
      button.pressed = false;
      this.worldInputGate.releasePointer(pointer.id);
      this.refreshButtonVisual(button);
      if (shouldClick) {
        button.onClick();
      }
    });

    return button;
  }

  private placeButton(button: DialogButton, x: number, y: number, width: number, height: number): void {
    button.background.setPosition(x, y).setDisplaySize(width, height);
    button.text.setPosition(Math.round(x + width / 2), Math.round(y + height / 2));
    button.hitArea.setPosition(x, y).setSize(width, height);
    if (!button.hitArea.input?.enabled) {
      button.hitArea.setInteractive({ useHandCursor: true });
    }
    this.refreshButtonVisual(button);
  }

  private setButtonVisible(button: DialogButton, visible: boolean): void {
    button.background.setVisible(visible);
    button.text.setVisible(visible);
    if (visible) {
      if (!button.hitArea.input?.enabled) {
        button.hitArea.setInteractive({ useHandCursor: true });
      }
    } else {
      button.hovered = false;
      button.pressed = false;
      button.hitArea.disableInteractive();
    }
  }

  private refreshButtonVisual(button: DialogButton): void {
    const fillColor = button.pressed
      ? button.pressColor
      : button.hovered
        ? button.hoverColor
        : button.baseColor;
    button.background.setFillStyle(fillColor, 1);
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
