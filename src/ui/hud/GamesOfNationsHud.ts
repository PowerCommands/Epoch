import Phaser from 'phaser';
import { GamesOfNationsDialog } from '../GamesOfNationsDialog';
import type { GamesOfNationsSport, GamesOfNationsSportId, GamesOfNationsSportValues } from '../../types/gamesOfNations';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import {
  GAMES_HUD_BUTTON_LAYOUT,
  GAMES_HUD_DARK_BLUE,
  type GamesOfNationsUiModel,
} from './GamesOfNationsUiModel';
import { CircularHudProgressButton } from './CircularHudProgressButton';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

export interface GamesOfNationsHudConfig {
  getModel: () => GamesOfNationsUiModel;
  onParticipationDecision: (participating: boolean) => boolean;
  onApply: (culture: number, baseProduction: number, strategy: GamesOfNationsSportValues, hostBonusSport?: GamesOfNationsSport) => boolean;
  onStrategyAdjustmentSeen: () => void;
  onAllocateGamesPoints: (sport: GamesOfNationsSport, amount: number) => boolean;
  onDistributeRemainingGamesPoints: () => boolean;
  onHostingDecision: (accept: boolean) => boolean;
  onHostCitySelected: (cityId: string) => boolean;
  onSportAuctionBid: (sportId: GamesOfNationsSportId, bid: number) => boolean;
  onSportAuctionAbstain: () => boolean;
  canOpen: () => boolean;
}

/** Canvas HUD affordance paired with the accessible HTML Games dialog. */
export class GamesOfNationsHud {
  private readonly button: CircularHudProgressButton;
  private readonly dialog: GamesOfNationsDialog;

  constructor(
    scene: Phaser.Scene,
    addOwned: AddOwned,
    worldInputGate: WorldInputGate,
    private readonly config: GamesOfNationsHudConfig,
  ) {
    this.dialog = new GamesOfNationsDialog({
      getModel: config.getModel,
      onParticipationDecision: config.onParticipationDecision,
      onApply: config.onApply,
      onStrategyAdjustmentSeen: config.onStrategyAdjustmentSeen,
      onAllocateGamesPoints: config.onAllocateGamesPoints,
      onDistributeRemainingGamesPoints: config.onDistributeRemainingGamesPoints,
      onHostingDecision: config.onHostingDecision,
      onHostCitySelected: config.onHostCitySelected,
      onSportAuctionBid: config.onSportAuctionBid,
      onSportAuctionAbstain: config.onSportAuctionAbstain,
    });
    this.button = new CircularHudProgressButton(scene, addOwned, worldInputGate, {
      depth: 139,
      diameter: GAMES_HUD_BUTTON_LAYOUT.diameter,
      hitDiameter: 122,
      icon: '🏆',
      iconSize: 38,
      progressColor: 0x60a5fa,
      accentColor: 0x3b82f6,
      backgroundColor: GAMES_HUD_DARK_BLUE,
      hoverBackgroundColor: 0x0d3261,
      pressedBackgroundColor: 0x0b2850,
    });
    this.button.setOnClick(() => {
      if (!this.config.canOpen()) return;
      this.dialog.showPanel();
    });
    this.refresh();
  }

  refresh(): void {
    const model = this.config.getModel();
    this.button.setVisible(model.founded);
    this.button.setProgress(model.buttonProgress);
    this.button.setActive(model.buttonActive);
    this.button.setIcon(model.phase === 'competition'
      ? model.competitionProgress?.replace(/\s/g, '') ?? `1/${model.activeSports.length}`
      : '🏆');
    this.button.setTooltip(model.buttonTooltip);
  }

  showPromptIfPending(): boolean {
    const model = this.config.getModel();
    if (this.dialog.isOpen() || !this.config.canOpen()) return false;
    if (model.sportAuction) {
      this.dialog.showSportAuction();
      return true;
    }
    if (model.hostingPromptPending) {
      this.dialog.showHostingPrompt();
      return true;
    }
    if (model.hostCitySelectionPending) {
      this.dialog.showHostCitySelection();
      return true;
    }
    if (model.strategyAdjustmentPending) {
      this.dialog.showPanel();
      return true;
    }
    if (!model.promptPending) return false;
    this.dialog.showPrompt();
    return true;
  }

  isDialogOpen(): boolean {
    return this.dialog.isOpen();
  }

  layout(): void {
    this.button.layout(GAMES_HUD_BUTTON_LAYOUT.left, GAMES_HUD_BUTTON_LAYOUT.top);
  }

  destroy(): void {
    this.dialog.shutdown();
    this.button.destroy();
  }
}
