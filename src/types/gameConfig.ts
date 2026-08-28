import type { SavedGameState } from './saveGame';
import type { GameSpeedId } from '../data/gameSpeeds';
import type { CovertPersonalityId } from './covertPersonality';
import type { GeneratedScenarioSnapshot } from '../systems/procedural/RandomScenarioTypes';

/**
 * Procedural natural-resource distribution level chosen at setup.
 *
 * `scarce` / `normal` / `abundant` seed resources procedurally at fresh start.
 * `scenario` ("Scenario Only") skips all procedural augmentation and uses
 * exactly the resources already stored in the scenario/map.
 */
export type ResourceAbundance = 'scarce' | 'normal' | 'abundant' | 'scenario';

export interface ScienceVictoryConfig {
  enabled: boolean;
  requiredAerospaceParts: number;
}

export interface ToggleableVictoryConfig {
  enabled: boolean;
}

/** Transient per-nation changes made in the Game Setup Nation Details dialog. */
export interface ScenarioNationCustomization {
  leaderName: string | null;
  leaderDescription: string | null;
  gold: number;
  covertPersonalityId: CovertPersonalityId | null;
  researchedTechIds: string[];
  unlockedCultureNodeIds: string[];
}

export interface VictoryConditionsConfig {
  domination?: Partial<ToggleableVictoryConfig>;
  science?: Partial<ScienceVictoryConfig>;
  cultural?: Partial<ToggleableVictoryConfig>;
  diplomatic?: Partial<ToggleableVictoryConfig>;
}

export interface GameConfig {
  mapKey: string;
  /** Embedded source for a procedurally generated map registered at runtime. */
  generatedScenario?: GeneratedScenarioSnapshot;
  humanNationId: string;
  activeNationIds: string[];
  /** Explicit per-game leader choices; absent entries resolve to nation defaults. */
  leaderSelections?: Record<string, string>;
  /**
   * Transient setup-only identity swaps keyed by scenario slot nation id.
   * The slot id remains the runtime id so cities, units, diplomacy, and saves
   * keep their scenario references; only the nation/leader identity changes.
   */
  scenarioNationReplacements?: Record<string, string>;
  /** Setup-only nation properties, keyed by the original scenario slot id. */
  scenarioNationCustomizations?: Record<string, ScenarioNationCustomization>;
  resourceAbundance: ResourceAbundance;
  gameSpeedId: GameSpeedId;
  autofocusOnEndTurn?: boolean;
  earlyGameTurnLimit?: number;
  /**
   * Per-game seed mixed into procedural natural-resource placement so each
   * new game with the same setup produces a different layout. Loaded saves
   * skip resource generation entirely, so the seed is only consulted on
   * fresh starts.
   */
  worldSeed?: string;
  /**
   * When true, all Barbarian Camps are stripped from the scenario at game start,
   * as if the scenario never had any. Set from the "No barbarians" setup option.
   * Loaded saves carry their own map state, so this only affects fresh starts.
   */
  noBarbarians?: boolean;
  /**
   * When present, {@link GameScene} applies this snapshot after its
   * normal scenario-based initialization, yielding a fully-restored
   * running session. Populated by the Load Game flow.
   */
  savedState?: SavedGameState;
  /**
   * Victory condition overrides for the session. Absent fields use
   * VictorySystem defaults (domination, science, cultural, diplomatic all enabled;
   * 10 aerospace parts for science). For loaded saves, GameScene prefers
   * the conditions stored in {@link savedState}.
   */
  victoryConditions?: VictoryConditionsConfig;
}
