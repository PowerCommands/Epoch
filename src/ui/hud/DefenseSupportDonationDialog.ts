export interface DefenseSupportDonationDialogState {
  readonly organizationName: string;
  readonly recipientNationName: string;
  readonly aggressorNationName: string;
  /** Gold the player is allowed to contribute to this request. */
  readonly availableGold: number;
  readonly suggestedGold: number;
}

export interface DefenseSupportDonationDialogCallbacks {
  readonly getState: () => DefenseSupportDonationDialogState | null;
  /** Returns true once the canonical Council flow accepted and resolved the choice. */
  readonly onResolve: (gold: number) => boolean;
}

const OVERLAY_ID = 'epoch-defense-support-donation';

/** Parse a donation without allowing partial numbers, decimals, or unsafe values. */
export function parseGoldDonation(raw: string, maxGold: number): number | null {
  const upper = Number.isFinite(maxGold) ? Math.max(0, Math.floor(maxGold)) : 0;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < 0 || value > upper) return null;
  return value;
}

/**
 * Presentation-only Defense Support request. Gameplay resolution remains behind
 * the callback, after this asynchronous DOM interaction has collected a value.
 */
export class DefenseSupportDonationDialog {
  private overlay: HTMLDivElement | null = null;
  private state: DefenseSupportDonationDialogState | null = null;
  private input: HTMLInputElement | null = null;
  private donateButton: HTMLButtonElement | null = null;
  private validationMessage: HTMLDivElement | null = null;

  constructor(private readonly callbacks: DefenseSupportDonationDialogCallbacks) {}

  isShowing(): boolean {
    return this.state !== null && this.overlay !== null;
  }

  show(): void {
    const state = this.callbacks.getState();
    if (!state) return;
    const availableGold = normalizeLimit(state.availableGold);
    this.state = {
      ...state,
      availableGold,
      suggestedGold: Number.isFinite(state.suggestedGold)
        ? Math.max(0, Math.min(availableGold, Math.floor(state.suggestedGold)))
        : 0,
    };
    if (!this.overlay) this.mount();
    this.render();
  }

  hide(): void {
    this.state = null;
    this.input = null;
    this.donateButton = null;
    this.validationMessage = null;
    if (!this.overlay) return;
    document.removeEventListener('keydown', this.handleKeyDown, true);
    document.removeEventListener('keyup', this.consumeKeyboardEvent, true);
    this.overlay.remove();
    this.overlay = null;
  }

  layout(): void {
    /* DOM/CSS layout is responsive. */
  }

  destroy(): void {
    this.hide();
  }

  private mount(): void {
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'dsd-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', `${OVERLAY_ID}-title`);
    overlay.style.cssText = OVERLAY_STYLE;
    for (const eventName of [
      'click', 'dblclick', 'contextmenu', 'pointerdown', 'pointerup',
      'mousedown', 'mouseup', 'touchstart', 'touchend', 'wheel',
    ]) {
      overlay.addEventListener(eventName, (event) => event.stopPropagation());
    }
    document.body.appendChild(overlay);
    this.overlay = overlay;
    document.addEventListener('keydown', this.handleKeyDown, true);
    document.addEventListener('keyup', this.consumeKeyboardEvent, true);
  }

  private render(): void {
    if (!this.overlay || !this.state) return;
    const state = this.state;
    const card = element('section', 'dsd-card');
    card.style.cssText = CARD_STYLE;

    const header = element('header', 'dsd-header');
    const title = element('h1');
    title.id = `${OVERLAY_ID}-title`;
    title.textContent = 'DEFENSE SUPPORT REQUEST';
    header.append(title, text(`${state.organizationName.toUpperCase()} EMERGENCY SESSION`, 'dsd-kicker'));
    card.appendChild(header);

    const body = element('div', 'dsd-body');
    const message = element('p', 'dsd-message');
    message.textContent = `${state.recipientNationName} has requested international assistance after being attacked by ${state.aggressorNationName}.`;
    body.appendChild(message);

    const values = element('div', 'dsd-values');
    const available = element('div', 'dsd-available');
    available.append(
      text('AVAILABLE GOLD', 'dsd-label'),
      text(formatGold(state.availableGold), 'dsd-gold-value'),
    );
    const donation = element('label', 'dsd-donation');
    donation.appendChild(text('DONATION', 'dsd-label'));
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'dsd-input';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = String(state.suggestedGold);
    input.setAttribute('aria-label', `Gold donation, maximum ${state.availableGold}`);
    input.setAttribute('aria-describedby', `${OVERLAY_ID}-validation`);
    donation.appendChild(input);
    values.append(available, donation);
    body.appendChild(values);

    const validation = text('', 'dsd-validation');
    validation.id = `${OVERLAY_ID}-validation`;
    validation.setAttribute('aria-live', 'polite');
    body.appendChild(validation);

    const actions = element('div', 'dsd-actions');
    const decline = button('DECLINE', 'dsd-secondary', () => this.resolve(0));
    const donate = button('DONATE', 'dsd-primary', () => this.submit());
    actions.append(decline, donate);
    body.appendChild(actions);
    card.appendChild(body);

    const style = document.createElement('style');
    style.textContent = DIALOG_STYLES;
    this.overlay.replaceChildren(card, style);
    this.input = input;
    this.donateButton = donate;
    this.validationMessage = validation;
    input.addEventListener('input', () => this.updateValidation());
    this.updateValidation();
    requestAnimationFrame(() => {
      if (this.input === input) {
        input.focus();
        input.select();
      }
    });
  }

  private updateValidation(): void {
    if (!this.state || !this.input || !this.donateButton || !this.validationMessage) return;
    const parsed = parseGoldDonation(this.input.value, this.state.availableGold);
    const valid = parsed !== null;
    this.donateButton.disabled = !valid;
    this.input.setAttribute('aria-invalid', String(!valid));
    this.validationMessage.textContent = valid
      ? `You will donate ${formatGold(parsed)} Gold.`
      : `Enter a whole number from 0 to ${formatGold(this.state.availableGold)}.`;
    this.validationMessage.classList.toggle('dsd-invalid', !valid);
  }

  private submit(): void {
    if (!this.state || !this.input) return;
    const amount = parseGoldDonation(this.input.value, this.state.availableGold);
    if (amount === null) {
      this.updateValidation();
      return;
    }
    this.resolve(amount);
  }

  private resolve(amount: number): void {
    if (this.callbacks.onResolve(amount)) this.hide();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.isShowing()) return;
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.resolve(0);
    } else if (event.key === 'Enter' && event.target === this.input) {
      event.preventDefault();
      this.submit();
    }
  };

  private readonly consumeKeyboardEvent = (event: KeyboardEvent): void => {
    if (this.isShowing()) event.stopPropagation();
  };
}

