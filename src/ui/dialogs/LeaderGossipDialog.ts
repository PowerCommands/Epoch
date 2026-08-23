import Phaser from 'phaser';
import { getLeaderById } from '../../data/leaders';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import type { GossipCategory, GossipExecutionResult, GossipFailureReason } from '../../types/gossip';
import { getLeaderRoomImagePath, getLeaderRoomKey } from '../../utils/assetPaths';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';
import type { RightSidebarRow } from '../phaser/RightSidebarPanelTypes';
import { AudienceActionList } from './AudienceActionList';
import {
  GOSSIP_INFLUENCE_CHOICES,
  GossipDialogModel,
  type GossipDialogContext,
} from './GossipDialogModel';

export interface LeaderGossipIdentityContext extends GossipDialogContext {
  getNationName(nationId: string): string;
  getNationColor(nationId: string): number;
  getNationSecondaryColor(nationId: string): number;
}

export interface LeaderGossipLifecycleHooks {
  onOpened?: (nationId: string) => void;
  onClosed?: (nationId: string) => void;
}

interface DialogButton {
  background: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  hitArea: Phaser.GameObjects.Zone;
  pressed: boolean;
  hovered: boolean;
}

const DEPTH = 3100;
const PANEL_PADDING = 48;
const DIALOG_WIDTH_RATIO = 0.9;
const DIALOG_HEIGHT_RATIO = 0.9;
const PANEL_WIDTH_RATIO = 0.43;
const CLOSE_WIDTH = 132;
const CLOSE_HEIGHT = 44;
const WORLD_BLOCKER_ID = 'leader-gossip-dialog';
const TEXT_RESOLUTION = typeof window === 'undefined' ? 2 : Math.max(2, Math.ceil(window.devicePixelRatio || 1));

/** Immersive, backend-driven Gossip conversation modal. */
export class LeaderGossipDialog {
  private readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
  private readonly owned = new Set<Phaser.GameObjects.GameObject>();
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly backdropHitArea: Phaser.GameObjects.Zone;
  private readonly dialogBackground: Phaser.GameObjects.Rectangle;
  private readonly roomImage: Phaser.GameObjects.Image;
  private readonly readabilityOverlay: Phaser.GameObjects.Rectangle;
  private readonly panelBackground: Phaser.GameObjects.Rectangle;
  private readonly headingText: Phaser.GameObjects.Text;
  private readonly leaderNameText: Phaser.GameObjects.Text;
  private readonly nationNameText: Phaser.GameObjects.Text;
  private readonly leaderTitleText: Phaser.GameObjects.Text;
  private readonly actionList: AudienceActionList;
  private readonly closeButton: DialogButton;
  private readonly model: GossipDialogModel;
  private readonly pendingRoomLoads = new Set<string>();
  private currentLeaderId: string | null = null;
  private expandedCategory: GossipCategory | null = null;
  private roomVisible = false;
  private destroyed = false;

  private readonly onAddedToScene = (object: Phaser.GameObjects.GameObject): void => {
    if (this.owned.has(object)) this.scene.cameras.main.ignore(object);
    else this.uiCamera.ignore(object);
  };

