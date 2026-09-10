import { buildPeacekeepingContributionControls, type PeacekeepingContributionChoice } from './PeacekeepingContributionControls';

export interface WorldCouncilSessionProposal {
  /** Stable key (slot:resolutionId) used to match the collected vote at resolution. */
  readonly key: string;
  readonly icon: string;
  readonly title: string;
  readonly description: string;
  readonly proposerNationName?: string;
  readonly targetNationName?: string;
  readonly secondaryTargetNationName?: string;
  readonly resolutionId?: string;
  /** True when the human casts a YES/NO + Influence vote; false for info-only agenda items. */
  readonly requiresVote: boolean;
  readonly suggestedSupport: boolean;
  readonly suggestedInfluence: number;
}

/** One resolution the human host may choose to place on the meeting agenda. */
export interface WorldCouncilProposalOption {
  /** Stable candidate key handed back on submit (resolutionId:repealTarget). */
  readonly key: string;
  readonly icon: string;
  readonly title: string;
  readonly description: string;
  /** Optional line naming who the resolution concerns, when known up front. */
  readonly targetHint?: string;
}

/** Present when the human is this meeting's host and must choose its proposals. */
export interface WorldCouncilProposalSelection {
  /** Exactly how many proposals the host must select (normally 2). */
  readonly pickCount: number;
  readonly candidates: readonly WorldCouncilProposalOption[];
}

export interface WorldCouncilSessionState {
  readonly organizationName: string;
  readonly meetingKindLabel: string;
  readonly cityName: string;
  readonly cityNationName?: string;
  readonly hostNationName?: string;
  readonly round: number;
  readonly availableInfluence: number;
  readonly backgroundImageUrl?: string;
  readonly proposals: WorldCouncilSessionProposal[];
  /**
   * When set, the human is the meeting host and picks the agenda first; the
   * dialog opens on the proposal-selection step, then transitions to voting on
   * the committed agenda via {@link WorldCouncilSessionCallbacks.onSubmitProposals}.
   */
  readonly proposalSelection?: WorldCouncilProposalSelection;
}

export type WorldCouncilSessionOutcome = 'passed' | 'rejected' | 'no_target' | 'unresolved';

export interface WorldCouncilSessionResultProposal extends PeacekeepingContributionChoice {
  readonly title: string;
  readonly outcome: WorldCouncilSessionOutcome;
  readonly influenceFor?: number;
  readonly influenceAgainst?: number;
  readonly outcomeText?: string;
}

export interface WorldCouncilSessionResult {
  readonly proposals: WorldCouncilSessionResultProposal[];
}

export interface WorldCouncilSessionVote {
  readonly key: string;
  readonly support: boolean;
  readonly influence: number;
}

export interface WorldCouncilSessionCallbacks {
  /** Canonical voting state for the pending meeting, or null when none is pending. */
  getState: () => WorldCouncilSessionState | null;
  /** Hand the collected votes to gameplay logic; returns the canonical resolved result. */
  onSubmitVotes: (votes: WorldCouncilSessionVote[]) => WorldCouncilSessionResult;
  /**
   * Commit the human host's chosen proposals (by candidate key) and return the
   * resulting voting state to continue the session, or null if nothing remains
   * for the human to vote on. Only invoked from the proposal-selection step.
   */
  onSubmitProposals?: (selectedKeys: string[]) => WorldCouncilSessionState | null;
  /** Return to the world map once the session summary is dismissed. */
  onClose: () => void;
}

const OVERLAY_ID = 'epoch-world-council-session';

/** Clamp free-form Influence input to a safe whole number within [0, max]. */
export function sanitizeInfluence(raw: number, max: number): number {
  if (!Number.isFinite(raw)) return 0;
  const upper = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 0;
  return Math.max(0, Math.min(upper, Math.floor(raw)));
}

export function sessionOutcomeLabel(outcome: WorldCouncilSessionOutcome): string {
  switch (outcome) {
    case 'passed': return 'PASSED';
    case 'rejected': return 'REJECTED';
    case 'no_target': return 'NO ELIGIBLE TARGET';
    default: return 'UNRESOLVED';
  }
}

