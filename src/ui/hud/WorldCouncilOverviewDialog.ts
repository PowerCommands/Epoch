export interface WorldCouncilOverviewMember {
  readonly nationName: string;
  readonly nationColor: string;
  readonly isHuman: boolean;
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
  readonly outcome?: 'passed' | 'rejected' | 'unresolved';
  readonly outcomeText?: string;
  readonly influenceFor?: number;
  readonly influenceAgainst?: number;
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
  readonly currentTurn: number;
  readonly canHumanLeave: boolean;
  readonly members: WorldCouncilOverviewMember[];
  readonly enactedResolutions: WorldCouncilOverviewEnactedResolution[];
  readonly meetings: WorldCouncilOverviewMeeting[];
}

type WorldCouncilTab = 'overview' | 'members' | 'resolutions' | 'meetings';

const OVERLAY_ID = 'epoch-world-council-overview';
const TABS: ReadonlyArray<{ id: WorldCouncilTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'resolutions', label: 'Resolutions' },
  { id: 'meetings', label: 'Meetings' },
];

/**
 * Large tabbed HTML/CSS overview of the World Council / United Nations, in the
 * same UI family as the Games of Nations dialog. Presentation only — every value
 * comes from the {@link WorldCouncilOverviewState} DTO built from World Council
 * state; nothing here mutates gameplay.
 */
export class WorldCouncilOverviewDialog {
  private overlay: HTMLDivElement | null = null;
  private contentRoot: HTMLElement | null = null;
  private readonly tabButtons = new Map<WorldCouncilTab, HTMLButtonElement>();
  private current: WorldCouncilOverviewState | null = null;
  private activeTab: WorldCouncilTab = 'overview';
  private closeListener: (() => void) | null = null;
  private leaveListener: (() => void) | null = null;

  setOnClose(listener: () => void): void {
    this.closeListener = listener;
  }

  setOnLeave(listener: () => void): void {
    this.leaveListener = listener;
  }

  show(state: WorldCouncilOverviewState): void {
    this.current = state;
    if (!this.overlay) {
      this.activeTab = 'overview';
      this.mount();
    }
    this.renderShell();
    this.renderActiveTab();
  }

  hide(): void {
    this.current = null;
    if (this.overlay) {
      document.removeEventListener('keydown', this.handleKeyDown, true);
      this.overlay.remove();
      this.overlay = null;
      this.contentRoot = null;
      this.tabButtons.clear();
    }
  }

  isShowing(): boolean {
    return this.current !== null && this.overlay !== null;
  }

  /** HTML overlay lays out via CSS; the Phaser resize hook has nothing to do. */
  layout(): void {
    /* no-op */
  }

  destroy(): void {
    this.hide();
  }

  private requestClose(): void {
    this.closeListener?.();
  }

