import Phaser from 'phaser';
import { isPolicySlotCompatible, type PolicySystem } from '../../systems/PolicySystem';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import type { ActivePolicyAssignment, PolicySlotCounts } from '../../entities/NationPolicies';
import type { PolicyCategory, PolicyDefinition, PolicySlotCategory } from '../../types/policy';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';
import { getPolicySpriteKey } from '../../utils/assetPaths';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

const DEPTH = 220;
const OVERLAY_DEPTH = DEPTH;
const PANEL_DEPTH = DEPTH + 1;
const HEADER_DEPTH = DEPTH + 2;
const CONTENT_DEPTH = DEPTH + 3;
const MASKED_TEXT_DEPTH = DEPTH + 4;
const DRAG_GHOST_DEPTH = DEPTH + 40;
const TOOLTIP_DEPTH = DEPTH + 50;
const HUD_TEXT_RESOLUTION = getHudTextResolution();

const POLICY_CATEGORIES: readonly PolicyCategory[] = ['military', 'economic', 'diplomatic', 'ideology'];
const POLICY_SLOT_CATEGORIES: readonly PolicySlotCategory[] = ['military', 'economic', 'diplomatic', 'ideology', 'wildcard'];

const PANEL_WIDTH_RATIO = 0.8;
const PANEL_HEIGHT_RATIO = 0.8;
const HEADER_HEIGHT = 56;
const PANEL_PADDING = 18;
const SECTION_GAP = 18;
const RIGHT_PANEL_WIDTH = 360;

const CARD_WIDTH = 168;
const CARD_HEIGHT = 232;
const CARD_GAP_X = 16;
const CARD_GAP_Y = 18;
const CARD_HEADER_HEIGHT = 30;
const CARD_IMAGE_SIZE = 96;
const CARD_DESCRIPTION_LINES = 2;

const SLOT_CARD_WIDTH = 140;
const SLOT_CARD_HEIGHT = 188;
const SLOT_GAP = 12;
const SLOT_GROUP_GAP = 16;

const SCROLL_STEP = 60;
const SCROLLBAR_WIDTH = 10;
const SCROLLBAR_GAP = 10;

const TOOLTIP_DELAY_MS = 220;
const TOOLTIP_PADDING_X = 10;
const TOOLTIP_PADDING_Y = 8;

interface CardVisual {
  policyId: string;
  category: PolicyCategory;
  background: Phaser.GameObjects.Rectangle;
  headerBackground: Phaser.GameObjects.Rectangle;
  headerText: Phaser.GameObjects.Text;
  imageFrame: Phaser.GameObjects.Rectangle;
  image: Phaser.GameObjects.Image;
  fallbackInitials: Phaser.GameObjects.Text;
  description: Phaser.GameObjects.Text;
  hitArea: Phaser.GameObjects.Zone;
  origin: 'pool' | 'slot';
  slotKey: string | null;
  hovered: boolean;
  pressed: boolean;
}

interface SlotVisual {
  key: string;
  category: PolicySlotCategory;
  index: number;
  screenRect: Phaser.Geom.Rectangle;
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  hitArea: Phaser.GameObjects.Zone;
  occupiedBy: string | null;
  highlighted: boolean;
}

interface DragState {
  card: CardVisual;
  policy: PolicyDefinition;
  pointerId: number;
  ghostBg: Phaser.GameObjects.Rectangle;
  ghostHeader: Phaser.GameObjects.Rectangle;
  ghostHeaderText: Phaser.GameObjects.Text;
  ghostImageFrame: Phaser.GameObjects.Rectangle;
  ghostImage: Phaser.GameObjects.Image | null;
  ghostFallbackInitials: Phaser.GameObjects.Text;
  ghostDescription: Phaser.GameObjects.Text;
  hoveredSlotKey: string | null;
}

export class PolicyDialog {
  private readonly addOwned: AddOwned;
  private readonly wheelBlockerId = `policy-dialog-wheel-${Math.random().toString(36).slice(2)}`;

  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly panelBackground: Phaser.GameObjects.Rectangle;
  private readonly headerBackground: Phaser.GameObjects.Rectangle;
  private readonly headerTitle: Phaser.GameObjects.Text;
  private readonly closeButton: Phaser.GameObjects.Rectangle;
  private readonly closeText: Phaser.GameObjects.Text;
  private readonly leftHeading: Phaser.GameObjects.Text;
  private readonly leftEmptyText: Phaser.GameObjects.Text;
  private readonly rightHeading: Phaser.GameObjects.Text;
  private readonly leftMaskGraphics: Phaser.GameObjects.Graphics;
  private readonly leftMask: Phaser.Display.Masks.GeometryMask;
  private readonly rightMaskGraphics: Phaser.GameObjects.Graphics;
  private readonly rightMask: Phaser.Display.Masks.GeometryMask;
  private readonly scrollbarTrack: Phaser.GameObjects.Rectangle;
  private readonly scrollbarThumb: Phaser.GameObjects.Rectangle;
  private readonly tooltipBackground: Phaser.GameObjects.Rectangle;
  private readonly tooltipText: Phaser.GameObjects.Text;
  private readonly slotCategoryHeadings = new Map<PolicySlotCategory, Phaser.GameObjects.Text>();

  private readonly cards: CardVisual[] = [];
  private readonly slotsByKey = new Map<string, SlotVisual>();
  private readonly slotKeysInOrder: string[] = [];

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

  private isOpen = false;
  private scrollOffset = 0;
  private maxScroll = 0;
  private leftAreaBounds = new Phaser.Geom.Rectangle();
  private rightAreaBounds = new Phaser.Geom.Rectangle();
  private panelBounds = new Phaser.Geom.Rectangle();
  private dragState: DragState | null = null;
  private hoveredCard: CardVisual | null = null;
  private tooltipTimer: ReturnType<typeof setTimeout> | null = null;
  private tooltipPointer: Phaser.Input.Pointer | null = null;