interface VoteDraft {
  support: boolean;
  influence: number;
}

/**
 * Dedicated in-game Council Session view for interactive human World Council /
 * United Nations voting. Replaces the old window.confirm/window.prompt flow.
 * Presentation only: it collects YES/NO + Influence per proposal and hands them
 * to gameplay via {@link WorldCouncilSessionCallbacks}; it never resolves votes,
 * spends Influence, or duplicates World Council logic itself.
 */
export class WorldCouncilSessionDialog {
  private overlay: HTMLDivElement | null = null;
  private contentRoot: HTMLElement | null = null;
  private state: WorldCouncilSessionState | null = null;
  private result: WorldCouncilSessionResult | null = null;
  private phase: 'proposing' | 'voting' | 'summary' = 'voting';
  private proposalIndex = 0;
  private readonly drafts = new Map<string, VoteDraft>();
  private readonly selectedProposalKeys = new Set<string>();

  constructor(private readonly callbacks: WorldCouncilSessionCallbacks) {}

  isShowing(): boolean {
    return this.state !== null && this.overlay !== null;
  }

  /** Open (or refresh) the session from canonical state. No-op when nothing is pending. */
  show(): void {
    const state = this.callbacks.getState();
    if (!state) return;
    this.result = null;
    if (state.proposalSelection) {
      this.state = state;
      this.phase = 'proposing';
      this.proposalIndex = 0;
      this.drafts.clear();
      this.selectedProposalKeys.clear();
      if (!this.overlay) this.mount();
      this.render();
      return;
    }
    this.enterVotingPhase(state);
    if (!this.overlay) this.mount();
    this.render();
  }

  /** Initialise voting drafts and switch to the voting step for the given agenda. */
  private enterVotingPhase(state: WorldCouncilSessionState): void {
    this.state = state;
    this.phase = 'voting';
    this.proposalIndex = 0;
    this.drafts.clear();
    for (const proposal of state.proposals) {
      if (proposal.requiresVote) {
        this.drafts.set(proposal.key, {
          support: proposal.suggestedSupport,
          influence: sanitizeInfluence(proposal.suggestedInfluence, state.availableInfluence),
        });
      }
    }
  }

  hide(): void {
    this.state = null;
    this.result = null;
    this.drafts.clear();
    this.selectedProposalKeys.clear();
    if (this.overlay) {
      document.removeEventListener('keydown', this.handleKeyDown, true);
      this.overlay.remove();
      this.overlay = null;
      this.contentRoot = null;
    }
  }

  /** HTML overlay lays out via CSS; the Phaser resize hook has nothing to do. */
  layout(): void {
    /* no-op */
  }

  destroy(): void {
    this.hide();
  }

  /** Influence still available after commitments to earlier influence-proposals. */
  private remainingInfluence(uptoIndex: number): number {
    if (!this.state) return 0;
    let committed = 0;
    for (let i = 0; i < uptoIndex && i < this.state.proposals.length; i += 1) {
      const proposal = this.state.proposals[i]!;
      if (!proposal.requiresVote) continue;
      committed += this.drafts.get(proposal.key)?.influence ?? 0;
    }
    return Math.max(0, this.state.availableInfluence - committed);
  }

  private mount(): void {
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'wcs-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'World Council session');
    overlay.tabIndex = -1;
    overlay.style.cssText = OVERLAY_STYLE;
    for (const eventName of ['click', 'mousedown', 'mouseup', 'wheel']) {
      overlay.addEventListener(eventName, (event) => event.stopPropagation());
    }
    document.body.appendChild(overlay);
    this.overlay = overlay;
    document.addEventListener('keydown', this.handleKeyDown, true);
  }

