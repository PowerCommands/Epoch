import { GAMES_OF_NATIONS_SPORTS } from '../systems/GamesOfNationsSystem';
import type { GamesOfNationsSportValues } from '../types/gamesOfNations';
import type { GamesOfNationsUiModel } from './hud/GamesOfNationsUiModel';
import { validateGamesAllocation } from './hud/GamesOfNationsUiModel';

const OVERLAY_ID = 'epoch-games-of-nations-dialog';

export interface GamesOfNationsDialogCallbacks {
  getModel: () => GamesOfNationsUiModel;
  onParticipationDecision: (participating: boolean) => boolean;
  onApply: (culture: number, baseProduction: number, allocation: GamesOfNationsSportValues) => boolean;
}

/** Accessible HTML presentation for the one-time prompt and reusable Games panel. */
export class GamesOfNationsDialog {
  private mode: 'prompt' | 'panel' | null = null;

  constructor(private readonly callbacks: GamesOfNationsDialogCallbacks) {}

  isOpen(): boolean {
    return document.getElementById(OVERLAY_ID) !== null;
  }

  isPromptOpen(): boolean {
    return this.mode === 'prompt' && this.isOpen();
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
      button('Participate', 'gon-participate', () => {
        if (!this.callbacks.onParticipationDecision(true)) return;
        this.showPanel();
      }, true),
      button('Do not participate', 'gon-decline', () => {
        if (!this.callbacks.onParticipationDecision(false)) return;
        this.close();
      }),
    );
    card.appendChild(actions);
    this.mount(overlay, '.gon-participate');
  }

  showPanel(): void {
    this.mode = 'panel';
    const model = this.callbacks.getModel();
    const { overlay, card } = this.createShell('Games of Nations configuration');
    overlay.dataset.mode = 'panel';
    card.classList.add('gon-panel-card');

    const header = element('header', 'gon-panel-header');
    const titleGroup = element('div');
    titleGroup.append(heading('Games of Nations', 'h1'), text(`Games #${model.gamesNumber} · ${model.phaseLabel}`, 'gon-subtitle'));
    header.append(titleGroup, button('Close', 'gon-close', () => this.close()));
    card.append(header, this.buildStatus(model));

    if (model.phase === 'waitingForFirstGames') {
      card.appendChild(notice(
        `Founded by ${model.founderNationName ?? 'an unknown nation'}. Preparation begins in ${model.turnsUntilPreparation ?? 0} turns. The first Games start on turn ${model.firstGamesTurn ?? 'unknown'} (${model.turnsUntilCompetition ?? 0} turns away). Investment controls unlock during Preparation.`,
      ));
    } else if (model.phase === 'cooldown') {
      card.appendChild(notice(`Games #${model.gamesNumber} is completed. The next Preparation begins in ${model.turnsUntilPreparation ?? 0} turns.`));
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
      metric('Participating', model.phase === 'waitingForFirstGames' ? 'Decision at Preparation' : model.participating ? 'Yes' : 'No'),
    );
    if (model.preparationProgress) section.appendChild(metric('Preparation', model.preparationProgress));
    if (model.competitionProgress) section.appendChild(metric('Competition progress', model.competitionProgress));
    if (model.cooldownProgress) section.appendChild(metric('Cooldown progress', model.cooldownProgress));
    if (model.phase === 'preparation') section.appendChild(metric('Competition begins in', `${model.turnsUntilCompetition ?? 0} turns`));
    if (model.phase === 'competition') section.appendChild(metric('Current sport', model.activeSport ?? '—'));
    if (model.phase === 'cooldown') section.appendChild(metric('Next Preparation', `${model.turnsUntilPreparation ?? 0} turns`));
    return section;
  }

  private buildInvestment(model: GamesOfNationsUiModel): HTMLElement {
    const participant = model.participant;
    const editable = model.controlsEditable;
    const section = element('section', 'gon-investment');
    const headingRow = element('div', 'gon-section-heading');
    headingRow.append(heading('Preparation investment', 'h2'), text(editable ? 'Changes affect future Preparation turns only.' : 'Read-only outside active participation in Preparation.', 'gon-muted'));
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

    section.append(heading('Points by sport and future allocation', 'h2'));
    const allocationTable = element('div', 'gon-sports');
    allocationTable.setAttribute('role', 'group');
    allocationTable.setAttribute('aria-label', 'Future Games Point allocation');
    const allocationInputs = new Map<string, HTMLInputElement>();
    for (const sport of GAMES_OF_NATIONS_SPORTS) {
      const row = element('label', 'gon-sport-row');
      const input = numberInput(`gon-allocation-${slug(sport)}`, participant?.sportAllocation[sport] ?? 20, editable, 100);
      allocationInputs.set(sport, input);
      row.htmlFor = input.id;
      row.append(
        text(sport, 'gon-sport-name'),
        text(`Accumulated: ${participant?.gamesPointsBySport[sport] ?? 0} GP`, 'gon-locked'),
        input,
        text('% future', 'gon-percent-label'),
      );
      allocationTable.appendChild(row);
    }
    section.appendChild(allocationTable);

    const validation = text('', 'gon-validation');
    validation.id = 'gon-allocation-validation';
    validation.setAttribute('aria-live', 'polite');
    const apply = button('Apply future strategy', 'gon-apply', () => {
      const allocation = readAllocation(allocationInputs);
      const error = validateGamesAllocation(allocation);
      if (error) {
        validation.textContent = error;
        apply.disabled = true;
        return;
      }
      const culture = readWhole(cultureInput);
      const production = readWhole(productionInput);
      if (!this.callbacks.onApply(culture, production, allocation)) {
        validation.textContent = 'The strategy could not be applied.';
        return;
      }
      this.showPanel();
    }, true);
    apply.disabled = !editable;
    const updateValidation = (): void => {
      const error = validateGamesAllocation(readAllocation(allocationInputs));
      validation.textContent = error ?? 'Allocation total: 100%';
      validation.classList.toggle('gon-valid', error === null);
      apply.disabled = !editable || error !== null;
    };
    for (const input of allocationInputs.values()) input.addEventListener('input', updateValidation);
    cultureInput.addEventListener('input', () => sanitizeDraft(cultureInput));
    productionInput.addEventListener('input', () => sanitizeDraft(productionInput));
    updateValidation();
    const footer = element('div', 'gon-panel-footer');
    footer.append(validation, apply);
    section.appendChild(footer);

    section.appendChild(notice('Each Culture or base Production point invested generates 10 Games Points. Commitments are attempted independently and all-or-nothing each Preparation turn. Already invested resources and Games Points cannot be recovered or moved between sports.'));
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
  width:min(920px,96vw);max-height:94vh;overflow:auto;box-sizing:border-box;padding:clamp(20px,3vw,32px);
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
    .gon-panel-header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.gon-subtitle,.gon-muted{color:#9fb5d1;font-size:14px}.gon-status-grid,.gon-points-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:18px 0}
    .gon-metric{padding:11px 13px;border:1px solid #24466f;border-radius:7px;background:rgba(3,13,29,.48)}.gon-metric-label{display:block;color:#8eabc9;font-size:12px;text-transform:uppercase;letter-spacing:.06em}.gon-metric-value{display:block;margin-top:4px;font-weight:700;color:#f1f6ff}
    .gon-notice{margin:16px 0;padding:11px 13px;border-left:3px solid #60a5fa;background:rgba(30,64,175,.15);line-height:1.45;color:#d8e8fb}.gon-section-heading{display:flex;justify-content:space-between;gap:16px;align-items:baseline;flex-wrap:wrap}
    .gon-commitment-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.gon-commitment-card{padding:14px;border:1px solid #294d78;border-radius:8px;background:rgba(3,14,31,.55)}.gon-field-label{display:block;font-weight:700;color:#dbeafe;margin-bottom:8px}.gon-number-wrap{display:flex;align-items:center;gap:8px}.gon-card input[type=number]{width:92px;box-sizing:border-box;padding:8px;border:1px solid #537aa5;border-radius:4px;background:#071525;color:#fff;font:700 16px inherit}.gon-card input:disabled{opacity:.55}.gon-availability,.gon-cost-note,.gon-commitment-status{display:block;margin-top:8px;font-size:13px;color:#a9bfd7}.gon-commitment-status{font-weight:700}.gon-unavailable{color:#fca5a5}.gon-affordable{color:#86efac}
    .gon-sports{display:grid;gap:7px}.gon-sport-row{display:grid;grid-template-columns:minmax(130px,1fr) minmax(150px,1fr) 82px 62px;gap:10px;align-items:center;padding:8px 10px;border:1px solid #203e62;border-radius:6px;background:rgba(2,10,22,.38)}.gon-sport-name{font-weight:700}.gon-locked{color:#a8bfd9;font-size:13px}.gon-percent-label{color:#9fb5d1;font-size:13px}.gon-validation{margin-right:auto;color:#fca5a5}.gon-validation.gon-valid{color:#86efac}
    .gon-medal-table{display:grid;border:1px solid #294d78;border-radius:8px;overflow:hidden;margin:10px 0 16px}.gon-medal-row{display:grid;grid-template-columns:minmax(180px,1fr) repeat(3,80px);gap:8px;padding:9px 12px;border-top:1px solid #1d3859;text-align:center}.gon-medal-row:first-child{border-top:0}.gon-medal-header{background:#102d52;color:#bfdbfe;font-size:12px;font-weight:800;text-transform:uppercase}.gon-medal-nation{text-align:left;font-weight:700}.gon-empty-result{padding:12px;color:#9fb5d1}.gon-result-sports{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:9px}.gon-result-sport{padding:11px;border:1px solid #294d78;border-radius:7px;background:rgba(3,14,31,.55);display:grid;gap:4px;font-size:13px}.gon-result-sport-name{font-weight:800;color:#dbeafe}.gon-result-status{color:#93c5fd;text-transform:uppercase;font-size:11px;letter-spacing:.06em}.gon-result-upcoming{opacity:.66}.gon-result-current{border-color:#60a5fa}.gon-result-gold{color:#fde68a;font-weight:700}
    @media(max-width:680px){.gon-commitment-grid{grid-template-columns:1fr}.gon-sport-row{grid-template-columns:1fr 1fr}.gon-percent-label{display:none}.gon-card{padding:18px}.gon-panel-header{position:sticky;top:0;background:#071a35;padding-bottom:10px;z-index:1}}
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

function readAllocation(inputs: Map<string, HTMLInputElement>): GamesOfNationsSportValues {
  return Object.fromEntries(GAMES_OF_NATIONS_SPORTS.map((sport) => [sport, Number(inputs.get(sport)!.value)])) as GamesOfNationsSportValues;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '-');
}
