import Phaser from 'phaser';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';
import { CircularHudProgressButton } from './CircularHudProgressButton';
import type { HudCultureEntry, HudCultureState } from './NationHudDataProvider';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

const DEPTH = 140;
const EDGE_MARGIN = 16;
const TOGGLE_GAP = 14;
const TOGGLE_SIZE = 102;
const TOGGLE_HIT_SIZE = 122;
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
const BUTTON_HEIGHT = 112;
const BUTTON_GAP = 10;
const CULTURE_ICON_SIZE = 68;
const CULTURE_ICON_PADDING = 14;
const CULTURE_TEXT_GAP = 14;
const SECTION_GAP = 16;
const SCROLL_STEP = 56;
const HUD_TEXT_RESOLUTION = getHudTextResolution();

interface CultureButtonView {
  id: string;
  imageKey: string;
  background: Phaser.GameObjects.Rectangle;
  iconFrame: Phaser.GameObjects.Rectangle;
  iconImage: Phaser.GameObjects.Image;
  fallbackIcon: Phaser.GameObjects.Text;
  nameText: Phaser.GameObjects.Text;
  metaText: Phaser.GameObjects.Text;
  descriptionText: Phaser.GameObjects.Text;
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
  private readonly cultureText: Phaser.GameObjects.Text;
  private readonly eraTitleTexts: Phaser.GameObjects.Text[] = [];
  private readonly handleWheel: (
    pointer: Phaser.Input.Pointer,
    gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
    deltaZ: number,
    event: WheelEvent,
  ) => void;