  private mount(): void {
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'wc-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'World Council overview');
    overlay.tabIndex = -1;
    overlay.style.cssText = OVERLAY_STYLE;
    for (const eventName of ['click', 'mousedown', 'mouseup', 'wheel']) {
      overlay.addEventListener(eventName, (event) => event.stopPropagation());
    }
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) this.requestClose();
    });
    document.body.appendChild(overlay);
    this.overlay = overlay;
    document.addEventListener('keydown', this.handleKeyDown, true);
  }

  /** Build the persistent frame (title, tabs, footer) once per open/state change. */
  private renderShell(): void {
    if (!this.overlay || !this.current) return;
    const state = this.current;
    // Preserve the content region across shell rebuilds so we do not tear down
    // the whole dialog on a state refresh.
    const card = element('section', 'wc-card');
    card.style.cssText = CARD_STYLE;

    const header = element('header', 'wc-header');
    const titleWrap = element('div', 'wc-title-wrap');
    titleWrap.append(
      heading(state.organizationName.toUpperCase(), 'h1'),
      text(statusHeadline(state), 'wc-subtitle'),
    );
    const closeButton = button('Close', 'wc-close', () => this.requestClose());
    header.append(titleWrap, closeButton);

    const tabBar = element('nav', 'wc-tabs');
    tabBar.setAttribute('role', 'tablist');
    this.tabButtons.clear();
    for (const tab of TABS) {
      const isActive = tab.id === this.activeTab;
      const tabButton = button(tab.label, `wc-tab${isActive ? ' wc-tab-active' : ''}`, () => {
        this.setActiveTab(tab.id);
      });
      tabButton.setAttribute('role', 'tab');
      tabButton.setAttribute('aria-selected', String(isActive));
      this.tabButtons.set(tab.id, tabButton);
      tabBar.appendChild(tabButton);
    }

    const content = element('div', 'wc-content');
    content.setAttribute('role', 'tabpanel');
    this.contentRoot = content;

    card.append(header, tabBar, content);

    if (state.canHumanLeave) {
      const footer = element('footer', 'wc-footer');
      footer.append(
        text('Leaving forfeits your standing in the organization.', 'wc-muted'),
        button('Leave Organization', 'wc-leave', () => this.leaveListener?.()),
      );
      card.appendChild(footer);
    }

    this.overlay.replaceChildren(card);
    // Re-append the injected <style> that replaceChildren removed.
    appendStyles(this.overlay);
  }

  /** Swap tabs without rebuilding the dialog frame: restyle tabs, re-render content. */
  private setActiveTab(tab: WorldCouncilTab): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    for (const [id, tabButton] of this.tabButtons) {
      const isActive = id === tab;
      tabButton.classList.toggle('wc-tab-active', isActive);
      tabButton.setAttribute('aria-selected', String(isActive));
    }
    this.renderActiveTab();
  }

  private renderActiveTab(): void {
    if (!this.contentRoot || !this.current) return;
    this.contentRoot.replaceChildren();
    this.contentRoot.scrollTop = 0;
    switch (this.activeTab) {
      case 'overview':
        this.renderOverviewTab(this.contentRoot, this.current);
        break;
      case 'members':
        this.renderMembersTab(this.contentRoot, this.current);
        break;
      case 'resolutions':
        this.renderResolutionsTab(this.contentRoot, this.current);
        break;
      case 'meetings':
        this.renderMeetingsTab(this.contentRoot, this.current);
        break;
    }
  }

  private renderOverviewTab(root: HTMLElement, state: WorldCouncilOverviewState): void {
    const underConstruction = state.status === 'construction';
    const grid = element('div', 'wc-status-grid');

    grid.appendChild(metric('Organization Status', underConstruction ? 'Under Construction' : 'Active'));
    grid.appendChild(metric('Headquarters', `${state.foundingCityName}\n${state.foundingNationName}`));

    if (underConstruction) {
      grid.appendChild(metric(
        'Construction',
        `${Math.max(0, Math.floor(state.constructionTurnsRemaining))} turns remaining`,
      ));
    } else {
      const remaining = state.nextRegularMeetingTurn - state.currentTurn;
      const remainingLabel = remaining > 0
        ? `${remaining} ${remaining === 1 ? 'turn' : 'turns'} remaining`
        : 'Convening now';
      grid.appendChild(metric('Next Regular Meeting', `Round ${state.nextRegularMeetingTurn}\n${remainingLabel}`));
    }

    grid.appendChild(metric('Diplomatic Victory Target', `${state.diplomacyScoreThreshold} Diplomatic Score`));
    grid.appendChild(metric('Members', `${state.members.length} ${state.members.length === 1 ? 'nation' : 'nations'}`));
    root.appendChild(grid);

    root.appendChild(heading('Active Resolutions', 'h2'));
    const { active } = partitionResolutions(state.enactedResolutions);
    if (active.length === 0) {
      root.appendChild(text('No active resolutions', 'wc-empty'));
      return;
    }
    const list = element('div', 'wc-resolution-list');
    for (const resolution of active) {
      list.appendChild(this.buildActiveResolutionCard(resolution));
    }
    root.appendChild(list);
  }

  private buildActiveResolutionCard(resolution: WorldCouncilOverviewEnactedResolution): HTMLElement {
    const card = element('div', 'wc-resolution-card');
    const headerRow = element('div', 'wc-resolution-head');
    headerRow.append(
      text(resolution.title, 'wc-resolution-title'),
      badge('ACTIVE', 'wc-badge-active'),
    );
    card.appendChild(headerRow);

    const meta = element('div', 'wc-resolution-meta');
    meta.appendChild(text(`Enacted at ${resolution.meetingKind} Meeting, round ${resolution.turn}`, 'wc-muted'));
    if (resolution.targetNationName) {
      meta.appendChild(text(targetLine(resolution.resolutionId, resolution.targetNationName, resolution.secondaryTargetNationName), 'wc-target'));
    }
    if (resolution.remainingTurns !== undefined) {
      meta.appendChild(text(`${resolution.remainingTurns} ${resolution.remainingTurns === 1 ? 'turn' : 'turns'} remaining`, 'wc-muted'));
    }
    if (resolution.participantNationNames && resolution.participantNationNames.length > 0) {
      const label = resolution.resolutionId === 'un_peacekeeping_mission' ? 'Participants' : 'Signatories';
      meta.appendChild(text(`${label}: ${resolution.participantNationNames.join(', ')}`, 'wc-muted'));
    }
    card.appendChild(meta);
    return card;
  }

  private renderMembersTab(root: HTMLElement, state: WorldCouncilOverviewState): void {
    if (state.members.length === 0) {
      root.appendChild(text('This organization has no members yet.', 'wc-empty'));
      return;
    }
    const ordered = sortMembersByScore(state.members);

    const table = element('div', 'wc-table');
    const header = element('div', 'wc-row wc-row-header');
    header.append(
      text('Nation', 'wc-cell wc-cell-nation'),
      text('Diplomatic Score', 'wc-cell'),
      text('Period Score', 'wc-cell'),
      text('Gold', 'wc-cell'),
      text('Science', 'wc-cell'),
      text('Culture', 'wc-cell'),
    );
    table.appendChild(header);

    for (const member of ordered) {
      const row = element('div', `wc-row${member.isHuman ? ' wc-row-human' : ''}`);
      const nationCell = element('div', 'wc-cell wc-cell-nation');
      const swatch = element('span', 'wc-swatch');
      swatch.style.backgroundColor = member.nationColor;
      const name = text(member.nationName + (member.isHuman ? ' (You)' : ''), 'wc-nation-name');
      nationCell.append(swatch, name);
      row.append(
        nationCell,
        text(String(Math.floor(member.diplomacyScore)), 'wc-cell'),
        text(formatSigned(member.diplomacyScoreSinceLastRegularMeeting), 'wc-cell'),
        text(String(Math.floor(member.goldContributed)), 'wc-cell'),
        text(`${member.scienceContributionPercent}%`, 'wc-cell'),
        text(`${member.cultureContributionPercent}%`, 'wc-cell'),
      );
      table.appendChild(row);
    }
    root.appendChild(table);
  }

  private renderResolutionsTab(root: HTMLElement, state: WorldCouncilOverviewState): void {
    const { active, past } = partitionResolutions(state.enactedResolutions);
    root.appendChild(heading('Active Resolutions', 'h2'));
    if (active.length === 0) {
      root.appendChild(text('No active resolutions', 'wc-empty'));
    } else {
      const activeList = element('div', 'wc-resolution-list');
      for (const resolution of active) {
        activeList.appendChild(this.buildActiveResolutionCard(resolution));
      }
      root.appendChild(activeList);
    }

    root.appendChild(heading('Resolution History', 'h2'));
    const rejected = collectHistoricalProposals(state.meetings);

    if (past.length === 0 && rejected.length === 0) {
      root.appendChild(text('No past resolutions yet.', 'wc-empty'));
      return;
    }

    const historyList = element('div', 'wc-resolution-list');
    for (const resolution of past) {
      const card = element('div', 'wc-resolution-card wc-resolution-past');
      const headerRow = element('div', 'wc-resolution-head');
      const statusLabel = resolution.status === 'expired' ? 'EXPIRED' : 'REPEALED';
      headerRow.append(
        text(resolution.title, 'wc-resolution-title'),
        badge(statusLabel, 'wc-badge-muted'),
      );
      card.appendChild(headerRow);
      const meta = element('div', 'wc-resolution-meta');
      const repealSuffix = resolution.status === 'repealed' && resolution.repealTurn !== undefined
        ? ` · repealed round ${resolution.repealTurn}`
        : '';
      meta.appendChild(text(`Enacted at ${resolution.meetingKind} Meeting, round ${resolution.turn}${repealSuffix}`, 'wc-muted'));
      if (resolution.targetNationName) {
        meta.appendChild(text(targetLine(resolution.resolutionId, resolution.targetNationName, resolution.secondaryTargetNationName), 'wc-target'));
      }
      card.appendChild(meta);
      historyList.appendChild(card);
    }
    root.appendChild(historyList);

    if (rejected.length > 0) {
      root.appendChild(heading('Rejected & Unresolved Proposals', 'h2'));
      const rejectedList = element('div', 'wc-resolution-list');
      for (const entry of rejected) {
        rejectedList.appendChild(this.buildProposalOutcomeCard(entry.proposal, entry.turn, entry.meetingKind));
      }
      root.appendChild(rejectedList);
    }
  }

  private buildProposalOutcomeCard(
    proposal: WorldCouncilOverviewProposal,
    turn: number,
    meetingKind: string,
  ): HTMLElement {
    const card = element('div', 'wc-resolution-card wc-resolution-past');
    const headerRow = element('div', 'wc-resolution-head');
    headerRow.append(
      text(proposal.title, 'wc-resolution-title'),
      badge(outcomeLabel(proposal.outcome), proposal.outcome === 'unresolved' ? 'wc-badge-muted' : 'wc-badge-reject'),
    );
    card.appendChild(headerRow);

    const meta = element('div', 'wc-resolution-meta');
    meta.appendChild(text(`${meetingKind} Meeting, round ${turn}`, 'wc-muted'));
    if (proposal.proposerNationName) {
      meta.appendChild(text(`Proposed by ${proposal.proposerNationName}`, 'wc-muted'));
    }
    if (proposal.targetNationName) {
      meta.appendChild(text(targetLine(proposal.resolutionId, proposal.targetNationName, proposal.secondaryTargetNationName), 'wc-target'));
    }
    if (proposal.influenceFor !== undefined || proposal.influenceAgainst !== undefined) {
      meta.appendChild(text(`Influence — For ${proposal.influenceFor ?? 0} · Against ${proposal.influenceAgainst ?? 0}`, 'wc-muted'));
    }
    if (proposal.outcomeText) {
      meta.appendChild(text(proposal.outcomeText, 'wc-muted'));
    }
    card.appendChild(meta);
    return card;
  }

  private renderMeetingsTab(root: HTMLElement, state: WorldCouncilOverviewState): void {
    if (state.meetings.length === 0) {
      root.appendChild(text('No meetings have taken place yet.', 'wc-empty'));
      return;
    }
    const ordered = [...state.meetings].sort((a, b) => b.turn - a.turn);
    for (const meeting of ordered) {
      root.appendChild(this.buildMeetingCard(meeting));
    }
  }

  private buildMeetingCard(meeting: WorldCouncilOverviewMeeting): HTMLElement {
    const isEmergency = meeting.kind.toLowerCase().includes('emergency');
    const card = element('div', `wc-meeting-card${isEmergency ? ' wc-meeting-emergency' : ''}`);

    const header = element('div', 'wc-meeting-head');
    const kindLabel = isEmergency ? 'Emergency Meeting' : 'Regular Meeting';
    header.append(
      text(`${kindLabel} — Round ${meeting.turn}`, 'wc-meeting-title'),
      badge(isEmergency ? 'EMERGENCY' : 'REGULAR', isEmergency ? 'wc-badge-reject' : 'wc-badge-active'),
    );
    card.appendChild(header);

    const location = element('div', 'wc-meeting-meta');
    location.appendChild(text(meeting.cityName, 'wc-muted'));
    if (meeting.hostNationName) {
      location.appendChild(text(`Host: ${meeting.hostNationName}`, 'wc-muted'));
    }
    if (meeting.triggerText) {
      location.appendChild(text(meeting.triggerText, 'wc-target'));
    }
    card.appendChild(location);

    if (meeting.proposals.length === 0) {
      card.appendChild(text('No proposals were raised.', 'wc-empty'));
      return card;
    }
    const proposals = element('div', 'wc-proposal-list');
    for (const proposal of meeting.proposals) {
      proposals.appendChild(this.buildMeetingProposal(proposal));
    }
    card.appendChild(proposals);
    return card;
  }

  private buildMeetingProposal(proposal: WorldCouncilOverviewProposal): HTMLElement {
    const item = element('div', 'wc-proposal');
    const headRow = element('div', 'wc-proposal-head');
    const titleWrap = element('div', 'wc-proposal-title-wrap');
    titleWrap.append(text(`${proposal.icon} ${proposal.title}`, 'wc-proposal-title'));
    headRow.appendChild(titleWrap);
    if (proposal.outcome) {
      const badgeClass = proposal.outcome === 'passed'
        ? 'wc-badge-active'
        : proposal.outcome === 'rejected'
          ? 'wc-badge-reject'
          : 'wc-badge-muted';
      headRow.appendChild(badge(outcomeLabel(proposal.outcome), badgeClass));
    }
    item.appendChild(headRow);

    const meta = element('div', 'wc-proposal-meta');
    if (proposal.proposerNationName) {
      meta.appendChild(text(`Proposed by ${proposal.proposerNationName}`, 'wc-muted'));
    }
    if (proposal.targetNationName) {
      meta.appendChild(text(targetLine(proposal.resolutionId, proposal.targetNationName, proposal.secondaryTargetNationName), 'wc-target'));
    }
    if (proposal.influenceFor !== undefined || proposal.influenceAgainst !== undefined) {
      meta.appendChild(text(`Influence — For ${proposal.influenceFor ?? 0} · Against ${proposal.influenceAgainst ?? 0}`, 'wc-muted'));
    }
    if (proposal.participantNationNames && proposal.participantNationNames.length > 0) {
      const label = proposal.resolutionId === 'un_peacekeeping_mission' ? 'Participants' : 'Signatories';
      meta.appendChild(text(`${label}: ${proposal.participantNationNames.join(', ')}`, 'wc-muted'));
    }
    if (proposal.totalGoldDonated !== undefined && proposal.totalGoldDonated > 0) {
      meta.appendChild(text(`International aid: ${proposal.totalGoldDonated} Gold`, 'wc-muted'));
    }
    if (proposal.outcomeText) {
      meta.appendChild(text(proposal.outcomeText, 'wc-outcome-text'));
    }
    item.appendChild(meta);
    return item;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.isShowing()) return;
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.requestClose();
    }
  };
}

