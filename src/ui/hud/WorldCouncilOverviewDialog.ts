import Phaser from 'phaser';
import type { WorldInputGate } from '../../systems/input/WorldInputGate';
import { consumePointerEvent } from '../../utils/phaserScreenSpaceUi';

type AddOwned = <T extends Phaser.GameObjects.GameObject>(object: T) => T;

export interface WorldCouncilOverviewMember {
  readonly nationName: string;
  readonly diplomacyScore: number;
  readonly diplomacyScoreSinceLastRegularMeeting: number;
  readonly goldContributed: number;
  readonly scienceContributionPercent: number;
  readonly cultureContributionPercent: number;
}

export interface WorldCouncilOverviewMeeting {
  readonly kind: string;
  readonly turn: number;
  readonly cityName: string;
  readonly hostNationName?: string;
  readonly triggerText?: string;
  readonly proposals: WorldCouncilOverviewProposal[];
}

export interface WorldCouncilOverviewProposal {
  readonly slot: string;
  readonly resolutionId?: string;
  readonly title: string;
  readonly description: string;
  readonly icon: string;
  readonly votingType: string;
  readonly proposerNationName?: string;
  readonly targetNationName?: string;
  readonly secondaryTargetNationName?: string;
  readonly participantNationNames?: string[];
  readonly donations?: WorldCouncilOverviewDonation[];
  readonly distributions?: WorldCouncilOverviewDistribution[];
  readonly totalGoldDonated?: number;
  readonly outcomeText?: string;
  readonly voteSummary?: string;
  readonly gamesNumber?: number;
  readonly gamesHostingJustification?: string;
  readonly proposedGamesHostNationName?: string;
  readonly gamesParticipationJustification?: string;
}

export interface WorldCouncilOverviewDonation {
  readonly nationName: string;
  readonly gold: number;
}

export interface WorldCouncilOverviewDistribution {
  readonly nationName: string;
  readonly gold: number;
}

export interface WorldCouncilOverviewEnactedResolution {
  readonly resolutionId?: string;
  readonly title: string;
  readonly status: 'active' | 'repealed' | 'expired';
  readonly meetingKind: string;
  readonly turn: number;
  readonly repealTurn?: number;
  readonly targetNationName?: string;
  readonly secondaryTargetNationName?: string;
  readonly remainingTurns?: number;
  readonly participantNationNames?: string[];
}

export interface WorldCouncilOverviewState {
  readonly organizationName: string;
  readonly status: string;
  readonly foundingCityName: string;
  readonly foundingNationName: string;
  readonly constructionTurnsRemaining: number;
  readonly diplomacyScoreThreshold: number;
  readonly nextRegularMeetingTurn: number;
  readonly canHumanLeave: boolean;
  readonly members: WorldCouncilOverviewMember[];
  readonly enactedResolutions: WorldCouncilOverviewEnactedResolution[];
  readonly meetings: WorldCouncilOverviewMeeting[];
}

const DEPTH = 211;
const PANEL_WIDTH = 520;
const PADDING_X = 24;
const PADDING_Y = 20;
const BUTTON_HEIGHT = 36;
const BUTTON_GAP = 12;
const HUD_TEXT_RESOLUTION = getHudTextResolution();

interface DialogButton {
  background: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  hitArea: Phaser.GameObjects.Zone;
}

