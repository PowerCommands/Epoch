import { ALL_GAMES_SPORTS, getGamesSportByName } from '../data/gamesOfNationsSports';
import { GAMES_POINTS_PER_RESOURCE, reduceGamesStrategyToBudget } from '../systems/GamesOfNationsSystem';
import type { GamesOfNationsSport, GamesOfNationsSportId, GamesOfNationsSportValues } from '../types/gamesOfNations';
import type { GamesOfNationsUiModel } from './hud/GamesOfNationsUiModel';

const OVERLAY_ID = 'epoch-games-of-nations-dialog';

export interface GamesOfNationsDialogCallbacks {
  getModel: () => GamesOfNationsUiModel;
  onParticipationDecision: (participating: boolean) => boolean;
  onApply: (
    culture: number,
    baseProduction: number,
    strategy: GamesOfNationsSportValues,
    hostBonusSport?: GamesOfNationsSport,
  ) => boolean;
  onStrategyAdjustmentSeen: () => void;
  onAllocateGamesPoints: (sport: GamesOfNationsSport, amount: number) => boolean;
  onDistributeRemainingGamesPoints: () => boolean;
  onHostingDecision: (accept: boolean) => boolean;
  onHostCitySelected: (cityId: string) => boolean;
  onSportAuctionBid: (sportId: GamesOfNationsSportId, bid: number) => boolean;
  onSportAuctionAbstain: () => boolean;
}

/** Accessible HTML presentation for the one-time prompt and reusable Games panel. */
export class GamesOfNationsDialog {
  private mode: 'prompt' | 'hosting' | 'hostCity' | 'auction' | 'panel' | null = null;
  private hostBonusSportDraft: GamesOfNationsSport | undefined;
  private hostBonusSelectionChanged: (() => void) | null = null;

  constructor(private readonly callbacks: GamesOfNationsDialogCallbacks) {}

  isOpen(): boolean {
    return document.getElementById(OVERLAY_ID) !== null;
  }

  isPromptOpen(): boolean {
    return this.mode === 'prompt' && this.isOpen();
  }

  showHostingPrompt(): void {
    const model = this.callbacks.getModel();
    if (!model.hostingPromptPending) return;
    this.mode = 'hosting';
    const { overlay, card } = this.createShell('Games of Nations hosting decision');
    overlay.dataset.mode = 'hosting';
    card.append(
      heading('Games of Nations', 'h1'),
      paragraph('Your nation has been selected to host the next Games of Nations.'),
      paragraph('Hosting requires choosing a city and completing a Grand Stadium before the Games begin. If it is not ready, the Games will be cancelled.'),
    );
    const actions = element('div', 'gon-actions');
    actions.append(
      button('Accept Hosting', 'gon-participate', () => {
        if (!this.callbacks.onHostingDecision(true)) return;
        this.showHostCitySelection();
      }, true),
      button('Decline', 'gon-decline', () => {
        if (this.callbacks.onHostingDecision(false)) this.close();
      }),
    );
    card.appendChild(actions);
    this.mount(overlay, '.gon-participate');
  }

  showHostCitySelection(): void {
    const model = this.callbacks.getModel();
    if (!model.hostCitySelectionPending) return;
    this.close();
    this.mode = 'hostCity';
    const { overlay, card } = this.createShell('Choose Games host city');
    overlay.dataset.mode = 'hostCity';
    card.append(heading('Choose the host city', 'h1'), paragraph('This choice is locked for the current Games cycle.'));
    const actions = element('div', 'gon-actions');
    for (const city of model.hostCityOptions) {
      const stadium = city.hasGrandStadium
        ? 'Grand Stadium: Completed · Hosting requirement: Already satisfied'
        : `Grand Stadium: Not built · ${city.estimatedTurns === null
          ? `Production: ${city.productionPerTurn}/turn`
          : `Estimated completion: ${city.estimatedTurns} turns`}`;
      actions.appendChild(button(`${city.name} — Production: ${city.productionPerTurn}/turn · ${stadium}`, 'gon-participate', () => {
        if (this.callbacks.onHostCitySelected(city.id)) this.close();
      }));
    }
    card.appendChild(actions);
    this.mount(overlay, '.gon-participate');
  }