export interface WorldCouncilHistoricalProposal {
  readonly proposal: WorldCouncilOverviewProposal;
  readonly turn: number;
  readonly meetingKind: string;
}

/** Split enacted resolutions into current law vs. expired/repealed history. */
export function partitionResolutions(resolutions: readonly WorldCouncilOverviewEnactedResolution[]): {
  active: WorldCouncilOverviewEnactedResolution[];
  past: WorldCouncilOverviewEnactedResolution[];
} {
  const active: WorldCouncilOverviewEnactedResolution[] = [];
  const past: WorldCouncilOverviewEnactedResolution[] = [];
  for (const resolution of resolutions) {
    if (resolution.status === 'active') active.push(resolution);
    else past.push(resolution);
  }
  return { active, past };
}

/** Members ranked by total Diplomatic Score, highest first (stable for ties). */
export function sortMembersByScore(members: readonly WorldCouncilOverviewMember[]): WorldCouncilOverviewMember[] {
  return [...members].sort((a, b) => b.diplomacyScore - a.diplomacyScore);
}

/** Rejected/unresolved proposals across meeting history, newest meeting first. */
export function collectHistoricalProposals(
  meetings: readonly WorldCouncilOverviewMeeting[],
): WorldCouncilHistoricalProposal[] {
  const entries: WorldCouncilHistoricalProposal[] = [];
  for (const meeting of meetings) {
    for (const proposal of meeting.proposals) {
      if (proposal.outcome === 'rejected' || proposal.outcome === 'unresolved') {
        entries.push({ proposal, turn: meeting.turn, meetingKind: meeting.kind });
      }
    }
  }
  return entries.sort((a, b) => b.turn - a.turn);
}