  private render(): void {
    if (!this.overlay || !this.state) return;
    const state = this.state;

    const card = element('section', 'wcs-card');
    card.style.cssText = CARD_STYLE;

    if (state.backgroundImageUrl) {
      const bg = element('div', 'wcs-bg');
      bg.style.backgroundImage = `url("${cssUrl(state.backgroundImageUrl)}")`;
      card.appendChild(bg);
    }
    const scrim = element('div', 'wcs-scrim');
    card.appendChild(scrim);

    const inner = element('div', 'wcs-inner');
    inner.appendChild(this.buildHeader(state));
    if (this.phase === 'proposing' && state.proposalSelection) {
      inner.appendChild(this.buildProposingBody(state, state.proposalSelection));
    } else if (this.phase === 'voting') {
      inner.appendChild(this.buildVotingBody(state));
    } else {
      inner.appendChild(this.buildSummaryBody());
    }
    card.appendChild(inner);

    this.contentRoot = inner;
    this.overlay.replaceChildren(card);
    appendStyles(this.overlay);
  }

  private buildHeader(state: WorldCouncilSessionState): HTMLElement {
    const header = element('header', 'wcs-header');
    header.appendChild(heading(state.organizationName.toUpperCase(), 'h1'));
    header.appendChild(text(state.meetingKindLabel, 'wcs-session-kind'));
    const location = [state.cityName, state.cityNationName].filter(Boolean).join(', ');
    if (location) header.appendChild(text(location, 'wcs-location'));
    const contextParts: string[] = [];
    if (Number.isFinite(state.round)) contextParts.push(`Round ${state.round}`);
    if (state.hostNationName) contextParts.push(`Presiding Nation: ${state.hostNationName}`);
    if (contextParts.length > 0) header.appendChild(text(contextParts.join('  ·  '), 'wcs-context'));
    return header;
  }

  private buildProposingBody(
    state: WorldCouncilSessionState,
    selection: WorldCouncilProposalSelection,
  ): HTMLElement {
    const body = element('div', 'wcs-body');
    const pickCount = Math.min(selection.pickCount, selection.candidates.length);
    const hostName = state.hostNationName ?? 'Your nation';
    body.appendChild(text(
      `${hostName} presides over this session. Choose ${pickCount === 1 ? 'a proposal' : `${pickCount} proposals`} to put before the Council.`,
      'wcs-progress',
    ));

    const list = element('div', 'wcs-proposal-options');
    if (selection.candidates.length === 0) {
      list.appendChild(text('No eligible resolutions are available to propose.', 'wcs-muted'));
    }
    for (const candidate of selection.candidates) {
      const selected = this.selectedProposalKeys.has(candidate.key);
      const atLimit = this.selectedProposalKeys.size >= pickCount;
      const option = button(
        '',
        `wcs-option${selected ? ' wcs-option-selected' : ''}${!selected && atLimit ? ' wcs-option-disabled' : ''}`,
        () => {
          if (this.selectedProposalKeys.has(candidate.key)) {
            this.selectedProposalKeys.delete(candidate.key);
          } else if (this.selectedProposalKeys.size < pickCount) {
            this.selectedProposalKeys.add(candidate.key);
          }
          this.render();
        },
      );
      option.replaceChildren();
      option.append(
        text(candidate.icon, 'wcs-option-icon'),
        (() => {
          const info = element('div', 'wcs-option-info');
          info.appendChild(text(candidate.title, 'wcs-option-title'));
          if (candidate.description) {
            const desc = element('div', 'wcs-option-desc');
            desc.textContent = candidate.description;
            info.appendChild(desc);
          }
          if (candidate.targetHint) info.appendChild(text(candidate.targetHint, 'wcs-target'));
          return info;
        })(),
        text(selected ? '✓' : '', 'wcs-option-check'),
      );
      list.appendChild(option);
    }
    body.appendChild(list);

    body.appendChild(text(
      `${this.selectedProposalKeys.size} of ${pickCount} selected`,
      'wcs-available',
    ));

    const ready = this.selectedProposalKeys.size === pickCount && pickCount > 0;
    const continueButton = button(
      'Propose & Continue to Vote',
      `wcs-primary${ready ? '' : ' wcs-option-disabled'}`,
      () => {
        if (!ready) return;
        this.submitProposals();
      },
    );
    body.appendChild(this.buildActionRow([continueButton]));
    return body;
  }

