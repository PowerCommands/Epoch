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
};
