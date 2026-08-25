import type { NationDefinition } from '../data/nations';
import {
  DEFAULT_RANDOM_TERRAIN_WEIGHTS,
  DEFAULT_RANDOM_BARBARIAN_CAMP_COUNT,
  DEFAULT_RANDOM_STARTING_SCOUT,
  DEFAULT_RANDOM_STARTING_WARRIOR,
  identifyRandomMapSize,
  RANDOM_LAND_TERRAIN_TYPES,
  RANDOM_MAP_PROFILE_DEFINITIONS,
  RANDOM_MAP_SIZES,
  validateRandomBarbarianCampCount,
  validateRandomFeatureCount,
  validateRandomMapDimensions,
  type RandomLandTerrainType,
  type RandomMapType,
  type RandomScenarioConfig,
} from '../systems/procedural/RandomScenarioTypes';

export type RandomScenarioDialogConfig = Pick<
  RandomScenarioConfig,
  'mapType' | 'mapSize' | 'width' | 'height' | 'seed' | 'terrainWeights' | 'featureCount'
  | 'barbarianCampCount' | 'addStartingScout' | 'addStartingWarrior'
> & { nationIds: string[] };

export interface RandomScenarioDialogCallbacks {
  onGenerate: (config: RandomScenarioDialogConfig) => { ok: true } | { ok: false; error: string };
  onCancel?: () => void;
}

