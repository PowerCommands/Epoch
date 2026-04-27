export interface AIBaselinePriority {
  id: string;
  weight: number;
  phase: 'early' | 'mid' | 'late';
}

export const DEFAULT_AI_EARLY_GAME_TURN_LIMIT = 50;

export const AI_BASELINE_TECH_PRIORITIES: AIBaselinePriority[] = [
  { id: 'writing', weight: 5, phase: 'early' },
];

export const AI_BASELINE_CULTURE_PRIORITIES: AIBaselinePriority[] = [
  { id: 'foreign_trade', weight: 5, phase: 'early' },
];
