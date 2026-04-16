import { NationManager } from '../systems/NationManager';
import { TurnManager } from '../systems/TurnManager';

export class LeftPanel {
  private readonly root: HTMLElement;
  private readonly nationManager: NationManager;
  private readonly turnManager: TurnManager;
  private readonly humanNationId: string | undefined;
  private endTurnCallback: (() => void) | null = null;
  private selectedNationId: string | null = null;

  constructor(
    nationManager: NationManager,
    turnManager: TurnManager,
    humanNationId?: string,
  ) {
    const root = document.getElementById('panel-left');
    if (!root) throw new Error('Missing #panel-left');

    this.root = root;
    this.nationManager = nationManager;
    this.turnManager = turnManager;
    this.humanNationId = humanNationId;

    this.refresh();
  }

  refresh(): void {
    this.root.replaceChildren();
    this.root.className = 'html-panel';

    this.root.append(
      this.renderTurnInfo(),
      this.renderNationList(),
      this.renderEndTurnButton(),
    );
  }

  setEndTurnCallback(cb: () => void): void {
    this.endTurnCallback = cb;
  }

  setEndTurnEnabled(enabled: boolean): void {
    const btn = document.getElementById('end-turn-btn') as HTMLButtonElement | null;
    if (!btn) return;
    btn.disabled = !enabled;
    btn.textContent = enabled ? 'End Turn' : 'AI thinking...';
    btn.style.opacity = enabled ? '1' : '0.4';
    btn.style.pointerEvents = enabled ? 'auto' : 'none';
  }

  setSelectedNation(nationId: string | null): void {
    this.selectedNationId = nationId;
    const rows = this.root.querySelectorAll('.nation-row');
    rows.forEach(row => {
      const el = row as HTMLElement;
      el.classList.toggle('nation-row-selected', el.dataset.nationId === nationId);
    });
  }

  clearSelectedNation(): void {
    this.selectedNationId = null;
    const rows = this.root.querySelectorAll('.nation-row');
    rows.forEach(row => (row as HTMLElement).classList.remove('nation-row-selected'));
  }

  private renderTurnInfo(): HTMLElement {
    const section = this.createSection('Turn');
    const currentNation = this.turnManager.getCurrentNation();

    section.append(
      this.createDiv('panel-large', `Round ${this.turnManager.getCurrentRound()}`),
      this.createDiv('', `${currentNation.name}'s Turn`, currentNation.color),
    );

    return section;
  }

  private renderNationList(): HTMLElement {
    const section = this.createSection('Nations');

    for (const nation of this.nationManager.getAllNations()) {
      const row = document.createElement('div');
      row.className = 'nation-row';
      if (this.selectedNationId === nation.id) {
        row.classList.add('nation-row-selected');
      }
      row.dataset.nationId = nation.id;

      const swatch = document.createElement('span');
      swatch.className = 'nation-swatch';
      swatch.style.background = toCssColor(nation.color);

      const name = document.createElement('span');
      name.className = 'nation-name';
      name.textContent = nation.name;
      if (nation.id === this.humanNationId) {
        name.textContent += ' (You)';
      }

      row.append(swatch, name);
      row.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('nationSelected', { detail: { nationId: nation.id } }));
      });

      section.append(row);
    }

    return section;
  }

  private renderEndTurnButton(): HTMLElement {
    const btn = document.createElement('button');
    btn.id = 'end-turn-btn';
    btn.textContent = 'End Turn';
    btn.style.cssText = `
      width: 100%;
      padding: 10px;
      background: #8b0000;
      color: white;
      font-weight: bold;
      border: none;
      cursor: pointer;
      font-size: 14px;
    `;
    btn.addEventListener('mouseenter', () => {
      if (!btn.disabled) btn.style.background = '#a00000';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = '#8b0000';
    });
    btn.addEventListener('click', () => {
      if (this.endTurnCallback) this.endTurnCallback();
    });

    const wrapper = document.createElement('div');
    wrapper.style.marginTop = 'auto';
    wrapper.append(btn);
    return wrapper;
  }

  private createSection(title: string): HTMLElement {
    const section = this.createDiv('panel-section');
    section.append(this.createDiv('panel-heading', title));
    return section;
  }

  private createDiv(className: string, text?: string, color?: number): HTMLDivElement {
    const div = document.createElement('div');
    div.className = className;
    if (text !== undefined) div.textContent = text;
    if (color !== undefined) div.style.color = toCssColor(color);
    return div;
  }
}

function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
