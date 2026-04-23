import Phaser from 'phaser';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';
import type { HudPolicyEntry, HudPolicyState } from './NationHudDataProvider';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

const DEPTH = 140;
const EDGE_MARGIN = 16;
const TOGGLE_GAP = 12;
const TOGGLE_SIZE = 62;
const TOGGLE_BASE_Y = EDGE_MARGIN + 46;
const CULTURE_TOGGLE_Y = TOGGLE_BASE_Y + TOGGLE_SIZE + TOGGLE_GAP;
const SHARED_PANEL_Y = CULTURE_TOGGLE_Y + TOGGLE_SIZE + 12;
const PANEL_WIDTH = 560;
const PANEL_INNER_PADDING = 20;
const PANEL_MASK_PADDING = 10;
const PANEL_MIN_HEIGHT = 200;
const PANEL_BOTTOM_PADDING = 24;
const PANEL_SCROLLBAR_WIDTH = 10;
const PANEL_SCROLLBAR_GAP = 12;
const PANEL_CONTENT_WIDTH = PANEL_WIDTH - (PANEL_INNER_PADDING * 2) - PANEL_SCROLLBAR_WIDTH - PANEL_SCROLLBAR_GAP;
const LINE_HEIGHT = 29;
const BUTTON_HEIGHT = 72;
const BUTTON_GAP = 8;
const SECTION_GAP = 16;
const SCROLL_STEP = 56;
const HUD_TEXT_RESOLUTION = getHudTextResolution();

interface PolicyButtonView {
  id: string;
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  detail: Phaser.GameObjects.Text;
  prerequisite: Phaser.GameObjects.Text;
  isSelectable: boolean;
  baseFillColor: number;
  baseFillAlpha: number;
  hovered: boolean;
  pressed: boolean;
}

export class CultureHudPanel {
  private readonly wheelBlockerId = `culture-panel-wheel-${Math.random().toString(36).slice(2)}`;
  private readonly addOwned: AddOwned;
  private readonly blocker: Phaser.GameObjects.Zone;
  private readonly toggleBackground: Phaser.GameObjects.Rectangle;
  private readonly toggleIcon: Phaser.GameObjects.Text;
  private readonly toggleHitArea: Phaser.GameObjects.Zone;
  private readonly panelBackground: Phaser.GameObjects.Rectangle;
  private readonly toggleProgressText: Phaser.GameObjects.Text;
  private readonly scrollbarTrack: Phaser.GameObjects.Rectangle;
  private readonly scrollbarThumb: Phaser.GameObjects.Rectangle;
  private readonly contentMaskGraphics: Phaser.GameObjects.Graphics;
  private readonly contentMask: Phaser.Display.Masks.GeometryMask;
  private readonly contentObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly currentText: Phaser.GameObjects.Text;
  private readonly progressText: Phaser.GameObjects.Text;
  private readonly cultureText: Phaser.GameObjects.Text;
  private readonly treeTitleTexts: Phaser.GameObjects.Text[] = [];
  private readonly treeDescriptionTexts: Phaser.GameObjects.Text[] = [];
  private readonly handleWheel: (
    pointer: Phaser.Input.Pointer,
    gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
    deltaZ: number,
    event: WheelEvent,
  ) => void;

  private readonly policyButtons: PolicyButtonView[] = [];
  private collapsed = true;
  private hoveredToggle = false;
  private togglePressed = false;
  private draggingScrollbar = false;
  private dragPointerId: number | null = null;
  private dragStartPointerY = 0;
  private dragStartScrollOffset = 0;
  private scrollOffset = 0;
  private maxScroll = 0;
  private panelBounds = new Phaser.Geom.Rectangle();
  private onSelectPolicy: ((policyId: string) => boolean) | null = null;
  private onToggle: ((collapsed: boolean) => void) | null = null;
  private state: HudPolicyState = {
    currentName: 'None selected',
    progress: 0,
    cost: 0,
    progressPercent: 0,
    culturePerTurn: 0,
    trees: [],
  };

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

