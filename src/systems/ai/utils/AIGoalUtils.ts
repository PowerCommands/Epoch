import type { AIGoal } from '../../../types/ai/AIGoal';

export function createGoal(
  type: AIGoal['type'],
  priority: number,
  turns: number,
  data?: Record<string, unknown>,
): AIGoal {
  return {
    id: crypto.randomUUID(),
    type,
    priority,
    remainingTurns: turns,
    data,
  };
}

export function tickGoals(goals: AIGoal[]): AIGoal[] {
  return goals
    .map((g) => ({ ...g, remainingTurns: g.remainingTurns - 1 }))
    .filter((g) => g.remainingTurns > 0);
}
