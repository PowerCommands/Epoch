import Phaser from 'phaser';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';
import type { RightSidebarPanelDataProvider } from './RightSidebarPanelDataProvider';
import type {
  RightSidebarButtonRow,
  RightSidebarCityDetailsTab,
  RightSidebarContent,
  RightSidebarLeaderDetailsTab,
  RightSidebarLeaderboardCategory,
  RightSidebarPanelMode,
  RightSidebarRelationsTableRow,
  RightSidebarCompactTableRow,
  RightSidebarButtonGroupRow,
  RightSidebarRow,
  RightSidebarSearchInputRow,
  RightSidebarSelectRow,
  RightSidebarSection,
  RightSidebarTextRow,
  RightSidebarGridRow,
} from './RightSidebarPanelTypes';
import { resolveTradingTabId } from './RightSidebarPanelTypes';
import type { DiplomacyRelationshipType } from './DiplomacyGraphTypes';

interface ModeDefinition {
  mode: RightSidebarPanelMode;
  icon: string;
  label: string;
  accentColor: number;
  diagnosticOnly?: boolean;
}

interface ModeButton {
  definition: ModeDefinition;
  background: Phaser.GameObjects.Arc;
  rim: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  hitArea: Phaser.GameObjects.Zone;
  hovered: boolean;
  pressed: boolean;
  visible: boolean;
}

interface ContentButton {
  row: RightSidebarButtonRow;
  background: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image | null;
  label: Phaser.GameObjects.Text;
  trailingLabel: Phaser.GameObjects.Text | null;
  hitArea: Phaser.GameObjects.Zone;
  baseY: number;
  hovered: boolean;
  pressed: boolean;
}

interface ContentInput {
  element: HTMLInputElement | HTMLSelectElement;
  baseY: number;
  height: number;
  x: number;
  width: number;
}

const DEPTH = 1200;
const EDGE_MARGIN = 16;
const PANEL_WIDTH = 778;
const LEADERBOARD_PANEL_WIDTH = 1110;
/** Trading spreads its Buy/Sell/nation content wide — up to half the viewport. */
const TRADING_PANEL_WIDTH_FRACTION = 0.5;
const PANEL_TOP = 124;
const PANEL_BOTTOM_MARGIN = 22;
const PANEL_PADDING = 24;
const CONTENT_TOP = 74;
const CONTENT_BOTTOM_GAP = 16;
const CONTENT_WIDTH = PANEL_WIDTH - PANEL_PADDING * 2;
const BUTTON_DIAMETER = 64;
const BUTTON_RADIUS = BUTTON_DIAMETER / 2;
const BUTTON_HIT_SIZE = 78;
const BUTTON_GAP = 18;
const BUTTON_ROW_TOP = 32;
const BUTTON_LABEL_OFFSET = 48;
const COLLAPSE_WIDTH = 180;
const COLLAPSE_HEIGHT = 42;
const SECTION_GAP = 18;
const ROW_GAP = 8;
const SCROLL_STEP = 52;
const SCROLLBAR_WIDTH = 12;
const SCROLLBAR_MARGIN = 8;
const SCROLLBAR_MIN_THUMB_HEIGHT = 28;
const WHEEL_BLOCKER_ID = 'right-sidebar-panel';
const LEADERBOARD_TAB_GAP = 8;
const LEADERBOARD_TAB_HEIGHT = 34;
/** Trading tabs are taller so their labels have vertical breathing room. */
const TRADING_TAB_HEIGHT = 44;
/** Horizontal padding on each side of a trading tab's label (tab hugs its text). */
const TRADING_TAB_PAD_X = 18;
const CITY_TAB_GAP = 8;
const CITY_TAB_HEIGHT = 34;
const LEADER_TAB_GAP = 8;
const LEADER_TAB_HEIGHT = 34;
const CONTENT_ICON_SIZE = 32;
const CONTENT_ICON_GAP = 8;
const LOG_COPY_BUTTON_WIDTH = 148;
const LOG_COPY_BUTTON_HEIGHT = 40;

const MODES: ModeDefinition[] = [
  { mode: 'details', icon: '🔍', label: 'Details', accentColor: 0x6ec6ff },
  { mode: 'leaderboard', icon: '🏆', label: 'Leaderboard', accentColor: 0xf4d06f },
  { mode: 'trading', icon: '⚖️', label: 'Trading', accentColor: 0x7fc8a9 },
  { mode: 'diplomacy-graph', icon: '🕸️', label: 'Diplomacy', accentColor: 0xa78bfa },
];

/**
 * Fixed Trading tabs shown before the dynamic per-nation tabs: Overview shows the
 * summary and live activity, Buy lists importable goods, Sell lists exportable ones.
 */
export const TRADING_TABS = [
  { id: 'overview', label: 'Overview', accentColor: 0x7fc8a9 },
  { id: 'buy', label: 'Buy', accentColor: 0x7fc8a9 },
  { id: 'sell', label: 'Sell', accentColor: 0x7fc8a9 },
] as const;

export const LEADERBOARD_CATEGORIES: Array<{
  id: RightSidebarLeaderboardCategory;
  label: string;
  accentColor: number;
}> = [
  { id: 'domination', label: '⚔️ Domination', accentColor: 0xf08a7e },
  { id: 'diplomacy', label: '🕊️ Diplomacy', accentColor: 0xa7f3d0 },
  { id: 'research', label: '💡 Science', accentColor: 0x6ec6ff },
  { id: 'cultural', label: '🏛️ Cultural', accentColor: 0xf4d06f },
  { id: 'gon', label: 'Game of nations', accentColor: 0xe0b94f },
];

const CITY_DETAIL_TABS: Array<{
  id: RightSidebarCityDetailsTab;
  label: string;
  accentColor: number;
}> = [
  { id: 'city', label: '🏠 City', accentColor: 0x7fb4d5 },
  { id: 'growth', label: '👶 Growth', accentColor: 0x86efac },
  { id: 'output', label: '📈 Output', accentColor: 0xf4d06f },
];

const LEADER_DETAIL_TABS: Array<{
  id: RightSidebarLeaderDetailsTab;
  label: string;
  accentColor: number;
}> = [
  { id: 'details', label: 'Details', accentColor: 0x7fb4d5 },
  { id: 'units', label: 'Units', accentColor: 0x6ec6ff },
  { id: 'cities', label: 'Cities', accentColor: 0x86efac },
  { id: 'diplomacy', label: 'Diplomacy', accentColor: 0xa7f3d0 },
  { id: 'relations', label: 'Relations', accentColor: 0xf0a8c0 },
  { id: 'economics', label: 'Economics', accentColor: 0x7fc8a9 },
];

export class RightSidebarPanel {
  private readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
  private readonly owned = new Set<Phaser.GameObjects.GameObject>();
  private readonly container: Phaser.GameObjects.Container;
  private readonly buttonContainer: Phaser.GameObjects.Container;
  private readonly panelContainer: Phaser.GameObjects.Container;
  private readonly panelBackground: Phaser.GameObjects.Rectangle;
  private readonly panelHitArea: Phaser.GameObjects.Zone;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly logCopyButtonBackground: Phaser.GameObjects.Rectangle;
  private readonly logCopyButtonLabel: Phaser.GameObjects.Text;
  private readonly logCopyButtonHitArea: Phaser.GameObjects.Zone;
  private readonly contentMaskGraphics: Phaser.GameObjects.Graphics;
  private readonly contentMask: Phaser.Display.Masks.GeometryMask;
  private readonly scrollbarTrack: Phaser.GameObjects.Rectangle;
  private readonly scrollbarThumb: Phaser.GameObjects.Rectangle;
  private readonly collapseBackground: Phaser.GameObjects.Rectangle;
  private readonly collapseIcon: Phaser.GameObjects.Graphics;
  private readonly collapseLabel: Phaser.GameObjects.Text;
  private readonly collapseHitArea: Phaser.GameObjects.Zone;
  private readonly modeButtons: ModeButton[];
  private readonly contentObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly contentButtons: ContentButton[] = [];
  private readonly contentInputs: ContentInput[] = [];
  private readonly requestedIconKeys = new Set<string>();
  private readonly failedIconKeys = new Set<string>();
  private readonly onResize: () => void;
  private readonly onAddedToScene: (object: Phaser.GameObjects.GameObject) => void;
  private readonly handleWheel: (
    pointer: Phaser.Input.Pointer,
    gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
    deltaZ: number,
    event: WheelEvent,
  ) => void;