  private slotCounts: PolicySlotCounts = { economic: 0, military: 0, diplomatic: 0, ideology: 0, wildcard: 0 };
  private activeAssignments: ActivePolicyAssignment[] = [];
  private unlockedPolicies: PolicyDefinition[] = [];
  private onPoliciesChanged: ((nationId: string) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    addOwned: AddOwned,
    private readonly worldInputGate: WorldInputGate,
    private readonly policySystem: PolicySystem,
    private readonly getNationId: () => string | undefined,
  ) {
    this.addOwned = addOwned;

    this.overlay = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x000000, 0.62))
      .setOrigin(0, 0)
      .setDepth(OVERLAY_DEPTH)
      .setScrollFactor(0)
      .setInteractive()
      .setVisible(false);
    this.panelBackground = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x0c1620, 0.97))
      .setOrigin(0, 0)
      .setDepth(PANEL_DEPTH)
      .setScrollFactor(0)
      .setInteractive()
      .setVisible(false);
    this.headerBackground = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, HEADER_HEIGHT, 0x182434, 1))
      .setOrigin(0, 0)
      .setDepth(HEADER_DEPTH)
      .setScrollFactor(0)
      .setVisible(false);
    this.headerTitle = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, 'Policies', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#f4f1e7',
      fontStyle: 'bold',
    }))
      .setOrigin(0, 0.5)
      .setDepth(HEADER_DEPTH + 1)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);
    this.closeButton = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 32, 32, 0x331e1e, 1))
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
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);

    this.leftHeading = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, 'Available Policies', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#9fc9aa',
      fontStyle: 'bold',
    }))
      .setOrigin(0, 0)
      .setDepth(CONTENT_DEPTH)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);
    this.leftEmptyText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, 'No unlocked policies. Research civics to unlock policies.', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#b9c8bc',
      wordWrap: { width: 320, useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(CONTENT_DEPTH)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);
    this.rightHeading = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, 'Slots', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#9fc9aa',
      fontStyle: 'bold',
    }))
      .setOrigin(0, 0)
      .setDepth(CONTENT_DEPTH)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);

    for (const category of POLICY_SLOT_CATEGORIES) {
      const heading = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, formatCategory(category), {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: getCategoryHexColor(category),
        fontStyle: 'bold',
      }))
        .setOrigin(0, 0)
        .setDepth(CONTENT_DEPTH)
        .setScrollFactor(0)
        .setResolution(HUD_TEXT_RESOLUTION)
        .setVisible(false);
      this.slotCategoryHeadings.set(category, heading);
    }

    this.leftMaskGraphics = new Phaser.GameObjects.Graphics(scene);
    this.leftMask = this.leftMaskGraphics.createGeometryMask();
    this.rightMaskGraphics = new Phaser.GameObjects.Graphics(scene);
    this.rightMask = this.rightMaskGraphics.createGeometryMask();

    this.scrollbarTrack = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, SCROLLBAR_WIDTH, 10, 0x16251b, 0.9))
      .setOrigin(0, 0)
      .setDepth(CONTENT_DEPTH)
      .setScrollFactor(0)
      .setVisible(false);
    this.scrollbarThumb = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, SCROLLBAR_WIDTH, 32, 0x9fc9aa, 0.95))
      .setOrigin(0, 0)
      .setDepth(CONTENT_DEPTH + 1)
      .setScrollFactor(0)
      .setVisible(false);

    this.tooltipBackground = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x081018, 0.96))
      .setOrigin(0, 0)
      .setDepth(TOOLTIP_DEPTH)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0x6f89a2, 0.75)
      .setVisible(false);
    this.tooltipText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#edf5ff',
      wordWrap: { width: 280, useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(TOOLTIP_DEPTH + 1)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);

    this.overlay.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (!this.isOpen || pointer.button !== 0) return;
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
    });
    this.overlay.on(Phaser.Input.Events.POINTER_UP, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      if (this.handleActiveDragPointerUp(pointer, event)) return;
      event.stopPropagation();
      if (!this.isOpen || pointer.button !== 0) return;
      consumePointerEvent(pointer);
      this.worldInputGate.releasePointer(pointer.id);
    });
    this.panelBackground.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (!this.isOpen || pointer.button !== 0) return;
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
    });
    this.panelBackground.on(Phaser.Input.Events.POINTER_UP, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      if (this.handleActiveDragPointerUp(pointer, event)) return;
      event.stopPropagation();
      if (!this.isOpen || pointer.button !== 0) return;
      consumePointerEvent(pointer);
      this.worldInputGate.releasePointer(pointer.id);
    });

    this.closeButton.on(Phaser.Input.Events.POINTER_OVER, () => {
      this.closeButton.setFillStyle(0x4d2828, 1);
    });
    this.closeButton.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.closeButton.setFillStyle(0x331e1e, 1);
    });
    this.closeButton.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
    });
    this.closeButton.on(Phaser.Input.Events.POINTER_UP, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      consumePointerEvent(pointer);
      this.worldInputGate.releasePointer(pointer.id);
      this.close();
    });

    this.handleWheel = (pointer, _gameObjects, _deltaX, deltaY, _deltaZ, event) => {
      if (!this.isOpen) return;
      if (!this.leftAreaBounds.contains(pointer.x, pointer.y)) return;
      consumePointerEvent(pointer);
      event.preventDefault?.();
      this.applyScroll(Math.sign(deltaY) * SCROLL_STEP);
    };
    this.handlePointerMove = (pointer) => this.onPointerMove(pointer);
    this.handlePointerUp = (pointer) => this.onPointerUp(pointer);
    this.handleResize = () => {
      if (this.isOpen) this.layout();
    };

    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp);
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);

    this.worldInputGate.registerWheelBlocker(
      this.wheelBlockerId,
      (screenX, screenY) => this.isOpen && this.panelBounds.contains(screenX, screenY),
    );
  }

  setOnPoliciesChanged(handler: (nationId: string) => void): void {
    this.onPoliciesChanged = handler;
  }

  isShowing(): boolean {
    return this.isOpen;
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.scrollOffset = 0;
    this.refresh();
    this.overlay.setVisible(true);
    this.panelBackground.setVisible(true);
    this.headerBackground.setVisible(true);
    this.headerTitle.setVisible(true);
    this.closeButton.setVisible(true);
    this.closeText.setVisible(true);
    this.leftHeading.setVisible(true);
    this.rightHeading.setVisible(true);
    this.layout();
  }

  close(): void {
    if (!this.isOpen) return;
    this.cancelDrag();
    this.hideTooltip();
    this.isOpen = false;
    this.overlay.setVisible(false);
    this.panelBackground.setVisible(false);
    this.headerBackground.setVisible(false);
    this.headerTitle.setVisible(false);
    this.closeButton.setVisible(false);
    this.closeText.setVisible(false);
    this.leftHeading.setVisible(false);
    this.leftEmptyText.setVisible(false);
    this.rightHeading.setVisible(false);
    this.scrollbarTrack.setVisible(false);
    this.scrollbarThumb.setVisible(false);
    for (const heading of this.slotCategoryHeadings.values()) heading.setVisible(false);
    this.destroyCards();
    this.destroySlots();
  }

  refresh(): void {
    if (!this.isOpen) return;
    this.cancelDrag();
    this.hideTooltip();
    const nationId = this.getNationId();
    if (!nationId) {
      this.slotCounts = { economic: 0, military: 0, diplomatic: 0, ideology: 0, wildcard: 0 };
      this.activeAssignments = [];
      this.unlockedPolicies = [];
    } else {
      this.slotCounts = this.policySystem.getSlotCounts(nationId);
      this.activeAssignments = this.policySystem.getActivePolicyAssignments(nationId);
      this.unlockedPolicies = this.policySystem.getUnlockedPolicies(nationId);
    }
    this.rebuildVisuals();
    this.layout();
  }

  destroy(): void {
    this.cancelDrag();
    this.hideTooltip();
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.worldInputGate.unregisterWheelBlocker(this.wheelBlockerId);
    this.destroyCards();
    this.destroySlots();
    this.overlay.destroy();
    this.panelBackground.destroy();
    this.headerBackground.destroy();
    this.headerTitle.destroy();
    this.closeButton.destroy();
    this.closeText.destroy();
    this.leftHeading.destroy();
    this.leftEmptyText.destroy();
    this.rightHeading.destroy();
    this.leftMaskGraphics.destroy();
    this.rightMaskGraphics.destroy();
    this.scrollbarTrack.destroy();
    this.scrollbarThumb.destroy();
    this.tooltipBackground.destroy();
    this.tooltipText.destroy();
    for (const heading of this.slotCategoryHeadings.values()) heading.destroy();
  }

  private rebuildVisuals(): void {
    this.destroyCards();
    this.destroySlots();

    const activePolicyIds = new Set(this.activeAssignments.map((a) => a.policyId));
    const poolPolicies = this.unlockedPolicies.filter((p) => !activePolicyIds.has(p.id));
    poolPolicies.sort((a, b) => {
      const ai = POLICY_CATEGORIES.indexOf(a.category);
      const bi = POLICY_CATEGORIES.indexOf(b.category);
      if (ai !== bi) return ai - bi;
      return a.name.localeCompare(b.name);
    });

    for (const policy of poolPolicies) {
      this.cards.push(this.createCard(policy, 'pool', null));
    }

    for (const category of POLICY_SLOT_CATEGORIES) {
      const total = this.slotCounts[category];
      for (let i = 0; i < total; i += 1) {
        const slot = this.createSlot(category, i);
        this.slotsByKey.set(slot.key, slot);
        this.slotKeysInOrder.push(slot.key);
      }
    }

    for (const assignment of this.activeAssignments) {
      const slotKey = this.findFreeSlotKey(assignment.slotCategory);
      if (!slotKey) continue;
      const slot = this.slotsByKey.get(slotKey);
      if (!slot) continue;
      const policy = this.unlockedPolicies.find((p) => p.id === assignment.policyId);
      if (!policy) continue;
      slot.occupiedBy = policy.id;
      this.cards.push(this.createCard(policy, 'slot', slotKey));
    }
  }

  private findFreeSlotKey(category: PolicySlotCategory): string | null {
    for (const key of this.slotKeysInOrder) {
      const slot = this.slotsByKey.get(key);
      if (!slot) continue;
      if (slot.category !== category) continue;
      if (slot.occupiedBy === null) return key;
    }
    return null;
  }

  private createCard(policy: PolicyDefinition, origin: 'pool' | 'slot', slotKey: string | null): CardVisual {
    const isSlot = origin === 'slot';
    const baseWidth = isSlot ? SLOT_CARD_WIDTH : CARD_WIDTH;
    const baseHeight = isSlot ? SLOT_CARD_HEIGHT : CARD_HEIGHT;
    const fillColor = getCategoryFillColor(policy.category);
    const strokeColor = getCategoryStrokeColor(policy.category);
    const headerColor = getCategoryHeaderColor(policy.category);

    const background = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, baseWidth, baseHeight, fillColor, 0.96))
      .setOrigin(0, 0)
      .setDepth(CONTENT_DEPTH)
      .setScrollFactor(0)
      .setStrokeStyle(2, strokeColor, 0.95);
    const headerBackground = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, baseWidth, CARD_HEADER_HEIGHT, headerColor, 1))
      .setOrigin(0, 0)
      .setDepth(CONTENT_DEPTH + 1)
      .setScrollFactor(0);
    const headerText = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, truncateText(policy.name, isSlot ? 14 : 18), {
      fontFamily: 'sans-serif',
      fontSize: isSlot ? '13px' : '14px',
      color: '#f4f1e7',
      fontStyle: 'bold',
    }))
      .setOrigin(0, 0.5)
      .setDepth(CONTENT_DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION);
    const imageSize = isSlot ? Math.round(CARD_IMAGE_SIZE * 0.7) : CARD_IMAGE_SIZE;
    const imageFrame = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, imageSize, imageSize, 0x0a141c, 0.9))
      .setOrigin(0.5, 0.5)
      .setDepth(CONTENT_DEPTH + 1)
      .setScrollFactor(0)
      .setStrokeStyle(1, strokeColor, 0.5);
    const imageKey = getPolicySpriteKey(policy.id);
    const hasImage = this.scene.textures.exists(imageKey);
    const image = this.addOwned(new Phaser.GameObjects.Image(this.scene, 0, 0, hasImage ? imageKey : '__MISSING__'))
      .setOrigin(0.5, 0.5)
      .setDepth(CONTENT_DEPTH + 2)
      .setScrollFactor(0);
    if (hasImage) {
      image.setDisplaySize(imageSize - 6, imageSize - 6);
    } else {
      image.setVisible(false);
    }
    const fallbackInitials = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, getInitials(policy.name), {
      fontFamily: 'sans-serif',
      fontSize: isSlot ? '20px' : '26px',
      color: '#f4f1e7',
      fontStyle: 'bold',
    }))
      .setOrigin(0.5, 0.5)
      .setDepth(CONTENT_DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(!hasImage);

    const descriptionWidth = baseWidth - 14;
    const descriptionLines = isSlot ? CARD_DESCRIPTION_LINES : CARD_DESCRIPTION_LINES + 1;
    const description = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, truncateForCard(policy.description, descriptionLines, isSlot ? 22 : 28), {
      fontFamily: 'sans-serif',
      fontSize: isSlot ? '11px' : '12px',
      color: '#dde7df',
      wordWrap: { width: descriptionWidth, useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(CONTENT_DEPTH + 1)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION);
    const hitArea = this.addOwned(new Phaser.GameObjects.Zone(this.scene, 0, 0, baseWidth, baseHeight))
      .setOrigin(0, 0)
      .setDepth(CONTENT_DEPTH + 5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    const card: CardVisual = {
      policyId: policy.id,
      category: policy.category,
      background,
      headerBackground,
      headerText,
      imageFrame,
      image,
      fallbackInitials,
      description,
      hitArea,
      origin,
      slotKey,
      hovered: false,
      pressed: false,
    };

    if (origin === 'pool') {
      this.applyMaskToCard(card, this.leftMask);
    } else {
      this.applyMaskToCard(card, this.rightMask);
    }

    hitArea.on(Phaser.Input.Events.POINTER_OVER, (pointer: Phaser.Input.Pointer) => {
      card.hovered = true;
      this.refreshCardVisual(card);
      this.scheduleTooltip(card, pointer);
    });
    hitArea.on(Phaser.Input.Events.POINTER_OUT, () => {
      card.hovered = false;
      card.pressed = false;
      this.refreshCardVisual(card);
      if (this.hoveredCard === card) {
        this.hoveredCard = null;
        this.hideTooltip();
      }
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
      card.pressed = true;
      this.refreshCardVisual(card);
      this.beginDrag(card, pointer);
    });

    return card;
  }

  private applyMaskToCard(card: CardVisual, mask: Phaser.Display.Masks.GeometryMask): void {
    card.background.setMask(mask);
    card.headerBackground.setMask(mask);
    card.headerText.setMask(mask);
    card.imageFrame.setMask(mask);
    card.image.setMask(mask);
    card.fallbackInitials.setMask(mask);
    card.description.setMask(mask);
  }

  private clearCardMask(card: CardVisual): void {
    card.background.clearMask();
    card.headerBackground.clearMask();
    card.headerText.clearMask();
    card.imageFrame.clearMask();
    card.image.clearMask();
    card.fallbackInitials.clearMask();
    card.description.clearMask();
  }

  private createSlot(category: PolicySlotCategory, index: number): SlotVisual {
    const fillColor = getCategoryFillColor(category);
    const strokeColor = getCategoryStrokeColor(category);
    const background = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, SLOT_CARD_WIDTH, SLOT_CARD_HEIGHT, fillColor, 0.32))
      .setOrigin(0, 0)
      .setDepth(CONTENT_DEPTH)
      .setScrollFactor(0)
      .setStrokeStyle(2, strokeColor, 0.85);
    const label = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, `${formatCategory(category)} Slot`, {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: getCategoryHexColor(category),
      fontStyle: 'bold',
    }))
      .setOrigin(0.5, 0.5)
      .setDepth(CONTENT_DEPTH + 1)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION);
    const hitArea = this.addOwned(new Phaser.GameObjects.Zone(this.scene, 0, 0, SLOT_CARD_WIDTH, SLOT_CARD_HEIGHT))
      .setOrigin(0, 0)
      .setDepth(CONTENT_DEPTH + 4)
      .setScrollFactor(0);
    background.setMask(this.rightMask);
    label.setMask(this.rightMask);

    const slot: SlotVisual = {
      key: `${category}-${index}`,
      category,
      index,
      screenRect: new Phaser.Geom.Rectangle(),
      background,
      label,
      hitArea,
      occupiedBy: null,
      highlighted: false,
    };
    return slot;
  }

  private destroyCards(): void {
    for (const card of this.cards) {
      card.background.destroy();
      card.headerBackground.destroy();
      card.headerText.destroy();
      card.imageFrame.destroy();
      card.image.destroy();
      card.fallbackInitials.destroy();
      card.description.destroy();
      card.hitArea.destroy();
    }
    this.cards.length = 0;
  }

  private destroySlots(): void {
    for (const slot of this.slotsByKey.values()) {
      slot.background.destroy();
      slot.label.destroy();
      slot.hitArea.destroy();
    }
    this.slotsByKey.clear();
    this.slotKeysInOrder.length = 0;
  }

  private layout(): void {
    if (!this.isOpen) return;
    const { width: vw, height: vh } = this.scene.scale;
    this.overlay.setPosition(0, 0).setDisplaySize(vw, vh);

    const panelW = Math.round(vw * PANEL_WIDTH_RATIO);
    const panelH = Math.round(vh * PANEL_HEIGHT_RATIO);
    const panelX = Math.round((vw - panelW) / 2);
    const panelY = Math.round((vh - panelH) / 2);
    this.panelBounds.setTo(panelX, panelY, panelW, panelH);

    this.panelBackground.setPosition(panelX, panelY).setDisplaySize(panelW, panelH);
    this.headerBackground.setPosition(panelX, panelY).setDisplaySize(panelW, HEADER_HEIGHT);
    this.headerTitle.setPosition(panelX + PANEL_PADDING, panelY + (HEADER_HEIGHT / 2));
    const closeX = panelX + panelW - PANEL_PADDING - 32;
    const closeY = panelY + (HEADER_HEIGHT - 32) / 2;
    this.closeButton.setPosition(closeX, closeY).setDisplaySize(32, 32);
    this.closeText.setPosition(closeX + 16, closeY + 16);

    const contentY = panelY + HEADER_HEIGHT + PANEL_PADDING;
    const contentBottom = panelY + panelH - PANEL_PADDING;
    const contentHeight = contentBottom - contentY;
    const rightWidth = Math.min(RIGHT_PANEL_WIDTH, Math.max(280, Math.round(panelW * 0.32)));
    const rightX = panelX + panelW - PANEL_PADDING - rightWidth;
    const leftX = panelX + PANEL_PADDING;
    const leftWidth = rightX - SECTION_GAP - leftX;

    this.leftAreaBounds.setTo(leftX, contentY, leftWidth, contentHeight);
    this.rightAreaBounds.setTo(rightX, contentY, rightWidth, contentHeight);

    this.leftHeading.setPosition(leftX, contentY);
    this.rightHeading.setPosition(rightX, contentY);

    const headingHeight = 24;
    const leftScrollTop = contentY + headingHeight;
    const leftScrollHeight = contentBottom - leftScrollTop;
    const rightContentTop = contentY + headingHeight;
    const rightContentHeight = contentBottom - rightContentTop;

    this.updateMasks(leftX, leftScrollTop, leftWidth - SCROLLBAR_WIDTH - SCROLLBAR_GAP, leftScrollHeight, rightX, rightContentTop, rightWidth, rightContentHeight);

    const layoutResult = this.layoutLeftCards(leftX, leftScrollTop, leftWidth - SCROLLBAR_WIDTH - SCROLLBAR_GAP);
    this.updateScrollState(layoutResult.totalHeight, leftScrollHeight);
    this.repositionLeftCards(leftX, leftScrollTop, leftWidth - SCROLLBAR_WIDTH - SCROLLBAR_GAP);
    this.updateScrollbar(leftX + leftWidth - SCROLLBAR_WIDTH, leftScrollTop, leftScrollHeight);

    this.layoutRightSlots(rightX, rightContentTop, rightWidth);

    if (this.cards.filter((c) => c.origin === 'pool').length === 0) {
      this.leftEmptyText
        .setPosition(leftX + 4, leftScrollTop + 8)
        .setVisible(true);
    } else {
      this.leftEmptyText.setVisible(false);
    }
  }

  private updateMasks(leftX: number, leftY: number, leftW: number, leftH: number, rightX: number, rightY: number, rightW: number, rightH: number): void {
    this.leftMaskGraphics.clear();
    this.leftMaskGraphics.fillStyle(0xffffff, 1);
    this.leftMaskGraphics.fillRect(leftX, leftY, leftW, leftH);
    this.rightMaskGraphics.clear();
    this.rightMaskGraphics.fillStyle(0xffffff, 1);
    this.rightMaskGraphics.fillRect(rightX, rightY, rightW, rightH);
  }

  private layoutLeftCards(leftX: number, leftY: number, leftWidth: number): { totalHeight: number } {
    const columns = Math.max(1, Math.floor((leftWidth + CARD_GAP_X) / (CARD_WIDTH + CARD_GAP_X)));
    const poolCards = this.cards.filter((c) => c.origin === 'pool');
    const rows = Math.ceil(poolCards.length / columns);
    const totalHeight = rows * (CARD_HEIGHT + CARD_GAP_Y);
    void leftX;
    void leftY;
    void poolCards;
    return { totalHeight };
  }

  private repositionLeftCards(leftX: number, leftY: number, leftWidth: number): void {
    const columns = Math.max(1, Math.floor((leftWidth + CARD_GAP_X) / (CARD_WIDTH + CARD_GAP_X)));
    const poolCards = this.cards.filter((c) => c.origin === 'pool');
    let i = 0;
    for (const card of poolCards) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = leftX + col * (CARD_WIDTH + CARD_GAP_X);
      const y = leftY + row * (CARD_HEIGHT + CARD_GAP_Y) - this.scrollOffset;
      this.placeCard(card, x, y, CARD_WIDTH, CARD_HEIGHT);
      i += 1;
    }
  }

  private layoutRightSlots(rightX: number, rightY: number, rightWidth: number): void {
    let cursor = rightY;
    for (const category of POLICY_SLOT_CATEGORIES) {
      const total = this.slotCounts[category];
      const heading = this.slotCategoryHeadings.get(category);
      if (!heading) continue;
      if (total === 0) {
        heading.setVisible(false);
        continue;
      }
      heading
        .setText(`${formatCategory(category)} (${this.countOccupiedSlots(category)} / ${total})`)
        .setPosition(rightX, cursor)
        .setVisible(true);
      cursor += 18;
      const cols = Math.max(1, Math.floor((rightWidth + SLOT_GAP) / (SLOT_CARD_WIDTH + SLOT_GAP)));
      let i = 0;
      for (const slotKey of this.slotKeysInOrder) {
        const slot = this.slotsByKey.get(slotKey);
        if (!slot || slot.category !== category) continue;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = rightX + col * (SLOT_CARD_WIDTH + SLOT_GAP);
        const y = cursor + row * (SLOT_CARD_HEIGHT + SLOT_GAP);
        this.placeSlot(slot, x, y);
        i += 1;
      }
      const rows = Math.ceil(total / cols);
      cursor += rows * (SLOT_CARD_HEIGHT + SLOT_GAP);
      cursor += SLOT_GROUP_GAP;
    }

    for (const slotKey of this.slotKeysInOrder) {
      const slot = this.slotsByKey.get(slotKey);
      if (!slot) continue;
      if (slot.occupiedBy === null) continue;
      const card = this.cards.find((c) => c.origin === 'slot' && c.slotKey === slotKey);
      if (!card) continue;
      this.placeCard(card, slot.background.x, slot.background.y, SLOT_CARD_WIDTH, SLOT_CARD_HEIGHT);
    }
  }

  private countOccupiedSlots(category: PolicySlotCategory): number {
    let count = 0;
    for (const slot of this.slotsByKey.values()) {
      if (slot.category === category && slot.occupiedBy !== null) count += 1;
    }
    return count;
  }

  private placeCard(card: CardVisual, x: number, y: number, w: number, h: number): void {
    placeCardParts({
      x,
      y,
      width: w,
      height: h,
      background: card.background,
      headerBackground: card.headerBackground,
      headerText: card.headerText,
      imageFrame: card.imageFrame,
      image: card.image,
      fallbackInitials: card.fallbackInitials,
      description: card.description,
    });
    card.hitArea.setPosition(x, y).setSize(w, h);
  }

  private placeSlot(slot: SlotVisual, x: number, y: number): void {
    slot.background.setPosition(x, y).setDisplaySize(SLOT_CARD_WIDTH, SLOT_CARD_HEIGHT);
    slot.label.setPosition(x + SLOT_CARD_WIDTH / 2, y + SLOT_CARD_HEIGHT / 2);
    slot.label.setVisible(slot.occupiedBy === null);
    slot.hitArea.setPosition(x, y).setSize(SLOT_CARD_WIDTH, SLOT_CARD_HEIGHT);
    this.updateSlotScreenRect(slot, x, y);
    this.refreshSlotVisual(slot);
  }

  private updateSlotScreenRect(slot: SlotVisual, x: number, y: number): void {
    const left = Math.max(x, this.rightAreaBounds.x);
    const top = Math.max(y, this.rightAreaBounds.y);
    const right = Math.min(x + SLOT_CARD_WIDTH, this.rightAreaBounds.right);
    const bottom = Math.min(y + SLOT_CARD_HEIGHT, this.rightAreaBounds.bottom);
    slot.screenRect.setTo(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
  }

  private refreshSlotVisual(slot: SlotVisual): void {
    if (slot.highlighted) {
      slot.background.setFillStyle(getCategoryFillColor(slot.category), 0.55);
      slot.background.setStrokeStyle(3, getCategoryStrokeColor(slot.category), 1);
    } else {
      slot.background.setFillStyle(getCategoryFillColor(slot.category), slot.occupiedBy ? 0.18 : 0.32);
      slot.background.setStrokeStyle(2, getCategoryStrokeColor(slot.category), slot.occupiedBy ? 0.6 : 0.85);
    }
  }

  private refreshCardVisual(card: CardVisual): void {
    const alpha = card.pressed ? 0.82 : card.hovered ? 1 : 0.96;
    card.background.setAlpha(alpha);
  }

  private applyScroll(delta: number): void {
    const clamped = Phaser.Math.Clamp(this.scrollOffset + delta, 0, this.maxScroll);
    if (clamped === this.scrollOffset) return;
    this.scrollOffset = clamped;
    this.layout();
  }

  private updateScrollState(totalHeight: number, visibleHeight: number): void {
    this.maxScroll = Math.max(0, totalHeight - visibleHeight);
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset, 0, this.maxScroll);
  }

  private updateScrollbar(trackX: number, trackY: number, trackHeight: number): void {
    if (this.maxScroll <= 0) {
      this.scrollbarTrack.setVisible(false);
      this.scrollbarThumb.setVisible(false);
      return;
    }
    const visibleHeight = trackHeight;
    const totalHeight = visibleHeight + this.maxScroll;
    const thumbHeight = Math.max(28, Math.round(trackHeight * (visibleHeight / totalHeight)));
    const travel = trackHeight - thumbHeight;
    const thumbY = trackY + (this.maxScroll > 0 ? (this.scrollOffset / this.maxScroll) * travel : 0);
    this.scrollbarTrack
      .setPosition(trackX, trackY)
      .setDisplaySize(SCROLLBAR_WIDTH, trackHeight)
      .setVisible(true);
    this.scrollbarThumb
      .setPosition(trackX, thumbY)
      .setDisplaySize(SCROLLBAR_WIDTH, thumbHeight)
      .setVisible(true);
  }

  private beginDrag(card: CardVisual, pointer: Phaser.Input.Pointer): void {
    if (this.dragState) this.cancelDrag();
    this.hideTooltip();
    const policy = this.unlockedPolicies.find((p) => p.id === card.policyId);
    if (!policy) return;

    const headerColor = getCategoryHeaderColor(card.category);
    const fillColor = getCategoryFillColor(card.category);
    const strokeColor = getCategoryStrokeColor(card.category);
    const ghostBg = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, CARD_WIDTH, CARD_HEIGHT, fillColor, 0.96))
      .setOrigin(0, 0)
      .setDepth(DRAG_GHOST_DEPTH)
      .setScrollFactor(0)
      .setStrokeStyle(2, strokeColor, 1);
    const ghostHeader = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, CARD_WIDTH, CARD_HEADER_HEIGHT, headerColor, 1))
      .setOrigin(0, 0)
      .setDepth(DRAG_GHOST_DEPTH + 1)
      .setScrollFactor(0);
    const ghostHeaderText = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, truncateText(policy.name, 18), {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#f4f1e7',
      fontStyle: 'bold',
    }))
      .setOrigin(0, 0.5)
      .setDepth(DRAG_GHOST_DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION);
    const ghostImageFrame = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, CARD_IMAGE_SIZE, CARD_IMAGE_SIZE, 0x0a141c, 0.95))
      .setOrigin(0.5, 0.5)
      .setDepth(DRAG_GHOST_DEPTH + 1)
      .setScrollFactor(0)
      .setStrokeStyle(1, strokeColor, 0.6);
    const imageKey = getPolicySpriteKey(policy.id);
    let ghostImage: Phaser.GameObjects.Image | null = null;
    if (this.scene.textures.exists(imageKey)) {
      ghostImage = this.addOwned(new Phaser.GameObjects.Image(this.scene, 0, 0, imageKey))
        .setOrigin(0.5, 0.5)
        .setDepth(DRAG_GHOST_DEPTH + 2)
        .setScrollFactor(0)
        .setDisplaySize(CARD_IMAGE_SIZE - 6, CARD_IMAGE_SIZE - 6);
    }
    const ghostFallbackInitials = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, getInitials(policy.name), {
      fontFamily: 'sans-serif',
      fontSize: '26px',
      color: '#f4f1e7',
      fontStyle: 'bold',
    }))
      .setOrigin(0.5, 0.5)
      .setDepth(DRAG_GHOST_DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(ghostImage === null);
    const ghostDescription = this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, truncateForCard(policy.description, CARD_DESCRIPTION_LINES + 1, 28), {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#dde7df',
      wordWrap: { width: CARD_WIDTH - 14, useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(DRAG_GHOST_DEPTH + 1)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION);

    this.dragState = {
      card,
      policy,
      pointerId: pointer.id,
      ghostBg,
      ghostHeader,
      ghostHeaderText,
      ghostImageFrame,
      ghostImage,
      ghostFallbackInitials,
      ghostDescription,
      hoveredSlotKey: null,
    };

    this.updateGhostPosition(pointer.x, pointer.y);
  }

  private updateGhostPosition(x: number, y: number): void {
    if (!this.dragState) return;
    placeCardParts({
      x: x - CARD_WIDTH / 2,
      y: y - CARD_HEIGHT / 2,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      background: this.dragState.ghostBg,
      headerBackground: this.dragState.ghostHeader,
      headerText: this.dragState.ghostHeaderText,
      imageFrame: this.dragState.ghostImageFrame,
      image: this.dragState.ghostImage,
      fallbackInitials: this.dragState.ghostFallbackInitials,
      description: this.dragState.ghostDescription,
    });
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.dragState && this.dragState.pointerId === pointer.id) {
      this.updateGhostPosition(pointer.x, pointer.y);
      this.updateDragHover(pointer.x, pointer.y);
      return;
    }
    if (this.tooltipPointer && this.tooltipPointer.id === pointer.id && this.tooltipBackground.visible) {
      this.positionTooltip(pointer);
    }
  }

  private updateDragHover(x: number, y: number): void {
    if (!this.dragState) return;
    const nextKey = this.getDropSlotKeyAt(x, y, this.dragState.policy);
    if (nextKey === this.dragState.hoveredSlotKey) return;
    if (this.dragState.hoveredSlotKey) {
      const prev = this.slotsByKey.get(this.dragState.hoveredSlotKey);
      if (prev) {
        prev.highlighted = false;
        this.refreshSlotVisual(prev);
      }
    }
    this.dragState.hoveredSlotKey = nextKey;
    if (nextKey) {
      const next = this.slotsByKey.get(nextKey);
      if (next) {
        next.highlighted = true;
        this.refreshSlotVisual(next);
      }
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.dragState || this.dragState.pointerId !== pointer.id) {
      return;
    }
    consumePointerEvent(pointer);
    const drag = this.dragState;
    const targetSlotKey = this.getDropSlotKeyAt(pointer.x, pointer.y, drag.policy);
    const droppedOnLeftArea = this.leftAreaBounds.contains(pointer.x, pointer.y);

    let didChange = false;
    const nationId = this.getNationId();

    if (nationId && targetSlotKey) {
      didChange = this.handleDropOnSlot(nationId, drag.card, drag.policy, targetSlotKey);
    } else if (nationId && drag.card.origin === 'slot' && droppedOnLeftArea) {
      didChange = this.policySystem.deactivatePolicy(nationId, drag.policy.id);
    }

    this.cancelDrag();
    this.worldInputGate.releasePointer(pointer.id);

    if (didChange && nationId) {
      this.onPoliciesChanged?.(nationId);
      this.refresh();
    }
  }

  private handleActiveDragPointerUp(pointer: Phaser.Input.Pointer, event: Phaser.Types.Input.EventData): boolean {
    if (!this.dragState || this.dragState.pointerId !== pointer.id) return false;

    this.onPointerUp(pointer);
    event.stopPropagation();
    return true;
  }

  private getDropSlotKeyAt(x: number, y: number, policy: PolicyDefinition): string | null {
    for (const slotKey of this.slotKeysInOrder) {
      const slot = this.slotsByKey.get(slotKey);
      if (!slot) continue;
      if (!slot.screenRect.contains(x, y)) continue;
      if (!isPolicySlotCompatible(policy.category, slot.category)) continue;
      return slot.key;
    }
    return null;
  }

  private handleDropOnSlot(nationId: string, card: CardVisual, policy: PolicyDefinition, targetSlotKey: string): boolean {
    const slot = this.slotsByKey.get(targetSlotKey);
    if (!slot) return false;
    if (!isPolicySlotCompatible(policy.category, slot.category)) return false;

    if (card.origin === 'slot' && card.slotKey === targetSlotKey) return false;

    const occupiedBy = slot.occupiedBy;
    if (occupiedBy === null) {
      if (card.origin === 'slot') {
        if (!this.policySystem.deactivatePolicy(nationId, policy.id)) return false;
      }
      return this.policySystem.activatePolicy(nationId, policy.id, slot.category);
    }

    if (occupiedBy === policy.id) return false;
    if (card.origin === 'slot') {
      return this.swapActivePolicies(nationId, card, policy, occupiedBy, slot.category);
    }
    return this.policySystem.replacePolicy(nationId, occupiedBy, policy.id, slot.category);
  }

  private swapActivePolicies(
    nationId: string,
    card: CardVisual,
    policy: PolicyDefinition,
    occupiedPolicyId: string,
    targetSlotCategory: PolicySlotCategory,
  ): boolean {
    if (!card.slotKey) return false;
    const sourceSlot = this.slotsByKey.get(card.slotKey);
    if (!sourceSlot) return false;

    const occupiedPolicy = this.unlockedPolicies.find((entry) => entry.id === occupiedPolicyId);
    if (!occupiedPolicy) return false;
    if (!isPolicySlotCompatible(occupiedPolicy.category, sourceSlot.category)) return false;

    if (!this.policySystem.deactivatePolicy(nationId, policy.id)) return false;
    if (!this.policySystem.replacePolicy(nationId, occupiedPolicyId, policy.id, targetSlotCategory)) {
      this.policySystem.activatePolicy(nationId, policy.id, sourceSlot.category);
      return false;
    }
    if (!this.policySystem.activatePolicy(nationId, occupiedPolicyId, sourceSlot.category)) {
      this.policySystem.replacePolicy(nationId, policy.id, occupiedPolicyId, targetSlotCategory);
      this.policySystem.activatePolicy(nationId, policy.id, sourceSlot.category);
      return false;
    }
    return true;
  }

  private cancelDrag(): void {
    if (!this.dragState) return;
    if (this.dragState.hoveredSlotKey) {
      const slot = this.slotsByKey.get(this.dragState.hoveredSlotKey);
      if (slot) {
        slot.highlighted = false;
        this.refreshSlotVisual(slot);
      }
    }
    this.dragState.ghostBg.destroy();
    this.dragState.ghostHeader.destroy();
    this.dragState.ghostHeaderText.destroy();
    this.dragState.ghostImageFrame.destroy();
    this.dragState.ghostImage?.destroy();
    this.dragState.ghostFallbackInitials.destroy();
    this.dragState.ghostDescription.destroy();
    this.dragState.card.pressed = false;
    this.refreshCardVisual(this.dragState.card);
    this.dragState = null;
  }

  private scheduleTooltip(card: CardVisual, pointer: Phaser.Input.Pointer): void {
    this.hoveredCard = card;
    this.tooltipPointer = pointer;
    if (this.tooltipTimer) {
      clearTimeout(this.tooltipTimer);
      this.tooltipTimer = null;
    }
    this.tooltipTimer = setTimeout(() => {
      if (this.hoveredCard !== card || !this.tooltipPointer) return;
      this.showTooltip(card, this.tooltipPointer);
    }, TOOLTIP_DELAY_MS);
  }

  private showTooltip(card: CardVisual, pointer: Phaser.Input.Pointer): void {
    const policy = this.unlockedPolicies.find((p) => p.id === card.policyId);
    if (!policy) return;
    this.tooltipText.setText(`${policy.name}\n${policy.description}`);
    const w = this.tooltipText.width + TOOLTIP_PADDING_X * 2;
    const h = this.tooltipText.height + TOOLTIP_PADDING_Y * 2;
    this.tooltipBackground
      .setDisplaySize(w, h)
      .setVisible(true);
    this.tooltipText.setVisible(true);
    this.positionTooltip(pointer);
  }

  private positionTooltip(pointer: Phaser.Input.Pointer): void {
    const w = this.tooltipBackground.displayWidth;
    const h = this.tooltipBackground.displayHeight;
    const maxX = this.scene.scale.width - w - 8;
    const maxY = this.scene.scale.height - h - 8;
    const x = Math.max(8, Math.min(maxX, pointer.x + 14));
    const y = Math.max(8, Math.min(maxY, pointer.y + 16));
    this.tooltipBackground.setPosition(x, y);
    this.tooltipText.setPosition(x + TOOLTIP_PADDING_X, y + TOOLTIP_PADDING_Y);
  }

  private hideTooltip(): void {
    if (this.tooltipTimer) {
      clearTimeout(this.tooltipTimer);
      this.tooltipTimer = null;
    }
    this.tooltipPointer = null;
    this.tooltipBackground.setVisible(false);
    this.tooltipText.setVisible(false);
  }
}

