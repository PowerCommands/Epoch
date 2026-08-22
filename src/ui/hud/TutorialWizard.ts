import Phaser from 'phaser';
import type { ScreenRect } from '../../types/screenRect';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

/** Where the target lives, so callers can describe steps declaratively. */
export type TutorialTargetType = 'unit' | 'ui-element';

/** Preferred side of the target to place the panel on. 'auto' picks the best fit. */
export type TutorialPlacement = 'auto' | 'above' | 'below' | 'left' | 'right';

export interface TutorialStep {
  title: string;
  text: string;
  /** Declarative classification of the target (informational; resolution is via resolveTarget). */
  targetType: TutorialTargetType;
  /** Optional preferred placement. Gold-style steps use 'below' to sit under the target. */
  placement?: TutorialPlacement;
  /**
   * Resolves the live screen-space rectangle of the step target each frame, or
   * null when the target is currently unavailable / off-screen. Keeping this a
   * callback lets the wizard follow units and HUD elements as the camera moves
   * without the wizard knowing anything about game systems.
   */
  resolveTarget: () => ScreenRect | null;
  /**
   * Optional side effect run once when the step becomes active (e.g. selecting
   * the relevant unit so its action button is on screen). Orchestration only —
   * the wizard never reaches into game systems itself.
   */
  onEnter?: () => void;
}

export interface TutorialWizardCallbacks {
  /**
   * Fired when the wizard is dismissed (Close pressed, on any step). The wizard
   * has already hidden itself so the host can restore gameplay focus.
   */
  onClose: () => void;
}

const DEPTH = 600;
const PANEL_WIDTH = 340;
const PANEL_PADDING = 18;
const TITLE_SIZE = 18;
const BODY_SIZE = 15;
const BODY_TOP_GAP = 10;
const BUTTON_HEIGHT = 34;
const BUTTON_PADDING_X = 16;
const BUTTON_GAP = 8;
const BUTTON_TOP_GAP = 16;
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
  onClick: () => void;
}

export class TutorialWizard {
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly panelStroke: Phaser.GameObjects.Rectangle;
  private readonly arrow: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly backButton: WizardButton;
  private readonly nextButton: WizardButton;
  private readonly closeButton: WizardButton;
  private readonly textResolution = getTextResolution();

  private steps: TutorialStep[] = [];
  private stepIndex = 0;
  private active = false;
  private panelHeight = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly addOwned: AddOwned,
    private readonly worldInputGate: WorldInputGate,
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
      .setVisible(false);
    // Consume pointer events so clicking the panel never falls through to the
    // world (which would deselect units / pan the camera).
    this.panel.setInteractive({ useHandCursor: false });
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

    this.titleText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: `${TITLE_SIZE}px`,
      fontStyle: 'bold',
      color: '#f4dfaa',
      wordWrap: { width: PANEL_WIDTH - PANEL_PADDING * 2, useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 3)
      .setScrollFactor(0)
      .setResolution(this.textResolution)
      .setVisible(false);

    this.bodyText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: `${BODY_SIZE}px`,
      color: '#e7eef5',
      lineSpacing: 3,
      wordWrap: { width: PANEL_WIDTH - PANEL_PADDING * 2, useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 3)
      .setScrollFactor(0)
      .setResolution(this.textResolution)
      .setVisible(false);