/** Procedural-only configuration. Ordinary game options remain on Game Setup. */
export class RandomScenarioDialog {
  private overlay: HTMLDivElement | null = null;
  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.overlay) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.cancel();
  };

  constructor(private readonly callbacks: RandomScenarioDialogCallbacks) {}

  show(mapType: RandomMapType, nations: readonly NationDefinition[]): void {
    this.close();
    const profile = RANDOM_MAP_PROFILE_DEFINITIONS[mapType];
    const overlay = document.createElement('div');
    overlay.className = 'random-scenario-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', `Generate ${profile.name} Random Scenario`);
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10020;display:flex;align-items:center;justify-content:center;background:rgba(15,10,6,.72);font-family:Georgia,"Times New Roman",serif;color:#2a1c10;';

    const card = document.createElement('div');
    card.style.cssText = 'box-sizing:border-box;width:min(760px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;padding:24px;border:1px solid #8e673f;border-radius:12px;background:#f6eddc;box-shadow:0 20px 70px rgba(0,0,0,.48);';
    const title = document.createElement('h2');
    title.textContent = `Random Scenario — ${profile.name}`;
    title.style.cssText = 'margin:0 0 18px;font-size:24px;';

    const content = document.createElement('div');
    content.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;';
    const left = document.createElement('section');
    const right = document.createElement('section');

    left.appendChild(sectionHeading('Map Size'));
    const sizeSelect = document.createElement('select');
    sizeSelect.id = 'random-scenario-size';
    sizeSelect.style.cssText = fieldStyle();
    for (const size of ['small', 'medium', 'large'] as const) {
      const dimensions = RANDOM_MAP_SIZES[size];
      const option = document.createElement('option');
      option.value = size;
      option.textContent = `${capitalize(size)} — ${dimensions.width} × ${dimensions.height}`;
      option.selected = size === 'medium';
      sizeSelect.appendChild(option);
    }
    sizeSelect.appendChild(new Option('Custom', 'custom'));
    const dimensionRow = document.createElement('div');
    dimensionRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:9px;';
    const widthInput = numericField('random-scenario-width', 'Width', RANDOM_MAP_SIZES.medium.width);
    const heightInput = numericField('random-scenario-height', 'Height', RANDOM_MAP_SIZES.medium.height);
    dimensionRow.append(widthInput.wrapper, heightInput.wrapper);
    sizeSelect.addEventListener('change', () => {
      if (sizeSelect.value === 'custom') return;
      const dimensions = RANDOM_MAP_SIZES[sizeSelect.value as keyof typeof RANDOM_MAP_SIZES];
      widthInput.input.value = String(dimensions.width);
      heightInput.input.value = String(dimensions.height);
    });
    const markCustom = (): void => {
      sizeSelect.value = identifyRandomMapSize(Number(widthInput.input.value), Number(heightInput.input.value));
    };
    widthInput.input.addEventListener('input', markCustom);
    heightInput.input.addEventListener('input', markCustom);
    left.append(sizeSelect, dimensionRow);

    left.appendChild(sectionHeading('Seed'));
    const seedRow = document.createElement('div');
    seedRow.style.cssText = 'display:grid;grid-template-columns:1fr auto;gap:9px;';
    const seedInput = document.createElement('input');
    seedInput.id = 'random-scenario-seed';
    seedInput.type = 'number';
    seedInput.step = '1';
    seedInput.value = String(randomSeed());
    seedInput.style.cssText = fieldStyle();
    const randomize = actionButton('Randomize');
    randomize.id = 'random-scenario-randomize';
    randomize.addEventListener('click', () => { seedInput.value = String(randomSeed()); });
    seedRow.append(seedInput, randomize);
    left.appendChild(seedRow);

    left.appendChild(sectionHeading('Geography'));
    const feature = numericField('random-scenario-feature-count', profile.featureLabel, profile.defaultFeatureCount);
    left.appendChild(feature.wrapper);

    left.appendChild(sectionHeading('Land Terrain'));
    const terrainInputs = new Map<RandomLandTerrainType, HTMLInputElement>();
    const terrainGrid = document.createElement('div');
    terrainGrid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 10px;';
    for (const type of RANDOM_LAND_TERRAIN_TYPES) {
      const field = numericField(`random-scenario-terrain-${type}`, capitalize(type), DEFAULT_RANDOM_TERRAIN_WEIGHTS[type]);
      field.input.min = '0';
      field.input.step = '1';
      terrainInputs.set(type, field.input);
      terrainGrid.appendChild(field.wrapper);
    }
    const weightHint = document.createElement('p');
    weightHint.textContent = 'Weights are relative and normalized automatically.';
    weightHint.style.cssText = 'margin:7px 0 0;color:#70583e;font-size:12px;';
    left.append(terrainGrid, weightHint);

    right.appendChild(sectionHeading('Starting World'));
    const barbarianCamps = numericField(
      'random-scenario-barbarian-camps',
      'Barbarian Camps',
      DEFAULT_RANDOM_BARBARIAN_CAMP_COUNT,
    );
    barbarianCamps.input.min = '0';
    const startingUnitChoices = document.createElement('div');
    startingUnitChoices.style.cssText = 'display:flex;flex-direction:column;gap:7px;margin-top:12px;';
    const addScout = checkboxField('random-scenario-add-scout', 'Add Scout', DEFAULT_RANDOM_STARTING_SCOUT);
    const addWarrior = checkboxField('random-scenario-add-warrior', 'Add Warrior', DEFAULT_RANDOM_STARTING_WARRIOR);
    startingUnitChoices.append(addScout.wrapper, addWarrior.wrapper);
    right.append(barbarianCamps.wrapper, startingUnitChoices);

    right.appendChild(sectionHeading('Participating Nations'));
    const nationActions = document.createElement('div');
    nationActions.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;';
    const selectAll = actionButton('Select all');
    const clearAll = actionButton('Clear all');
    nationActions.append(selectAll, clearAll);
    const nationList = document.createElement('div');
    nationList.id = 'random-scenario-nations';
    nationList.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 12px;max-height:470px;overflow:auto;padding:10px;border:1px solid #b99a78;border-radius:7px;background:#fffaf0;';
    const nationCheckboxes: HTMLInputElement[] = [];
    nations.forEach((nation, index) => {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:7px;font-size:14px;';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = nation.id;
      checkbox.checked = index < Math.min(8, nations.length);
      nationCheckboxes.push(checkbox);
      label.append(checkbox, document.createTextNode(nation.name));
      nationList.appendChild(label);
    });
    selectAll.addEventListener('click', () => nationCheckboxes.forEach((checkbox) => { checkbox.checked = true; }));
    clearAll.addEventListener('click', () => nationCheckboxes.forEach((checkbox) => { checkbox.checked = false; }));
    right.append(nationActions, nationList);

    const error = document.createElement('p');
    error.id = 'random-scenario-error';
    error.setAttribute('aria-live', 'polite');
    error.style.cssText = 'min-height:18px;margin:12px 0 0;color:#9b2c20;font-size:13px;';
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;margin-top:10px;';
    const cancel = actionButton('Cancel');
    cancel.id = 'random-scenario-cancel';
    const generate = actionButton('Generate', true);
    generate.id = 'random-scenario-generate';
    cancel.addEventListener('click', () => this.cancel());
    generate.addEventListener('click', () => {
      const width = Number(widthInput.input.value);
      const height = Number(heightInput.input.value);
      const seed = Number(seedInput.value);
      const featureCount = Number(feature.input.value);
      const dimensionError = validateRandomMapDimensions(width, height);
      const featureError = validateRandomFeatureCount(mapType, featureCount, width, height);
      const barbarianCampCount = Number(barbarianCamps.input.value);
      const campError = validateRandomBarbarianCampCount(barbarianCampCount, width, height);
      const nationIds = nationCheckboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
      if (dimensionError || featureError || campError || !Number.isSafeInteger(seed) || nationIds.length < 2) {
        error.textContent = dimensionError ?? featureError ?? campError
          ?? (!Number.isSafeInteger(seed) ? 'Enter a whole numeric seed.' : 'Select at least two participating nations.');
        return;
      }
      const terrainWeights = Object.fromEntries(RANDOM_LAND_TERRAIN_TYPES.map((type) => [type, Number(terrainInputs.get(type)!.value)])) as Record<RandomLandTerrainType, number>;
      if (Object.values(terrainWeights).some((weight) => !Number.isFinite(weight) || weight < 0)
        || Object.values(terrainWeights).every((weight) => weight === 0)) {
        error.textContent = 'Terrain weights must be non-negative, with at least one value greater than zero.';
        return;
      }
      generate.disabled = true;
      error.textContent = 'Generating world…';
      const result = this.callbacks.onGenerate({
        mapType,
        mapSize: identifyRandomMapSize(width, height),
        width,
        height,
        seed,
        terrainWeights,
        featureCount,
        barbarianCampCount,
        addStartingScout: addScout.input.checked,
        addStartingWarrior: addWarrior.input.checked,
        nationIds,
      });
      if (result.ok) return this.close();
      generate.disabled = false;
      error.textContent = result.error;
    });

    content.append(left, right);
    actions.append(cancel, generate);
    card.append(title, content, error, actions);
    overlay.appendChild(card);
    overlay.addEventListener('mousedown', (event) => { if (event.target === overlay) this.cancel(); });
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

  shutdown(): void { this.close(); }

  private cancel(): void {
    this.close();
    this.callbacks.onCancel?.();
  }
}

