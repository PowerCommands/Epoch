import Phaser from 'phaser';
import { getLeaderById } from '../../data/leaders';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { getLeaderRoomKey } from '../../utils/assetPaths';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';
import type { RightSidebarRow } from '../phaser/RightSidebarPanelTypes';
import { AudienceActionList } from './AudienceActionList';

/**
 * Read-only context the audience chamber needs from the surrounding game.
 * Keeps the dialog free of gameplay logic: it only formats and presents the
 * values the GameScene wires in. The row-returning methods delegate to the
 * existing diplomacy/trade data provider, so all negotiation logic, validation,
 * and AI acceptance behaviour is reused rather than duplicated.
 */
export interface LeaderAudienceContext {
  getNationName(nationId: string): string;
  getNationColor(nationId: string): number;
  getNationSecondaryColor(nationId: string): number;
  /** Short relationship label, e.g. "Friendly", "Neutral", "At War". */
  getRelationshipSummary(nationId: string): string;
  /** Compact active-agreement lines for the leader information panel. */
  getStatusRows(nationId: string): RightSidebarRow[];
  /** Interactive diplomacy controls (Embassy, Open Borders, War/Peace, …). */
  getDiplomacyActionRows(nationId: string): RightSidebarRow[];
  /** Interactive trade controls. */
  getTradeRows(nationId: string): RightSidebarRow[];
  /** Subscribe to data changes so the open chamber can refresh in place. */
  onChanged(listener: () => void): void;
}

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

const DEPTH = 3000;
const BACKDROP_ALPHA = 0.6;
const DIALOG_WIDTH_RATIO = 0.9;
const DIALOG_HEIGHT_RATIO = 0.9;
const READABILITY_ALPHA = 0.28;
const PANEL_PADDING = 48;
const LEFT_PANEL_WIDTH_RATIO = 0.4;
const CLOSE_BUTTON_WIDTH = 132;
const CLOSE_BUTTON_HEIGHT = 44;
const LIST_DEPTH = DEPTH + 6;
const TEXT_RESOLUTION = getHudTextResolution();

/**
 * Large, immersive "audience chamber" modal shown when the player arranges an
 * audience with a leader. It is the primary place diplomacy happens: the left
 * panel hosts the relocated diplomacy and trade controls over the throne-room
 * background (which already depicts the leader).
 *
 * The dialog is self-contained and renders through its own screen-space UI
 * camera so it sits above the HUD and right sidebar. It contains no gameplay
 * logic — all data and actions arrive through {@link LeaderAudienceContext},
 * which delegates to the existing diplomacy/trade data provider.
 *
 * The left panel is intentionally organised into three sections so future
 * additions (leader greetings, AI dialogue, agendas, alliances, gifts, …) can
 * be slotted in without restructuring:
 *   1. Leader information + relationship + active agreements
 *   2. Diplomatic actions
 *   3. Trade
 */
export class LeaderAudienceDialog {
  private readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
  private readonly owned = new Set<Phaser.GameObjects.GameObject>();
  private readonly onAddedToScene: (object: Phaser.GameObjects.GameObject) => void;
  private readonly onResize: () => void;

  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly backdropHitArea: Phaser.GameObjects.Zone;
  private readonly dialogBackground: Phaser.GameObjects.Rectangle;
  private readonly roomImage: Phaser.GameObjects.Image;
  private readonly readabilityOverlay: Phaser.GameObjects.Rectangle;
  private readonly leftPanelBackground: Phaser.GameObjects.Rectangle;
  private readonly leaderNameText: Phaser.GameObjects.Text;
  private readonly nationNameText: Phaser.GameObjects.Text;
  private readonly leaderTitleText: Phaser.GameObjects.Text;
  private readonly relationLabelText: Phaser.GameObjects.Text;
  private readonly relationValueText: Phaser.GameObjects.Text;
  private readonly actionList: AudienceActionList;
  private readonly closeButton: DialogButton;