  private readonly onResize = (): void => {
    this.uiCamera.setSize(this.scene.scale.width, this.scene.scale.height);
    if (this.currentLeaderId) this.layout();
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldInputGate: WorldInputGate,
    private readonly context: LeaderGossipIdentityContext,
    sourceNationId: string,
    private readonly lifecycleHooks: LeaderGossipLifecycleHooks = {},
  ) {
    this.model = new GossipDialogModel(sourceNationId, context);
    this.backdrop = this.addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x000000, 0.68))
      .setOrigin(0, 0).setDepth(DEPTH).setScrollFactor(0);
    this.backdropHitArea = this.addOwned(new Phaser.GameObjects.Zone(scene, 0, 0, 10, 10))
      .setOrigin(0, 0).setDepth(DEPTH).setScrollFactor(0);
    this.dialogBackground = this.addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x05080d, 1))
      .setOrigin(0, 0).setDepth(DEPTH + 1).setScrollFactor(0).setStrokeStyle(2, 0x9a7b3a, 0.85);
    this.roomImage = this.addOwned(new Phaser.GameObjects.Image(scene, 0, 0, '__MISSING'))
      .setOrigin(0.5, 0.5).setDepth(DEPTH + 2).setScrollFactor(0);
    this.readabilityOverlay = this.addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x000000, 0.34))
      .setOrigin(0, 0).setDepth(DEPTH + 3).setScrollFactor(0);
    this.panelBackground = this.addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x08121c, 0.91))
      .setOrigin(0, 0).setDepth(DEPTH + 5).setScrollFactor(0).setStrokeStyle(1, 0x9a7b3a, 0.5);
    this.headingText = this.addText('GOSSIP', 18, '#f4d06f', 'bold');
    this.leaderNameText = this.addText('', 40, '#f4f1e7', 'bold');
    this.nationNameText = this.addText('', 22, '#cdd7e6', 'bold');
    this.leaderTitleText = this.addText('', 18, '#9fb0c4', 'normal');
    this.actionList = new AudienceActionList(
      scene, worldInputGate,
      (object) => this.addOwned(object),
      (object) => this.removeOwned(object),
      DEPTH + 6,
    );
    this.closeButton = this.createCloseButton();
    this.installBackdropInput();

    this.uiCamera = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height);
    this.uiCamera.setScroll(0, 0).setZoom(1);
    this.uiCamera.roundPixels = true;
    this.uiCamera.ignore(scene.children.list.filter((object) => !this.owned.has(object)));
    scene.cameras.main.ignore([...this.owned]);
    scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAddedToScene);
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
    this.setVisible(false);
  }

  isOpen(): boolean { return this.currentLeaderId !== null; }
  getCurrentLeaderId(): string | null { return this.currentLeaderId; }

  open(leaderId: string): void {
    const leader = getLeaderById(leaderId);
    if (!leader) return;
    if (this.currentLeaderId) this.close();
    this.currentLeaderId = leaderId;
    this.expandedCategory = null;
    this.model.open(leader.nationId);
    this.worldInputGate.blockWorld(WORLD_BLOCKER_ID);
    this.setVisible(true);

    const nationColor = this.context.getNationColor(leader.nationId);
    this.headingText.setColor('#f4d06f');
    this.leaderNameText.setText(leader.name).setColor(toColorString(nationColor));
    this.nationNameText.setText(this.context.getNationName(leader.nationId)).setColor(toColorString(nationColor));
    this.leaderTitleText.setText(leader.title ?? '').setVisible(Boolean(leader.title));
    this.dialogBackground.setStrokeStyle(3, nationColor, 0.9);
    this.panelBackground.setStrokeStyle(2, this.context.getNationSecondaryColor(leader.nationId), 0.6);

    const roomKey = getLeaderRoomKey(leaderId);
    this.roomVisible = this.scene.textures.exists(roomKey);
    if (this.roomVisible) this.roomImage.setTexture(roomKey);
    else this.ensureRoomTexture(leaderId, roomKey, leader.image);

    this.refresh(false);
    this.lifecycleHooks.onOpened?.(leader.nationId);
  }

  close(): void {
    const leaderId = this.currentLeaderId;
    this.currentLeaderId = null;
    this.model.close();
    this.worldInputGate.unblockWorld(WORLD_BLOCKER_ID);
    this.setVisible(false);
    const nationId = leaderId ? getLeaderById(leaderId)?.nationId : undefined;
    if (nationId) this.lifecycleHooks.onClosed?.(nationId);
  }

  destroy(): void {
    // Scene shutdown must release the modal gate without firing gameplay-facing
    // close hooks while the surrounding HUD/camera is being torn down.
    this.currentLeaderId = null;
    this.model.close();
    this.worldInputGate.unblockWorld(WORLD_BLOCKER_ID);
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAddedToScene);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    this.actionList.destroy();
    for (const object of this.owned) object.destroy();
    this.owned.clear();
    this.scene.cameras.remove(this.uiCamera);
  }

  private buildRows(): RightSidebarRow[] {
    const leader = this.currentLeaderId ? getLeaderById(this.currentLeaderId) : undefined;
    if (!leader) return [];
    const selected = this.model.getSelectedItem();
    const rows: RightSidebarRow[] = [{ kind: 'text', text: 'Conversation actions', large: true }];
    for (const category of ['information', 'manipulation', 'insult'] as const) {
      const items = this.model.getItems().filter((item) => item.type === category);
      const expanded = this.expandedCategory === category;
      const selectedSummary = selected?.type === category
        ? this.model.getResolvedTextForItem(selected.id) ?? selected.textTemplate
        : undefined;
      rows.push({
        kind: 'button',
        text: `${categoryLabel(category)} (${items.length}) ${expanded ? '▾' : '▸'}${selectedSummary ? ` — ${selectedSummary}` : ''}`,
        selected: selected?.type === category,
        accentColor: categoryColor(category),
        onClick: () => {
          this.expandedCategory = expanded ? null : category;
          this.refresh(true);
        },
      });
      if (!expanded) continue;
      rows.push(...items.map((item): RightSidebarRow => ({
        kind: 'button',
        text: `↳ ${this.model.getResolvedTextForItem(item.id) ?? item.textTemplate}`,
        disabled: !this.model.getItemAvailability(item.id).available,
        disabledReason: cultureRequirementText(this.model.getItemAvailability(item.id).requiredCultureNodeName),
        selected: selected?.id === item.id,
        accentColor: categoryColor(item.type),
        onClick: () => {
          this.model.selectItem(item.id);
          this.expandedCategory = null;
          this.refresh(false);
        },
      })));
    }

    if (selected?.requiresTarget) {
      rows.push({ kind: 'separator' }, { kind: 'text', text: 'Choose another known leader', large: true });
      if (this.model.getTargets().length === 0) {
        rows.push({ kind: 'text', text: 'You do not know another valid nation yet.', muted: true });
      } else {
        rows.push(...this.model.getTargets().map((target): RightSidebarRow => ({
          kind: 'button',
          text: `${target.leaderName} — ${target.nationName}`,
          selected: this.model.getSelectedTarget()?.nationId === target.nationId,
          onClick: () => { this.model.selectTarget(target.nationId); this.refresh(true); },
        })));
      }
    }

    if (selected?.type === 'manipulation') {
      const available = this.model.getAvailableInfluence();
      const status = this.model.getManipulationStatus();
      const selectedCost = this.model.getManipulationCost();
      rows.push(
        { kind: 'separator' },
        { kind: 'text', text: `Influence available: ${available}`, large: true },
        {
          kind: 'buttonGroup',
          buttons: GOSSIP_INFLUENCE_CHOICES.map((amount) => {
            const cost = this.model.getManipulationCost(selected.id, amount);
            return {
              text: cost ? `${amount} → ${cost.actualCost}` : `${amount}`,
              disabled: !cost || cost.actualCost > available,
              accentColor: this.model.getSelectedInfluence() === amount ? 0xf4d06f : 0x6fb2d4,
              onClick: () => { this.model.selectInfluence(amount); this.refresh(true); },
            };
          }),
        },
      );
      if (selectedCost) {
        rows.push({
          kind: 'text',
          text: `Actual cost: ${selectedCost.actualCost} Influence (${selectedCost.sourceEra}, ${selectedCost.itemWeight}× rumor)`,
          muted: true,
        });
      }
      if (status && !status.allowed) {
        rows.push({ kind: 'text', text: manipulationStatusText(status.failureReason, status.remainingRounds, leader.name), muted: true });
      }
    }

    if (selected?.type === 'insult') {
      const status = this.model.getInsultStatus();
      if (status && !status.allowed) {
        rows.push(
          { kind: 'separator' },
          { kind: 'text', text: insultStatusText(status.remainingRounds, leader.name), muted: true },
        );
      }
    }

    const preview = this.model.getResolvedPreview();
    rows.push(
      { kind: 'separator' },
      { kind: 'text', text: 'You will say', large: true },
      { kind: 'text', text: preview ?? 'Select a valid target to continue.', muted: !preview },
      {
        kind: 'button',
        text: selected?.type === 'information' ? 'Ask' : selected?.type === 'manipulation' ? 'Spread rumor' : 'Say it',
        disabled: !this.model.canExecute(),
        disabledReason: this.getDisabledReason(),
        accentColor: 0xf4d06f,
        onClick: () => { this.model.execute(); this.refresh(true); },
      },
    );

    const result = this.model.getLatestResult();
    if (result) rows.push(...this.buildResultRows(result, leader.name));
    return rows;
  }

  private buildResultRows(result: GossipExecutionResult, leaderName: string): RightSidebarRow[] {
    const rows: RightSidebarRow[] = [
      { kind: 'separator' },
      { kind: 'text', text: 'Latest exchange', large: true },
    ];
    if (!result.success) {
      rows.push({ kind: 'text', text: failureText(result.failureReason, result.cooldownRemainingRounds, leaderName), muted: true });
      return rows;
    }
    rows.push({ kind: 'text', text: 'You', large: true }, { kind: 'text', text: result.resolvedText });
    if (result.responseText) {
      rows.push({ kind: 'text', text: leaderName, large: true }, { kind: 'text', text: result.responseText });
    } else if (result.type === 'manipulation') {
      rows.push({ kind: 'text', text: `Rumor spread. ${result.influenceSpent} Influence spent.`, muted: true });
    } else {
      rows.push({ kind: 'text', text: 'Remark delivered.', muted: true });
    }
    return rows;
  }

  private getDisabledReason(): string | undefined {
    const selected = this.model.getSelectedItem();
    if (!selected?.requiresTarget || this.model.getSelectedTarget()) {
      if (selected?.type === 'manipulation') {
        const status = this.model.getManipulationStatus();
        if (status && !status.allowed) return manipulationStatusText(status.failureReason, status.remainingRounds, 'This leader');
        const cost = this.model.getManipulationCost();
        if (!cost || cost.actualCost > this.model.getAvailableInfluence()) return 'Not enough Influence.';
      }
      if (selected?.type === 'insult') {
        const status = this.model.getInsultStatus();
        if (status && !status.allowed) return insultStatusText(status.remainingRounds, 'this leader');
      }
      return undefined;
    }
    return 'Select another known leader first.';
  }

  private refresh(preserveScroll: boolean): void {
    if (!this.currentLeaderId || this.destroyed) return;
    this.actionList.setRows(this.buildRows(), preserveScroll);
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
    this.layoutRoom(dialogX, dialogY, dialogW, dialogH);

    const identityX = dialogX + PANEL_PADDING;
    let identityY = dialogY + PANEL_PADDING;
    this.headingText.setPosition(identityX, identityY);
    identityY += this.headingText.height + 10;
    this.leaderNameText.setPosition(identityX, identityY).setWordWrapWidth(Math.round(dialogW * 0.38));
    identityY += this.leaderNameText.height + 6;
    this.nationNameText.setPosition(identityX, identityY);
    identityY += this.nationNameText.height + 4;
    this.leaderTitleText.setPosition(identityX, identityY);
    if (this.leaderTitleText.visible) identityY += this.leaderTitleText.height;

    // Keep the conversation controls aligned with the identity block on the
    // left. Leader room artwork places the leader on the right, which remains
    // unobscured while the compact category dropdowns use the left foreground.
    const panelW = Math.round(dialogW * PANEL_WIDTH_RATIO);
    const panelX = identityX;
    const panelY = identityY + 28;
    const panelBottom = dialogY + dialogH - PANEL_PADDING;
    const panelH = Math.max(0, panelBottom - panelY);
    this.panelBackground.setPosition(panelX - 20, panelY - 20).setDisplaySize(panelW + 40, panelH + 40);
    this.actionList.layout(panelX, panelY, panelW, panelH);

    const closeX = dialogX + dialogW - PANEL_PADDING - CLOSE_WIDTH;
    const closeY = dialogY + PANEL_PADDING - 8;
    this.placeCloseButton(closeX, closeY);
  }

  private layoutRoom(x: number, y: number, width: number, height: number): void {
    this.roomImage.setVisible(this.roomVisible);
    if (!this.roomVisible) return;
    const source = this.roomImage.texture.getSourceImage();
    const scale = Math.min(width / source.width, height / source.height);
    this.roomImage.setScale(scale).setPosition(x + width / 2, y + height / 2);
  }

  private ensureRoomTexture(leaderId: string, roomKey: string, imagePath: string): void {
    if (this.pendingRoomLoads.has(roomKey)) return;
    this.pendingRoomLoads.add(roomKey);
    this.scene.load.image(roomKey, getLeaderRoomImagePath(imagePath));
    this.scene.load.once(`filecomplete-image-${roomKey}`, () => {
      this.pendingRoomLoads.delete(roomKey);
      if (this.destroyed || this.currentLeaderId !== leaderId) return;
      this.roomImage.setTexture(roomKey);
      this.roomVisible = true;
      this.layout();
    });
    this.scene.load.start();
  }

  private installBackdropInput(): void {
    for (const eventName of [Phaser.Input.Events.POINTER_DOWN, Phaser.Input.Events.POINTER_UP]) {
      this.backdropHitArea.on(eventName, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        consumePointerEvent(pointer);
      });
    }
  }

  private createCloseButton(): DialogButton {
    const background = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, 10, CLOSE_HEIGHT, 0x7a3030, 1))
      .setOrigin(0, 0).setDepth(DEPTH + 7).setScrollFactor(0);
    const text = this.addText('Close', 17, '#ffffff', 'bold').setOrigin(0.5, 0.5).setDepth(DEPTH + 8);
    const hitArea = this.addOwned(new Phaser.GameObjects.Zone(this.scene, 0, 0, 10, CLOSE_HEIGHT))
      .setOrigin(0, 0).setDepth(DEPTH + 9).setScrollFactor(0);
    const button = { background, text, hitArea, pressed: false, hovered: false };
    hitArea.on(Phaser.Input.Events.POINTER_OVER, () => { button.hovered = true; this.refreshCloseButton(); });
    hitArea.on(Phaser.Input.Events.POINTER_OUT, () => { button.hovered = false; button.pressed = false; this.refreshCloseButton(); });
    hitArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      button.pressed = true;
      consumePointerEvent(pointer);
      this.refreshCloseButton();
    });
    hitArea.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      const click = button.pressed;
      button.pressed = false;
      consumePointerEvent(pointer);
      this.refreshCloseButton();
      if (click) this.close();
    });
    return button;
  }

  private placeCloseButton(x: number, y: number): void {
    this.closeButton.background.setPosition(x, y).setDisplaySize(CLOSE_WIDTH, CLOSE_HEIGHT);
    this.closeButton.text.setPosition(x + CLOSE_WIDTH / 2, y + CLOSE_HEIGHT / 2);
    this.closeButton.hitArea.setPosition(x, y).setSize(CLOSE_WIDTH, CLOSE_HEIGHT);
    if (!this.closeButton.hitArea.input?.enabled) this.closeButton.hitArea.setInteractive({ useHandCursor: true });
    this.refreshCloseButton();
  }

  private refreshCloseButton(): void {
    const color = this.closeButton.pressed ? 0x5e2424 : this.closeButton.hovered ? 0x9c4242 : 0x7a3030;
    this.closeButton.background.setFillStyle(color, 1);
  }

  private setVisible(visible: boolean): void {
    for (const object of this.owned) {
      if (object instanceof Phaser.GameObjects.Zone) continue;
      (object as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible).setVisible(visible);
    }
    if (visible) {
      this.backdropHitArea.setInteractive();
      this.closeButton.hitArea.setInteractive({ useHandCursor: true });
    } else {
      this.backdropHitArea.disableInteractive();
      this.closeButton.hitArea.disableInteractive();
      this.roomImage.setVisible(false);
      this.leaderTitleText.setVisible(false);
    }
    this.actionList.setVisible(visible);
  }

  private addText(text: string, size: number, color: string, style: 'normal' | 'bold'): Phaser.GameObjects.Text {
    return this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, text, {
      fontFamily: 'sans-serif', fontSize: `${size}px`, color, fontStyle: style,
    })).setOrigin(0, 0).setDepth(DEPTH + 6).setScrollFactor(0).setResolution(TEXT_RESOLUTION);
  }

  private addOwned<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.owned.add(object);
    this.scene.add.existing(object);
    return object;
  }

  private removeOwned(object: Phaser.GameObjects.GameObject): void {
    this.owned.delete(object);
    object.destroy();
  }
}

