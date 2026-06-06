import type { SavedGameState } from './saveGame';
import type { GameSpeedId } from '../data/gameSpeeds';

export type ResourceAbundance = 'scarce' | 'normal' | 'abundant';

export interface ScienceVictoryConfig {
  enabled: boolean;
  requiredAerospaceParts: number;
}

export interface ToggleableVictoryConfig {
  enabled: boolean;
}

export interface VictoryConditionsConfig {
  domination?: Partial<ToggleableVictoryConfig>;
  science?: Partial<ScienceVictoryConfig>;
  cultural?: Partial<ToggleableVictoryConfig>;
}

export interface GameConfig {
  mapKey: string;
  humanNationId: string;
  activeNationIds: string[];
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
   * VictorySystem defaults (domination, science, cultural all enabled;
   * 5 aerospace parts for science). For loaded saves, GameScene prefers
   * the conditions stored in {@link savedState}.
   */
  victoryConditions?: VictoryConditionsConfig;
}