  showSportAuction(): void {
    const model = this.callbacks.getModel();
    const auction = model.sportAuction;
    if (!auction) return;
    this.mode = 'auction';
    const { overlay, card } = this.createShell('Games of Nations sport auction');
    overlay.dataset.mode = 'auction';
    card.append(
      heading(`${capitalize(auction.era)} sport auction`, 'h1'),
      paragraph('Nations are bidding for the prestige of introducing the next Games of Nations sport. Only the winner pays.'),
      text(`Your treasury: ${auction.treasury} Gold`, 'gon-emphasis'),
    );
    const proposals = element('div', 'gon-auction-proposals');
    for (const proposal of auction.proposals) {
      proposals.appendChild(metric(proposal.nationName, `${proposal.sportName} — ${proposal.bid} Gold`));
    }
    card.append(heading('Current proposals', 'h2'), proposals);
    if (auction.currentLeader) {
      card.appendChild(notice(`Current leader: ${auction.currentLeader.nationName} — ${auction.currentLeader.sportName} — ${auction.currentLeader.bid} Gold. You must bid at least ${auction.currentLeader.bid + 1} Gold to win.`));
    }
    const select = document.createElement('select');
    select.className = 'gon-number-input';
    select.setAttribute('aria-label', 'Sport nomination');
    for (const candidate of auction.candidates) select.appendChild(new Option(candidate.name, candidate.id));
    const minimum = (auction.currentLeader?.bid ?? -1) + 1;
    const bidInput = numberInput('gon-auction-bid', Math.max(0, minimum), true, auction.treasury);
    const fields = element('div', 'gon-commitment-grid');
    const sportField = element('div', 'gon-commitment-card');
    sportField.append(text('Nominate sport', 'gon-field-label'), select);
    const bidField = element('div', 'gon-commitment-card');
    bidField.append(text('Gold bid', 'gon-field-label'), bidInput);
    fields.append(sportField, bidField);
    const validation = text('', 'gon-validation');
    const actions = element('div', 'gon-actions');
    actions.append(
      button('Do Not Bid', 'gon-decline', () => {
        if (this.callbacks.onSportAuctionAbstain()) this.close();
      }),
      button('Submit Winning Bid', 'gon-participate', () => {
        const sportId = select.value as GamesOfNationsSportId;
        const bid = readWhole(bidInput);
        if (bid > auction.treasury) {
          validation.textContent = 'The bid exceeds your treasury.';
          return;
        }
        if (bid < minimum) {
          validation.textContent = `Your bid must be at least ${minimum} Gold.`;
          return;
        }
        if (this.callbacks.onSportAuctionBid(sportId, bid)) this.close();
        else validation.textContent = 'The bid could not be submitted.';
      }, true),
    );
    card.append(fields, validation, actions);
    this.mount(overlay, '.gon-participate');
  }

  showPrompt(): void {
    const model = this.callbacks.getModel();
    if (!model.promptPending) return;
    this.mode = 'prompt';
    const { overlay, card } = this.createShell('Preparation invitation');
    overlay.dataset.mode = 'prompt';
    card.append(
      heading(`Games of Nations #${model.gamesNumber}`, 'h1'),
      text(`Host: ${model.hostLabel}`, 'gon-host'),
      text('Competition begins in 10 turns.', 'gon-emphasis'),
      paragraph('During Preparation, nations may commit Culture and base Production each turn. Every committed resource point generates 10 Games Points.'),
      paragraph('Investment is optional. Invested resources and assigned Games Points cannot be recovered or moved. Greater investment will improve eventual odds, but does not guarantee victory.'),
    );
    const actions = element('div', 'gon-actions');
    actions.append(
      button(model.humanIsHost ? 'Configure mandatory participation' : 'Participate', 'gon-participate', () => {
        if (!this.callbacks.onParticipationDecision(true)) return;
        this.showPanel();
      }, true),
    );
    if (!model.humanIsHost) {
      actions.appendChild(button('Do not participate', 'gon-decline', () => {
        if (!this.callbacks.onParticipationDecision(false)) return;
        this.close();
      }));
    } else {
      card.appendChild(notice('As host, your nation must participate, but may commit zero Culture and zero Production.'));
    }
    card.appendChild(actions);
    this.mount(overlay, '.gon-participate');
  }

