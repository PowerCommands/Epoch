import type { Nation } from '../entities/Nation';
import type { DiplomacyManager, DiplomaticMemoryValues } from '../systems/DiplomacyManager';
import type { NationManager } from '../systems/NationManager';

export const RELATION_MEMORY_FIELDS = [
  { key: 'trust', label: 'Trust' },
  { key: 'fear', label: 'Fear' },
  { key: 'hostility', label: 'Hostility' },
  { key: 'suspicion', label: 'Suspicion' },
  { key: 'affinity', label: 'Affinity' },
] as const satisfies readonly { key: keyof DiplomaticMemoryValues; label: string }[];

interface RelationsCheatDialogOptions {
  nationManager: NationManager;
  diplomacyManager: DiplomacyManager;
  humanNationId?: string;
  onRelationChanged?: () => void;
}

/**
 * Developer-only in-game counterpart to the map editor's relationship-memory
 * controls. Diplomatic memory is stored once per canonical nation pair, so a
 * slider edits the mutual relation exactly as the editor does.
 */
export class RelationsCheatDialog {
  private readonly overlay: HTMLDivElement;
  private readonly sourceList: HTMLDivElement;
  private readonly partnerList: HTMLDivElement;
  private readonly relationPanel: HTMLDivElement;
  private selectedNationId: string | null = null;
  private selectedPartnerId: string | null = null;
  private open = false;

  constructor(private readonly options: RelationsCheatDialogOptions) {
    this.overlay = this.buildOverlay();
    this.sourceList = this.overlay.querySelector<HTMLDivElement>('.relations-cheat-source-list')!;
    this.partnerList = this.overlay.querySelector<HTMLDivElement>('.relations-cheat-partner-list')!;
    this.relationPanel = this.overlay.querySelector<HTMLDivElement>('.relations-cheat-panel')!;
    document.body.appendChild(this.overlay);
  }

  show(): void {
    const nations = this.getNations();
    if (nations.length < 2) return;

    if (!this.selectedNationId || !nations.some((nation) => nation.id === this.selectedNationId)) {
      this.selectedNationId = nations.find((nation) => nation.id === this.options.humanNationId)?.id
        ?? nations[0].id;
    }
    this.ensurePartner(nations);
    this.render();
    this.overlay.style.display = 'flex';
    this.open = true;
    requestAnimationFrame(() => {
      this.overlay.querySelector<HTMLButtonElement>('.relations-cheat-done')?.focus();
    });
  }

  close(): void {
    this.overlay.style.display = 'none';
    this.open = false;
  }

  isOpen(): boolean {
    return this.open;
  }

  shutdown(): void {
    this.overlay.remove();
  }

  private getNations(): Nation[] {
    return [...this.options.nationManager.getAllNations()]
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private ensurePartner(nations: readonly Nation[]): void {
    const valid = this.selectedPartnerId
      && this.selectedPartnerId !== this.selectedNationId
      && nations.some((nation) => nation.id === this.selectedPartnerId);
    if (!valid) {
      this.selectedPartnerId = nations.find((nation) => nation.id !== this.selectedNationId)?.id ?? null;
    }
  }

  private render(): void {
    const nations = this.getNations();
    this.ensurePartner(nations);
    this.sourceList.replaceChildren(...nations.map((nation) => this.buildNationButton(nation, 'source')));
    this.partnerList.replaceChildren(
      ...nations
        .filter((nation) => nation.id !== this.selectedNationId)
        .map((nation) => this.buildNationButton(nation, 'partner')),
    );
    this.renderRelationPanel(nations);
  }

  private buildNationButton(nation: Nation, kind: 'source' | 'partner'): HTMLButtonElement {
    const selected = nation.id === (kind === 'source' ? this.selectedNationId : this.selectedPartnerId);
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(selected));
    button.style.cssText = `
      display: flex; align-items: center; gap: 10px; width: 100%; min-height: 34px;
      padding: 7px 9px; border: 1px solid ${selected ? '#71b9ff' : 'transparent'};
      border-radius: 4px; background: ${selected ? '#17324a' : '#242424'};
      color: #e7e7e7; font: inherit; text-align: left; cursor: pointer;
    `;

    const swatch = document.createElement('span');
    swatch.setAttribute('aria-hidden', 'true');
    swatch.style.cssText = `
      flex: 0 0 16px; width: 16px; height: 16px; border-radius: 2px;
      background: linear-gradient(135deg, ${hexColor(nation.color)} 0 50%, ${hexColor(nation.secondaryColor)} 50% 100%);
    `;
    const label = document.createElement('span');
    label.textContent = nation.name;
    label.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    button.append(swatch, label);
    button.addEventListener('click', () => {
      if (kind === 'source') {
        this.selectedNationId = nation.id;
        this.ensurePartner(this.getNations());
      } else {
        this.selectedPartnerId = nation.id;
      }
      this.render();
    });
    return button;
  }

