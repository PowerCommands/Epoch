import { getLeaderByNationId } from '../data/leaders';
import { NationManager } from '../systems/NationManager';
import { TurnManager } from '../systems/TurnManager';
import type { LeaderDefinition } from '../types/leader';

export class LeftPanel {
  private readonly root: HTMLElement;
  private readonly nationManager: NationManager;
  private readonly turnManager: TurnManager;
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
    void humanNationId;

    this.refresh();
  }

  refresh(): void {
    this.root.replaceChildren();
    this.root.className = 'html-panel';

    this.root.append(
      this.renderTurnInfo(),
      this.renderLeaderStrip(),
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

  private renderLeaderStrip(): HTMLElement {
    const section = this.createSection('Leaders');

    for (const nation of this.nationManager.getAllNations()) {
      const leader = getLeaderByNationId(nation.id);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'leader-portrait-button';
      row.dataset.nationId = nation.id;

      const nationName = document.createElement('div');
      nationName.className = 'leader-nation-name';
      nationName.textContent = nation.name;
      nationName.style.color = toCssColor(nation.color);

      const portrait = this.createLeaderPortrait(leader);

      const leaderName = document.createElement('div');
      leaderName.className = 'leader-name';
      leaderName.textContent = leader?.name ?? 'Unknown leader';

      row.append(nationName, portrait, leaderName);
      row.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('leaderSelected', {
          detail: { nationId: nation.id, leaderId: leader?.id },
        }));
      });

      section.append(row);
    }

    return section;
  }

  private createLeaderPortrait(leader: LeaderDefinition | undefined): HTMLElement {
    const fallback = document.createElement('span');
    fallback.className = 'leader-portrait-fallback';
    fallback.textContent = '?';

    if (!leader) return fallback;

    const img = document.createElement('img');
    img.className = 'leader-portrait';
    img.src = leader.image;
    img.alt = leader.name;
    img.addEventListener('error', () => {
      img.replaceWith(fallback);
    }, { once: true });
    return img;
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
