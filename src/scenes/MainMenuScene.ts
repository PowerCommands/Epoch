import Phaser from 'phaser';
import { AVAILABLE_MAPS } from '../data/maps';
import { getLeaderByNationId } from '../data/leaders';
import type { ScenarioData, ScenarioNation } from '../types/scenario';
import type { GameConfig } from '../types/gameConfig';

/**
 * MainMenuScene — game start screen.
 * HTML overlay for map/nation/opponent selection.
 */
export class MainMenuScene extends Phaser.Scene {
  private overlay: HTMLDivElement | null = null;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    this.overlay = document.createElement('div');
    this.overlay.id = 'main-menu-overlay';
    this.overlay.innerHTML = this.buildHTML();
    document.body.appendChild(this.overlay);
    this.injectStyles();
    this.wireEvents();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private cleanup(): void {
    this.overlay?.remove();
    this.overlay = null;
    const style = document.getElementById('main-menu-styles');
    style?.remove();
  }

  private buildHTML(): string {
    const mapOptions = AVAILABLE_MAPS
      .map(m => `<option value="${m.key}">${m.label}</option>`)
      .join('');

    return `
      <div class="mm-container">
        <div class="mm-header">
          <h1 class="mm-title">EPOCH</h1>
          <p class="mm-subtitle">Turn-Based Strategy</p>
        </div>

        <div class="mm-section">
          <label class="mm-label">SELECT MAP</label>
          <select id="mm-map-select" class="mm-select">
            ${mapOptions}
          </select>
        </div>

        <div class="mm-section" id="mm-chosen-section" style="display:none">
          <label class="mm-label">CHOSEN NATION</label>
          <div id="mm-chosen-display"></div>
        </div>

        <div class="mm-section" id="mm-nation-section">
          <label class="mm-label" id="mm-nation-label">CHOOSE YOUR NATION</label>
          <div id="mm-nation-list" class="mm-nation-list"></div>
        </div>

        <button id="mm-start-btn" class="mm-start-btn" disabled>START GAME</button>
        <button id="mm-editor-btn" class="mm-editor-btn">Editor</button>
      </div>
    `;
  }

  private wireEvents(): void {
    const mapSelect = document.getElementById('mm-map-select') as HTMLSelectElement;
    mapSelect.addEventListener('change', () => this.onMapChanged(mapSelect.value));
    // Trigger initial load
    this.onMapChanged(mapSelect.value);

    document.getElementById('mm-start-btn')!.addEventListener('click', () => {
      this.startGame();
    });

    document.getElementById('mm-editor-btn')!.addEventListener('click', () => {
      window.location.href = '/editor.html';
    });
  }

  private currentMapKey = '';
  private nations: ScenarioNation[] = [];
  private selectedNationId: string | null = null;
  private selectedOpponentIds = new Set<string>();

  private onMapChanged(mapKey: string): void {
    this.currentMapKey = mapKey;
    this.selectedNationId = null;
    this.selectedOpponentIds.clear();

    const json = this.cache.json.get(mapKey) as ScenarioData;
    this.nations = json.nations;

    this.renderNationList();
    this.updateStartButton();
  }

