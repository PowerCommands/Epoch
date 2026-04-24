import Phaser from 'phaser';
import { MAP_MANIFEST_CACHE_KEY, parseMapManifest } from '../data/maps';
import type { MapDefinition } from '../data/maps';
import { getLeaderByNationId } from '../data/leaders';
import type { ScenarioData, ScenarioNation } from '../types/scenario';
import type { GameConfig, ResourceAbundance } from '../types/gameConfig';
import { SetupMusicManager } from '../systems/SetupMusicManager';
import { SaveLoadService } from '../systems/SaveLoadService';
import { bindMusicControls } from '../ui/MusicControls';

/**
 * MainMenuScene — HTML/CSS start screen for map, nation, and opponent setup.
 */
export class MainMenuScene extends Phaser.Scene {
  private overlay: HTMLDivElement | null = null;
  private maps: MapDefinition[] = [];
  private currentMapKey = '';
  private nations: ScenarioNation[] = [];
  private selectedNationId: string | null = null;
  private selectedOpponentIds = new Set<string>();
  private selectedResourceAbundance: ResourceAbundance = 'normal';
  private enabledVictoryIds = new Set(['domination', 'diplomatic', 'science', 'cultural']);
  private resizeHandler: (() => void) | null = null;
  private music: SetupMusicManager | null = null;
  private unbindMusicControls: (() => void) | null = null;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    this.maps = parseMapManifest(this.cache.json.get(MAP_MANIFEST_CACHE_KEY)).maps;
    this.overlay = document.createElement('div');
    this.overlay.id = 'main-menu-overlay';
    this.overlay.innerHTML = this.buildHTML();
    document.body.appendChild(this.overlay);
    this.injectStyles();
    this.syncOverlayBounds();

    this.resizeHandler = () => this.syncOverlayBounds();
    window.addEventListener('resize', this.resizeHandler);

    this.music = SetupMusicManager.getShared();
    this.music.playPlaylist('start');

    this.wireEvents();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private cleanup(): void {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    // Release the local reference but do NOT dispose — the current nation
    // playlist must keep looping after the scene transitions to GameScene.
    this.unbindMusicControls?.();
    this.unbindMusicControls = null;
    this.music = null;

    this.overlay?.remove();
    this.overlay = null;
    const style = document.getElementById('main-menu-styles');
    style?.remove();
  }

  private syncOverlayBounds(): void {
    if (!this.overlay) return;

    const gameContainer = document.getElementById('game-container');
    const rect = gameContainer?.getBoundingClientRect();
    const width = Math.max(860, Math.floor(rect?.width ?? window.innerWidth));
    const left = Math.floor(rect?.left ?? 0);

    this.overlay.style.setProperty('--mm-shell-width', `${width}px`);
    this.overlay.style.setProperty('--mm-shell-left', `${left}px`);
  }

