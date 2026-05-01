import type { SavedGameState } from './saveGame';
import type { GameSpeedId } from '../data/gameSpeeds';

export type ResourceAbundance = 'scarce' | 'normal' | 'abundant';

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
   * When present, {@link GameScene} applies this snapshot after its
   * normal scenario-based initialization, yielding a fully-restored
   * running session. Populated by the Load Game flow.
   */
  savedState?: SavedGameState;
}
