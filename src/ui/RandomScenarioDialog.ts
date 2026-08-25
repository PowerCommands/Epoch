import { RANDOM_MAP_SIZES, type RandomMapSize, type RandomMapType } from '../systems/procedural/RandomScenarioTypes';

export interface RandomScenarioDialogCallbacks {
  onGenerate: (mapType: RandomMapType, mapSize: RandomMapSize, seed: number) => { ok: true } | { ok: false; error: string };
}

/** Focused Game Setup dialog for the three v1 procedural map profiles. */
export class RandomScenarioDialog {
  private overlay: HTMLDivElement | null = null;
  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.overlay) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.close();
  };

  constructor(private readonly callbacks: RandomScenarioDialogCallbacks) {}

  show(mapType: RandomMapType): void {
    this.close();
    const overlay = document.createElement('div');
    overlay.className = 'random-scenario-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', `Generate ${profileName(mapType)} Random Scenario`);
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10020;display:flex;align-items:center;justify-content:center;background:rgba(15,10,6,.72);font-family:Georgia,"Times New Roman",serif;color:#2a1c10;';

    const card = document.createElement('div');
    card.style.cssText = 'width:min(430px,calc(100vw - 32px));padding:24px;border:1px solid #8e673f;border-radius:12px;background:#f6eddc;box-shadow:0 20px 70px rgba(0,0,0,.48);';
    const title = document.createElement('h2');
    title.textContent = `Random Scenario — ${profileName(mapType)}`;
    title.style.cssText = 'margin:0 0 18px;font-size:24px;';

    const sizeLabel = fieldLabel('Map Size');
    const sizeSelect = document.createElement('select');
    sizeSelect.id = 'random-scenario-size';
    sizeLabel.htmlFor = sizeSelect.id;
    sizeSelect.style.cssText = fieldStyle();
    for (const size of ['small', 'medium', 'large'] as const) {
      const dimensions = RANDOM_MAP_SIZES[size];
      const option = document.createElement('option');
      option.value = size;
      option.textContent = `${capitalize(size)} — ${dimensions.width} × ${dimensions.height}`;
      option.selected = size === 'medium';
      sizeSelect.appendChild(option);
    }

    const seedLabel = fieldLabel('Seed');
    const seedRow = document.createElement('div');
    seedRow.style.cssText = 'display:grid;grid-template-columns:1fr auto;gap:9px;';
    const seedInput = document.createElement('input');
    seedInput.id = 'random-scenario-seed';
    seedLabel.htmlFor = seedInput.id;
    seedInput.type = 'number';
    seedInput.step = '1';
    seedInput.value = String(randomSeed());
    seedInput.style.cssText = fieldStyle();
    const randomize = actionButton('Randomize');
    randomize.id = 'random-scenario-randomize';
    randomize.addEventListener('click', () => { seedInput.value = String(randomSeed()); });
    seedRow.append(seedInput, randomize);

    const error = document.createElement('p');
    error.id = 'random-scenario-error';
    error.setAttribute('aria-live', 'polite');
    error.style.cssText = 'min-height:18px;margin:12px 0 0;color:#9b2c20;font-size:13px;';

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;margin-top:16px;';
    const cancel = actionButton('Cancel');
    cancel.id = 'random-scenario-cancel';
    const generate = actionButton('Generate', true);
    generate.id = 'random-scenario-generate';
    cancel.addEventListener('click', () => this.close());
    generate.addEventListener('click', () => {
      const seed = Number(seedInput.value);
      if (!Number.isSafeInteger(seed)) {
        error.textContent = 'Enter a whole numeric seed.';
        seedInput.focus();
        return;
      }
      generate.disabled = true;
      error.textContent = 'Generating world…';
      const result = this.callbacks.onGenerate(mapType, sizeSelect.value as RandomMapSize, seed);
      if (result.ok) {
        this.close();
        return;
      }
      generate.disabled = false;
      error.textContent = result.error;
    });
    actions.append(cancel, generate);
    card.append(title, sizeLabel, sizeSelect, seedLabel, seedRow, error, actions);
    overlay.appendChild(card);
    overlay.addEventListener('mousedown', (event) => { if (event.target === overlay) this.close(); });
    document.body.appendChild(overlay);
    this.overlay = overlay;
    document.addEventListener('keydown', this.handleKeyDown, true);
    seedInput.focus();
    seedInput.select();
  }

  close(): void {
    document.removeEventListener('keydown', this.handleKeyDown, true);
    this.overlay?.remove();
    this.overlay = null;
  }

  shutdown(): void {
    this.close();
  }
}

function randomSeed(): number {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0]! & 0x7fffffff;
}

function profileName(type: RandomMapType): string {
  return type === 'continents' ? 'Continents' : type === 'archipelago' ? 'Archipelago' : 'Heartland';
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function fieldLabel(text: string): HTMLLabelElement {
  const label = document.createElement('label');
  label.textContent = text;
  label.style.cssText = 'display:block;margin:14px 0 7px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#65482e;';
  return label;
}

function fieldStyle(): string {
  return 'box-sizing:border-box;width:100%;padding:10px 11px;border:1px solid #a88765;border-radius:7px;background:#fffaf0;color:#271a10;font:16px Georgia,"Times New Roman",serif;';
}

function actionButton(label: string, primary = false): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.style.cssText = `padding:10px 15px;border:1px solid ${primary ? '#995516' : '#8e673f'};border-radius:7px;background:${primary ? '#a75d17' : '#fffaf0'};color:${primary ? '#fff' : '#2a1c10'};font:700 14px Georgia,"Times New Roman",serif;cursor:pointer;`;
  return button;
}
