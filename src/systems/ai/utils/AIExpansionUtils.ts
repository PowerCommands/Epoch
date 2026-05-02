import type { AIGoal } from '../../../types/ai/AIGoal';

export function getExpansionBias(goals: AIGoal[] | undefined): number {
  if (!goals) return 1;

  let bias = 1;

  for (const goal of goals) {
    if (goal.type === 'expand') {
      bias += 2 * goal.priority;
    }
  }

  return bias;
}

export function hasGoalOfType(goals: AIGoal[] | undefined, type: AIGoal['type']): boolean {
  return goals?.some((goal) => goal.type === type) ?? false;
}