  private buildHTML(): string {
    const mapOptions = this.maps
      .map(m => `<option value="${m.key}">${m.label}</option>`)
      .join('');

    return `
      <div class="mm-container">
        <header class="mm-header">
          <h1 class="mm-title">Epochs of Time</h1>
          <p class="mm-subtitle">Lead your people through the ages, from humble beginnings to world dominance.</p>
        </header>

        <section class="mm-victory-row" aria-label="Victory conditions">
          <button class="mm-victory-card active" type="button" data-victory="domination">
            <span class="mm-victory-check" aria-hidden="true"></span>
            <span class="mm-victory-title">Domination</span>
            <span class="mm-victory-copy">Conquer rival capitals.</span>
          </button>
          <button class="mm-victory-card active" type="button" data-victory="diplomatic">
            <span class="mm-victory-check" aria-hidden="true"></span>
            <span class="mm-victory-title">Diplomatic</span>
            <span class="mm-victory-copy">Shape the world council.</span>
          </button>
          <button class="mm-victory-card active" type="button" data-victory="science">
            <span class="mm-victory-check" aria-hidden="true"></span>
            <span class="mm-victory-title">Science</span>
            <span class="mm-victory-copy">Outpace every age.</span>
          </button>
          <button class="mm-victory-card active" type="button" data-victory="cultural">
            <span class="mm-victory-check" aria-hidden="true"></span>
            <span class="mm-victory-title">Cultural</span>
            <span class="mm-victory-copy">Become history's voice.</span>
          </button>
        </section>

        <main class="mm-main">
          <section class="mm-nations-panel">
            <div class="mm-panel-heading">
              <div>
                <span class="mm-eyebrow">Civilizations</span>
                <h2>Choose your nation</h2>
              </div>
              <p id="mm-nation-status" class="mm-status">First pick becomes your nation.</p>
            </div>
            <div id="mm-nation-list" class="mm-nation-grid"></div>
          </section>

          <aside class="mm-setup-panel">
            <div class="mm-panel-heading stacked">
              <span class="mm-eyebrow">Game setup</span>
              <h2>Selected</h2>
            </div>

            <div id="mm-selected-display" class="mm-selected-display"></div>

            <label class="mm-field-label" for="mm-map-select">Map</label>
            <select id="mm-map-select" class="mm-select">
              ${mapOptions}
            </select>

            <label class="mm-field-label" for="mm-resource-abundance-select">Resource Abundance</label>
            <select id="mm-resource-abundance-select" class="mm-select">
              <option value="scarce">Scarce</option>
              <option value="normal" selected>Normal</option>
              <option value="abundant">Abundant</option>
            </select>

            <div class="mm-opponent-summary">
              <span class="mm-field-label">Opponents</span>
              <strong id="mm-opponent-count">0 enabled</strong>
              <p id="mm-opponent-hint">Choose a nation to prepare the rival field.</p>
            </div>

            <div id="mm-opponent-list" class="mm-opponent-list"></div>

            <div class="mm-audio-group">
              <span class="mm-field-label">Audio</span>
              <label class="mm-audio-toggle">
                <input id="mm-music-toggle" type="checkbox" />
                <span>Music</span>
              </label>
              <div class="mm-volume-row">
                <span class="mm-audio-sublabel">Volume</span>
                <input id="mm-music-volume" class="mm-audio-slider" type="range" min="0" max="1" step="0.05" />
                <span id="mm-music-volume-value" class="mm-audio-value"></span>
              </div>
            </div>

            <button id="mm-change-nation-btn" class="mm-change-nation-btn" type="button" disabled>Change player nation</button>
          </aside>
        </main>

        <footer class="mm-actions">
          <button id="mm-start-btn" class="mm-start-btn" type="button" disabled>Start Game</button>
          <button id="mm-load-btn" class="mm-load-btn" type="button">Load Game</button>
          <button id="mm-editor-btn" class="mm-editor-btn" type="button">Editor</button>
          <input id="mm-load-input" type="file" accept="application/json,.json" hidden>
        </footer>
      </div>
    `;
  }

  private wireEvents(): void {
    const mapSelect = document.getElementById('mm-map-select') as HTMLSelectElement;
    mapSelect.addEventListener('change', () => this.onMapChanged(mapSelect.value));
    const resourceAbundanceSelect = document.getElementById('mm-resource-abundance-select') as HTMLSelectElement;
    resourceAbundanceSelect.addEventListener('change', () => {
      this.selectedResourceAbundance = toResourceAbundance(resourceAbundanceSelect.value);
    });

    document.querySelectorAll<HTMLButtonElement>('[data-victory]').forEach(button => {
      const victoryId = button.dataset.victory;
      if (!victoryId) return;

      button.addEventListener('click', () => {
        if (this.enabledVictoryIds.has(victoryId)) {
          this.enabledVictoryIds.delete(victoryId);
          button.classList.remove('active');
          button.classList.add('inactive');
          button.setAttribute('aria-pressed', 'false');
        } else {
          this.enabledVictoryIds.add(victoryId);
          button.classList.add('active');
          button.classList.remove('inactive');
          button.setAttribute('aria-pressed', 'true');
        }
      });
      button.setAttribute('aria-pressed', 'true');
    });

    document.getElementById('mm-start-btn')!.addEventListener('click', () => {
      this.startGame();
    });

    const loadInput = document.getElementById('mm-load-input') as HTMLInputElement;
    document.getElementById('mm-load-btn')!.addEventListener('click', () => {
      loadInput.value = '';
      loadInput.click();
    });
    loadInput.addEventListener('change', () => {
      const file = loadInput.files?.[0];
      if (!file) return;
      this.loadGame(file);
    });

    document.getElementById('mm-editor-btn')!.addEventListener('click', () => {
      const mapKey = this.currentMapKey || this.maps[0]?.key;
      const query = mapKey ? `?map=${encodeURIComponent(mapKey)}` : '';
      window.location.href = `/editor.html${query}`;
    });

    document.getElementById('mm-change-nation-btn')!.addEventListener('click', () => {
      this.clearPlayerNation();
    });

    this.wireMusicControls();

    this.onMapChanged(mapSelect.value);
  }