function categoryLabel(type: 'information' | 'manipulation' | 'insult'): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function categoryColor(type: 'information' | 'manipulation' | 'insult'): number {
  if (type === 'information') return 0x6fb2d4;
  if (type === 'manipulation') return 0xd9a441;
  return 0xb86969;
}

function manipulationStatusText(reason: GossipFailureReason | undefined, rounds: number, leaderName: string): string {
  if (reason === 'cooldown_active') return `You recently manipulated ${leaderName}. Available again in ${rounds} rounds.`;
  if (reason === 'recipient_rejects') return `${leaderName} does not trust you enough to believe your rumors.`;
  return 'Manipulation is not available for this leader.';
}

function failureText(reason: GossipFailureReason, rounds: number, leaderName: string): string {
  switch (reason) {
    case 'insufficient_influence': return 'You do not have enough Influence.';
    case 'cooldown_active': return manipulationStatusText(reason, rounds, leaderName);
    case 'insult_cooldown_active': return insultStatusText(rounds, leaderName);
    case 'recipient_rejects': return manipulationStatusText(reason, rounds, leaderName);
    case 'invalid_target':
    case 'invalid_combination': return 'That target is no longer valid.';
    case 'unknown_item': return 'That Gossip topic is no longer available.';
    case 'influence_required': return 'Choose an Influence commitment.';
    case 'invalid_source':
    case 'invalid_recipient': return 'This conversation is no longer available.';
    case 'culture_locked': return 'You have not unlocked the required Cultural advancement.';
  }
}

function insultStatusText(rounds: number, leaderName: string): string {
  return `You recently insulted ${leaderName}. Available again in ${rounds} rounds.`;
}

function cultureRequirementText(requiredCultureNodeName: string | undefined): string | undefined {
  return requiredCultureNodeName ? `Requires ${requiredCultureNodeName}` : undefined;
}

function toColorString(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
}
