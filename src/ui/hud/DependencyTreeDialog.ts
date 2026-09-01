import Phaser from 'phaser';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';
import type { HudDependencyTreeNode, HudDependencyTreeState, HudTreeNodeStatus } from './NationHudDataProvider';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

const DEPTH = 230;
const OVERLAY_DEPTH = DEPTH;
const PANEL_DEPTH = DEPTH + 1;
const HEADER_DEPTH = DEPTH + 2;
const CONTENT_DEPTH = DEPTH + 3;
const CARD_DEPTH = DEPTH + 5;
const TEXT_RESOLUTION = getHudTextResolution();

const PANEL_WIDTH_RATIO = 0.9;
const PANEL_HEIGHT_RATIO = 0.9;
const HEADER_HEIGHT = 58;
const PADDING = 18;
const SCROLLBAR_SIZE = 10;
const SCROLLBAR_GAP = 10;
const SCROLL_STEP = 72;

const CARD_WIDTH = 220;
const CARD_HEIGHT = 148;
const CARD_GAP_X = 92;
const CARD_GAP_Y = 18;
const ICON_SIZE = 58;
const CONTENT_MARGIN = 24;

interface TreeNodeLayout {
  node: HudDependencyTreeNode;
  x: number;
  y: number;
}

interface TreeCardView {
  id: string;
  background: Phaser.GameObjects.Rectangle;
  imageFrame: Phaser.GameObjects.Rectangle;
  image: Phaser.GameObjects.Image;
  fallback: Phaser.GameObjects.Text;
  title: Phaser.GameObjects.Text;
  description: Phaser.GameObjects.Text;
  policyUnlocks: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
}

interface TreeConnectionLayout {
  from: TreeNodeLayout;
  to: TreeNodeLayout;
  laneIndex: number;
  laneCount: number;
}

export class DependencyTreeDialog {
  private readonly wheelBlockerId = `dependency-tree-dialog-wheel-${Math.random().toString(36).slice(2)}`;
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly header: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly closeButton: Phaser.GameObjects.Rectangle;
  private readonly closeText: Phaser.GameObjects.Text;
  private readonly lineGraphics: Phaser.GameObjects.Graphics;
  private readonly maskGraphics: Phaser.GameObjects.Graphics;
  private readonly contentMask: Phaser.Display.Masks.GeometryMask;
  private readonly hTrack: Phaser.GameObjects.Rectangle;
  private readonly hThumb: Phaser.GameObjects.Rectangle;
  private readonly vTrack: Phaser.GameObjects.Rectangle;
  private readonly vThumb: Phaser.GameObjects.Rectangle;

  private readonly cards: TreeCardView[] = [];
  private readonly handleWheel: (
    pointer: Phaser.Input.Pointer,
    gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
    deltaZ: number,
    event: WheelEvent,
  ) => void;
  private readonly handlePointerMove: (pointer: Phaser.Input.Pointer) => void;
  private readonly handlePointerUp: (pointer: Phaser.Input.Pointer) => void;
  private readonly handleResize: () => void;
  private readonly handleEscape: () => void;