  private wireMusicControls(): void {
    if (!this.music) return;

    const toggle = document.getElementById('mm-music-toggle') as HTMLInputElement;
    const slider = document.getElementById('mm-music-volume') as HTMLInputElement;
    const valueLabel = document.getElementById('mm-music-volume-value') as HTMLSpanElement;

    this.unbindMusicControls = bindMusicControls(this.music, { toggle, slider, valueLabel });
  }

  private onMapChanged(mapKey: string): void {
    this.currentMapKey = mapKey;
    this.selectedNationId = null;

    const json = this.cache.json.get(mapKey) as ScenarioData | undefined;
    if (!json) {
      this.nations = [];
      this.selectedOpponentIds = new Set();
      this.renderNationList();
      this.updateSetupPanel();
      this.updateStartButton();
      return;
    }
    this.nations = json.nations;
    this.selectedOpponentIds = new Set(this.nations.map(n => n.id));

    this.renderNationList();
    this.updateSetupPanel();
    this.updateStartButton();
    this.music?.playPlaylist('start');
  }

  private renderNationList(): void {
    const container = document.getElementById('mm-nation-list')!;
    const status = document.getElementById('mm-nation-status')!;
    container.innerHTML = '';

    for (const nation of this.nations) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'mm-nation-card';
      card.dataset.nationId = nation.id;

      const isSelectedPlayer = nation.id === this.selectedNationId;
      const isOpponent = this.selectedOpponentIds.has(nation.id);

      if (isSelectedPlayer) card.classList.add('selected-player');
      if (!isSelectedPlayer && isOpponent) card.classList.add('opponent-enabled');
      if (!isSelectedPlayer && !isOpponent) card.classList.add('opponent-disabled');

      const dot = document.createElement('span');
      dot.className = 'mm-nation-dot';
      dot.style.background = nation.color;

      const leader = getLeaderByNationId(nation.id);
      const portrait = this.createLeaderPortrait(nation.id, 'mm-card-portrait');
      const copy = document.createElement('span');
      copy.className = 'mm-nation-copy';

      const name = document.createElement('strong');
      name.textContent = nation.name;

      const leaderName = document.createElement('span');
      leaderName.className = 'mm-card-leader';
      leaderName.textContent = leader?.name ?? 'Unknown leader';

      const description = document.createElement('span');
      description.className = 'mm-card-description';
      description.textContent = leader?.description ?? 'A capable ruler ready to shape the age.';

      const state = document.createElement('span');
      state.className = 'mm-card-state';
      state.textContent = isSelectedPlayer ? 'Player' : isOpponent ? 'Opponent' : 'Excluded';

      copy.append(name, leaderName, description);
      card.append(portrait, dot, copy, state);
      card.addEventListener('click', () => this.handleNationCardClick(nation.id));
      container.appendChild(card);
    }

