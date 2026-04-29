import Phaser from 'phaser';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

export interface DiscoveryPopupRow {
  label: string;
  imageKey?: string;
  imagePath?: string;
  fallbackLabel?: string;
}

export interface DiscoveryPopupData {
  title: string;
  imageKey: string;
  imagePath?: string;
  description: string;
  unlockRows: DiscoveryPopupRow[];
  leadsToRows: DiscoveryPopupRow[];
}

type DiscoveryPopupCloseListener = () => void;

const DEPTH = 230;
const PANEL_WIDTH = 512;
const PANEL_HEIGHT = 1024;
const PANEL_PADDING = 24;
const PANEL_GAP = 14;
const HERO_SIZE = 256;
const ROW_HEIGHT = 38;
const ROW_GAP = 6;
const ROW_ICON_SIZE = 28;
const BUTTON_HEIGHT = 38;
const HUD_TEXT_RESOLUTION = getHudTextResolution();

interface PopupButton {
  background: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  hitArea: Phaser.GameObjects.Zone;
  hovered: boolean;
  pressed: boolean;
}

interface PopupRowView {
  background: Phaser.GameObjects.Rectangle;
  iconFrame: Phaser.GameObjects.Rectangle;
  image: Phaser.GameObjects.Image;
  fallbackText: Phaser.GameObjects.Text;
  labelText: Phaser.GameObjects.Text;
  imageKey?: string;
  imagePath?: string;
}

