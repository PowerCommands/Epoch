import { getLeaderByNationId } from '../data/leaders';
import { NationManager } from '../systems/NationManager';
import { TurnManager } from '../systems/TurnManager';
import type { DiscoverySystem } from '../systems/DiscoverySystem';
import type { ResearchSystem } from '../systems/ResearchSystem';
import type { LeaderDefinition } from '../types/leader';
import { RafScheduler } from '../utils/RafScheduler';

export class LeftPanel {
  private readonly root: HTMLElement;
  private readonly nationManager: NationManager;
  private readonly turnManager: TurnManager;
  private readonly humanNationId: string | undefined;
  private readonly discoverySystem: DiscoverySystem | null;
  private researchSystem: ResearchSystem | null = null;
  private endTurnCallback: (() => void) | null = null;
  private selectedNationId: string | null = null;
  private readonly scheduler = new RafScheduler();

  constructor(
    nationManager: NationManager,
    turnManager: TurnManager,
    humanNationId?: string,
    discoverySystem?: DiscoverySystem,
  ) {
    const root = document.getElementById('panel-left');
    if (!root) throw new Error('Missing #panel-left');

    this.root = root;
    this.nationManager = nationManager;
    this.turnManager = turnManager;
    this.humanNationId = humanNationId;
    this.discoverySystem = discoverySystem ?? null;

    this.refresh();
  }

  refresh(): void {
    this.root.replaceChildren();
    this.root.className = 'html-panel';

    this.root.append(
      this.renderTurnInfo(),
      this.renderResearchSection(),
      this.renderLeaderStrip(),
    );
  }

  /** Coalesce repeated event-driven refreshes into one per animation frame. */
  requestRefresh(): void {
    this.scheduler.schedule('refresh', () => this.refresh());
  }

  shutdown(): void {
    this.scheduler.cancel();
  }

  setResearchSystem(researchSystem: ResearchSystem): void {
    this.researchSystem = researchSystem;
    this.refresh();
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
    const section = this.createSection(`Turn ${this.turnManager.getCurrentRound()}`);
    const currentNation = this.turnManager.getCurrentNation();

    section.append(
      this.renderEndTurnButton(),
      this.createDiv('turn-active-nation', `${currentNation.name}'s Turn`, currentNation.color),
    );

    return section;
  }

  private renderLeaderStrip(): HTMLElement {
    const section = this.createSection('Leaders');
    const visible = this.getVisibleNations();

    for (const nation of visible) {
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

  private renderResearchSection(): HTMLElement {
    const section = this.createSection('Research');
    const humanNationId = this.humanNationId;
    const researchSystem = this.researchSystem;

    if (!humanNationId || !researchSystem) {
      section.append(this.createDiv('panel-muted', 'Research unavailable'));
      return section;
    }

    const current = researchSystem.getCurrentResearch(humanNationId);
    const progress = researchSystem.getResearchProgress(humanNationId);
    const available = researchSystem.getAvailableTechnologies(humanNationId);
    const researched = researchSystem.getResearchedTechnologies(humanNationId);

    section.append(
      this.createDiv('', `Current Research: ${current?.name ?? 'None'}`),
      this.createDiv('', `Progress: ${progress} / ${current?.cost ?? 0}`),
      this.createDiv('panel-muted', `Science: +${researchSystem.getResearchPerTurn(humanNationId)}/turn`),
    );

    const availableHeading = this.createDiv('research-subheading', 'Available');
    section.append(availableHeading);
    if (available.length === 0) {
      section.append(this.createDiv('panel-muted', 'No available technologies'));
    } else {
      for (const technology of available) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'research-tech-button';
        button.textContent = `${technology.name} (${technology.cost})`;
        button.addEventListener('click', () => {
          if (researchSystem.startResearch(humanNationId, technology.id)) {
            this.refresh();
          }
        });
        section.append(button);
      }
    }

    const researchedText = researched.length > 0
      ? researched.map((technology) => technology.name).join(', ')
      : 'None';
    section.append(
      this.createDiv('research-subheading', 'Researched'),
      this.createDiv('panel-muted', researchedText),
    );

    return section;
  }

  private getVisibleNations() {
    const all = this.nationManager.getAllNations();
    if (!this.discoverySystem || !this.humanNationId) return all;
    const humanId = this.humanNationId;
    return all.filter((n) => this.discoverySystem!.hasMet(humanId, n.id));
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
    btn.className = 'end-turn-button';
    btn.textContent = 'End Turn';
    btn.addEventListener('click', () => {
      if (this.endTurnCallback) this.endTurnCallback();
    });

    return btn;
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
