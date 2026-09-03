import Phaser from 'phaser';
import { MAP_MANIFEST_CACHE_KEY, parseMapManifest } from '../data/maps';
import type { MapDefinition } from '../data/maps';
import {
  getDefaultLeaderByNationId,
  getLeaderByNationId,
  getLeadersByNationId,
  setActiveLeaderSelections,
  setScenarioLeaderOverrides,
} from '../data/leaders';
import { NATION_DEFINITIONS, getNationDefinitionById } from '../data/nations';
import { getTechnologyById } from '../data/technologies';
import { getCultureNodeById } from '../data/cultureTree';
import type { ScenarioData, ScenarioNation } from '../types/scenario';
import {
  resolveScenarioMeta,
  formatScenarioStartYear,
  formatScenarioTimeProgression,
} from '../data/scenarioMeta';
import { renderScenarioMinimap } from '../ui/ScenarioMinimapRenderer';
import type {
  GameConfig,
  ResourceAbundance,
  ScenarioNationCustomization,
  VictoryConditionsConfig,
} from '../types/gameConfig';
import { DEFAULT_GAME_SPEED_ID, GAME_SPEEDS, getGameSpeedById, type GameSpeedId } from '../data/gameSpeeds';
import { SetupMusicManager } from '../systems/SetupMusicManager';
import { SaveLoadService } from '../systems/SaveLoadService';
import { LATEST_AUTOSAVE_KEY } from '../systems/AutosaveService';
import { computeGameDateFromMeta, formatGameDate } from '../systems/GameDate';
import { TutorialView } from '../ui/TutorialView';
import { WhatsNewDialog } from '../ui/WhatsNewDialog';
import { SettingsDialog } from '../ui/SettingsDialog';
import { NationDetailsDialog } from '../ui/NationDetailsDialog';
import { RandomScenarioDialog, type RandomScenarioDialogConfig } from '../ui/RandomScenarioDialog';
import { RandomScenarioGenerator } from '../systems/procedural/RandomScenarioGenerator';
import {
  RANDOM_MAP_PROFILE_DEFINITIONS,
  type GeneratedRandomScenario,
  type RandomMapType,
} from '../systems/procedural/RandomScenarioTypes';
import type { SavedGameState } from '../types/saveGame';
import { CustomScenarioStorage, type CustomScenarioEntry } from '../services/scenario/CustomScenarioStorage';
import {
  applyScenarioNationReplacement,
  normalizeScenarioNationReplacements,
  type RuntimeScenarioNation,
  type ScenarioNationReplacementMap,
} from '../utils/scenarioNationReplacements';
import {
  RESOURCE_ABUNDANCE_OPTIONS,
  defaultResourceAbundanceForScenario,
} from './setup/resourceAbundanceSetup';

/** Sentinel value for the "Load scenario…" entry in the scenario dropdown. */
const LOAD_SCENARIO_OPTION_VALUE = '__load_scenario__';
const RANDOM_SCENARIO_OPTION_PREFIX = '__random_scenario__:';

interface EpochMainMenuDiagnostics {
  listScenarios: () => Array<{ key: string; label: string; custom: boolean }>;
  startNewGame: (options?: {
    scenario?: string;
    humanNationId?: string;
    activeNationIds?: string[];
    gameSpeedId?: GameSpeedId;
    resourceAbundance?: ResourceAbundance;
    victoryConditions?: VictoryConditionsConfig;
  }) => { ok: true; scenario: string; humanNationId: string; activeNationIds: string[] } | { ok: false; error: string };
  startSavedGame: (savedState: unknown, options?: { victoryConditions?: VictoryConditionsConfig }) => { ok: true; scenario: string; humanNationId: string; activeNationIds: string[]; startingTurn: number; startingYear?: number } | { ok: false; error: string };
}

/**
 * MainMenuScene — HTML/CSS start screen for map, nation, and opponent setup.
 */
export class MainMenuScene extends Phaser.Scene {
  private overlay: HTMLDivElement | null = null;
  private maps: MapDefinition[] = [];
  private customScenarios: CustomScenarioEntry[] = [];
  private currentMapKey = '';
  private nations: ScenarioNation[] = [];
  private scenarioNationReplacements = new Map<string, string>();
  private scenarioNationCustomizations = new Map<string, ScenarioNationCustomization>();
  private leaderSelections = new Map<string, string>();
  private selectedNationId: string | null = null;
  private selectedOpponentIds = new Set<string>();
  private selectedResourceAbundance: ResourceAbundance = 'normal';
  private selectedGameSpeedId: GameSpeedId = DEFAULT_GAME_SPEED_ID;
  /** "No barbarians" setup toggle — strips all Barbarian Camps from the scenario. */
  private noBarbarians = false;
  private latestAutosave: SavedGameState | null = null;
  private enabledVictoryIds = new Set(['domination', 'diplomatic', 'science', 'cultural']);
  private resizeHandler: (() => void) | null = null;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private music: SetupMusicManager | null = null;
  private tutorialView: TutorialView | null = null;
  private whatsNewDialog: WhatsNewDialog | null = null;
  private settingsDialog: SettingsDialog | null = null;
  private randomScenarioDialog: RandomScenarioDialog | null = null;
  private generatedRandomScenario: GeneratedRandomScenario | null = null;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    this.maps = parseMapManifest(this.cache.json.get(MAP_MANIFEST_CACHE_KEY)).maps;
    this.customScenarios = CustomScenarioStorage.loadAll();
    this.latestAutosave = this.readLatestAutosave();
    this.overlay = document.createElement('div');
    this.overlay.id = 'main-menu-overlay';
    this.overlay.innerHTML = this.buildHTML();
    document.body.appendChild(this.overlay);
    void this.loadGameVersion();
    this.injectStyles();
    this.syncOverlayBounds();

    this.resizeHandler = () => this.syncOverlayBounds();
    window.addEventListener('resize', this.resizeHandler);

