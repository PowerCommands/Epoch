import Phaser from 'phaser';
import type { ScreenRect } from '../../types/screenRect';
import type { UnitActionMode } from '../UnitActionToolbox';
import type { HudResourceEntry } from './NationHudDataProvider';
import type { DiplomaticProposal } from '../../systems/diplomacy/DiplomaticProposal';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import type { PolicySystem } from '../../systems/PolicySystem';
import type { MapLensMode } from '../../types/mapLens';
import { RafScheduler } from '../../utils/RafScheduler';
import type { UnitActionToolbox } from '../UnitActionToolbox';
import { CultureHudPanel } from './CultureHudPanel';
import { DependencyTreeDialog } from './DependencyTreeDialog';
import { DiscoveryPopup, type DiscoveryPopupData } from './DiscoveryPopup';
import { EndTurnHudButton } from './EndTurnHudButton';
import { GamesOfNationsHud } from './GamesOfNationsHud';
import type { GamesOfNationsUiModel } from './GamesOfNationsUiModel';
import type { GamesOfNationsSport, GamesOfNationsSportId, GamesOfNationsSportValues } from '../../types/gamesOfNations';
import { IdleCitiesHudIndicator } from './IdleCitiesHudIndicator';
import { MapLensToggleHud } from './MapLensToggleHud';
import type { NationHudDataProvider } from './NationHudDataProvider';
import { PolicyDialog } from './PolicyDialog';
import { ProposalDialog, type ProposalDialogContext } from './ProposalDialog';
import { ResearchHudPanel } from './ResearchHudPanel';
import { TopResourceBar } from './TopResourceBar';
import { UnitActionHudToolbox } from './UnitActionHudToolbox';
import { WorldCouncilContributionDialog, type WorldCouncilContributionDialogState } from './WorldCouncilContributionDialog';
import { WorldCouncilFoundationDialog, type WorldCouncilFoundationDialogState, type WorldCouncilFoundationOffer } from './WorldCouncilFoundationDialog';
import { WorldCouncilOverviewDialog, type WorldCouncilOverviewState } from './WorldCouncilOverviewDialog';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';

interface HudLayerConfig {
  humanNationId: string | undefined;
  dataProvider: NationHudDataProvider;
  policySystem: PolicySystem;
  unitActionToolbox: UnitActionToolbox;
  worldInputGate: WorldInputGate;
  proposalContext: ProposalDialogContext;
  onEndTurn: () => void;
  getIdleCityIds: () => string[];
  onOpenIdleCity: (cityId: string) => void;
  onSelectResearch: (technologyId: string) => boolean;
  onSelectCultureNode: (nodeId: string) => boolean;
  onPoliciesChanged: (nationId: string) => void;
  onAcceptProposal: (proposalId: string) => void;
  onRejectProposal: (proposalId: string) => void;
  onDiscoveryClosed: () => void;
  getGamesOfNationsModel: () => GamesOfNationsUiModel;
  onGamesParticipationDecision: (participating: boolean) => boolean;
  onGamesHostingDecision: (accept: boolean) => boolean;
  onGamesHostCitySelected: (cityId: string) => boolean;
  onGamesSportAuctionBid: (sportId: GamesOfNationsSportId, bid: number) => boolean;
  onGamesSportAuctionAbstain: () => boolean;
  onApplyGamesStrategy: (
    culture: number,
    baseProduction: number,
    strategy: GamesOfNationsSportValues,
    hostBonusSport?: GamesOfNationsSport,
  ) => boolean;
  onGamesStrategyAdjustmentSeen: () => void;
  onAllocateGamesPoints: (sport: GamesOfNationsSport, amount: number) => boolean;
  onDistributeRemainingGamesPoints: () => boolean;
  onToggleMapLens: () => void;
  onToggleResourceMapLens: () => void;
  getWorldCouncilFoundationState?: () => WorldCouncilFoundationDialogState | null;
  getWorldCouncilOverviewState?: () => WorldCouncilOverviewState | null;
  getWorldCouncilContributionState?: () => WorldCouncilContributionDialogState | null;
  onFoundWorldCouncil?: (offer: WorldCouncilFoundationOffer) => boolean;
  onSubmitWorldCouncilContribution?: (offer: WorldCouncilFoundationOffer) => boolean;
  onLeaveWorldCouncil?: () => boolean;
  isDiagnosticsEnabled?: () => boolean;
}

