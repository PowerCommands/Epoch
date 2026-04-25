import Phaser from 'phaser';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';
import { CircularHudProgressButton } from './CircularHudProgressButton';
import type { HudResearchState } from './NationHudDataProvider';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

const DEPTH = 140;
const EDGE_MARGIN = 16;
const TOGGLE_SIZE = 102;
const TOGGLE_HIT_SIZE = 122;
const TOGGLE_GAP = 14;
const TOGGLE_BASE_Y = EDGE_MARGIN + 46;
const CULTURE_TOGGLE_Y = TOGGLE_BASE_Y + TOGGLE_SIZE + TOGGLE_GAP;
const SHARED_PANEL_Y = CULTURE_TOGGLE_Y + TOGGLE_SIZE + 12;
const PANEL_WIDTH = 560;
const PANEL_INNER_PADDING = 20;
const PANEL_MASK_PADDING = 10;
const PANEL_MIN_HEIGHT = 180;
const PANEL_BOTTOM_PADDING = 20;
const PANEL_SCROLLBAR_WIDTH = 10;
const PANEL_SCROLLBAR_GAP = 12;
const PANEL_CONTENT_WIDTH = PANEL_WIDTH - (PANEL_INNER_PADDING * 2) - PANEL_SCROLLBAR_WIDTH - PANEL_SCROLLBAR_GAP;
const LINE_HEIGHT = 29;
const BUTTON_HEIGHT = 34;
const BUTTON_GAP = 7;
const SECTION_GAP = 17;
const SCROLL_STEP = 56;
const HUD_TEXT_RESOLUTION = getHudTextResolution();

interface TechButtonView {
  id: string;
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  hovered: boolean;
  pressed: boolean;
}

export class ResearchHudPanel {
  private readonly wheelBlockerId = `research-panel-wheel-${Math.random().toString(36).slice(2)}`;
  private readonly addOwned: AddOwned;
  private readonly blocker: Phaser.GameObjects.Zone;
  private readonly toggleButton: CircularHudProgressButton;
  private readonly panelBackground: Phaser.GameObjects.Rectangle;
  private readonly scrollbarTrack: Phaser.GameObjects.Rectangle;
  private readonly scrollbarThumb: Phaser.GameObjects.Rectangle;
  private readonly contentMaskGraphics: Phaser.GameObjects.Graphics;
  private readonly contentMask: Phaser.Display.Masks.GeometryMask;
  private readonly contentObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly currentText: Phaser.GameObjects.Text;
  private readonly progressText: Phaser.GameObjects.Text;
  private readonly scienceText: Phaser.GameObjects.Text;
  private readonly availableHeading: Phaser.GameObjects.Text;
  private readonly researchedHeading: Phaser.GameObjects.Text;
  private readonly researchedText: Phaser.GameObjects.Text;
  private readonly handleWheel: (
    pointer: Phaser.Input.Pointer,
    gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
    deltaZ: number,
    event: WheelEvent,
  ) => void;