  private submitProposals(): void {
    const nextState = this.callbacks.onSubmitProposals?.([...this.selectedProposalKeys]) ?? null;
    this.selectedProposalKeys.clear();
    if (nextState && nextState.proposals.length > 0) {
      this.enterVotingPhase(nextState);
      this.render();
      return;
    }
    // Nothing left to vote on (resolved synchronously): show an empty summary.
    this.result = { proposals: [] };
    this.phase = 'summary';
    this.render();
  }

  private buildVotingBody(state: WorldCouncilSessionState): HTMLElement {
    const body = element('div', 'wcs-body');
    const total = state.proposals.length;
    const proposal = state.proposals[this.proposalIndex];
    if (!proposal) {
      body.appendChild(text('No agenda items require your attention.', 'wcs-empty'));
      body.appendChild(this.buildActionRow([button('Continue', 'wcs-primary', () => this.submitAll())]));
      return body;
    }

    body.appendChild(text(`Proposal ${this.proposalIndex + 1} of ${total}`, 'wcs-progress'));

    const card = element('div', 'wcs-proposal-card');
    card.appendChild(text(proposal.icon, 'wcs-proposal-icon'));
    card.appendChild(heading(proposal.title.toUpperCase(), 'h2'));
    if (proposal.proposerNationName) {
      card.appendChild(text(`Proposed by ${proposal.proposerNationName}`, 'wcs-proposer'));
    }
    if (proposal.description) {
      const desc = element('p', 'wcs-description');
      desc.textContent = proposal.description;
      card.appendChild(desc);
    }
    const targetText = formatTarget(proposal);
    if (targetText) card.appendChild(text(targetText, 'wcs-target'));
    body.appendChild(card);

    if (proposal.requiresVote) {
      body.appendChild(this.buildVoteControls(proposal, this.remainingInfluence(this.proposalIndex)));
    } else {
      body.appendChild(text('No vote is required on this item.', 'wcs-muted'));
    }

    const isLast = this.proposalIndex >= total - 1;
    const actions: HTMLElement[] = [];
    if (this.proposalIndex > 0) {
      actions.push(button('Back', 'wcs-secondary', () => {
        this.proposalIndex -= 1;
        this.render();
      }));
    }
    actions.push(button(isLast ? 'Cast Vote & Conclude' : 'Cast Vote', 'wcs-primary', () => {
      if (isLast) this.submitAll();
      else {
        this.proposalIndex += 1;
        this.render();
      }
    }));
    body.appendChild(this.buildActionRow(actions));
    return body;
  }

  private buildVoteControls(proposal: WorldCouncilSessionProposal, maxInfluence: number): HTMLElement {
    const draft = this.drafts.get(proposal.key) ?? { support: proposal.suggestedSupport, influence: 0 };
    draft.influence = sanitizeInfluence(draft.influence, maxInfluence);
    this.drafts.set(proposal.key, draft);

    const controls = element('div', 'wcs-controls');

    const voteRow = element('div', 'wcs-vote-row');
    const yesButton = button('YES', `wcs-vote wcs-yes${draft.support ? ' wcs-selected' : ''}`, () => {
      draft.support = true;
      this.render();
    });
    const noButton = button('NO', `wcs-vote wcs-no${!draft.support ? ' wcs-selected' : ''}`, () => {
      draft.support = false;
      this.render();
    });
    voteRow.append(yesButton, noButton);
    controls.appendChild(voteRow);

    if (proposal.resolutionId === 'collective_nuclear_response') { draft.influence = 0; return controls; }
    const influenceLabel = element('div', 'wcs-influence-label');
    influenceLabel.textContent = 'Influence Commitment';
    controls.appendChild(influenceLabel);

    const stepper = element('div', 'wcs-stepper');
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'wcs-influence-input';
    input.min = '0';
    input.max = String(maxInfluence);
    input.step = '1';
    input.inputMode = 'numeric';
    input.value = String(draft.influence);
    const commit = (value: number): void => {
      draft.influence = sanitizeInfluence(value, maxInfluence);
      input.value = String(draft.influence);
      available.textContent = `Available Influence: ${maxInfluence - draft.influence}`;
    };
    input.addEventListener('input', () => {
      const parsed = Number.parseInt(input.value, 10);
      draft.influence = sanitizeInfluence(parsed, maxInfluence);
      available.textContent = `Available Influence: ${maxInfluence - draft.influence}`;
    });
    input.addEventListener('blur', () => commit(Number.parseInt(input.value, 10)));

    stepper.append(
      button('−10', 'wcs-step', () => commit(draft.influence - 10)),
      button('−', 'wcs-step', () => commit(draft.influence - 1)),
      input,
      button('+', 'wcs-step', () => commit(draft.influence + 1)),
      button('+10', 'wcs-step', () => commit(draft.influence + 10)),
    );
    controls.appendChild(stepper);

    const available = element('div', 'wcs-available');
    available.textContent = `Available Influence: ${maxInfluence - draft.influence}`;
    controls.appendChild(available);
    return controls;
  }