export class WorldCouncilOverviewDialog {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly closeButton: DialogButton;
  private readonly leaveButton: DialogButton;
  private current: WorldCouncilOverviewState | null = null;
  private closeListener: (() => void) | null = null;
  private leaveListener: (() => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    addOwned: AddOwned,
    private readonly worldInputGate: WorldInputGate,
  ) {
    this.overlay = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, 10, 10, 0x000000, 0.55))
      .setOrigin(0, 0)
      .setDepth(DEPTH)
      .setScrollFactor(0)
      .setVisible(false);
    this.panel = addOwned(new Phaser.GameObjects.Rectangle(scene, 0, 0, PANEL_WIDTH, 10, 0x101923, 0.98))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 1)
      .setScrollFactor(0)
      .setVisible(false);
    this.titleText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, 'World Council Overview', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#d8bd72',
      fontStyle: 'bold',
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);
    this.bodyText = addOwned(new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#f4f1e7',
      wordWrap: { width: PANEL_WIDTH - PADDING_X * 2, useAdvancedWrap: true },
    }))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);

    this.closeButton = this.createButton(addOwned, 'Close', 0x355f76, () => {
      this.closeListener?.();
    });
    this.leaveButton = this.createButton(addOwned, 'Leave Council', 0x5a3030, () => {
      this.leaveListener?.();
    });
  }

  setOnClose(listener: () => void): void {
    this.closeListener = listener;
  }

  setOnLeave(listener: () => void): void {
    this.leaveListener = listener;
  }

  show(state: WorldCouncilOverviewState): void {
    this.current = state;
    this.titleText.setText(`${state.organizationName} Overview`);
    this.bodyText.setText(formatOverview(state));
    this.setVisible(true);
    this.layout();
  }

  hide(): void {
    this.current = null;
    this.setVisible(false);
  }

  isShowing(): boolean {
    return this.current !== null;
  }

  layout(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    this.overlay.setPosition(0, 0).setDisplaySize(width, height);
    const bodyHeight = this.bodyText.height;
    const buttonRowHeight = BUTTON_HEIGHT;
    const panelHeight = PADDING_Y + this.titleText.height + 12 + bodyHeight + 18 + buttonRowHeight + PADDING_Y;
    const left = Math.round((width - PANEL_WIDTH) / 2);
    const top = Math.round((height - panelHeight) / 2);
    this.panel.setPosition(left, top).setDisplaySize(PANEL_WIDTH, panelHeight);
    this.titleText.setPosition(left + PADDING_X, top + PADDING_Y);
    this.bodyText.setPosition(left + PADDING_X, this.titleText.y + this.titleText.height + 12);

    const canLeave = this.current?.canHumanLeave === true;
    const buttonWidth = canLeave
      ? Math.floor((PANEL_WIDTH - PADDING_X * 2 - BUTTON_GAP) / 2)
      : 160;
    const buttonY = top + panelHeight - PADDING_Y - BUTTON_HEIGHT;
    const closeX = canLeave
      ? left + PADDING_X
      : left + PANEL_WIDTH - PADDING_X - buttonWidth;
    this.layoutButton(this.closeButton, closeX, buttonY, buttonWidth);
    this.layoutButton(this.leaveButton, left + PADDING_X + buttonWidth + BUTTON_GAP, buttonY, buttonWidth);
  }

  destroy(): void {
    this.overlay.destroy();
    this.panel.destroy();
    this.titleText.destroy();
    this.bodyText.destroy();
    this.destroyButton(this.closeButton);
    this.destroyButton(this.leaveButton);
  }

  private setVisible(visible: boolean): void {
    const canLeave = visible && this.current?.canHumanLeave === true;
    this.overlay.setVisible(visible);
    this.panel.setVisible(visible);
    this.titleText.setVisible(visible);
    this.bodyText.setVisible(visible);
    this.setButtonVisible(this.closeButton, visible);
    this.setButtonVisible(this.leaveButton, canLeave);
  }

  private setButtonVisible(button: DialogButton, visible: boolean): void {
    button.background.setVisible(visible);
    button.text.setVisible(visible);
    button.hitArea.setVisible(visible);
    if (visible) button.hitArea.setInteractive({ cursor: 'pointer' });
    else button.hitArea.disableInteractive();
  }

  private createButton(addOwned: AddOwned, label: string, color: number, onClick: () => void): DialogButton {
    const background = addOwned(new Phaser.GameObjects.Rectangle(this.scene, 0, 0, 10, BUTTON_HEIGHT, color, 0.95))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0)
      .setVisible(false);
    const text = addOwned(new Phaser.GameObjects.Text(this.scene, 0, 0, label, {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#f4f1e7',
      fontStyle: 'bold',
    }))
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH + 3)
      .setScrollFactor(0)
      .setResolution(HUD_TEXT_RESOLUTION)
      .setVisible(false);
    const hitArea = addOwned(new Phaser.GameObjects.Zone(this.scene, 0, 0, 10, BUTTON_HEIGHT))
      .setOrigin(0, 0)
      .setDepth(DEPTH + 4)
      .setScrollFactor(0)
      .setVisible(false);
    hitArea.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
    });
    hitArea.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      this.worldInputGate.claimPointer(pointer.id);
      consumePointerEvent(pointer);
      onClick();
    });
    return { background, text, hitArea };
  }

  private layoutButton(button: DialogButton, x: number, y: number, width: number): void {
    button.background.setPosition(x, y).setDisplaySize(width, BUTTON_HEIGHT);
    button.text.setPosition(x + width / 2, y + BUTTON_HEIGHT / 2);
    button.hitArea.setPosition(x, y).setSize(width, BUTTON_HEIGHT);
  }

  private destroyButton(button: DialogButton): void {
    button.background.destroy();
    button.text.destroy();
    button.hitArea.destroy();
  }
}

