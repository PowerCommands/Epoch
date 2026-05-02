import type { AIGoal } from '../../../types/ai/AIGoal';
import type { AIProductionCandidate } from '../AIProductionScoring';

export interface ProductionWeights {
  settler: number;
  military: number;
  economy: number;
  navy: number;
}

export type ProductionGoalCategory = keyof ProductionWeights;

export function getProductionWeights(goals: AIGoal[] | undefined): ProductionWeights {
  const weights: ProductionWeights = {
    settler: 1,
    military: 1,
    economy: 1,
    navy: 1,
  };

  if (!goals || goals.length === 0) return weights;

  for (const goal of goals) {
    switch (goal.type) {
      case 'expand':
        weights.settler += 2 * goal.priority;
        break;

      case 'build_economy':
        weights.economy += 2 * goal.priority;
        break;

      case 'prepare_war':
        weights.military += 2 * goal.priority;
        break;

      case 'defend':
        weights.military += 1.5 * goal.priority;
        break;

      case 'build_navy':
        weights.navy += 2 * goal.priority;
        break;

      case 'recover_happiness':
        weights.economy += 1.5 * goal.priority;
        break;
    }
  }

  return weights;
}

/**
 * Maps an existing production candidate onto a goal-weight category. Reuses
 * the candidate's existing category and inspects the producible to detect
 * naval units — no new unit types are introduced.
 */
export function getCandidateGoalCategory(candidate: AIProductionCandidate): ProductionGoalCategory {
  if (candidate.category === 'settler') return 'settler';
  if (candidate.category === 'military') {
    if (candidate.item.kind === 'unit' && candidate.item.unitType.isNaval === true) {
      return 'navy';
    }
    return 'military';
  }
  return 'economy';
}

/**
 * Returns a new candidate list whose baseScores are biased by goal weights.
 * Existing scoring (strategy weights, baseScore values, ordering) is left
 * untouched — this is purely a multiplicative layer on top.
 */
export function applyGoalWeights(
  candidates: readonly AIProductionCandidate[],
  weights: ProductionWeights,
): AIProductionCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    baseScore: candidate.baseScore * weights[getCandidateGoalCategory(candidate)],
  }));
}