  private activeMode: RightSidebarPanelMode | null = null;
  private onExpandedChanged: ((expanded: boolean) => void) | null = null;
  private collapsed = true;
  private collapseHovered = false;
  private collapsePressed = false;
  private draggingScrollbar = false;
  private dragPointerId: number | null = null;
  private dragStartPointerY = 0;
  private dragStartScrollOffset = 0;
  private panelHeight = 260;
  private scrollOffset = 0;
  private maxScroll = 0;
  private contentHeight = 0;
  private scrollableContentTop = CONTENT_TOP;
  private leaderboardCategory: RightSidebarLeaderboardCategory = 'domination';
  private tradingTabId = 'overview';
  private cityDetailsTab: RightSidebarCityDetailsTab = 'city';
  private leaderDetailsTab: RightSidebarLeaderDetailsTab = 'details';
  private lastDetailsCityId: string | null = null;
  private lastDetailsLeaderId: string | null = null;
  private focusSearchInputAfterRender = false;
  private diplomacyGraphFilters = new Set<DiplomacyRelationshipType>(['hasMet', 'embassy', 'openBorders', 'trade', 'ally', 'war']);
  private diplomacyGraphFocusNation: string | null = null;
  private diagnosticsEnabled = false;
  private logCopyButtonHovered = false;
  private logCopyButtonPressed = false;
  private logCopyFeedbackTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldInputGate: WorldInputGate,
    private readonly dataProvider: RightSidebarPanelDataProvider,
  ) {
    this.container = this.addOwned(scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0));
    this.buttonContainer = this.addOwned(scene.add.container(0, 0).setDepth(DEPTH + 10).setScrollFactor(0));
    this.panelContainer = this.addOwned(scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0));

    this.panelBackground = this.addOwned(scene.add.rectangle(0, 0, PANEL_WIDTH, 100, 0x071017, 0.88))
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x7fb4d5, 0.45)
      .setScrollFactor(0);
    this.panelHitArea = this.addOwned(scene.add.zone(0, 0, PANEL_WIDTH, 100))
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setInteractive();
    this.titleText = this.addText('Details', 26, '#f4f8ff', 'bold', CONTENT_WIDTH);
    this.logCopyButtonBackground = this.addOwned(scene.add.rectangle(0, 0, LOG_COPY_BUTTON_WIDTH, LOG_COPY_BUTTON_HEIGHT, 0x1d6d90, 0.98))
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x6ec6ff, 0.7)
      .setScrollFactor(0)
      .setVisible(false);
    this.logCopyButtonLabel = this.addText('Copy', 19, '#ffffff', 'normal', LOG_COPY_BUTTON_WIDTH - 16)
      .setOrigin(0.5)
      .setVisible(false);
    this.logCopyButtonHitArea = this.addOwned(scene.add.zone(0, 0, LOG_COPY_BUTTON_WIDTH, LOG_COPY_BUTTON_HEIGHT))
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setInteractive({ cursor: 'pointer' })
      .setVisible(false);
    this.contentMaskGraphics = this.addOwned(new Phaser.GameObjects.Graphics(scene).setScrollFactor(0));
    this.contentMask = this.contentMaskGraphics.createGeometryMask();
    this.scrollbarTrack = this.addOwned(scene.add.rectangle(0, 0, SCROLLBAR_WIDTH, 100, 0x1d3142, 0.56))
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setInteractive({ cursor: 'pointer' });
    this.scrollbarThumb = this.addOwned(scene.add.rectangle(0, 0, SCROLLBAR_WIDTH, SCROLLBAR_MIN_THUMB_HEIGHT, 0x9fc5dd, 0.86))
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setInteractive({ cursor: 'pointer' });

    this.collapseBackground = this.addOwned(scene.add.rectangle(0, 0, COLLAPSE_WIDTH, COLLAPSE_HEIGHT, 0x101b27, 0.96))
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x92a8c0, 0.5)
      .setScrollFactor(0);
    this.collapseIcon = this.addOwned(scene.add.graphics().setScrollFactor(0));
    this.collapseLabel = this.addText('Collapse', 15, '#e6edf7', 'bold');
    this.collapseHitArea = this.addOwned(scene.add.zone(0, 0, COLLAPSE_WIDTH, COLLAPSE_HEIGHT))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ cursor: 'pointer' });

    this.panelContainer.add([
      this.panelBackground,
      this.panelHitArea,
      this.titleText,
      this.logCopyButtonBackground,
      this.logCopyButtonLabel,
      this.logCopyButtonHitArea,
      this.scrollbarTrack,
      this.scrollbarThumb,
      this.collapseBackground,
      this.collapseIcon,
      this.collapseLabel,
      this.collapseHitArea,
    ]);
    this.container.add([this.panelContainer, this.buttonContainer]);

    this.modeButtons = MODES.map((definition) => this.createModeButton(definition));
    this.installPanelInput();
    this.installLogCopyButtonInput();
    this.installScrollbarInput();
    // Collapse button replaced by mode-button toggle behavior — hide its visuals.
    this.collapseBackground.setVisible(false);
    this.collapseIcon.setVisible(false);
    this.collapseLabel.setVisible(false);

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
      this.layout();
      this.renderActiveContent();
    };
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
    this.worldInputGate.registerWheelBlocker(WHEEL_BLOCKER_ID, (screenX, screenY) => this.containsScreenPoint(screenX, screenY));

    this.handleWheel = (pointer, _gameObjects, _deltaX, deltaY, _deltaZ, event) => {
      if (this.collapsed || !this.isPointerOverPanel(pointer)) return;
      consumePointerEvent(pointer);
      event.preventDefault?.();
      // In Trading the vertical scroll is intentionally driven only by the
      // scrollbar on the right, so the wheel is consumed but does not scroll.
      // Other modes keep normal wheel scrolling.
      if (this.activeMode === 'trading' || this.maxScroll <= 0) return;
      this.applyScroll(Math.sign(deltaY) * SCROLL_STEP);
    };
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp);

    this.dataProvider.onChanged(() => {
      console.debug('[RightSidebarPanel] received data change', {
        activeMode: this.activeMode,
        collapsed: this.collapsed,
      });
      const currentCityId = this.dataProvider.getCurrentCityId();
      if (currentCityId !== this.lastDetailsCityId) {
        this.lastDetailsCityId = currentCityId;
        this.cityDetailsTab = 'city';
      }
      const currentLeaderId = this.dataProvider.getCurrentLeaderId();
      if (currentLeaderId !== this.lastDetailsLeaderId) {
        this.lastDetailsLeaderId = currentLeaderId;
        this.leaderDetailsTab = 'details';
      }
      if (!this.activeMode || this.collapsed) return;
      this.renderActiveContent();
    });

    this.collapse();
    this.layout();
  }

  show(mode: RightSidebarPanelMode): void {
    console.debug('[RightSidebarPanel] show mode', mode);
    if (mode === 'leaderboard' && this.activeMode !== 'leaderboard') {
      this.leaderboardCategory = 'domination';
    }
    if (mode === 'trading' && this.activeMode !== 'trading') {
      this.tradingTabId = 'overview';
    }
    if (mode === 'diplomacy-graph' && this.activeMode !== 'diplomacy-graph') {
      this.diplomacyGraphFocusNation = null;
    }
    this.activeMode = mode;
    this.collapsed = false;
    this.scrollOffset = 0;
    this.layout();
    this.renderActiveContent();
    this.refreshVisibility();
    this.refreshButtonVisuals();
    this.onExpandedChanged?.(true);
  }

  showDetails(): void {
    this.show('details');
  }

  /** Notified when the panel expands (true) or collapses (false). */
  setOnExpandedChanged(callback: (expanded: boolean) => void): void {
    this.onExpandedChanged = callback;
  }

  /** Returns the screen-space X of the leftmost action button's left edge. */
  getButtonRowLeftX(): number {
    const viewportWidth = this.scene.scale.width;
    const panelWidth = this.getPanelWidth();
    const panelX = viewportWidth - panelWidth - EDGE_MARGIN;
    const visibleCount = this.modeButtons.filter((b) => b.visible).length;
    const buttonRowWidth = visibleCount > 0
      ? BUTTON_DIAMETER * visibleCount + BUTTON_GAP * (visibleCount - 1)
      : 0;
    return panelX + panelWidth - buttonRowWidth;
  }

  collapse(): void {
    this.collapsed = true;
    this.destroyContentObjects();
    this.refreshVisibility();
    this.refreshButtonVisuals();
    this.onExpandedChanged?.(false);
  }

  setDiagnosticsEnabled(enabled: boolean): void {
    this.diagnosticsEnabled = enabled;
    for (const button of this.modeButtons) {
      if (!button.definition.diagnosticOnly) continue;
      button.visible = enabled;
      button.background.setVisible(enabled);
      button.rim.setVisible(enabled);
      button.icon.setVisible(enabled);
      button.label.setVisible(enabled);
      if (enabled) {
        button.hitArea.setInteractive({ cursor: 'pointer' });
      } else {
        button.hitArea.disableInteractive();
      }
    }
    if (this.activeMode === 'diplomacy-graph' && !this.collapsed) {
      this.renderActiveContent();
    }
    this.layout();
  }

  setDetailsPlaceholder(): void {
    this.dataProvider.clear();
  }

  shutdown(): void {
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    this.scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAddedToScene);
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp);
    this.worldInputGate.unregisterWheelBlocker(WHEEL_BLOCKER_ID);
    this.destroyContentObjects();
    this.scene.cameras.remove(this.uiCamera);
    this.container.destroy(true);
    this.owned.clear();
  }

  private createModeButton(definition: ModeDefinition): ModeButton {
    const background = this.addOwned(new Phaser.GameObjects.Arc(this.scene, 0, 0, BUTTON_RADIUS, 0, 360, false, 0x101b27, 0.96))
      .setDepth(DEPTH + 10)
      .setScrollFactor(0);
    const rim = this.addOwned(new Phaser.GameObjects.Arc(this.scene, 0, 0, BUTTON_RADIUS + 3, 0, 360, false, 0x000000, 0))
      .setDepth(DEPTH + 11)
      .setStrokeStyle(3, 0x9fb7d0, 0.7)
      .setScrollFactor(0);
    const icon = this.addText(definition.icon, 30, '#ffffff', 'normal')
      .setOrigin(0.5)
      .setDepth(DEPTH + 12);
    const label = this.addText(definition.label, 13, '#dce7f4', 'bold')
      .setOrigin(0.5)
      .setDepth(DEPTH + 12);
    const hitArea = this.addOwned(new Phaser.GameObjects.Zone(this.scene, 0, 0, BUTTON_HIT_SIZE, BUTTON_HIT_SIZE + 20))
      .setOrigin(0.5)
      .setDepth(DEPTH + 13)
      .setScrollFactor(0)
      .setInteractive({ cursor: 'pointer' });
    const visible = !definition.diagnosticOnly;
    const button: ModeButton = { definition, background, rim, icon, label, hitArea, hovered: false, pressed: false, visible };

    hitArea.on(Phaser.Input.Events.POINTER_OVER, (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      button.hovered = true;
      this.refreshButtonVisual(button);
    });
    hitArea.on(Phaser.Input.Events.POINTER_OUT, (_pointer: Phaser.Input.Pointer, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      button.hovered = false;
      button.pressed = false;
      this.refreshButtonVisual(button);
    });
    hitArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
      button.pressed = true;
      this.refreshButtonVisual(button);
    });
    hitArea.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      consumePointerEvent(pointer);
      const shouldShow = button.pressed;
      button.pressed = false;
      this.worldInputGate.releasePointer(pointer.id);
      if (shouldShow) {
        if (this.activeMode === definition.mode && !this.collapsed) {
          this.collapse();
        } else {
          this.show(definition.mode);
        }
      }
      this.refreshButtonVisual(button);
    });

    this.buttonContainer.add([background, rim, icon, label, hitArea]);
    this.refreshButtonVisual(button);
    if (definition.diagnosticOnly) {
      background.setVisible(false);
      rim.setVisible(false);
      icon.setVisible(false);
      label.setVisible(false);
      hitArea.disableInteractive();
    }
    return button;
  }

  private installPanelInput(): void {
    this.panelHitArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
    });
    this.panelHitArea.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      consumePointerEvent(pointer);
      this.worldInputGate.releasePointer(pointer.id);
    });
  }

  private installScrollbarInput(): void {
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

      const trackHeight = this.scrollbarTrack.height;
      const thumbHeight = this.scrollbarThumb.height;
      const thumbTop = this.scrollbarThumb.y - this.scrollbarTrack.y;
      const targetThumbTop = Phaser.Math.Clamp(localY - (thumbHeight / 2), 0, Math.max(0, trackHeight - thumbHeight));
      const pageScroll = Math.max(SCROLL_STEP, this.getVisibleContentHeight() * 0.8);
      if (targetThumbTop < thumbTop) {
        this.applyScroll(-pageScroll);
      } else if (targetThumbTop > thumbTop) {
        this.applyScroll(pageScroll);
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
  }

  private installCollapseInput(): void {
    this.collapseHitArea.on(Phaser.Input.Events.POINTER_OVER, (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.collapseHovered = true;
      this.refreshCollapseVisual();
    });
    this.collapseHitArea.on(Phaser.Input.Events.POINTER_OUT, (_pointer: Phaser.Input.Pointer, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.collapseHovered = false;
      this.collapsePressed = false;
      this.refreshCollapseVisual();
    });
    this.collapseHitArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
      this.collapsePressed = true;
      this.refreshCollapseVisual();
    });
    this.collapseHitArea.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      consumePointerEvent(pointer);
      const shouldCollapse = this.collapsePressed;
      this.collapsePressed = false;
      this.worldInputGate.releasePointer(pointer.id);
      if (shouldCollapse) this.collapse();
      this.refreshCollapseVisual();
    });
  }

  private renderActiveContent(): void {
    if (!this.activeMode) return;

    if (this.activeMode === 'diplomacy-graph') {
      this.titleText.setText('Diplomacy Graph');
      this.refreshLogCopyButtonVisibility();
      this.destroyContentObjects();
      this.scrollableContentTop = CONTENT_TOP;
      this.buildDiplomacyGraphContent();
      this.contentHeight = 0;
      this.maxScroll = 0;
      this.scrollOffset = 0;
      this.updateContentMask();
      this.positionContentObjects();
      this.updateScrollbar();
      return;
    }

    const content = this.ensureRenderableContent(this.getContentForMode(this.activeMode));
    console.debug('[RightSidebarPanel] render content', {
      mode: this.activeMode,
      sections: content.sections.length,
      rows: content.sections.reduce((sum, section) => sum + section.rows.length, 0),
    });
    this.titleText.setText(content.title);
    this.refreshLogCopyButtonVisibility();
    this.destroyContentObjects();
    this.contentHeight = this.buildContent(content);
    this.maxScroll = Math.max(0, this.contentHeight - this.getVisibleContentHeight());
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset, 0, this.maxScroll);
    this.updateContentMask();
    this.positionContentObjects();
    this.updateScrollbar();
  }

  private getContentForMode(mode: RightSidebarPanelMode): RightSidebarContent {
    switch (mode) {
      case 'details':
        return this.dataProvider.getDetailsContent(this.cityDetailsTab, this.leaderDetailsTab);
      case 'leaderboard':
        return this.dataProvider.getLeaderboardContent(this.leaderboardCategory);
      case 'trading':
        return this.getTradingContent();
      case 'timeline':
        return this.dataProvider.getTimelineContent();
      case 'diplomacy-graph':
        return { title: 'Diplomacy Graph', sections: [] };
    }
  }

  private getTradingTabs(): Array<{ id: string; label: string; accentColor: number; nationId?: string }> {
    return [...TRADING_TABS, ...this.dataProvider.getTradingNationTabs()];
  }

  private getTradingContent(): RightSidebarContent {
    const tabs = this.getTradingTabs();
    this.tradingTabId = resolveTradingTabId(this.tradingTabId, tabs.map((tab) => tab.id));
    const selected = tabs.find((tab) => tab.id === this.tradingTabId)!;
    if (selected.nationId) return this.dataProvider.getTradingNationContent(selected.nationId);
    if (selected.id === 'buy') return this.dataProvider.getTradingBuyContent();
    if (selected.id === 'sell') return this.dataProvider.getTradingSellContent();
    return this.dataProvider.getTradingOverviewContent();
  }

  private ensureRenderableContent(content: RightSidebarContent): RightSidebarContent {
    const hasRows = content.sections.some((section) => section.rows.length > 0);
    if (hasRows) return content;
    return {
      title: content.title,
      sections: [{
        title: content.title,
        rows: [{ kind: 'text', text: this.activeMode === 'details' ? 'No details available' : 'No content available', muted: true }],
      }],
    };
  }

  private buildContent(content: RightSidebarContent): number {
    let y = CONTENT_TOP;
    this.scrollableContentTop = CONTENT_TOP;
    let scrollContentStartY = CONTENT_TOP;
    if (this.activeMode === 'details' && this.dataProvider.getView() === 'city') {
      y = this.addCityDetailsTabs(y);
    }
    if (this.activeMode === 'details' && this.dataProvider.getView() === 'leader') {
      y = this.addLeaderDetailsTabs(y);
      this.scrollableContentTop = y;
      scrollContentStartY = y;
    }
    if (this.activeMode === 'leaderboard') {
      y = this.addLeaderboardTabs(y);
    }
    if (this.activeMode === 'trading') {
      y = this.addTradingTabs(y);
    }
    const sections = content.sections;
    let i = 0;
    while (i < sections.length) {
      const section = sections[i];
      if (!section.column) {
        y = this.addFullWidthSection(section, y);
        i++;
        continue;
      }
      // Gather the contiguous run of columned sections into one 50/50 band.
      const run: RightSidebarSection[] = [];
      while (i < sections.length && sections[i].column) run.push(sections[i++]);
      y = this.addTwoColumnBand(run, y);
    }
    return Math.max(0, y - scrollContentStartY);
  }

  /** Render one section spanning the whole content width (the default layout). */
  private addFullWidthSection(section: RightSidebarSection, y: number): number {
    const width = this.getContentWidth();
    y = this.addSectionHeading(section, PANEL_PADDING, y, width, true);
    for (const row of section.rows) y = this.addContentRow(row, y);
    return y + SECTION_GAP;
  }

  /**
   * Render a run of `column` sections as a 50/50 band: 'left' sections stack in
   * the left half, 'right' sections in the right half. The band's height is the
   * taller of the two stacks. Columned sections only carry text rows.
   */
  private addTwoColumnBand(run: readonly RightSidebarSection[], y: number): number {
    const COLUMN_GAP = 16;
    const colWidth = Math.floor((this.getContentWidth() - COLUMN_GAP) / 2);
    const leftX = PANEL_PADDING;
    const rightX = PANEL_PADDING + colWidth + COLUMN_GAP;
    let leftY = y;
    let rightY = y;
    for (const section of run) {
      if (section.column === 'right') rightY = this.addColumnSection(section, rightX, rightY, colWidth);
      else leftY = this.addColumnSection(section, leftX, leftY, colWidth);
    }
    return Math.max(leftY, rightY);
  }

  /** Render one section (heading + rows) confined to the box [x, x + width]. */
  private addColumnSection(section: RightSidebarSection, x: number, y: number, width: number): number {
    y = this.addSectionHeading(section, x, y, width, false);
    for (const row of section.rows) {
      y = row.kind === 'text'
        ? this.addTextRow(row, y, x, width)
        // Columned sections are text-only by construction; anything else falls
        // back to a full-width row so nothing is silently dropped.
        : this.addContentRow(row, y);
    }
    return y + SECTION_GAP;
  }

  /** Shared section-title rendering; `withTitleRight` enables the optional right label. */
  private addSectionHeading(section: RightSidebarSection, x: number, y: number, width: number, withTitleRight: boolean): number {
    const heading = this.addContentText(section.title, 17, '#91a9c4', 'bold', width);
    heading.setPosition(x, y);
    heading.setData('baseY', y);
    let headingHeight = heading.height;
    if (withTitleRight && section.titleRight) {
      const rightHeading = this.addContentText(section.titleRight, 15, '#d8c686', 'bold', width);
      rightHeading.setOrigin(1, 0);
      rightHeading.setPosition(x + width, y + 1);
      rightHeading.setData('baseY', y + 1);
      headingHeight = Math.max(headingHeight, rightHeading.height);
    }
    return y + headingHeight + 9;
  }

  private buildDiplomacyGraphContent(): void {
    const graph = this.dataProvider.buildDiplomacyGraph({ revealAll: this.diagnosticsEnabled });
    const panelX = this.panelContainer.x;
    const panelY = this.panelContainer.y;

    const FILTER_GAP = 8;
    const FILTER_H = 28;
    const FILTER_DEFS: Array<{ type: DiplomacyRelationshipType; label: string; color: number }> = [
      { type: 'hasMet', label: 'Met', color: 0x778899 },
      { type: 'embassy', label: 'Embassy', color: 0x6ec6ff },
      { type: 'openBorders', label: 'Borders', color: 0x44bb77 },
      { type: 'trade', label: 'Trade', color: 0xf0c66a },
      { type: 'ally', label: 'Ally', color: 0xb060ff },
      { type: 'war', label: 'War', color: 0xcc3344 },
    ];
    const filterBtnWidth = (CONTENT_WIDTH - FILTER_GAP * (FILTER_DEFS.length - 1)) / FILTER_DEFS.length;

    let filterX = PANEL_PADDING;
    for (const fd of FILTER_DEFS) {
      const active = this.diplomacyGraphFilters.has(fd.type);
      const bg = this.addOwned(new Phaser.GameObjects.Rectangle(
        this.scene, filterX, CONTENT_TOP, filterBtnWidth, FILTER_H,
        active ? 0x1f4b62 : 0x143044, active ? 1 : 0.88,
      ))
        .setOrigin(0, 0)
        .setStrokeStyle(active ? 2 : 1, fd.color, active ? 0.95 : 0.4)
        .setScrollFactor(0);
      bg.setData('baseY', CONTENT_TOP);
      const lbl = this.addText(fd.label, 12, active ? '#ffffff' : '#b0c8e0', active ? 'bold' : 'normal');
      lbl.setOrigin(0.5, 0.5);
      lbl.setPosition(filterX + filterBtnWidth / 2, CONTENT_TOP + FILTER_H / 2);
      lbl.setData('baseY', CONTENT_TOP + FILTER_H / 2);
      const hit = this.addOwned(new Phaser.GameObjects.Zone(
        this.scene, filterX, CONTENT_TOP, filterBtnWidth, FILTER_H,
      ))
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setInteractive({ cursor: 'pointer' });
      hit.setData('baseY', CONTENT_TOP);
      const filterType = fd.type;
      hit.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (pointer.button !== 0) return;
        this.worldInputGate.claimPointer(pointer.id);
        consumePointerEvent(pointer);
      });
      hit.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (pointer.button !== 0) return;
        consumePointerEvent(pointer);
        this.worldInputGate.releasePointer(pointer.id);
        if (this.diplomacyGraphFilters.has(filterType)) {
          this.diplomacyGraphFilters.delete(filterType);
        } else {
          this.diplomacyGraphFilters.add(filterType);
        }
        this.renderActiveContent();
      });
      this.panelContainer.add([bg, lbl, hit]);
      this.contentObjects.push(bg, lbl, hit);
      bg.setMask(this.contentMask);
      lbl.setMask(this.contentMask);
      filterX += filterBtnWidth + FILTER_GAP;
    }

    let currentY = CONTENT_TOP + FILTER_H + 8;

    if (this.diplomacyGraphFocusNation !== null) {
      const focusedNode = graph.nodes.find((n) => n.nationId === this.diplomacyGraphFocusNation);
      const focusLabel = focusedNode ? focusedNode.name : 'nation';
      const showAllH = 26;
      const showAllBg = this.addOwned(new Phaser.GameObjects.Rectangle(
        this.scene, PANEL_PADDING, currentY, CONTENT_WIDTH, showAllH,
        0x2a3a4a, 0.9,
      ))
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0x6ec6ff, 0.5)
        .setScrollFactor(0);
      showAllBg.setData('baseY', currentY);
      const showAllLbl = this.addText(`${focusLabel} — Show All`, 13, '#a8d4f0');
      showAllLbl.setOrigin(0, 0.5);
      showAllLbl.setPosition(PANEL_PADDING + 10, currentY + showAllH / 2);
      showAllLbl.setData('baseY', currentY + showAllH / 2);
      const showAllHit = this.addOwned(new Phaser.GameObjects.Zone(
        this.scene, PANEL_PADDING, currentY, CONTENT_WIDTH, showAllH,
      ))
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setInteractive({ cursor: 'pointer' });
      showAllHit.setData('baseY', currentY);
      showAllHit.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (pointer.button !== 0) return;
        this.worldInputGate.claimPointer(pointer.id);
        consumePointerEvent(pointer);
      });
      showAllHit.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (pointer.button !== 0) return;
        consumePointerEvent(pointer);
        this.worldInputGate.releasePointer(pointer.id);
        this.diplomacyGraphFocusNation = null;
        this.renderActiveContent();
      });
      this.panelContainer.add([showAllBg, showAllLbl, showAllHit]);
      this.contentObjects.push(showAllBg, showAllLbl, showAllHit);
      showAllBg.setMask(this.contentMask);
      showAllLbl.setMask(this.contentMask);
      currentY += showAllH + 6;
    }

    const graphTop = currentY;
    const visibleHeight = this.getVisibleContentHeight();
    const graphAreaHeight = Math.max(80, visibleHeight - (graphTop - CONTENT_TOP) - 8);
    const graphCenterX = PANEL_PADDING + CONTENT_WIDTH / 2;
    const graphCenterY = graphTop + graphAreaHeight / 2;
    const nodeRadius = 10;
    const labelOffset = nodeRadius + 3;
    const layoutRadius = Math.max(30, Math.min(
      CONTENT_WIDTH / 2 - nodeRadius - 40,
      graphAreaHeight / 2 - nodeRadius - 18,
    ));

    const { nodes } = graph;
    if (nodes.length === 0) {
      const noDataText = this.addContentText('No diplomatic data available.', 15, '#c1cbd8');
      noDataText.setPosition(PANEL_PADDING, graphTop);
      noDataText.setData('baseY', graphTop);
      return;
    }

    const nodePositions = new Map<string, { x: number; y: number }>();
    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      nodePositions.set(node.nationId, {
        x: graphCenterX + Math.cos(angle) * layoutRadius,
        y: graphCenterY + Math.sin(angle) * layoutRadius,
      });
    });

    const focusId = this.diplomacyGraphFocusNation;
    const visibleEdges = graph.edges.filter((edge) => {
      if (!this.diplomacyGraphFilters.has(edge.type)) return false;
      if (focusId !== null) {
        return edge.fromNationId === focusId || edge.toNationId === focusId;
      }
      return true;
    });

    const connectedNodeIds = new Set<string>();
    if (focusId !== null) {
      connectedNodeIds.add(focusId);
      for (const edge of visibleEdges) {
        connectedNodeIds.add(edge.fromNationId);
        connectedNodeIds.add(edge.toNationId);
      }
    }

    const edgeGfx = this.addOwned(new Phaser.GameObjects.Graphics(this.scene)
      .setScrollFactor(0)
      .setDepth(DEPTH + 1));
    this.scene.add.existing(edgeGfx);
    edgeGfx.setMask(this.contentMask);

    // Relationships are not mutually exclusive: a pair of nations can have several
    // visible edges at once. Render them as parallel lines offset perpendicular to
    // the centerline so none overlap. Center-out priority keeps Met/Embassy nearest
    // the centerline and War/Alliance outermost.
    const EDGE_STYLE: Record<DiplomacyRelationshipType, { width: number; color: number; alpha: number }> = {
      hasMet: { width: 1, color: 0x778899, alpha: 0.3 },
      embassy: { width: 1.25, color: 0x6ec6ff, alpha: 0.62 },
      openBorders: { width: 1.5, color: 0x44bb77, alpha: 0.75 },
      trade: { width: 2, color: 0xf0c66a, alpha: 0.78 },
      ally: { width: 5.5, color: 0xb060ff, alpha: 0.95 },
      war: { width: 2.5, color: 0xcc3344, alpha: 0.92 },
    };
    const CENTER_OUT_PRIORITY: DiplomacyRelationshipType[] = [
      'hasMet', 'embassy', 'openBorders', 'trade', 'ally', 'war',
    ];
    const PARALLEL_EDGE_SPACING = 6;

    // Group visible edges by unordered nation pair.
    const edgesByPair = new Map<string, typeof visibleEdges>();
    for (const edge of visibleEdges) {
      const key = [edge.fromNationId, edge.toNationId].sort().join('|');
      const list = edgesByPair.get(key);
      if (list) list.push(edge);
      else edgesByPair.set(key, [edge]);
    }

    for (const pairEdges of edgesByPair.values()) {
      const from = nodePositions.get(pairEdges[0].fromNationId);
      const to = nodePositions.get(pairEdges[0].toNationId);
      if (!from || !to) continue;

      // Order edges center-out so Met/Embassy take the innermost offset slots.
      pairEdges.sort((a, b) =>
        CENTER_OUT_PRIORITY.indexOf(a.type) - CENTER_OUT_PRIORITY.indexOf(b.type));
      const count = pairEdges.length;
      // Symmetric offsets around the centerline, sorted by distance from center
      // (innermost first) so the center-out edge order maps to inner→outer slots.
      const offsetSlots = Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * PARALLEL_EDGE_SPACING)
        .sort((a, b) => Math.abs(a) - Math.abs(b));

      // Perpendicular unit vector to the centerline (screen space).
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      const perpX = -dy / length;
      const perpY = dx / length;

      pairEdges.forEach((edge, index) => {
        const offset = offsetSlots[index];
        const style = EDGE_STYLE[edge.type];
        edgeGfx.lineStyle(style.width, style.color, style.alpha);
        edgeGfx.beginPath();
        edgeGfx.moveTo(panelX + from.x + perpX * offset, panelY + from.y + perpY * offset);
        edgeGfx.lineTo(panelX + to.x + perpX * offset, panelY + to.y + perpY * offset);
        edgeGfx.strokePath();
      });
    }
    this.contentObjects.push(edgeGfx);

    const nodeGfx = this.addOwned(new Phaser.GameObjects.Graphics(this.scene)
      .setScrollFactor(0)
      .setDepth(DEPTH + 2));
    this.scene.add.existing(nodeGfx);
    nodeGfx.setMask(this.contentMask);

    for (const node of nodes) {
      const pos = nodePositions.get(node.nationId);
      if (!pos) continue;
      const isFocused = node.nationId === focusId;
      const isConnectedOrAll = focusId === null || connectedNodeIds.has(node.nationId);
      const r = isFocused ? nodeRadius + 3 : nodeRadius;
      nodeGfx.fillStyle(node.color, isConnectedOrAll ? 0.88 : 0.2);
      nodeGfx.fillCircle(panelX + pos.x, panelY + pos.y, r);
      if (isFocused) {
        nodeGfx.lineStyle(2, 0xffffff, 0.9);
        nodeGfx.strokeCircle(panelX + pos.x, panelY + pos.y, r);
      }
    }
    this.contentObjects.push(nodeGfx);

    for (const node of nodes) {
      const pos = nodePositions.get(node.nationId);
      if (!pos) continue;
      const isFocused = node.nationId === focusId;
      const isConnectedOrAll = focusId === null || connectedNodeIds.has(node.nationId);
      const shortName = node.name.length > 10 ? `${node.name.substring(0, 10)}…` : node.name;
      const labelColor = isConnectedOrAll ? (isFocused ? '#ffffff' : '#c8dff0') : '#3a4d5e';

      const label = this.addOwned(new Phaser.GameObjects.Text(this.scene,
        panelX + pos.x, panelY + pos.y + labelOffset, shortName,
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: '9px',
          color: labelColor,
          fontStyle: isFocused ? 'bold' : 'normal',
        },
      ))
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH + 3)
        .setResolution(getHudTextResolution());
      this.scene.add.existing(label);
      label.setMask(this.contentMask);
      this.contentObjects.push(label);

      const hitSize = (nodeRadius + 5) * 2;
      const hit = this.addOwned(new Phaser.GameObjects.Zone(
        this.scene,
        panelX + pos.x,
        panelY + pos.y,
        hitSize,
        hitSize,
      ))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(DEPTH + 4)
        .setInteractive({ cursor: 'pointer' });
      this.scene.add.existing(hit);
      const nationId = node.nationId;
      hit.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (pointer.button !== 0) return;
        this.worldInputGate.claimPointer(pointer.id);
        consumePointerEvent(pointer);
      });
      hit.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (pointer.button !== 0) return;
        consumePointerEvent(pointer);
        this.worldInputGate.releasePointer(pointer.id);
        this.diplomacyGraphFocusNation = this.diplomacyGraphFocusNation === nationId ? null : nationId;
        this.renderActiveContent();
      });
      this.contentObjects.push(hit);
    }
  }

  private addLeaderboardTabs(y: number): number {
    const contentWidth = this.getContentWidth();
    const tabWidth = (contentWidth - LEADERBOARD_TAB_GAP * (LEADERBOARD_CATEGORIES.length - 1)) / LEADERBOARD_CATEGORIES.length;
    let x = PANEL_PADDING;
    for (const category of LEADERBOARD_CATEGORIES) {
      const selected = category.id === this.leaderboardCategory;
      const background = this.addOwned(new Phaser.GameObjects.Rectangle(
        this.scene,
        x,
        y,
        tabWidth,
        LEADERBOARD_TAB_HEIGHT,
        selected ? 0x1f4b62 : 0x143044,
        selected ? 1 : 0.92,
      ))
        .setOrigin(0, 0)
        .setStrokeStyle(selected ? 2 : 1, category.accentColor, selected ? 0.95 : 0.5)
        .setScrollFactor(0);
      background.setData('baseY', y);

      const hitArea = this.addOwned(new Phaser.GameObjects.Zone(this.scene, x, y, tabWidth, LEADERBOARD_TAB_HEIGHT))
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setInteractive({ cursor: 'pointer' });
      hitArea.setData('baseY', y);
      hitArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (pointer.button !== 0) return;
        this.worldInputGate.claimPointer(pointer.id);
        consumePointerEvent(pointer);
      });
      hitArea.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (pointer.button !== 0) return;
        consumePointerEvent(pointer);
        this.worldInputGate.releasePointer(pointer.id);
        if (this.leaderboardCategory !== category.id) {
          this.leaderboardCategory = category.id;
          this.scrollOffset = 0;
          this.renderActiveContent();
        }
      });

      this.panelContainer.add(background);
      this.contentObjects.push(background);
      background.setMask(this.contentMask);
      const label = this.addContentText(category.label, 13, selected ? '#ffffff' : '#d7e2ee', 'bold', tabWidth - 12);
      label.setPosition(x + 6, y + 9);
      label.setData('baseY', y + 9);
      this.panelContainer.add(hitArea);
      this.contentObjects.push(hitArea);
      x += tabWidth + LEADERBOARD_TAB_GAP;
    }
    return y + LEADERBOARD_TAB_HEIGHT + SECTION_GAP;
  }

  private addTradingTabs(y: number): number {
    const tabs = this.getTradingTabs();
    const availableWidth = this.getContentWidth();
    const rightEdge = PANEL_PADDING + availableWidth;
    let cursorX = PANEL_PADDING;
    let cursorY = y;

    for (const tab of tabs) {
      const selected = tab.id === this.tradingTabId;
      // Each tab is only as wide as its label plus padding; measure the label
      // first (no wrap) so the background can be sized to it.
      const label = this.addText(tab.label, 14, selected ? '#ffffff' : '#d7e2ee', 'bold');
      const tabWidth = Math.min(availableWidth, Math.ceil(label.width) + TRADING_TAB_PAD_X * 2);

      // Wrap onto a new row when the tab would overflow the content width.
      if (cursorX > PANEL_PADDING && cursorX + tabWidth > rightEdge) {
        cursorX = PANEL_PADDING;
        cursorY += TRADING_TAB_HEIGHT + LEADERBOARD_TAB_GAP;
      }
      const x = cursorX;

      const background = this.addOwned(new Phaser.GameObjects.Rectangle(
        this.scene,
        x,
        cursorY,
        tabWidth,
        TRADING_TAB_HEIGHT,
        selected ? 0x1f4b62 : 0x143044,
        selected ? 1 : 0.92,
      ))
        .setOrigin(0, 0)
        .setStrokeStyle(selected ? 2 : 1, tab.accentColor, selected ? 0.95 : 0.5)
        .setScrollFactor(0);
      background.setData('baseY', cursorY);
      this.panelContainer.add(background);
      this.contentObjects.push(background);
      background.setMask(this.contentMask);

      // Label centered both horizontally and vertically inside the tab.
      const labelX = x + tabWidth / 2;
      const labelY = cursorY + TRADING_TAB_HEIGHT / 2;
      label.setOrigin(0.5, 0.5).setPosition(labelX, labelY);
      label.setData('baseY', labelY);
      this.panelContainer.add(label);
      this.contentObjects.push(label);
      label.setMask(this.contentMask);

      const hitArea = this.addOwned(new Phaser.GameObjects.Zone(this.scene, x, cursorY, tabWidth, TRADING_TAB_HEIGHT))
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setInteractive({ cursor: 'pointer' });
      hitArea.setData('baseY', cursorY);
      hitArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (pointer.button !== 0) return;
        this.worldInputGate.claimPointer(pointer.id);
        consumePointerEvent(pointer);
      });
      hitArea.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (pointer.button !== 0) return;
        consumePointerEvent(pointer);
        this.worldInputGate.releasePointer(pointer.id);
        if (this.tradingTabId !== tab.id) {
          this.tradingTabId = tab.id;
          this.scrollOffset = 0;
          this.renderActiveContent();
        }
      });
      this.panelContainer.add(hitArea);
      this.contentObjects.push(hitArea);

      cursorX = x + tabWidth + LEADERBOARD_TAB_GAP;
    }
    return cursorY + TRADING_TAB_HEIGHT + SECTION_GAP;
  }

  private addCityDetailsTabs(y: number): number {
    const tabWidth = (CONTENT_WIDTH - CITY_TAB_GAP * (CITY_DETAIL_TABS.length - 1)) / CITY_DETAIL_TABS.length;
    let x = PANEL_PADDING;
    for (const tab of CITY_DETAIL_TABS) {
      const selected = tab.id === this.cityDetailsTab;
      const background = this.addOwned(new Phaser.GameObjects.Rectangle(
        this.scene,
        x,
        y,
        tabWidth,
        CITY_TAB_HEIGHT,
        selected ? 0x1f4b62 : 0x143044,
        selected ? 1 : 0.92,
      ))
        .setOrigin(0, 0)
        .setStrokeStyle(selected ? 2 : 1, tab.accentColor, selected ? 0.95 : 0.5)
        .setScrollFactor(0);
      background.setData('baseY', y);

      const hitArea = this.addOwned(new Phaser.GameObjects.Zone(this.scene, x, y, tabWidth, CITY_TAB_HEIGHT))
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setInteractive({ cursor: 'pointer' });
      hitArea.setData('baseY', y);
      hitArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (pointer.button !== 0) return;
        this.worldInputGate.claimPointer(pointer.id);
        consumePointerEvent(pointer);
      });
      hitArea.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (pointer.button !== 0) return;
        consumePointerEvent(pointer);
        this.worldInputGate.releasePointer(pointer.id);
        if (this.cityDetailsTab !== tab.id) {
          this.cityDetailsTab = tab.id;
          this.scrollOffset = 0;
          this.renderActiveContent();
        }
      });

      this.panelContainer.add(background);
      this.contentObjects.push(background);
      background.setMask(this.contentMask);
      const label = this.addContentText(tab.label, 13, selected ? '#ffffff' : '#d7e2ee', 'bold', tabWidth - 12);
      label.setPosition(x + 6, y + 9);
      label.setData('baseY', y + 9);
      this.panelContainer.add(hitArea);
      this.contentObjects.push(hitArea);
      x += tabWidth + CITY_TAB_GAP;
    }
    return y + CITY_TAB_HEIGHT + SECTION_GAP;
  }

  private addLeaderDetailsTabs(y: number): number {
    const tabWidth = (CONTENT_WIDTH - LEADER_TAB_GAP * (LEADER_DETAIL_TABS.length - 1)) / LEADER_DETAIL_TABS.length;
    let x = PANEL_PADDING;
    for (const tab of LEADER_DETAIL_TABS) {
      const selected = tab.id === this.leaderDetailsTab;
      const background = this.addOwned(new Phaser.GameObjects.Rectangle(
        this.scene,
        x,
        y,
        tabWidth,
        LEADER_TAB_HEIGHT,
        selected ? 0x1f4b62 : 0x143044,
        selected ? 1 : 0.92,
      ))
        .setOrigin(0, 0)
        .setStrokeStyle(selected ? 2 : 1, tab.accentColor, selected ? 0.95 : 0.5)
        .setScrollFactor(0);
      background.setData('baseY', y);
      background.setData('fixedY', true);

      const hitArea = this.addOwned(new Phaser.GameObjects.Zone(this.scene, x, y, tabWidth, LEADER_TAB_HEIGHT))
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setInteractive({ cursor: 'pointer' });
      hitArea.setData('baseY', y);
      hitArea.setData('fixedY', true);
      hitArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (pointer.button !== 0) return;
        this.worldInputGate.claimPointer(pointer.id);
        consumePointerEvent(pointer);
      });
      hitArea.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (pointer.button !== 0) return;
        consumePointerEvent(pointer);
        this.worldInputGate.releasePointer(pointer.id);
        if (this.leaderDetailsTab !== tab.id) {
          this.leaderDetailsTab = tab.id;
          this.scrollOffset = 0;
          this.renderActiveContent();
        }
      });

      this.panelContainer.add(background);
      this.contentObjects.push(background);
      const label = this.addText(tab.label, 13, selected ? '#ffffff' : '#d7e2ee', 'bold', tabWidth - 12);
      label.setPosition(x + 6, y + 9);
      label.setData('baseY', y + 9);
      label.setData('fixedY', true);
      this.panelContainer.add(label);
      this.contentObjects.push(label);
      this.panelContainer.add(hitArea);
      this.contentObjects.push(hitArea);
      x += tabWidth + LEADER_TAB_GAP;
    }
    return y + LEADER_TAB_HEIGHT + SECTION_GAP;
  }

  private addContentRow(row: RightSidebarRow, y: number): number {
    switch (row.kind) {
      case 'text':
        return this.addTextRow(row, y, PANEL_PADDING, this.getContentWidth());
      case 'button':
        return this.addContentButton(row, y);
      case 'buttonGroup':
        return this.addButtonGroupRow(row, y);
      case 'progress':
        return this.addProgressRow(row.label, row.current, row.max, y);
      case 'separator': {
        const line = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, PANEL_PADDING, y + 6, this.getContentWidth(), 1, 0x7f8b99, 0.28))
          .setOrigin(0, 0)
          .setScrollFactor(0);
        line.setData('baseY', y + 6);
        this.panelContainer.add(line);
        this.contentObjects.push(line);
        line.setMask(this.contentMask);
        return y + 16;
      }
      case 'searchInput':
        return this.addSearchInputRow(row, y);
      case 'select':
        return this.addSelectRow(row, y);
      case 'relationsTable':
        return this.addRelationsTableRow(row, y);
      case 'compactTable':
        return this.addCompactTableRow(row, y);
      case 'grid':
        return this.addGridRow(row, y);
    }
  }

  /**
   * Lay a grid row's cells out left-to-right, wrapping after `columns` of them.
   * Each cell is its own small stack of rows, sized to one grid column, so items
   * fill the panel width instead of forming one tall single-column list.
   */
  private addGridRow(row: RightSidebarGridRow, y: number): number {
    const GAP = 12;
    const cols = Math.max(1, row.columns);
    const colWidth = Math.floor((this.getContentWidth() - GAP * (cols - 1)) / cols);
    let rowTopY = y;
    let maxRowBottom = y;
    row.cells.forEach((cell, index) => {
      const column = index % cols;
      if (column === 0 && index > 0) {
        rowTopY = maxRowBottom + GAP;
        maxRowBottom = rowTopY;
      }
      const x = PANEL_PADDING + column * (colWidth + GAP);
      let cellY = rowTopY;
      for (const cellRow of cell) cellY = this.addCellRow(cellRow, cellY, x, colWidth);
      maxRowBottom = Math.max(maxRowBottom, cellY);
    });
    return maxRowBottom;
  }

  /** Render one row confined to a grid/column box [x, x + width]. */
  private addCellRow(row: RightSidebarRow, y: number, x: number, width: number): number {
    switch (row.kind) {
      case 'text':
        return this.addTextRow(row, y, x, width);
      case 'select':
        return this.addSelectRow(row, y, x, width);
      case 'button':
        return this.addContentButton(row, y, x, width);
      case 'separator': {
        const line = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, x, y + 6, width, 1, 0x7f8b99, 0.28))
          .setOrigin(0, 0)
          .setScrollFactor(0);
        line.setData('baseY', y + 6);
        this.panelContainer.add(line);
        this.contentObjects.push(line);
        line.setMask(this.contentMask);
        return y + 16;
      }
      // Other row kinds are not used inside grid cells; fall back to full width.
      default:
        return this.addContentRow(row, y);
    }
  }

  /**
   * Render a single text row inside the box [x, x + width]. Extracted from
   * {@link addContentRow} so both the full-width flow and the two-column trading
   * band can place text rows with the same accent/icon/wrap behaviour.
   */
  private addTextRow(row: RightSidebarTextRow, y: number, x: number, width: number): number {
    const hasAccent = row.color !== undefined;
    const icon = row.spritePath ? this.addContentIcon(row.spritePath, x + (hasAccent ? 15 : 0), y + 1) : null;
    const iconWidth = icon ? CONTENT_ICON_SIZE + CONTENT_ICON_GAP : 0;
    const textX = (hasAccent ? x + 15 : x) + iconWidth;
    const wrapWidth = (hasAccent ? width - 15 : width) - iconWidth;
    const color = row.muted ? '#c1cbd8' : row.large ? '#ffffff' : '#edf4ff';
    if (hasAccent) {
      const marker = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, x, y + 5, 6, Math.max(14, row.large ? 20 : 16), row.color, 0.95))
        .setOrigin(0, 0)
        .setScrollFactor(0);
      marker.setData('baseY', y + 5);
      this.panelContainer.add(marker);
      this.contentObjects.push(marker);
      marker.setMask(this.contentMask);
    }
    if (icon) {
      this.panelContainer.add(icon);
      this.contentObjects.push(icon);
      icon.setMask(this.contentMask);
    }
    const text = this.addContentText(row.text, row.large ? 21 : 16, color, row.large ? 'bold' : 'normal');
    text.setWordWrapWidth(wrapWidth, true);
    text.setPosition(textX, y);
    text.setData('baseY', y);
    return y + Math.max(text.height, icon ? CONTENT_ICON_SIZE : 0) + ROW_GAP;
  }

  private addCompactTableRow(row: RightSidebarCompactTableRow, y: number): number {
    if (row.columns.length === 0) return y;
    const contentWidth = this.getContentWidth() - 20;
    const totalWeight = row.columns.reduce((sum, column) => sum + Math.max(0.01, column.weight), 0);
    const widths = row.columns.map((column) => contentWidth * Math.max(0.01, column.weight) / totalWeight);
    const headerHeight = 30;
    const bodyHeight = 30;
    const padding = 4;

    const addCell = (
      value: string,
      columnIndex: number,
      cellY: number,
      color: string,
      fontStyle: 'normal' | 'bold',
    ): void => {
      const left = PANEL_PADDING + widths.slice(0, columnIndex).reduce((sum, width) => sum + width, 0);
      const width = widths[columnIndex];
      const align = row.columns[columnIndex].align ?? 'left';
      const text = this.addContentText(value, 10, color, fontStyle, Math.max(1, width - padding * 2));
      text.setOrigin(align === 'right' ? 1 : align === 'center' ? 0.5 : 0, 0);
      text.setPosition(
        align === 'right' ? left + width - padding : align === 'center' ? left + width / 2 : left + padding,
        cellY + 7,
      );
      text.setData('baseY', cellY + 7);
      text.setCrop(0, 0, Math.max(1, width - padding * 2), bodyHeight);
    };

    const header = this.addOwned(new Phaser.GameObjects.Rectangle(
      this.scene, PANEL_PADDING, y, contentWidth, headerHeight, 0x17364a, 0.95,
    )).setOrigin(0, 0).setScrollFactor(0);
    header.setData('baseY', y);
    this.panelContainer.add(header);
    this.contentObjects.push(header);
    header.setMask(this.contentMask);
    row.columns.forEach((column, index) => addCell(column.label, index, y, '#c8d7e6', 'bold'));

    let cursorY = y + headerHeight;
    row.rows.forEach((cells, rowIndex) => {
      if (rowIndex % 2 === 1) {
        const stripe = this.addOwned(new Phaser.GameObjects.Rectangle(
          this.scene, PANEL_PADDING, cursorY, contentWidth, bodyHeight, 0x102838, 0.55,
        )).setOrigin(0, 0).setScrollFactor(0);
        stripe.setData('baseY', cursorY);
        this.panelContainer.add(stripe);
        this.contentObjects.push(stripe);
        stripe.setMask(this.contentMask);
      }
      row.columns.forEach((_column, index) => addCell(cells[index] ?? '', index, cursorY, '#edf4ff', 'normal'));
      cursorY += bodyHeight;
    });
    return cursorY + ROW_GAP;
  }

  private addSearchInputRow(row: RightSidebarSearchInputRow, y: number): number {
    const height = 34;
    const input = document.createElement('input');
    input.type = 'search';
    input.value = row.value;
    input.placeholder = row.placeholder;
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.className = 'right-sidebar-search-input';
    input.style.cssText = `
      position: fixed;
      z-index: ${DEPTH + 20};
      width: ${this.getContentWidth()}px;
      height: ${height}px;
      box-sizing: border-box;
      border: 1px solid rgba(126, 183, 214, 0.55);
      border-radius: 7px;
      background: rgba(8, 17, 25, 0.96);
      color: #edf4ff;
      outline: none;
      padding: 6px 10px;
      font: 15px Arial, sans-serif;
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.25);
    `;
    input.addEventListener('input', () => {
      row.onChange(input.value);
      this.focusSearchInputAfterRender = true;
      this.renderActiveContent();
    });
    input.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    input.addEventListener('wheel', (event) => {
      event.stopPropagation();
    });
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
    });
    input.addEventListener('keyup', (event) => {
      event.stopPropagation();
    });
    document.body.append(input);

    const contentInput: ContentInput = { element: input, baseY: y, height, x: PANEL_PADDING, width: this.getContentWidth() };
    this.contentInputs.push(contentInput);
    this.positionContentInput(contentInput);
    if (this.focusSearchInputAfterRender) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      this.focusSearchInputAfterRender = false;
    }
    return y + height + ROW_GAP;
  }

  private addSelectRow(row: RightSidebarSelectRow, y: number, x = PANEL_PADDING, width = this.getContentWidth()): number {
    const label = this.addContentText(row.label, 13, '#a8b6c8', 'bold', width);
    label.setPosition(x, y);
    label.setData('baseY', y);

    const height = 34;
    const selectY = y + label.height + 4;
    const select = document.createElement('select');
    select.value = row.value;
    select.disabled = row.disabled ?? false;
    select.className = 'right-sidebar-select';
    select.style.cssText = `
      position: fixed;
      z-index: ${DEPTH + 20};
      width: ${width}px;
      height: ${height}px;
      box-sizing: border-box;
      border: 1px solid rgba(126, 183, 214, 0.55);
      border-radius: 7px;
      background: rgba(8, 17, 25, 0.98);
      color: #edf4ff;
      outline: none;
      padding: 6px 10px;
      font: 15px Arial, sans-serif;
    `;
    for (const option of row.options) {
      const element = document.createElement('option');
      element.value = option.value;
      element.textContent = option.label;
      element.selected = option.value === row.value;
      select.append(element);
    }
    select.addEventListener('change', () => {
      row.onChange(select.value);
    });
    for (const eventName of ['pointerdown', 'wheel', 'keydown', 'keyup']) {
      select.addEventListener(eventName, (event) => event.stopPropagation());
    }
    document.body.append(select);
    const contentInput: ContentInput = { element: select, baseY: selectY, height, x, width };
    this.contentInputs.push(contentInput);
    this.positionContentInput(contentInput);
    return selectY + height + ROW_GAP;
  }

  private addRelationsTableRow(row: RightSidebarRelationsTableRow, y: number): number {
    const numericColWidth = 70;
    const numericCols = 4;
    const leaderX = PANEL_PADDING;
    // Right edges of numeric columns, ordered Trust, Affinity, Fear, Hostility.
    const numericRightEdges: number[] = [];
    for (let i = 0; i < numericCols; i++) {
      numericRightEdges.push(PANEL_PADDING + CONTENT_WIDTH - (numericCols - 1 - i) * numericColWidth);
    }
    const leaderColWidth = numericRightEdges[0] - numericColWidth - leaderX;

    const placeLeft = (text: Phaser.GameObjects.Text, x: number, ty: number): void => {
      text.setOrigin(0, 0);
      text.setPosition(x, ty);
      text.setData('baseY', ty);
    };
    const placeRight = (text: Phaser.GameObjects.Text, rightX: number, ty: number): void => {
      text.setOrigin(1, 0);
      text.setPosition(rightX, ty);
      text.setData('baseY', ty);
    };

    // Header.
    const headerY = y;
    const headerLeader = this.addContentText(row.header.leader, 14, '#a8b6c8', 'bold', leaderColWidth);
    placeLeft(headerLeader, leaderX, headerY);
    const headerCells = [row.header.trust, row.header.affinity, row.header.fear, row.header.hostility];
    headerCells.forEach((cell, i) => {
      const text = this.addContentText(cell, 14, '#a8b6c8', 'bold');
      placeRight(text, numericRightEdges[i], headerY);
    });
    const headerHeight = headerLeader.height;

    // Underline below header.
    const underlineY = headerY + headerHeight + 4;
    const underline = this.addOwned(new Phaser.GameObjects.Rectangle(
      this.scene,
      leaderX,
      underlineY,
      CONTENT_WIDTH,
      1,
      0x7f8b99,
      0.32,
    )).setOrigin(0, 0).setScrollFactor(0);
    underline.setData('baseY', underlineY);
    this.panelContainer.add(underline);
    this.contentObjects.push(underline);
    underline.setMask(this.contentMask);

    let cursorY = underlineY + 6;
    const rowVerticalPadding = 5;
    for (const dataRow of row.rows) {
      const leaderText = this.addContentText(dataRow.leader, 15, '#edf4ff', 'normal', leaderColWidth);
      placeLeft(leaderText, leaderX, cursorY);
      const valueCells = [dataRow.trust, dataRow.affinity, dataRow.fear, dataRow.hostility];
      let maxCellHeight = leaderText.height;
      valueCells.forEach((cell, i) => {
        const text = this.addContentText(cell, 15, '#edf4ff', 'normal');
        placeRight(text, numericRightEdges[i], cursorY);
        if (text.height > maxCellHeight) maxCellHeight = text.height;
      });
      cursorY += maxCellHeight + rowVerticalPadding;
    }

    return cursorY + (ROW_GAP - rowVerticalPadding);
  }

  private addContentButton(row: RightSidebarButtonRow, y: number, x = PANEL_PADDING, width = this.getContentWidth()): number {
    const hasIcon = Boolean(row.spritePath && this.canUseContentIcon(row.spritePath));
    const height = hasIcon ? 40 : 34;
    const background = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, x, y, width, height, 0x0f2635, row.disabled ? 0.72 : 0.98))
      .setOrigin(0, 0)
      .setStrokeStyle(1, row.accentColor ?? 0x6fb2d4, row.disabled ? 0.42 : 0.68)
      .setScrollFactor(0);
    background.setData('baseY', y);
    const trailingWidth = row.trailingIcon ? 40 : 0;
    const icon = hasIcon && row.spritePath ? this.addContentIcon(row.spritePath, x + 9, y + 4) : null;
    const iconWidth = icon ? CONTENT_ICON_SIZE + CONTENT_ICON_GAP : 0;
    const label = this.addText(row.text, 15, row.disabled ? '#dbe6f5' : '#ffffff', 'bold', width - 22 - trailingWidth - iconWidth)
      .setAlpha(row.disabled ? 0.96 : 1);
    label.setPosition(x + 11 + iconWidth, y + (height - label.height) / 2);
    label.setData('baseY', y + (height - label.height) / 2);
    const trailingLabel = row.trailingIcon
      ? this.addText(row.trailingIcon, 18, '#ffffff', 'normal', trailingWidth)
        .setOrigin(1, 0)
        .setAlpha(row.disabled ? 0.96 : 1)
      : null;
    if (trailingLabel) {
      trailingLabel.setPosition(x + width - 12, y + 6);
      trailingLabel.setData('baseY', y + 6);
    }
    const hitArea = this.addOwned(new Phaser.GameObjects.Zone(this.scene, x, y, width, height))
      .setOrigin(0, 0)
      .setScrollFactor(0);
    hitArea.setData('baseY', y);
    if (!row.disabled) hitArea.setInteractive({ cursor: 'pointer' });

    const button: ContentButton = { row, background, icon, label, trailingLabel, hitArea, baseY: y, hovered: false, pressed: false };
    this.installContentButtonInput(button);
    const objects = [background, ...(icon ? [icon] : []), label, ...(trailingLabel ? [trailingLabel] : []), hitArea];
    this.panelContainer.add(objects);
    this.contentObjects.push(...objects);
    background.setMask(this.contentMask);
    icon?.setMask(this.contentMask);
    label.setMask(this.contentMask);
    trailingLabel?.setMask(this.contentMask);
    this.contentButtons.push(button);
    this.refreshContentButtonVisual(button);
    return y + height + ROW_GAP;
  }

  private addButtonGroupRow(row: RightSidebarButtonGroupRow, y: number): number {
    const buttons = row.buttons;
    if (buttons.length === 0) return y;
    const GAP = 8;
    const colWidth = Math.floor((this.getContentWidth() - GAP * (buttons.length - 1)) / buttons.length);
    let maxNextY = y;
    let x = PANEL_PADDING;
    for (const btn of buttons) {
      const nextY = this.addContentButton(
        { kind: 'button', text: btn.text, disabled: btn.disabled, accentColor: btn.accentColor, onClick: btn.onClick },
        y,
        x,
        colWidth,
      );
      maxNextY = Math.max(maxNextY, nextY);
      x += colWidth + GAP;
    }
    return maxNextY;
  }

  private addContentIcon(spritePath: string, x: number, y: number): Phaser.GameObjects.Image | null {
    const textureKey = this.getContentIconTextureKey(spritePath);
    if (!this.scene.textures.exists(textureKey)) {
      this.requestContentIcon(spritePath, textureKey);
      return null;
    }
    const icon = this.addOwned(new Phaser.GameObjects.Image(this.scene, x + CONTENT_ICON_SIZE / 2, y + CONTENT_ICON_SIZE / 2, textureKey))
      .setDisplaySize(CONTENT_ICON_SIZE, CONTENT_ICON_SIZE)
      .setScrollFactor(0);
    icon.setData('baseY', y + CONTENT_ICON_SIZE / 2);
    return icon;
  }

  private canUseContentIcon(spritePath: string): boolean {
    const textureKey = this.getContentIconTextureKey(spritePath);
    if (this.failedIconKeys.has(textureKey)) return false;
    if (this.scene.textures.exists(textureKey)) return true;
    this.requestContentIcon(spritePath, textureKey);
    return false;
  }

  private requestContentIcon(spritePath: string, textureKey: string): void {
    if (this.requestedIconKeys.has(textureKey) || this.failedIconKeys.has(textureKey)) return;
    this.requestedIconKeys.add(textureKey);

    const image = new Image();
    image.onload = () => {
      if (!this.scene.textures.exists(textureKey)) {
        this.scene.textures.addImage(textureKey, image);
      }
      if (this.activeMode && !this.collapsed) this.renderActiveContent();
    };
    image.onerror = () => {
      this.failedIconKeys.add(textureKey);
    };
    image.src = spritePath;
  }

  private getContentIconTextureKey(spritePath: string): string {
    return `ui:${spritePath}`;
  }

  private addProgressRow(label: string, current: number, max: number, y: number): number {
    const percent = max > 0 ? Phaser.Math.Clamp(current / max, 0, 1) : 0;
    const text = this.addContentText(`${label}: ${current} / ${max}`, 15, '#cfd9e6');
    text.setPosition(PANEL_PADDING, y);
    text.setData('baseY', y);
    const progressWidth = this.getContentWidth();
    const track = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, PANEL_PADDING, y + 25, progressWidth, 8, 0x223044, 0.9))
      .setOrigin(0, 0.5)
      .setScrollFactor(0);
    track.setData('baseY', y + 25);
    const fill = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, PANEL_PADDING, y + 25, Math.max(2, progressWidth * percent), 8, 0x62c08a, 0.94))
      .setOrigin(0, 0.5)
      .setScrollFactor(0);
    fill.setData('baseY', y + 25);
    this.panelContainer.add([text, track, fill]);
    this.contentObjects.push(text, track, fill);
    text.setMask(this.contentMask);
    track.setMask(this.contentMask);
    fill.setMask(this.contentMask);
    return y + 39;
  }

  private addContentText(
    text: string,
    fontSize: number,
    color: string,
    fontStyle = 'normal',
    wordWrapWidth = this.getContentWidth(),
  ): Phaser.GameObjects.Text {
    const object = this.addText(text, fontSize, color, fontStyle, wordWrapWidth);
    this.panelContainer.add(object);
    this.contentObjects.push(object);
    object.setMask(this.contentMask);
    return object;
  }

  private installContentButtonInput(button: ContentButton): void {
    button.hitArea.on(Phaser.Input.Events.POINTER_OVER, (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (button.row.disabled) return;
      button.hovered = true;
      this.refreshContentButtonVisual(button);
    });
    button.hitArea.on(Phaser.Input.Events.POINTER_OUT, (_pointer: Phaser.Input.Pointer, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      button.hovered = false;
      button.pressed = false;
      this.refreshContentButtonVisual(button);
    });
    button.hitArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (pointer.button !== 0 || button.row.disabled) return;
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
      button.pressed = true;
      this.refreshContentButtonVisual(button);
    });
    button.hitArea.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (pointer.button !== 0 || button.row.disabled) return;
      consumePointerEvent(pointer);
      const shouldClick = button.pressed;
      button.pressed = false;
      this.worldInputGate.releasePointer(pointer.id);
      if (shouldClick) button.row.onClick();
      this.refreshContentButtonVisual(button);
    });
  }

  private refreshContentButtonVisual(button: ContentButton): void {
    const fillColor = button.pressed
      ? 0x2f6688
      : button.hovered
        ? 0x1e4c66
        : button.row.selected
          ? 0x225872
          : 0x0f2635;
    button.background.setFillStyle(fillColor, button.row.disabled ? 0.72 : 0.98);
    button.background.setStrokeStyle(
      button.row.selected ? 2 : 1,
      button.row.accentColor ?? 0x6fb2d4,
      button.hovered || button.row.selected ? 0.95 : button.row.disabled ? 0.42 : 0.68,
    );
    button.label
      .setColor(button.row.disabled ? '#dbe6f5' : '#ffffff')
      .setAlpha(button.row.disabled ? 0.96 : 1);
    button.trailingLabel
      ?.setColor('#ffffff')
      .setAlpha(button.row.disabled ? 0.96 : 1);
  }

  private addText(text: string, fontSize: number, color: string, fontStyle = 'normal', wordWrapWidth?: number): Phaser.GameObjects.Text {
    return this.addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize: `${fontSize}px`,
      fontStyle,
      color,
      wordWrap: wordWrapWidth !== undefined ? { width: wordWrapWidth, useAdvancedWrap: true } : undefined,
    }))
      .setScrollFactor(0)
      .setResolution(getHudTextResolution());
  }

  private addOwned<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.owned.add(object);
    return object;
  }

  private layout(): void {
    const viewportWidth = this.scene.scale.width;
    const viewportHeight = this.scene.scale.height;
    const panelWidth = this.getPanelWidth();
    this.panelHeight = Math.max(260, viewportHeight - PANEL_TOP - PANEL_BOTTOM_MARGIN);
    const panelX = viewportWidth - panelWidth - EDGE_MARGIN;
    const panelY = PANEL_TOP;

    this.container.setPosition(0, 0);
    this.buttonContainer.setPosition(0, 0);
    this.panelContainer.setPosition(panelX, panelY);
    this.panelBackground.setSize(panelWidth, this.panelHeight).setPosition(0, 0);
    this.panelHitArea.setSize(panelWidth, this.panelHeight).setPosition(0, 0);
    this.titleText.setPosition(PANEL_PADDING, PANEL_PADDING);
    const copyX = panelWidth - PANEL_PADDING - LOG_COPY_BUTTON_WIDTH;
    const copyY = PANEL_PADDING - 4;
    this.logCopyButtonBackground.setPosition(copyX, copyY);
    this.logCopyButtonLabel.setPosition(copyX + LOG_COPY_BUTTON_WIDTH / 2, copyY + LOG_COPY_BUTTON_HEIGHT / 2);
    this.logCopyButtonHitArea.setPosition(copyX, copyY);
    this.updateContentMask();
    this.updateScrollbar();

    const visibleButtons = this.modeButtons.filter((b) => b.visible);
    const buttonRowWidth = visibleButtons.length > 0
      ? (BUTTON_DIAMETER * visibleButtons.length) + (BUTTON_GAP * (visibleButtons.length - 1))
      : 0;
    let buttonX = panelX + panelWidth - buttonRowWidth + BUTTON_RADIUS;
    const buttonY = BUTTON_ROW_TOP + BUTTON_RADIUS;
    for (const button of visibleButtons) {
      button.background.setPosition(buttonX, buttonY);
      button.rim.setPosition(buttonX, buttonY);
      button.icon.setPosition(buttonX, buttonY - 1);
      button.label.setPosition(buttonX, buttonY + BUTTON_LABEL_OFFSET);
      button.hitArea.setPosition(buttonX, buttonY + 8);
      buttonX += BUTTON_DIAMETER + BUTTON_GAP;
    }

    const collapseX = panelWidth / 2;
    const collapseY = this.panelHeight - PANEL_PADDING - COLLAPSE_HEIGHT / 2;
    this.collapseBackground.setPosition(collapseX, collapseY);
    this.collapseLabel.setPosition(collapseX + 13, collapseY).setOrigin(0.5);
    this.collapseHitArea.setPosition(collapseX, collapseY);
    this.drawCollapseIcon(collapseX - 54, collapseY);
    this.refreshCollapseVisual();
    this.positionContentObjects();
  }

  private updateContentMask(): void {
    const visibleContentHeight = this.getVisibleContentHeight();
    this.contentMaskGraphics.clear();
    this.contentMaskGraphics.fillStyle(0xffffff, 1);
    this.contentMaskGraphics.fillRect(
      this.panelContainer.x + PANEL_PADDING,
      this.panelContainer.y + this.scrollableContentTop - 2,
      this.getContentWidth(),
      visibleContentHeight + 4,
    );
  }

  private positionContentObjects(): void {
    const contentTop = this.scrollableContentTop;
    const contentBottom = this.scrollableContentTop + this.getVisibleContentHeight();
    for (const button of this.contentButtons) {
      const visibleY = button.baseY - this.scrollOffset;
      button.background.setY(visibleY);
      button.icon?.setY(visibleY + 4 + CONTENT_ICON_SIZE / 2);
      button.label.setY(visibleY + (button.background.height - button.label.height) / 2);
      button.trailingLabel?.setY(visibleY + 6);
      button.hitArea.setY(visibleY);
      const inView = visibleY + button.background.height >= contentTop && visibleY <= contentBottom;
      if (inView && !button.row.disabled) {
        if (!button.hitArea.input?.enabled) button.hitArea.setInteractive({ cursor: 'pointer' });
      } else {
        button.hitArea.disableInteractive();
      }
    }
    for (const object of this.contentObjects) {
      const data = object.getData('baseY') as number | undefined;
      if (data !== undefined) {
        const fixedY = object.getData('fixedY') as boolean | undefined;
        setGameObjectY(object, fixedY ? data : data - this.scrollOffset);
      }
    }
    for (const input of this.contentInputs) {
      this.positionContentInput(input);
    }
    this.updateScrollbar();
  }

  private positionContentInput(input: ContentInput): void {
    const rect = this.scene.game.canvas.getBoundingClientRect();
    const visibleY = input.baseY - this.scrollOffset;
    const contentTop = this.scrollableContentTop;
    const contentBottom = this.scrollableContentTop + this.getVisibleContentHeight();
    const inView = visibleY + input.height >= contentTop && visibleY <= contentBottom;
    input.element.style.display = !this.collapsed && inView ? 'block' : 'none';
    input.element.style.left = `${rect.left + this.panelContainer.x + input.x}px`;
    input.element.style.top = `${rect.top + this.panelContainer.y + visibleY}px`;
    input.element.style.width = `${input.width}px`;
  }

  private applyScroll(delta: number): void {
    const next = Phaser.Math.Clamp(this.scrollOffset + delta, 0, this.maxScroll);
    if (next === this.scrollOffset) return;
    this.scrollOffset = next;
    this.positionContentObjects();
  }

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.draggingScrollbar || this.dragPointerId !== pointer.id || this.maxScroll <= 0) return;
    const trackTravel = this.scrollbarTrack.height - this.scrollbarThumb.height;
    if (trackTravel <= 0) return;

    const deltaY = pointer.y - this.dragStartPointerY;
    const scrollDelta = (deltaY / trackTravel) * this.maxScroll;
    const next = Phaser.Math.Clamp(this.dragStartScrollOffset + scrollDelta, 0, this.maxScroll);
    if (next === this.scrollOffset) return;
    this.scrollOffset = next;
    this.positionContentObjects();
  };

  private readonly handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (!this.draggingScrollbar || this.dragPointerId !== pointer.id) return;
    this.draggingScrollbar = false;
    this.dragPointerId = null;
    this.worldInputGate.releasePointer(pointer.id);
  };

  private updateScrollbar(): void {
    const visibleHeight = this.getVisibleContentHeight();
    const shouldShow = !this.collapsed && this.maxScroll > 0 && this.contentHeight > visibleHeight;
    this.scrollbarTrack.setVisible(shouldShow);
    this.scrollbarThumb.setVisible(shouldShow);
    if (!shouldShow) return;

    const trackHeight = visibleHeight;
    const trackX = this.getPanelWidth() - PANEL_PADDING + SCROLLBAR_MARGIN;
    const trackY = this.scrollableContentTop;
    const thumbHeight = Phaser.Math.Clamp(
      (visibleHeight / this.contentHeight) * trackHeight,
      SCROLLBAR_MIN_THUMB_HEIGHT,
      trackHeight,
    );
    const travel = Math.max(0, trackHeight - thumbHeight);
    const thumbY = trackY + (this.maxScroll > 0 ? (this.scrollOffset / this.maxScroll) * travel : 0);

    this.scrollbarTrack.setPosition(trackX, trackY).setSize(SCROLLBAR_WIDTH, trackHeight);
    this.scrollbarThumb.setPosition(trackX, thumbY).setSize(SCROLLBAR_WIDTH, thumbHeight);
    this.panelContainer.bringToTop(this.scrollbarTrack);
    this.panelContainer.bringToTop(this.scrollbarThumb);
  }

  private destroyContentObjects(): void {
    for (const object of this.contentObjects) object.destroy();
    for (const input of this.contentInputs) input.element.remove();
    this.contentObjects.length = 0;
    this.contentButtons.length = 0;
    this.contentInputs.length = 0;
  }

  private refreshVisibility(): void {
    this.panelContainer.setVisible(!this.collapsed);
    this.refreshLogCopyButtonVisibility();
    for (const input of this.contentInputs) this.positionContentInput(input);
  }

  private installLogCopyButtonInput(): void {
    this.logCopyButtonHitArea.on(Phaser.Input.Events.POINTER_OVER, (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.logCopyButtonHovered = true;
      this.refreshLogCopyButtonVisual();
    });
    this.logCopyButtonHitArea.on(Phaser.Input.Events.POINTER_OUT, (_pointer: Phaser.Input.Pointer, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.logCopyButtonHovered = false;
      this.logCopyButtonPressed = false;
      this.refreshLogCopyButtonVisual();
    });
    this.logCopyButtonHitArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
      this.logCopyButtonPressed = true;
      this.refreshLogCopyButtonVisual();
    });
    this.logCopyButtonHitArea.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (pointer.button !== 0) return;
      consumePointerEvent(pointer);
      const shouldClick = this.logCopyButtonPressed;
      this.logCopyButtonPressed = false;
      this.worldInputGate.releasePointer(pointer.id);
      this.refreshLogCopyButtonVisual();
      if (shouldClick) this.copyLogToClipboard();
    });
  }

  private refreshLogCopyButtonVisibility(): void {
    const visible = !this.collapsed && this.activeMode === 'timeline';
    this.logCopyButtonBackground.setVisible(visible);
    this.logCopyButtonLabel.setVisible(visible);
    this.logCopyButtonHitArea.setVisible(visible);
    if (visible) {
      if (!this.logCopyButtonHitArea.input?.enabled) this.logCopyButtonHitArea.setInteractive({ cursor: 'pointer' });
    } else {
      this.logCopyButtonHitArea.disableInteractive();
    }
  }

  private refreshLogCopyButtonVisual(): void {
    const fillColor = this.logCopyButtonPressed
      ? 0x2f6688
      : this.logCopyButtonHovered
        ? 0x1e789e
        : 0x1d6d90;
    this.logCopyButtonBackground
      .setFillStyle(fillColor, 0.98)
      .setStrokeStyle(1, 0x6ec6ff, this.logCopyButtonHovered ? 0.95 : 0.7);
  }

  private copyLogToClipboard(): void {
    const fullLogText = this.dataProvider.getTimelineText();
    if (!navigator.clipboard?.writeText) {
      console.warn('[RightSidebarPanel] Clipboard API unavailable; timeline was not copied.');
      return;
    }
    navigator.clipboard.writeText(fullLogText)
      .then(() => this.showLogCopyFeedback())
      .catch((error) => {
        console.warn('[RightSidebarPanel] Clipboard copy failed; log was not copied.', error);
      });
  }

  private showLogCopyFeedback(): void {
    this.logCopyButtonLabel.setText('Copied');
    this.logCopyFeedbackTimer?.remove(false);
    this.logCopyFeedbackTimer = this.scene.time.delayedCall(1200, () => {
      this.logCopyButtonLabel.setText('Copy');
      this.logCopyFeedbackTimer = null;
    });
  }

  private refreshButtonVisuals(): void {
    for (const button of this.modeButtons) this.refreshButtonVisual(button);
  }

  private refreshButtonVisual(button: ModeButton): void {
    const isActive = this.activeMode === button.definition.mode && !this.collapsed;
    const fillColor = button.pressed ? button.definition.accentColor : isActive ? 0x18283a : button.hovered ? 0x1d2e40 : 0x101b27;
    const scale = button.pressed ? 0.95 : button.hovered || isActive ? 1.04 : 1;
    button.background.setFillStyle(fillColor, isActive || button.pressed ? 0.98 : 0.95).setScale(scale);
    button.rim.setStrokeStyle(isActive ? 4 : 3, button.definition.accentColor, isActive ? 0.96 : button.hovered ? 0.82 : 0.58).setScale(scale);
    button.icon.setScale(scale);
    button.label.setColor(isActive ? '#ffffff' : '#dce7f4');
  }

  private refreshCollapseVisual(): void {
    const fillColor = this.collapsePressed ? 0x22344a : this.collapseHovered ? 0x172638 : 0x101b27;
    this.collapseBackground.setFillStyle(fillColor, 0.96);
    this.collapseBackground.setStrokeStyle(this.collapseHovered ? 2 : 1, 0x92a8c0, this.collapseHovered ? 0.75 : 0.5);
    this.collapseLabel.setColor(this.collapseHovered ? '#ffffff' : '#e6edf7');
  }

  private drawCollapseIcon(centerX: number, centerY: number): void {
    this.collapseIcon.clear();
    this.collapseIcon.lineStyle(3, 0xe6edf7, 0.92);
    this.collapseIcon.beginPath();
    this.collapseIcon.moveTo(centerX - 11, centerY - 8);
    this.collapseIcon.lineTo(centerX, centerY + 4);
    this.collapseIcon.lineTo(centerX + 11, centerY - 8);
    this.collapseIcon.strokePath();
    this.collapseIcon.lineStyle(2, 0x92a8c0, 0.65);
    this.collapseIcon.strokeRoundedRect(centerX - 18, centerY - 15, 36, 28, 8);
  }

  private getVisibleContentHeight(): number {
    return Math.max(120, this.panelHeight - this.scrollableContentTop - CONTENT_BOTTOM_GAP);
  }

  private getPanelWidth(): number {
    if (this.activeMode === 'leaderboard') return LEADERBOARD_PANEL_WIDTH;
    if (this.activeMode === 'trading') {
      // Up to half the viewport, but never narrower than the standard panel.
      return Math.max(PANEL_WIDTH, Math.round(this.scene.scale.width * TRADING_PANEL_WIDTH_FRACTION));
    }
    return PANEL_WIDTH;
  }

  private getContentWidth(): number {
    return this.getPanelWidth() - PANEL_PADDING * 2;
  }

  private isPointerOverPanel(pointer: Phaser.Input.Pointer): boolean {
    const panelWidth = this.getPanelWidth();
    const panelX = this.scene.scale.width - panelWidth - EDGE_MARGIN;
    const panelY = PANEL_TOP;
    return pointer.x >= panelX
      && pointer.x <= panelX + panelWidth
      && pointer.y >= panelY
      && pointer.y <= panelY + this.panelHeight;
  }

  private containsScreenPoint(screenX: number, screenY: number): boolean {
    const panelWidth = this.getPanelWidth();
    const panelBounds = new Phaser.Geom.Rectangle(
      this.scene.scale.width - panelWidth - EDGE_MARGIN,
      PANEL_TOP,
      panelWidth,
      this.panelHeight,
    );
    if (!this.collapsed && panelBounds.contains(screenX, screenY)) return true;
    return this.modeButtons.filter((b) => b.visible).some((button) => button.hitArea.getBounds().contains(screenX, screenY));
  }
}

function getHudTextResolution(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}

function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function setGameObjectY(object: Phaser.GameObjects.GameObject, y: number): void {
  if (object instanceof Phaser.GameObjects.Text
    || object instanceof Phaser.GameObjects.Rectangle
    || object instanceof Phaser.GameObjects.Zone
    || object instanceof Phaser.GameObjects.Image) {
    object.setY(y);
  }
}