export function statusHeadline(state: WorldCouncilOverviewState): string {
  if (state.status === 'construction') {
    return `Under construction — ${Math.max(0, Math.floor(state.constructionTurnsRemaining))} turns remaining`;
  }
  return `Headquartered in ${state.foundingCityName}, ${state.foundingNationName}`;
}

export function targetLine(resolutionId: string | undefined, target: string, secondary?: string): string {
  if (!secondary) return `Target: ${target}`;
  if (resolutionId === 'un_peacekeeping_mission') {
    return `Host: ${target} · Threat: ${secondary}`;
  }
  return `Target: ${target} — ${secondary}`;
}

export function outcomeLabel(outcome: WorldCouncilOverviewProposal['outcome']): string {
  switch (outcome) {
    case 'passed': return 'PASSED';
    case 'rejected': return 'REJECTED';
    case 'unresolved': return 'UNRESOLVED';
    default: return 'PENDING';
  }
}

export function formatSigned(value: number): string {
  const whole = Math.floor(value);
  return whole > 0 ? `+${whole}` : String(whole);
}

const OVERLAY_STYLE = `
  position:fixed;inset:0;z-index:10018;display:flex;align-items:center;justify-content:center;
  box-sizing:border-box;padding:18px;background:rgba(2,12,7,.82);color:#e7f6ec;
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
`;
const CARD_STYLE = `
  width:min(1120px,96vw);max-height:94vh;display:flex;flex-direction:column;box-sizing:border-box;
  padding:clamp(20px,3vw,30px);border:1px solid #1f7a44;border-radius:12px;
  background:linear-gradient(150deg,#06210f,#0a3019 60%,#07230f);
  box-shadow:0 28px 90px rgba(0,0,0,.72),inset 0 1px rgba(134,239,172,.1);
`;