  showPanel(): void {
    if (this.isOpen()) this.close();
    this.mode = 'panel';
    this.hostBonusSportDraft = undefined;
    this.hostBonusSelectionChanged = null;
    const model = this.callbacks.getModel();
    if (model.strategyAdjustmentPending) this.callbacks.onStrategyAdjustmentSeen();
    const { overlay, card } = this.createShell('Games of Nations configuration');
    overlay.dataset.mode = 'panel';
    card.classList.add('gon-panel-card');

    const header = element('header', 'gon-panel-header');
    const titleGroup = element('div');
    const subtitle = model.suspendedForWorldWar
      ? `Games #${model.gamesNumber} · ${model.phaseLabel} · SUSPENDED — WORLD WAR`
      : `Games #${model.gamesNumber} · ${model.phaseLabel}`;
    titleGroup.append(heading('Games of Nations', 'h1'), text(subtitle, 'gon-subtitle'));
    header.append(titleGroup, button('Close', 'gon-close', () => this.close()));
    card.append(header);
    if (model.suspendedForWorldWar) {
      card.appendChild(notice('SUSPENDED — WORLD WAR. The Games of Nations schedule is frozen and will resume when no Historical World War remains active. Committed investment and any competition results are preserved.'));
    }
    card.append(this.buildStatus(model), this.buildHostAdvantage(model));

    if (model.phase === 'waitingForFirstGames') {
      card.appendChild(notice(
        `Founded by ${model.founderNationName ?? 'an unknown nation'}. Preparation begins in ${model.turnsUntilPreparation ?? 0} turns. The first Games start on turn ${model.firstGamesTurn ?? 'unknown'} (${model.turnsUntilCompetition ?? 0} turns away). Investment controls unlock during Preparation.`,
      ));
    } else if (model.phase === 'cooldown') {
      card.appendChild(notice(`Games #${model.gamesNumber} is completed. The next Preparation begins in ${model.turnsUntilPreparation ?? 0} turns.`));
    } else if (model.phase === 'cancelled') {
      card.appendChild(notice(`Games #${model.gamesNumber} was cancelled. No sports or medals are awarded; the previous champion remains reigning champion.`));
    } else if (model.excluded) {
      card.appendChild(notice(`Excluded from Games of Nations #${model.gamesNumber}. The World Council has prohibited your nation from competing. All future Culture and Production commitments are cancelled, and resources already invested will not be returned. You may still inspect the Games and its results.`));
    } else if (!model.participating) {
      card.appendChild(notice('Your nation is not participating in this Games cycle. You may inspect the event, but cannot re-enter until the next Preparation decision.'));
    }

    if (model.phase === 'competition' || model.phase === 'cooldown') {
      card.appendChild(this.buildCompetitionResults(model));
    }
    card.appendChild(this.buildInvestment(model));
    this.mount(overlay, '.gon-close');
  }

  close(): void {
    document.removeEventListener('keydown', this.handleKeyDown, true);
    document.getElementById(OVERLAY_ID)?.remove();
    this.mode = null;
  }

  shutdown(): void {
    this.close();
  }

  private buildStatus(model: GamesOfNationsUiModel): HTMLElement {
    const section = element('section', 'gon-status-grid');
    section.setAttribute('aria-label', 'Current Games status');
    section.append(
      metric('Host', model.hostLabel),
      metric('Phase', model.phaseLabel),
      metric('Participating', model.excluded ? 'No — excluded by World Council' : model.phase === 'waitingForFirstGames' ? 'Decision at Preparation' : model.participating ? 'Yes' : 'No'),
      metric('Next host', model.publicHostLabel),
      metric('Grand Stadium', model.stadiumStatus),
    );
    if (model.preparationProgress) section.appendChild(metric('Preparation', model.preparationProgress));
    if (model.competitionProgress) section.appendChild(metric('Competition progress', model.competitionProgress));
    if (model.cooldownProgress) section.appendChild(metric('Cooldown progress', model.cooldownProgress));
    if (model.phase === 'preparation') section.appendChild(metric('Competition begins in', `${model.turnsUntilCompetition ?? 0} turns`));
    if (model.phase === 'competition') section.appendChild(metric('Current sport', model.activeSport ?? '—'));
    if (model.turnsUntilCompetition !== null) section.appendChild(metric('Games deadline', `${model.turnsUntilCompetition} turns`));
    if (model.stadiumEstimatedTurns !== null && !model.stadiumStatus.startsWith('Completed')) {
      section.appendChild(metric('Stadium estimate', `${model.stadiumEstimatedTurns} turns${model.stadiumAtRisk ? ' — AT RISK' : ''}`));
    }
    if (model.phase === 'cooldown') section.appendChild(metric('Next Preparation', `${model.turnsUntilPreparation ?? 0} turns`));
    return section;
  }