    this.backButton = this.createButton('Back', () => this.goBack(), false);
    this.nextButton = this.createButton('Next', () => this.goNext(), true);
    this.closeButton = this.createButton('Close', () => this.close(), false);
  }

  /** Begin a tutorial with the given ordered steps. */
  start(steps: TutorialStep[]): void {
    if (steps.length === 0) return;
    this.steps = steps;
    this.stepIndex = 0;
    this.active = true;
    this.showStep();
  }

  isActive(): boolean {
    return this.active;
  }

  /** Re-resolve the current target and reposition. Call once per frame while active. */
  update(): void {
    if (!this.active) return;
    this.layout();
  }

  destroy(): void {
    this.panel.destroy();
    this.panelStroke.destroy();
    this.arrow.destroy();
    this.titleText.destroy();
    this.bodyText.destroy();
    for (const button of [this.backButton, this.nextButton, this.closeButton]) {
      button.background.destroy();
      button.label.destroy();
      button.hitArea.destroy();
    }
  }

  private close(): void {
    if (!this.active) return;
    this.hide();
    this.callbacks.onClose();
  }

  private goBack(): void {
    if (this.stepIndex <= 0) return;
    this.stepIndex -= 1;
    this.showStep();
  }

  private goNext(): void {
    if (this.stepIndex >= this.steps.length - 1) return;
    this.stepIndex += 1;
    this.showStep();
  }

  private showStep(): void {
    const step = this.steps[this.stepIndex];
    if (!step) return;
    this.active = true;
    step.onEnter?.();

    this.titleText.setText(step.title);
    this.bodyText.setText(step.text);

    const isFirst = this.stepIndex === 0;
    const isLast = this.stepIndex === this.steps.length - 1;
    this.setButtonVisible(this.backButton, !isFirst);
    this.setButtonVisible(this.nextButton, !isLast);
    this.setButtonVisible(this.closeButton, true);

    this.panel.setVisible(true);
    this.panelStroke.setVisible(true);
    this.titleText.setVisible(true);
    this.bodyText.setVisible(true);

    this.layout();
  }

  private hide(): void {
    this.active = false;
    this.panel.setVisible(false);
    this.panelStroke.setVisible(false);
    this.arrow.setVisible(false);
    this.titleText.setVisible(false);
    this.bodyText.setVisible(false);
    for (const button of [this.backButton, this.nextButton, this.closeButton]) {
      this.hideButton(button);
    }
  }

  private layout(): void {
    const step = this.steps[this.stepIndex];
    if (!step) return;

    // Measure content to size the panel.
    this.titleText.setText(step.title);
    this.bodyText.setText(step.text);
    const titleHeight = this.titleText.height;
    const bodyHeight = this.bodyText.height;
    const innerHeight = titleHeight + BODY_TOP_GAP + bodyHeight
      + BUTTON_TOP_GAP + BUTTON_HEIGHT;
    this.panelHeight = PANEL_PADDING * 2 + innerHeight;

    const target = step.resolveTarget();
    const { width: viewW, height: viewH } = this.scene.scale;

    // Decide placement side and resulting panel top-left + arrow.
    let panelX: number;
    let panelY: number;
    let arrowDir: ArrowDirection | null = null;

    if (target) {
      const side = this.resolveSide(step.placement ?? 'auto', target, viewW, viewH);
      const placed = this.placeForSide(side, target, viewW, viewH);
      panelX = placed.x;
      panelY = placed.y;
      arrowDir = placed.arrow;
    } else {
      // Target unavailable: keep the panel readable in the lower-center and hide the arrow.
      panelX = (viewW - PANEL_WIDTH) / 2;
      panelY = viewH - this.panelHeight - SCREEN_MARGIN * 4;
    }

    panelX = clamp(panelX, SCREEN_MARGIN, Math.max(SCREEN_MARGIN, viewW - PANEL_WIDTH - SCREEN_MARGIN));
    panelY = clamp(panelY, SCREEN_MARGIN, Math.max(SCREEN_MARGIN, viewH - this.panelHeight - SCREEN_MARGIN));

    this.positionPanel(Math.round(panelX), Math.round(panelY));
    if (arrowDir && target) {
      this.drawArrow(arrowDir, Math.round(panelX), Math.round(panelY), target);
    } else {
      this.arrow.setVisible(false);
    }
  }

  /** Choose a side with enough room; honors an explicit non-auto preference. */
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
    // Fallback: side with the most room.
    const best = Math.max(roomRight, roomLeft, roomBelow, roomAbove);
    if (best === roomRight) return 'right';
    if (best === roomLeft) return 'left';
    if (best === roomBelow) return 'below';
    return 'above';
  }

  private placeForSide(
    side: Exclude<TutorialPlacement, 'auto'>,
    target: ScreenRect,
    viewW: number,
    viewH: number,
  ): { x: number; y: number; arrow: ArrowDirection } {
    switch (side) {
      case 'right':
        return {
          x: target.centerX + target.width / 2 + TARGET_GAP,
          y: target.centerY - this.panelHeight / 2,
          arrow: 'left',
        };
      case 'left':
        return {
          x: target.centerX - target.width / 2 - TARGET_GAP - PANEL_WIDTH,
          y: target.centerY - this.panelHeight / 2,
          arrow: 'right',
        };
      case 'above':
        return {
          x: target.centerX - PANEL_WIDTH / 2,
          y: target.centerY - target.height / 2 - TARGET_GAP - this.panelHeight,
          arrow: 'down',
        };
      case 'below':
      default:
        void viewW;
        void viewH;
        return {
          x: target.centerX - PANEL_WIDTH / 2,
          y: target.centerY + target.height / 2 + TARGET_GAP,
          arrow: 'up',
        };
    }
  }

  private positionPanel(x: number, y: number): void {
    // Shapes render at width×height (scale 1), so size them with setSize — not
    // setDisplaySize, which would compound with the press-animation scale.
    this.panelStroke.setPosition(x - 2, y - 2).setSize(PANEL_WIDTH + 4, this.panelHeight + 4);
    this.panel.setPosition(x, y).setSize(PANEL_WIDTH, this.panelHeight);
    // Keep the interactive hit-area in sync with the resized panel.
    if (this.panel.input) {
      (this.panel.input.hitArea as Phaser.Geom.Rectangle).setTo(0, 0, PANEL_WIDTH, this.panelHeight);
    }

    const contentX = x + PANEL_PADDING;
    this.titleText.setPosition(contentX, y + PANEL_PADDING);
    const bodyY = y + PANEL_PADDING + this.titleText.height + BODY_TOP_GAP;
    this.bodyText.setPosition(contentX, bodyY);

    // Buttons sit in a row along the bottom of the panel.
    const rowY = y + this.panelHeight - PANEL_PADDING - BUTTON_HEIGHT;

    // Right-aligned group: Next (rightmost) then Close to its left.
    let rightX = x + PANEL_WIDTH - PANEL_PADDING;
    if (this.nextButton.visible) {
      rightX -= this.nextButton.width;
      this.positionButton(this.nextButton, rightX, rowY);
      rightX -= BUTTON_GAP;
    }
    if (this.closeButton.visible) {
      rightX -= this.closeButton.width;
      this.positionButton(this.closeButton, rightX, rowY);
    }
    // Back is left-aligned.
    if (this.backButton.visible) {
      this.positionButton(this.backButton, contentX, rowY);
    }
  }

  private drawArrow(dir: ArrowDirection, panelX: number, panelY: number, target: ScreenRect): void {
    const g = this.arrow;
    g.clear();
    g.fillStyle(0xf2d38b, 1);

    const half = ARROW_SIZE / 2;
    let tipX = 0;
    let tipY = 0;
    let baseAx = 0;
    let baseAy = 0;
    let baseBx = 0;
    let baseBy = 0;

    switch (dir) {
      case 'left': {
        // Arrow on the panel's left edge, pointing toward the target.
        const edgeX = panelX;
        const cy = clamp(target.centerY, panelY + half + 4, panelY + this.panelHeight - half - 4);
        tipX = edgeX - ARROW_SIZE;
        tipY = cy;
        baseAx = edgeX;
        baseAy = cy - half;
        baseBx = edgeX;
        baseBy = cy + half;
        break;
      }
      case 'right': {
        const edgeX = panelX + PANEL_WIDTH;
        const cy = clamp(target.centerY, panelY + half + 4, panelY + this.panelHeight - half - 4);
        tipX = edgeX + ARROW_SIZE;
        tipY = cy;
        baseAx = edgeX;
        baseAy = cy - half;
        baseBx = edgeX;
        baseBy = cy + half;
        break;
      }
      case 'up': {
        const edgeY = panelY;
        const cx = clamp(target.centerX, panelX + half + 4, panelX + PANEL_WIDTH - half - 4);
        tipX = cx;
        tipY = edgeY - ARROW_SIZE;
        baseAx = cx - half;
        baseAy = edgeY;
        baseBx = cx + half;
        baseBy = edgeY;
        break;
      }
      case 'down':
      default: {
        const edgeY = panelY + this.panelHeight;
        const cx = clamp(target.centerX, panelX + half + 4, panelX + PANEL_WIDTH - half - 4);
        tipX = cx;
        tipY = edgeY + ARROW_SIZE;
        baseAx = cx - half;
        baseAy = edgeY;
        baseBx = cx + half;
        baseBy = edgeY;
        break;
      }
    }

    g.fillTriangle(tipX, tipY, baseAx, baseAy, baseBx, baseBy);
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
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#f4f1e7',
    }))
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH + 4)
      .setScrollFactor(0)
      .setResolution(this.textResolution)
      .setVisible(false);

    const width = Math.ceil(text.width) + BUTTON_PADDING_X * 2;

    const hitArea = this.addOwned(new Phaser.GameObjects.Zone(this.scene, 0, 0, width, BUTTON_HEIGHT))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 5)
      .setScrollFactor(0)
      .setVisible(false);

    const button: WizardButton = {
      background,
      label: text,
      hitArea,
      width,
      visible: false,
      pressed: false,
      hovered: false,
      onClick,
    };

    hitArea.on(Phaser.Input.Events.POINTER_OVER, () => {
      button.hovered = true;
      this.refreshButtonVisual(button, primary);
    });
    hitArea.on(Phaser.Input.Events.POINTER_OUT, () => {
      button.hovered = false;
      button.pressed = false;
      this.refreshButtonVisual(button, primary);
    });
    hitArea.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _x: number,
      _y: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      this.worldInputGate.claimPointer(pointer.id);
      button.pressed = true;
      consumePointerEvent(pointer);
      this.refreshButtonVisual(button, primary);
    });
    hitArea.on(Phaser.Input.Events.POINTER_UP, (
      pointer: Phaser.Input.Pointer,
      _x: number,
      _y: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      consumePointerEvent(pointer);
      const shouldClick = button.pressed && button.visible;
      button.pressed = false;
      this.worldInputGate.releasePointer(pointer.id);
      this.refreshButtonVisual(button, primary);
      if (shouldClick) button.onClick();
    });

    return button;
  }

  private setButtonVisible(button: WizardButton, visible: boolean): void {
    button.visible = visible;
    if (!visible) {
      this.hideButton(button);
      return;
    }
    button.background.setVisible(true);
    button.label.setVisible(true);
    button.hitArea.setVisible(true);
    button.hitArea.disableInteractive();
    button.hitArea.setInteractive({ useHandCursor: true });
  }

  private hideButton(button: WizardButton): void {
    button.hovered = false;
    button.pressed = false;
    button.background.setVisible(false);
    button.label.setVisible(false);
    button.hitArea.setVisible(false);
    button.hitArea.disableInteractive();
  }

  private positionButton(button: WizardButton, x: number, y: number): void {
    button.background.setPosition(x, y).setSize(button.width, BUTTON_HEIGHT);
    button.label.setPosition(x + button.width / 2, y + BUTTON_HEIGHT / 2);
    button.hitArea.setPosition(x, y).setSize(button.width, BUTTON_HEIGHT);
  }

  private refreshButtonVisual(button: WizardButton, primary: boolean): void {
    const base = primary ? 0xa96a1b : 0x1c2b3a;
    const hover = primary ? 0xc07a1e : 0x274056;
    const press = primary ? 0x8f5d19 : 0x14202c;
    const fill = button.pressed ? press : button.hovered ? hover : base;
    button.background.setFillStyle(fill, 0.98).setScale(button.pressed ? 0.97 : 1);
    button.label.setScale(button.pressed ? 0.97 : 1);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getTextResolution(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}