    // Escape backs out of the Game Setup screen to the landing page. (When the
    // tutorial overlay is open it intercepts Escape first, so it takes priority.)
    this.keydownHandler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const root = this.overlay?.querySelector('.mm-root') as HTMLDivElement | null;
      if (root?.getAttribute('data-screen') === 'setup') {
        event.preventDefault();
        this.showLandingScreen();
      }
    };
    window.addEventListener('keydown', this.keydownHandler);

    this.music = SetupMusicManager.getShared();
    this.music.playPlaylist('start');

    this.wireEvents();
    this.installDiagnosticsHook();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private cleanup(): void {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    // Release the local reference but do NOT dispose — the current nation
    // playlist must keep looping after the scene transitions to GameScene.
    this.music = null;

    this.overlay?.remove();
    this.overlay = null;
    this.tutorialView?.shutdown();
    this.tutorialView = null;
    this.settingsDialog?.shutdown();
    this.settingsDialog = null;
    this.randomScenarioDialog?.shutdown();
    this.randomScenarioDialog = null;
    const style = document.getElementById('main-menu-styles');
    style?.remove();
    const diagnosticsWindow = window as Window & { __epochDiagnostics?: unknown };
    if (isDevBuild()) delete diagnosticsWindow.__epochDiagnostics;
  }

  private openTutorial(): void {
    if (!this.tutorialView) this.tutorialView = new TutorialView();
    this.tutorialView.show();
  }

  private openWhatsNew(): void {
    if (!this.whatsNewDialog) this.whatsNewDialog = new WhatsNewDialog();
    void this.whatsNewDialog.show();
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
    const mapOptions = this.buildMapOptionsHTML();
    const gameSpeedOptions = GAME_SPEEDS
      .map(speed => `<option value="${speed.id}"${speed.id === DEFAULT_GAME_SPEED_ID ? ' selected' : ''}>${speed.name}</option>`)
      .join('');
    const resourceAbundanceOptions = RESOURCE_ABUNDANCE_OPTIONS
      .map(option => `<option value="${option.value}"${option.value === this.selectedResourceAbundance ? ' selected' : ''}>${option.label}</option>`)
      .join('');

    return `
      <div class="mm-root" data-screen="landing">
        <div id="mm-version-label" class="mm-version-label">Version: 1.0.0</div>
        <section class="mm-landing-screen" aria-label="Main menu">
          <header class="mm-header mm-landing-header">
            <h1 class="mm-title">Epochs of Time</h1>
            <p class="mm-subtitle">Lead your people through the ages, from humble beginnings to world dominance.</p>
          </header>

          <nav class="mm-landing-actions" aria-label="Main menu actions">
            <button id="mm-new-game-btn" class="mm-menu-btn primary" type="button">New Game</button>
            <button id="mm-continue-btn" class="mm-menu-btn" type="button"${this.latestAutosave ? '' : ' hidden'}${this.getContinueButtonTitleAttribute()}>Continue</button>
            <button id="mm-load-btn" class="mm-menu-btn" type="button">Load Game</button>
            <button id="mm-tutorial-btn" class="mm-menu-btn" type="button">Tutorial</button>
            <button id="mm-settings-btn" class="mm-menu-btn" type="button">Settings</button>
            <button id="mm-editor-btn" class="mm-menu-btn" type="button">Editor</button>
            <button id="mm-whats-new-btn" class="mm-menu-btn" type="button">What's New</button>
          </nav>
        </section>

        <div class="mm-container mm-setup-screen" aria-label="Game setup">
        <header class="mm-header">
          <h1 class="mm-title">Epochs of Time</h1>
          <p class="mm-subtitle">Lead your people through the ages, from humble beginnings to world dominance.</p>
        </header>

        <section class="mm-victory-row" aria-label="Victory conditions">
          <button class="mm-victory-card active" type="button" data-victory="domination">
            <span class="mm-victory-check" aria-hidden="true"></span>
            <span class="mm-victory-title">Domination</span>
            <span class="mm-victory-copy">Control enough land or vassalize enough rivals.</span>
          </button>
          <button class="mm-victory-card active" type="button" data-victory="diplomatic">
            <span class="mm-victory-check" aria-hidden="true"></span>
            <span class="mm-victory-title">Diplomatic</span>
            <span class="mm-victory-copy">Earn global influence.</span>
          </button>
          <button class="mm-victory-card active" type="button" data-victory="science">
            <span class="mm-victory-check" aria-hidden="true"></span>
            <span class="mm-victory-title">Science</span>
            <span class="mm-victory-copy">Win space race</span>
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

            <label class="mm-field-label" for="mm-map-select">Scenario</label>
            <select id="mm-map-select" class="mm-select">
              ${mapOptions}
            </select>
            <input id="mm-scenario-input" type="file" accept="application/json,.json" hidden>

            <label class="mm-field-label" for="mm-resource-abundance-select">Resource Abundance</label>
            <select id="mm-resource-abundance-select" class="mm-select">
              ${resourceAbundanceOptions}
            </select>

            <label class="mm-field-label" for="mm-game-speed-select">Game Speed</label>
            <select id="mm-game-speed-select" class="mm-select">
              ${gameSpeedOptions}
            </select>

            <label class="mm-no-barbarians" for="mm-no-barbarians-checkbox">
              <input type="checkbox" id="mm-no-barbarians-checkbox"> No barbarians
            </label>

            <div class="mm-opponent-summary">
              <span class="mm-field-label">Opponents</span>
              <strong id="mm-opponent-count">0 enabled</strong>
              <p id="mm-opponent-hint">Choose a nation to prepare the rival field.</p>
            </div>

            <div id="mm-opponent-list" class="mm-opponent-list"></div>

            <button id="mm-change-nation-btn" class="mm-change-nation-btn" type="button" disabled>Change player nation</button>
          </aside>

          <aside class="mm-scenario-panel" aria-label="Scenario details">
            <div class="mm-panel-heading stacked">
              <span class="mm-eyebrow">Scenario</span>
              <h2>Scenario Details</h2>
            </div>
            <div class="mm-scenario-preview">
              <canvas id="mm-scenario-minimap" class="mm-scenario-minimap"></canvas>
              <div id="mm-random-scenario-hidden" class="mm-random-scenario-hidden" hidden></div>
            </div>
            <dl id="mm-scenario-details" class="mm-scenario-details"></dl>
          </aside>
        </main>

        <footer class="mm-actions">
          <button id="mm-start-btn" class="mm-start-btn" type="button" disabled>Start Game</button>
        </footer>
      </div>
      <input id="mm-load-input" type="file" accept="application/json,.json" hidden>
    </div>
    `;
  }

  private async loadGameVersion(): Promise<void> {
    try {
      const response = await fetch('/version.json');
      if (!response.ok) return;

      const version = await response.json() as { game?: unknown };
      if (typeof version.game !== 'string') return;

      const label = this.overlay?.querySelector<HTMLElement>('#mm-version-label');
      if (label) label.textContent = `Version: ${version.game}`;
    } catch {
      // The inline fallback keeps the version visible if the config cannot load.
    }
  }

  private buildMapOptionsHTML(): string {
    const randomOptions = (['continents', 'archipelago', 'heartland'] as const)
      .map((type) => `<option value="${RANDOM_SCENARIO_OPTION_PREFIX}${type}">${RANDOM_MAP_PROFILE_DEFINITIONS[type].name}</option>`)
      .join('');
    const generatedOption = this.generatedRandomScenario
      ? `<option value="${escapeHtmlAttribute(this.generatedRandomScenario.mapKey)}">Randomized — ${RANDOM_MAP_PROFILE_DEFINITIONS[this.generatedRandomScenario.metadata.mapType].name}</option>`
      : '';
    const officialOptions = this.maps
      .map((map, index) => `<option value="${escapeHtmlAttribute(map.key)}"${index === 0 ? ' selected' : ''}>${escapeHtmlText(map.label)}</option>`)
      .join('');
    const customOptions = this.customScenarios
      .map((entry) => {
        const edited = new Date(entry.metadata.updatedAt).toLocaleDateString();
        return `<option class="custom-scenario-option" value="${escapeHtmlAttribute(entry.metadata.id)}">${escapeHtmlText(entry.metadata.name)} (edited ${escapeHtmlText(edited)})</option>`;
      })
      .join('');

    const loadOption = `<option value="${LOAD_SCENARIO_OPTION_VALUE}">Load scenario…</option>`;
    if (!customOptions) {
      return `<optgroup label="Random Scenarios">${generatedOption}${randomOptions}</optgroup><optgroup label="Official Scenarios">${officialOptions}</optgroup>${loadOption}`;
    }
    return `
      <optgroup label="Random Scenarios">${generatedOption}${randomOptions}</optgroup>
      <optgroup label="Official Scenarios">${officialOptions}</optgroup>
      <optgroup label="My Scenarios">${customOptions}</optgroup>
      ${loadOption}
    `;
  }

  private getCustomScenario(mapKey: string): CustomScenarioEntry | undefined {
    return this.customScenarios.find((entry) => entry.metadata.id === mapKey);
  }

  private ensureScenarioCached(mapKey: string): boolean {
    if (this.cache.json.has(mapKey)) return true;
    const customScenario = this.getCustomScenario(mapKey);
    if (!customScenario) return false;
    this.cache.json.add(mapKey, customScenario.scenario);
    return true;
  }

  /** Restore a procedural scenario embedded in a save before normal startup asks for its map key. */
  private ensureSavedScenarioCached(savedState: SavedGameState): boolean {
    if (this.ensureScenarioCached(savedState.mapKey)) return true;
    const embedded = savedState.generatedScenario;
    if (!embedded || embedded.metadata.width !== embedded.scenario.map.width
      || embedded.metadata.height !== embedded.scenario.map.height) return false;
    this.cache.json.add(savedState.mapKey, embedded.scenario);
    return true;
  }

  private installDiagnosticsHook(): void {
    if (!isDevBuild()) return;
    const diagnosticsWindow = window as Window & { __epochDiagnostics?: EpochMainMenuDiagnostics };
    diagnosticsWindow.__epochDiagnostics = {
      listScenarios: () => [
        ...this.maps.map((map) => ({ key: map.key, label: map.label, custom: false })),
        ...this.customScenarios.map((entry) => ({
          key: entry.metadata.id,
          label: entry.metadata.name,
          custom: true,
        })),
      ],
      startNewGame: (options = {}) => this.startDiagnosticGame(options),
      startSavedGame: (savedState, options) => this.startDiagnosticSavedGame(savedState, options),
    };
  }

  private startDiagnosticGame(options: {
    scenario?: string;
    humanNationId?: string;
    activeNationIds?: string[];
    gameSpeedId?: GameSpeedId;
    resourceAbundance?: ResourceAbundance;
    victoryConditions?: VictoryConditionsConfig;
  }): { ok: true; scenario: string; humanNationId: string; activeNationIds: string[] } | { ok: false; error: string } {
    const scenarioKey = this.resolveDiagnosticScenarioKey(options.scenario);
    if (!scenarioKey) return { ok: false, error: `Scenario not found: ${options.scenario ?? '(default)'}` };
    if (!this.ensureScenarioCached(scenarioKey)) return { ok: false, error: `Scenario could not be loaded: ${scenarioKey}` };

    const scenario = (this.getCustomScenario(scenarioKey)?.scenario ?? this.cache.json.get(scenarioKey)) as ScenarioData | undefined;
    if (!scenario || scenario.nations.length === 0) return { ok: false, error: `Scenario has no nations: ${scenarioKey}` };

    const humanNationId = options.humanNationId && scenario.nations.some((nation) => nation.id === options.humanNationId)
      ? options.humanNationId
      : scenario.nations[0].id;
    const activeNationIds = (options.activeNationIds?.length
      ? options.activeNationIds.filter((nationId) => scenario.nations.some((nation) => nation.id === nationId))
      : scenario.nations.map((nation) => nation.id));
    const finalActiveNationIds = activeNationIds.includes(humanNationId)
      ? activeNationIds
      : [humanNationId, ...activeNationIds];

    this.cleanup();
    this.scene.start('GameScene', {
      mapKey: scenarioKey,
      humanNationId,
      activeNationIds: finalActiveNationIds,
      // Diagnostic/Autorun new games default to Scenario Mode ('scenario'): only
      // resources explicitly placed in the scenario exist, with no procedural
      // generation or victory-resource guarantee. This matches manually starting
      // the scenario with Scenario Mode selected in Game Setup and keeps
      // resource-balancing runs faithful. An explicit resourceAbundance option
      // still overrides it. Both paths converge on the same GameConfig flag read
      // by initializeWorldNaturalResources, so they cannot silently diverge.
      resourceAbundance: options.resourceAbundance ?? 'scenario',
      gameSpeedId: options.gameSpeedId ?? DEFAULT_GAME_SPEED_ID,
      autofocusOnEndTurn: false,
      worldSeed: generateNewGameSeed(),
      victoryConditions: options.victoryConditions,
    } satisfies GameConfig);

    return { ok: true, scenario: scenarioKey, humanNationId, activeNationIds: finalActiveNationIds };
  }

  private startDiagnosticSavedGame(savedStateInput: unknown, options: {
    victoryConditions?: VictoryConditionsConfig;
  } = {}): { ok: true; scenario: string; humanNationId: string; activeNationIds: string[]; startingTurn: number; startingYear?: number } | { ok: false; error: string } {
    const result = SaveLoadService.validate(savedStateInput);
    if (!result.ok) return { ok: false, error: result.error };

    const savedState = result.state;
    if (!this.ensureSavedScenarioCached(savedState)) {
      return { ok: false, error: `Scenario could not be loaded for save: ${savedState.mapKey}` };
    }

    const sceneSavedState = options.victoryConditions
      ? {
        ...savedState,
        victoryConditions: {
          domination: options.victoryConditions.domination?.enabled ?? false,
          science: options.victoryConditions.science?.enabled ?? false,
          scienceRequiredAerospaceParts: options.victoryConditions.science?.requiredAerospaceParts
            ?? savedState.victoryConditions?.scienceRequiredAerospaceParts,
          cultural: options.victoryConditions.cultural?.enabled ?? false,
          diplomatic: options.victoryConditions.diplomatic?.enabled ?? false,
        },
      }
      : savedState;

    this.cleanup();
    this.scene.start('GameScene', {
      mapKey: sceneSavedState.mapKey,
      humanNationId: sceneSavedState.humanNationId,
      activeNationIds: sceneSavedState.activeNationIds,
      resourceAbundance: 'normal',
      gameSpeedId: sceneSavedState.gameSpeedId ?? DEFAULT_GAME_SPEED_ID,
      autofocusOnEndTurn: false,
      savedState: sceneSavedState,
    } satisfies GameConfig);

    return {
      ok: true,
      scenario: savedState.mapKey,
      humanNationId: savedState.humanNationId,
      activeNationIds: savedState.activeNationIds,
      startingTurn: savedState.turn.currentRound,
      startingYear: savedState.worldYear,
    };
  }

  private resolveDiagnosticScenarioKey(value: string | undefined): string | null {
    if (!value) return this.maps[0]?.key ?? this.customScenarios[0]?.metadata.id ?? null;
    const normalized = value.trim().toLowerCase();
    const custom = this.customScenarios.find((entry) =>
      entry.metadata.id.toLowerCase() === normalized ||
      entry.metadata.name.toLowerCase() === normalized ||
      entry.metadata.name.toLowerCase().includes(normalized)
    );
    if (custom) return custom.metadata.id;
    const official = this.maps.find((map) =>
      map.key.toLowerCase() === normalized ||
      map.key.toLowerCase() === `map_${normalized}` ||
      map.label.toLowerCase() === normalized ||
      map.label.toLowerCase().includes(normalized)
    );
    return official?.key ?? null;
  }

  private wireEvents(): void {
    document.getElementById('mm-new-game-btn')!.addEventListener('click', () => {
      this.showSetupScreen();
    });

    const mapSelect = document.getElementById('mm-map-select') as HTMLSelectElement;
    const scenarioInput = document.getElementById('mm-scenario-input') as HTMLInputElement;
    mapSelect.addEventListener('change', () => {
      if (mapSelect.value === LOAD_SCENARIO_OPTION_VALUE) {
        // Not a real selection — restore the previous one and open the file picker.
        mapSelect.value = this.currentMapKey;
        scenarioInput.value = '';
        scenarioInput.click();
        return;
      }
      if (mapSelect.value.startsWith(RANDOM_SCENARIO_OPTION_PREFIX)) {
        const mapType = mapSelect.value.slice(RANDOM_SCENARIO_OPTION_PREFIX.length) as RandomMapType;
        this.openRandomScenarioDialog(mapType);
        return;
      }
      this.onMapChanged(mapSelect.value);
    });
    scenarioInput.addEventListener('change', () => {
      const file = scenarioInput.files?.[0];
      if (!file) return;
      void this.importScenarioFile(file);
    });
    const resourceAbundanceSelect = document.getElementById('mm-resource-abundance-select') as HTMLSelectElement;
    resourceAbundanceSelect.addEventListener('change', () => {
      this.selectedResourceAbundance = toResourceAbundance(resourceAbundanceSelect.value);
    });
    const gameSpeedSelect = document.getElementById('mm-game-speed-select') as HTMLSelectElement;
    gameSpeedSelect.addEventListener('change', () => {
      this.selectedGameSpeedId = toGameSpeedId(gameSpeedSelect.value);
    });
    const noBarbariansCheckbox = document.getElementById('mm-no-barbarians-checkbox') as HTMLInputElement;
    noBarbariansCheckbox.addEventListener('change', () => {
      this.noBarbarians = noBarbariansCheckbox.checked;
    });
    document.getElementById('mm-settings-btn')!.addEventListener('click', () => {
      this.openSettings();
    });

    document.querySelectorAll<HTMLButtonElement>('[data-victory]').forEach(button => {
      const victoryId = button.dataset.victory;
      if (!victoryId) return;
      if (button.disabled) return;

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
    document.getElementById('mm-continue-btn')!.addEventListener('click', () => {
      this.continueLatestAutosave();
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

    document.getElementById('mm-tutorial-btn')!.addEventListener('click', () => {
      this.openTutorial();
    });

    document.getElementById('mm-whats-new-btn')!.addEventListener('click', () => {
      this.openWhatsNew();
    });

    document.getElementById('mm-editor-btn')!.addEventListener('click', () => {
      const mapKey = this.currentMapKey || this.maps[0]?.key;
      const query = this.getCustomScenario(mapKey)
        ? `?custom=${encodeURIComponent(mapKey)}`
        : mapKey ? `?map=${encodeURIComponent(mapKey)}` : '';
      window.location.href = `/editor.html${query}`;
    });

    document.getElementById('mm-change-nation-btn')!.addEventListener('click', () => {
      this.clearPlayerNation();
    });

    this.onMapChanged(mapSelect.value);
  }

  private openSettings(): void {
    if (!this.settingsDialog) {
      this.settingsDialog = new SettingsDialog({ music: SetupMusicManager.getShared() });
    }
    this.settingsDialog.show();
  }

  private showSetupScreen(): void {
    const root = this.overlay?.querySelector('.mm-root') as HTMLDivElement | null;
    root?.setAttribute('data-screen', 'setup');
  }

  private showLandingScreen(): void {
    const root = this.overlay?.querySelector('.mm-root') as HTMLDivElement | null;
    root?.setAttribute('data-screen', 'landing');
  }

  /** Reset Resource Abundance to the default for the newly selected scenario. */
  private applyDefaultResourceAbundanceForScenario(mapKey: string): void {
    const isRandomScenario = this.generatedRandomScenario?.mapKey === mapKey;
    this.selectedResourceAbundance = defaultResourceAbundanceForScenario(isRandomScenario);
    const select = document.getElementById('mm-resource-abundance-select') as HTMLSelectElement | null;
    if (select) select.value = this.selectedResourceAbundance;
  }

  private onMapChanged(mapKey: string): void {
    this.currentMapKey = mapKey;
    // Fresh default for the newly selected scenario: Random → Normal, authored →
    // Scenario. Applied only here (a genuine scenario-selection point), so a
    // player's explicit change persists until they switch scenarios again.
    this.applyDefaultResourceAbundanceForScenario(mapKey);
    this.selectedNationId = null;
    this.scenarioNationReplacements.clear();
    this.scenarioNationCustomizations.clear();
    this.leaderSelections.clear();
    setActiveLeaderSelections(undefined);

    const customScenario = this.getCustomScenario(mapKey);
    const json = customScenario?.scenario ?? this.cache.json.get(mapKey) as ScenarioData | undefined;
    if (!json) {
      setScenarioLeaderOverrides([]);
      this.nations = [];
      this.selectedOpponentIds = new Set();
      this.renderNationList();
      this.updateSetupPanel();
      this.updateStartButton();
      this.updateScenarioDetails(null);
      return;
    }
    for (const nation of json.nations) {
      const selected = nation.leaderId
        ? getLeadersByNationId(nation.id).find((leader) => leader.id === nation.leaderId)
        : undefined;
      if (selected && !selected.isDefault) this.leaderSelections.set(nation.id, selected.id);
    }
    setActiveLeaderSelections(Object.fromEntries(this.leaderSelections));
    // Keep the menu's leader accessors consistent with the chosen scenario.
    setScenarioLeaderOverrides(this.getRuntimeScenarioNations(json.nations));
    this.nations = json.nations;
    this.selectedOpponentIds = new Set(this.nations.map(n => n.id));

    this.renderNationList();
    this.updateSetupPanel();
    this.updateStartButton();
    this.updateScenarioDetails(json);
    this.music?.playPlaylist('start');
  }

  /** Refresh the read-only Scenario Details widget and its minimap preview. */
  private updateScenarioDetails(scenario: ScenarioData | null): void {
    const preview = document.querySelector<HTMLElement>('.mm-scenario-preview');
    const canvas = document.getElementById('mm-scenario-minimap') as HTMLCanvasElement | null;
    const hiddenState = document.getElementById('mm-random-scenario-hidden');
    const details = document.getElementById('mm-scenario-details');
    if (!preview || !canvas || !hiddenState || !details) return;

    if (!scenario) {
      preview.classList.add('is-empty');
      canvas.hidden = true;
      hiddenState.hidden = true;
      details.innerHTML = '<p class="mm-scenario-empty">Select a scenario to see its details.</p>';
      return;
    }

    const generated = this.generatedRandomScenario?.mapKey === this.currentMapKey
      ? this.generatedRandomScenario
      : null;
    preview.classList.toggle('is-empty', Boolean(generated));
    canvas.hidden = Boolean(generated);
    hiddenState.hidden = !generated;
    if (generated) {
      hiddenState.innerHTML = `<strong>RANDOMIZED</strong><span>${escapeHtmlText(RANDOM_MAP_PROFILE_DEFINITIONS[generated.metadata.mapType].name)}</span><span>${generated.metadata.width} × ${generated.metadata.height}</span>`;
    } else {
      hiddenState.textContent = '';
      renderScenarioMinimap(canvas, scenario);
    }

    const meta = resolveScenarioMeta(scenario.meta);
    const rows: Array<{ label: string; value: string }> = [
      { label: 'Name', value: meta.name },
    ];
    if (meta.author) rows.push({ label: 'Author', value: meta.author });
    if (meta.description) rows.push({ label: 'Description', value: meta.description });
    rows.push({ label: 'Start year', value: formatScenarioStartYear(meta) });
    rows.push({ label: 'Time progression', value: formatScenarioTimeProgression(meta.timeProgression) });
    rows.push({ label: 'Map size', value: `${scenario.map.width} × ${scenario.map.height}` });

    details.innerHTML = rows
      .map((row) => `
        <div class="mm-scenario-detail">
          <dt>${escapeHtmlText(row.label)}</dt>
          <dd>${escapeHtmlText(row.value)}</dd>
        </div>`)
      .join('');
  }

  private renderNationList(): void {
    const container = document.getElementById('mm-nation-list')!;
    const status = document.getElementById('mm-nation-status')!;
    container.innerHTML = '';

    for (const nation of this.nations) {
      const displayNation = this.getRuntimeScenarioNation(nation);
      const replacementNationId = this.scenarioNationReplacements.get(nation.id);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'mm-nation-card';
      card.dataset.nationId = nation.id;

      const isSelectedPlayer = nation.id === this.selectedNationId;
      const isOpponent = this.selectedOpponentIds.has(nation.id);

      if (isSelectedPlayer) card.classList.add('selected-player');
      if (!isSelectedPlayer && isOpponent) card.classList.add('opponent-enabled');
      if (!isSelectedPlayer && !isOpponent) card.classList.add('opponent-disabled');
      if (replacementNationId) card.classList.add('has-replacement');

      const dot = document.createElement('span');
      dot.className = 'mm-nation-dot';
      dot.style.background = displayNation.color;

      const leader = getLeaderByNationId(nation.id);
      const portrait = this.createLeaderPortrait(nation.id, 'mm-card-portrait');
      const copy = document.createElement('span');
      copy.className = 'mm-nation-copy';

      const name = document.createElement('strong');
      name.textContent = displayNation.name;

      const leaderName = document.createElement('span');
      leaderName.className = 'mm-card-leader';
      leaderName.textContent = displayNation.leaderName?.trim() || leader?.name || 'Unknown leader';

      const description = document.createElement('span');
      description.className = 'mm-card-description';
      description.textContent = displayNation.leaderDescription?.trim()
        || leader?.description
        || 'A capable ruler ready to shape the age.';

      const gold = document.createElement('span');
      gold.className = 'mm-card-gold';
      gold.textContent = `💰 ${displayNation.gold ?? 0} starting gold`;

      const replacement = this.createReplacementSummary(nation, displayNation);

      const state = document.createElement('span');
      state.className = 'mm-card-state';
      state.textContent = isSelectedPlayer ? 'Player' : isOpponent ? 'Opponent' : 'Excluded';

      const replaceButton = document.createElement('button');
      replaceButton.type = 'button';
      replaceButton.className = 'mm-replace-btn';
      replaceButton.textContent = 'Replace';
      replaceButton.addEventListener('click', (event) => {
        event.stopPropagation();
        this.openNationReplacementDialog(nation.id);
      });

      const detailsButton = document.createElement('button');
      detailsButton.type = 'button';
      detailsButton.className = 'mm-nation-details-btn';
      detailsButton.textContent = 'Nation details…';
      detailsButton.addEventListener('click', (event) => {
        event.stopPropagation();
        this.openNationDetailsDialog(nation.id);
      });

      const cardActions = document.createElement('span');
      cardActions.className = 'mm-card-actions';
      cardActions.append(detailsButton, replaceButton);

      copy.append(name, replacement, leaderName, description, gold, this.createNationScenarioInfo(nation));
      card.append(portrait, dot, copy, state, cardActions);
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
    this.music?.playPlaylist(this.scenarioNationReplacements.get(nationId) ?? nationId);
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
      const displayNation = this.getRuntimeScenarioNation(selectedNation);
      selectedDisplay.append(
        this.createLeaderPortrait(selectedNation.id, 'mm-leader-portrait'),
        this.createSelectedNationCopy(selectedNation, displayNation, leader?.name ?? 'Unknown leader'),
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
      const displayOpponent = this.getRuntimeScenarioNation(opponent);
      const item = document.createElement('span');
      item.className = 'mm-opponent-chip';

      const dot = document.createElement('span');
      dot.className = 'mm-nation-dot mini';
      dot.style.background = displayOpponent.color;

      const name = document.createElement('span');
      name.textContent = displayOpponent.name;

      item.append(dot, name);
      opponentList.appendChild(item);
    }

  }

  private createSelectedNationCopy(nation: ScenarioNation, displayNation: RuntimeScenarioNation, leaderName: string): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'mm-selected-copy';

    const dot = document.createElement('span');
    dot.className = 'mm-nation-dot';
    dot.style.background = displayNation.color;

    const name = document.createElement('strong');
    name.textContent = displayNation.name;

    const leader = document.createElement('span');
    leader.textContent = `Leader: ${leaderName}`;

    wrapper.append(dot, name, this.createReplacementSummary(nation, displayNation), leader);
    return wrapper;
  }

  private createReplacementSummary(nation: ScenarioNation, displayNation: RuntimeScenarioNation): HTMLElement {
    const summary = document.createElement('span');
    const replacementNationId = this.scenarioNationReplacements.get(nation.id);
    if (!replacementNationId) {
      summary.className = 'mm-replacement-summary empty';
      summary.textContent = '';
      return summary;
    }

    summary.className = 'mm-replacement-summary';
    summary.textContent = `${displayNation.name} replacing ${nation.name}`;
    return summary;
  }

  private createNationScenarioInfo(nation: ScenarioNation): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'mm-card-setup-info';

    const scenario = this.getCurrentScenario();
    if (!scenario) return wrapper;

    const customization = this.scenarioNationCustomizations.get(nation.id);
    const details = scenario.nationDetails?.[nation.id];
    const techIds = uniqueStrings([
      ...(customization?.researchedTechIds ?? details?.researchedTechIds ?? []),
      ...(customization ? [] : nation.researchedTechIds ?? []),
    ]);
    const cultureIds = uniqueStrings([
      ...(customization?.unlockedCultureNodeIds ?? details?.unlockedCultureNodeIds ?? []),
      ...(customization ? [] : nation.unlockedCultureNodeIds ?? []),
    ]);

    const technologyNames = techIds.map((id) => getTechnologyById(id)?.name ?? formatScenarioId(id));
    const cultureNames = cultureIds.map((id) => getCultureNodeById(id)?.name ?? formatScenarioId(id));
    const relationLabels = this.getScenarioRelationLabels(nation.id, scenario);

    const lines = [
      this.createInfoLine('Tech', technologyNames),
      this.createInfoLine('Culture', cultureNames),
      this.createInfoLine('Relations', relationLabels),
    ].filter((line): line is HTMLElement => Boolean(line));

    wrapper.append(...lines);
    return wrapper;
  }

  private createInfoLine(label: string, values: string[]): HTMLElement | null {
    if (values.length === 0) return null;

    const line = document.createElement('span');
    line.className = 'mm-card-info-line';
    const text = `${label}: ${values.join(', ')}`;
    line.textContent = text;
    line.title = text;
    return line;
  }

  private getScenarioRelationLabels(nationId: string, scenario: ScenarioData): string[] {
    return (scenario.initialDiplomacy ?? [])
      .filter((entry) => entry.state === 'WAR' || entry.state === 'ALLIANCE')
      .filter((entry) => entry.nationA === nationId || entry.nationB === nationId)
      .map((entry) => {
        const otherNationId = entry.nationA === nationId ? entry.nationB : entry.nationA;
        const otherNation = this.nations.find((nation) => nation.id === otherNationId)
          ?? scenario.nations.find((nation) => nation.id === otherNationId);
        const state = entry.state === 'WAR' ? 'War' : 'Alliance';
        return `${state}: ${otherNation?.name ?? formatScenarioId(otherNationId)}`;
      });
  }

  private getCurrentScenario(): ScenarioData | null {
    if (!this.currentMapKey) return null;
    return (this.getCustomScenario(this.currentMapKey)?.scenario
      ?? this.cache.json.get(this.currentMapKey) as ScenarioData | undefined)
      ?? null;
  }

  private getRuntimeScenarioNation(nation: ScenarioNation): RuntimeScenarioNation {
    const runtimeNation = applyScenarioNationReplacement(nation, this.scenarioNationReplacements.get(nation.id));
    const customization = this.scenarioNationCustomizations.get(nation.id);
    if (!customization) return runtimeNation;
    const customized = { ...runtimeNation, gold: customization.gold };
    if (customization.leaderName) customized.leaderName = customization.leaderName;
    else delete customized.leaderName;
    if (customization.leaderDescription) customized.leaderDescription = customization.leaderDescription;
    else delete customized.leaderDescription;
    if (customization.covertPersonalityId) customized.covertPersonalityId = customization.covertPersonalityId;
    else delete customized.covertPersonalityId;
    return customized;
  }

  private getRuntimeScenarioNations(nations = this.nations): RuntimeScenarioNation[] {
    return nations.map((nation) => this.getRuntimeScenarioNation(nation));
  }

  private getScenarioNationReplacementConfig(): ScenarioNationReplacementMap | undefined {
    const scenario = this.getCurrentScenario();
    if (!scenario || this.scenarioNationReplacements.size === 0) return undefined;

    const normalized = normalizeScenarioNationReplacements(
      scenario.nations,
      Object.fromEntries(this.scenarioNationReplacements),
    );
    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }

  private openNationDetailsDialog(slotNationId: string): void {
    const scenario = this.getCurrentScenario();
    const slotNation = this.nations.find((nation) => nation.id === slotNationId);
    if (!scenario || !slotNation) return;
    const runtimeNation = this.getRuntimeScenarioNation(slotNation);
    const identityNationId = runtimeNation.replacementNationId ?? slotNation.id;
    NationDetailsDialog.show({
      nation: runtimeNation,
      leaders: getLeadersByNationId(identityNationId),
      selectedLeaderId: getLeaderByNationId(slotNation.id)?.id,
      details: scenario.nationDetails?.[slotNationId],
      customization: this.scenarioNationCustomizations.get(slotNationId),
      onSave: (customization, leaderId) => {
        this.scenarioNationCustomizations.set(slotNationId, customization);
        const defaultLeaderId = getDefaultLeaderByNationId(identityNationId)?.id;
        const scenarioLeaderId = slotNation.leaderId;
        const defaultOverridesScenarioAlternative = leaderId === defaultLeaderId
          && scenarioLeaderId !== undefined
          && scenarioLeaderId !== defaultLeaderId;
        if (leaderId && (leaderId !== defaultLeaderId || defaultOverridesScenarioAlternative)) {
          this.leaderSelections.set(slotNationId, leaderId);
        } else {
          this.leaderSelections.delete(slotNationId);
        }
        setActiveLeaderSelections(Object.fromEntries(this.leaderSelections));
        setScenarioLeaderOverrides(this.getRuntimeScenarioNations());
        this.renderNationList();
        this.updateSetupPanel();
      },
    });
  }

  private openNationReplacementDialog(slotNationId: string): void {
    const scenario = this.getCurrentScenario();
    const slotNation = this.nations.find((nation) => nation.id === slotNationId);
    if (!scenario || !slotNation) return;

    const usedIdentityIds = new Set(this.nations.map((nation) => this.scenarioNationReplacements.get(nation.id) ?? nation.id));
    usedIdentityIds.delete(this.scenarioNationReplacements.get(slotNationId) ?? slotNationId);
    const candidates = NATION_DEFINITIONS
      .filter((nation) => nation.id === slotNation.id || !scenario.nations.some((scenarioNation) => scenarioNation.id === nation.id))
      .filter((nation) => nation.id === slotNation.id || !usedIdentityIds.has(nation.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    const activeReplacementId = this.scenarioNationReplacements.get(slotNationId);
    const overlay = document.createElement('div');
    overlay.className = 'mm-replacement-dialog-backdrop';
    overlay.setAttribute('role', 'presentation');

    const dialog = document.createElement('div');
    dialog.className = 'mm-replacement-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'mm-replacement-dialog-title');

    const title = document.createElement('h2');
    title.id = 'mm-replacement-dialog-title';
    title.textContent = `Replace ${slotNation.name} With`;

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'mm-replacement-close';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', () => overlay.remove());

    const list = document.createElement('div');
    list.className = 'mm-replacement-list';

    for (const candidate of candidates) {
      const leader = getDefaultLeaderByNationId(candidate.id);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mm-replacement-option';
      if (candidate.id === activeReplacementId) button.classList.add('active');
      if (candidate.id === slotNation.id && !activeReplacementId) button.classList.add('active');

      const dot = document.createElement('span');
      dot.className = 'mm-nation-dot';
      dot.style.background = candidate.color;

      const copy = document.createElement('span');
      copy.className = 'mm-replacement-option-copy';
      const name = document.createElement('strong');
      name.textContent = candidate.id === slotNation.id ? `${candidate.name} (restore original)` : candidate.name;
      const leaderName = document.createElement('span');
      leaderName.textContent = leader?.name ?? 'Unknown leader';
      copy.append(name, leaderName);

      button.append(dot, copy);
      button.addEventListener('click', () => {
        this.setNationReplacement(slotNationId, candidate.id === slotNation.id ? null : candidate.id);
        overlay.remove();
      });
      list.appendChild(button);
    }

    dialog.append(title, closeButton, list);
    overlay.appendChild(dialog);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  private setNationReplacement(slotNationId: string, replacementNationId: string | null): void {
    this.leaderSelections.delete(slotNationId);
    setActiveLeaderSelections(Object.fromEntries(this.leaderSelections));
    if (!replacementNationId || replacementNationId === slotNationId) {
      this.scenarioNationReplacements.delete(slotNationId);
    } else if (getNationDefinitionById(replacementNationId)) {
      this.scenarioNationReplacements.set(slotNationId, replacementNationId);
    }

    const scenario = this.getCurrentScenario();
    if (scenario) {
      const normalized = normalizeScenarioNationReplacements(
        scenario.nations,
        Object.fromEntries(this.scenarioNationReplacements),
      );
      this.scenarioNationReplacements = new Map(Object.entries(normalized));
    }

    setScenarioLeaderOverrides(this.getRuntimeScenarioNations());
    this.renderNationList();
    this.updateSetupPanel();
    this.updateStartButton();
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
    if (!this.ensureScenarioCached(this.currentMapKey)) {
      window.alert('Could not load the selected scenario.');
      return;
    }

    const config: GameConfig = {
      mapKey: this.currentMapKey,
      generatedScenario: this.generatedRandomScenario?.mapKey === this.currentMapKey
        ? { metadata: this.generatedRandomScenario.metadata, scenario: this.generatedRandomScenario.scenario }
        : undefined,
      humanNationId: this.selectedNationId,
      activeNationIds: [this.selectedNationId, ...this.getEnabledOpponentIds()],
      leaderSelections: this.leaderSelections.size > 0
        ? Object.fromEntries(this.leaderSelections)
        : undefined,
      scenarioNationReplacements: this.getScenarioNationReplacementConfig(),
      scenarioNationCustomizations: this.scenarioNationCustomizations.size > 0
        ? Object.fromEntries(this.scenarioNationCustomizations)
        : undefined,
      resourceAbundance: this.selectedResourceAbundance,
      gameSpeedId: this.selectedGameSpeedId,
      worldSeed: this.generatedRandomScenario?.mapKey === this.currentMapKey
        ? `generated-world-${this.generatedRandomScenario.metadata.seed}`
        : generateNewGameSeed(),
      noBarbarians: this.noBarbarians,
      victoryConditions: this.buildVictoryConditions(),
    };

    this.cleanup();
    this.scene.start('GameScene', config);
  }

  private openRandomScenarioDialog(mapType: RandomMapType): void {
    if (!this.randomScenarioDialog) {
      this.randomScenarioDialog = new RandomScenarioDialog({
        onGenerate: (config) => this.generateRandomScenario(config),
        onCancel: () => this.restoreCurrentScenarioSelection(),
      });
    }
    this.randomScenarioDialog.show(mapType, NATION_DEFINITIONS);
  }

  private generateRandomScenario(config: RandomScenarioDialogConfig): { ok: true } | { ok: false; error: string } {
    const selectedDefinitions = config.nationIds.map((id) => getNationDefinitionById(id));
    if (selectedDefinitions.some((nation) => !nation)) return { ok: false, error: 'A selected nation is unavailable.' };
    const nations = selectedDefinitions.map((nation): ScenarioNation => ({
      ...nation!,
      isHuman: false,
      startTerritoryCenter: { q: 0, r: 0 },
    }));
    try {
      const generated = RandomScenarioGenerator.generate({
        ...config,
        nations,
      });
      this.generatedRandomScenario = generated;
      this.cache.json.add(generated.mapKey, generated.scenario);
      const mapSelect = document.getElementById('mm-map-select') as HTMLSelectElement | null;
      if (mapSelect) {
        mapSelect.innerHTML = this.buildMapOptionsHTML();
        mapSelect.value = generated.mapKey;
      }
      this.onMapChanged(generated.mapKey);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }

  private restoreCurrentScenarioSelection(): void {
    const mapSelect = document.getElementById('mm-map-select') as HTMLSelectElement | null;
    if (mapSelect) mapSelect.value = this.currentMapKey;
  }

  /**
   * Translate the selected victory checkboxes into the engine config.
   */
  private buildVictoryConditions(): VictoryConditionsConfig {
    return {
      domination: { enabled: this.enabledVictoryIds.has('domination') },
      science: { enabled: this.enabledVictoryIds.has('science') },
      cultural: { enabled: this.enabledVictoryIds.has('cultural') },
      diplomatic: { enabled: this.enabledVictoryIds.has('diplomatic') },
    };
  }

  /**
   * Import a scenario JSON file the user previously downloaded from the editor,
   * persist it as a custom scenario in the browser, and select it. Reuses the
   * same storage path the editor's "Save As My Own Scenario" uses.
   */
  private async importScenarioFile(file: File): Promise<void> {
    let text: string;
    try {
      text = await file.text();
    } catch (err: unknown) {
      window.alert(`Could not read scenario file: ${(err as Error).message}`);
      return;
    }

    const result = CustomScenarioStorage.parseScenario(text);
    if (!result.ok) {
      window.alert(`Could not load scenario: ${result.error}`);
      return;
    }

    const name = result.scenario.meta?.name?.trim() || 'Imported Scenario';
    const saved = CustomScenarioStorage.save({ name, scenario: result.scenario });

    // Refresh the in-memory list + dropdown so the new scenario is selectable.
    this.customScenarios = CustomScenarioStorage.loadAll();
    const mapSelect = document.getElementById('mm-map-select') as HTMLSelectElement | null;
    if (mapSelect) {
      mapSelect.innerHTML = this.buildMapOptionsHTML();
      mapSelect.value = saved.metadata.id;
    }
    this.onMapChanged(saved.metadata.id);
  }

  private loadGame(file: File): void {
    file.text().then((text) => {
      const result = SaveLoadService.parse(text);
      if (!result.ok) {
        window.alert(`Could not load save file: ${result.error}`);
        return;
      }

      const savedState = result.state;
      if (!this.ensureSavedScenarioCached(savedState)) {
        window.alert('Could not load the scenario for this save. The custom scenario may have been deleted.');
        return;
      }
      this.cleanup();
      this.scene.start('GameScene', {
        mapKey: savedState.mapKey,
        humanNationId: savedState.humanNationId,
        activeNationIds: savedState.activeNationIds,
        resourceAbundance: 'normal',
        gameSpeedId: savedState.gameSpeedId ?? DEFAULT_GAME_SPEED_ID,
        savedState,
      } satisfies GameConfig);
    }).catch((err: unknown) => {
      window.alert(`Could not read save file: ${(err as Error).message}`);
    });
  }

  private readLatestAutosave(): SavedGameState | null {
    try {
      const raw = window.localStorage.getItem(LATEST_AUTOSAVE_KEY);
      if (!raw) return null;

      const result = SaveLoadService.parse(raw);
      if (!result.ok) {
        console.warn(`Could not parse latest autosave: ${result.error}`);
        return null;
      }

      return result.state;
    } catch (err: unknown) {
      console.warn(`Could not read latest autosave: ${(err as Error).message}`);
      return null;
    }
  }

  private continueLatestAutosave(): void {
    const savedState = this.latestAutosave ?? this.readLatestAutosave();
    if (!savedState) return;
    if (!this.ensureSavedScenarioCached(savedState)) {
      window.alert('Could not load the scenario for this save. The custom scenario may have been deleted.');
      return;
    }

    this.cleanup();
    this.scene.start('GameScene', {
      mapKey: savedState.mapKey,
      humanNationId: savedState.humanNationId,
      activeNationIds: savedState.activeNationIds,
      resourceAbundance: 'normal',
      gameSpeedId: savedState.gameSpeedId ?? DEFAULT_GAME_SPEED_ID,
      savedState,
    } satisfies GameConfig);
  }

  private getContinueButtonTitleAttribute(): string {
    if (!this.latestAutosave) return '';
    const round = this.latestAutosave.turn.currentRound;
    const gameSpeed = getGameSpeedById(this.latestAutosave.gameSpeedId ?? DEFAULT_GAME_SPEED_ID);
    const mapKey = this.latestAutosave.mapKey;
    // Prefer deriving the date from scenario metadata + round so non-Auto
    // scenarios show the correct date; fall back to the saved worldYear.
    const scenarioMeta = (this.getCustomScenario(mapKey)?.scenario ?? this.cache.json.get(mapKey) as ScenarioData | undefined)?.meta;
    const dateLabel = scenarioMeta
      ? formatGameDate(computeGameDateFromMeta(scenarioMeta, round, gameSpeed.yearProgressionMultiplier))
      : `Year ${this.latestAutosave.worldYear ?? '?'}`;
    const scenarioName = this.maps.find((map) => map.key === mapKey)?.label
      ?? this.customScenarios.find((entry) => entry.metadata.id === mapKey)?.metadata.name
      ?? mapKey;
    const savedAt = new Date(this.latestAutosave.savedAt);
    const savedAtLabel = Number.isNaN(savedAt.getTime())
      ? this.latestAutosave.savedAt
      : savedAt.toLocaleString();
    return ` title="${escapeHtmlAttribute([
      `Round ${round}`,
      dateLabel,
      `Saved ${savedAtLabel}`,
      scenarioName,
    ].join(' - '))}"`;
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
        inset: -5%;
        background-image: url('/assets/background.webp');
        background-size: cover;
        background-position: center;
        transform: scale(1.045) translate3d(-1.8%, -1%, 0);
        animation: mm-background-drift 42s ease-in-out infinite alternate;
        will-change: transform;
      }

      #main-menu-overlay::after {
        content: '';
        position: absolute;
        inset: 0;
        background:
          linear-gradient(90deg, rgba(34, 24, 15, 0.54), rgba(255, 246, 224, 0.3) 45%, rgba(31, 22, 15, 0.52)),
          linear-gradient(180deg, rgba(255, 248, 229, 0.52), rgba(42, 31, 21, 0.36));
        background-size: 120% 100%, 100% 120%;
        background-position: 0% 50%, 50% 0%;
        animation: mm-atmosphere-drift 36s ease-in-out infinite alternate;
        will-change: background-position;
      }

      @keyframes mm-background-drift {
        from {
          transform: scale(1.045) translate3d(-1.8%, -1%, 0);
        }

        to {
          transform: scale(1.085) translate3d(1.8%, 1.1%, 0);
        }
      }

      @keyframes mm-atmosphere-drift {
        from {
          background-position: 0% 50%, 50% 0%;
        }

        to {
          background-position: 100% 50%, 50% 100%;
        }
      }

      .mm-root {
        position: relative;
        z-index: 1;
        width: 100%;
        height: 100%;
      }

      .mm-version-label {
        position: absolute;
        top: 8px;
        right: 10px;
        z-index: 4;
        color: rgba(255, 248, 232, 0.78);
        font-family: monospace;
        font-size: 12px;
        line-height: 1;
        pointer-events: none;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
      }

      .mm-root[data-screen="landing"] .mm-setup-screen,
      .mm-root[data-screen="setup"] .mm-landing-screen {
        display: none;
      }

      .mm-landing-screen {
        width: min(var(--mm-shell-width), calc(100vw - 32px));
        height: calc(100vh - 32px);
        margin-left: max(16px, var(--mm-shell-left));
        margin-top: 16px;
        display: grid;
        grid-template-rows: auto 1fr auto;
        justify-items: center;
        box-sizing: border-box;
        padding: 34px 28px 54px;
      }

      .mm-landing-header {
        padding: 0 18px 14px;
        border-radius: 8px;
        background: linear-gradient(180deg, rgba(255, 245, 219, 0.32), rgba(255, 245, 219, 0));
        text-shadow: 0 2px 18px rgba(255, 244, 214, 0.36);
      }

      .mm-landing-actions {
        align-self: end;
        display: grid;
        gap: 12px;
        width: min(360px, calc(100vw - 54px));
        padding: 14px;
        border: 1px solid rgba(255, 238, 198, 0.24);
        border-radius: 8px;
        background: rgba(32, 24, 17, 0.34);
        box-shadow: 0 18px 44px rgba(21, 15, 10, 0.26);
        backdrop-filter: blur(2px);
      }

      .mm-menu-btn {
        min-height: 54px;
        border-radius: 8px;
        border: 1px solid rgba(255, 238, 201, 0.34);
        color: #fff8e8;
        background: linear-gradient(180deg, rgba(74, 51, 30, 0.84), rgba(41, 29, 19, 0.86));
        font-family: inherit;
        font-size: 21px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 10px 24px rgba(21, 15, 10, 0.22);
        transition: transform 0.14s ease, border-color 0.14s ease, background 0.14s ease;
      }

      .mm-menu-btn.primary {
        min-height: 62px;
        background: linear-gradient(180deg, rgba(206, 129, 43, 0.94), rgba(142, 75, 19, 0.96));
        border-color: rgba(255, 236, 193, 0.48);
        font-size: 24px;
      }

      .mm-menu-btn:hover {
        transform: translateY(-1px);
        border-color: rgba(255, 239, 204, 0.72);
        background: linear-gradient(180deg, rgba(96, 66, 38, 0.9), rgba(49, 34, 22, 0.92));
      }

      .mm-menu-btn.primary:hover {
        background: linear-gradient(180deg, rgba(222, 146, 52, 0.96), rgba(157, 84, 22, 0.98));
      }

      .mm-container {
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

      .mm-victory-card.disabled {
        opacity: 0.4;
        background: rgba(219, 218, 210, 0.5);
        cursor: not-allowed;
        filter: grayscale(0.6);
      }

      .mm-victory-card.disabled:hover {
        transform: none;
        border-color: rgba(116, 82, 44, 0.32);
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
        grid-template-columns: minmax(0, 6fr) minmax(280px, 3fr) minmax(260px, 3fr);
        gap: 18px;
        min-height: 0;
      }

      .mm-nations-panel,
      .mm-setup-panel,
      .mm-scenario-panel {
        min-height: 0;
        background: rgba(248, 245, 235, 0.84);
        border: 1px solid rgba(118, 84, 49, 0.32);
        border-radius: 8px;
        box-shadow: 0 14px 32px rgba(40, 30, 18, 0.12);
      }

      .mm-scenario-panel {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 20px;
        overflow-y: auto;
      }

      .mm-scenario-preview {
        display: flex;
        justify-content: center;
        align-items: center;
        background: rgba(26, 85, 125, 0.12);
        border: 1px solid rgba(118, 84, 49, 0.24);
        border-radius: 6px;
        padding: 8px;
      }

      .mm-scenario-minimap {
        display: block;
        width: 100%;
        max-width: 500px;
        height: auto;
        image-rendering: pixelated;
        border-radius: 3px;
      }

      .mm-scenario-minimap[hidden],
      .mm-random-scenario-hidden[hidden] {
        display: none;
      }

      .mm-scenario-preview.is-empty {
        min-height: 80px;
        color: #7a6a52;
        font-size: 13px;
      }

      .mm-random-scenario-hidden {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 18px;
        color: #6d5a41;
        letter-spacing: 0.05em;
      }

      .mm-random-scenario-hidden strong {
        color: #7f4c15;
        font-size: 18px;
        letter-spacing: 0.14em;
      }

      .mm-scenario-details {
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .mm-scenario-detail {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .mm-scenario-detail dt {
        color: #7f4c15;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0;
      }

      .mm-scenario-detail dd {
        margin: 0;
        color: #1f160f;
        font-size: 14px;
        line-height: 1.4;
        white-space: pre-wrap;
      }

      .mm-scenario-empty {
        color: #7a6a52;
        font-size: 13px;
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
        grid-template-rows: auto auto;
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

      .mm-nation-card.has-replacement {
        border-color: rgba(26, 85, 125, 0.62);
      }

      .mm-card-actions {
        grid-column: 4;
        grid-row: 2;
        align-self: end;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .mm-replace-btn,
      .mm-nation-details-btn {
        padding: 6px 8px;
        color: #6d4215;
        background: rgba(255, 252, 244, 0.8);
        border: 1px solid rgba(117, 86, 56, 0.34);
        border-radius: 8px;
        font-family: inherit;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }

      .mm-replace-btn:hover,
      .mm-nation-details-btn:hover {
        background: rgba(255, 247, 225, 0.94);
        border-color: rgba(176, 101, 24, 0.68);
      }

      .mm-nation-details-btn {
        border-color: rgba(21, 64, 82, 0.72);
        color: #153f52;
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

      .mm-card-gold {
        font-weight: 600;
        color: #8a6a1f !important;
        white-space: nowrap;
      }

      .mm-replacement-summary {
        color: #1a557d !important;
        font-size: 12px !important;
        font-weight: 700;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .mm-replacement-summary.empty {
        display: none;
      }

      .mm-card-setup-info {
        display: grid;
        gap: 2px;
        min-width: 0;
      }

      .mm-card-info-line {
        display: block;
        max-width: 100%;
        color: rgba(38, 26, 16, 0.66) !important;
        font-size: 12px !important;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
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
        grid-column: 4;
        grid-row: 1;
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

      .mm-selected-copy .mm-replacement-summary {
        grid-column: 1 / -1;
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

      .mm-select option.custom-scenario-option {
        font-style: italic;
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

      .mm-option-toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: 12px 0 0;
        color: #2b2017;
        font-size: 14px;
        cursor: pointer;
        user-select: none;
      }

      .mm-option-toggle input[type="checkbox"],
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
        grid-template-columns: minmax(260px, 390px);
        gap: 14px;
        justify-content: center;
        align-items: center;
      }

      .mm-no-barbarians {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 16px;
        padding: 10px 12px;
        color: #261a10;
        font-size: 15px;
        font-weight: 600;
        background: rgba(255, 252, 244, 0.88);
        border: 1px solid rgba(117, 86, 56, 0.42);
        border-radius: 8px;
        cursor: pointer;
        user-select: none;
        transition: border-color 0.15s ease, background 0.15s ease;
      }

      .mm-no-barbarians:hover {
        border-color: rgba(117, 86, 56, 0.7);
        background: rgba(255, 252, 244, 1);
      }

      .mm-no-barbarians input {
        width: 17px;
        height: 17px;
        cursor: pointer;
        accent-color: #7f4c15;
        margin: 0;
      }

      .mm-start-btn {
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

      .mm-start-btn:hover:not(:disabled) {
        transform: translateY(-1px);
      }

      .mm-start-btn:disabled {
        opacity: 0.46;
        cursor: not-allowed;
      }

      .mm-replacement-dialog-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1200;
        display: grid;
        place-items: center;
        padding: 24px;
        background: rgba(22, 15, 10, 0.58);
      }

      .mm-replacement-dialog {
        width: min(540px, calc(100vw - 48px));
        max-height: min(680px, calc(100vh - 48px));
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 14px;
        padding: 20px;
        background: rgba(248, 245, 235, 0.98);
        border: 1px solid rgba(118, 84, 49, 0.42);
        border-radius: 8px;
        box-shadow: 0 24px 60px rgba(20, 13, 8, 0.34);
      }

      .mm-replacement-dialog h2 {
        margin: 0;
        color: #1f160f;
        font-size: 26px;
        line-height: 1.1;
      }

      .mm-replacement-close {
        align-self: start;
        padding: 7px 10px;
        color: #6d4215;
        background: transparent;
        border: 1px solid rgba(117, 86, 56, 0.36);
        border-radius: 8px;
        font-family: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      .mm-replacement-list {
        grid-column: 1 / -1;
        display: grid;
        gap: 8px;
        min-height: 0;
        overflow: auto;
      }

      .mm-replacement-option {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        gap: 10px;
        min-height: 58px;
        padding: 10px 12px;
        text-align: left;
        color: #261a10;
        background: rgba(255, 252, 244, 0.88);
        border: 1px solid rgba(117, 86, 56, 0.34);
        border-radius: 8px;
        font-family: inherit;
        cursor: pointer;
      }

      .mm-replacement-option:hover,
      .mm-replacement-option.active {
        border-color: rgba(176, 101, 24, 0.72);
        background: rgba(255, 247, 225, 0.96);
      }

      .mm-replacement-option-copy {
        display: grid;
        gap: 2px;
        min-width: 0;
      }

      .mm-replacement-option-copy strong,
      .mm-replacement-option-copy span {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .mm-nation-details-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1210;
        display: grid;
        place-items: center;
        padding: 24px;
        background: rgba(0, 0, 0, 0.68);
        font-family: "Courier New", monospace;
      }

      .mm-nation-details-dialog {
        width: min(900px, calc(100vw - 48px));
        max-height: min(800px, calc(100vh - 48px));
        display: flex;
        flex-direction: column;
        overflow: hidden;
        color: #ddd;
        background: #181818;
        border: 1px solid #393939;
        border-radius: 8px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
      }

      .mm-nd-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px;
        background: #202020;
        border-bottom: 1px solid #333;
      }

      .mm-nd-header h2 {
        margin: 0;
        color: #ddd;
        font-size: 15px;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }

      .mm-nd-header-actions { display: flex; gap: 8px; }
      .mm-nd-header button,
      .mm-nd-toolbar button {
        padding: 6px 12px;
        color: #ddd;
        background: #2a2a2a;
        border: 1px solid #555;
        border-radius: 4px;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
      }
      .mm-nd-header button:hover,
      .mm-nd-toolbar button:hover { border-color: #888; background: #333; }
      .mm-nd-header button.primary { border-color: #3a6b48; background: #234a30; color: #cde6d4; }

      .mm-nd-content {
        min-height: 0;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        overflow-y: auto;
      }

      .mm-nd-section { border: 1px solid #2c2c2c; border-radius: 6px; background: #1d1d1d; }
      .mm-nd-section h3 {
        margin: 0;
        padding: 9px 12px;
        color: #aaa;
        border-bottom: 1px solid #2c2c2c;
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .mm-nd-section-body { padding: 10px 12px; }
      .mm-nd-field { display: grid; gap: 5px; margin-bottom: 9px; color: #bbb; font-size: 12px; }
      .mm-nd-field:last-child { margin-bottom: 0; }
      .mm-nd-field input,
      .mm-nd-field textarea,
      .mm-nd-field select {
        box-sizing: border-box;
        width: 100%;
        padding: 7px 8px;
        color: #ddd;
        background: #151515;
        border: 1px solid #444;
        border-radius: 3px;
        font: inherit;
      }
      .mm-nd-field textarea { min-height: 82px; resize: vertical; }
      .mm-nd-leader-preview {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 2px 0 10px;
        padding: 8px;
        background: #151515;
        border: 1px solid #333;
        border-radius: 4px;
      }
      .mm-nd-leader-portrait {
        width: 58px;
        height: 72px;
        flex: 0 0 auto;
        object-fit: cover;
        object-position: top center;
        border: 1px solid #444;
        border-radius: 3px;
      }
      .mm-nd-leader-preview-copy { display: grid; gap: 4px; min-width: 0; }
      .mm-nd-leader-preview-copy strong { color: #eee; font-size: 13px; }
      .mm-nd-leader-preview-copy span { color: #999; font-size: 11px; }
      .mm-nd-toolbar { display: flex; gap: 8px; margin-bottom: 8px; }
      .mm-nd-toolbar button { padding: 4px 8px; font-size: 11px; }
      .mm-nd-count { margin-left: auto; align-self: center; color: #888; font-size: 11px; }
      .mm-nd-era { padding: 4px 0; border-top: 1px solid #292929; }
      .mm-nd-era-title { padding: 4px 0; color: #aaa; cursor: pointer; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; }
      .mm-nd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 14px; padding: 2px 0 6px; }
      .mm-nd-check { display: flex; align-items: center; gap: 6px; color: #ddd; font-size: 11px; line-height: 1.3; }

      @media (max-width: 640px) {
        .mm-nd-grid { grid-template-columns: 1fr; }
        .mm-card-actions { flex-direction: column; align-items: stretch; }
      }

      .mm-replacement-option-copy strong {
        font-size: 17px;
      }

      .mm-replacement-option-copy span {
        color: rgba(36, 26, 18, 0.7);
        font-size: 13px;
      }

      @media (max-width: 1180px) {
        .mm-landing-screen {
          width: calc(100vw - 24px);
          height: calc(100vh - 24px);
          margin: 12px;
          padding: 28px 18px 40px;
        }

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
          grid-template-columns: minmax(0, 1fr) minmax(240px, 0.5fr) minmax(220px, 0.5fr);
        }
      }

      @media (max-width: 900px) {
        #main-menu-overlay {
          overflow: auto;
        }

        .mm-root {
          min-height: 100%;
        }

        .mm-landing-screen {
          min-height: calc(100vh - 24px);
          height: auto;
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
  if (value === 'scarce' || value === 'abundant' || value === 'scenario') return value;
  return 'normal';
}

function toGameSpeedId(value: string): GameSpeedId {
  if (value === 'quick' || value === 'standard' || value === 'epic' || value === 'marathon') return value;
  return DEFAULT_GAME_SPEED_ID;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function formatScenarioId(id: string): string {
  return id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function generateNewGameSeed(): string {
  const cryptoRef = (typeof globalThis !== 'undefined' ? globalThis.crypto : undefined) as
    | { randomUUID?: () => string }
    | undefined;
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
  return `${Date.now()}-${Math.random()}`;
}

function isDevBuild(): boolean {
  if (Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV)) return true;
  if (typeof window === 'undefined') return false;
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocalHost && new URLSearchParams(window.location.search).get('epochDiagnostics') === '1';
}
