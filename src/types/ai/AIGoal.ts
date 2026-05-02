export type AIGoalType =
  | 'expand'
  | 'consolidate'
  | 'build_economy'
  | 'prepare_war'
  | 'defend'
  | 'build_navy'
  | 'recover_happiness';

export interface AIGoal {
  id: string;
  type: AIGoalType;

  /** Strength/priority (0–1) */
  priority: number;

  /** Turns remaining */
  remainingTurns: number;

  /** Optional metadata for future use */
  data?: Record<string, unknown>;
}