function formatOverview(state: WorldCouncilOverviewState): string {
  const lines = [
    `Status: ${state.status}`,
    `Meeting location: ${state.foundingCityName}`,
    `Founder: ${state.foundingNationName}`,
    `Diplomacy Score target: ${state.diplomacyScoreThreshold}`,
    `Next regular meeting: round ${state.nextRegularMeetingTurn}`,
  ];
  if (state.status === 'construction') {
    lines.push(`Construction: ${state.constructionTurnsRemaining} turns remaining`);
  }
  lines.push('', 'Members');
  if (state.members.length === 0) {
    lines.push('None');
  } else {
    for (const member of state.members) {
      lines.push(
        `${member.nationName}: score ${Math.floor(member.diplomacyScore)} | period ${Math.floor(member.diplomacyScoreSinceLastRegularMeeting)} | gold ${member.goldContributed} | science ${member.scienceContributionPercent}% | culture ${member.cultureContributionPercent}%`,
      );
    }
  }
  lines.push('', 'Meetings');
  if (state.meetings.length === 0) {
    lines.push('None');
  } else {
    for (const meeting of state.meetings.slice(-8).reverse()) {
      const hostText = meeting.hostNationName ? ` | host ${meeting.hostNationName}` : '';
      const triggerText = meeting.triggerText ? ` | ${meeting.triggerText}` : '';
      lines.push(`${meeting.kind} meeting, round ${meeting.turn}, ${meeting.cityName}${hostText}${triggerText}`);
      for (const proposal of meeting.proposals) {
        const proposer = proposal.proposerNationName ? ` by ${proposal.proposerNationName}` : '';
        lines.push(`  ${proposal.icon} ${proposal.slot}${proposer}: ${proposal.title} (${proposal.votingType})`);
        if (proposal.targetNationName) {
          const targetText = proposal.secondaryTargetNationName
            ? `${proposal.targetNationName} - ${proposal.secondaryTargetNationName}`
            : proposal.targetNationName;
          lines.push(`     Target: ${targetText}`);
        }
        if (proposal.resolutionId === 'games_of_nations_hosting') {
          if (proposal.gamesNumber !== undefined) lines.push(`     Upcoming Games: #${proposal.gamesNumber}`);
          if (proposal.targetNationName) lines.push(`     Current host: ${proposal.targetNationName}`);
          if (proposal.proposedGamesHostNationName) lines.push(`     Proposed host: ${proposal.proposedGamesHostNationName}`);
          if (proposal.gamesHostingJustification) {
            lines.push(`     Official justification: “${proposal.gamesHostingJustification}”`);
          }
          if (proposal.proposedGamesHostNationName) {
            lines.push(`     If passed, the current upcoming Games cycle will restart with ${proposal.proposedGamesHostNationName} as host.`);
          }
        }
        if (proposal.resolutionId === 'exclude_games_of_nations_participant') {
          if (proposal.gamesNumber !== undefined) lines.push(`     Upcoming Games: #${proposal.gamesNumber}`);
          if (proposal.gamesParticipationJustification) {
            lines.push(`     Official justification: “${proposal.gamesParticipationJustification}”`);
          }
          if (proposal.targetNationName) {
            lines.push(`     Proposed action: Exclude ${proposal.targetNationName} from Games of Nations #${proposal.gamesNumber ?? '?'}.`);
          }
        }
        lines.push(`     ${proposal.description}`);
        if (proposal.participantNationNames && proposal.participantNationNames.length > 0) {
          const participantLabel = proposal.resolutionId === 'un_peacekeeping_mission' ? 'Participants' : 'Signers';
          lines.push(`     ${participantLabel}: ${proposal.participantNationNames.join(', ')}`);
        }
        if (proposal.donations) {
          const donors = proposal.donations.filter((donation) => donation.gold > 0);
          const declined = proposal.distributions
            ? []
            : proposal.donations.filter((donation) => donation.gold <= 0);
          for (const donation of donors) {
            lines.push(`     ${donation.nationName} contributed ${donation.gold} Gold.`);
          }
          if (declined.length > 0) {
            lines.push(`     Declined: ${declined.map((donation) => donation.nationName).join(', ')}`);
          }
          lines.push(`     Total international aid: ${proposal.totalGoldDonated ?? 0} Gold.`);
          if (proposal.distributions && proposal.distributions.length > 0) {
            for (const distribution of proposal.distributions) {
              lines.push(`     ${distribution.nationName} received ${distribution.gold} Gold.`);
            }
          }
        } else if (proposal.voteSummary) {
          lines.push(`     ${proposal.voteSummary}`);
        }
        if (proposal.outcomeText) lines.push(`     ${proposal.outcomeText}`);
      }
    }
  }
  lines.push('', 'Enacted Resolutions');
  if (state.enactedResolutions.length === 0) {
    lines.push('None');
  } else {
    for (const resolution of state.enactedResolutions) {
      const statusText = resolution.status === 'active'
        ? 'Active'
        : resolution.status === 'expired'
          ? 'Expired'
          : `Repealed${resolution.repealTurn !== undefined ? ` round ${resolution.repealTurn}` : ''}`;
      const targetText = resolution.targetNationName
        ? resolution.secondaryTargetNationName
          ? resolution.resolutionId === 'un_peacekeeping_mission'
            ? `: host ${resolution.targetNationName}, threat ${resolution.secondaryTargetNationName}`
            : `: ${resolution.targetNationName} - ${resolution.secondaryTargetNationName}`
          : ` against ${resolution.targetNationName}`
        : '';
      lines.push(`${statusText}: ${resolution.title}${targetText} (${resolution.meetingKind}, round ${resolution.turn})`);
      if (resolution.remainingTurns !== undefined) {
        lines.push(`  Remaining: ${resolution.remainingTurns} turns`);
      }
      if (resolution.participantNationNames && resolution.participantNationNames.length > 0) {
        const participantLabel = resolution.resolutionId === 'un_peacekeeping_mission' ? 'Participants' : 'Signers';
        lines.push(`  ${participantLabel}: ${resolution.participantNationNames.join(', ')}`);
      }
    }
  }
  return lines.join('\n');
}

function getHudTextResolution(): number {
  if (typeof window === 'undefined') return 2;
  return Math.max(2, Math.ceil(window.devicePixelRatio || 1));
}