function getCategoryFillColor(category: PolicySlotCategory): number {
  switch (category) {
    case 'military':
      return 0x274b78;
    case 'economic':
      return 0x2c5e3a;
    case 'diplomatic':
      return 0x7a3a8b;
    case 'ideology':
      return 0x7a3f24;
    case 'wildcard':
      return 0x3b3b3b;
  }
}

function getCategoryHeaderColor(category: PolicySlotCategory): number {
  switch (category) {
    case 'military':
      return 0x1d3b62;
    case 'economic':
      return 0x214e2c;
    case 'diplomatic':
      return 0x652d75;
    case 'ideology':
      return 0x613119;
    case 'wildcard':
      return 0x202020;
  }
}

function getCategoryStrokeColor(category: PolicySlotCategory): number {
  switch (category) {
    case 'military':
      return 0x9bbbe6;
    case 'economic':
      return 0x9fdbac;
    case 'diplomatic':
      return 0xd6a3df;
    case 'ideology':
      return 0xe3a172;
    case 'wildcard':
      return 0xaaaaaa;
  }
}

function getCategoryHexColor(category: PolicySlotCategory): string {
  switch (category) {
    case 'military':
      return '#9bbbe6';
    case 'economic':
      return '#9fdbac';
    case 'diplomatic':
      return '#d6a3df';
    case 'ideology':
      return '#e3a172';
    case 'wildcard':
      return '#cccccc';
  }
}

