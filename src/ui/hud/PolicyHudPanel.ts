import Phaser from 'phaser';
import type { PolicySystem } from '../../systems/PolicySystem';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import type { ActivePolicyAssignment, PolicySlotCounts } from '../../entities/NationPolicies';
import type { PolicyCategory, PolicyDefinition } from '../../types/policy';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';
import { CircularHudProgressButton } from './CircularHudProgressButton';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

const DEPTH = 140;
const EDGE_MARGIN = 16;
const TOGGLE_SIZE = 102;
const TOGGLE_HIT_SIZE = 122;
const TOGGLE_GAP = 14;
const RESEARCH_TOGGLE_Y = EDGE_MARGIN + 46;
const CULTURE_TOGGLE_Y = RESEARCH_TOGGLE_Y + TOGGLE_SIZE + TOGGLE_GAP;
const POLICY_TOGGLE_X = EDGE_MARGIN + TOGGLE_SIZE + TOGGLE_GAP;
const SHARED_PANEL_Y = CULTURE_TOGGLE_Y + TOGGLE_SIZE + 12;
const PANEL_WIDTH = 560;
const PANEL_INNER_PADDING = 20;
const PANEL_MASK_PADDING = 10;
const PANEL_MIN_HEIGHT = 210;
const PANEL_BOTTOM_PADDING = 22;
const PANEL_SCROLLBAR_WIDTH = 10;
const PANEL_SCROLLBAR_GAP = 12;
const PANEL_CONTENT_WIDTH = PANEL_WIDTH - (PANEL_INNER_PADDING * 2) - PANEL_SCROLLBAR_WIDTH - PANEL_SCROLLBAR_GAP;
const LINE_HEIGHT = 27;
const SLOT_ROW_HEIGHT = 28;
const POLICY_ROW_HEIGHT = 104;
const POLICY_ROW_GAP = 10;
const SECTION_GAP = 16;
const ACTION_BUTTON_WIDTH = 84;
const ACTION_BUTTON_HEIGHT = 30;
const SCROLL_STEP = 56;
const HUD_TEXT_RESOLUTION = getHudTextResolution();

const POLICY_CATEGORIES: readonly PolicyCategory[] = ['economic', 'military', 'diplomatic', 'wildcard'];

interface PolicyRowView {
  readonly policyId: string;
  readonly background: Phaser.GameObjects.Rectangle;
  readonly categoryText: Phaser.GameObjects.Text;
  readonly nameText: Phaser.GameObjects.Text;
  readonly detailText: Phaser.GameObjects.Text;
  readonly descriptionText: Phaser.GameObjects.Text;
  readonly actionBackground: Phaser.GameObjects.Rectangle;
  readonly actionText: Phaser.GameObjects.Text;
  hovered: boolean;
  pressed: boolean;
}

export class PolicyHudPanel {
  private readonly wheelBlockerId = `policy-panel-wheel-${Math.random().toString(36).slice(2)}`;
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
  private readonly slotHeading: Phaser.GameObjects.Text;
  private readonly activeHeading: Phaser.GameObjects.Text;
  private readonly availableHeading: Phaser.GameObjects.Text;
  private readonly emptyActiveText: Phaser.GameObjects.Text;
  private readonly emptyAvailableText: Phaser.GameObjects.Text;
  private readonly slotRows: Phaser.GameObjects.Text[] = [];
  private readonly activeRows: PolicyRowView[] = [];
  private readonly availableRows: PolicyRowView[] = [];
  private readonly handleWheel: (
    pointer: Phaser.Input.Pointer,
    gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
    deltaZ: number,
    event: WheelEvent,
  ) => void;