  private isOpen = false;
  private state: HudDependencyTreeState = { title: 'Tree', accentColor: 0x68a9d5, nodes: [] };
  private panelBounds = new Phaser.Geom.Rectangle();
  private contentBounds = new Phaser.Geom.Rectangle();
  private contentWidth = 1;
  private contentHeight = 1;
  private scrollX = 0;
  private scrollY = 0;
  private maxScrollX = 0;
  private maxScrollY = 0;
  private dragState: { pointerId: number; startX: number; startY: number; scrollX: number; scrollY: number } | null = null;
  private scrollbarDrag: {
    pointerId: number;
    axis: 'x' | 'y';
    startPointer: number;
    startScroll: number;
  } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly addOwned: AddOwned,
    private readonly worldInputGate: WorldInputGate,
  ) {
    this.overlay = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x000000, 0.62))
      .setOrigin(0, 0)
      .setDepth(OVERLAY_DEPTH)
      .setScrollFactor(0)
      .setInteractive()
      .setVisible(false);
    this.panel = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x0b141d, 0.98))
      .setOrigin(0, 0)
      .setDepth(PANEL_DEPTH)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0x67849c, 0.7)
      .setInteractive()
      .setVisible(false);
    this.header = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, HEADER_HEIGHT, 0x162435, 1))
      .setOrigin(0, 0)
      .setDepth(HEADER_DEPTH)
      .setScrollFactor(0)
      .setVisible(false);
    this.title = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#f4f8fb',
      fontStyle: 'bold',
    }))
      .setOrigin(0, 0.5)
      .setDepth(HEADER_DEPTH + 1)
      .setScrollFactor(0)
      .setResolution(TEXT_RESOLUTION)
      .setVisible(false);
    this.closeButton = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 34, 34, 0x331e1e, 1))
      .setOrigin(0, 0)
      .setDepth(HEADER_DEPTH + 1)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0x9c4242, 0.9)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.closeText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, 'X', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#f4f1e7',
      fontStyle: 'bold',
    }))
      .setOrigin(0.5, 0.5)
      .setDepth(HEADER_DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(TEXT_RESOLUTION)
      .setVisible(false);

    this.maskGraphics = new Phaser.GameObjects.Graphics(scene);
    this.contentMask = this.maskGraphics.createGeometryMask();
    this.lineGraphics = addOwned(new Phaser.GameObjects.Graphics(scene))
      .setDepth(CONTENT_DEPTH)
      .setScrollFactor(0)
      .setVisible(false);
    this.lineGraphics.setMask(this.contentMask);

    this.hTrack = this.createScrollbarPart();
    this.hThumb = this.createScrollbarPart(true);
    this.vTrack = this.createScrollbarPart();
    this.vThumb = this.createScrollbarPart(true);

    this.overlay.on(Phaser.Input.Events.POINTER_DOWN, this.consumePointer);
    this.overlay.on(Phaser.Input.Events.POINTER_UP, this.releasePointer);
    this.panel.on(Phaser.Input.Events.POINTER_DOWN, this.startPan);
    this.panel.on(Phaser.Input.Events.POINTER_UP, this.releasePointer);
    this.closeButton.on(Phaser.Input.Events.POINTER_OVER, () => this.closeButton.setFillStyle(0x4d2828, 1));
    this.closeButton.on(Phaser.Input.Events.POINTER_OUT, () => this.closeButton.setFillStyle(0x331e1e, 1));
    this.closeButton.on(Phaser.Input.Events.POINTER_DOWN, this.consumePointer);
    this.closeButton.on(Phaser.Input.Events.POINTER_UP, (
      pointer: Phaser.Input.Pointer,
      _x: number,
      _y: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      consumePointerEvent(pointer);
      this.worldInputGate.releasePointer(pointer.id);
      this.close();
    });

    this.hTrack.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => this.pageScrollbar(pointer, event, localX, 'x'));
    this.vTrack.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _x: number,
      localY: number,
      event: Phaser.Types.Input.EventData,
    ) => this.pageScrollbar(pointer, event, localY, 'y'));
    this.hThumb.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => this.startScrollbarDrag(pointer, event, 'x'));
    this.vThumb.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => this.startScrollbarDrag(pointer, event, 'y'));

    this.handleWheel = (pointer, _gameObjects, deltaX, deltaY, _deltaZ, event) => {
      if (!this.isOpen || !this.panelBounds.contains(pointer.x, pointer.y)) return;
      consumePointerEvent(pointer);
      event.preventDefault?.();
      const horizontalIntent = Math.abs(deltaX) > Math.abs(deltaY);
      this.setScroll(
        this.scrollX + (horizontalIntent ? deltaX : 0),
        this.scrollY + (horizontalIntent ? 0 : deltaY),
      );
    };
    this.handlePointerMove = (pointer) => this.onPointerMove(pointer);
    this.handlePointerUp = (pointer) => this.onPointerUp(pointer);
    this.handleResize = () => {
      if (this.isOpen) this.layout();
    };
    this.handleEscape = () => {
      if (this.isOpen) this.close();
    };

    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp);
    scene.input.keyboard?.on('keydown-ESC', this.handleEscape);
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.worldInputGate.registerWheelBlocker(
      this.wheelBlockerId,
      (screenX, screenY) => this.isOpen && this.panelBounds.contains(screenX, screenY),
    );
  }

  open(state: HudDependencyTreeState): void {
    this.state = state;
    this.isOpen = true;
    this.scrollX = 0;
    this.scrollY = 0;
    this.rebuildCards();
    this.setVisible(true);
    this.layout();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.dragState = null;
    this.scrollbarDrag = null;
    this.setVisible(false);
    this.destroyCards();
  }

  isShowing(): boolean {
    return this.isOpen;
  }

  destroy(): void {
    this.close();
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp);
    this.scene.input.keyboard?.off('keydown-ESC', this.handleEscape);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.worldInputGate.unregisterWheelBlocker(this.wheelBlockerId);
    this.overlay.destroy();
    this.panel.destroy();
    this.header.destroy();
    this.title.destroy();
    this.closeButton.destroy();
    this.closeText.destroy();
    this.lineGraphics.destroy();
    this.maskGraphics.destroy();
    this.hTrack.destroy();
    this.hThumb.destroy();
    this.vTrack.destroy();
    this.vThumb.destroy();
  }

  private rebuildCards(): void {
    this.destroyCards();
    for (const node of this.state.nodes) {
      this.cards.push(this.createCard(node));
    }
  }

  private createCard(node: HudDependencyTreeNode): TreeCardView {
    const colors = getStatusColors(node.status, this.state.accentColor);
    const background = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, CARD_WIDTH, CARD_HEIGHT, colors.fill, colors.alpha))
      .setOrigin(0, 0)
      .setDepth(CARD_DEPTH)
      .setScrollFactor(0)
      .setStrokeStyle(2, colors.stroke, colors.strokeAlpha)
      .setMask(this.contentMask);
    const imageFrame = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, ICON_SIZE, ICON_SIZE, 0x071017, 0.95))
      .setOrigin(0, 0)
      .setDepth(CARD_DEPTH + 1)
      .setScrollFactor(0)
      .setStrokeStyle(1, colors.stroke, 0.36)
      .setMask(this.contentMask);
    const image = this.addOwned(new Phaser.GameObjects.Image(this.scene, 0, 0, node.imageKey))
      .setOrigin(0.5, 0.5)
      .setDepth(CARD_DEPTH + 2)
      .setScrollFactor(0)
      .setDisplaySize(ICON_SIZE - 8, ICON_SIZE - 8)
      .setMask(this.contentMask);
    const fallback = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, getInitials(node.name), {
      fontFamily: 'sans-serif',
      fontSize: '17px',
      color: colors.text,
      fontStyle: 'bold',
    }))
      .setOrigin(0.5, 0.5)
      .setDepth(CARD_DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(TEXT_RESOLUTION)
      .setMask(this.contentMask);
    const title = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, node.name, {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: colors.text,
      fontStyle: 'bold',
      wordWrap: { width: CARD_WIDTH - ICON_SIZE - 34, useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(CARD_DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(TEXT_RESOLUTION)
      .setMask(this.contentMask);
    const description = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, node.description, {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: colors.detail,
      wordWrap: { width: CARD_WIDTH - 22, useAdvancedWrap: true },
      maxLines: 2,
    }))
      .setOrigin(0, 0)
      .setDepth(CARD_DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(TEXT_RESOLUTION)
      .setMask(this.contentMask);
    const policyUnlocks = this.addOwned(new Phaser.GameObjects.Text(
      this.scene,
      0,
      0,
      formatPolicyUnlocks(node.policyUnlockNames ?? []),
      {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        color: '#d7b7ff',
        fontStyle: 'bold',
        wordWrap: { width: CARD_WIDTH - 22, useAdvancedWrap: true },
        maxLines: 2,
      },
    ))
      .setOrigin(0, 0)
      .setDepth(CARD_DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(TEXT_RESOLUTION)
      .setMask(this.contentMask);
    const status = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, formatStatus(node.status), {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: colors.status,
      fontStyle: 'bold',
    }))
      .setOrigin(0, 0)
      .setDepth(CARD_DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(TEXT_RESOLUTION)
      .setMask(this.contentMask);
    return { id: node.id, background, imageFrame, image, fallback, title, description, policyUnlocks, status };
  }

  private destroyCards(): void {
    for (const card of this.cards) {
      card.background.destroy();
      card.imageFrame.destroy();
      card.image.destroy();
      card.fallback.destroy();
      card.title.destroy();
      card.description.destroy();
      card.policyUnlocks.destroy();
      card.status.destroy();
    }
    this.cards.length = 0;
  }

  private layout(): void {
    const viewportWidth = this.scene.scale.width;
    const viewportHeight = this.scene.scale.height;
    const panelWidth = Math.round(viewportWidth * PANEL_WIDTH_RATIO);
    const panelHeight = Math.round(viewportHeight * PANEL_HEIGHT_RATIO);
    const panelX = Math.round((viewportWidth - panelWidth) / 2);
    const panelY = Math.round((viewportHeight - panelHeight) / 2);
    this.panelBounds.setTo(panelX, panelY, panelWidth, panelHeight);
    this.contentBounds.setTo(
      panelX + PADDING,
      panelY + HEADER_HEIGHT + PADDING,
      panelWidth - (PADDING * 2) - SCROLLBAR_SIZE - SCROLLBAR_GAP,
      panelHeight - HEADER_HEIGHT - (PADDING * 2) - SCROLLBAR_SIZE - SCROLLBAR_GAP,
    );

    this.overlay.setPosition(0, 0).setDisplaySize(viewportWidth, viewportHeight);
    this.panel.setPosition(panelX, panelY).setDisplaySize(panelWidth, panelHeight);
    this.header.setPosition(panelX, panelY).setDisplaySize(panelWidth, HEADER_HEIGHT);
    this.closeButton.setPosition(panelX + PADDING, panelY + 12).setDisplaySize(34, 34);
    this.closeText.setPosition(panelX + PADDING + 17, panelY + 29);
    this.title.setText(this.state.title).setPosition(panelX + PADDING + 48, panelY + HEADER_HEIGHT / 2);

    this.maskGraphics.clear();
    this.maskGraphics.fillStyle(0xffffff, 1);
    this.maskGraphics.fillRect(this.contentBounds.x, this.contentBounds.y, this.contentBounds.width, this.contentBounds.height);

    const layouts = layoutTree(this.state.nodes);
    this.contentWidth = Math.max(this.contentBounds.width, layouts.width);
    this.contentHeight = Math.max(this.contentBounds.height, layouts.height);
    this.maxScrollX = Math.max(0, this.contentWidth - this.contentBounds.width);
    this.maxScrollY = Math.max(0, this.contentHeight - this.contentBounds.height);
    this.setScroll(this.scrollX, this.scrollY, false);

    const byId = new Map(layouts.nodes.map((entry) => [entry.node.id, entry]));
    this.lineGraphics.clear();
    const connections = buildConnectionLayouts(layouts.nodes);
    for (const entry of layouts.nodes) {
      for (const prerequisiteId of entry.node.prerequisites) {
        const prerequisite = byId.get(prerequisiteId);
        if (!prerequisite) continue;
        const connection = connections.find((candidate) =>
          candidate.from.node.id === prerequisite.node.id && candidate.to.node.id === entry.node.id
        );
        if (!connection) continue;
        this.drawConnection(connection);
      }
    }

    const cardsById = new Map(this.cards.map((card) => [card.id, card]));
    for (const entry of layouts.nodes) {
      const card = cardsById.get(entry.node.id);
      if (!card) continue;
      const x = this.contentBounds.x + entry.x - this.scrollX;
      const y = this.contentBounds.y + entry.y - this.scrollY;
      const hasImage = this.scene.textures.exists(entry.node.imageKey);
      card.background.setPosition(Math.round(x), Math.round(y));
      card.imageFrame.setPosition(Math.round(x + 10), Math.round(y + 12));
      card.image.setPosition(Math.round(x + 10 + ICON_SIZE / 2), Math.round(y + 12 + ICON_SIZE / 2)).setVisible(this.isOpen && hasImage);
      card.fallback.setPosition(Math.round(x + 10 + ICON_SIZE / 2), Math.round(y + 12 + ICON_SIZE / 2)).setVisible(this.isOpen && !hasImage);
      card.title.setPosition(Math.round(x + 80), Math.round(y + 12));
      card.description.setPosition(Math.round(x + 10), Math.round(y + 78));
      card.policyUnlocks.setPosition(Math.round(x + 10), Math.round(y + 116));
      card.status.setPosition(Math.round(x + 80), Math.round(y + 54));
    }

    this.layoutScrollbars();
  }

  private drawConnection(connection: TreeConnectionLayout): void {
    const { from, to, laneIndex, laneCount } = connection;
    const startX = this.contentBounds.x + from.x + CARD_WIDTH - this.scrollX;
    const startY = this.contentBounds.y + from.y + CARD_HEIGHT / 2 - this.scrollY;
    const endX = this.contentBounds.x + to.x - this.scrollX;
    const endY = this.contentBounds.y + to.y + CARD_HEIGHT / 2 - this.scrollY;
    const laneX = getConnectionLaneX(startX, endX, laneIndex, laneCount);
    const entryX = Math.max(laneX + 10, endX - 22);
    const color = shiftColor(getConnectionColor(to.node.status, this.state.accentColor), getLaneColorShift(laneIndex));
    const alpha = getConnectionAlpha(to.node.status);
    const width = getConnectionWidth(to.node.status);

    this.lineGraphics.lineStyle(width, color, alpha);
    this.lineGraphics.beginPath();
    this.lineGraphics.moveTo(startX, startY);
    this.lineGraphics.lineTo(laneX, startY);
    this.lineGraphics.lineTo(laneX, endY);
    this.lineGraphics.lineTo(entryX, endY);
    this.lineGraphics.lineTo(endX, endY);
    this.lineGraphics.strokePath();
    this.lineGraphics.fillStyle(color, Math.min(1, alpha + 0.12));
    this.lineGraphics.fillCircle(startX + 2, startY, Math.max(3, width));
    this.lineGraphics.fillTriangle(endX, endY, endX - 10, endY - 6, endX - 10, endY + 6);
  }

  private layoutScrollbars(): void {
    const showH = this.isOpen && this.maxScrollX > 0;
    const showV = this.isOpen && this.maxScrollY > 0;
    this.hTrack.setVisible(showH);
    this.hThumb.setVisible(showH);
    this.vTrack.setVisible(showV);
    this.vThumb.setVisible(showV);
    this.hThumb.setFillStyle(this.state.accentColor, 0.95);
    this.vThumb.setFillStyle(this.state.accentColor, 0.95);
    if (showH) {
      const x = this.contentBounds.x;
      const y = this.contentBounds.y + this.contentBounds.height + SCROLLBAR_GAP;
      const width = this.contentBounds.width;
      const thumbWidth = Math.max(42, width * (this.contentBounds.width / this.contentWidth));
      const thumbTravel = width - thumbWidth;
      this.hTrack.setPosition(x, y).setDisplaySize(width, SCROLLBAR_SIZE);
      this.hThumb.setPosition(x + (this.scrollX / this.maxScrollX) * thumbTravel, y).setDisplaySize(thumbWidth, SCROLLBAR_SIZE);
    }
    if (showV) {
      const x = this.contentBounds.x + this.contentBounds.width + SCROLLBAR_GAP;
      const y = this.contentBounds.y;
      const height = this.contentBounds.height;
      const thumbHeight = Math.max(42, height * (this.contentBounds.height / this.contentHeight));
      const thumbTravel = height - thumbHeight;
      this.vTrack.setPosition(x, y).setDisplaySize(SCROLLBAR_SIZE, height);
      this.vThumb.setPosition(x, y + (this.scrollY / this.maxScrollY) * thumbTravel).setDisplaySize(SCROLLBAR_SIZE, thumbHeight);
    }
  }

  private setScroll(x: number, y: number, doLayout = true): void {
    this.scrollX = Phaser.Math.Clamp(x, 0, this.maxScrollX);
    this.scrollY = Phaser.Math.Clamp(y, 0, this.maxScrollY);
    if (doLayout) this.layout();
  }

  private createScrollbarPart(isThumb = false): Phaser.GameObjects.Rectangle {
    return this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, 10, 10, isThumb ? this.state.accentColor : 0x172536, isThumb ? 0.95 : 0.9))
      .setOrigin(0, 0)
      .setDepth(isThumb ? HEADER_DEPTH + 2 : HEADER_DEPTH + 1)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
  }

  private readonly consumePointer = (
    pointer: Phaser.Input.Pointer,
    _x: number,
    _y: number,
    event: Phaser.Types.Input.EventData,
  ): void => {
    event.stopPropagation();
    if (!this.isOpen || pointer.button !== 0) return;
    this.worldInputGate.claimPointer(pointer.id);
    consumePointerEvent(pointer);
  };

  private readonly startPan = (
    pointer: Phaser.Input.Pointer,
    _x: number,
    _y: number,
    event: Phaser.Types.Input.EventData,
  ): void => {
    this.consumePointer(pointer, _x, _y, event);
    if (!this.contentBounds.contains(pointer.x, pointer.y)) return;
    this.dragState = { pointerId: pointer.id, startX: pointer.x, startY: pointer.y, scrollX: this.scrollX, scrollY: this.scrollY };
  };

  private readonly releasePointer = (
    pointer: Phaser.Input.Pointer,
    _x: number,
    _y: number,
    event: Phaser.Types.Input.EventData,
  ): void => {
    event.stopPropagation();
    if (!this.isOpen || pointer.button !== 0) return;
    consumePointerEvent(pointer);
    this.dragState = null;
    this.worldInputGate.releasePointer(pointer.id);
  };

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.scrollbarDrag?.pointerId === pointer.id) {
      this.updateScrollbarDrag(pointer);
      return;
    }
    if (!this.dragState || this.dragState.pointerId !== pointer.id) return;
    this.setScroll(
      this.dragState.scrollX - (pointer.x - this.dragState.startX),
      this.dragState.scrollY - (pointer.y - this.dragState.startY),
    );
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.scrollbarDrag?.pointerId === pointer.id) {
      this.scrollbarDrag = null;
      this.worldInputGate.releasePointer(pointer.id);
      return;
    }
    if (this.dragState?.pointerId === pointer.id) {
      this.dragState = null;
      this.worldInputGate.releasePointer(pointer.id);
    }
  }

  private startScrollbarDrag(
    pointer: Phaser.Input.Pointer,
    event: Phaser.Types.Input.EventData,
    axis: 'x' | 'y',
  ): void {
    event.stopPropagation();
    if (!this.isOpen || pointer.button !== 0) return;
    consumePointerEvent(pointer);
    this.worldInputGate.claimPointer(pointer.id);
    this.scrollbarDrag = {
      pointerId: pointer.id,
      axis,
      startPointer: axis === 'x' ? pointer.x : pointer.y,
      startScroll: axis === 'x' ? this.scrollX : this.scrollY,
    };
  }

  private updateScrollbarDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.scrollbarDrag) return;
    if (this.scrollbarDrag.axis === 'x') {
      const travel = this.hTrack.displayWidth - this.hThumb.displayWidth;
      if (travel <= 0) return;
      const delta = pointer.x - this.scrollbarDrag.startPointer;
      this.setScroll(this.scrollbarDrag.startScroll + (delta / travel) * this.maxScrollX, this.scrollY);
      return;
    }
    const travel = this.vTrack.displayHeight - this.vThumb.displayHeight;
    if (travel <= 0) return;
    const delta = pointer.y - this.scrollbarDrag.startPointer;
    this.setScroll(this.scrollX, this.scrollbarDrag.startScroll + (delta / travel) * this.maxScrollY);
  }

  private pageScrollbar(
    pointer: Phaser.Input.Pointer,
    event: Phaser.Types.Input.EventData,
    localPosition: number,
    axis: 'x' | 'y',
  ): void {
    event.stopPropagation();
    if (!this.isOpen || pointer.button !== 0) return;
    consumePointerEvent(pointer);
    this.worldInputGate.claimPointer(pointer.id);
    if (axis === 'x') {
      this.setScroll(this.scrollX + (localPosition < this.hThumb.x - this.hTrack.x ? -1 : 1) * this.contentBounds.width * 0.8, this.scrollY);
    } else {
      this.setScroll(this.scrollX, this.scrollY + (localPosition < this.vThumb.y - this.vTrack.y ? -1 : 1) * this.contentBounds.height * 0.8);
    }
    this.worldInputGate.releasePointer(pointer.id);
  }

  private setVisible(visible: boolean): void {
    this.overlay.setVisible(visible);
    this.panel.setVisible(visible);
    this.header.setVisible(visible);
    this.title.setVisible(visible);
    this.closeButton.setVisible(visible);
    this.closeText.setVisible(visible);
    this.lineGraphics.setVisible(visible);
    for (const card of this.cards) {
      card.background.setVisible(visible);
      card.imageFrame.setVisible(visible);
      card.image.setVisible(visible);
      card.fallback.setVisible(visible);
      card.title.setVisible(visible);
      card.description.setVisible(visible);
      card.status.setVisible(visible);
    }
  }
}