function formatCategory(category: PolicySlotCategory): string {
  switch (category) {
    case 'military':
      return 'Military';
    case 'economic':
      return 'Economic';
    case 'diplomatic':
      return 'Diplomatic';
    case 'ideology':
      return 'Ideology';
    case 'wildcard':
      return 'Wildcard';
  }
}

interface CardParts {
  x: number;
  y: number;
  width: number;
  height: number;
  background: Phaser.GameObjects.Rectangle;
  headerBackground: Phaser.GameObjects.Rectangle;
  headerText: Phaser.GameObjects.Text;
  imageFrame: Phaser.GameObjects.Rectangle;
  image: Phaser.GameObjects.Image | null;
  fallbackInitials: Phaser.GameObjects.Text;
  description: Phaser.GameObjects.Text;
}

function placeCardParts(parts: CardParts): void {
  const frameSize = parts.imageFrame.width;
  const imageCenterX = parts.x + parts.width / 2;
  const imageCenterY = parts.y + CARD_HEADER_HEIGHT + 8 + frameSize / 2;

  parts.background.setPosition(parts.x, parts.y).setDisplaySize(parts.width, parts.height);
  parts.headerBackground.setPosition(parts.x, parts.y).setDisplaySize(parts.width, CARD_HEADER_HEIGHT);
  parts.headerText.setPosition(parts.x + 8, parts.y + CARD_HEADER_HEIGHT / 2);
  parts.imageFrame.setPosition(imageCenterX, imageCenterY);
  parts.image?.setPosition(imageCenterX, imageCenterY);
  parts.fallbackInitials.setPosition(imageCenterX, imageCenterY);
  parts.description.setPosition(parts.x + 7, imageCenterY + frameSize / 2 + 8);
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1))}…`;
}

function truncateForCard(text: string, maxLines: number, charsPerLine: number): string {
  const max = maxLines * charsPerLine;
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1))}…`;
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
