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
  RightSidebarRow,
} from './RightSidebarPanelTypes';

interface ModeDefinition {
  mode: RightSidebarPanelMode;
  icon: string;
  label: string;
  accentColor: number;
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

const DEPTH = 1200;
const EDGE_MARGIN = 16;
const PANEL_WIDTH = 560;
const PANEL_TOP = 124;
const PANEL_BOTTOM_MARGIN = 22;
const PANEL_PADDING = 24;
const CONTENT_TOP = 74;
const CONTENT_BOTTOM_GAP = 78;
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
const WHEEL_BLOCKER_ID = 'right-sidebar-panel';
const LEADERBOARD_TAB_GAP = 8;
const LEADERBOARD_TAB_HEIGHT = 34;
const CITY_TAB_GAP = 8;
const CITY_TAB_HEIGHT = 34;
const LEADER_TAB_GAP = 8;
const LEADER_TAB_HEIGHT = 34;
const CONTENT_ICON_SIZE = 32;
const CONTENT_ICON_GAP = 8;

const MODES: ModeDefinition[] = [
  { mode: 'details', icon: '🔍', label: 'Details', accentColor: 0x6ec6ff },
  { mode: 'leaderboard', icon: '🏆', label: 'Leaderboard', accentColor: 0xf4d06f },
  { mode: 'log', icon: '📄', label: 'Log', accentColor: 0xc7d2fe },
];

const LEADERBOARD_CATEGORIES: Array<{
  id: RightSidebarLeaderboardCategory;
  label: string;
  accentColor: number;
}> = [
  { id: 'domination', label: '⚔️ Domination', accentColor: 0xf08a7e },
  { id: 'diplomacy', label: '🕊️ Diplomacy', accentColor: 0xa7f3d0 },
  { id: 'research', label: '🔬 Research', accentColor: 0x6ec6ff },
  { id: 'culture', label: '⭐ Culture', accentColor: 0xc084fc },
];

const CITY_DETAIL_TABS: Array<{
  id: RightSidebarCityDetailsTab;
  label: string;
  accentColor: number;
}> = [
  { id: 'city', label: '🏠 City', accentColor: 0x7fb4d5 },
  { id: 'growth', label: '👶 Growth', accentColor: 0x86efac },
  { id: 'output', label: '📈 Output', accentColor: 0xf4d06f },
  { id: 'production', label: '⏳ Queue', accentColor: 0xc084fc },
];

const LEADER_DETAIL_TABS: Array<{
  id: RightSidebarLeaderDetailsTab;
  label: string;
  accentColor: number;
}> = [
  { id: 'details', label: 'Details', accentColor: 0x7fb4d5 },
  { id: 'diplomacy', label: 'Diplomacy', accentColor: 0xa7f3d0 },
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
  private readonly contentMaskGraphics: Phaser.GameObjects.Graphics;
  private readonly contentMask: Phaser.Display.Masks.GeometryMask;
  private readonly collapseBackground: Phaser.GameObjects.Rectangle;
  private readonly collapseIcon: Phaser.GameObjects.Graphics;
  private readonly collapseLabel: Phaser.GameObjects.Text;
  private readonly collapseHitArea: Phaser.GameObjects.Zone;
  private readonly modeButtons: ModeButton[];
  private readonly contentObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly contentButtons: ContentButton[] = [];
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
  private collapsed = true;
  private collapseHovered = false;
  private collapsePressed = false;
  private panelHeight = 260;
  private scrollOffset = 0;
  private maxScroll = 0;
  private contentHeight = 0;
  private leaderboardCategory: RightSidebarLeaderboardCategory = 'domination';
  private cityDetailsTab: RightSidebarCityDetailsTab = 'city';
  private leaderDetailsTab: RightSidebarLeaderDetailsTab = 'details';
  private pendingDiplomacyPrimaryNationId: string | null = null;
  private pendingDiplomacySecondaryNationId: string | null = null;
  private shownDiplomacyPrimaryNationId: string | null = null;
  private shownDiplomacySecondaryNationId: string | null = null;
  private openDiplomacyDropdown: 'primary' | 'secondary' | null = null;
  private lastDetailsCityId: string | null = null;
  private lastDetailsLeaderId: string | null = null;

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
    this.contentMaskGraphics = this.addOwned(new Phaser.GameObjects.Graphics(scene).setScrollFactor(0));
    this.contentMask = this.contentMaskGraphics.createGeometryMask();

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
      this.collapseBackground,
      this.collapseIcon,
      this.collapseLabel,
      this.collapseHitArea,
    ]);
    this.container.add([this.panelContainer, this.buttonContainer]);

    this.modeButtons = MODES.map((definition) => this.createModeButton(definition));
    this.installPanelInput();
    this.installCollapseInput();

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
      if (this.collapsed || this.maxScroll <= 0 || !this.isPointerOverPanelContent(pointer)) return;
      consumePointerEvent(pointer);
      event.preventDefault?.();
      this.applyScroll(Math.sign(deltaY) * SCROLL_STEP);
    };
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);

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
        this.pendingDiplomacyPrimaryNationId = this.dataProvider.getCurrentLeaderNationId();
        this.pendingDiplomacySecondaryNationId = null;
        this.shownDiplomacyPrimaryNationId = null;
        this.shownDiplomacySecondaryNationId = null;
        this.openDiplomacyDropdown = null;
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
    this.activeMode = mode;
    this.collapsed = false;
    this.scrollOffset = 0;
    this.renderActiveContent();
    this.refreshVisibility();
    this.refreshButtonVisuals();
  }

  showDetails(): void {
    this.show('details');
  }

  showProductionTab(): void {
    this.cityDetailsTab = 'production';
    this.show('details');
  }

  collapse(): void {
    this.collapsed = true;
    this.refreshVisibility();
    this.refreshButtonVisuals();
  }

  setDetailsPlaceholder(): void {
    this.dataProvider.clear();
  }

  shutdown(): void {
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    this.scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAddedToScene);
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
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
    const button: ModeButton = { definition, background, rim, icon, label, hitArea, hovered: false, pressed: false };

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
      if (shouldShow) this.show(definition.mode);
      this.refreshButtonVisual(button);
    });

    this.buttonContainer.add([background, rim, icon, label, hitArea]);
    this.refreshButtonVisual(button);
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
    const content = this.ensureRenderableContent(this.getContentForMode(this.activeMode));
    console.debug('[RightSidebarPanel] render content', {
      mode: this.activeMode,
      sections: content.sections.length,
      rows: content.sections.reduce((sum, section) => sum + section.rows.length, 0),
    });
    this.titleText.setText(content.title);
    this.destroyContentObjects();
    this.contentHeight = this.buildContent(content);
    this.maxScroll = Math.max(0, this.contentHeight - this.getVisibleContentHeight());
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset, 0, this.maxScroll);
    this.positionContentObjects();
  }

  private getContentForMode(mode: RightSidebarPanelMode): RightSidebarContent {
    switch (mode) {
      case 'details':
        this.ensureLeaderDiplomacySelection();
        return this.dataProvider.getDetailsContent(
          this.cityDetailsTab,
          this.leaderDetailsTab,
          {
            pendingPrimaryNationId: this.pendingDiplomacyPrimaryNationId,
            pendingSecondaryNationId: this.pendingDiplomacySecondaryNationId,
            shownPrimaryNationId: this.shownDiplomacyPrimaryNationId,
            shownSecondaryNationId: this.shownDiplomacySecondaryNationId,
            openDropdown: this.openDiplomacyDropdown,
            onToggleDropdown: (dropdown) => this.toggleDiplomacyDropdown(dropdown),
            onSelectPrimary: (nationId) => this.selectDiplomacyPrimaryNation(nationId),
            onSelectSecondary: (nationId) => this.selectDiplomacySecondaryNation(nationId),
            onShowDetails: () => this.showDiplomacyComparisonDetails(),
          },
        );
      case 'leaderboard':
        return this.dataProvider.getLeaderboardContent(this.leaderboardCategory);
      case 'log':
        return this.dataProvider.getLogContent();
    }
  }

  private ensureLeaderDiplomacySelection(): void {
    if (this.activeMode !== 'details' || this.dataProvider.getView() !== 'leader' || this.leaderDetailsTab !== 'diplomacy') {
      return;
    }

    const visibleNations = this.dataProvider.getVisibleLeaderDiplomacyNations();
    const visibleIds = new Set(visibleNations.map((nation) => nation.id));
    const leaderNationId = this.dataProvider.getCurrentLeaderNationId();
    const preferredPrimary = leaderNationId && visibleIds.has(leaderNationId)
      ? leaderNationId
      : visibleNations[0]?.id ?? null;

    if (!this.pendingDiplomacyPrimaryNationId || !visibleIds.has(this.pendingDiplomacyPrimaryNationId)) {
      this.pendingDiplomacyPrimaryNationId = preferredPrimary;
    }

    if (
      !this.pendingDiplomacySecondaryNationId ||
      !visibleIds.has(this.pendingDiplomacySecondaryNationId) ||
      this.pendingDiplomacySecondaryNationId === this.pendingDiplomacyPrimaryNationId
    ) {
      this.pendingDiplomacySecondaryNationId = this.getFirstOtherDiplomacyNationId(this.pendingDiplomacyPrimaryNationId);
    }

    if (
      this.shownDiplomacyPrimaryNationId &&
      (!visibleIds.has(this.shownDiplomacyPrimaryNationId) || !visibleIds.has(this.shownDiplomacySecondaryNationId ?? ''))
    ) {
      this.shownDiplomacyPrimaryNationId = null;
      this.shownDiplomacySecondaryNationId = null;
    }
  }

  private toggleDiplomacyDropdown(dropdown: 'primary' | 'secondary'): void {
    this.openDiplomacyDropdown = this.openDiplomacyDropdown === dropdown ? null : dropdown;
    this.renderActiveContent();
  }

  private selectDiplomacyPrimaryNation(nationId: string): void {
    this.pendingDiplomacyPrimaryNationId = nationId;
    if (this.pendingDiplomacySecondaryNationId === nationId) {
      this.pendingDiplomacySecondaryNationId = this.getFirstOtherDiplomacyNationId(nationId);
    }
    if (!this.pendingDiplomacySecondaryNationId) {
      this.pendingDiplomacySecondaryNationId = this.getFirstOtherDiplomacyNationId(nationId);
    }
    this.openDiplomacyDropdown = null;
    this.scrollOffset = 0;
    this.renderActiveContent();
  }

  private selectDiplomacySecondaryNation(nationId: string): void {
    if (nationId === this.pendingDiplomacyPrimaryNationId) return;
    this.pendingDiplomacySecondaryNationId = nationId;
    this.openDiplomacyDropdown = null;
    this.scrollOffset = 0;
    this.renderActiveContent();
  }

  private showDiplomacyComparisonDetails(): void {
    if (
      !this.pendingDiplomacyPrimaryNationId ||
      !this.pendingDiplomacySecondaryNationId ||
      this.pendingDiplomacyPrimaryNationId === this.pendingDiplomacySecondaryNationId
    ) {
      return;
    }
    this.shownDiplomacyPrimaryNationId = this.pendingDiplomacyPrimaryNationId;
    this.shownDiplomacySecondaryNationId = this.pendingDiplomacySecondaryNationId;
    this.openDiplomacyDropdown = null;
    this.renderActiveContent();
  }

  private getFirstOtherDiplomacyNationId(primaryNationId: string | null): string | null {
    return this.dataProvider.getVisibleLeaderDiplomacyNations()
      .find((nation) => nation.id !== primaryNationId)?.id ?? null;
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
    if (this.activeMode === 'details' && this.dataProvider.getView() === 'city') {
      y = this.addCityDetailsTabs(y);
    }
    if (this.activeMode === 'details' && this.dataProvider.getView() === 'leader') {
      y = this.addLeaderDetailsTabs(y);
    }
    if (this.activeMode === 'leaderboard') {
      y = this.addLeaderboardTabs(y);
    }
    for (const section of content.sections) {
      const heading = this.addContentText(section.title, 17, '#91a9c4', 'bold');
      heading.setPosition(PANEL_PADDING, y);
      heading.setData('baseY', y);
      y += heading.height + 9;
      for (const row of section.rows) {
        y = this.addContentRow(row, y);
      }
      y += SECTION_GAP;
    }
    return y - CONTENT_TOP;
  }

  private addLeaderboardTabs(y: number): number {
    const tabWidth = (CONTENT_WIDTH - LEADERBOARD_TAB_GAP * (LEADERBOARD_CATEGORIES.length - 1)) / LEADERBOARD_CATEGORIES.length;
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

      const hitArea = this.addOwned(new Phaser.GameObjects.Zone(this.scene, x, y, tabWidth, LEADER_TAB_HEIGHT))
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
        if (this.leaderDetailsTab !== tab.id) {
          this.leaderDetailsTab = tab.id;
          if (tab.id === 'diplomacy') this.ensureLeaderDiplomacySelection();
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
      x += tabWidth + LEADER_TAB_GAP;
    }
    return y + LEADER_TAB_HEIGHT + SECTION_GAP;
  }

  private addContentRow(row: RightSidebarRow, y: number): number {
    switch (row.kind) {
      case 'text': {
        const hasAccent = row.color !== undefined;
        const icon = row.spritePath ? this.addContentIcon(row.spritePath, PANEL_PADDING + (hasAccent ? 15 : 0), y + 1) : null;
        const iconWidth = icon ? CONTENT_ICON_SIZE + CONTENT_ICON_GAP : 0;
        const textX = (hasAccent ? PANEL_PADDING + 15 : PANEL_PADDING) + iconWidth;
        const wrapWidth = (hasAccent ? CONTENT_WIDTH - 15 : CONTENT_WIDTH) - iconWidth;
        const color = row.muted ? '#c1cbd8' : row.large ? '#ffffff' : '#edf4ff';
        if (hasAccent) {
          const marker = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, PANEL_PADDING, y + 5, 6, Math.max(14, row.large ? 20 : 16), row.color, 0.95))
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
      case 'button':
        return this.addContentButton(row, y);
      case 'progress':
        return this.addProgressRow(row.label, row.current, row.max, y);
      case 'separator': {
        const line = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, PANEL_PADDING, y + 6, CONTENT_WIDTH, 1, 0x7f8b99, 0.28))
          .setOrigin(0, 0)
          .setScrollFactor(0);
        line.setData('baseY', y + 6);
        this.panelContainer.add(line);
        this.contentObjects.push(line);
        line.setMask(this.contentMask);
        return y + 16;
      }
    }
  }

  private addContentButton(row: RightSidebarButtonRow, y: number): number {
    const hasIcon = Boolean(row.spritePath && this.canUseContentIcon(row.spritePath));
    const height = hasIcon ? 40 : 34;
    const background = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, PANEL_PADDING, y, CONTENT_WIDTH, height, 0x0f2635, row.disabled ? 0.72 : 0.98))
      .setOrigin(0, 0)
      .setStrokeStyle(1, row.accentColor ?? 0x6fb2d4, row.disabled ? 0.42 : 0.68)
      .setScrollFactor(0);
    background.setData('baseY', y);
    const trailingWidth = row.trailingIcon ? 40 : 0;
    const icon = hasIcon && row.spritePath ? this.addContentIcon(row.spritePath, PANEL_PADDING + 9, y + 4) : null;
    const iconWidth = icon ? CONTENT_ICON_SIZE + CONTENT_ICON_GAP : 0;
    const label = this.addText(row.text, 15, row.disabled ? '#dbe6f5' : '#ffffff', 'bold', CONTENT_WIDTH - 22 - trailingWidth - iconWidth)
      .setAlpha(row.disabled ? 0.96 : 1);
    label.setPosition(PANEL_PADDING + 11 + iconWidth, y + (height - label.height) / 2);
    label.setData('baseY', y + (height - label.height) / 2);
    const trailingLabel = row.trailingIcon
      ? this.addText(row.trailingIcon, 18, '#ffffff', 'normal', trailingWidth)
        .setOrigin(1, 0)
        .setAlpha(row.disabled ? 0.96 : 1)
      : null;
    if (trailingLabel) {
      trailingLabel.setPosition(PANEL_PADDING + CONTENT_WIDTH - 12, y + 6);
      trailingLabel.setData('baseY', y + 6);
    }
    const hitArea = this.addOwned(new Phaser.GameObjects.Zone(this.scene, PANEL_PADDING, y, CONTENT_WIDTH, height))
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
    const track = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, PANEL_PADDING, y + 25, CONTENT_WIDTH, 8, 0x223044, 0.9))
      .setOrigin(0, 0.5)
      .setScrollFactor(0);
    track.setData('baseY', y + 25);
    const fill = this.addOwned(new Phaser.GameObjects.Rectangle(this.scene, PANEL_PADDING, y + 25, Math.max(2, CONTENT_WIDTH * percent), 8, 0x62c08a, 0.94))
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
    wordWrapWidth = CONTENT_WIDTH,
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
    this.panelHeight = Math.max(260, viewportHeight - PANEL_TOP - PANEL_BOTTOM_MARGIN);
    const panelX = viewportWidth - PANEL_WIDTH - EDGE_MARGIN;
    const panelY = PANEL_TOP;

    this.container.setPosition(0, 0);
    this.buttonContainer.setPosition(0, 0);
    this.panelContainer.setPosition(panelX, panelY);
    this.panelBackground.setSize(PANEL_WIDTH, this.panelHeight).setPosition(0, 0);
    this.panelHitArea.setSize(PANEL_WIDTH, this.panelHeight).setPosition(0, 0);
    this.titleText.setPosition(PANEL_PADDING, PANEL_PADDING);
    this.updateContentMask();

    const buttonRowWidth = (BUTTON_DIAMETER * this.modeButtons.length) + (BUTTON_GAP * (this.modeButtons.length - 1));
    let buttonX = panelX + PANEL_WIDTH - buttonRowWidth + BUTTON_RADIUS;
    const buttonY = BUTTON_ROW_TOP + BUTTON_RADIUS;
    for (const button of this.modeButtons) {
      button.background.setPosition(buttonX, buttonY);
      button.rim.setPosition(buttonX, buttonY);
      button.icon.setPosition(buttonX, buttonY - 1);
      button.label.setPosition(buttonX, buttonY + BUTTON_LABEL_OFFSET);
      button.hitArea.setPosition(buttonX, buttonY + 8);
      buttonX += BUTTON_DIAMETER + BUTTON_GAP;
    }

    const collapseX = PANEL_WIDTH / 2;
    const collapseY = this.panelHeight - PANEL_PADDING - COLLAPSE_HEIGHT / 2;
    this.collapseBackground.setPosition(collapseX, collapseY);
    this.collapseLabel.setPosition(collapseX + 13, collapseY).setOrigin(0.5);
    this.collapseHitArea.setPosition(collapseX, collapseY);
    this.drawCollapseIcon(collapseX - 54, collapseY);
    this.refreshCollapseVisual();
    this.positionContentObjects();
  }

  private updateContentMask(): void {
    this.contentMaskGraphics.clear();
    this.contentMaskGraphics.fillStyle(0xffffff, 1);
    this.contentMaskGraphics.fillRect(
      this.panelContainer.x + PANEL_PADDING,
      this.panelContainer.y + CONTENT_TOP - 2,
      CONTENT_WIDTH,
      this.getVisibleContentHeight() + 4,
    );
  }

  private positionContentObjects(): void {
    for (const button of this.contentButtons) {
      const visibleY = button.baseY - this.scrollOffset;
      button.background.setY(visibleY);
      button.icon?.setY(visibleY + 4 + CONTENT_ICON_SIZE / 2);
      button.label.setY(visibleY + (button.background.height - button.label.height) / 2);
      button.trailingLabel?.setY(visibleY + 6);
      button.hitArea.setY(visibleY);
      const inView = visibleY + button.background.height >= CONTENT_TOP && visibleY <= CONTENT_TOP + this.getVisibleContentHeight();
      if (inView && !button.row.disabled) {
        if (!button.hitArea.input?.enabled) button.hitArea.setInteractive({ cursor: 'pointer' });
      } else {
        button.hitArea.disableInteractive();
      }
    }
    for (const object of this.contentObjects) {
      const data = object.getData('baseY') as number | undefined;
      if (data !== undefined) {
        setGameObjectY(object, data - this.scrollOffset);
      }
    }
  }

  private applyScroll(delta: number): void {
    const next = Phaser.Math.Clamp(this.scrollOffset + delta, 0, this.maxScroll);
    if (next === this.scrollOffset) return;
    this.scrollOffset = next;
    this.positionContentObjects();
  }

  private destroyContentObjects(): void {
    for (const object of this.contentObjects) object.destroy();
    this.contentObjects.length = 0;
    this.contentButtons.length = 0;
  }

  private refreshVisibility(): void {
    this.panelContainer.setVisible(!this.collapsed);
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
    return Math.max(120, this.panelHeight - CONTENT_TOP - CONTENT_BOTTOM_GAP);
  }

  private isPointerOverPanelContent(pointer: Phaser.Input.Pointer): boolean {
    const panelX = this.scene.scale.width - PANEL_WIDTH - EDGE_MARGIN;
    const panelY = PANEL_TOP;
    return pointer.x >= panelX + PANEL_PADDING
      && pointer.x <= panelX + PANEL_PADDING + CONTENT_WIDTH
      && pointer.y >= panelY + CONTENT_TOP
      && pointer.y <= panelY + CONTENT_TOP + this.getVisibleContentHeight();
  }

  private containsScreenPoint(screenX: number, screenY: number): boolean {
    const panelBounds = new Phaser.Geom.Rectangle(
      this.scene.scale.width - PANEL_WIDTH - EDGE_MARGIN,
      PANEL_TOP,
      PANEL_WIDTH,
      this.panelHeight,
    );
    if (!this.collapsed && panelBounds.contains(screenX, screenY)) return true;
    return this.modeButtons.some((button) => button.hitArea.getBounds().contains(screenX, screenY));
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