  private readonly cultureButtons: CultureButtonView[] = [];
  private collapsed = true;
  private draggingScrollbar = false;
  private dragPointerId: number | null = null;
  private dragStartPointerY = 0;
  private dragStartScrollOffset = 0;
  private scrollOffset = 0;
  private maxScroll = 0;
  private panelBounds = new Phaser.Geom.Rectangle();
  private onSelectCultureNode: ((nodeId: string) => boolean) | null = null;
  private onToggle: ((collapsed: boolean) => void) | null = null;
  private state: HudCultureState = {
    currentName: 'None selected',
    progress: 0,
    cost: 0,
    progressPercent: 0,
    culturePerTurn: 0,
    tooltip: 'Culture: None selected',
    eras: [],
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

    this.toggleButton = new CircularHudProgressButton(scene, addOwned, worldInputGate, {
      depth: DEPTH,
      diameter: TOGGLE_SIZE,
      hitDiameter: TOGGLE_HIT_SIZE,
      icon: '⭐',
      iconSize: 39,
      progressColor: 0xb56cff,
      accentColor: 0xb39cff,
    });
    this.toggleButton.setOnClick(() => {
      this.setCollapsed(!this.collapsed);
      this.onToggle?.(this.collapsed);
    });

    this.panelBackground = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, PANEL_WIDTH, 100, 0xb56cff, 0.88))
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

    this.titleText = this.createMaskedText('Civics', 24, '#f2f7fb', 'bold');
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

  setState(state: HudCultureState): void {
    this.state = state;
    this.currentText.setText(`Current: ${state.currentName}`);
    this.progressText.setText(
      state.cost > 0
        ? `Progress: ${state.progress} / ${state.cost}`
        : `Stored Progress: ${state.progress}`,
    );
    this.cultureText.setText(`Culture: +${state.culturePerTurn}/turn`);
    this.toggleButton.setProgress(state.cost > 0 ? state.progress / state.cost : 0);
    this.toggleButton.setTooltip(state.tooltip);
    this.rebuildCultureButtons();
    this.layout(this.scene.scale.width, this.scene.scale.height);
  }

  setOnSelectCultureNode(handler: (nodeId: string) => boolean): void {
    this.onSelectCultureNode = handler;
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
    this.toggleButton.layout(toggleX, toggleY);

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

    let eraIndex = 0;
    let buttonIndex = 0;
    for (const era of this.state.eras) {
      const eraTitle = this.eraTitleTexts[eraIndex];

      eraTitle.setVisible(panelVisible).setPosition(Math.round(innerX), Math.round(baseY + contentCursor));
      contentCursor += LINE_HEIGHT - 2;

      for (const _node of era.nodes) {
        const button = this.cultureButtons[buttonIndex];
        const buttonY = baseY + contentCursor;
        const iconX = innerX + CULTURE_ICON_PADDING;
        const iconY = buttonY + Math.round((BUTTON_HEIGHT - CULTURE_ICON_SIZE) / 2);
        const textX = iconX + CULTURE_ICON_SIZE + CULTURE_TEXT_GAP;
        button.background.setVisible(panelVisible)
          .setPosition(Math.round(innerX), Math.round(buttonY))
          .setDisplaySize(PANEL_CONTENT_WIDTH, BUTTON_HEIGHT);
        button.iconFrame.setVisible(panelVisible)
          .setPosition(Math.round(iconX), Math.round(iconY))
          .setDisplaySize(CULTURE_ICON_SIZE, CULTURE_ICON_SIZE);
        button.iconImage.setVisible(panelVisible && this.scene.textures.exists(button.imageKey))
          .setPosition(Math.round(iconX + (CULTURE_ICON_SIZE / 2)), Math.round(iconY + (CULTURE_ICON_SIZE / 2)));
        button.fallbackIcon.setVisible(panelVisible && !this.scene.textures.exists(button.imageKey))
          .setPosition(Math.round(iconX + (CULTURE_ICON_SIZE / 2)), Math.round(iconY + (CULTURE_ICON_SIZE / 2)));
        button.nameText.setVisible(panelVisible).setPosition(Math.round(textX), Math.round(buttonY + 10));
        button.metaText.setVisible(panelVisible).setPosition(Math.round(textX), Math.round(buttonY + 34));
        button.descriptionText.setVisible(panelVisible).setPosition(Math.round(textX), Math.round(buttonY + 55));
        button.prerequisite.setVisible(panelVisible).setPosition(Math.round(textX), Math.round(buttonY + 90));
        contentCursor += BUTTON_HEIGHT + BUTTON_GAP;
        buttonIndex += 1;
      }

      contentCursor += SECTION_GAP - BUTTON_GAP;
      eraIndex += 1;
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
    this.toggleButton.destroy();
    this.panelBackground.destroy();
    this.scrollbarTrack.destroy();
    this.scrollbarThumb.destroy();
    this.contentMaskGraphics.destroy();
    this.titleText.destroy();
    this.currentText.destroy();
    this.progressText.destroy();
    this.cultureText.destroy();
    this.destroyCultureButtons();
    for (const text of this.eraTitleTexts) text.destroy();
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

  private rebuildCultureButtons(): void {
    this.destroyCultureButtons();
    for (const text of this.eraTitleTexts) {
      const index = this.contentObjects.indexOf(text);
      if (index >= 0) this.contentObjects.splice(index, 1);
      text.destroy();
    }
    this.eraTitleTexts.length = 0;

    for (const era of this.state.eras) {
      const title = this.createMaskedText(era.name, 16, '#88a6bd', 'bold');
      this.eraTitleTexts.push(title);

      for (const entry of era.nodes) {
        this.cultureButtons.push(this.createCultureButton(entry));
      }
    }
  }

  private createCultureButton(entry: HudCultureEntry): CultureButtonView {
    const style = getCultureNodeVisualState(entry);
    const background = this.addOwned(
      new Phaser.GameObjects.Rectangle(this.scene, 0, 0, PANEL_CONTENT_WIDTH, BUTTON_HEIGHT, style.fillColor, style.fillAlpha),
    )
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setStrokeStyle(1, style.strokeColor, 0.58)
      .setInteractive({ useHandCursor: style.isSelectable })
      .setMask(this.contentMask);
    const iconFrame = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, CULTURE_ICON_SIZE, CULTURE_ICON_SIZE, 0x0b1821, 0.95))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0xd7c7ff, 0.34)
      .setMask(this.contentMask);
    const iconImage = this.addOwned(new Phaser.GameObjects.Image(this.scene, 0, 0, entry.imageKey))
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH + 3)
      .setScrollFactor(0)
      .setDisplaySize(CULTURE_ICON_SIZE - 10, CULTURE_ICON_SIZE - 10)
      .setMask(this.contentMask);
    const fallbackIcon = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, getInitials(entry.name), {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#eadfff',
      fontStyle: 'bold',
    }))
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH + 3)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setMask(this.contentMask);
    const nameText = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, entry.name, {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: style.labelColor,
      fontStyle: 'bold',
      wordWrap: { width: getCultureTextWidth(), useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setMask(this.contentMask);
    const metaText = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, `${formatEraName(entry.era)} - ${entry.effectiveCost} culture - ${getStatusText(entry)}`, {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: style.detailColor,
      wordWrap: { width: getCultureTextWidth(), useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setMask(this.contentMask);
    const descriptionText = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, entry.description, {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: style.detailColor,
      wordWrap: { width: getCultureTextWidth(), useAdvancedWrap: true },
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
      wordWrap: { width: getCultureTextWidth(), useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setMask(this.contentMask);

    this.contentObjects.push(background, iconFrame, iconImage, fallbackIcon, nameText, metaText, descriptionText, prerequisite);
    const button: CultureButtonView = {
      id: entry.id,
      imageKey: entry.imageKey,
      background,
      iconFrame,
      iconImage,
      fallbackIcon,
      nameText,
      metaText,
      descriptionText,
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
      refreshCultureButtonVisual(button);
    });
    background.on(Phaser.Input.Events.POINTER_OUT, (
      _pointer: Phaser.Input.Pointer,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      button.hovered = false;
      button.pressed = false;
      refreshCultureButtonVisual(button);
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
      refreshCultureButtonVisual(button);
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
        if (this.onSelectCultureNode?.(button.id)) {
          this.setCollapsed(true);
        }
      }
      refreshCultureButtonVisual(button);
    });

    refreshCultureButtonVisual(button);
    return button;
  }

  private destroyCultureButtons(): void {
    for (const button of this.cultureButtons) {
      for (const object of [
        button.background,
        button.iconFrame,
        button.iconImage,
        button.fallbackIcon,
        button.nameText,
        button.metaText,
        button.descriptionText,
        button.prerequisite,
      ]) {
        const index = this.contentObjects.indexOf(object);
        if (index >= 0) this.contentObjects.splice(index, 1);
        object.destroy();
      }
    }
    this.cultureButtons.length = 0;
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
    for (const button of this.cultureButtons) {
      const hasIcon = this.scene.textures.exists(button.imageKey);
      if (hasIcon) {
        button.iconImage.setTexture(button.imageKey).setDisplaySize(CULTURE_ICON_SIZE - 10, CULTURE_ICON_SIZE - 10);
      }
      button.iconImage.setVisible(panelVisible && hasIcon);
      button.fallbackIcon.setVisible(panelVisible && !hasIcon);
    }
  }

  private refreshToggleState(): void {
    this.toggleButton.setActive(!this.collapsed);
  }
}

function getCultureNodeVisualState(entry: HudCultureEntry): {
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

function getStatusText(entry: HudCultureEntry): string {
  if (entry.isUnlocked) return 'Unlocked';
  if (entry.isActive) return 'Active';
  if (entry.isAvailable) return 'Available';
  return 'Locked';
}

function getPrerequisiteText(entry: HudCultureEntry): string {
  if (entry.prerequisiteNames.length === 0) {
    return 'Prerequisites: none';
  }
  if (entry.missingPrerequisiteNames.length === 0) {
    return `Prerequisites: ${entry.prerequisiteNames.join(', ')}`;
  }
  return `Missing: ${entry.missingPrerequisiteNames.join(', ')}`;
}

function formatEraName(era: string): string {
  return era.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getCultureTextWidth(): number {
  return PANEL_CONTENT_WIDTH - CULTURE_ICON_PADDING - CULTURE_ICON_SIZE - CULTURE_TEXT_GAP - 14;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function refreshCultureButtonVisual(button: CultureButtonView): void {
  const scale = button.pressed ? 0.985 : button.hovered && button.isSelectable ? 1.01 : 1;
  button.background.setScale(scale);

  if (!button.isSelectable) {
    button.background.setFillStyle(button.baseFillColor, button.baseFillAlpha);
    button.iconFrame.setFillStyle(0x0b1821, 0.95);
    return;
  }

  if (button.pressed) {
    button.background.setFillStyle(0x1f4b62, 0.98);
    button.iconFrame.setFillStyle(0x102c3a, 0.98);
  } else if (button.hovered) {
    button.background.setFillStyle(0x1d495e, 1);
    button.iconFrame.setFillStyle(0x123343, 1);
  } else {
    button.background.setFillStyle(0x153343, 0.96);
    button.iconFrame.setFillStyle(0x0b1821, 0.95);
  }
}

function getHudTextResolution(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}