  private collapsed = true;
  private scrollOffset = 0;
  private maxScroll = 0;
  private panelBounds = new Phaser.Geom.Rectangle();
  private slotCounts: PolicySlotCounts = { economic: 0, military: 0, diplomatic: 0, wildcard: 0 };
  private activeAssignments: ActivePolicyAssignment[] = [];
  private activePolicies: PolicyDefinition[] = [];
  private availablePolicies: PolicyDefinition[] = [];
  private onToggle: ((collapsed: boolean) => void) | null = null;
  private onPoliciesChanged: ((nationId: string) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    addOwned: AddOwned,
    private readonly worldInputGate: WorldInputGate,
    private readonly policySystem: PolicySystem,
    private readonly getNationId: () => string | undefined,
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
      icon: '⚖',
      iconSize: 42,
      progressColor: 0x86efac,
      accentColor: 0x94d3a2,
    });
    this.toggleButton.setTooltip('Policies');
    this.toggleButton.setOnClick(() => {
      this.setCollapsed(!this.collapsed);
      this.onToggle?.(this.collapsed);
      if (!this.collapsed) this.refresh();
    });

    this.panelBackground = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, PANEL_WIDTH, 100, 0x08120d, 0.9))
      .setOrigin(0, 0)
      .setDepth(DEPTH)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0x9fddb2, 0.45);
    this.scrollbarTrack = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, PANEL_SCROLLBAR_WIDTH, 10, 0x16251b, 0.9))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0);
    this.scrollbarThumb = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, PANEL_SCROLLBAR_WIDTH, 32, 0x96d9a8, 0.95))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0);

    this.contentMaskGraphics = new Phaser.GameObjects.Graphics(scene);
    this.contentMask = this.contentMaskGraphics.createGeometryMask();

    this.titleText = this.createMaskedText('Policies', 24, '#f2fbf4', 'bold');
    this.slotHeading = this.createMaskedText('Slots', 16, '#9fc9aa', 'bold');
    this.activeHeading = this.createMaskedText('Active Policies', 16, '#9fc9aa', 'bold');
    this.availableHeading = this.createMaskedText('Available Policies', 16, '#9fc9aa', 'bold');
    this.emptyActiveText = this.createMaskedText('No active policies.', 15, '#b9c8bc');
    this.emptyAvailableText = this.createMaskedText('No unlocked inactive policies.', 15, '#b9c8bc');

    for (const category of POLICY_CATEGORIES) {
      this.slotRows.push(this.createMaskedText('', 15, getCategoryColor(category)));
    }

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

    this.refreshToggleState();
    this.refresh();
  }

  refresh(): void {
    const nationId = this.getNationId();
    if (!nationId) {
      this.slotCounts = { economic: 0, military: 0, diplomatic: 0, wildcard: 0 };
      this.activeAssignments = [];
      this.activePolicies = [];
      this.availablePolicies = [];
    } else {
      this.slotCounts = this.policySystem.getSlotCounts(nationId);
      this.activeAssignments = this.policySystem.getActivePolicyAssignments(nationId);
      this.activePolicies = this.policySystem.getActivePolicies(nationId);
      const activePolicyIds = new Set(this.activeAssignments.map((assignment) => assignment.policyId));
      this.availablePolicies = this.policySystem
        .getUnlockedPolicies(nationId)
        .filter((policy) => !activePolicyIds.has(policy.id));
    }

    this.rebuildRows();
    this.layout(this.scene.scale.width, this.scene.scale.height);
  }

  setOnToggle(handler: (collapsed: boolean) => void): void {
    this.onToggle = handler;
  }

  setOnPoliciesChanged(handler: (nationId: string) => void): void {
    this.onPoliciesChanged = handler;
  }

  setCollapsed(collapsed: boolean): void {
    if (this.collapsed === collapsed) return;
    this.collapsed = collapsed;
    if (!collapsed) this.refresh();
    this.layout(this.scene.scale.width, this.scene.scale.height);
    this.refreshToggleState();
  }

  isOpen(): boolean {
    return !this.collapsed;
  }

  layout(viewportWidth: number, viewportHeight: number): void {
    this.toggleButton.layout(POLICY_TOGGLE_X, CULTURE_TOGGLE_Y);

    const panelVisible = !this.collapsed;
    this.blocker.setVisible(panelVisible).setPosition(0, 0).setSize(viewportWidth, viewportHeight);
    this.panelBackground.setVisible(panelVisible);

    const panelX = EDGE_MARGIN;
    const panelY = SHARED_PANEL_Y;
    const availableHeight = Math.max(PANEL_MIN_HEIGHT, viewportHeight - panelY - EDGE_MARGIN);
    this.panelBounds.setTo(panelX, panelY, PANEL_WIDTH, availableHeight);

    const contentX = panelX + PANEL_INNER_PADDING;
    const baseY = panelY + 18 - this.scrollOffset;
    let contentCursor = 0;

    this.titleText.setVisible(panelVisible).setPosition(Math.round(contentX), Math.round(baseY + contentCursor));
    contentCursor += LINE_HEIGHT + 8;

    this.slotHeading.setVisible(panelVisible).setPosition(Math.round(contentX), Math.round(baseY + contentCursor));
    contentCursor += LINE_HEIGHT;

    const usedSlots = getUsedSlotCounts(this.activeAssignments);
    for (const [index, category] of POLICY_CATEGORIES.entries()) {
      const total = this.slotCounts[category];
      const used = usedSlots[category];
      const row = this.slotRows[index];
      row
        .setText(`${getCategoryIcon(category)} ${formatCategory(category)}: ${used} / ${total}`)
        .setColor(used < total ? getCategoryColor(category) : '#fca5a5')
        .setVisible(panelVisible)
        .setPosition(Math.round(contentX), Math.round(baseY + contentCursor));
      contentCursor += SLOT_ROW_HEIGHT;
    }

    contentCursor += SECTION_GAP;
    this.activeHeading.setVisible(panelVisible).setPosition(Math.round(contentX), Math.round(baseY + contentCursor));
    contentCursor += LINE_HEIGHT;

    if (this.activeRows.length === 0) {
      this.emptyActiveText.setVisible(panelVisible).setPosition(Math.round(contentX), Math.round(baseY + contentCursor));
      contentCursor += LINE_HEIGHT + 2;
    } else {
      this.emptyActiveText.setVisible(false);
      for (const row of this.activeRows) {
        this.layoutPolicyRow(row, contentX, baseY + contentCursor, panelVisible);
        contentCursor += POLICY_ROW_HEIGHT + POLICY_ROW_GAP;
      }
    }

    contentCursor += SECTION_GAP;
    this.availableHeading.setVisible(panelVisible).setPosition(Math.round(contentX), Math.round(baseY + contentCursor));
    contentCursor += LINE_HEIGHT;

    if (this.availableRows.length === 0) {
      this.emptyAvailableText.setVisible(panelVisible).setPosition(Math.round(contentX), Math.round(baseY + contentCursor));
      contentCursor += LINE_HEIGHT + 2;
    } else {
      this.emptyAvailableText.setVisible(false);
      for (const row of this.availableRows) {
        this.layoutPolicyRow(row, contentX, baseY + contentCursor, panelVisible);
        contentCursor += POLICY_ROW_HEIGHT + POLICY_ROW_GAP;
      }
    }

    contentCursor += PANEL_BOTTOM_PADDING;
    const fullContentHeight = contentCursor + 18;
    const panelHeight = Math.min(Math.max(PANEL_MIN_HEIGHT, fullContentHeight), availableHeight);
    this.panelBounds.height = panelHeight;
    this.panelBackground
      .setPosition(Math.round(panelX), Math.round(panelY))
      .setDisplaySize(PANEL_WIDTH, Math.round(panelHeight));

    this.updateMask(panelX, panelY, panelHeight);
    this.updateScrollState(fullContentHeight, panelHeight);
    this.updateScrollbar(panelVisible, panelX, panelY, panelHeight);
    this.refreshMaskedContentVisibility(panelVisible);
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
    this.worldInputGate.unregisterWheelBlocker(this.wheelBlockerId);
    this.blocker.destroy();
    this.toggleButton.destroy();
    this.panelBackground.destroy();
    this.scrollbarTrack.destroy();
    this.scrollbarThumb.destroy();
    this.contentMaskGraphics.destroy();
    this.titleText.destroy();
    this.slotHeading.destroy();
    this.activeHeading.destroy();
    this.availableHeading.destroy();
    this.emptyActiveText.destroy();
    this.emptyAvailableText.destroy();
    for (const row of this.slotRows) row.destroy();
    this.destroyRows(this.activeRows);
    this.destroyRows(this.availableRows);
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

  private rebuildRows(): void {
    this.destroyRows(this.activeRows);
    this.destroyRows(this.availableRows);

    const activePolicyById = new Map(this.activePolicies.map((policy) => [policy.id, policy]));
    for (const assignment of this.activeAssignments) {
      const policy = activePolicyById.get(assignment.policyId);
      if (!policy) continue;
      this.activeRows.push(this.createPolicyRow(policy, 'Remove', assignment.slotCategory, () => {
        const nationId = this.getNationId();
        if (!nationId) return;
        if (!this.policySystem.deactivatePolicy(nationId, policy.id)) {
          console.warn(`[PolicyHudPanel] Failed to deactivate policy: ${policy.id}`);
          return;
        }
        this.onPoliciesChanged?.(nationId);
        this.refresh();
      }));
    }

    for (const policy of this.availablePolicies) {
      this.availableRows.push(this.createPolicyRow(policy, 'Activate', undefined, () => {
        const nationId = this.getNationId();
        if (!nationId) return;
        if (!this.policySystem.activatePolicy(nationId, policy.id)) {
          console.warn(`[PolicyHudPanel] Failed to activate policy: ${policy.id}`);
          return;
        }
        this.onPoliciesChanged?.(nationId);
        this.refresh();
      }));
    }
  }

  private createPolicyRow(
    policy: PolicyDefinition,
    actionLabel: string,
    slotCategory: PolicyCategory | undefined,
    action: () => void,
  ): PolicyRowView {
    const background = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, PANEL_CONTENT_WIDTH, POLICY_ROW_HEIGHT, 0x17271d, 0.96))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setStrokeStyle(1, getCategoryStroke(policy.category), 0.48)
      .setMask(this.contentMask);
    const categoryText = this.createMaskedText(getCategoryIcon(policy.category), 14, getCategoryColor(policy.category), 'bold');
    const nameText = this.createMaskedText(policy.name, 17, '#ecfdf0', 'bold', PANEL_CONTENT_WIDTH - ACTION_BUTTON_WIDTH - 28);
    const detailText = this.createMaskedText(
      slotCategory ? `${formatCategory(policy.category)} in ${formatCategory(slotCategory)} slot` : formatCategory(policy.category),
      13,
      '#9fc9aa',
      'normal',
      PANEL_CONTENT_WIDTH - ACTION_BUTTON_WIDTH - 28,
    );
    const descriptionText = this.createMaskedText(policy.description, 14, '#cbd7ce', 'normal', PANEL_CONTENT_WIDTH - ACTION_BUTTON_WIDTH - 28);
    const actionBackground = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, ACTION_BUTTON_WIDTH, ACTION_BUTTON_HEIGHT, 0x244d31, 0.98))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 3)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0xa7f3b9, 0.55)
      .setInteractive({ useHandCursor: true })
      .setMask(this.contentMask);
    const actionText = this.createMaskedText(actionLabel, 13, '#effff2', 'bold');

    const row: PolicyRowView = {
      policyId: policy.id,
      background,
      categoryText,
      nameText,
      detailText,
      descriptionText,
      actionBackground,
      actionText,
      hovered: false,
      pressed: false,
    };

    actionBackground.on(Phaser.Input.Events.POINTER_OVER, (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      row.hovered = true;
      this.refreshPolicyRowVisual(row);
    });
    actionBackground.on(Phaser.Input.Events.POINTER_OUT, (
      _pointer: Phaser.Input.Pointer,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      row.hovered = false;
      row.pressed = false;
      this.refreshPolicyRowVisual(row);
    });
    actionBackground.on(Phaser.Input.Events.POINTER_DOWN, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      this.worldInputGate.claimPointer(pointer.id);
      row.pressed = true;
      consumePointerEvent(pointer);
      this.refreshPolicyRowVisual(row);
    });
    actionBackground.on(Phaser.Input.Events.POINTER_UP, (
      pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      consumePointerEvent(pointer);
      const shouldAct = row.pressed;
      row.pressed = false;
      this.worldInputGate.releasePointer(pointer.id);
      if (shouldAct) action();
      this.refreshPolicyRowVisual(row);
    });

    this.contentObjects.push(background, actionBackground);
    this.refreshPolicyRowVisual(row);
    return row;
  }

  private layoutPolicyRow(row: PolicyRowView, contentX: number, rowY: number, panelVisible: boolean): void {
    const textX = contentX + 54;
    const actionX = contentX + PANEL_CONTENT_WIDTH - ACTION_BUTTON_WIDTH - 12;
    const actionY = rowY + Math.round((POLICY_ROW_HEIGHT - ACTION_BUTTON_HEIGHT) / 2);

    row.background.setVisible(panelVisible)
      .setPosition(Math.round(contentX), Math.round(rowY))
      .setDisplaySize(PANEL_CONTENT_WIDTH, POLICY_ROW_HEIGHT);
    row.categoryText.setVisible(panelVisible)
      .setPosition(Math.round(contentX + 14), Math.round(rowY + 14));
    row.nameText.setVisible(panelVisible)
      .setPosition(Math.round(textX), Math.round(rowY + 12));
    row.detailText.setVisible(panelVisible)
      .setPosition(Math.round(textX), Math.round(rowY + 36));
    row.descriptionText.setVisible(panelVisible)
      .setPosition(Math.round(textX), Math.round(rowY + 59));
    row.actionBackground.setVisible(panelVisible)
      .setPosition(Math.round(actionX), Math.round(actionY))
      .setDisplaySize(ACTION_BUTTON_WIDTH, ACTION_BUTTON_HEIGHT);
    row.actionText.setVisible(panelVisible)
      .setPosition(
        Math.round(actionX + (ACTION_BUTTON_WIDTH - row.actionText.width) / 2),
        Math.round(actionY + (ACTION_BUTTON_HEIGHT - row.actionText.height) / 2),
      );
  }

  private destroyRows(rows: PolicyRowView[]): void {
    for (const row of rows) {
      const objects = [
        row.background,
        row.categoryText,
        row.nameText,
        row.detailText,
        row.descriptionText,
        row.actionBackground,
        row.actionText,
      ];
      for (const object of objects) {
        const index = this.contentObjects.indexOf(object);
        if (index >= 0) this.contentObjects.splice(index, 1);
        object.destroy();
      }
    }
    rows.length = 0;
  }

  private applyScroll(delta: number): void {
    const clamped = Phaser.Math.Clamp(this.scrollOffset + delta, 0, this.maxScroll);
    if (clamped === this.scrollOffset) return;
    this.scrollOffset = clamped;
    this.layout(this.scene.scale.width, this.scene.scale.height);
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

    this.scrollbarTrack
      .setPosition(Math.round(trackX), Math.round(trackY))
      .setDisplaySize(PANEL_SCROLLBAR_WIDTH, Math.round(trackHeight));
    this.scrollbarThumb
      .setPosition(Math.round(trackX), Math.round(thumbY))
      .setDisplaySize(PANEL_SCROLLBAR_WIDTH, Math.round(thumbHeight));
  }

  private refreshMaskedContentVisibility(panelVisible: boolean): void {
    for (const object of this.contentObjects) {
      (object as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible).setVisible(panelVisible);
    }
  }

  private refreshToggleState(): void {
    this.toggleButton.setActive(!this.collapsed);
  }

  private refreshPolicyRowVisual(row: PolicyRowView): void {
    if (row.pressed) {
      row.actionBackground.setFillStyle(0x1f6a3d, 0.98).setScale(0.985);
      return;
    }
    if (row.hovered) {
      row.actionBackground.setFillStyle(0x2f7a49, 1).setScale(1.02);
      return;
    }
    row.actionBackground.setFillStyle(0x244d31, 0.98).setScale(1);
  }
}