function layoutTree(nodes: HudDependencyTreeNode[]): { nodes: TreeNodeLayout[]; width: number; height: number } {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const levelCache = new Map<string, number>();
  const getLevel = (node: HudDependencyTreeNode): number => {
    const cached = levelCache.get(node.id);
    if (cached !== undefined) return cached;
    const prerequisites = node.prerequisites
      .map((id) => byId.get(id))
      .filter((prerequisite): prerequisite is HudDependencyTreeNode => prerequisite !== undefined);
    const level = prerequisites.length === 0 ? 0 : Math.max(...prerequisites.map(getLevel)) + 1;
    levelCache.set(node.id, level);
    return level;
  };

  const columns = new Map<number, HudDependencyTreeNode[]>();
  for (const node of nodes) {
    const level = getLevel(node);
    const column = columns.get(level) ?? [];
    column.push(node);
    columns.set(level, column);
  }

  const layouts: TreeNodeLayout[] = [];
  let maxRows = 1;
  for (const [level, columnNodes] of columns) {
    maxRows = Math.max(maxRows, columnNodes.length);
    columnNodes.forEach((node, row) => {
      layouts.push({
        node,
        x: CONTENT_MARGIN + level * (CARD_WIDTH + CARD_GAP_X),
        y: CONTENT_MARGIN + row * (CARD_HEIGHT + CARD_GAP_Y),
      });
    });
  }

  const maxLevel = Math.max(0, ...Array.from(columns.keys()));
  return {
    nodes: layouts,
    width: (CONTENT_MARGIN * 2) + ((maxLevel + 1) * CARD_WIDTH) + (maxLevel * CARD_GAP_X),
    height: (CONTENT_MARGIN * 2) + (maxRows * CARD_HEIGHT) + ((maxRows - 1) * CARD_GAP_Y),
  };
}