export class HudLayer {
  private readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
  private readonly owned = new Set<Phaser.GameObjects.GameObject>();
  private readonly onResize: () => void;
  private readonly onAddedToScene: (go: Phaser.GameObjects.GameObject) => void;
  private readonly scheduler = new RafScheduler();
  private readonly endTurnButton: EndTurnHudButton;
  private readonly idleCitiesIndicator: IdleCitiesHudIndicator;
  private readonly topResourceBar: TopResourceBar;
  private readonly researchPanel: ResearchHudPanel;
  private readonly culturePanel: CultureHudPanel;
  private readonly gamesOfNationsHud: GamesOfNationsHud;
  private readonly dependencyTreeDialog: DependencyTreeDialog;
  private readonly policyDialog: PolicyDialog;
  private readonly unitActionHudToolbox: UnitActionHudToolbox;
  private readonly proposalDialog: ProposalDialog;
  private readonly discoveryPopup: DiscoveryPopup;
  private readonly mapLensToggle: MapLensToggleHud;
  private readonly worldCouncilDialog: WorldCouncilFoundationDialog;
  private readonly worldCouncilContributionDialog: WorldCouncilContributionDialog;
  private readonly worldCouncilOverviewDialog: WorldCouncilOverviewDialog;
  private readonly worldCouncilButton: Phaser.GameObjects.Rectangle;
  private readonly worldCouncilButtonText: Phaser.GameObjects.Text;
  private readonly worldCouncilButtonHitArea: Phaser.GameObjects.Zone;
  private mapLensBottomReserved = 0;
  private readonly proposalQueue: DiplomaticProposal[] = [];
  private readonly discoveryQueue: DiscoveryPopupData[] = [];
  private idleCityIds: string[] = [];
  private idleCityCursor = 0;
  private nextIdleCityId: string | null = null;
  private readonly handlePointerRelease = (pointer: Phaser.Input.Pointer): void => {
    this.config.worldInputGate.releasePointer(pointer.id);
  };
  private endTurnEnabled = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: HudLayerConfig,
  ) {
    this.uiCamera = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height);
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.setZoom(1);
    this.uiCamera.roundPixels = true;
    this.uiCamera.ignore(scene.children.list);

    this.onAddedToScene = (go) => {
      if (this.owned.has(go)) {
        scene.cameras.main.ignore(go);
      } else {
        this.uiCamera.ignore(go);
      }
    };
    scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAddedToScene);

    this.endTurnButton = new EndTurnHudButton(scene, (object) => this.addOwned(object), this.config.worldInputGate);
    this.endTurnButton.setOnClick(() => this.config.onEndTurn());
    this.idleCitiesIndicator = new IdleCitiesHudIndicator(scene, (object) => this.addOwned(object), this.config.worldInputGate);
    this.idleCitiesIndicator.setOnClick(() => this.openNextIdleCity());

    this.topResourceBar = new TopResourceBar(scene, (object) => this.addOwned(object));

    this.researchPanel = new ResearchHudPanel(scene, (object) => this.addOwned(object), this.config.worldInputGate);
    this.researchPanel.setOnSelectTechnology((technologyId) => this.config.onSelectResearch(technologyId));
    this.researchPanel.setOnOpenTree(() => {
      const nationId = this.config.humanNationId;
      if (!nationId) return;
      this.dependencyTreeDialog.open(this.config.dataProvider.getTechnologyTreeState(
        nationId,
        this.config.isDiagnosticsEnabled?.() === true,
      ));
    });
    this.researchPanel.setOnToggle((collapsed) => {
      if (!collapsed) {
        this.culturePanel.setCollapsed(true);
        this.policyDialog.close();
      }
    });

    this.culturePanel = new CultureHudPanel(scene, (object) => this.addOwned(object), this.config.worldInputGate);
    this.culturePanel.setOnSelectCultureNode((nodeId) => this.config.onSelectCultureNode(nodeId));
    this.culturePanel.setOnToggle((collapsed) => {
      if (!collapsed) {
        this.researchPanel.setCollapsed(true);
      }
    });
    this.culturePanel.setOnOpenPolicies(() => this.policyDialog.open());
    this.culturePanel.setOnOpenTree(() => {
      const nationId = this.config.humanNationId;
      if (!nationId) return;
      this.dependencyTreeDialog.open(this.config.dataProvider.getCultureTreeState(nationId));
    });

    this.gamesOfNationsHud = new GamesOfNationsHud(
      scene,
      (object) => this.addOwned(object),
      this.config.worldInputGate,
      {
        getModel: this.config.getGamesOfNationsModel,
        onParticipationDecision: this.config.onGamesParticipationDecision,
        onApply: this.config.onApplyGamesStrategy,
        onStrategyAdjustmentSeen: this.config.onGamesStrategyAdjustmentSeen,
        onAllocateGamesPoints: this.config.onAllocateGamesPoints,
        onDistributeRemainingGamesPoints: this.config.onDistributeRemainingGamesPoints,
        onHostingDecision: this.config.onGamesHostingDecision,
        onHostCitySelected: this.config.onGamesHostCitySelected,
        onSportAuctionBid: this.config.onGamesSportAuctionBid,
        onSportAuctionAbstain: this.config.onGamesSportAuctionAbstain,
        canOpen: () => !this.hasBlockingModal(),
      },
    );

    this.policyDialog = new PolicyDialog(
      scene,
      (object) => this.addOwned(object),
      this.config.worldInputGate,
      this.config.policySystem,
      () => this.config.humanNationId,
    );
    this.policyDialog.setOnPoliciesChanged((nationId) => this.config.onPoliciesChanged(nationId));

    this.dependencyTreeDialog = new DependencyTreeDialog(
      scene,
      (object) => this.addOwned(object),
      this.config.worldInputGate,
    );

    this.unitActionHudToolbox = new UnitActionHudToolbox(
      scene,
      (object) => this.addOwned(object),
      this.config.unitActionToolbox,
      this.config.worldInputGate,
    );

    this.proposalDialog = new ProposalDialog(
      scene,
      (object) => this.addOwned(object),
      this.config.worldInputGate,
      this.config.proposalContext,
    );
    this.proposalDialog.setOnAccept((proposalId) => {
      this.config.onAcceptProposal(proposalId);
      this.proposalDialog.hide();
      this.showNextQueuedModal();
    });
    this.proposalDialog.setOnReject((proposalId) => {
      this.config.onRejectProposal(proposalId);
      this.proposalDialog.hide();
      this.showNextQueuedModal();
    });

    this.mapLensToggle = new MapLensToggleHud(
      scene,
      (object) => this.addOwned(object),
      this.config.worldInputGate,
    );
    this.mapLensToggle.setOnToggle(() => this.config.onToggleMapLens());
    this.mapLensToggle.setOnResourceToggle(() => this.config.onToggleResourceMapLens());

    this.worldCouncilDialog = new WorldCouncilFoundationDialog(
      scene,
      (object) => this.addOwned(object),
      this.config.worldInputGate,
    );
    this.worldCouncilDialog.setOnFound((offer) => {
      const founded = this.config.onFoundWorldCouncil?.(offer) ?? false;
      if (founded) {
        this.worldCouncilDialog.hide();
        this.showNextQueuedModal();
      }
      this.refresh();
    });
    this.worldCouncilDialog.setOnDecline(() => {
      const founded = this.config.onFoundWorldCouncil?.({ gold: 0, sciencePercent: 0, culturePercent: 0 }) ?? false;
      if (founded) {
        this.worldCouncilDialog.hide();
        this.showNextQueuedModal();
      }
      this.refresh();
    });
    this.worldCouncilContributionDialog = new WorldCouncilContributionDialog(
      scene,
      (object) => this.addOwned(object),
      this.config.worldInputGate,
    );
    this.worldCouncilContributionDialog.setOnConfirm((offer) => {
      const submitted = this.config.onSubmitWorldCouncilContribution?.(offer) ?? false;
      if (submitted) {
        this.worldCouncilContributionDialog.hide();
        this.showNextQueuedModal();
      }
      this.refresh();
    });
    this.worldCouncilOverviewDialog = new WorldCouncilOverviewDialog(
      scene,
      (object) => this.addOwned(object),
      this.config.worldInputGate,
    );
    this.worldCouncilOverviewDialog.setOnClose(() => {
      this.worldCouncilOverviewDialog.hide();
      this.showNextQueuedModal();
    });
    this.worldCouncilOverviewDialog.setOnLeave(() => {
      const left = this.config.onLeaveWorldCouncil?.() ?? false;
      if (left) {
        const state = this.config.getWorldCouncilOverviewState?.() ?? null;
        if (state) this.worldCouncilOverviewDialog.show(state);
        else {
          this.worldCouncilOverviewDialog.hide();
          this.showNextQueuedModal();
        }
      }
      this.refresh();
    });
    this.worldCouncilButton = this.addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 32, 0x192538, 0.92))
      .setOrigin(0, 0)
      .setDepth(141)
      .setScrollFactor(0)
      .setVisible(false);
    this.worldCouncilButtonText = this.addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '📜 Found World Council', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#f4f1e7',
      fontStyle: 'bold',
    }))
      .setOrigin(0.5, 0.5)
      .setDepth(142)
      .setScrollFactor(0)
      .setResolution(2)
      .setVisible(false);
    this.worldCouncilButtonHitArea = this.addOwned(new Phaser.GameObjects.Zone(scene, 0, 0, 10, 32))
      .setOrigin(0, 0)
      .setDepth(143)
      .setScrollFactor(0)
      .setVisible(false);
    this.worldCouncilButtonHitArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.config.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
    });
    this.worldCouncilButtonHitArea.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      this.config.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
      const foundationState = this.config.getWorldCouncilFoundationState?.() ?? null;
      if (foundationState) {
        this.worldCouncilDialog.show(foundationState);
        return;
      }
      const overviewState = this.config.getWorldCouncilOverviewState?.() ?? null;
      if (overviewState) this.worldCouncilOverviewDialog.show(overviewState);
    });

    this.discoveryPopup = new DiscoveryPopup(
      scene,
      (object) => this.addOwned(object),
      this.config.worldInputGate,
    );
    this.discoveryPopup.setOnClose(() => {
      this.showNextQueuedModal();
      if (!this.hasBlockingModal()) {
        this.config.onDiscoveryClosed();
      }
    });

    scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerRelease);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerRelease);

    this.onResize = () => {
      this.uiCamera.setSize(scene.scale.width, scene.scale.height);
      this.layout();
    };
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);

    this.refresh();
  }

  setEndTurnEnabled(enabled: boolean): void {
    this.endTurnEnabled = enabled;
    this.endTurnButton.setEnabled(enabled);
  }

  /** Show/hide the rotating "AI is taking its turn" spinner on the End Turn button. */
  setEndTurnBusy(busy: boolean): void {
    this.endTurnButton.setBusy(busy);
  }

  openResearchPanel(): void {
    this.culturePanel.setCollapsed(true);
    this.policyDialog.close();
    this.researchPanel.setCollapsed(false);
    this.layout();
  }

  openCulturePanel(): void {
    this.researchPanel.setCollapsed(true);
    this.policyDialog.close();
    this.culturePanel.setCollapsed(false);
    this.layout();
  }

  refreshPolicyPanel(): void {
    this.policyDialog.refresh();
  }

  setMapLensMode(mode: MapLensMode): void {
    this.mapLensToggle.setMode(mode);
  }

  /** Handler for the Details action button in the map-lens control row. */
  setOnMapDetails(handler: () => void): void {
    this.mapLensToggle.setOnDetails(handler);
  }

  /** Enable/disable the Details action button (disabled with no selection). */
  setMapDetailsEnabled(enabled: boolean): void {
    this.mapLensToggle.setDetailsEnabled(enabled);
  }

  /**
   * Reserve vertical space at the bottom-left so the lens button stacks
   * above the minimap (or any other bottom-left HUD element).
   */
  setMapLensBottomReserved(pixels: number): void {
    if (this.mapLensBottomReserved === pixels) return;
    this.mapLensBottomReserved = pixels;
    this.researchPanel.setBottomReserved(pixels);
    this.culturePanel.setBottomReserved(pixels);
    this.layout();
  }

  refresh(): void {
    this.scheduler.schedule('refresh', () => this.refreshNow());
  }

  /**
   * Show or queue a proposal addressed to the human. The dialog enforces
   * FIFO order: when one is already on screen, later arrivals wait.
   */
  enqueueProposal(proposal: DiplomaticProposal): void {
    if (this.hasBlockingModal()) {
      this.proposalQueue.push(proposal);
      return;
    }
    this.proposalDialog.showProposal(proposal);
  }

  /**
   * Drop a proposal from the dialog/queue (e.g. when it expires elsewhere).
   * If the active proposal is the one being dropped, advance to the next.
   */
  dismissProposal(proposalId: string): void {
    if (this.proposalDialog.getCurrentProposalId() === proposalId) {
      this.proposalDialog.hide();
      this.showNextQueuedModal();
      return;
    }
    const index = this.proposalQueue.findIndex((p) => p.id === proposalId);
    if (index >= 0) this.proposalQueue.splice(index, 1);
  }

  enqueueDiscovery(data: DiscoveryPopupData): void {
    if (this.hasBlockingModal()) {
      this.discoveryQueue.push(data);
      return;
    }
    this.discoveryPopup.show(data);
  }

  hasBlockingModal(): boolean {
    return this.gamesOfNationsHud.isDialogOpen()
      || this.discoveryPopup.isShowing()
      || this.proposalDialog.isShowing()
      || this.worldCouncilDialog.isShowing()
      || this.worldCouncilContributionDialog.isShowing()
      || this.worldCouncilOverviewDialog.isShowing();
  }

  hasOpenSelectionPanel(): boolean {
    return this.researchPanel.isOpen()
      || this.culturePanel.isOpen()
      || this.policyDialog.isShowing()
      || this.dependencyTreeDialog.isShowing();
  }

  /**
   * Allow external HUD components to register themselves with this
   * layer's UI camera. The callback returned mirrors the internal
   * `addOwned` helper used by built-in components.
   */
  getOwnedObjectAttacher(): <T extends Phaser.GameObjects.GameObject>(object: T) => T {
    return (object) => this.addOwned(object);
  }

  /**
   * Screen-space rectangle of a resource entry in the top bar (e.g. 'gold'), or
   * null when not shown. Exposed so overlays can anchor to live HUD positions.
   */
  getResourceEntryRect(key: HudResourceEntry['key']): ScreenRect | null {
    return this.topResourceBar.getEntryRect(key);
  }

  /** Plays the gold-gain count-up + temporary highlight on the gold indicator. */
  playGoldReward(amount: number): void {
    this.topResourceBar.playGoldReward(amount);
  }

  /** Screen-space rectangle of a visible unit-action button, or null when not shown. */
  getUnitActionButtonRect(mode: UnitActionMode): ScreenRect | null {
    return this.unitActionHudToolbox.getButtonRect(mode);
  }

  /** Screen-space rectangle of the End Turn button. */
  getEndTurnButtonRect(): ScreenRect {
    const layout = this.endTurnButton.getLayout();
    return {
      centerX: layout.centerX,
      centerY: layout.centerY,
      width: layout.radius * 2,
      height: layout.radius * 2,
    };
  }

  shutdown(): void {
    this.scheduler.cancel();
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    this.scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAddedToScene);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerRelease);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerRelease);
    this.endTurnButton.destroy();
    this.idleCitiesIndicator.destroy();
    this.topResourceBar.destroy();
    this.researchPanel.destroy();
    this.culturePanel.destroy();
    this.gamesOfNationsHud.destroy();
    this.dependencyTreeDialog.destroy();
    this.policyDialog.destroy();
    this.unitActionHudToolbox.destroy();
    this.proposalDialog.destroy();
    this.discoveryPopup.destroy();
    this.mapLensToggle.destroy();
    this.worldCouncilDialog.destroy();
    this.worldCouncilContributionDialog.destroy();
    this.worldCouncilOverviewDialog.destroy();
    this.worldCouncilButton.destroy();
    this.worldCouncilButtonText.destroy();
    this.worldCouncilButtonHitArea.destroy();
    this.proposalQueue.length = 0;
    this.discoveryQueue.length = 0;
    this.config.worldInputGate.clearAll();
    this.owned.clear();
    this.scene.cameras.remove(this.uiCamera);
  }

  private refreshNow(): void {
    const nationId = this.config.humanNationId;
    if (!nationId) {
      this.setIdleCityIds([]);
      return;
    }

    this.topResourceBar.setEntries(this.config.dataProvider.getResourceEntries(nationId));
    this.researchPanel.setState(this.config.dataProvider.getResearchState(nationId));
    this.culturePanel.setState(this.config.dataProvider.getCultureState(nationId));
    this.gamesOfNationsHud.refresh();
    this.policyDialog.refresh();
    this.unitActionHudToolbox.refresh();
    this.refreshWorldCouncilButton();
    this.showPendingWorldCouncilContribution();
    this.endTurnButton.setEnabled(this.endTurnEnabled);
    this.setIdleCityIds(this.config.getIdleCityIds());
    this.layout();
    this.gamesOfNationsHud.showPromptIfPending();
  }

  private layout(): void {
    const { width, height } = this.scene.scale;
    this.topResourceBar.layout();
    this.researchPanel.layout(width, height);
    this.culturePanel.layout(width, height);
    this.gamesOfNationsHud.layout();
    this.endTurnButton.layout(width, height);
    const endTurnLayout = this.endTurnButton.getLayout();
    this.idleCitiesIndicator.layout(endTurnLayout);
    this.unitActionHudToolbox.layout(endTurnLayout.centerX, endTurnLayout.centerY, endTurnLayout.radius);
    this.proposalDialog.layout();
    this.discoveryPopup.layout();
    this.mapLensToggle.layout(height, this.mapLensBottomReserved);
    this.layoutWorldCouncilButton();
    this.worldCouncilDialog.layout();
    this.worldCouncilContributionDialog.layout();
    this.worldCouncilOverviewDialog.layout();
  }

  private showNextQueuedModal(): void {
    if (this.hasBlockingModal()) return;
    const next = this.proposalQueue.shift();
    if (next) {
      this.proposalDialog.showProposal(next);
      return;
    }
    const discovery = this.discoveryQueue.shift();
    if (discovery) {
      this.discoveryPopup.show(discovery);
      return;
    }
    this.gamesOfNationsHud.showPromptIfPending();
  }

  private refreshWorldCouncilButton(): void {
    const foundationState = this.config.getWorldCouncilFoundationState?.() ?? null;
    const overviewState = this.config.getWorldCouncilOverviewState?.() ?? null;
    const hasFoundation = foundationState !== null;
    const hasOverview = overviewState !== null;
    const visible = hasFoundation || hasOverview;
    const organizationName = foundationState?.organizationName ?? overviewState?.organizationName ?? 'World Council';
    this.worldCouncilButtonText.setText(hasFoundation ? `📜 Found ${organizationName}` : organizationName);
    this.worldCouncilButton.setVisible(visible);
    this.worldCouncilButtonText.setVisible(visible);
    this.worldCouncilButtonHitArea.setVisible(visible);
    if (visible) this.worldCouncilButtonHitArea.setInteractive({ cursor: 'pointer' });
    else this.worldCouncilButtonHitArea.disableInteractive();
  }

  private showPendingWorldCouncilContribution(): void {
    if (this.hasBlockingModal()) return;
    const state = this.config.getWorldCouncilContributionState?.() ?? null;
    if (state) this.worldCouncilContributionDialog.show(state);
  }

  private layoutWorldCouncilButton(): void {
    if (!this.worldCouncilButton.visible) return;
    const width = Math.ceil(this.worldCouncilButtonText.width) + 28;
    const x = 16;
    const y = 58;
    this.worldCouncilButton.setPosition(x, y).setDisplaySize(width, 32);
    this.worldCouncilButtonText.setPosition(x + width / 2, y + 16);
    this.worldCouncilButtonHitArea.setPosition(x, y).setSize(width, 32);
  }

  private setIdleCityIds(cityIds: string[]): void {
    const nextIds = [...cityIds];
    const changed = nextIds.length !== this.idleCityIds.length
      || nextIds.some((cityId, index) => cityId !== this.idleCityIds[index]);
    this.idleCityIds = nextIds;

    if (this.idleCityIds.length === 0) {
      this.idleCityCursor = 0;
      this.nextIdleCityId = null;
    } else if (this.nextIdleCityId !== null) {
      const nextIndex = this.idleCityIds.indexOf(this.nextIdleCityId);
      if (nextIndex >= 0) {
        this.idleCityCursor = nextIndex;
      } else {
        this.idleCityCursor %= this.idleCityIds.length;
        this.nextIdleCityId = this.idleCityIds[this.idleCityCursor] ?? null;
      }
    } else if (this.idleCityCursor >= this.idleCityIds.length) {
      this.idleCityCursor = 0;
    }

    if (changed) this.idleCitiesIndicator.setCount(this.idleCityIds.length);
  }

  private openNextIdleCity(): void {
    if (this.idleCityIds.length === 0) return;
    const index = this.idleCityCursor % this.idleCityIds.length;
    const cityId = this.idleCityIds[index];
    this.idleCityCursor = (index + 1) % this.idleCityIds.length;
    this.nextIdleCityId = this.idleCityIds[this.idleCityCursor] ?? null;
    this.config.onOpenIdleCity(cityId);
  }

  private addOwned<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.owned.add(object);
    this.scene.add.existing(object);
    return object;
  }
}
