export interface RuntimeScenarioSettings {
  peaceTreatyCooldownTurns: number;
  capitulationAcceptanceThreshold: number;
  tradeRouteEstablishmentTurns: number;
  shortTradeDealDuration: number;
  longTradeDealDuration: number;
  originalCapitalCollapsePercent: number;
  dominationLandPercent: number;
  dominationRequiredVassals: number;
}

interface ScenarioCheatDialogOptions {
  getSettings: () => RuntimeScenarioSettings;
  applySettings: (settings: RuntimeScenarioSettings) => void;
}

export function validateRuntimeScenarioSettings(settings: RuntimeScenarioSettings): string | null {
  const invalidInteger = INTEGER_FIELDS.find((field) => !Number.isInteger(settings[field.key])
    || settings[field.key] < field.min || (field.max !== undefined && settings[field.key] > field.max));
  if (invalidInteger) return `${invalidInteger.label} is outside its valid range.`;
  if (!Number.isFinite(settings.capitulationAcceptanceThreshold)
    || settings.capitulationAcceptanceThreshold < 0.01 || settings.capitulationAcceptanceThreshold > 1) {
    return 'Capitulation Acceptance Threshold must be between 0.01 and 1.00.';
  }
  if (settings.longTradeDealDuration <= settings.shortTradeDealDuration) {
    return 'Long Trade Deal Duration must exceed Short Trade Deal Duration.';
  }
  return null;
}

type SettingKey = keyof RuntimeScenarioSettings;

const INTEGER_FIELDS: Array<{
  key: Exclude<SettingKey, 'capitulationAcceptanceThreshold'>;
  label: string;
  min: number;
  max?: number;
  help: string;
}> = [
  { key: 'peaceTreatyCooldownTurns', label: 'Peace Treaty cooldown (turns)', min: 0, help: 'Applied to peace treaties created after Apply.' },
  { key: 'tradeRouteEstablishmentTurns', label: 'Trade Route Establishment Time (turns)', min: 0, help: 'Applied to newly established routes.' },
  { key: 'shortTradeDealDuration', label: 'Short Trade Deal Duration (turns)', min: 1, help: 'Applied to new trade deals.' },
  { key: 'longTradeDealDuration', label: 'Long Trade Deal Duration (turns)', min: 1, help: 'Must exceed the short duration.' },
  { key: 'originalCapitalCollapsePercent', label: 'Capital capitulation threshold (%)', min: 0, max: 100, help: 'Applied by subsequent combat; 0 disables the rule.' },
  { key: 'dominationLandPercent', label: 'Domination land control (%)', min: 1, max: 100, help: 'Used by subsequent normal victory checks.' },
  { key: 'dominationRequiredVassals', label: 'Domination vassal states', min: 1, help: 'Used by subsequent normal victory checks.' },
];

/** Developer-only editor for the current running game's selected scenario rules. */
export class ScenarioCheatDialog {
  private readonly overlay: HTMLDivElement;
  private readonly inputs = new Map<SettingKey, HTMLInputElement>();
  private readonly thresholdOutput: HTMLOutputElement;
  private readonly error: HTMLDivElement;
  private open = false;