function normalizeLimit(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function formatGold(value: number): string {
  return normalizeLimit(value).toLocaleString();
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

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const node = element('button', className);
  node.type = 'button';
  node.textContent = label;
  node.addEventListener('click', onClick);
  return node;
}

const OVERLAY_STYLE = `
  position:fixed;inset:0;z-index:10020;display:flex;align-items:center;justify-content:center;
  box-sizing:border-box;padding:18px;background:rgba(2,10,6,.86);color:#e7f6ec;
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
`;

const CARD_STYLE = `
  width:min(520px,96vw);max-height:92vh;overflow-y:auto;box-sizing:border-box;padding:clamp(22px,4vw,30px);
  border:1px solid #1f7a44;border-radius:14px;background:linear-gradient(180deg,#082714,#041b0d);
  box-shadow:0 30px 90px rgba(0,0,0,.75),inset 0 1px 0 rgba(134,239,172,.08);
`;

const DIALOG_STYLES = `
  .dsd-header{text-align:center;display:grid;gap:7px;border-bottom:1px solid #1a5230;padding-bottom:16px}
  .dsd-card h1{margin:0;color:#f2fff6;font-size:clamp(22px,5vw,29px);letter-spacing:.075em;line-height:1.15}
  .dsd-kicker{color:#86efac;font-size:11px;font-weight:800;letter-spacing:.14em}
  .dsd-body{display:grid;gap:18px;margin-top:20px}
  .dsd-message{margin:0;color:#dcede2;font-size:16px;line-height:1.55;text-align:center}
  .dsd-values{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .dsd-available,.dsd-donation{box-sizing:border-box;min-width:0;padding:14px;border:1px solid #1f6e40;border-radius:10px;background:rgba(3,20,11,.72);display:grid;gap:7px}
  .dsd-label{color:#9dccb1;font-size:11px;font-weight:800;letter-spacing:.12em}
  .dsd-gold-value{color:#fcd34d;font-size:23px;font-weight:800;font-variant-numeric:tabular-nums}
  .dsd-input{width:100%;height:35px;box-sizing:border-box;padding:5px 9px;border:1px solid #2f7d4f;border-radius:7px;background:#03160b;color:#f2fff6;font:800 19px Inter,ui-sans-serif,system-ui,sans-serif;font-variant-numeric:tabular-nums}
  .dsd-input:focus{outline:2px solid #4ade80;outline-offset:2px;border-color:#4ade80}
  .dsd-input[aria-invalid="true"]{border-color:#f87171}
  .dsd-validation{min-height:18px;color:#9dccb1;font-size:13px;text-align:center}
  .dsd-validation.dsd-invalid{color:#fecaca}
  .dsd-actions{display:flex;gap:12px;justify-content:flex-end;margin-top:1px}
  .dsd-card button{min-width:120px;border:1px solid #2f7d4f;border-radius:8px;padding:11px 20px;color:#eafff1;font:800 14px Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:.055em;cursor:pointer}
  .dsd-card button:hover,.dsd-card button:focus-visible{outline:2px solid #4ade80;outline-offset:2px}
  .dsd-card button.dsd-primary{background:#16a34a;border-color:#4ade80}
  .dsd-card button.dsd-primary:hover{background:#1c9d4c}
  .dsd-card button.dsd-primary:disabled{background:#163821;border-color:#285a3b;color:#6f9d80;cursor:not-allowed;outline:none}
  .dsd-card button.dsd-secondary{background:transparent;border-color:#2a6840;color:#a7d8ba}
  .dsd-card button.dsd-secondary:hover{background:#0d3b21}
  @media(max-width:480px){.dsd-values{grid-template-columns:1fr}.dsd-actions{justify-content:stretch}.dsd-card button{flex:1;min-width:0}}
`;
