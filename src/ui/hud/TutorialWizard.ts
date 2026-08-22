import Phaser from 'phaser';
import type { GuideTip } from '../../data/progressiveGuide';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import type { ScreenRect } from '../../types/screenRect';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

export type TutorialPlacement = 'auto' | 'above' | 'below' | 'left' | 'right';

export interface StartupGuideStep {
  title: string;
  text: string;
  placement?: TutorialPlacement;
  resolveTarget: () => ScreenRect | null;
  onEnter?: () => void;
}

export type TutorialWizardMode = 'startup' | 'progressive';

export interface TutorialWizardCallbacks {
  /** Fired after the guide has hidden itself. */
  onClose: (mode: TutorialWizardMode) => void;
}

const DEPTH = 600;
const PANEL_WIDTH = 420;
const PANEL_PADDING = 20;
const TITLE_SIZE = 18;
const META_SIZE = 13;
const BODY_SIZE = 15;
const CONTENT_GAP = 9;
const BUTTON_HEIGHT = 34;
const BUTTON_PADDING_X = 14;
const BUTTON_GAP = 8;
const BUTTON_TOP_GAP = 18;
const SCREEN_MARGIN = 16;
const TARGET_GAP = 26;
const ARROW_SIZE = 20;

type ArrowDirection = 'up' | 'down' | 'left' | 'right';

interface WizardButton {
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  hitArea: Phaser.GameObjects.Zone;
  width: number;
  visible: boolean;
  pressed: boolean;
  hovered: boolean;
  primary: boolean;
  onClick: () => void;
}

/**
 * Progressive guide presentation. The viewed tip/page cursor lives here and is
 * deliberately independent from the automatic cursor owned by GuideProgression.
 */
export class TutorialWizard {
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly panelStroke: Phaser.GameObjects.Rectangle;
  private readonly arrow: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly metaText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly previousButton: WizardButton;
  private readonly nextButton: WizardButton;
  private readonly closeButton: WizardButton;
  private readonly textResolution = getTextResolution();