function appendStyles(overlay: HTMLElement): void {
  const style = document.createElement('style');
  style.textContent = `
    .wc-card h1{margin:0;font-size:clamp(24px,3.4vw,34px);letter-spacing:.04em;color:#f2fff6}
    .wc-card h2{margin:24px 0 12px;font-size:17px;color:#86efac;text-transform:uppercase;letter-spacing:.06em}
    .wc-header{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}
    .wc-title-wrap{display:flex;flex-direction:column;gap:4px}
    .wc-subtitle{color:#a7d8ba;font-size:14px}
    .wc-card button{border:1px solid #2f7d4f;border-radius:6px;background:#0d3b21;color:#eafff1;padding:9px 16px;font:700 14px inherit;cursor:pointer}
    .wc-card button:hover,.wc-card button:focus-visible{background:#155c33;outline:2px solid #4ade80;outline-offset:2px}
    .wc-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 6px;border-bottom:1px solid #164a2b;padding-bottom:12px}
    .wc-card button.wc-tab{background:transparent;border:1px solid transparent;border-radius:7px;color:#a7d8ba;padding:9px 18px;font-weight:700}
    .wc-card button.wc-tab:hover{background:rgba(34,197,94,.12)}
    .wc-card button.wc-tab-active{background:#16a34a;border-color:#4ade80;color:#f2fff6}
    .wc-content{overflow-y:auto;padding:14px 4px 4px;min-height:0;flex:1}
    .wc-status-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:6px 0 8px}
    .wc-metric{padding:13px 15px;border:1px solid #1f6e40;border-radius:9px;background:rgba(4,24,13,.55)}
    .wc-metric-label{display:block;color:#7fc79b;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
    .wc-metric-value{display:block;margin-top:6px;font-weight:800;font-size:16px;color:#f1fff6;white-space:pre-line;line-height:1.4}
    .wc-empty{padding:14px;color:#8fc6a5;font-style:italic}
    .wc-resolution-list{display:grid;gap:12px}
    .wc-resolution-card{padding:14px 16px;border:1px solid #1f6e40;border-radius:9px;background:rgba(4,24,13,.55);display:grid;gap:8px}
    .wc-resolution-card.wc-resolution-past{opacity:.86;border-color:#2a4a37}
    .wc-resolution-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
    .wc-resolution-title{font-weight:800;font-size:16px;color:#eafff1}
    .wc-resolution-meta{display:grid;gap:4px}
    .wc-badge{padding:3px 9px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.07em}
    .wc-badge-active{background:rgba(34,197,94,.2);border:1px solid #4ade80;color:#bbf7d0}
    .wc-badge-reject{background:rgba(248,113,113,.16);border:1px solid #f87171;color:#fecaca}
    .wc-badge-muted{background:rgba(148,163,184,.16);border:1px solid #64748b;color:#cbd5e1}
    .wc-muted{color:#9dccb1;font-size:13px;line-height:1.45}
    .wc-target{color:#fcd34d;font-size:13px}
    .wc-outcome-text{color:#c7e8d3;font-size:13px;line-height:1.45;margin-top:2px}
    .wc-table{display:grid;border:1px solid #1f6e40;border-radius:9px;overflow:hidden}
    .wc-row{display:grid;grid-template-columns:minmax(180px,1.6fr) repeat(5,minmax(80px,1fr));gap:8px;padding:10px 14px;border-top:1px solid #143f27;align-items:center;text-align:right}
    .wc-row:first-child{border-top:0}
    .wc-row-header{background:#0e3a22;color:#a7f3c9;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}
    .wc-row-human{background:rgba(34,197,94,.1)}
    .wc-cell{font-variant-numeric:tabular-nums}
    .wc-cell-nation{text-align:left;display:flex;align-items:center;gap:10px}
    .wc-nation-name{font-weight:700;color:#eafff1}
    .wc-swatch{width:12px;height:12px;border-radius:3px;flex:0 0 auto;border:1px solid rgba(255,255,255,.35)}
    .wc-meeting-card{padding:15px 17px;border:1px solid #1f6e40;border-radius:10px;background:rgba(4,24,13,.55);display:grid;gap:10px;margin-bottom:14px}
    .wc-meeting-card.wc-meeting-emergency{border-color:#b45454;background:rgba(40,14,14,.5)}
    .wc-meeting-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
    .wc-meeting-title{font-weight:800;font-size:17px;color:#f2fff6}
    .wc-meeting-meta{display:grid;gap:3px}
    .wc-proposal-list{display:grid;gap:10px;margin-top:4px}
    .wc-proposal{padding:12px 14px;border:1px solid #21503464;border-left:3px solid #22c55e;border-radius:7px;background:rgba(2,16,8,.5);display:grid;gap:6px}
    .wc-proposal-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
    .wc-proposal-title{font-weight:800;font-size:15px;color:#eafff1}
    .wc-proposal-meta{display:grid;gap:3px}
    .wc-footer{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-top:18px;padding-top:14px;border-top:1px solid #164a2b}
    .wc-card button.wc-leave{background:#4a1d1d;border-color:#7f3838;color:#fecaca}
    .wc-card button.wc-leave:hover{background:#6b2626;outline-color:#f87171}
    @media(max-width:680px){
      .wc-row{grid-template-columns:minmax(120px,1.4fr) repeat(5,minmax(56px,1fr));font-size:12px;padding:8px 10px}
      .wc-card{padding:18px}
    }
  `;
  overlay.appendChild(style);
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function text(value: string, className = ''): HTMLDivElement {
  const node = element('div', className);
  node.textContent = value;
  return node;
}

function heading(value: string, tag: 'h1' | 'h2'): HTMLHeadingElement {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

function badge(value: string, className: string): HTMLSpanElement {
  const node = element('span', `wc-badge ${className}`);
  node.textContent = value;
  return node;
}

function metric(label: string, value: string): HTMLDivElement {
  const node = element('div', 'wc-metric');
  node.append(text(label, 'wc-metric-label'), text(value, 'wc-metric-value'));
  return node;
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const node = element('button', className);
  node.type = 'button';
  node.textContent = label;
  node.addEventListener('click', onClick);
  return node;
}