function randomSeed(): number {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0]! & 0x7fffffff;
}

function capitalize(value: string): string { return `${value.charAt(0).toUpperCase()}${value.slice(1)}`; }

function sectionHeading(text: string): HTMLHeadingElement {
  const heading = document.createElement('h3');
  heading.textContent = text;
  heading.style.cssText = 'margin:15px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#65482e;';
  return heading;
}

function numericField(id: string, labelText: string, value: number): { wrapper: HTMLLabelElement; input: HTMLInputElement } {
  const wrapper = document.createElement('label');
  wrapper.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;';
  wrapper.appendChild(document.createTextNode(labelText));
  const input = document.createElement('input');
  input.id = id;
  input.type = 'number';
  input.step = '1';
  input.value = String(value);
  input.style.cssText = `${fieldStyle()}width:84px;`;
  wrapper.appendChild(input);
  return { wrapper, input };
}

function checkboxField(id: string, labelText: string, checked: boolean): { wrapper: HTMLLabelElement; input: HTMLInputElement } {
  const wrapper = document.createElement('label');
  wrapper.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:14px;';
  const input = document.createElement('input');
  input.id = id;
  input.type = 'checkbox';
  input.checked = checked;
  wrapper.append(input, document.createTextNode(labelText));
  return { wrapper, input };
}

function fieldStyle(): string {
  return 'box-sizing:border-box;width:100%;padding:9px 10px;border:1px solid #a88765;border-radius:7px;background:#fffaf0;color:#271a10;font:15px Georgia,"Times New Roman",serif;';
}

function actionButton(label: string, primary = false): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.style.cssText = `padding:9px 14px;border:1px solid ${primary ? '#995516' : '#8e673f'};border-radius:7px;background:${primary ? '#a75d17' : '#fffaf0'};color:${primary ? '#fff' : '#2a1c10'};font:700 13px Georgia,"Times New Roman",serif;cursor:pointer;`;
  return button;
}