  private buildInvestment(model: GamesOfNationsUiModel): HTMLElement {
    const participant = model.participant;
    const editable = model.controlsEditable;
    const section = element('section', 'gon-investment');
    const headingRow = element('div', 'gon-section-heading');
    headingRow.append(heading('Preparation investment', 'h2'), text(editable
      ? 'Changes affect future Preparation turns only.'
      : model.suspendedForWorldWar
        ? 'Investment suspended during World War. Committed resources are preserved; no further Culture or Production can be committed until the Games resume.'
        : model.excluded
          ? 'Disabled: your nation has been excluded from this Games cycle by the World Council.'
          : 'Read-only outside active participation in Preparation.', 'gon-muted'));
    section.appendChild(headingRow);

    const commitments = element('div', 'gon-commitment-grid');
    const cultureInput = numberInput('gon-culture-commitment', participant?.cultureCommitment ?? 0, editable);
    const productionInput = numberInput('gon-production-commitment', participant?.productionCommitment ?? 0, editable);
    commitments.append(
      commitmentCard(
        'Culture commitment',
        cultureInput,
        `${model.culture.available} Culture generated this turn`,
        model.culture,
        'Games investment diverts Culture generated each turn. Existing Culture progress is not spent.',
      ),
      commitmentCard(
        'Base Production commitment',
        productionInput,
        `${model.production.available} base Production available this turn`,
        model.production,
        'Production is diverted before Production bonuses are applied, so its impact on normal production may be greater than the base amount committed.',
      ),
    );
    section.appendChild(commitments);

    const pointsSummary = element('div', 'gon-points-summary');
    pointsSummary.append(
      metric('Theoretical potential', `${model.theoreticalGamesPointsPerTurn} GP / turn`),
      metric('Currently achievable', `${model.achievableGamesPointsPerTurn} GP / turn`),
    );
    section.appendChild(pointsSummary);

    section.append(heading('Locked investment this Games', 'h2'));
    const totals = element('div', 'gon-status-grid');
    totals.append(
      metric('Culture invested', `${participant?.totalCultureInvested ?? 0}`),
      metric('Base Production invested', `${participant?.totalProductionInvested ?? 0}`),
      metric('Total Games Points', `${participant?.totalGamesPoints ?? 0} GP`),
    );
    section.appendChild(totals);

    const earnedPool = participant?.unallocatedGamesPoints ?? 0;
    const storedStrategy = participant?.gamesPointsStrategyBySport ?? participant?.gamesPointsBySport;
    const strategy = Object.fromEntries(ALL_GAMES_SPORTS.map((sport) => [
      sport,
      storedStrategy?.[sport] ?? 0,
    ])) as GamesOfNationsSportValues;
    const strategyTotal = (): number => model.activeSports.reduce((sum, sport) => sum + strategy[sport], 0);
    const draftBudget = (): number => (
      readWhole(cultureInput) + readWhole(productionInput)
    ) * GAMES_POINTS_PER_RESOURCE;
    const poolHeader = element('div', 'gon-gp-pool');
    const poolValue = text('0 GP / turn', 'gon-gp-pool-value');
    const poolHint = text('Assign the planned GP now. The same strategy is applied when resources are paid each Preparation turn.', 'gon-muted');
    poolHeader.append(
      text('Planned Games Points available to assign', 'gon-metric-label'),
      poolValue,
      poolHint,
    );
    section.append(poolHeader, heading('Recurring sport strategy', 'h2'));
    const allocationTable = element('div', 'gon-sport-grid');
    allocationTable.setAttribute('role', 'group');
    allocationTable.setAttribute('aria-label', 'Direct Games Points allocation');
    const plannedLabels = new Map<GamesOfNationsSport, HTMLElement>();
    const bonusDisplays = new Map<GamesOfNationsSport, {
      hostChip?: HTMLElement;
      policyChip?: HTMLElement;
      effective: HTMLElement;
      committed: number;
      policyBonus: number;
    }>();
    const strategyButtons: HTMLButtonElement[] = [];
    let refreshDraft = (): void => {};
    for (const sport of model.activeSports) {
      const committed = participant?.gamesPointsBySport[sport] ?? 0;
      const card = element('article', 'gon-sport-card');
      const image = document.createElement('img');
      image.className = 'gon-sport-image';
      image.src = getGamesSportByName(sport).image;
      image.alt = '';
      image.loading = 'lazy';
      const controls = element('div', 'gon-sport-controls');
      const allocationButton = (label: string, amount: number | 'all'): HTMLButtonElement => {
        const control = button(label, 'gon-gp-add', () => {
          const remaining = Math.max(0, draftBudget() - strategyTotal());
          const delta = amount === 'all' ? remaining : amount;
          strategy[sport] = Math.max(0, strategy[sport] + Math.min(delta, remaining));
          refreshDraft();
        });
        strategyButtons.push(control);
        return control;
      };
      controls.append(
        allocationButton('−10', -10),
        allocationButton('+10', 10),
        allocationButton('+50', 50),
        allocationButton('ALL', 'all'),
      );
      const plannedLabel = text('0 GP / turn planned', 'gon-sport-committed');
      plannedLabels.set(sport, plannedLabel);
      card.append(
        text(sport, 'gon-sport-name'),
        image,
        plannedLabel,
        text(`${committed} GP invested this Games`, 'gon-sport-effective'),
      );
      // Bonuses that add to this sport's effective score are shown the same way
      // for the host advantage and for active policy cards (chip + effective).
      const hostPossible = model.humanIsHost && model.hostBonusGamesPoints > 0;
      const policyBonus = model.policySportBonuses[sport] ?? 0;
      if (hostPossible || policyBonus > 0) {
        const entry: {
          hostChip?: HTMLElement;
          policyChip?: HTMLElement;
          effective: HTMLElement;
          committed: number;
          policyBonus: number;
        } = { effective: text('', 'gon-sport-effective'), committed, policyBonus };
        if (hostPossible) {
          entry.hostChip = text(`Host Bonus +${model.hostBonusGamesPoints} GP`, 'gon-host-bonus-chip');
          entry.hostChip.hidden = true;
          card.append(entry.hostChip);
        }
        if (policyBonus > 0) {
          entry.policyChip = text(`Policy Bonus +${policyBonus} GP`, 'gon-host-bonus-chip');
          card.append(entry.policyChip);
        }
        entry.effective.hidden = true;
        card.append(entry.effective);
        bonusDisplays.set(sport, entry);
      }
      card.appendChild(controls);
      allocationTable.appendChild(card);
    }
    section.appendChild(allocationTable);

    const poolActions = element('div', 'gon-pool-actions');
    const distributeEvenly = button('Distribute Remaining Evenly', 'gon-distribute', () => {
      const remaining = Math.max(0, draftBudget() - strategyTotal());
      const each = Math.floor(remaining / model.activeSports.length);
      let remainder = remaining % model.activeSports.length;
      for (const sport of model.activeSports) {
        strategy[sport] = strategy[sport] + each + (remainder-- > 0 ? 1 : 0);
      }
      refreshDraft();
    });
    const unallocatedLabel = text('', 'gon-unallocated');
    poolActions.append(unallocatedLabel, distributeEvenly);
    section.appendChild(poolActions);

    const validation = text('', 'gon-validation');
    validation.setAttribute('aria-live', 'polite');
    const apply = button(model.promptPending ? 'Confirm initial strategy' : 'Apply future strategy', 'gon-apply', () => {
      const culture = readWhole(cultureInput);
      const production = readWhole(productionInput);
      const hostBonusSport = this.hostBonusSportDraft;
      if (!this.callbacks.onApply(culture, production, { ...strategy }, hostBonusSport)) {
        validation.textContent = 'The strategy could not be applied.';
        return;
      }
      this.showPanel();
    }, true);
    refreshDraft = (): void => {
      const budget = draftBudget();
      if (strategyTotal() > budget) {
        Object.assign(strategy, reduceGamesStrategyToBudget(strategy, budget, model.activeSports));
      }
      const remaining = Math.max(0, budget - strategyTotal());
      poolValue.textContent = `${remaining} GP / turn`;
      poolHint.textContent = `Plan budget: ${budget} GP / turn. Actual resources are charged only when the turn is processed.`;
      unallocatedLabel.textContent = `Strategy unassigned: ${remaining} GP / turn${earnedPool > 0 ? ` · Previously earned unallocated: ${earnedPool} GP` : ''}`;
      for (const sport of model.activeSports) plannedLabels.get(sport)!.textContent = `${strategy[sport]} GP / turn planned`;
      const selectedHostBonusSport = model.hostBonusSport ?? this.hostBonusSportDraft;
      for (const [sport, display] of bonusDisplays) {
        const hostBonus = display.hostChip && sport === selectedHostBonusSport ? model.hostBonusGamesPoints : 0;
        if (display.hostChip) display.hostChip.hidden = hostBonus <= 0;
        if (display.policyChip) display.policyChip.hidden = display.policyBonus <= 0;
        const totalBonus = hostBonus + display.policyBonus;
        display.effective.textContent = `Effective ${display.committed + totalBonus} GP`;
        display.effective.hidden = totalBonus <= 0;
      }
      for (const control of strategyButtons) control.disabled = !editable;
      distributeEvenly.disabled = !editable || remaining <= 0;
      const hostBonusMissing = model.hostBonusSelectionRequired && this.hostBonusSportDraft === undefined;
      apply.disabled = !editable || remaining !== 0 || hostBonusMissing;
      validation.classList.toggle('gon-valid', remaining === 0 && !hostBonusMissing);
      validation.textContent = remaining > 0
        ? `Assign the remaining ${remaining} GP / turn before applying the strategy.`
        : hostBonusMissing
          ? 'Choose the host bonus sport before applying.'
          : model.strategyAdjustmentPending
            ? 'Actual resources changed last turn. The strategy was reduced from its largest sport allocations; review and apply the new balance.'
            : 'The recurring strategy is balanced and ready to apply.';
    };
    this.hostBonusSelectionChanged = refreshDraft;
    cultureInput.addEventListener('input', () => { sanitizeDraft(cultureInput); refreshDraft(); });
    productionInput.addEventListener('input', () => { sanitizeDraft(productionInput); refreshDraft(); });
    refreshDraft();
    const footer = element('div', 'gon-panel-footer');
    footer.append(validation, apply);
    section.appendChild(footer);

    section.appendChild(notice('Each successfully invested Culture or base Production point generates 10 GP. Your recurring sport strategy is configured immediately, but GP becomes locked investment only after the resources are actually paid. If actual GP falls below the plan, the largest planned sport allocations are reduced until the strategy balances, and the panel opens for human review.'));
    return section;
  }