  private buildSummaryBody(): HTMLElement {
    const body = element('div', 'wcs-body');
    body.appendChild(text('SESSION COMPLETE', 'wcs-progress'));
    const list = element('div', 'wcs-summary-list');
    const proposals = this.result?.proposals ?? [];
    if (proposals.length === 0) {
      list.appendChild(text('The meeting concluded with no resolvable agenda items.', 'wcs-muted'));
    }
    for (const proposal of proposals) {
      const row = element('div', 'wcs-summary-row');
      const head = element('div', 'wcs-summary-head');
      head.append(
        text(proposal.title, 'wcs-summary-title'),
        badge(sessionOutcomeLabel(proposal.outcome), outcomeBadgeClass(proposal.outcome)),
      );
      row.appendChild(head);
      if (proposal.influenceFor !== undefined || proposal.influenceAgainst !== undefined) {
        row.appendChild(text(
          `${proposal.influenceFor ?? 0} Influence For · ${proposal.influenceAgainst ?? 0} Influence Against`,
          'wcs-muted',
        ));
      }
      if (proposal.outcomeText) row.appendChild(text(proposal.outcomeText, 'wcs-muted'));
      if (proposal.contributionUnits) row.appendChild(buildPeacekeepingContributionControls(proposal));
      list.appendChild(row);
    }
    body.appendChild(list);
    body.appendChild(this.buildActionRow([
      button('Return to World Map', 'wcs-primary', () => this.callbacks.onClose()),
    ]));
    return body;
  }

  private buildActionRow(children: HTMLElement[]): HTMLElement {
    const row = element('div', 'wcs-actions');
    row.append(...children);
    return row;
  }

  private submitAll(): void {
    if (!this.state) return;
    const votes: WorldCouncilSessionVote[] = [];
    for (const proposal of this.state.proposals) {
      if (!proposal.requiresVote) continue;
      const draft = this.drafts.get(proposal.key);
      if (!draft) continue;
      votes.push({ key: proposal.key, support: draft.support, influence: draft.influence });
    }
    this.result = this.callbacks.onSubmitVotes(votes);
    this.phase = 'summary';
    this.render();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.isShowing()) return;
    // Modal: swallow game hotkeys while the session is open. Enter advances the
    // summary; there is deliberately no Escape-to-cancel (voting is mandatory).
    event.stopPropagation();
    if (event.key === 'Enter' && this.phase === 'summary') {
      event.preventDefault();
      this.callbacks.onClose();
    }
  };
}

/**
 * Human-readable line naming the specific nation(s) a resolution concerns, worded
 * per resolution so the voter sees exactly who it applies to (e.g. the two warring
 * nations a ceasefire would separate, or the nation a sanction targets). Returns
 * null for resolutions with no meaningful national target.
 */
