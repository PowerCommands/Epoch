export interface AILeaderPersonality {
  readonly aggressionBias: number;
  readonly expansionBias: number;
  readonly economyBias: number;
  readonly cultureBias: number;
  readonly diplomacyBias: number;
  readonly warTolerance: number;
  readonly peacePreference: number;
  /** Minimum own military units lost in a war before this leader will consider suing for peace. */
  readonly minimumUnitsLostBeforePeace: number;
  /** Fraction of war-start military strength that must be lost before peace is considered (0–1). */
  readonly casualtyToleranceRatio: number;
  /**
   * How strongly this leader values acquiring the right to economically exploit
   * another nation's territory (Foreign Resource Exploitation Rights). Purely a
   * personality trait on the 0–4 scale below — never computed from the map,
   * resources, workers, distance, or expected economic return.
   *
   *   0 = no interest   1 = low   2 = normal   3 = high   4 = very high
   *
   * Optional so unrelated personality literals (tests/scenarios) need not set it;
   * canonical leaders all declare an explicit value. Resolve through
   * {@link resolveExploitationInterest} so an unset value falls back to a
   * conservative default rather than being treated as 0.
   */
  readonly resourceExploitationInterest?: ExploitationInterestLevel;
}

/** The 0–4 exploitation-interest scale. */
export type ExploitationInterestLevel = 0 | 1 | 2 | 3 | 4;

/** Conservative fallback for nations without a leader-declared interest. */
export const DEFAULT_EXPLOITATION_INTEREST: ExploitationInterestLevel = 1;

/** Normalize any interest value to a valid level, applying the default when unset. */
export function resolveExploitationInterest(interest: number | undefined): ExploitationInterestLevel {
  if (interest === undefined) return DEFAULT_EXPLOITATION_INTEREST;
  const clamped = Math.max(0, Math.min(4, Math.round(interest)));
  return clamped as ExploitationInterestLevel;
}

export const DEFAULT_AI_LEADER_PERSONALITY: AILeaderPersonality = {
  aggressionBias: 0,
  expansionBias: 0,
  economyBias: 0,
  cultureBias: 0,
  diplomacyBias: 0,
  warTolerance: 50,
  peacePreference: 50,
  minimumUnitsLostBeforePeace: 3,
  casualtyToleranceRatio: 0.40,
  resourceExploitationInterest: DEFAULT_EXPLOITATION_INTEREST,
};