  private buildHostAdvantage(model: GamesOfNationsUiModel): HTMLElement {
    const section = element('section', 'gon-investment');
    section.append(heading('Host Advantage', 'h2'));
    if (!model.hostBonusCalculated) {
      section.appendChild(notice(`${model.hostNationName ?? 'The host'} receives a fixed bonus after initial participant commitments are confirmed.`));
      return section;
    }
    if (model.hostBonusSelectionRequired) {
      section.append(
        text(`Bonus: +${model.hostBonusGamesPoints} GP`, 'gon-emphasis'),
        paragraph('Choose exactly one sport. The entire bonus is locked to that sport when the initial strategy is confirmed.'),
      );
      const select = document.createElement('select');
      select.id = 'gon-host-bonus-sport';
      select.className = 'gon-number-input';
      select.setAttribute('aria-label', 'Host bonus sport');
      select.appendChild(new Option('Choose one sport', ''));
      for (const sport of model.activeSports) select.appendChild(new Option(sport, sport));
      select.addEventListener('change', () => {
        this.hostBonusSportDraft = model.activeSports.find((sport) => sport === select.value);
        this.hostBonusSelectionChanged?.();
      });
      section.appendChild(select);
      return section;
    }
    const assignment = model.hostBonusSport
      ? `${model.hostNationName ?? 'The host'} receives +${model.hostBonusGamesPoints} GP in ${model.hostBonusSport}.`
      : `Host bonus: +${model.hostBonusGamesPoints} GP.`;
    section.appendChild(notice(`${assignment}${model.hostBonusLocked ? ' Locked for this Games.' : ''}`));
    if (model.hostBonusSport && model.hostBonusBaseGamesPoints !== null && model.hostBonusEffectiveGamesPoints !== null) {
      section.appendChild(text(
        `${model.hostBonusSport}: Base GP ${model.hostBonusBaseGamesPoints} · Host Bonus +${model.hostBonusGamesPoints} · Effective GP ${model.hostBonusEffectiveGamesPoints}`,
        'gon-locked',
      ));
    }
    return section;
  }

