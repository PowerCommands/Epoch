import type { SavedGameState } from './saveGame';

export type ResourceAbundance = 'scarce' | 'normal' | 'abundant';

export interface GameConfig {
  mapKey: string;
  humanNationId: string;
  activeNationIds: string[];
  resourceAbundance: ResourceAbundance;
  /**
   * When present, {@link GameScene} applies this snapshot after its
   * normal scenario-based initialization, yielding a fully-restored
   * running session. Populated by the Load Game flow.
   */
  savedState?: SavedGameState;
}