    this.toggleBackground = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, TOGGLE_SIZE, TOGGLE_SIZE, 0x0c141d, 0.92))
      .setOrigin(0, 0)
      .setDepth(DEPTH)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x68a9d5, 0.72);
    this.toggleIcon = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '⭐', {
      fontFamily: 'sans-serif',
      fontSize: '31px',
      color: '#eef7ff',
    }))
      .setOrigin(0.5)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION);
    this.toggleHitArea = addOwned(new Phaser.GameObjects.Zone(scene, 0, 0, TOGGLE_SIZE, TOGGLE_SIZE))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    this.panelBackground = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, PANEL_WIDTH, 100, 0x071017, 0.88))
      .setOrigin(0, 0)
      .setDepth(DEPTH)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0x7fb4d5, 0.45);
    this.toggleProgressText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#eef7ff',
      fontStyle: 'bold',
    }))
      .setOrigin(0.5, 1)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);
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

    this.titleText = this.createMaskedText('Culture', 24, '#f2f7fb', 'bold');
    this.currentText = this.createMaskedText('', 18, '#f2f7fb', 'normal', PANEL_CONTENT_WIDTH);
    this.progressText = this.createMaskedText('', 17, '#c7d6e5');
    this.cultureText = this.createMaskedText('', 17, '#8fd0ff');

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

    this.toggleHitArea.on(Phaser.Input.Events.POINTER_OVER, () => {
      this.hoveredToggle = true;
      this.toggleProgressText.setText(`${this.state.progressPercent}%`).setVisible(true);
      this.refreshToggleState();
    });
    this.toggleHitArea.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.hoveredToggle = false;
      this.togglePressed = false;
      this.toggleProgressText.setVisible(false);
      this.refreshToggleState();
    });
    this.toggleHitArea.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      this.worldInputGate.claimPointer(pointer.id);
      this.togglePressed = true;
      consumePointerEvent(pointer);
      this.refreshToggleState();
    });
    this.toggleHitArea.on(Phaser.Input.Events.POINTER_UP, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      consumePointerEvent(pointer);
      const shouldToggle = this.togglePressed;
      this.togglePressed = false;
      this.worldInputGate.releasePointer(pointer.id);
      if (shouldToggle) {
        this.setCollapsed(!this.collapsed);
        this.onToggle?.(this.collapsed);
      }
      this.refreshToggleState();
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
    this.layout(scene.scale.width, scene.scale.height);
  }

  setState(state: HudPolicyState): void {
    this.state = state;
    this.currentText.setText(`Current: ${state.currentName}`);
    this.progressText.setText(
      state.cost > 0
        ? `Progress: ${state.progress} / ${state.cost}`
        : `Stored Progress: ${state.progress}`,
    );
    this.cultureText.setText(`Culture: +${state.culturePerTurn}/turn`);
    this.rebuildPolicyButtons();
    this.layout(this.scene.scale.width, this.scene.scale.height);
  }

  setOnSelectPolicy(handler: (policyId: string) => boolean): void {
    this.onSelectPolicy = handler;
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
    const toggleY = CULTURE_TOGGLE_Y;
    this.toggleBackground.setPosition(Math.round(toggleX), Math.round(toggleY));
    this.toggleIcon.setPosition(Math.round(toggleX + (TOGGLE_SIZE / 2)), Math.round(toggleY + (TOGGLE_SIZE / 2)));
    this.toggleProgressText.setPosition(Math.round(toggleX + (TOGGLE_SIZE / 2)), Math.round(toggleY - 4));
    this.toggleHitArea.setPosition(Math.round(toggleX), Math.round(toggleY)).setSize(TOGGLE_SIZE, TOGGLE_SIZE);

    const panelVisible = !this.collapsed;
    this.blocker.setVisible(panelVisible).setPosition(0, 0).setSize(viewportWidth, viewportHeight);
    this.panelBackground.setVisible(panelVisible);

    const panelX = EDGE_MARGIN;
    const panelY = SHARED_PANEL_Y;
    const availableHeight = Math.max(PANEL_MIN_HEIGHT, viewportHeight - panelY - EDGE_MARGIN);
    this.panelBounds.setTo(panelX, panelY, PANEL_WIDTH, availableHeight);

    const innerX = panelX + PANEL_INNER_PADDING;
    const baseY = panelY + 18 - this.scrollOffset;
    let contentCursor = 0;

    this.titleText.setVisible(panelVisible).setPosition(Math.round(innerX), Math.round(baseY + contentCursor));
    contentCursor += LINE_HEIGHT + 5;

    this.currentText.setVisible(panelVisible).setPosition(Math.round(innerX), Math.round(baseY + contentCursor));
    contentCursor += this.currentText.height + 8;

    this.progressText.setVisible(panelVisible).setPosition(Math.round(innerX), Math.round(baseY + contentCursor));
    contentCursor += LINE_HEIGHT;

    this.cultureText.setVisible(panelVisible).setPosition(Math.round(innerX), Math.round(baseY + contentCursor));
    contentCursor += LINE_HEIGHT + SECTION_GAP;

    let treeIndex = 0;
    let buttonIndex = 0;
    for (const tree of this.state.trees) {
      const treeTitle = this.treeTitleTexts[treeIndex];
      const treeDescription = this.treeDescriptionTexts[treeIndex];

      treeTitle.setVisible(panelVisible).setPosition(Math.round(innerX), Math.round(baseY + contentCursor));
      contentCursor += LINE_HEIGHT - 2;

      if (tree.description) {
        treeDescription
          .setVisible(panelVisible)
          .setPosition(Math.round(innerX), Math.round(baseY + contentCursor))
          .setText(tree.description);
        contentCursor += treeDescription.height + 6;
      } else {
        treeDescription.setVisible(false);
      }

      for (const _policy of tree.policies) {
        const button = this.policyButtons[buttonIndex];
        button.background.setVisible(panelVisible)
          .setPosition(Math.round(innerX), Math.round(baseY + contentCursor))
          .setDisplaySize(PANEL_CONTENT_WIDTH, BUTTON_HEIGHT);
        button.label.setVisible(panelVisible).setPosition(Math.round(innerX + 12), Math.round(baseY + contentCursor + 12));
        button.detail.setVisible(panelVisible).setPosition(Math.round(innerX + 12), Math.round(baseY + contentCursor + 33));
        button.prerequisite.setVisible(panelVisible).setPosition(Math.round(innerX + 12), Math.round(baseY + contentCursor + 52));
        contentCursor += BUTTON_HEIGHT + BUTTON_GAP;
        buttonIndex += 1;
      }

      contentCursor += SECTION_GAP - BUTTON_GAP;
      treeIndex += 1;
    }

    const fullContentHeight = contentCursor + PANEL_BOTTOM_PADDING;
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
    this.toggleBackground.destroy();
    this.toggleIcon.destroy();
    this.toggleProgressText.destroy();
    this.toggleHitArea.destroy();
    this.panelBackground.destroy();
    this.scrollbarTrack.destroy();
    this.scrollbarThumb.destroy();
    this.contentMaskGraphics.destroy();
    this.titleText.destroy();
    this.currentText.destroy();
    this.progressText.destroy();
    this.cultureText.destroy();
    this.destroyPolicyButtons();
    for (const text of this.treeTitleTexts) text.destroy();
    for (const text of this.treeDescriptionTexts) text.destroy();
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

  private rebuildPolicyButtons(): void {
    this.destroyPolicyButtons();
    for (const text of this.treeTitleTexts) {
      const index = this.contentObjects.indexOf(text);
      if (index >= 0) this.contentObjects.splice(index, 1);
      text.destroy();
    }
    for (const text of this.treeDescriptionTexts) {
      const index = this.contentObjects.indexOf(text);
      if (index >= 0) this.contentObjects.splice(index, 1);
      text.destroy();
    }
    this.treeTitleTexts.length = 0;
    this.treeDescriptionTexts.length = 0;

    for (const tree of this.state.trees) {
      const title = this.createMaskedText(tree.name, 16, '#88a6bd', 'bold');
      const description = this.createMaskedText(tree.description ?? '', 15, '#9fb2c3', 'normal', PANEL_CONTENT_WIDTH);
      this.treeTitleTexts.push(title);
      this.treeDescriptionTexts.push(description);

      for (const entry of tree.policies) {
        this.policyButtons.push(this.createPolicyButton(entry));
      }
    }
  }

  private createPolicyButton(entry: HudPolicyEntry): PolicyButtonView {
    const style = getPolicyVisualState(entry);
    const background = this.addOwned(
      new Phaser.GameObjects.Rectangle(this.scene, 0, 0, PANEL_CONTENT_WIDTH, BUTTON_HEIGHT, style.fillColor, style.fillAlpha),
    )
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setStrokeStyle(1, style.strokeColor, 0.58)
      .setInteractive({ useHandCursor: style.isSelectable })
      .setMask(this.contentMask);
    const label = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, `${entry.name} (${entry.effectiveCost})`, {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: style.labelColor,
      fontStyle: entry.isActive ? 'bold' : 'normal',
      wordWrap: { width: PANEL_CONTENT_WIDTH - 24, useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setMask(this.contentMask);
    const detail = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, getDetailText(entry), {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: style.detailColor,
      wordWrap: { width: PANEL_CONTENT_WIDTH - 24, useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setMask(this.contentMask);
    const prerequisite = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, getPrerequisiteText(entry), {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: style.prerequisiteColor,
      wordWrap: { width: PANEL_CONTENT_WIDTH - 24, useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setMask(this.contentMask);

    this.contentObjects.push(background, label, detail, prerequisite);
    const button: PolicyButtonView = {
      id: entry.id,
      background,
      label,
      detail,
      prerequisite,
      isSelectable: style.isSelectable,
      baseFillColor: style.fillColor,
      baseFillAlpha: style.fillAlpha,
      hovered: false,
      pressed: false,
    };

    background.on(Phaser.Input.Events.POINTER_OVER, (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (!button.isSelectable) return;
      button.hovered = true;
      refreshPolicyButtonVisual(button);
    });
    background.on(Phaser.Input.Events.POINTER_OUT, (
      _pointer: Phaser.Input.Pointer,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      button.hovered = false;
      button.pressed = false;
      refreshPolicyButtonVisual(button);
    });
    background.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (!button.isSelectable || pointer.button !== 0) return;
      this.worldInputGate.claimPointer(pointer.id);
      button.pressed = true;
      consumePointerEvent(pointer);
      refreshPolicyButtonVisual(button);
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
      const shouldSelect = button.isSelectable && button.pressed;
      button.pressed = false;
      this.worldInputGate.releasePointer(pointer.id);
      if (shouldSelect) {
        if (this.onSelectPolicy?.(button.id)) {
          this.setCollapsed(true);
        }
      }
      refreshPolicyButtonVisual(button);
    });

    refreshPolicyButtonVisual(button);
    return button;
  }

  private destroyPolicyButtons(): void {
    for (const button of this.policyButtons) {
      for (const object of [button.background, button.label, button.detail, button.prerequisite]) {
        const index = this.contentObjects.indexOf(object);
        if (index >= 0) this.contentObjects.splice(index, 1);
      }
      button.background.destroy();
      button.label.destroy();
      button.detail.destroy();
      button.prerequisite.destroy();
    }
    this.policyButtons.length = 0;
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
    const fill = this.togglePressed
      ? 0x16394b
      : this.hoveredToggle
        ? 0x15303f
        : 0x0c141d;
    this.toggleBackground
      .setFillStyle(fill, 0.94)
      .setStrokeStyle(2, this.collapsed ? 0x68a9d5 : 0x9ed7ff, this.hoveredToggle ? 0.95 : 0.72);
  }
}

function getPolicyVisualState(entry: HudPolicyEntry): {
  fillColor: number;
  fillAlpha: number;
  strokeColor: number;
  labelColor: string;
  detailColor: string;
  prerequisiteColor: string;
  isSelectable: boolean;
} {
  if (entry.isUnlocked) {
    return {
      fillColor: 0x183226,
      fillAlpha: 0.92,
      strokeColor: 0x73b58e,
      labelColor: '#e1f4e7',
      detailColor: '#b8d8c0',
      prerequisiteColor: '#8fb19d',
      isSelectable: false,
    };
  }
  if (entry.isActive) {
    return {
      fillColor: 0x2a2141,
      fillAlpha: 0.94,
      strokeColor: 0xb39cff,
      labelColor: '#f0ebff',
      detailColor: '#d5cfff',
      prerequisiteColor: '#b7aadf',
      isSelectable: false,
    };
  }
  if (entry.isAvailable) {
    return {
      fillColor: 0x153343,
      fillAlpha: 0.96,
      strokeColor: 0x6fb2d4,
      labelColor: '#ddf2ff',
      detailColor: '#c5dbeb',
      prerequisiteColor: '#9fc0d5',
      isSelectable: true,
    };
  }
  return {
    fillColor: 0x1a1d24,
    fillAlpha: 0.9,
    strokeColor: 0x59606c,
    labelColor: '#c3c7ce',
    detailColor: '#a6adb8',
    prerequisiteColor: '#d8a3a3',
    isSelectable: false,
  };
}

function getDetailText(entry: HudPolicyEntry): string {
  if (entry.isUnlocked) return `Unlocked - ${entry.description}`;
  if (entry.isActive) return `Active - ${entry.description}`;
  if (entry.isAvailable) return `Available - ${entry.description}`;
  return `Locked - ${entry.description}`;
}

function getPrerequisiteText(entry: HudPolicyEntry): string {
  if (entry.prerequisiteNames.length === 0) {
    return 'Prerequisites: none';
  }
  if (entry.missingPrerequisiteNames.length === 0) {
    return `Prerequisites: ${entry.prerequisiteNames.join(', ')}`;
  }
  return `Missing: ${entry.missingPrerequisiteNames.join(', ')}`;
}

function refreshPolicyButtonVisual(button: PolicyButtonView): void {
  const scale = button.pressed ? 0.985 : button.hovered && button.isSelectable ? 1.01 : 1;
  button.background.setScale(scale);

  if (!button.isSelectable) {
    button.background.setFillStyle(button.baseFillColor, button.baseFillAlpha);
    return;
  }

  if (button.pressed) {
    button.background.setFillStyle(0x1f4b62, 0.98);
  } else if (button.hovered) {
    button.background.setFillStyle(0x1d495e, 1);
  } else {
    button.background.setFillStyle(0x153343, 0.96);
  }
}

function getHudTextResolution(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}