function formatTarget(proposal: WorldCouncilSessionProposal): string | null {
  const primary = proposal.targetNationName;
  const secondary = proposal.secondaryTargetNationName;
  if (!primary) return null;
  if (secondary) {
    switch (proposal.resolutionId) {
      case 'ceasefire_resolution':
        return `Nations at war: ${primary} and ${secondary}`;
      case 'un_peacekeeping_mission':
        return `Host: ${primary}  ·  Threat: ${secondary}`;
      default:
        return `Concerns: ${primary} and ${secondary}`;
    }
  }
  switch (proposal.resolutionId) {
    case 'condemn_aggressive_war':
      return `Condemned nation: ${primary}`;
    case 'international_sanctions':
      return `Sanctions against: ${primary}`;
    case 'international_embargo':
      return `Embargo against: ${primary}`;
    case 'games_of_nations_hosting':
      return `Current host: ${primary}`;
    case 'exclude_games_of_nations_participant':
      return `Excluded participant: ${primary}`;
    default:
      return `Target: ${primary}`;
  }
}

function outcomeBadgeClass(outcome: WorldCouncilSessionOutcome): string {
  if (outcome === 'passed') return 'wcs-badge-active';
  if (outcome === 'rejected') return 'wcs-badge-reject';
  return 'wcs-badge-muted';
}