  private readonly techButtons: TechButtonView[] = [];
  private collapsed = true;
  private draggingScrollbar = false;
  private dragPointerId: number | null = null;
  private dragStartPointerY = 0;
  private dragStartScrollOffset = 0;
  private scrollOffset = 0;
  private maxScroll = 0;
  private panelBounds = new Phaser.Geom.Rectangle();
  private state: HudResearchState = {
    currentName: 'None',
    progress: 0,
    cost: 0,
    progressPercent: 0,
    sciencePerTurn: 0,
    available: [],
    researchedNames: [],
    tooltip: 'Researching: None selected',
  };
  private onSelectTechnology: ((techId: string) => boolean) | null = null;
  private onToggle: ((collapsed: boolean) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    addOwned: AddOwned,
    private readonly worldInputGate: WorldInputGate,
  ) {
    this.addOwned = addOwned;
    this.worldInputGate.registerWheelBlocker(
      this.wheelBlockerId,
      (screenX, screenY) => !this.collapsed && this.panelBounds.contains(screenX, screenY),
    );
    this.blocker = addOwned(new Phaser.GameObjects.Zone(scene, 0, 0, scene.scale.width, scene.scale.height))
      .setOrigin(0, 0)
      .setDepth(DEPTH - 1)
      .setScrollFactor(0)
      .setInteractive();
    this.toggleButton = new CircularHudProgressButton(scene, addOwned, worldInputGate, {
      depth: DEPTH,
      diameter: TOGGLE_SIZE,
      hitDiameter: TOGGLE_HIT_SIZE,
      icon: '🔬',
      iconSize: 39,
      progressColor: 0x38bdf8,
      accentColor: 0x68a9d5,
    });
    this.toggleButton.setOnClick(() => {
      this.setCollapsed(!this.collapsed);
      this.onToggle?.(this.collapsed);
    });

    this.panelBackground = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, PANEL_WIDTH, 100, 0x071017, 0.88))
      .setOrigin(0, 0)
      .setDepth(DEPTH)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0x7fb4d5, 0.45);
    this.scrollbarTrack = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, PANEL_SCROLLBAR_WIDTH, 10, 0x15222d, 0.9))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.scrollbarThumb = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, PANEL_SCROLLBAR_WIDTH, 32, 0x6faed0, 0.95))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    this.contentMaskGraphics = new Phaser.GameObjects.Graphics(scene);
    this.contentMask = this.contentMaskGraphics.createGeometryMask();

    this.titleText = this.createMaskedText('Research', 24, '#f2f7fb', 'bold');
    this.currentText = this.createMaskedText('', 18, '#f2f7fb', 'normal', PANEL_CONTENT_WIDTH);
    this.progressText = this.createMaskedText('', 17, '#c7d6e5');
    this.scienceText = this.createMaskedText('', 17, '#8fd0ff');
    this.availableHeading = this.createMaskedText('Available', 16, '#88a6bd', 'bold');
    this.researchedHeading = this.createMaskedText('Researched', 16, '#88a6bd', 'bold');
    this.researchedText = this.createMaskedText('', 16, '#d5dde5', 'normal', PANEL_CONTENT_WIDTH);

    this.blocker.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (this.collapsed || pointer.button !== 0) return;
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
    });
    this.blocker.on(Phaser.Input.Events.POINTER_UP, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (this.collapsed || pointer.button !== 0) return;
      consumePointerEvent(pointer);
      this.worldInputGate.releasePointer(pointer.id);
    });

    this.handleWheel = (pointer, _gameObjects, _deltaX, deltaY, _deltaZ, event) => {
      if (this.collapsed || this.maxScroll <= 0) return;
      if (!this.panelBounds.contains(pointer.x, pointer.y)) return;
      consumePointerEvent(pointer);
      event.preventDefault?.();
      this.applyScroll(Math.sign(deltaY) * SCROLL_STEP);
    };
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);

    this.scrollbarTrack.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (pointer.button !== 0 || this.collapsed || this.maxScroll <= 0) return;
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
      const trackHeight = this.scrollbarTrack.displayHeight;
      const thumbHeight = this.scrollbarThumb.displayHeight;
      const thumbTop = this.scrollbarThumb.y - this.scrollbarTrack.y;
      const targetThumbTop = Phaser.Math.Clamp(localY - (thumbHeight / 2), 0, Math.max(0, trackHeight - thumbHeight));
      if (targetThumbTop < thumbTop) {
        this.applyScroll(-Math.max(SCROLL_STEP, this.getVisibleContentHeight() * 0.8));
      } else if (targetThumbTop > thumbTop) {
        this.applyScroll(Math.max(SCROLL_STEP, this.getVisibleContentHeight() * 0.8));
      }
      this.worldInputGate.releasePointer(pointer.id);
    });

    this.scrollbarThumb.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (pointer.button !== 0 || this.collapsed || this.maxScroll <= 0) return;
      this.draggingScrollbar = true;
      this.dragPointerId = pointer.id;
      this.dragStartPointerY = pointer.y;
      this.dragStartScrollOffset = this.scrollOffset;
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
    });

    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp);

    this.refreshToggleState();
  }

  setState(state: HudResearchState): void {
    this.state = state;
    this.currentText.setText(`Current: ${state.currentName}`);
    this.progressText.setText(`Progress: ${state.progress} / ${state.cost}`);
    this.scienceText.setText(`Science: +${state.sciencePerTurn}/turn`);
    this.researchedText.setText(state.researchedNames.length > 0 ? state.researchedNames.join(', ') : 'None');
    this.toggleButton.setProgress(state.cost > 0 ? state.progress / state.cost : 0);
    this.toggleButton.setTooltip(state.tooltip);
    this.rebuildTechButtons();
    this.layout(this.scene.scale.width, this.scene.scale.height);
  }

  setOnSelectTechnology(handler: (techId: string) => boolean): void {
    this.onSelectTechnology = handler;
  }

  setOnToggle(handler: (collapsed: boolean) => void): void {
    this.onToggle = handler;
  }

  setCollapsed(collapsed: boolean): void {
    if (this.collapsed === collapsed) return;
    this.collapsed = collapsed;
    this.layout(this.scene.scale.width, this.scene.scale.height);
    this.refreshToggleState();
  }

  layout(viewportWidth: number, viewportHeight: number): void {
    const toggleX = EDGE_MARGIN;
    const toggleY = TOGGLE_BASE_Y;
    this.toggleButton.layout(toggleX, toggleY);

    const panelVisible = !this.collapsed;
    this.blocker.setVisible(panelVisible).setPosition(0, 0).setSize(viewportWidth, viewportHeight);
    this.panelBackground.setVisible(panelVisible);

    const panelX = EDGE_MARGIN;
    const panelY = SHARED_PANEL_Y;
    const availableHeight = Math.max(PANEL_MIN_HEIGHT, viewportHeight - panelY - EDGE_MARGIN);
    this.panelBounds.setTo(panelX, panelY, PANEL_WIDTH, availableHeight);

    const innerX = panelX + PANEL_INNER_PADDING;
    const contentX = innerX;
    const baseY = panelY + 18 - this.scrollOffset;
    let contentCursor = 0;

    this.titleText.setVisible(panelVisible).setPosition(Math.round(contentX), Math.round(baseY + contentCursor));
    contentCursor += LINE_HEIGHT + 5;

    this.currentText.setVisible(panelVisible).setPosition(Math.round(contentX), Math.round(baseY + contentCursor));
    contentCursor += this.currentText.height + 8;

    this.progressText.setVisible(panelVisible).setPosition(Math.round(contentX), Math.round(baseY + contentCursor));
    contentCursor += LINE_HEIGHT;

    this.scienceText.setVisible(panelVisible).setPosition(Math.round(contentX), Math.round(baseY + contentCursor));
    contentCursor += LINE_HEIGHT + SECTION_GAP;

    this.availableHeading.setVisible(panelVisible).setPosition(Math.round(contentX), Math.round(baseY + contentCursor));
    contentCursor += LINE_HEIGHT;

    for (const button of this.techButtons) {
      button.background.setVisible(panelVisible)
        .setPosition(Math.round(contentX), Math.round(baseY + contentCursor))
        .setDisplaySize(PANEL_CONTENT_WIDTH, BUTTON_HEIGHT);
      button.label.setVisible(panelVisible)
        .setPosition(Math.round(contentX + 12), Math.round(baseY + contentCursor + (BUTTON_HEIGHT / 2)));
      contentCursor += BUTTON_HEIGHT + BUTTON_GAP;
    }

    if (this.techButtons.length === 0) {
      contentCursor += 4;
    }

    contentCursor += SECTION_GAP - BUTTON_GAP;
    this.researchedHeading.setVisible(panelVisible).setPosition(Math.round(contentX), Math.round(baseY + contentCursor));
    contentCursor += LINE_HEIGHT;

    this.researchedText.setVisible(panelVisible).setPosition(Math.round(contentX), Math.round(baseY + contentCursor));
    contentCursor += this.researchedText.height + PANEL_BOTTOM_PADDING;

    const fullContentHeight = contentCursor + 18;
    const panelHeight = Math.min(Math.max(PANEL_MIN_HEIGHT, fullContentHeight), availableHeight);
    this.panelBounds.height = panelHeight;
    this.panelBackground.setPosition(Math.round(panelX), Math.round(panelY)).setDisplaySize(PANEL_WIDTH, Math.round(panelHeight));

    this.updateMask(panelX, panelY, panelHeight);
    this.updateScrollState(fullContentHeight, panelHeight);
    this.updateScrollbar(panelVisible, panelX, panelY, panelHeight);
    this.refreshMaskedContentVisibility(panelVisible);
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp);
    this.worldInputGate.unregisterWheelBlocker(this.wheelBlockerId);
    this.blocker.destroy();
    this.toggleButton.destroy();
    this.panelBackground.destroy();
    this.scrollbarTrack.destroy();
    this.scrollbarThumb.destroy();
    this.contentMaskGraphics.destroy();
    this.titleText.destroy();
    this.currentText.destroy();
    this.progressText.destroy();
    this.scienceText.destroy();
    this.availableHeading.destroy();
    this.researchedHeading.destroy();
    this.researchedText.destroy();
    this.destroyTechButtons();
  }

  private createMaskedText(
    text: string,
    size: number,
    color: string,
    fontStyle = 'normal',
    wrapWidth?: number,
  ): Phaser.GameObjects.Text {
    const object = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, text, {
      fontFamily: 'sans-serif',
      fontSize: `${size}px`,
      color,
      fontStyle,
      ...(wrapWidth ? { wordWrap: { width: wrapWidth, useAdvancedWrap: true } } : {}),
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION);
    object.setMask(this.contentMask);
    this.contentObjects.push(object);
    return object;
  }

  private rebuildTechButtons(): void {
    this.destroyTechButtons();
    for (const tech of this.state.available) {
      const background = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, PANEL_CONTENT_WIDTH, BUTTON_HEIGHT, 0x153343, 0.96))
        .setOrigin(0, 0)
        .setDepth(DEPTH + 1)
        .setScrollFactor(0)
        .setStrokeStyle(1, 0x6fb2d4, 0.5)
        .setInteractive({ useHandCursor: true })
        .setMask(this.contentMask);
      const label = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, `${tech.name} (${tech.cost})`, {
        fontFamily: 'sans-serif',
        fontSize: '16px',
        color: '#ddf2ff',
      }))
        .setOrigin(0, 0.5)
        .setDepth(DEPTH + 2)
        .setScrollFactor(0)
        .setResolution(HUD_TEXT_RESOLUTION)
        .setMask(this.contentMask);

      this.contentObjects.push(background, label);
      const button: TechButtonView = { id: tech.id, background, label, hovered: false, pressed: false };

      background.on(Phaser.Input.Events.POINTER_OVER, (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        button.hovered = true;
        this.refreshTechButtonVisual(button);
      });
      background.on(Phaser.Input.Events.POINTER_OUT, (
        _pointer: Phaser.Input.Pointer,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        button.hovered = false;
        button.pressed = false;
        this.refreshTechButtonVisual(button);
      });
      background.on(Phaser.Input.Events.POINTER_DOWN, (
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
        this.refreshTechButtonVisual(button);
      });
      background.on(Phaser.Input.Events.POINTER_UP, (
        pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        if (pointer.button !== 0) return;
        consumePointerEvent(pointer);
        const shouldSelect = button.pressed;
        button.pressed = false;
        this.worldInputGate.releasePointer(pointer.id);
        if (shouldSelect) {
          if (this.onSelectTechnology?.(tech.id)) {
            this.setCollapsed(true);
          }
        }
        this.refreshTechButtonVisual(button);
      });

      this.refreshTechButtonVisual(button);
      this.techButtons.push(button);
    }
  }

  private destroyTechButtons(): void {
    for (const button of this.techButtons) {
      const backgroundIndex = this.contentObjects.indexOf(button.background);
      if (backgroundIndex >= 0) this.contentObjects.splice(backgroundIndex, 1);
      const labelIndex = this.contentObjects.indexOf(button.label);
      if (labelIndex >= 0) this.contentObjects.splice(labelIndex, 1);
      button.background.destroy();
      button.label.destroy();
    }
    this.techButtons.length = 0;
  }

  private applyScroll(delta: number): void {
    const clamped = Phaser.Math.Clamp(this.scrollOffset + delta, 0, this.maxScroll);
    if (clamped === this.scrollOffset) return;
    this.scrollOffset = clamped;
    this.layout(this.scene.scale.width, this.scene.scale.height);
  }

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.draggingScrollbar || this.dragPointerId !== pointer.id || this.maxScroll <= 0) return;
    const trackTravel = this.scrollbarTrack.displayHeight - this.scrollbarThumb.displayHeight;
    if (trackTravel <= 0) return;
    const deltaY = pointer.y - this.dragStartPointerY;
    const scrollDelta = (deltaY / trackTravel) * this.maxScroll;
    const clamped = Phaser.Math.Clamp(this.dragStartScrollOffset + scrollDelta, 0, this.maxScroll);
    if (clamped === this.scrollOffset) return;
    this.scrollOffset = clamped;
    this.layout(this.scene.scale.width, this.scene.scale.height);
  };

  private readonly handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (!this.draggingScrollbar || this.dragPointerId !== pointer.id) return;
    this.draggingScrollbar = false;
    this.dragPointerId = null;
    this.worldInputGate.releasePointer(pointer.id);
  };

  private getVisibleContentHeight(): number {
    return Math.max(1, this.panelBounds.height - (PANEL_MASK_PADDING * 2));
  }

  private updateMask(panelX: number, panelY: number, panelHeight: number): void {
    this.contentMaskGraphics.clear();
    this.contentMaskGraphics.fillStyle(0xffffff, 1);
    this.contentMaskGraphics.fillRect(
      panelX + PANEL_MASK_PADDING,
      panelY + PANEL_MASK_PADDING,
      PANEL_WIDTH - (PANEL_MASK_PADDING * 2) - PANEL_SCROLLBAR_WIDTH - PANEL_SCROLLBAR_GAP,
      panelHeight - (PANEL_MASK_PADDING * 2),
    );
  }

  private updateScrollState(fullContentHeight: number, panelHeight: number): void {
    const visibleContentHeight = panelHeight - (PANEL_MASK_PADDING * 2);
    this.maxScroll = Math.max(0, fullContentHeight - visibleContentHeight);
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset, 0, this.maxScroll);
  }

  private updateScrollbar(panelVisible: boolean, panelX: number, panelY: number, panelHeight: number): void {
    const shouldShow = panelVisible && this.maxScroll > 0;
    this.scrollbarTrack.setVisible(shouldShow);
    this.scrollbarThumb.setVisible(shouldShow);
    if (!shouldShow) return;

    const trackX = panelX + PANEL_WIDTH - PANEL_SCROLLBAR_WIDTH - 10;
    const trackY = panelY + PANEL_MASK_PADDING;
    const trackHeight = panelHeight - (PANEL_MASK_PADDING * 2);
    const visibleContentHeight = panelHeight - (PANEL_MASK_PADDING * 2);
    const fullContentHeight = visibleContentHeight + this.maxScroll;
    const thumbHeight = Math.max(32, Math.round(trackHeight * (visibleContentHeight / fullContentHeight)));
    const thumbTravel = trackHeight - thumbHeight;
    const thumbY = trackY + (this.maxScroll > 0 ? (this.scrollOffset / this.maxScroll) * thumbTravel : 0);

    this.scrollbarTrack.setPosition(Math.round(trackX), Math.round(trackY)).setDisplaySize(PANEL_SCROLLBAR_WIDTH, Math.round(trackHeight));
    this.scrollbarThumb.setPosition(Math.round(trackX), Math.round(thumbY)).setDisplaySize(PANEL_SCROLLBAR_WIDTH, Math.round(thumbHeight));
  }

  private refreshMaskedContentVisibility(panelVisible: boolean): void {
    for (const object of this.contentObjects) {
      (object as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible).setVisible(panelVisible);
    }
  }

  private refreshToggleState(): void {
    this.toggleButton.setActive(!this.collapsed);
  }

  private refreshTechButtonVisual(button: TechButtonView): void {
    if (button.pressed) {
      button.background.setFillStyle(0x1f4b62, 0.98).setScale(0.985);
      return;
    }
    if (button.hovered) {
      button.background.setFillStyle(0x1d495e, 1).setScale(1.01);
      return;
    }
    button.background.setFillStyle(0x153343, 0.96).setScale(1);
  }
}

function getHudTextResolution(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}