function buildConnectionLayouts(nodes: TreeNodeLayout[]): TreeConnectionLayout[] {
  const byId = new Map(nodes.map((entry) => [entry.node.id, entry]));
  const connections: Array<Omit<TreeConnectionLayout, 'laneIndex' | 'laneCount'>> = [];

  for (const entry of nodes) {
    for (const prerequisiteId of entry.node.prerequisites) {
      const prerequisite = byId.get(prerequisiteId);
      if (!prerequisite) continue;
      connections.push({ from: prerequisite, to: entry });
    }
  }

  const grouped = new Map<string, Array<Omit<TreeConnectionLayout, 'laneIndex' | 'laneCount'>>>();
  for (const connection of connections) {
    const key = `${connection.from.x}:${connection.to.x}`;
    const group = grouped.get(key) ?? [];
    group.push(connection);
    grouped.set(key, group);
  }

  const layouts: TreeConnectionLayout[] = [];
  for (const group of grouped.values()) {
    group.sort((a, b) => {
      const aCenter = a.from.y + a.to.y;
      const bCenter = b.from.y + b.to.y;
      if (aCenter !== bCenter) return aCenter - bCenter;
      return a.to.node.name.localeCompare(b.to.node.name);
    });
    group.forEach((connection, laneIndex) => {
      layouts.push({
        ...connection,
        laneIndex,
        laneCount: group.length,
      });
    });
  }

  return layouts;
}

