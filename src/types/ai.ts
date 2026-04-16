export interface AIBehaviorProfile {
  minAttackHealthRatio: number;
  groupingDistance: number;
  engageDistance: number;
  preferSameContinent: boolean;
  randomnessFactor: number;
}

export const DEFAULT_AI_PROFILE: AIBehaviorProfile = {
  minAttackHealthRatio: 0.6,
  groupingDistance: 2,
  engageDistance: 6,
  preferSameContinent: true,
  randomnessFactor: 0.1,
};