  private renderNationList(): void {
    const container = document.getElementById('mm-nation-list')!;
    const label = document.getElementById('mm-nation-label')!;
    const chosenSection = document.getElementById('mm-chosen-section')!;
    const chosenDisplay = document.getElementById('mm-chosen-display')!;
    container.innerHTML = '';

    if (this.selectedNationId) {
      // Show chosen nation at top
      const chosen = this.nations.find(n => n.id === this.selectedNationId)!;
      chosenSection.style.display = '';
      chosenDisplay.innerHTML = '';

      const chosenCard = document.createElement('button');
      chosenCard.type = 'button';
      chosenCard.className = 'mm-nation-card selected';
      const chosenLeader = getLeaderByNationId(chosen.id);
      chosenCard.append(this.createLeaderPortrait(chosen.id, 'mm-leader-thumb'));

      const chosenDot = document.createElement('span');
      chosenDot.className = 'mm-nation-dot';
      chosenDot.style.background = chosen.color;

      const chosenName = document.createElement('span');
      chosenName.textContent = chosen.name;

      const changeHint = document.createElement('span');
      changeHint.className = 'mm-change-hint';
      changeHint.textContent = 'change';

      chosenCard.append(chosenDot, chosenName);
      if (chosenLeader) {
        const leaderName = document.createElement('span');
        leaderName.className = 'mm-card-leader-name';
        leaderName.textContent = chosenLeader.name;
        chosenCard.append(leaderName);
      }
      chosenCard.append(changeHint);
      chosenCard.addEventListener('click', () => this.deselectNation());
      chosenDisplay.appendChild(chosenCard);

      // Remaining nations as opponent checkboxes
      label.textContent = 'OPPONENTS';
      for (const nation of this.nations) {
        if (nation.id === this.selectedNationId) continue;

        const row = document.createElement('label');
        row.className = 'mm-opponent-row';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = this.selectedOpponentIds.has(nation.id);
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            this.selectedOpponentIds.add(nation.id);
          } else {
            if (this.selectedOpponentIds.size <= 1) {
              checkbox.checked = true;
              return;
            }
            this.selectedOpponentIds.delete(nation.id);
          }
          this.updateStartButton();
        });

        const dot = document.createElement('span');
        dot.className = 'mm-nation-dot';
        dot.style.background = nation.color;

        const portrait = this.createLeaderPortrait(nation.id, 'mm-leader-thumb small');
        const leader = getLeaderByNationId(nation.id);

        const name = document.createElement('span');
        name.textContent = nation.name;
        const leaderName = document.createElement('span');
        leaderName.className = 'mm-card-leader-name';
        leaderName.textContent = leader?.name ?? 'Unknown leader';