export class DiscoveryPopup {
  private readonly wheelBlockerId = `discovery-popup-wheel-${Math.random().toString(36).slice(2)}`;
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly heroFrame: Phaser.GameObjects.Rectangle;
  private readonly heroImage: Phaser.GameObjects.Image;
  private readonly heroFallbackText: Phaser.GameObjects.Text;
  private readonly descriptionText: Phaser.GameObjects.Text;
  private readonly unlocksHeading: Phaser.GameObjects.Text;
  private readonly unlocksEmptyText: Phaser.GameObjects.Text;
  private readonly leadsToHeading: Phaser.GameObjects.Text;
  private readonly leadsToEmptyText: Phaser.GameObjects.Text;
  private readonly closeButton: PopupButton;
  private readonly contentMaskGraphics: Phaser.GameObjects.Graphics;
  private readonly contentMask: Phaser.Display.Masks.GeometryMask;
  private readonly contentObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly unlockRows: PopupRowView[] = [];
  private readonly leadsToRows: PopupRowView[] = [];
  private readonly loadingTextures = new Set<string>();
  private readonly missingTextures = new Set<string>();
  private current: DiscoveryPopupData | null = null;
  private closeListener: DiscoveryPopupCloseListener | null = null;
  private scrollOffset = 0;
  private maxScroll = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly addOwned: AddOwned,
    private readonly worldInputGate: WorldInputGate,
  ) {
    this.worldInputGate.registerWheelBlocker(
      this.wheelBlockerId,
      () => this.current !== null,
    );

    this.overlay = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x000000, 0.62))
      .setOrigin(0, 0)
      .setDepth(DEPTH)
      .setScrollFactor(0)
      .setVisible(false)
      .setInteractive();
    this.overlay.on(Phaser.Input.Events.POINTER_DOWN, this.consumeBlockingPointer);
    this.overlay.on(Phaser.Input.Events.POINTER_UP, this.releaseBlockingPointer);
    this.overlay.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.releaseBlockingPointer);

    this.panel = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, PANEL_WIDTH, PANEL_HEIGHT, 0x0e1722, 0.98))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x68a9d5, 0.85)
      .setVisible(false);

    this.contentMaskGraphics = new Phaser.GameObjects.Graphics(scene);
    this.contentMask = this.contentMaskGraphics.createGeometryMask();

    this.titleText = this.createContentText('', 30, '#f2f7fb', 'normal', PANEL_WIDTH - PANEL_PADDING * 2)
      .setAlign('center');
    this.heroFrame = this.addContentObject(new Phaser.GameObjects.Rectangle(scene, 0, 0, HERO_SIZE, HERO_SIZE, 0x0a111a, 0.96))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0x86c9e8, 0.35);
    this.heroImage = this.addContentObject(new Phaser.GameObjects.Image(scene, 0, 0, '__DEFAULT'))
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH + 3)
      .setScrollFactor(0)
      .setDisplaySize(HERO_SIZE, HERO_SIZE);
    this.heroFallbackText = this.createContentText('', 42, '#bfe9ff', 'bold')
      .setOrigin(0.5, 0.5);
    this.descriptionText = this.createContentText('', 17, '#d8e5ef', 'normal', PANEL_WIDTH - PANEL_PADDING * 2);
    this.unlocksHeading = this.createContentText('Unlocks', 20, '#f2f7fb', 'bold');
    this.unlocksEmptyText = this.createContentText('No direct unlocks.', 15, '#9fb1bf');
    this.leadsToHeading = this.createContentText('Leads To', 20, '#f2f7fb', 'bold');
    this.leadsToEmptyText = this.createContentText('No further technologies.', 15, '#9fb1bf');
    this.closeButton = this.createButton('Continue');

    this.scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
  }

  setOnClose(listener: DiscoveryPopupCloseListener): void {
    this.closeListener = listener;
  }

  isShowing(): boolean {
    return this.current !== null;
  }

  show(data: DiscoveryPopupData): void {
    this.current = data;
    this.scrollOffset = 0;
    this.destroyRows();
    this.titleText.setText(data.title);
    this.descriptionText.setText(data.description);
    this.heroFallbackText.setText(getInitials(data.title));

    this.createRows(data.unlockRows, this.unlockRows);
    this.createRows(data.leadsToRows, this.leadsToRows);

    this.ensureTexture(data.imageKey, data.imagePath);
    for (const row of [...this.unlockRows, ...this.leadsToRows]) {
      if (row.imageKey) this.ensureTexture(row.imageKey, row.imagePath);
    }

    this.overlay.setVisible(true);
    this.panel.setVisible(true);
    this.setContentVisible(true);
    this.setButtonVisible(true);
    this.layout();
  }

  hide(): void {
    if (!this.current) return;
    this.current = null;
    this.scrollOffset = 0;
    this.maxScroll = 0;
    this.overlay.setVisible(false);
    this.panel.setVisible(false);
    this.setContentVisible(false);
    this.setButtonVisible(false);
    this.destroyRows();
    this.contentMaskGraphics.clear();
    this.closeListener?.();
  }

  layout(): void {
    if (!this.current) return;

    const { width, height } = this.scene.scale;
    this.overlay.setPosition(0, 0).setDisplaySize(width, height);

    const contentWidth = PANEL_WIDTH - PANEL_PADDING * 2;
    this.titleText.setWordWrapWidth(contentWidth, true);
    this.descriptionText.setWordWrapWidth(contentWidth, true);

    const fullContentHeight = this.getFullContentHeight();
    const panelHeight = Math.min(PANEL_HEIGHT, Math.max(360, height - 24));
    const panelX = Math.round((width - PANEL_WIDTH) / 2);
    const panelY = Math.round((height - panelHeight) / 2);
    const contentViewportHeight = panelHeight - PANEL_PADDING * 3 - BUTTON_HEIGHT;

    this.maxScroll = Math.max(0, fullContentHeight - contentViewportHeight);
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset, 0, this.maxScroll);

    this.panel.setPosition(panelX, panelY).setDisplaySize(PANEL_WIDTH, panelHeight);
    this.updateMask(panelX, panelY, contentViewportHeight);

    const contentX = panelX + PANEL_PADDING;
    let cursorY = panelY + PANEL_PADDING - this.scrollOffset;

    this.titleText.setPosition(contentX, Math.round(cursorY));
    cursorY += this.titleText.height + PANEL_GAP;

    const heroX = panelX + Math.round((PANEL_WIDTH - HERO_SIZE) / 2);
    this.heroFrame.setPosition(heroX, Math.round(cursorY)).setDisplaySize(HERO_SIZE, HERO_SIZE);
    this.refreshHeroImage();
    this.heroImage.setPosition(heroX + HERO_SIZE / 2, Math.round(cursorY + HERO_SIZE / 2));
    this.heroFallbackText.setPosition(heroX + HERO_SIZE / 2, Math.round(cursorY + HERO_SIZE / 2));
    cursorY += HERO_SIZE + PANEL_GAP;

    this.descriptionText.setPosition(contentX, Math.round(cursorY));
    cursorY += this.descriptionText.height + PANEL_GAP + 2;

    cursorY = this.layoutSection(
      this.unlocksHeading,
      this.unlocksEmptyText,
      this.unlockRows,
      contentX,
      cursorY,
      contentWidth,
    );
    cursorY += PANEL_GAP;
    this.layoutSection(
      this.leadsToHeading,
      this.leadsToEmptyText,
      this.leadsToRows,
      contentX,
      cursorY,
      contentWidth,
    );

    const buttonWidth = 180;
    const buttonX = panelX + Math.round((PANEL_WIDTH - buttonWidth) / 2);
    const buttonY = panelY + panelHeight - PANEL_PADDING - BUTTON_HEIGHT;
    this.placeButton(buttonX, buttonY, buttonWidth, BUTTON_HEIGHT);
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
    this.worldInputGate.unregisterWheelBlocker(this.wheelBlockerId);
    this.overlay.destroy();
    this.panel.destroy();
    this.contentMaskGraphics.destroy();
    for (const object of this.contentObjects) object.destroy();
    this.destroyRows();
    this.closeButton.background.destroy();
    this.closeButton.text.destroy();
    this.closeButton.hitArea.destroy();
  }

  private readonly consumeBlockingPointer = (
    pointer: Phaser.Input.Pointer,
    _localX: number,
    _localY: number,
    event: Phaser.Types.Input.EventData,
  ): void => {
    event.stopPropagation();
    this.worldInputGate.claimPointer(pointer.id);
    consumePointerEvent(pointer);
  };

  private readonly releaseBlockingPointer = (
    pointer: Phaser.Input.Pointer,
    _localX: number,
    _localY: number,
    event: Phaser.Types.Input.EventData,
  ): void => {
    event.stopPropagation();
    consumePointerEvent(pointer);
    this.worldInputGate.releasePointer(pointer.id);
  };

  private readonly handleWheel = (
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
    _deltaZ: number,
    event: WheelEvent,
  ): void => {
    if (!this.current || this.maxScroll <= 0) return;
    consumePointerEvent(pointer);
    event.preventDefault?.();
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset + Math.sign(deltaY) * 52, 0, this.maxScroll);
    this.layout();
  };

  private createContentText(
    text: string,
    size: number,
    color: string,
    fontStyle = 'normal',
    wrapWidth?: number,
  ): Phaser.GameObjects.Text {
    return this.addContentObject(new Phaser.GameObjects.Text(this.scene, 0, 0, text, {
      fontFamily: 'sans-serif',
      fontSize: `${size}px`,
      color,
      fontStyle,
      ...(wrapWidth ? { wordWrap: { width: wrapWidth, useAdvancedWrap: true } } : {}),
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION);
  }

  private addContentObject<T extends Phaser.GameObjects.GameObject>(object: T): T {
    const owned = this.addOwned(object);
    const maskable = owned as T & Phaser.GameObjects.Components.Mask & Phaser.GameObjects.Components.Visible;
    maskable.setMask(this.contentMask);
    maskable.setVisible(false);
    this.contentObjects.push(owned);
    return owned;
  }

  private createRows(rows: DiscoveryPopupRow[], target: PopupRowView[]): void {
    for (const row of rows) {
      const background = this.addContentObject(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, 10, ROW_HEIGHT, 0x152636, 0.96))
        .setOrigin(0, 0)
        .setDepth(DEPTH + 2)
        .setScrollFactor(0)
        .setStrokeStyle(1, 0x6fb2d4, 0.38);
      const iconFrame = this.addContentObject(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, ROW_ICON_SIZE, ROW_ICON_SIZE, 0x0b1821, 0.95))
        .setOrigin(0, 0)
        .setDepth(DEPTH + 3)
        .setScrollFactor(0)
        .setStrokeStyle(1, 0x86c9e8, 0.28);
      const image = this.addContentObject(new Phaser.GameObjects.Image(this.scene, 0, 0, '__DEFAULT'))
        .setOrigin(0.5, 0.5)
        .setDepth(DEPTH + 4)
        .setScrollFactor(0)
        .setDisplaySize(ROW_ICON_SIZE - 6, ROW_ICON_SIZE - 6);
      const fallbackText = this.createContentText(row.fallbackLabel ?? getInitials(row.label), 13, '#bfe9ff', 'bold')
        .setOrigin(0.5, 0.5)
        .setDepth(DEPTH + 4);
      const labelText = this.createContentText(row.label, 15, '#ddf2ff', 'bold');

      target.push({
        background,
        iconFrame,
        image,
        fallbackText,
        labelText,
        imageKey: row.imageKey,
        imagePath: row.imagePath,
      });
    }
  }

  private destroyRows(): void {
    for (const row of [...this.unlockRows, ...this.leadsToRows]) {
      const rowObjects = [row.background, row.iconFrame, row.image, row.fallbackText, row.labelText];
      for (const object of rowObjects) {
        const index = this.contentObjects.indexOf(object);
        if (index >= 0) this.contentObjects.splice(index, 1);
        object.destroy();
      }
    }
    this.unlockRows.length = 0;
    this.leadsToRows.length = 0;
  }

  private getFullContentHeight(): number {
    let height = this.titleText.height + PANEL_GAP + HERO_SIZE + PANEL_GAP + this.descriptionText.height + PANEL_GAP + 2;
    height += this.getSectionHeight(this.unlockRows);
    height += PANEL_GAP;
    height += this.getSectionHeight(this.leadsToRows);
    return height;
  }

  private getSectionHeight(rows: PopupRowView[]): number {
    if (rows.length === 0) return this.unlocksHeading.height + 6 + this.unlocksEmptyText.height;
    return this.unlocksHeading.height + 8 + rows.length * ROW_HEIGHT + Math.max(0, rows.length - 1) * ROW_GAP;
  }

  private layoutSection(
    heading: Phaser.GameObjects.Text,
    emptyText: Phaser.GameObjects.Text,
    rows: PopupRowView[],
    x: number,
    y: number,
    width: number,
  ): number {
    heading.setPosition(x, Math.round(y));
    y += heading.height + 8;

    if (rows.length === 0) {
      emptyText.setPosition(x, Math.round(y));
      return y + emptyText.height;
    }

    emptyText.setVisible(false);
    for (const row of rows) {
      row.background.setPosition(x, Math.round(y)).setDisplaySize(width, ROW_HEIGHT);
      row.iconFrame.setPosition(x + 8, Math.round(y + 6)).setDisplaySize(ROW_ICON_SIZE, ROW_ICON_SIZE);
      row.image.setPosition(x + 8 + ROW_ICON_SIZE / 2, Math.round(y + ROW_HEIGHT / 2));
      row.fallbackText.setPosition(x + 8 + ROW_ICON_SIZE / 2, Math.round(y + ROW_HEIGHT / 2));
      row.labelText.setPosition(x + 48, Math.round(y + 9));
      this.refreshRowImage(row);
      y += ROW_HEIGHT + ROW_GAP;
    }
    return y - ROW_GAP;
  }

  private updateMask(panelX: number, panelY: number, contentViewportHeight: number): void {
    this.contentMaskGraphics.clear();
    this.contentMaskGraphics.fillStyle(0xffffff, 1);
    this.contentMaskGraphics.fillRect(
      panelX + PANEL_PADDING,
      panelY + PANEL_PADDING,
      PANEL_WIDTH - PANEL_PADDING * 2,
      contentViewportHeight,
    );
  }

  private ensureTexture(imageKey: string | undefined, imagePath: string | undefined): void {
    if (!imageKey || !imagePath) return;
    if (this.scene.textures.exists(imageKey)) return;
    if (this.loadingTextures.has(imageKey) || this.missingTextures.has(imageKey)) return;

    const onLoadError = (file: Phaser.Loader.File): void => {
      if (file.key !== imageKey) return;
      this.loadingTextures.delete(imageKey);
      this.missingTextures.add(imageKey);
      this.scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
      this.layout();
    };

    this.loadingTextures.add(imageKey);
    this.scene.load.once(`filecomplete-image-${imageKey}`, () => {
      this.loadingTextures.delete(imageKey);
      this.scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
      this.layout();
    });
    this.scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
    this.scene.load.image(imageKey, imagePath);
    if (!this.scene.load.isLoading()) {
      this.scene.load.start();
    }
  }

  private refreshHeroImage(): void {
    if (!this.current) return;
    const hasImage = this.scene.textures.exists(this.current.imageKey);
    if (hasImage) {
      this.heroImage.setTexture(this.current.imageKey).setDisplaySize(HERO_SIZE, HERO_SIZE).setVisible(true);
      this.heroFallbackText.setVisible(false);
      return;
    }
    this.heroImage.setVisible(false);
    this.heroFallbackText.setVisible(true);
  }

  private refreshRowImage(row: PopupRowView): void {
    const hasImage = row.imageKey !== undefined && this.scene.textures.exists(row.imageKey);
    if (hasImage && row.imageKey) {
      row.image.setTexture(row.imageKey).setDisplaySize(ROW_ICON_SIZE - 6, ROW_ICON_SIZE - 6).setVisible(true);
      row.fallbackText.setVisible(false);
      return;
    }
    row.image.setVisible(false);
    row.fallbackText.setVisible(true);
  }

  private createButton(label: string): PopupButton {
    const background = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, 10, BUTTON_HEIGHT, 0x2f6f8f, 1))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0x9ed8f0, 0.42)
      .setVisible(false);
    const text = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, label, {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
    }))
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH + 3)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);
    const hitArea = this.addOwned(new Phaser.GameObjects.Zone(this.scene, 0, 0, 10, BUTTON_HEIGHT))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 4)
      .setScrollFactor(0);

    const button: PopupButton = { background, text, hitArea, hovered: false, pressed: false };
    hitArea.on(Phaser.Input.Events.POINTER_OVER, (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      button.hovered = true;
      this.refreshButtonVisual();
    });
    hitArea.on(Phaser.Input.Events.POINTER_OUT, (
      _pointer: Phaser.Input.Pointer,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      button.hovered = false;
      button.pressed = false;
      this.refreshButtonVisual();
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
      consumePointerEvent(pointer);
      button.pressed = true;
      this.refreshButtonVisual();
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
      const shouldClose = button.pressed;
      button.pressed = false;
      this.worldInputGate.releasePointer(pointer.id);
      this.refreshButtonVisual();
      if (shouldClose) this.hide();
    });

    return button;
  }

  private placeButton(x: number, y: number, width: number, height: number): void {
    this.closeButton.background.setPosition(x, y).setDisplaySize(width, height);
    this.closeButton.text.setPosition(Math.round(x + width / 2), Math.round(y + height / 2));
    this.closeButton.hitArea.setPosition(x, y).setSize(width, height);
    if (!this.closeButton.hitArea.input?.enabled) {
      this.closeButton.hitArea.setInteractive({ useHandCursor: true });
    }
    this.refreshButtonVisual();
  }

  private setButtonVisible(visible: boolean): void {
    this.closeButton.background.setVisible(visible);
    this.closeButton.text.setVisible(visible);
    if (visible) {
      if (!this.closeButton.hitArea.input?.enabled) {
        this.closeButton.hitArea.setInteractive({ useHandCursor: true });
      }
    } else {
      this.closeButton.hovered = false;
      this.closeButton.pressed = false;
      this.closeButton.hitArea.disableInteractive();
    }
  }

  private refreshButtonVisual(): void {
    const fillColor = this.closeButton.pressed
      ? 0x24546d
      : this.closeButton.hovered
        ? 0x3a85aa
        : 0x2f6f8f;
    this.closeButton.background.setFillStyle(fillColor, 1);
  }

  private setContentVisible(visible: boolean): void {
    for (const object of this.contentObjects) {
      (object as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible).setVisible(visible);
    }
    this.refreshHeroImage();
    for (const row of [...this.unlockRows, ...this.leadsToRows]) {
      this.refreshRowImage(row);
    }
    if (!visible) return;
    this.unlocksEmptyText.setVisible(this.unlockRows.length === 0);
    this.leadsToEmptyText.setVisible(this.leadsToRows.length === 0);
  }
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getHudTextResolution(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}
