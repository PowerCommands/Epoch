export interface AILeaderPersonality {
  readonly aggressionBias: number;
  readonly expansionBias: number;
  readonly economyBias: number;
  readonly cultureBias: number;
  readonly diplomacyBias: number;
  readonly warTolerance: number;
  readonly peacePreference: number;
}

export const DEFAULT_AI_LEADER_PERSONALITY: AILeaderPersonality = {
  aggressionBias: 0,
  expansionBias: 0,
  economyBias: 0,
  cultureBias: 0,
  diplomacyBias: 0,
  warTolerance: 50,
  peacePreference: 50,
};