function cssUrl(url: string): string {
  return url.replace(/"/g, '%22');
}

const OVERLAY_STYLE = `
  position:fixed;inset:0;z-index:10019;display:flex;align-items:center;justify-content:center;
  box-sizing:border-box;padding:18px;background:rgba(2,10,6,.86);color:#e7f6ec;
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
`;
const CARD_STYLE = `
  position:relative;width:min(760px,96vw);max-height:94vh;overflow:hidden;box-sizing:border-box;
  border:1px solid #1f7a44;border-radius:14px;box-shadow:0 30px 90px rgba(0,0,0,.75);
  background:#06210f;
`;

function appendStyles(overlay: HTMLElement): void {
  const style = document.createElement('style');
  style.textContent = `
    .wcs-bg{position:absolute;inset:0;background-size:cover;background-position:center top;filter:saturate(.9)}
    .wcs-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,20,11,.72),rgba(3,16,9,.9) 62%,rgba(4,22,12,.96))}
    .wcs-inner{position:relative;max-height:94vh;overflow-y:auto;padding:clamp(20px,3vw,30px)}
    .wcs-header{text-align:center;display:grid;gap:4px;border-bottom:1px solid #1a5230;padding-bottom:16px}
    .wcs-card h1{margin:0;font-size:clamp(24px,3.6vw,34px);letter-spacing:.08em;color:#f2fff6}
    .wcs-card h2{margin:6px 0 4px;font-size:clamp(18px,2.6vw,24px);letter-spacing:.05em;color:#eafff1}
    .wcs-session-kind{color:#86efac;font-weight:700;letter-spacing:.05em}
    .wcs-location{color:#cdeed8;font-size:15px}
    .wcs-context{color:#9dccb1;font-size:13px}
    .wcs-body{display:grid;gap:16px;margin-top:18px;justify-items:center}
    .wcs-progress{color:#7fc79b;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
    .wcs-proposal-card{width:100%;text-align:center;padding:18px 20px;border:1px solid #1f6e40;border-radius:11px;background:rgba(3,20,11,.66);display:grid;gap:8px;justify-items:center}
    .wcs-proposal-icon{font-size:34px;line-height:1}
    .wcs-proposer{color:#9dccb1;font-size:14px}
    .wcs-description{margin:6px 0 0;max-width:52ch;line-height:1.5;color:#dcede2}
    .wcs-target{color:#fcd34d;font-weight:700;font-size:14px}
    .wcs-controls{width:100%;max-width:460px;display:grid;gap:12px;justify-items:center}
    .wcs-vote-row{display:flex;gap:14px;width:100%;justify-content:center}
    .wcs-card button{border:1px solid #2f7d4f;border-radius:8px;background:#0d3b21;color:#eafff1;padding:10px 18px;font:800 15px inherit;cursor:pointer}
    .wcs-card button:hover,.wcs-card button:focus-visible{background:#155c33;outline:2px solid #4ade80;outline-offset:2px}
    .wcs-card button.wcs-vote{flex:1;max-width:170px;font-size:18px;letter-spacing:.06em;padding:14px 0;opacity:.72}
    .wcs-card button.wcs-vote.wcs-selected{opacity:1}
    .wcs-card button.wcs-yes.wcs-selected{background:#15803d;border-color:#4ade80;box-shadow:0 0 0 2px rgba(74,222,128,.4)}
    .wcs-card button.wcs-no.wcs-selected{background:#7f1d1d;border-color:#f87171;box-shadow:0 0 0 2px rgba(248,113,113,.4)}
    .wcs-influence-label{color:#a7d8ba;font-size:13px;text-transform:uppercase;letter-spacing:.06em;font-weight:700}
    .wcs-stepper{display:flex;align-items:center;gap:8px}
    .wcs-card button.wcs-step{padding:9px 12px;font-size:15px;min-width:46px}
    .wcs-influence-input{width:120px;box-sizing:border-box;padding:10px;text-align:center;border:1px solid #2f7d4f;border-radius:8px;background:#03160b;color:#f2fff6;font:800 18px inherit}
    .wcs-available{color:#cdeed8;font-size:14px;font-weight:700}
    .wcs-muted{color:#9dccb1;font-size:14px}
    .wcs-empty{color:#8fc6a5;font-style:italic}
    .wcs-proposal-options{width:100%;max-width:560px;display:grid;gap:10px}
    .wcs-card button.wcs-option{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:12px 14px;border:1px solid #1f6e40;border-radius:10px;background:rgba(3,20,11,.6);font-weight:600;cursor:pointer}
    .wcs-card button.wcs-option:hover{background:#123f24}
    .wcs-card button.wcs-option-selected{background:#134e2b;border-color:#4ade80;box-shadow:0 0 0 2px rgba(74,222,128,.4)}
    .wcs-card button.wcs-option-disabled{opacity:.5;cursor:not-allowed}
    .wcs-option-icon{font-size:26px;line-height:1;flex:0 0 auto}
    .wcs-option-info{flex:1;display:grid;gap:3px;min-width:0}
    .wcs-option-title{font-weight:800;color:#eafff1;letter-spacing:.02em}
    .wcs-option-desc{color:#cdeed8;font-size:13px;line-height:1.4;font-weight:500}
    .wcs-option-check{flex:0 0 auto;color:#4ade80;font-weight:800;font-size:18px;width:18px;text-align:center}
    .wcs-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:8px}
    .wcs-card button.wcs-primary{background:#16a34a;border-color:#4ade80;color:#f2fff6;padding:12px 26px}
    .wcs-card button.wcs-primary:hover{background:#1c9d4c}
    .wcs-card button.wcs-secondary{background:transparent;border-color:#2a684094;color:#a7d8ba}
    .wcs-summary-list{width:100%;max-width:560px;display:grid;gap:10px}
    .wcs-summary-row{padding:12px 15px;border:1px solid #1f6e40;border-radius:9px;background:rgba(3,20,11,.6);display:grid;gap:5px}
    .wcs-summary-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
    .wcs-summary-title{font-weight:800;color:#eafff1}
    .wcs-badge{padding:3px 9px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.06em;white-space:nowrap}
    .wcs-badge-active{background:rgba(34,197,94,.2);border:1px solid #4ade80;color:#bbf7d0}
    .wcs-badge-reject{background:rgba(248,113,113,.16);border:1px solid #f87171;color:#fecaca}
    .wcs-badge-muted{background:rgba(148,163,184,.16);border:1px solid #64748b;color:#cbd5e1}
    @media(max-width:680px){.wcs-vote-row{flex-direction:column;align-items:center}.wcs-card button.wcs-vote{max-width:100%;width:100%}}
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
  const node = element('span', `wcs-badge ${className}`);
  node.textContent = value;
  return node;
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const node = element('button', className);
  node.type = 'button';
  node.textContent = label;
  node.addEventListener('click', onClick);
  return node;
}
