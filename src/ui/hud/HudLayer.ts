import Phaser from 'phaser';
import type { DiplomaticProposal } from '../../systems/diplomacy/DiplomaticProposal';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import type { PolicySystem } from '../../systems/PolicySystem';
import { RafScheduler } from '../../utils/RafScheduler';
import type { UnitActionToolbox } from '../UnitActionToolbox';
import { CultureHudPanel } from './CultureHudPanel';
import { DiscoveryPopup, type DiscoveryPopupData } from './DiscoveryPopup';
import { EndTurnHudButton } from './EndTurnHudButton';
import type { NationHudDataProvider } from './NationHudDataProvider';
import { PolicyHudPanel } from './PolicyHudPanel';
import { ProposalDialog, type ProposalDialogContext } from './ProposalDialog';
import { ResearchHudPanel } from './ResearchHudPanel';
import { TopResourceBar } from './TopResourceBar';
import { UnitActionHudToolbox } from './UnitActionHudToolbox';

interface HudLayerConfig {
  humanNationId: string | undefined;
  dataProvider: NationHudDataProvider;
  policySystem: PolicySystem;
  unitActionToolbox: UnitActionToolbox;
  worldInputGate: WorldInputGate;
  proposalContext: ProposalDialogContext;
  onEndTurn: () => void;
  onSelectResearch: (technologyId: string) => boolean;
  onSelectCultureNode: (nodeId: string) => boolean;
  onPoliciesChanged: (nationId: string) => void;
  onAcceptProposal: (proposalId: string) => void;
  onRejectProposal: (proposalId: string) => void;
  onDiscoveryClosed: () => void;
}

export class HudLayer {
  private readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
  private readonly owned = new Set<Phaser.GameObjects.GameObject>();
  private readonly onResize: () => void;
  private readonly onAddedToScene: (go: Phaser.GameObjects.GameObject) => void;
  private readonly scheduler = new RafScheduler();
  private readonly endTurnButton: EndTurnHudButton;
  private readonly topResourceBar: TopResourceBar;
  private readonly researchPanel: ResearchHudPanel;
  private readonly culturePanel: CultureHudPanel;
  private readonly policyPanel: PolicyHudPanel;
  private readonly unitActionHudToolbox: UnitActionHudToolbox;
  private readonly proposalDialog: ProposalDialog;
  private readonly discoveryPopup: DiscoveryPopup;
  private readonly proposalQueue: DiplomaticProposal[] = [];
  private readonly discoveryQueue: DiscoveryPopupData[] = [];
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

    this.topResourceBar = new TopResourceBar(scene, (object) => this.addOwned(object));

    this.researchPanel = new ResearchHudPanel(scene, (object) => this.addOwned(object), this.config.worldInputGate);
    this.researchPanel.setOnSelectTechnology((technologyId) => this.config.onSelectResearch(technologyId));
    this.researchPanel.setOnToggle((collapsed) => {
      if (!collapsed) {
        this.culturePanel.setCollapsed(true);
        this.policyPanel.setCollapsed(true);
      }
    });

    this.culturePanel = new CultureHudPanel(scene, (object) => this.addOwned(object), this.config.worldInputGate);
    this.culturePanel.setOnSelectCultureNode((nodeId) => this.config.onSelectCultureNode(nodeId));
    this.culturePanel.setOnToggle((collapsed) => {
      if (!collapsed) {
        this.researchPanel.setCollapsed(true);
        this.policyPanel.setCollapsed(true);
      }
    });

    this.policyPanel = new PolicyHudPanel(
      scene,
      (object) => this.addOwned(object),
      this.config.worldInputGate,
      this.config.policySystem,
      () => this.config.humanNationId,
    );
    this.policyPanel.setOnPoliciesChanged((nationId) => this.config.onPoliciesChanged(nationId));
    this.policyPanel.setOnToggle((collapsed) => {
      if (!collapsed) {
        this.researchPanel.setCollapsed(true);
        this.culturePanel.setCollapsed(true);
      }
    });

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

  openResearchPanel(): void {
    this.culturePanel.setCollapsed(true);
    this.policyPanel.setCollapsed(true);
    this.researchPanel.setCollapsed(false);
    this.layout();
  }

  openCulturePanel(): void {
    this.researchPanel.setCollapsed(true);
    this.policyPanel.setCollapsed(true);
    this.culturePanel.setCollapsed(false);
    this.layout();
  }

  refreshPolicyPanel(): void {
    this.policyPanel.refresh();
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
    return this.discoveryPopup.isShowing() || this.proposalDialog.isShowing();
  }

  hasOpenSelectionPanel(): boolean {
    return this.researchPanel.isOpen() || this.culturePanel.isOpen() || this.policyPanel.isOpen();
  }

  /**
   * Allow external HUD components to register themselves with this
   * layer's UI camera. The callback returned mirrors the internal
   * `addOwned` helper used by built-in components.
   */
  getOwnedObjectAttacher(): <T extends Phaser.GameObjects.GameObject>(object: T) => T {
    return (object) => this.addOwned(object);
  }

  shutdown(): void {
    this.scheduler.cancel();
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    this.scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAddedToScene);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerRelease);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerRelease);
    this.endTurnButton.destroy();
    this.topResourceBar.destroy();
    this.researchPanel.destroy();
    this.culturePanel.destroy();
    this.policyPanel.destroy();
    this.unitActionHudToolbox.destroy();
    this.proposalDialog.destroy();
    this.discoveryPopup.destroy();
    this.proposalQueue.length = 0;
    this.discoveryQueue.length = 0;
    this.config.worldInputGate.clearAll();
    this.owned.clear();
    this.scene.cameras.remove(this.uiCamera);
  }

  private refreshNow(): void {
    const nationId = this.config.humanNationId;
    if (!nationId) return;

    this.topResourceBar.setEntries(this.config.dataProvider.getResourceEntries(nationId));
    this.researchPanel.setState(this.config.dataProvider.getResearchState(nationId));
    this.culturePanel.setState(this.config.dataProvider.getCultureState(nationId));
    this.policyPanel.refresh();
    this.unitActionHudToolbox.refresh();
    this.endTurnButton.setEnabled(this.endTurnEnabled);
    this.layout();
  }

  private layout(): void {
    const { width, height } = this.scene.scale;
    this.topResourceBar.layout();
    this.researchPanel.layout(width, height);
    this.culturePanel.layout(width, height);
    this.policyPanel.layout(width, height);
    this.endTurnButton.layout(width, height);
    const endTurnLayout = this.endTurnButton.getLayout();
    this.unitActionHudToolbox.layout(endTurnLayout.centerX, endTurnLayout.centerY, endTurnLayout.radius);
    this.proposalDialog.layout();
    this.discoveryPopup.layout();
  }

  private showNextQueuedModal(): void {
    if (this.hasBlockingModal()) return;
    const next = this.proposalQueue.shift();
    if (next) {
      this.proposalDialog.showProposal(next);
      return;
    }
    const discovery = this.discoveryQueue.shift();
    if (discovery) this.discoveryPopup.show(discovery);
  }

  private addOwned<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.owned.add(object);
    this.scene.add.existing(object);
    return object;
  }
}