  private viewedTipIndex = 0;
  private viewedPageIndex = 0;
  private startupSteps: readonly StartupGuideStep[] = [];
  private startupStepIndex = 0;
  private mode: TutorialWizardMode = 'progressive';
  private active = false;
  private panelHeight = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly addOwned: AddOwned,
    private readonly worldInputGate: WorldInputGate,
    private readonly tips: readonly GuideTip[],
    private readonly callbacks: TutorialWizardCallbacks,
  ) {
    this.panelStroke = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, PANEL_WIDTH + 4, 10, 0xf2d38b, 0.95))
      .setOrigin(0, 0)
      .setDepth(DEPTH)
      .setScrollFactor(0)
      .setVisible(false);
    this.panel = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, PANEL_WIDTH, 10, 0x0f1824, 0.97))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setVisible(false)
      .setInteractive({ useHandCursor: false });
    this.panel.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
    });
    this.panel.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      consumePointerEvent(pointer);
      this.worldInputGate.releasePointer(pointer.id);
    });

    this.arrow = addOwned(new Phaser.GameObjects.Graphics(scene))
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setVisible(false);

    this.titleText = this.createText('', TITLE_SIZE, '#f4dfaa', 'bold');
    this.metaText = this.createText('', META_SIZE, '#9fb2c4');
    this.bodyText = this.createText('', BODY_SIZE, '#e7eef5', undefined, 3);

    this.previousButton = this.createButton('Previous Tip', () => this.goPrevious(), false);
    this.nextButton = this.createButton('Next Tip', () => this.goNext(), true);
    this.closeButton = this.createButton('Close', () => this.close(), false);
  }

  /** Open a specific automatically due tip without coupling browsing to progression. */
  openAutomaticTip(tipIndex: number): void {
    if (this.tips.length === 0) return;
    this.mode = 'progressive';
    this.viewedTipIndex = clampWhole(tipIndex, 0, this.tips.length - 1);
    this.viewedPageIndex = 0;
    this.active = true;
    this.showCurrentPage();
  }

  /** Reopen the guide at the last page browsed during this game session. */
  openManual(): void {
    if (this.tips.length === 0) return;
    this.mode = 'progressive';
    this.active = true;
    this.showCurrentPage();
  }

  /** Open the separate new-game introduction without consuming a progressive tip. */
  openStartup(steps: readonly StartupGuideStep[]): void {
    if (steps.length === 0) return;
    this.mode = 'startup';
    this.startupSteps = steps;
    this.startupStepIndex = 0;
    this.active = true;
    this.showCurrentPage();
  }

  isActive(): boolean {
    return this.active;
  }

  /** Keep the centered panel responsive when the viewport changes. */
  update(): void {
    if (this.active) this.layout();
  }

  destroy(): void {
    this.panel.destroy();
    this.panelStroke.destroy();
    this.arrow.destroy();
    this.titleText.destroy();
    this.metaText.destroy();
    this.bodyText.destroy();
    for (const button of [this.previousButton, this.nextButton, this.closeButton]) {
      button.background.destroy();
      button.label.destroy();
      button.hitArea.destroy();
    }
  }

  private createText(
    value: string,
    fontSize: number,
    color: string,
    fontStyle?: string,
    lineSpacing = 0,
  ): Phaser.GameObjects.Text {
    return this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, value, {
      fontFamily: 'sans-serif',
      fontSize: `${fontSize}px`,
      fontStyle,
      color,
      lineSpacing,
      wordWrap: { width: PANEL_WIDTH - PANEL_PADDING * 2, useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(this.textResolution)
      .setVisible(false);
  }

  close(): void {
    if (!this.active) return;
    const closedMode = this.mode;
    this.hide();
    this.callbacks.onClose(closedMode);
  }

  private goPrevious(): void {
    if (this.mode === 'startup') {
      if (this.startupStepIndex <= 0) return;
      this.startupStepIndex -= 1;
      this.showCurrentPage();
      return;
    }
    if (this.viewedPageIndex > 0) {
      this.viewedPageIndex -= 1;
    } else if (this.viewedTipIndex > 0) {
      this.viewedTipIndex -= 1;
      this.viewedPageIndex = this.currentTip().pages.length - 1;
    } else {
      return;
    }
    this.showCurrentPage();
  }

  private goNext(): void {
    if (this.mode === 'startup') {
      if (this.startupStepIndex >= this.startupSteps.length - 1) return;
      this.startupStepIndex += 1;
      this.showCurrentPage();
      return;
    }
    const tip = this.currentTip();
    if (this.viewedPageIndex < tip.pages.length - 1) {
      this.viewedPageIndex += 1;
    } else if (this.viewedTipIndex < this.tips.length - 1) {
      this.viewedTipIndex += 1;
      this.viewedPageIndex = 0;
    } else {
      return;
    }
    this.showCurrentPage();
  }

  private showCurrentPage(): void {
    if (this.mode === 'startup') {
      const step = this.startupSteps[this.startupStepIndex];
      if (!step) return;
      step.onEnter?.();
      this.titleText.setText(step.title);
      this.metaText.setText(`Getting Started  •  Step ${this.startupStepIndex + 1} of ${this.startupSteps.length}`);
      this.bodyText.setText(step.text);
      this.setButtonLabel(this.previousButton, 'Previous Step');
      this.setButtonLabel(this.nextButton, 'Next Step');
      this.setButtonVisible(this.previousButton, this.startupStepIndex > 0);
      this.setButtonVisible(this.nextButton, this.startupStepIndex < this.startupSteps.length - 1);
      this.setButtonVisible(this.closeButton, true);
      this.showPanel();
      return;
    }

    const tip = this.currentTip();
    const page = tip.pages[this.viewedPageIndex] ?? tip.pages[0];
    if (!page) return;

    this.titleText.setText(page.title ? `${tip.title} — ${page.title}` : tip.title);
    const pagePosition = tip.pages.length > 1
      ? `  •  Page ${this.viewedPageIndex + 1} of ${tip.pages.length}`
      : '';
    this.metaText.setText(`Tip ${this.viewedTipIndex + 1} of ${this.tips.length}${pagePosition}`);
    this.bodyText.setText(page.body);

    const hasPrevious = this.viewedTipIndex > 0 || this.viewedPageIndex > 0;
    const hasNext = this.viewedTipIndex < this.tips.length - 1 || this.viewedPageIndex < tip.pages.length - 1;
    this.setButtonLabel(this.previousButton, this.viewedPageIndex > 0 ? 'Previous Page' : 'Previous Tip');
    this.setButtonLabel(this.nextButton, this.viewedPageIndex < tip.pages.length - 1 ? 'Next Page' : 'Next Tip');
    this.setButtonVisible(this.previousButton, hasPrevious);
    this.setButtonVisible(this.nextButton, hasNext);
    this.setButtonVisible(this.closeButton, true);

    this.showPanel();
  }

  private showPanel(): void {
    this.panel.setVisible(true);
    this.panelStroke.setVisible(true);
    this.titleText.setVisible(true);
    this.metaText.setVisible(true);
    this.bodyText.setVisible(true);
    this.layout();
  }

  private currentTip(): GuideTip {
    return this.tips[this.viewedTipIndex] ?? this.tips[0];
  }

  private hide(): void {
    this.active = false;
    this.panel.setVisible(false);
    this.panelStroke.setVisible(false);
    this.arrow.setVisible(false);
    this.titleText.setVisible(false);
    this.metaText.setVisible(false);
    this.bodyText.setVisible(false);
    for (const button of [this.previousButton, this.nextButton, this.closeButton]) this.hideButton(button);
  }

  private layout(): void {
    const innerHeight = this.titleText.height
      + CONTENT_GAP + this.metaText.height
      + CONTENT_GAP + this.bodyText.height
      + BUTTON_TOP_GAP + BUTTON_HEIGHT;
    this.panelHeight = PANEL_PADDING * 2 + innerHeight;

    const { width: viewW, height: viewH } = this.scene.scale;
    const startupStep = this.mode === 'startup' ? this.startupSteps[this.startupStepIndex] : undefined;
    const target = startupStep?.resolveTarget() ?? null;
    let panelX = (viewW - PANEL_WIDTH) / 2;
    let panelY = (viewH - this.panelHeight) / 2;
    let arrowDirection: ArrowDirection | null = null;
    if (target && startupStep) {
      const side = this.resolveSide(startupStep.placement ?? 'auto', target, viewW, viewH);
      const placed = this.placeForSide(side, target);
      panelX = placed.x;
      panelY = placed.y;
      arrowDirection = placed.arrow;
    }
    const x = Math.round(clamp(panelX, SCREEN_MARGIN, Math.max(SCREEN_MARGIN, viewW - PANEL_WIDTH - SCREEN_MARGIN)));
    const y = Math.round(clamp(panelY, SCREEN_MARGIN, Math.max(SCREEN_MARGIN, viewH - this.panelHeight - SCREEN_MARGIN)));

    this.panelStroke.setPosition(x - 2, y - 2).setSize(PANEL_WIDTH + 4, this.panelHeight + 4);
    this.panel.setPosition(x, y).setSize(PANEL_WIDTH, this.panelHeight);
    if (this.panel.input) {
      (this.panel.input.hitArea as Phaser.Geom.Rectangle).setTo(0, 0, PANEL_WIDTH, this.panelHeight);
    }

    const contentX = x + PANEL_PADDING;
    this.titleText.setPosition(contentX, y + PANEL_PADDING);
    this.metaText.setPosition(contentX, this.titleText.y + this.titleText.height + CONTENT_GAP);
    this.bodyText.setPosition(contentX, this.metaText.y + this.metaText.height + CONTENT_GAP);

    const rowY = y + this.panelHeight - PANEL_PADDING - BUTTON_HEIGHT;
    if (this.previousButton.visible) this.positionButton(this.previousButton, contentX, rowY);

    let rightX = x + PANEL_WIDTH - PANEL_PADDING;
    if (this.nextButton.visible) {
      rightX -= this.nextButton.width;
      this.positionButton(this.nextButton, rightX, rowY);
      rightX -= BUTTON_GAP;
    }
    rightX -= this.closeButton.width;
    this.positionButton(this.closeButton, rightX, rowY);

    if (arrowDirection && target) this.drawArrow(arrowDirection, x, y, target);
    else this.arrow.setVisible(false);
  }

  private resolveSide(
    placement: TutorialPlacement,
    target: ScreenRect,
    viewW: number,
    viewH: number,
  ): Exclude<TutorialPlacement, 'auto'> {
    if (placement !== 'auto') return placement;
    const roomRight = viewW - (target.centerX + target.width / 2);
    const roomLeft = target.centerX - target.width / 2;
    const roomBelow = viewH - (target.centerY + target.height / 2);
    const roomAbove = target.centerY - target.height / 2;
    const needHoriz = PANEL_WIDTH + TARGET_GAP + SCREEN_MARGIN;
    const needVert = this.panelHeight + TARGET_GAP + SCREEN_MARGIN;
    if (roomRight >= needHoriz) return 'right';
    if (roomLeft >= needHoriz) return 'left';
    if (roomBelow >= needVert) return 'below';
    if (roomAbove >= needVert) return 'above';
    const best = Math.max(roomRight, roomLeft, roomBelow, roomAbove);
    if (best === roomRight) return 'right';
    if (best === roomLeft) return 'left';
    if (best === roomBelow) return 'below';
    return 'above';
  }

  private placeForSide(
    side: Exclude<TutorialPlacement, 'auto'>,
    target: ScreenRect,
  ): { x: number; y: number; arrow: ArrowDirection } {
    switch (side) {
      case 'right':
        return { x: target.centerX + target.width / 2 + TARGET_GAP, y: target.centerY - this.panelHeight / 2, arrow: 'left' };
      case 'left':
        return { x: target.centerX - target.width / 2 - TARGET_GAP - PANEL_WIDTH, y: target.centerY - this.panelHeight / 2, arrow: 'right' };
      case 'above':
        return { x: target.centerX - PANEL_WIDTH / 2, y: target.centerY - target.height / 2 - TARGET_GAP - this.panelHeight, arrow: 'down' };
      case 'below':
        return { x: target.centerX - PANEL_WIDTH / 2, y: target.centerY + target.height / 2 + TARGET_GAP, arrow: 'up' };
    }
  }

  private drawArrow(direction: ArrowDirection, panelX: number, panelY: number, target: ScreenRect): void {
    const half = ARROW_SIZE / 2;
    const g = this.arrow.clear().fillStyle(0xf2d38b, 1);
    switch (direction) {
      case 'left': {
        const y = clamp(target.centerY, panelY + half + 4, panelY + this.panelHeight - half - 4);
        g.fillTriangle(panelX - ARROW_SIZE, y, panelX, y - half, panelX, y + half);
        break;
      }
      case 'right': {
        const x = panelX + PANEL_WIDTH;
        const y = clamp(target.centerY, panelY + half + 4, panelY + this.panelHeight - half - 4);
        g.fillTriangle(x + ARROW_SIZE, y, x, y - half, x, y + half);
        break;
      }
      case 'up': {
        const x = clamp(target.centerX, panelX + half + 4, panelX + PANEL_WIDTH - half - 4);
        g.fillTriangle(x, panelY - ARROW_SIZE, x - half, panelY, x + half, panelY);
        break;
      }
      case 'down': {
        const x = clamp(target.centerX, panelX + half + 4, panelX + PANEL_WIDTH - half - 4);
        const y = panelY + this.panelHeight;
        g.fillTriangle(x, y + ARROW_SIZE, x - half, y, x + half, y);
        break;
      }
    }
    g.setVisible(true);
  }

  private createButton(label: string, onClick: () => void, primary: boolean): WizardButton {
    const background = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, 10, BUTTON_HEIGHT, primary ? 0xa96a1b : 0x1c2b3a, 0.98))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 3)
      .setScrollFactor(0)
      .setStrokeStyle(1.5, primary ? 0xf4dfaa : 0x6f89a2, 0.9)
      .setVisible(false);
    const text = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, label, {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#f4f1e7',
    }))
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH + 4)
      .setScrollFactor(0)
      .setResolution(this.textResolution)
      .setVisible(false);
    const hitArea = this.addOwned(new Phaser.GameObjects.Zone(this.scene, 0, 0, 10, BUTTON_HEIGHT))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 5)
      .setScrollFactor(0)
      .setVisible(false);
    const button: WizardButton = {
      background, label: text, hitArea,
      width: Math.ceil(text.width) + BUTTON_PADDING_X * 2,
      visible: false, pressed: false, hovered: false, primary, onClick,
    };

    hitArea.on(Phaser.Input.Events.POINTER_OVER, () => {
      button.hovered = true;
      this.refreshButtonVisual(button);
    });
    hitArea.on(Phaser.Input.Events.POINTER_OUT, () => {
      button.hovered = false;
      button.pressed = false;
      this.refreshButtonVisual(button);
    });
    hitArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      this.worldInputGate.claimPointer(pointer.id);
      button.pressed = true;
      consumePointerEvent(pointer);
      this.refreshButtonVisual(button);
    });
    hitArea.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      consumePointerEvent(pointer);
      const shouldClick = button.pressed && button.visible;
      button.pressed = false;
      this.worldInputGate.releasePointer(pointer.id);
      this.refreshButtonVisual(button);
      if (shouldClick) button.onClick();
    });
    return button;
  }

  private setButtonLabel(button: WizardButton, label: string): void {
    button.label.setText(label);
    button.width = Math.ceil(button.label.width) + BUTTON_PADDING_X * 2;
  }

  private setButtonVisible(button: WizardButton, visible: boolean): void {
    button.visible = visible;
    if (!visible) {
      this.hideButton(button);
      return;
    }
    button.background.setVisible(true);
    button.label.setVisible(true);
    button.hitArea.setVisible(true).disableInteractive().setInteractive({ useHandCursor: true });
  }

  private hideButton(button: WizardButton): void {
    button.hovered = false;
    button.pressed = false;
    button.background.setVisible(false);
    button.label.setVisible(false);
    button.hitArea.setVisible(false).disableInteractive();
  }

  private positionButton(button: WizardButton, x: number, y: number): void {
    button.background.setPosition(x, y).setSize(button.width, BUTTON_HEIGHT);
    button.label.setPosition(x + button.width / 2, y + BUTTON_HEIGHT / 2);
    button.hitArea.setPosition(x, y).setSize(button.width, BUTTON_HEIGHT);
  }

  private refreshButtonVisual(button: WizardButton): void {
    const base = button.primary ? 0xa96a1b : 0x1c2b3a;
    const hover = button.primary ? 0xc07a1e : 0x274056;
    const press = button.primary ? 0x8f5d19 : 0x14202c;
    const fill = button.pressed ? press : button.hovered ? hover : base;
    button.background.setFillStyle(fill, 0.98).setScale(button.pressed ? 0.97 : 1);
    button.label.setScale(button.pressed ? 0.97 : 1);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampWhole(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function getTextResolution(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}