function getUsedSlotCounts(assignments: readonly ActivePolicyAssignment[]): PolicySlotCounts {
  const counts = { economic: 0, military: 0, diplomatic: 0, wildcard: 0 };
  for (const assignment of assignments) {
    counts[assignment.slotCategory] += 1;
  }
  return counts;
}

function formatCategory(category: PolicyCategory): string {
  switch (category) {
    case 'economic':
      return 'Economic';
    case 'military':
      return 'Military';
    case 'diplomatic':
      return 'Diplomatic';
    case 'wildcard':
      return 'Wildcard';
  }
}

function getCategoryIcon(category: PolicyCategory): string {
  switch (category) {
    case 'economic':
      return '[ECO]';
    case 'military':
      return '[MIL]';
    case 'diplomatic':
      return '[DIP]';
    case 'wildcard':
      return '[WILD]';
  }
}

function getCategoryColor(category: PolicyCategory): string {
  switch (category) {
    case 'economic':
      return '#a7f3d0';
    case 'military':
      return '#fca5a5';
    case 'diplomatic':
      return '#93c5fd';
    case 'wildcard':
      return '#f5d38b';
  }
}

function getCategoryStroke(category: PolicyCategory): number {
  switch (category) {
    case 'economic':
      return 0xa7f3d0;
    case 'military':
      return 0xfca5a5;
    case 'diplomatic':
      return 0x93c5fd;
    case 'wildcard':
      return 0xf5d38b;
  }
}

function getHudTextResolution(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}