  private buildCompetitionResults(model: GamesOfNationsUiModel): HTMLElement {
    const section = element('section', 'gon-results');
    section.append(heading(model.phase === 'cooldown' ? 'Final Games result' : 'Competition results', 'h2'));
    if (model.phase === 'cooldown') {
      section.appendChild(notice(model.overallWinnerName
        ? `${model.overallWinnerName} won Games of Nations #${model.gamesNumber}.`
        : `Games of Nations #${model.gamesNumber} ended without an overall winner.`));
    }

    const standings = element('div', 'gon-medal-table');
    standings.setAttribute('role', 'table');
    standings.setAttribute('aria-label', 'Games of Nations medal table');
    const header = element('div', 'gon-medal-row gon-medal-header');
    header.setAttribute('role', 'row');
    header.append(text('Nation'), text('Gold'), text('Silver'), text('Bronze'));
    standings.appendChild(header);
    if (model.medalTable.length === 0) {
      standings.appendChild(text('No medals have been awarded.', 'gon-empty-result'));
    } else {
      for (const entry of model.medalTable) {
        const row = element('div', 'gon-medal-row');
        row.setAttribute('role', 'row');
        row.append(
          text(entry.nationName, 'gon-medal-nation'),
          text(String(entry.gold)),
          text(String(entry.silver)),
          text(String(entry.bronze)),
        );
        standings.appendChild(row);
      }
    }
    section.appendChild(standings);

    const sports = element('div', 'gon-result-sports');
    for (const result of model.sportResults) {
      const card = element('article', `gon-result-sport gon-result-${result.status.toLowerCase()}`);
      card.append(
        text(result.sport, 'gon-result-sport-name'),
        text(result.status, 'gon-result-status'),
      );
      if (result.status === 'Completed') {
        card.append(
          text(result.goldName ? `Gold — ${result.goldName}` : 'No Gold awarded', 'gon-result-gold'),
          text(result.silverName ? `Silver — ${result.silverName}` : 'No Silver awarded'),
          text(result.bronzeName ? `Bronze — ${result.bronzeName}` : 'No Bronze awarded'),
        );
      }
      if (result.sport === model.hostBonusSport) {
        card.appendChild(text(
          `Host advantage — Base GP ${model.hostBonusBaseGamesPoints ?? 0} + ${model.hostBonusGamesPoints} bonus = ${model.hostBonusEffectiveGamesPoints ?? model.hostBonusGamesPoints} effective GP`,
          'gon-locked',
        ));
      }
      sports.appendChild(card);
    }
    section.appendChild(sports);
    return section;
  }

  private createShell(label: string): { overlay: HTMLDivElement; card: HTMLElement } {
    this.close();
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'gon-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', label);
    overlay.tabIndex = -1;
    overlay.style.cssText = OVERLAY_STYLE;
    for (const eventName of ['click', 'mousedown', 'mouseup', 'wheel']) {
      overlay.addEventListener(eventName, (event) => event.stopPropagation());
    }
    const card = element('section', 'gon-card');
    card.style.cssText = CARD_STYLE;
    overlay.appendChild(card);
    appendStyles(overlay);
    return { overlay, card };
  }

  private mount(overlay: HTMLDivElement, focusSelector: string): void {
    document.body.appendChild(overlay);
    document.addEventListener('keydown', this.handleKeyDown, true);
    requestAnimationFrame(() => overlay.querySelector<HTMLElement>(focusSelector)?.focus());
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.isOpen()) return;
    event.stopPropagation();
    if (event.key === 'Escape' && this.mode === 'panel') {
      event.preventDefault();
      this.close();
    }
  };
}