  private currentLeaderId: string | null = null;
  private roomVisible = false;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldInputGate: WorldInputGate,
    private readonly context: LeaderAudienceContext,
  ) {
    this.backdrop = this.addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x000000, BACKDROP_ALPHA))
      .setOrigin(0, 0).setDepth(DEPTH).setScrollFactor(0);
    this.backdropHitArea = this.addOwned(new Phaser.GameObjects.Zone(scene, 0, 0, 10, 10))
      .setOrigin(0, 0).setDepth(DEPTH).setScrollFactor(0);

    this.dialogBackground = this.addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x05080d, 1))
      .setOrigin(0, 0).setDepth(DEPTH + 1).setScrollFactor(0)
      .setStrokeStyle(2, 0x9a7b3a, 0.85);

    this.roomImage = this.addOwned(new Phaser.GameObjects.Image(scene, 0, 0, '__MISSING'))
      .setOrigin(0.5, 0.5).setDepth(DEPTH + 2).setScrollFactor(0);

    this.readabilityOverlay = this.addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x000000, READABILITY_ALPHA))
      .setOrigin(0, 0).setDepth(DEPTH + 3).setScrollFactor(0);

    this.leftPanelBackground = this.addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x0a1018, 0.55))
      .setOrigin(0, 0).setDepth(DEPTH + 5).setScrollFactor(0)
      .setStrokeStyle(1, 0x9a7b3a, 0.35);

    this.leaderNameText = this.addText('', 40, '#f4f1e7', 'bold');
    this.nationNameText = this.addText('', 22, '#cdd7e6', 'bold');
    this.leaderTitleText = this.addText('', 18, '#9fb0c4', 'normal');
    this.relationLabelText = this.addText('RELATIONSHIP', 14, '#8aa0b8', 'bold');
    this.relationValueText = this.addText('', 26, '#f4d06f', 'bold');

    this.actionList = new AudienceActionList(
      scene,
      worldInputGate,
      (object) => this.addOwned(object),
      (object) => this.removeOwned(object),
      LIST_DEPTH,
    );

    this.closeButton = this.createButton('Close', 0x7a3030, 0x9c4242, 0x5e2424, () => this.close());

    this.installBackdropInput();

    this.uiCamera = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height);
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.setZoom(1);
    this.uiCamera.roundPixels = true;
    this.uiCamera.ignore(scene.children.list.filter((object) => !this.owned.has(object)));
    scene.cameras.main.ignore([...this.owned]);

    this.onAddedToScene = (object) => {
      if (this.owned.has(object)) {
        scene.cameras.main.ignore(object);
      } else {
        this.uiCamera.ignore(object);
      }
    };
    scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAddedToScene);

    this.onResize = () => {
      this.uiCamera.setSize(scene.scale.width, scene.scale.height);
      if (this.currentLeaderId) this.layout();
    };
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);

    // Re-render the open chamber whenever diplomacy/trade state changes (e.g.
    // after the player performs an action through one of the controls).
    this.context.onChanged(() => this.refresh());

    this.setVisible(false);
  }

  isOpen(): boolean {
    return this.currentLeaderId !== null;
  }

  getCurrentLeaderId(): string | null {
    return this.currentLeaderId;
  }

  /** Open the audience chamber for the given leader. */
  open(leaderId: string): void {
    const leader = getLeaderById(leaderId);
    if (!leader) return;

    this.currentLeaderId = leaderId;
    this.setVisible(true);

    const nationName = this.context.getNationName(leader.nationId);
    const nationColor = this.context.getNationColor(leader.nationId);
    const secondaryColor = this.context.getNationSecondaryColor(leader.nationId);
    const colorHex = toColorString(nationColor);

    this.leaderNameText.setText(leader.name).setColor(colorHex);
    this.nationNameText.setText(nationName).setColor(colorHex);
    this.leaderTitleText.setText(leader.title ?? '');
    this.leaderTitleText.setVisible(Boolean(leader.title));
    this.relationValueText.setText(this.context.getRelationshipSummary(leader.nationId));

    // Tint the chamber framing with the leader's heraldic colours: the outer
    // frame uses the primary colour, the information panel the secondary.
    this.dialogBackground.setStrokeStyle(3, nationColor, 0.9);
    this.leftPanelBackground.setStrokeStyle(2, secondaryColor, 0.55);

    const roomKey = getLeaderRoomKey(leaderId);
    this.roomVisible = this.scene.textures.exists(roomKey);
    if (this.roomVisible) this.roomImage.setTexture(roomKey);

    this.actionList.setRows(this.buildRows(leader.nationId));
    this.layout();
  }

  close(): void {
    this.currentLeaderId = null;
    this.setVisible(false);
  }

  destroy(): void {
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAddedToScene);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    this.actionList.destroy();
    for (const object of this.owned) object.destroy();
    this.owned.clear();
    this.scene.cameras.remove(this.uiCamera);
  }

  /**
   * Combine the three context row groups into one scrollable list, with section
   * headers. Section 1 (leader name/nation/relationship) is rendered as fixed
   * header text above the list; the status agreements lead the list.
   */
  private buildRows(nationId: string): RightSidebarRow[] {
    const rows: RightSidebarRow[] = [];
    const status = this.context.getStatusRows(nationId);
    if (status.length > 0) {
      rows.push({ kind: 'text', text: 'Status', large: true });
      rows.push(...status);
      rows.push({ kind: 'separator' });
    }
    rows.push({ kind: 'text', text: 'Diplomatic Actions', large: true });
    rows.push(...this.context.getDiplomacyActionRows(nationId));
    rows.push({ kind: 'separator' });
    rows.push({ kind: 'text', text: 'Trade', large: true });
    rows.push(...this.context.getTradeRows(nationId));
    return rows;
  }

  private refresh(): void {
    if (this.destroyed || this.currentLeaderId === null) return;
    const leader = getLeaderById(this.currentLeaderId);
    if (!leader) return;
    this.relationValueText.setText(this.context.getRelationshipSummary(leader.nationId));
    this.actionList.setRows(this.buildRows(leader.nationId));
    this.layout();
  }

  private layout(): void {
    const { width, height } = this.scene.scale;
    this.backdrop.setPosition(0, 0).setDisplaySize(width, height);
    this.backdropHitArea.setPosition(0, 0).setSize(width, height);

    const dialogW = Math.round(width * DIALOG_WIDTH_RATIO);
    const dialogH = Math.round(height * DIALOG_HEIGHT_RATIO);
    const dialogX = Math.round((width - dialogW) / 2);
    const dialogY = Math.round((height - dialogH) / 2);

    this.dialogBackground.setPosition(dialogX, dialogY).setDisplaySize(dialogW, dialogH);
    this.readabilityOverlay.setPosition(dialogX, dialogY).setDisplaySize(dialogW, dialogH);

    this.layoutRoomImage(dialogX, dialogY, dialogW, dialogH);
    this.layoutLeftPanel(dialogX, dialogY, dialogW, dialogH);
    this.layoutCloseButton(dialogX, dialogY, dialogW);
  }

  private layoutRoomImage(dialogX: number, dialogY: number, dialogW: number, dialogH: number): void {
    this.roomImage.setVisible(this.roomVisible);
    if (!this.roomVisible) return;
    const scale = containScale(this.roomImage, dialogW, dialogH);
    this.roomImage.setScale(scale);
    this.roomImage.setPosition(dialogX + dialogW / 2, dialogY + dialogH / 2);
  }

  private layoutLeftPanel(dialogX: number, dialogY: number, dialogW: number, dialogH: number): void {
    const panelX = dialogX + PANEL_PADDING;
    const panelW = Math.round(dialogW * LEFT_PANEL_WIDTH_RATIO);
    const panelTop = dialogY + PANEL_PADDING;
    const panelBottom = dialogY + dialogH - PANEL_PADDING;

    this.leftPanelBackground
      .setPosition(panelX - 20, panelTop - 20)
      .setDisplaySize(panelW + 40, panelBottom - panelTop + 40);

    const wrapWidth = panelW;
    this.leaderNameText.setWordWrapWidth(wrapWidth);
    this.nationNameText.setWordWrapWidth(wrapWidth);
    this.leaderTitleText.setWordWrapWidth(wrapWidth);

    let y = panelTop;
    this.leaderNameText.setPosition(panelX, y);
    y += this.leaderNameText.height + 6;
    this.nationNameText.setPosition(panelX, y);
    y += this.nationNameText.height + 4;
    if (this.leaderTitleText.visible) {
      this.leaderTitleText.setPosition(panelX, y);
      y += this.leaderTitleText.height + 4;
    }

    y += 22;
    this.relationLabelText.setPosition(panelX, y);
    y += this.relationLabelText.height + 4;
    this.relationValueText.setPosition(panelX, y);
    y += this.relationValueText.height + 22;

    // Remaining vertical space hosts the scrollable diplomacy/trade controls.
    const listHeight = Math.max(0, panelBottom - y);
    this.actionList.layout(panelX, y, panelW, listHeight);
  }

  private layoutCloseButton(dialogX: number, dialogY: number, dialogW: number): void {
    const x = dialogX + dialogW - PANEL_PADDING - CLOSE_BUTTON_WIDTH;
    const y = dialogY + PANEL_PADDING - 8;
    this.placeButton(this.closeButton, x, y, CLOSE_BUTTON_WIDTH, CLOSE_BUTTON_HEIGHT);
  }

  private setVisible(visible: boolean): void {
    for (const object of this.owned) {
      if (object instanceof Phaser.GameObjects.Zone) continue;
      (object as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible).setVisible(visible);
    }
    if (!visible) {
      this.roomImage.setVisible(false);
      this.leaderTitleText.setVisible(false);
    }
    this.setZoneInteractive(this.backdropHitArea, visible);
    this.setButtonVisible(this.closeButton, visible);
    this.actionList.setVisible(visible);
  }

  private removeOwned(object: Phaser.GameObjects.GameObject): void {
    this.owned.delete(object);
    object.destroy();
  }

  private installBackdropInput(): void {
    const zone = this.backdropHitArea;
    zone.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
    });
    zone.on(Phaser.Input.Events.POINTER_UP, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      this.worldInputGate.releasePointer(pointer.id);
      consumePointerEvent(pointer);
      // Clicking outside the chamber must NOT close it — intentionally no-op.
    });
  }

  private createButton(
    label: string,
    baseColor: number,
    hoverColor: number,
    pressColor: number,
    onClick: () => void,
  ): DialogButton {
    const background = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, 10, CLOSE_BUTTON_HEIGHT, baseColor, 1))
      .setOrigin(0, 0).setDepth(DEPTH + 7).setScrollFactor(0)
      .setStrokeStyle(1, 0x000000, 0.5);
    const text = this.addText(label, 17, '#ffffff', 'bold').setOrigin(0.5, 0.5).setDepth(DEPTH + 8);
    const hitArea = this.addOwned(new Phaser.GameObjects.Zone(this.scene, 0, 0, 10, CLOSE_BUTTON_HEIGHT))
      .setOrigin(0, 0).setDepth(DEPTH + 9).setScrollFactor(0);

    const button: DialogButton = {
      background, text, hitArea, baseColor, hoverColor, pressColor, hovered: false, pressed: false, onClick,
    };

    hitArea.on(Phaser.Input.Events.POINTER_OVER, (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      button.hovered = true;
      this.refreshButtonVisual(button);
    });
    hitArea.on(Phaser.Input.Events.POINTER_OUT, (_p: Phaser.Input.Pointer, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
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
      const shouldClick = button.pressed;
      button.pressed = false;
      this.worldInputGate.releasePointer(pointer.id);
      this.refreshButtonVisual(button);
      if (shouldClick) button.onClick();
    });

    return button;
  }

  private placeButton(button: DialogButton, x: number, y: number, width: number, height: number): void {
    button.background.setPosition(x, y).setDisplaySize(width, height);
    button.text.setPosition(Math.round(x + width / 2), Math.round(y + height / 2));
    button.hitArea.setPosition(x, y).setSize(width, height);
    if (!button.hitArea.input?.enabled) button.hitArea.setInteractive({ useHandCursor: true });
    this.refreshButtonVisual(button);
  }

  private setButtonVisible(button: DialogButton, visible: boolean): void {
    button.background.setVisible(visible);
    button.text.setVisible(visible);
    this.setZoneInteractive(button.hitArea, visible);
    if (!visible) {
      button.hovered = false;
      button.pressed = false;
    }
  }

  private setZoneInteractive(zone: Phaser.GameObjects.Zone, interactive: boolean): void {
    if (interactive) {
      if (!zone.input?.enabled) zone.setInteractive({ useHandCursor: zone !== this.backdropHitArea });
    } else {
      zone.disableInteractive();
    }
  }

  private refreshButtonVisual(button: DialogButton): void {
    const fillColor = button.pressed ? button.pressColor : button.hovered ? button.hoverColor : button.baseColor;
    button.background.setFillStyle(fillColor, 1);
  }

  private addText(text: string, size: number, color: string, style: 'normal' | 'bold'): Phaser.GameObjects.Text {
    return this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, text, {
      fontFamily: 'sans-serif',
      fontSize: `${size}px`,
      color,
      fontStyle: style,
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 6)
      .setScrollFactor(0)
      .setResolution(TEXT_RESOLUTION);
  }

  private addOwned<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.owned.add(object);
    this.scene.add.existing(object);
    return object;
  }
}

function containScale(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): number {
  const source = image.texture.getSourceImage();
  const iw = source.width;
  const ih = source.height;
  if (iw <= 0 || ih <= 0) return 1;
  return Math.min(maxWidth / iw, maxHeight / ih);
}

function toColorString(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
}

function getHudTextResolution(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}
