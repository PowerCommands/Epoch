import type { SavedGuideProgress } from '../types/saveGame';

export const GUIDE_TURN_INTERVAL = 6;

/**
 * Owns only the deterministic automatic-guide cursor. Presentation keeps its
 * own viewed tip/page cursor, so manual browsing can never change progression.
 */
export class GuideProgression {
  private nextAutomaticTipIndex: number;
  private completedHumanTurns: number;

  private constructor(
    private readonly tipCount: number,
    state: SavedGuideProgress,
  ) {
    this.nextAutomaticTipIndex = clampWhole(state.nextAutomaticTipIndex, 0, tipCount);
    this.completedHumanTurns = Math.max(0, Math.floor(state.completedHumanTurns));
  }

  static forNewGame(tipCount: number): GuideProgression {
    return new GuideProgression(tipCount, {
      nextAutomaticTipIndex: 0,
      completedHumanTurns: 0,
    });
  }

  static fromSave(
    tipCount: number,
    saved: SavedGuideProgress | undefined,
    currentRound: number,
  ): GuideProgression {
    if (isValidSavedGuideProgress(saved)) {
      return new GuideProgression(tipCount, saved);
    }

    // Pre-feature saves have no guide cursor. Treat their current round as
    // already accounted for, skipping historical tips and waiting for a future
    // six-turn boundary rather than replaying a tip immediately on load.
    const completedHumanTurns = Math.max(0, Math.floor(currentRound));
    return new GuideProgression(tipCount, {
      completedHumanTurns,
      nextAutomaticTipIndex: Math.min(
        tipCount,
        Math.floor(completedHumanTurns / GUIDE_TURN_INTERVAL),
      ),
    });
  }

  /**
   * Record one completed human turn. Returns the zero-based tip due at this
   * boundary, or null. The cursor advances even when the caller suppresses UI
   * (Settings/autoplay), preventing a backlog of obsolete popups.
   */
  completeHumanTurn(): number | null {
    this.completedHumanTurns += 1;
    if (this.completedHumanTurns % GUIDE_TURN_INTERVAL !== 0) return null;
    return this.takeNextAutomaticTip();
  }

  private takeNextAutomaticTip(): number | null {
    if (this.nextAutomaticTipIndex >= this.tipCount) return null;

    const dueTipIndex = this.nextAutomaticTipIndex;
    this.nextAutomaticTipIndex += 1;
    return dueTipIndex;
  }

  getState(): SavedGuideProgress {
    return {
      nextAutomaticTipIndex: this.nextAutomaticTipIndex,
      completedHumanTurns: this.completedHumanTurns,
    };
  }
}

function isValidSavedGuideProgress(value: SavedGuideProgress | undefined): value is SavedGuideProgress {
  return value !== undefined
    && Number.isFinite(value.nextAutomaticTipIndex)
    && Number.isFinite(value.completedHumanTurns)
    && value.nextAutomaticTipIndex >= 0
    && value.completedHumanTurns >= 0;
}

function clampWhole(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}