const OVERLAY_STYLE = `
  position:fixed;inset:0;z-index:10018;display:flex;align-items:center;justify-content:center;
  box-sizing:border-box;padding:18px;background:rgba(2,8,23,.82);color:#e8f0ff;
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
`;
const CARD_STYLE = `
  width:min(1120px,96vw);max-height:94vh;overflow:auto;box-sizing:border-box;padding:clamp(20px,3vw,32px);
  border:1px solid #315b91;border-radius:12px;background:linear-gradient(145deg,#071a35,#0b2447 62%,#091a31);
  box-shadow:0 28px 90px rgba(0,0,0,.7),inset 0 1px rgba(147,197,253,.08);
`;

function appendStyles(overlay: HTMLElement): void {
  const style = document.createElement('style');
  style.textContent = `
    .gon-card h1{margin:0 0 8px;font-size:clamp(25px,4vw,38px);color:#f8fbff}.gon-card h2{margin:22px 0 10px;font-size:18px;color:#bfdbfe}
    .gon-card p{line-height:1.52;color:#d7e3f5}.gon-host,.gon-emphasis{font-size:17px;color:#bfdbfe;margin:8px 0}.gon-emphasis{font-weight:700}
    .gon-actions,.gon-panel-footer{display:flex;gap:12px;justify-content:flex-end;align-items:center;flex-wrap:wrap;margin-top:24px}
    .gon-card button{border:1px solid #6b8fbd;border-radius:5px;background:#112b50;color:#eef6ff;padding:10px 17px;font:700 14px inherit;cursor:pointer}
    .gon-card button:hover:not(:disabled),.gon-card button:focus-visible{background:#174477;outline:2px solid #93c5fd;outline-offset:2px}.gon-card button.gon-participate,.gon-card button.gon-apply{background:#1d4ed8;border-color:#60a5fa}.gon-card button:disabled{opacity:.45;cursor:not-allowed}
    .gon-card select{min-width:220px;box-sizing:border-box;padding:9px;border:1px solid #537aa5;border-radius:4px;background:#071525;color:#fff;font:700 14px inherit}
    .gon-panel-header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.gon-subtitle,.gon-muted{color:#9fb5d1;font-size:14px}.gon-status-grid,.gon-points-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:18px 0}
    .gon-metric{padding:11px 13px;border:1px solid #24466f;border-radius:7px;background:rgba(3,13,29,.48)}.gon-metric-label{display:block;color:#8eabc9;font-size:12px;text-transform:uppercase;letter-spacing:.06em}.gon-metric-value{display:block;margin-top:4px;font-weight:700;color:#f1f6ff}
    .gon-notice{margin:16px 0;padding:11px 13px;border-left:3px solid #60a5fa;background:rgba(30,64,175,.15);line-height:1.45;color:#d8e8fb}.gon-section-heading{display:flex;justify-content:space-between;gap:16px;align-items:baseline;flex-wrap:wrap}
    .gon-commitment-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.gon-commitment-card{padding:14px;border:1px solid #294d78;border-radius:8px;background:rgba(3,14,31,.55)}.gon-field-label{display:block;font-weight:700;color:#dbeafe;margin-bottom:8px}.gon-number-wrap{display:flex;align-items:center;gap:8px}.gon-card input[type=number]{width:92px;box-sizing:border-box;padding:8px;border:1px solid #537aa5;border-radius:4px;background:#071525;color:#fff;font:700 16px inherit}.gon-card input:disabled{opacity:.55}.gon-availability,.gon-cost-note,.gon-commitment-status{display:block;margin-top:8px;font-size:13px;color:#a9bfd7}.gon-commitment-status{font-weight:700}.gon-unavailable{color:#fca5a5}.gon-affordable{color:#86efac}
    .gon-gp-pool{display:grid;grid-template-columns:1fr auto;gap:5px 18px;align-items:center;margin:22px 0 8px;padding:16px 18px;border:1px solid #3b82f6;border-radius:9px;background:linear-gradient(135deg,rgba(29,78,216,.23),rgba(3,14,31,.62))}.gon-gp-pool .gon-muted{grid-column:1/-1}.gon-gp-pool-value{font-size:28px;font-weight:900;color:#f8fbff}.gon-sport-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:13px}.gon-sport-card{min-width:0;display:flex;flex-direction:column;gap:9px;padding:13px;border:1px solid #294d78;border-radius:9px;background:rgba(3,14,31,.66);overflow:hidden}.gon-sport-name{font-weight:900;font-size:15px;letter-spacing:.04em;text-transform:uppercase;color:#dbeafe}.gon-sport-image{width:100%;height:105px;object-fit:cover;border-radius:6px;border:1px solid #203e62;background:#071525}.gon-sport-committed{font-size:19px;font-weight:900;color:#f1f6ff}.gon-sport-controls{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:auto}.gon-card button.gon-gp-add{padding:8px 5px;font-size:12px}.gon-host-bonus-chip{align-self:flex-start;padding:4px 7px;border:1px solid #d4a72c;border-radius:999px;background:rgba(180,120,20,.17);color:#fde68a;font-size:12px;font-weight:800}.gon-sport-effective{color:#bfdbfe;font-size:13px;font-weight:700}.gon-pool-actions{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin:15px 0;padding:13px 15px;border:1px solid #24466f;border-radius:8px;background:rgba(3,13,29,.48)}.gon-unallocated{font-size:18px;font-weight:900;color:#f1f6ff}.gon-validation{margin-right:auto;color:#fca5a5}.gon-validation.gon-valid{color:#86efac}
    .gon-medal-table{display:grid;border:1px solid #294d78;border-radius:8px;overflow:hidden;margin:10px 0 16px}.gon-medal-row{display:grid;grid-template-columns:minmax(180px,1fr) repeat(3,80px);gap:8px;padding:9px 12px;border-top:1px solid #1d3859;text-align:center}.gon-medal-row:first-child{border-top:0}.gon-medal-header{background:#102d52;color:#bfdbfe;font-size:12px;font-weight:800;text-transform:uppercase}.gon-medal-nation{text-align:left;font-weight:700}.gon-empty-result{padding:12px;color:#9fb5d1}.gon-result-sports{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:9px}.gon-result-sport{padding:11px;border:1px solid #294d78;border-radius:7px;background:rgba(3,14,31,.55);display:grid;gap:4px;font-size:13px}.gon-result-sport-name{font-weight:800;color:#dbeafe}.gon-result-status{color:#93c5fd;text-transform:uppercase;font-size:11px;letter-spacing:.06em}.gon-result-upcoming{opacity:.66}.gon-result-current{border-color:#60a5fa}.gon-result-gold{color:#fde68a;font-weight:700}
    @media(max-width:680px){.gon-commitment-grid{grid-template-columns:1fr}.gon-sport-grid{grid-template-columns:repeat(auto-fit,minmax(155px,1fr))}.gon-sport-image{height:88px}.gon-card{padding:18px}.gon-panel-header{position:sticky;top:0;background:#071a35;padding-bottom:10px;z-index:1}}
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

function paragraph(value: string): HTMLParagraphElement {
  const node = element('p');
  node.textContent = value;
  return node;
}

function heading(value: string, tag: 'h1' | 'h2'): HTMLHeadingElement {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

function button(label: string, className: string, onClick: () => void, primary = false): HTMLButtonElement {
  const node = element('button', `${className}${primary ? ' gon-primary' : ''}`);
  node.type = 'button';
  node.textContent = label;
  node.addEventListener('click', onClick);
  return node;
}

function metric(label: string, value: string): HTMLDivElement {
  const node = element('div', 'gon-metric');
  node.append(text(label, 'gon-metric-label'), text(value, 'gon-metric-value'));
  return node;
}

function notice(value: string): HTMLDivElement {
  return text(value, 'gon-notice');
}

function numberInput(id: string, value: number, enabled: boolean, max?: number): HTMLInputElement {
  const input = element('input');
  input.id = id;
  input.type = 'number';
  input.min = '0';
  input.step = '1';
  if (max !== undefined) input.max = String(max);
  input.value = String(value);
  input.disabled = !enabled;
  input.inputMode = 'numeric';
  return input;
}

function commitmentCard(
  label: string,
  input: HTMLInputElement,
  availability: string,
  view: GamesOfNationsUiModel['culture'],
  note: string,
): HTMLDivElement {
  const card = element('div', 'gon-commitment-card');
  const fieldLabel = element('label', 'gon-field-label');
  fieldLabel.htmlFor = input.id;
  fieldLabel.textContent = label;
  const inputWrap = element('div', 'gon-number-wrap');
  inputWrap.append(input, text('/ turn'));
  const status = text(view.status, `gon-commitment-status ${view.affordable ? 'gon-affordable' : 'gon-unavailable'}`);
  card.append(
    fieldLabel,
    inputWrap,
    text(availability, 'gon-availability'),
    text(`Potential: ${view.potentialGamesPoints} GP / turn`, 'gon-availability'),
    status,
    text(note, 'gon-cost-note'),
  );
  return card;
}

function sanitizeDraft(input: HTMLInputElement): void {
  if (input.value === '') return;
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 0) input.value = '0';
  else input.value = String(Math.floor(value));
}

function readWhole(input: HTMLInputElement): number {
  const value = Number(input.value);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0]!.toUpperCase() + value.slice(1) : value;
}