  constructor(private readonly options: ScenarioCheatDialogOptions) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'scenario-cheat-dialog';
    this.overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 10003; display: none; align-items: center;
      justify-content: center; padding: 24px; background: rgba(0,0,0,.72); color: #dedede;
      font: 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; pointer-events: auto;
    `;
    for (const eventName of ['mousedown', 'mouseup', 'click'] as const) {
      this.overlay.addEventListener(eventName, (event) => event.stopPropagation());
    }
    this.overlay.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); this.close(); }
    });

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'scenario-cheat-title');
    dialog.style.cssText = `width:min(680px,calc(100vw - 48px)); max-height:calc(100vh - 48px);
      overflow:auto; border:1px solid #454545; border-radius:5px; background:#181818;
      box-shadow:0 18px 50px rgba(0,0,0,.55);`;
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid #393939;background:#222;';
    const title = document.createElement('div');
    title.id = 'scenario-cheat-title';
    title.textContent = 'RUNTIME SCENARIO';
    title.style.cssText = 'color:#d8edff;font-size:16px;font-weight:700;letter-spacing:.5px;';
    const close = this.button('Cancel', () => this.close());
    close.className = 'scenario-cheat-cancel';
    header.append(title, close);

    const body = document.createElement('div');
    body.style.cssText = 'display:grid;gap:14px;padding:18px;';
    const intro = document.createElement('div');
    intro.textContent = 'Edits affect only this running game. Existing contracts and timers keep their captured durations.';
    intro.style.cssText = 'color:#aaa;line-height:1.45;';
    body.appendChild(intro);

    const threshold = document.createElement('label');
    threshold.style.cssText = 'display:grid;grid-template-columns:minmax(220px,1fr) minmax(180px,2fr) 44px;gap:12px;align-items:center;';
    const thresholdName = document.createElement('span');
    thresholdName.textContent = 'Capitulation Acceptance Threshold';
    const thresholdInput = document.createElement('input');
    thresholdInput.type = 'range'; thresholdInput.min = '0.01'; thresholdInput.max = '1.00'; thresholdInput.step = '0.01';
    thresholdInput.setAttribute('aria-label', 'Capitulation Acceptance Threshold');
    thresholdInput.style.cssText = 'width:100%;accent-color:#1685ed;';
    this.thresholdOutput = document.createElement('output');
    this.thresholdOutput.style.cssText = 'text-align:right;color:#d9edff;font-variant-numeric:tabular-nums;';
    thresholdInput.addEventListener('input', () => { this.thresholdOutput.value = Number(thresholdInput.value).toFixed(2); });
    this.inputs.set('capitulationAcceptanceThreshold', thresholdInput);
    threshold.append(thresholdName, thresholdInput, this.thresholdOutput);
    body.appendChild(threshold);

    for (const field of INTEGER_FIELDS) {
      const label = document.createElement('label');
      label.style.cssText = 'display:grid;grid-template-columns:minmax(220px,1fr) 120px;gap:12px;align-items:center;';
      const text = document.createElement('span');
      text.textContent = field.label;
      text.title = field.help;
      const input = document.createElement('input');
      input.type = 'number'; input.min = String(field.min); input.step = '1';
      if (field.max !== undefined) input.max = String(field.max);
      input.setAttribute('aria-label', field.label);
      input.style.cssText = 'padding:6px 8px;border:1px solid #4b4b4b;border-radius:3px;background:#111;color:#eee;font:inherit;';
      this.inputs.set(field.key, input);
      label.append(text, input);
      body.appendChild(label);
    }

    this.error = document.createElement('div');
    this.error.style.cssText = 'min-height:18px;color:#f0a0a0;';
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;padding-top:4px;';
    actions.append(this.button('Cancel', () => this.close()), this.button('Apply', () => this.apply(), true));
    body.append(this.error, actions);
    dialog.append(header, body);
    this.overlay.appendChild(dialog);
    document.body.appendChild(this.overlay);
  }

  show(): void {
    const settings = this.options.getSettings();
    for (const [key, input] of this.inputs) input.value = String(settings[key]);
    this.thresholdOutput.value = settings.capitulationAcceptanceThreshold.toFixed(2);
    this.error.textContent = '';
    this.overlay.style.display = 'flex';
    this.open = true;
    requestAnimationFrame(() => this.overlay.querySelector<HTMLButtonElement>('.scenario-cheat-cancel')?.focus());
  }

  close(): void { this.overlay.style.display = 'none'; this.open = false; }
  isOpen(): boolean { return this.open; }
  shutdown(): void { this.overlay.remove(); }

  private apply(): void {
    const read = (key: SettingKey): number => Number(this.inputs.get(key)!.value);
    const settings = Object.fromEntries([...this.inputs.keys()].map((key) => [key, read(key)])) as unknown as RuntimeScenarioSettings;
    const error = validateRuntimeScenarioSettings(settings);
    if (error) { this.error.textContent = error; return; }
    this.options.applySettings(settings);
    this.close();
  }

  private button(label: string, action: () => void, primary = false): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = label;
    button.style.cssText = `padding:7px 13px;border:1px solid ${primary ? '#3d8055' : '#555'};border-radius:3px;
      background:${primary ? '#234a30' : '#292929'};color:#eee;font:inherit;cursor:pointer;`;
    button.addEventListener('click', action);
    return button;
  }
}