    const opponents = this.getEnabledOpponentIds().length;
    status.textContent = this.selectedNationId
      ? `${opponents} opponent${opponents === 1 ? '' : 's'} enabled · click rivals to toggle`
      : 'First pick becomes your nation. Rivals are enabled by default.';
  }

  private handleNationCardClick(nationId: string): void {
    if (!this.selectedNationId) {
      this.selectPlayerNation(nationId);
      return;
    }

    if (nationId === this.selectedNationId) return;

    if (this.selectedOpponentIds.has(nationId)) {
      if (this.getEnabledOpponentIds().length <= 1) return;
      this.selectedOpponentIds.delete(nationId);
    } else {
      this.selectedOpponentIds.add(nationId);
    }

    this.renderNationList();
    this.updateSetupPanel();
    this.updateStartButton();
  }

  private selectPlayerNation(nationId: string): void {
    this.selectedNationId = nationId;
    this.selectedOpponentIds = new Set(this.nations.map(n => n.id).filter(id => id !== nationId));
    this.renderNationList();
    this.updateSetupPanel();
    this.updateStartButton();
    this.music?.playPlaylist(nationId);
  }

  private clearPlayerNation(): void {
    this.selectedNationId = null;
    this.selectedOpponentIds = new Set(this.nations.map(n => n.id));
    this.renderNationList();
    this.updateSetupPanel();
    this.updateStartButton();
    this.music?.playPlaylist('start');
  }

  private updateSetupPanel(): void {
    const selectedDisplay = document.getElementById('mm-selected-display')!;
    const opponentCount = document.getElementById('mm-opponent-count')!;
    const opponentHint = document.getElementById('mm-opponent-hint')!;
    const opponentList = document.getElementById('mm-opponent-list')!;
    const changeButton = document.getElementById('mm-change-nation-btn') as HTMLButtonElement;
    selectedDisplay.innerHTML = '';
    opponentList.innerHTML = '';

    const selectedNation = this.nations.find(n => n.id === this.selectedNationId);
    if (!selectedNation) {
      const empty = document.createElement('p');
      empty.className = 'mm-empty-selection';
      empty.textContent = 'Choose a civilization from the grid.';
      selectedDisplay.appendChild(empty);
      changeButton.disabled = true;
    } else {
      const leader = getLeaderByNationId(selectedNation.id);
      selectedDisplay.append(
        this.createLeaderPortrait(selectedNation.id, 'mm-leader-portrait'),
        this.createSelectedNationCopy(selectedNation, leader?.name ?? 'Unknown leader'),
      );
      changeButton.disabled = false;
    }

    const enabledOpponents = this.getEnabledOpponentIds()
      .map(id => this.nations.find(n => n.id === id))
      .filter((nation): nation is ScenarioNation => Boolean(nation));

    opponentCount.textContent = `${enabledOpponents.length} enabled`;
    opponentHint.textContent = selectedNation
      ? 'Cards in the grid toggle rival participation.'
      : 'All civilizations are available until your first pick.';

    for (const opponent of enabledOpponents) {
      const item = document.createElement('span');
      item.className = 'mm-opponent-chip';

      const dot = document.createElement('span');
      dot.className = 'mm-nation-dot mini';
      dot.style.background = opponent.color;

      const name = document.createElement('span');
      name.textContent = opponent.name;

      item.append(dot, name);
      opponentList.appendChild(item);
    }
  }

  private createSelectedNationCopy(nation: ScenarioNation, leaderName: string): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'mm-selected-copy';

    const dot = document.createElement('span');
    dot.className = 'mm-nation-dot';
    dot.style.background = nation.color;

    const name = document.createElement('strong');
    name.textContent = nation.name;

    const leader = document.createElement('span');
    leader.textContent = `Leader: ${leaderName}`;

    wrapper.append(dot, name, leader);
    return wrapper;
  }

  private getEnabledOpponentIds(): string[] {
    return [...this.selectedOpponentIds].filter(id => id !== this.selectedNationId);
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

  private updateStartButton(): void {
    const btn = document.getElementById('mm-start-btn') as HTMLButtonElement;
    btn.disabled = !this.selectedNationId || this.getEnabledOpponentIds().length === 0;
  }

  private startGame(): void {
    if (!this.selectedNationId) return;

    const config: GameConfig = {
      mapKey: this.currentMapKey,
      humanNationId: this.selectedNationId,
      activeNationIds: [this.selectedNationId, ...this.getEnabledOpponentIds()],
      resourceAbundance: this.selectedResourceAbundance,
    };

    this.cleanup();
    this.scene.start('GameScene', config);
  }

  private loadGame(file: File): void {
    file.text().then((text) => {
      const result = SaveLoadService.parse(text);
      if (!result.ok) {
        window.alert(`Could not load save file: ${result.error}`);
        return;
      }

      const savedState = result.state;
      this.cleanup();
      this.scene.start('GameScene', {
        mapKey: savedState.mapKey,
        humanNationId: savedState.humanNationId,
        activeNationIds: savedState.activeNationIds,
        resourceAbundance: 'normal',
        savedState,
      } satisfies GameConfig);
    }).catch((err: unknown) => {
      window.alert(`Could not read save file: ${(err as Error).message}`);
    });
  }

  private injectStyles(): void {
    if (document.getElementById('main-menu-styles')) return;

    const style = document.createElement('style');
    style.id = 'main-menu-styles';
    style.textContent = `
      #main-menu-overlay {
        --mm-shell-width: 1180px;
        --mm-shell-left: 0px;
        position: fixed;
        inset: 0;
        z-index: 1000;
        overflow: hidden;
        font-family: Georgia, 'Times New Roman', serif;
        color: #241a12;
      }

      #main-menu-overlay::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: url('/assets/background.svg'), url('/assets/background.png');
        background-size: cover;
        background-position: center;
        transform: scale(1.02);
      }

      #main-menu-overlay::after {
        content: '';
        position: absolute;
        inset: 0;
        background:
          linear-gradient(90deg, rgba(34, 24, 15, 0.54), rgba(255, 246, 224, 0.3) 45%, rgba(31, 22, 15, 0.52)),
          linear-gradient(180deg, rgba(255, 248, 229, 0.52), rgba(42, 31, 21, 0.36));
      }

      .mm-container {
        position: relative;
        z-index: 1;
        width: min(var(--mm-shell-width), calc(100vw - 32px));
        height: calc(100vh - 32px);
        margin-left: max(16px, var(--mm-shell-left));
        margin-top: 16px;
        display: grid;
        grid-template-rows: auto auto minmax(0, 1fr) auto;
        gap: 18px;
        padding: 18px 28px 20px;
        box-sizing: border-box;
        background: rgba(239, 232, 215, 0.78);
        border: 1px solid rgba(116, 82, 44, 0.28);
        border-radius: 8px;
        box-shadow: 0 24px 60px rgba(34, 24, 15, 0.26);
        backdrop-filter: blur(2px);
      }

      .mm-header {
        text-align: center;
        max-width: 980px;
        justify-self: center;
        padding-top: 2px;
      }

      .mm-title {
        margin: 0;
        font-size: 64px;
        line-height: 0.98;
        font-weight: 700;
        letter-spacing: 0;
        color: #a75d17;
        text-shadow: 0 2px 0 rgba(255, 245, 217, 0.72), 0 12px 28px rgba(75, 45, 18, 0.24);
      }

      .mm-subtitle {
        max-width: 760px;
        margin: 10px auto 0;
        color: rgba(34, 24, 15, 0.76);
        font-size: 20px;
        line-height: 1.35;
        letter-spacing: 0;
      }

      .mm-victory-row {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
      }

      .mm-victory-card,
      .mm-nation-card,
      .mm-start-btn,
      .mm-load-btn,
      .mm-editor-btn,
      .mm-change-nation-btn {
        font-family: inherit;
      }

      .mm-victory-card {
        display: grid;
        grid-template-columns: auto 1fr;
        grid-template-rows: auto auto;
        column-gap: 11px;
        row-gap: 2px;
        align-items: center;
        min-height: 72px;
        padding: 11px 14px;
        text-align: left;
        color: #2d2117;
        background: rgba(252, 248, 237, 0.78);
        border: 1px solid rgba(125, 88, 49, 0.34);
        border-radius: 8px;
        box-shadow: 0 8px 20px rgba(55, 38, 20, 0.12);
        cursor: pointer;
        transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease, opacity 0.15s ease;
      }

      .mm-victory-card:hover {
        transform: translateY(-1px);
        border-color: rgba(176, 101, 24, 0.72);
      }

      .mm-victory-card.inactive {
        opacity: 0.48;
        background: rgba(219, 218, 210, 0.66);
      }

      .mm-victory-check {
        grid-row: 1 / span 2;
        position: relative;
        width: 26px;
        height: 26px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        border: 2px solid rgba(116, 82, 44, 0.48);
        background: rgba(255, 252, 243, 0.82);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72), 0 2px 5px rgba(57, 36, 18, 0.16);
      }

      .mm-victory-card.active .mm-victory-check {
        border-color: #9d5a1a;
        background: linear-gradient(180deg, #cf852f, #9b5618);
      }

      .mm-victory-card.active .mm-victory-check::after {
        content: '';
        width: 7px;
        height: 12px;
        border: solid #fff9e9;
        border-width: 0 3px 3px 0;
        transform: rotate(42deg) translateY(-1px);
      }

      .mm-victory-card.inactive .mm-victory-check {
        background: rgba(236, 234, 226, 0.84);
        border-color: rgba(87, 74, 60, 0.42);
      }

      .mm-victory-title {
        font-size: 19px;
        font-weight: 700;
      }

      .mm-victory-copy {
        font-size: 14px;
        color: rgba(45, 33, 23, 0.68);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .mm-main {
        display: grid;
        grid-template-columns: minmax(0, 7fr) minmax(310px, 3fr);
        gap: 18px;
        min-height: 0;
      }

      .mm-nations-panel,
      .mm-setup-panel {
        min-height: 0;
        background: rgba(248, 245, 235, 0.84);
        border: 1px solid rgba(118, 84, 49, 0.32);
        border-radius: 8px;
        box-shadow: 0 14px 32px rgba(40, 30, 18, 0.12);
      }

      .mm-nations-panel {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        padding: 20px;
      }

      .mm-setup-panel {
        display: flex;
        flex-direction: column;
        padding: 20px;
        overflow: hidden;
      }

      .mm-panel-heading {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: end;
        margin-bottom: 16px;
      }

      .mm-panel-heading.stacked {
        display: block;
      }

      .mm-eyebrow,
      .mm-field-label {
        display: block;
        color: #7f4c15;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0;
        text-transform: uppercase;
      }

      .mm-panel-heading h2 {
        margin: 2px 0 0;
        color: #1f160f;
        font-size: 25px;
        line-height: 1;
        letter-spacing: 0;
      }

      .mm-status {
        max-width: 460px;
        margin: 0;
        color: rgba(36, 26, 18, 0.64);
        font-size: 13px;
        line-height: 1.25;
        text-align: right;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .mm-nation-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(255px, 1fr));
        grid-auto-rows: minmax(112px, auto);
        gap: 10px;
        min-height: 0;
        overflow: auto;
        padding-right: 4px;
      }

      .mm-nation-card {
        display: grid;
        grid-template-columns: auto auto minmax(0, 1fr) auto;
        gap: 9px;
        align-items: center;
        min-width: 0;
        padding: 10px 11px;
        text-align: left;
        color: #261a10;
        background: rgba(255, 252, 243, 0.76);
        border: 1px solid rgba(117, 86, 56, 0.36);
        border-radius: 8px;
        box-shadow: 0 6px 16px rgba(50, 36, 19, 0.08);
        cursor: pointer;
        transition: transform 0.14s ease, border-color 0.14s ease, background 0.14s ease, opacity 0.14s ease;
      }

      .mm-nation-card:hover {
        transform: translateY(-1px);
        border-color: rgba(176, 101, 24, 0.78);
        background: rgba(255, 251, 235, 0.92);
      }

      .mm-nation-card.selected-player {
        border-color: #b06518;
        background: linear-gradient(180deg, rgba(255, 247, 222, 0.95), rgba(238, 214, 170, 0.9));
        box-shadow: inset 0 0 0 2px rgba(176, 101, 24, 0.2), 0 10px 22px rgba(94, 54, 18, 0.16);
      }

      .mm-nation-card.opponent-disabled {
        opacity: 0.5;
        background: rgba(222, 221, 213, 0.7);
      }

      .mm-nation-dot {
        width: 14px;
        height: 14px;
        border-radius: 7px;
        border: 2px solid rgba(255, 255, 255, 0.75);
        box-shadow: 0 0 0 1px rgba(50, 31, 16, 0.32);
        flex-shrink: 0;
      }

      .mm-nation-dot.mini {
        width: 12px;
        height: 12px;
        border-radius: 6px;
      }

      .mm-nation-copy {
        display: grid;
        gap: 2px;
        min-width: 0;
      }

      .mm-nation-copy strong {
        font-size: 18px;
        line-height: 1.05;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .mm-nation-copy span {
        color: rgba(38, 26, 16, 0.7);
        font-size: 13px;
      }

      .mm-card-leader {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .mm-card-description {
        display: -webkit-box;
        min-height: 34px;
        line-height: 1.25;
        white-space: normal;
        overflow: hidden;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }

      .mm-card-portrait {
        width: 48px;
        height: 58px;
        border-radius: 8px;
        object-fit: cover;
        border: 1px solid rgba(117, 86, 56, 0.42);
        background: rgba(62, 45, 27, 0.2);
        color: rgba(36, 26, 18, 0.58);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        box-shadow: 0 4px 10px rgba(48, 33, 18, 0.14);
      }

      .mm-card-state {
        align-self: start;
        padding: 4px 6px;
        border-radius: 8px;
        background: rgba(56, 86, 70, 0.14);
        color: #355642;
        font-size: 11px;
        font-weight: 700;
      }

      .mm-nation-card.selected-player .mm-card-state {
        color: #fff7e7;
        background: #a75d17;
      }

      .mm-nation-card.opponent-disabled .mm-card-state {
        color: rgba(38, 26, 16, 0.54);
        background: rgba(38, 26, 16, 0.08);
      }

      .mm-selected-display {
        min-height: 92px;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 14px;
        align-items: center;
        padding: 0 0 18px;
        border-bottom: 1px solid rgba(117, 86, 56, 0.26);
      }

      .mm-empty-selection {
        grid-column: 1 / -1;
        margin: 0;
        color: rgba(36, 26, 18, 0.62);
        font-size: 16px;
      }

      .mm-leader-portrait {
        width: 64px;
        height: 78px;
        border-radius: 8px;
        object-fit: cover;
        border: 1px solid rgba(117, 86, 56, 0.38);
        background: rgba(62, 45, 27, 0.2);
        color: rgba(36, 26, 18, 0.58);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
      }

      .mm-selected-copy {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 4px 10px;
        align-items: center;
        min-width: 0;
      }

      .mm-selected-copy strong {
        font-size: 26px;
        line-height: 1.1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .mm-selected-copy span:last-child {
        grid-column: 1 / -1;
        color: rgba(36, 26, 18, 0.72);
        font-size: 15px;
      }

      .mm-field-label {
        margin: 16px 0 7px;
      }

      .mm-select {
        width: 100%;
        padding: 11px 12px;
        color: #261a10;
        background: rgba(255, 252, 244, 0.88);
        border: 1px solid rgba(117, 86, 56, 0.42);
        border-radius: 8px;
        font-family: inherit;
        font-size: 16px;
        cursor: pointer;
      }

      .mm-select:focus {
        outline: 2px solid rgba(176, 101, 24, 0.38);
        outline-offset: 2px;
      }

      .mm-opponent-summary {
        margin-top: 4px;
      }

      .mm-opponent-summary strong {
        display: block;
        color: #1f160f;
        font-size: 24px;
        line-height: 1.1;
      }

      .mm-opponent-summary p {
        margin: 6px 0 0;
        color: rgba(36, 26, 18, 0.65);
        font-size: 14px;
        line-height: 1.25;
      }

      .mm-opponent-list {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        align-content: start;
        min-height: 0;
        overflow: auto;
        margin-top: 13px;
        padding-right: 2px;
      }

      .mm-opponent-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        max-width: 100%;
        padding: 5px 8px;
        border-radius: 8px;
        color: #2b2017;
        background: rgba(255, 252, 243, 0.66);
        border: 1px solid rgba(117, 86, 56, 0.24);
        font-size: 13px;
      }

      .mm-audio-group {
        margin-top: 14px;
        padding: 10px 12px;
        border: 1px solid rgba(117, 86, 56, 0.24);
        border-radius: 8px;
        background: rgba(255, 252, 244, 0.58);
        display: grid;
        gap: 8px;
      }

      .mm-audio-toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        color: #2b2017;
        cursor: pointer;
        user-select: none;
      }

      .mm-audio-toggle input[type="checkbox"] {
        width: 16px;
        height: 16px;
        accent-color: #a75d17;
        cursor: pointer;
      }

      .mm-volume-row {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 8px;
      }

      .mm-audio-sublabel {
        font-size: 13px;
        color: rgba(36, 26, 18, 0.7);
      }

      .mm-audio-slider {
        width: 100%;
        accent-color: #a75d17;
        cursor: pointer;
      }

      .mm-audio-slider:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .mm-audio-value {
        font-size: 13px;
        color: rgba(36, 26, 18, 0.72);
        min-width: 34px;
        text-align: right;
      }

      .mm-change-nation-btn {
        margin-top: auto;
        padding: 10px 12px;
        color: #6d4215;
        background: transparent;
        border: 1px solid rgba(117, 86, 56, 0.36);
        border-radius: 8px;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
      }

      .mm-change-nation-btn:disabled {
        opacity: 0.42;
        cursor: not-allowed;
      }

      .mm-change-nation-btn:hover:not(:disabled) {
        background: rgba(255, 247, 225, 0.72);
        border-color: rgba(176, 101, 24, 0.68);
      }

      .mm-actions {
        display: grid;
        grid-template-columns: minmax(280px, 420px) 170px 170px;
        gap: 14px;
        justify-content: center;
        align-items: center;
      }

      .mm-start-btn,
      .mm-load-btn,
      .mm-editor-btn {
        border-radius: 8px;
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.14s ease, background 0.14s ease, border-color 0.14s ease, opacity 0.14s ease;
      }

      .mm-start-btn {
        min-height: 58px;
        color: #fff7e7;
        background: linear-gradient(180deg, #c27821, #9a5415);
        border: 1px solid rgba(84, 45, 15, 0.38);
        box-shadow: 0 14px 30px rgba(78, 43, 16, 0.22);
        font-size: 23px;
      }

      .mm-start-btn:hover:not(:disabled),
      .mm-load-btn:hover,
      .mm-editor-btn:hover {
        transform: translateY(-1px);
      }

      .mm-start-btn:disabled {
        opacity: 0.46;
        cursor: not-allowed;
      }

      .mm-load-btn,
      .mm-editor-btn {
        min-height: 48px;
        color: #5f3c16;
        background: rgba(255, 252, 244, 0.74);
        border: 1px solid rgba(117, 86, 56, 0.38);
        font-size: 17px;
      }

      .mm-load-btn:hover,
      .mm-editor-btn:hover {
        background: rgba(255, 248, 229, 0.9);
        border-color: rgba(176, 101, 24, 0.7);
      }

      @media (max-width: 1180px) {
        .mm-container {
          width: calc(100vw - 24px);
          height: calc(100vh - 24px);
          margin: 12px;
          padding: 16px 18px 18px;
        }

        .mm-title {
          font-size: 52px;
        }

        .mm-subtitle {
          font-size: 18px;
        }

        .mm-main {
          grid-template-columns: minmax(0, 1fr) minmax(280px, 0.42fr);
        }
      }

      @media (max-width: 900px) {
        #main-menu-overlay {
          overflow: auto;
        }

        .mm-container {
          height: auto;
          min-height: calc(100vh - 24px);
          grid-template-rows: auto;
          overflow: visible;
        }

        .mm-title {
          font-size: 42px;
        }

        .mm-subtitle {
          font-size: 16px;
        }

        .mm-victory-row,
        .mm-main,
        .mm-actions {
          grid-template-columns: 1fr;
        }

        .mm-status {
          text-align: left;
          white-space: normal;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

function toResourceAbundance(value: string): ResourceAbundance {
  if (value === 'scarce' || value === 'abundant') return value;
  return 'normal';
}