function getConnectionLaneX(startX: number, endX: number, laneIndex: number, laneCount: number): number {
  const gap = Math.max(1, endX - startX);
  if (gap < 56) return startX + gap / 2;
  const lanePadding = Math.min(34, Math.max(18, gap * 0.2));
  const usableWidth = Math.max(1, gap - (lanePadding * 2));
  return startX + lanePadding + ((laneIndex + 0.5) / laneCount) * usableWidth;
}

function getConnectionWidth(status: HudTreeNodeStatus): number {
  if (status === 'completed') return 4;
  if (status === 'available' || status === 'active') return 3;
  return 2;
}

function getConnectionAlpha(status: HudTreeNodeStatus): number {
  if (status === 'completed') return 0.92;
  if (status === 'available' || status === 'active') return 0.82;
  return 0.48;
}

function getLaneColorShift(laneIndex: number): number {
  return ((laneIndex % 5) - 2) * 10;
}

function getStatusColors(status: HudTreeNodeStatus, accentColor: number): {
  fill: number;
  alpha: number;
  stroke: number;
  strokeAlpha: number;
  text: string;
  detail: string;
  status: string;
} {
  if (status === 'completed') {
    return { fill: 0x173124, alpha: 0.96, stroke: 0x75c58f, strokeAlpha: 0.9, text: '#e7f8ed', detail: '#bed9c5', status: '#93e3aa' };
  }
  if (status === 'active') {
    return { fill: 0x2b2444, alpha: 0.97, stroke: accentColor, strokeAlpha: 0.95, text: '#f2edff', detail: '#d4cfff', status: '#ded3ff' };
  }
  if (status === 'available') {
    return { fill: 0x143244, alpha: 0.98, stroke: 0x72c8ef, strokeAlpha: 0.95, text: '#e1f5ff', detail: '#bdd9e8', status: '#8fdcff' };
  }
  return { fill: 0x171c22, alpha: 0.9, stroke: 0x5a6470, strokeAlpha: 0.62, text: '#cdd3db', detail: '#aeb6c0', status: '#c5cad1' };
}

function getConnectionColor(status: HudTreeNodeStatus, accentColor: number): number {
  if (status === 'completed') return 0x75c58f;
  if (status === 'active') return accentColor;
  if (status === 'available') return 0x72c8ef;
  return 0x727b86;
}

function shiftColor(color: number, amount: number): number {
  const r = Phaser.Math.Clamp(((color >> 16) & 0xff) + amount, 0, 255);
  const g = Phaser.Math.Clamp(((color >> 8) & 0xff) + amount, 0, 255);
  const b = Phaser.Math.Clamp((color & 0xff) + amount, 0, 255);
  return (r << 16) + (g << 8) + b;
}

function formatStatus(status: HudTreeNodeStatus): string {
  if (status === 'completed') return 'Completed';
  if (status === 'active') return 'In progress';
  if (status === 'available') return 'Available';
  return 'Locked';
}

function formatPolicyUnlocks(policyNames: readonly string[]): string {
  if (policyNames.length === 0) return '';
  const label = policyNames.length === 1 ? 'Unlocks Policy' : 'Unlocks Policies';
  return `${label}: ${policyNames.join(', ')}`;
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