  private renderRelationPanel(nations: readonly Nation[]): void {
    this.relationPanel.replaceChildren();
    const first = nations.find((nation) => nation.id === this.selectedNationId);
    const second = nations.find((nation) => nation.id === this.selectedPartnerId);
    if (!first || !second) {
      this.relationPanel.textContent = 'Select two nations to edit their relationship.';
      return;
    }

    const title = document.createElement('div');
    title.textContent = `${first.name} ↔ ${second.name}`;
    title.style.cssText = 'font-weight: 700; color: #f0f0f0; margin-bottom: 22px;';
    const heading = document.createElement('div');
    heading.textContent = 'RELATIONSHIP MEMORY';
    heading.style.cssText = `
      margin-bottom: 12px; color: #a9a9a9; font-size: 11px;
      letter-spacing: 1px; text-transform: uppercase;
    `;
    this.relationPanel.append(title, heading);

    const relation = this.options.diplomacyManager.getRelation(first.id, second.id);
    for (const field of RELATION_MEMORY_FIELDS) {
      const row = document.createElement('label');
      row.style.cssText = `
        display: grid; grid-template-columns: 82px minmax(150px, 1fr) 34px;
        gap: 12px; align-items: center; min-height: 36px;
      `;
      const name = document.createElement('span');
      name.textContent = field.label;
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '100';
      slider.step = '1';
      slider.value = String(relation[field.key]);
      slider.setAttribute('aria-label', `${field.label}: ${first.name} and ${second.name}`);
      slider.style.cssText = 'width: 100%; accent-color: #1685ed; cursor: pointer;';
      const value = document.createElement('span');
      value.textContent = String(relation[field.key]);
      value.style.cssText = 'color: #d9edff; text-align: right; font-variant-numeric: tabular-nums;';
      slider.addEventListener('input', () => {
        const nextValue = clampMemoryValue(slider.value);
        value.textContent = String(nextValue);
        const current = this.options.diplomacyManager.getRelation(first.id, second.id);
        this.options.diplomacyManager.setMemoryValues(first.id, second.id, {
          trust: current.trust,
          fear: current.fear,
          hostility: current.hostility,
          suspicion: current.suspicion,
          affinity: current.affinity,
          [field.key]: nextValue,
        });
        this.options.onRelationChanged?.();
      });
      row.append(name, slider, value);
      this.relationPanel.appendChild(row);
    }
  }

  private buildOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = 'relations-cheat-dialog';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 10003; display: none;
      align-items: center; justify-content: center; padding: 24px;
      background: rgba(0, 0, 0, 0.72); color: #dedede;
      font: 13px ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      pointer-events: auto;
    `;
    overlay.addEventListener('mousedown', (event) => event.stopPropagation());
    overlay.addEventListener('mouseup', (event) => event.stopPropagation());
    overlay.addEventListener('click', (event) => event.stopPropagation());
    overlay.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    });

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'relations-cheat-title');
    dialog.style.cssText = `
      width: min(960px, calc(100vw - 48px)); max-height: min(700px, calc(100vh - 48px));
      overflow: hidden; border: 1px solid #454545; border-radius: 5px;
      background: #181818; box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55);
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      padding: 9px 12px 9px 18px; border-bottom: 1px solid #393939; background: #222;
    `;
    const title = document.createElement('div');
    title.id = 'relations-cheat-title';
    title.textContent = 'NATION RELATIONS';
    title.style.cssText = 'color: #d8edff; font-size: 16px; font-weight: 700; letter-spacing: .5px;';
    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'relations-cheat-done';
    done.textContent = 'Done';
    done.style.cssText = `
      min-width: 58px; padding: 7px 13px; border: 1px solid #555; border-radius: 4px;
      background: #2c2c2c; color: #eee; font: inherit; cursor: pointer;
    `;
    done.addEventListener('click', () => this.close());
    header.append(title, done);

    const body = document.createElement('div');
    body.style.cssText = `
      display: grid; grid-template-columns: minmax(170px, 220px) minmax(170px, 220px) minmax(300px, 1fr);
      min-height: 390px; max-height: calc(100vh - 120px); overflow: auto;
    `;
    const sourceColumn = this.buildListColumn('NATION', 'relations-cheat-source-list');
    const partnerColumn = this.buildListColumn('RELATION WITH', 'relations-cheat-partner-list');
    const panel = document.createElement('div');
    panel.className = 'relations-cheat-panel';
    panel.style.cssText = 'margin: 12px; padding: 18px 14px; border: 1px solid #343434; border-radius: 6px; background: #151515;';
    body.append(sourceColumn, partnerColumn, panel);
    dialog.append(header, body);
    overlay.appendChild(dialog);
    return overlay;
  }

  private buildListColumn(headingText: string, listClass: string): HTMLDivElement {
    const column = document.createElement('div');
    column.style.cssText = 'padding: 12px 10px; border-right: 1px solid #343434; overflow: auto;';
    const heading = document.createElement('div');
    heading.textContent = headingText;
    heading.style.cssText = 'padding: 0 4px 8px; color: #a9a9a9; font-size: 11px; letter-spacing: 1px;';
    const list = document.createElement('div');
    list.className = listClass;
    list.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';
    column.append(heading, list);
    return column;
  }
}

export function clampMemoryValue(rawValue: string | number): number {
  const parsed = typeof rawValue === 'number' ? rawValue : Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function hexColor(color: number): string {
  return `#${(color >>> 0).toString(16).padStart(6, '0').slice(-6)}`;
}
