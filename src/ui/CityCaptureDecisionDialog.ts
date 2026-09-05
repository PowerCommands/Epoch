import type { CityCaptureOutcome } from '../systems/CityCaptureDecision';

export interface CityCaptureDecisionOptions {
  cityName: string;
  /** Outcomes to offer, in display order (always includes 'keep' and 'raze'). */
  outcomes: CityCaptureOutcome[];
  /** Founder nation name, shown on the Liberate button when liberation is offered. */
  originNationName?: string;
  /** Resolves exactly once with the chosen outcome. */
  onResolve: (outcome: CityCaptureOutcome) => void;
}

/**
 * Modal decision presented to the human player immediately after they capture a
 * city: Keep, Liberate, or Raze. Styled to match {@link ConfirmDialog} / the
 * Epoch HTML overlay dialogs.
 *
 * It is deliberately unclosable by any means other than choosing an outcome —
 * Escape, backdrop clicks and every other key are swallowed so the capture can
 * never be silently resolved or left in an unresolved state. The instance is
 * reusable: each {@link show} rebuilds the buttons and rebinds the callback.
 */
export class CityCaptureDecisionDialog {
  private readonly overlay: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly cityNameEl: HTMLDivElement;
  private readonly bodyEl: HTMLDivElement;
  private readonly buttonRow: HTMLDivElement;
  private open = false;
  private options: CityCaptureDecisionOptions | null = null;

  constructor() {
    this.overlay = this.buildOverlay();
    this.titleEl = this.overlay.querySelector<HTMLDivElement>('.capture-dialog-title')!;
    this.cityNameEl = this.overlay.querySelector<HTMLDivElement>('.capture-dialog-city')!;
    this.bodyEl = this.overlay.querySelector<HTMLDivElement>('.capture-dialog-body')!;
    this.buttonRow = this.overlay.querySelector<HTMLDivElement>('.capture-dialog-buttons')!;
    document.body.appendChild(this.overlay);
  }

  isOpen(): boolean {
    return this.open;
  }

  show(options: CityCaptureDecisionOptions): void {
    this.options = options;
    this.titleEl.textContent = 'City Captured';
    this.cityNameEl.textContent = options.cityName;
    this.bodyEl.textContent = 'Decide the fate of the captured city.';

    this.buttonRow.replaceChildren(
      ...options.outcomes.map((outcome) => this.makeButton(outcome, options.originNationName)),
    );

    this.overlay.style.display = 'flex';
    this.open = true;
    requestAnimationFrame(() => {
      this.buttonRow.querySelector<HTMLButtonElement>('button')?.focus();
    });
  }

  shutdown(): void {
    this.overlay.remove();
  }

  private resolve(outcome: CityCaptureOutcome): void {
    if (!this.open) return;
    const options = this.options;
    this.overlay.style.display = 'none';
    this.open = false;
    this.options = null;
    options?.onResolve(outcome);
  }

  private makeButton(outcome: CityCaptureOutcome, originNationName?: string): HTMLButtonElement {
    const config: Record<CityCaptureOutcome, { label: string; accent: string }> = {
      keep: { label: 'Keep City', accent: '#4a90d9' },
      liberate: {
        label: originNationName ? `Liberate City (${originNationName})` : 'Liberate City',
        accent: '#3fae6b',
      },
      raze: { label: 'Raze City', accent: '#c0392b' },
    };
    const { label, accent } = config[outcome];

    const btn = document.createElement('button');
    btn.className = `capture-dialog-button capture-dialog-${outcome}`;
    btn.textContent = label;
    btn.style.cssText = `
      padding: 12px 22px; font-size: 15px; cursor: pointer; min-width: 160px;
      border: 1px solid ${accent}; border-radius: 4px;
      background: transparent; color: #eee; font-family: inherit;
    `;
    btn.addEventListener('click', () => this.resolve(outcome));
    return btn;
  }

  private buildOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = 'city-capture-decision-dialog';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 10003;
      display: none; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.7);
      font-family: sans-serif; color: #eee;
    `;
    // Swallow every interaction on the shield: no click-through, and no key
    // (Escape included) may resolve or dismiss the decision.
    const swallow = (e: Event) => e.stopPropagation();
    overlay.addEventListener('click', swallow);
    overlay.addEventListener('mousedown', swallow);
    overlay.addEventListener('mouseup', swallow);
    overlay.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') e.preventDefault();
    });

    const box = document.createElement('div');
    box.style.cssText = `
      background: #1a1a2e; border: 2px solid #888; border-radius: 8px;
      padding: 28px 32px; max-width: 520px; text-align: center;
    `;

    const title = document.createElement('div');
    title.className = 'capture-dialog-title';
    title.style.cssText =
      'font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #aaa; margin-bottom: 14px;';
    box.appendChild(title);

    const cityName = document.createElement('div');
    cityName.className = 'capture-dialog-city';
    cityName.style.cssText = 'font-size: 26px; font-weight: 700; color: #fff; margin-bottom: 12px;';
    box.appendChild(cityName);

    const body = document.createElement('div');
    body.className = 'capture-dialog-body';
    body.style.cssText = 'font-size: 14px; color: #ccc; margin-bottom: 22px;';
    box.appendChild(body);

    const buttonRow = document.createElement('div');
    buttonRow.className = 'capture-dialog-buttons';
    buttonRow.style.cssText = 'display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;';
    box.appendChild(buttonRow);

    overlay.appendChild(box);
    return overlay;
  }
}
