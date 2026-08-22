import { CULTURE_TREE } from '../data/cultureTree';
import { COVERT_PERSONALITIES } from '../data/covertPersonalities';
import { getBuiltInLeaderByNationId } from '../data/leaders';
import { ALL_TECHNOLOGIES, type Era } from '../data/technologies';
import type { ScenarioNationCustomization } from '../types/gameConfig';
import type { ScenarioNation, ScenarioNationDetails } from '../types/scenario';

interface NationDetailsDialogOptions {
  nation: ScenarioNation;
  identityNationId: string;
  details?: ScenarioNationDetails;
  customization?: ScenarioNationCustomization;
  onSave: (customization: ScenarioNationCustomization) => void;
}

type ProgressionEntry = { id: string; name: string; era: Era };

/** Single-nation Game Setup variant of Map Editor's Nation Details dialog. */
export class NationDetailsDialog {
  static show(options: NationDetailsDialogOptions): void {
    const builtInLeader = getBuiltInLeaderByNationId(options.identityNationId);
    const draft: ScenarioNationCustomization = options.customization
      ? structuredClone(options.customization)
      : {
          leaderName: options.nation.leaderName?.trim() || null,
          leaderDescription: options.nation.leaderDescription?.trim() || null,
          gold: Math.max(0, Math.floor(options.nation.gold ?? 0)),
          covertPersonalityId: options.nation.covertPersonalityId ?? null,
          researchedTechIds: unique([
            ...(options.details?.researchedTechIds ?? []),
            ...(options.nation.researchedTechIds ?? []),
          ]),
          unlockedCultureNodeIds: unique([
            ...(options.details?.unlockedCultureNodeIds ?? []),
            ...(options.nation.unlockedCultureNodeIds ?? []),
          ]),
        };

    const overlay = el('div', 'mm-nation-details-backdrop');
    const dialog = el('div', 'mm-nation-details-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'mm-nation-details-title');

    const header = el('div', 'mm-nd-header');
    const title = el('h2', '', `Nation Details — ${options.nation.name}`);
    title.id = 'mm-nation-details-title';
    const actions = el('div', 'mm-nd-header-actions');
    const cancel = button('Cancel', () => overlay.remove());
    const done = button('Done', () => {
      options.onSave(structuredClone(draft));
      overlay.remove();
    });
    done.classList.add('primary');
    actions.append(cancel, done);
    header.append(title, actions);

    const content = el('div', 'mm-nd-content');
    content.append(
      this.buildLeaderSection(draft, builtInLeader?.name),
      this.buildProgressionSection('Technologies', ALL_TECHNOLOGIES, draft.researchedTechIds),
      this.buildProgressionSection('Culture Unlocks', CULTURE_TREE, draft.unlockedCultureNodeIds),
    );
    dialog.append(header, content);
    overlay.appendChild(dialog);
    overlay.addEventListener('mousedown', (event) => {
      if (event.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  private static buildLeaderSection(draft: ScenarioNationCustomization, builtInName?: string): HTMLElement {
    const section = sectionElement('Leader');
    const body = section.querySelector('.mm-nd-section-body')!;

    const name = inputField('Leader name', 'text');
    name.input.maxLength = 120;
    name.input.value = draft.leaderName ?? '';
    name.input.placeholder = builtInName ? `${builtInName} (built-in)` : 'Built-in leader name';
    name.input.addEventListener('input', () => { draft.leaderName = name.input.value.trim() || null; });

    const descriptionLabel = el('label', 'mm-nd-field', 'Description');
    const description = document.createElement('textarea');
    description.maxLength = 600;
    description.value = draft.leaderDescription ?? '';
    description.placeholder = 'Leave empty to use the built-in description.';
    description.addEventListener('input', () => { draft.leaderDescription = description.value.trim() || null; });
    descriptionLabel.appendChild(description);

    const gold = inputField('Starting gold', 'number');
    gold.input.min = '0';
    gold.input.step = '1';
    gold.input.value = String(draft.gold);
    gold.input.addEventListener('input', () => {
      const value = Number.parseInt(gold.input.value, 10);
      draft.gold = Number.isFinite(value) ? Math.max(0, value) : 0;
    });

    const personalityLabel = el('label', 'mm-nd-field', 'Covert personality');
    const personality = document.createElement('select');
    personality.appendChild(option('', 'Default (leader)'));
    for (const preset of COVERT_PERSONALITIES) personality.appendChild(option(preset.id, preset.name));
    personality.value = draft.covertPersonalityId ?? '';
    personality.addEventListener('change', () => {
      draft.covertPersonalityId = personality.value
        ? COVERT_PERSONALITIES.find((preset) => preset.id === personality.value)?.id ?? null
        : null;
    });
    personalityLabel.appendChild(personality);

    body.append(name.label, descriptionLabel, gold.label, personalityLabel);
    return section;
  }

  private static buildProgressionSection(title: string, entries: readonly ProgressionEntry[], selected: string[]): HTMLElement {
    const section = sectionElement(title);
    const body = section.querySelector('.mm-nd-section-body')!;
    const toolbar = el('div', 'mm-nd-toolbar');
    const count = el('span', 'mm-nd-count');
    const updateCount = () => { count.textContent = `${selected.length} selected`; };
    const clear = button('Clear all', () => {
      selected.splice(0);
      for (const checkbox of section.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) checkbox.checked = false;
      updateCount();
    });
    toolbar.append(clear, count);
    body.appendChild(toolbar);
    updateCount();

    const eras = new Map<Era, ProgressionEntry[]>();
    for (const entry of entries) {
      const group = eras.get(entry.era) ?? [];
      group.push(entry);
      eras.set(entry.era, group);
    }
    for (const [era, group] of eras) {
      const eraElement = document.createElement('details');
      eraElement.className = 'mm-nd-era';
      eraElement.open = true;
      eraElement.appendChild(el('summary', 'mm-nd-era-title', formatEra(era)));
      const grid = el('div', 'mm-nd-grid');
      for (const entry of group) {
        const label = el('label', 'mm-nd-check');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selected.includes(entry.id);
        checkbox.addEventListener('change', () => {
          const index = selected.indexOf(entry.id);
          if (checkbox.checked && index < 0) selected.push(entry.id);
          if (!checkbox.checked && index >= 0) selected.splice(index, 1);
          updateCount();
        });
        label.append(checkbox, document.createTextNode(entry.name));
        grid.appendChild(label);
      }
      eraElement.appendChild(grid);
      body.appendChild(eraElement);
    }
    return section;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text: string, onClick: () => void): HTMLButtonElement {
  const node = el('button', '', text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

function inputField(labelText: string, type: string): { label: HTMLLabelElement; input: HTMLInputElement } {
  const label = el('label', 'mm-nd-field', labelText);
  const input = document.createElement('input');
  input.type = type;
  label.appendChild(input);
  return { label, input };
}

function sectionElement(title: string): HTMLElement {
  const section = el('section', 'mm-nd-section');
  section.append(el('h3', '', title), el('div', 'mm-nd-section-body'));
  return section;
}

function option(value: string, text: string): HTMLOptionElement {
  const node = document.createElement('option');
  node.value = value;
  node.textContent = text;
  return node;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function formatEra(era: string): string {
  return `${era.charAt(0).toUpperCase()}${era.slice(1)}`;
}