        row.append(checkbox, portrait, dot, name, leaderName);
        container.appendChild(row);
      }
    } else {
      // No selection — show all nations as clickable cards
      chosenSection.style.display = 'none';
      label.textContent = 'CHOOSE YOUR NATION';

      for (const nation of this.nations) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'mm-nation-card';
        card.dataset.nationId = nation.id;

        const dot = document.createElement('span');
        dot.className = 'mm-nation-dot';
        dot.style.background = nation.color;

        const portrait = this.createLeaderPortrait(nation.id, 'mm-leader-thumb');
        const leader = getLeaderByNationId(nation.id);

        const name = document.createElement('span');
        name.textContent = nation.name;
        const leaderName = document.createElement('span');
        leaderName.className = 'mm-card-leader-name';
        leaderName.textContent = leader?.name ?? 'Unknown leader';

        card.append(portrait, dot, name, leaderName);
        card.addEventListener('click', () => this.selectNation(nation.id));
        container.appendChild(card);
      }
    }
  }

  private createLeaderPortrait(nationId: string, className: string): HTMLElement {
    const leader = getLeaderByNationId(nationId);
    const fallback = document.createElement('span');
    fallback.className = className;
    fallback.textContent = '?';

    if (!leader) return fallback;

    const img = document.createElement('img');
    img.className = className;
    img.src = leader.image;
    img.alt = leader.name;
    img.addEventListener('error', () => {
      img.replaceWith(fallback);
    }, { once: true });
    return img;
  }

  private selectNation(nationId: string): void {
    this.selectedNationId = nationId;
    this.selectedOpponentIds.clear();
    for (const n of this.nations) {
      if (n.id !== nationId) this.selectedOpponentIds.add(n.id);
    }
    this.renderNationList();
    this.updateStartButton();
  }

  private deselectNation(): void {
    this.selectedNationId = null;
    this.selectedOpponentIds.clear();
    this.renderNationList();
    this.updateStartButton();
  }

  private updateStartButton(): void {
    const btn = document.getElementById('mm-start-btn') as HTMLButtonElement;
    btn.disabled = !this.selectedNationId || this.selectedOpponentIds.size === 0;
  }

  private startGame(): void {
    if (!this.selectedNationId) return;

    const config: GameConfig = {
      mapKey: this.currentMapKey,
      humanNationId: this.selectedNationId,
      activeNationIds: [this.selectedNationId, ...this.selectedOpponentIds],
    };

    this.cleanup();
    this.scene.start('GameScene', config);
  }

  private injectStyles(): void {
    if (document.getElementById('main-menu-styles')) return;

    const style = document.createElement('style');
    style.id = 'main-menu-styles';
    style.textContent = `
      #main-menu-overlay {
        position: fixed;
        inset: 0;
        z-index: 1000;
        background: #0a0e14;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: 'Georgia', 'Times New Roman', serif;
        color: #c8c8c8;
      }

      .mm-container {
        width: 420px;
        max-height: 90vh;
        overflow-y: auto;
        padding: 40px 30px;
        text-align: center;
      }

      .mm-header {
        margin-bottom: 36px;
      }

      .mm-title {
        font-size: 72px;
        font-weight: 700;
        letter-spacing: 16px;
        color: #d4a857;
        margin: 0;
        text-shadow: 0 2px 8px rgba(212, 168, 87, 0.3);
      }

      .mm-subtitle {
        font-size: 14px;
        letter-spacing: 4px;
        color: #666;
        margin: 8px 0 0;
        text-transform: uppercase;
      }

      .mm-section {
        margin-bottom: 24px;
        text-align: left;
      }

      .mm-label {
        display: block;
        font-size: 11px;
        letter-spacing: 2px;
        color: #888;
        text-transform: uppercase;
        margin-bottom: 8px;
      }

      .mm-select {
        width: 100%;
        padding: 10px 12px;
        background: #151a22;
        border: 1px solid #2a3040;
        border-radius: 4px;
        color: #c8c8c8;
        font-size: 14px;
        font-family: inherit;
        cursor: pointer;
      }

      .mm-select:focus {
        outline: none;
        border-color: #d4a857;
      }

      .mm-nation-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .mm-nation-card {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        background: #151a22;
        border: 1px solid #2a3040;
        border-radius: 4px;
        color: #c8c8c8;
        font-size: 14px;
        font-family: inherit;
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s;
      }

      .mm-nation-card:hover {
        background: #1a2030;
        border-color: #3a4a60;
      }

      .mm-nation-card.selected {
        background: #1a2520;
        border-color: #d4a857;
        color: #fff;
      }

      .mm-nation-dot {
        width: 14px;
        height: 14px;
        border-radius: 3px;
        flex-shrink: 0;
      }

      .mm-leader-thumb {
        width: 42px;
        height: 52px;
        border-radius: 50% / 44%;
        object-fit: cover;
        flex-shrink: 0;
        border: 1px solid #3a3040;
        background: #111722;
        color: #777;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }

      .mm-leader-thumb.small {
        width: 30px;
        height: 38px;
      }

      .mm-card-leader-name {
        margin-left: auto;
        color: #777;
        font-size: 12px;
        font-style: italic;
      }

      .mm-change-hint {
        margin-left: 8px;
        font-size: 11px;
        color: #666;
        font-weight: 400;
      }

      .mm-nation-card:hover .mm-change-hint {
        color: #d4a857;
      }

      .mm-opponent-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .mm-opponent-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        background: #151a22;
        border: 1px solid #2a3040;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.15s;
      }

      .mm-opponent-row:hover {
        background: #1a2030;
      }

      .mm-opponent-row input[type="checkbox"] {
        accent-color: #d4a857;
        width: 16px;
        height: 16px;
        cursor: pointer;
      }

      .mm-start-btn {
        display: block;
        width: 100%;
        padding: 14px;
        margin-top: 28px;
        background: #8b0000;
        border: none;
        border-radius: 4px;
        color: #fff;
        font-size: 18px;
        font-weight: 700;
        font-family: inherit;
        letter-spacing: 4px;
        cursor: pointer;
        transition: background 0.15s;
      }

      .mm-start-btn:hover:not(:disabled) {
        background: #a50000;
      }

      .mm-start-btn:disabled {
        background: #333;
        color: #666;
        cursor: not-allowed;
      }

      .mm-editor-btn {
        display: block;
        width: 100%;
        padding: 10px;
        margin-top: 12px;
        background: transparent;
        border: 1px solid #2a3040;
        border-radius: 4px;
        color: #888;
        font-size: 13px;
        font-weight: 700;
        font-family: inherit;
        letter-spacing: 3px;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
      }

      .mm-editor-btn:hover {
        background: #151a22;
        border-color: #d4a857;
        color: #c8c8c8;
      }
    `;
    document.head.appendChild(style);
  }
}
