import type { Producible } from '../../types/producible';
import type { AIStrategy } from '../../types/aiStrategy';

// Strategy weights shape AI production preference without changing
// production rules. Categories map directly to AIStrategy.production weights.
export type AIProductionCategory =
  | 'settler'
  | 'military'
  | 'foodBuilding'
  | 'productionBuilding'
  | 'goldBuilding';

export interface AIProductionCandidate {
  readonly item: Producible;
  readonly baseScore: number;
  readonly category: AIProductionCategory;
}

export function scoreAIProductionCandidate(
  candidate: AIProductionCandidate,
  strategy: AIStrategy,
): number {
  const weight = getProductionWeight(candidate.category, strategy);
  return candidate.baseScore * weight;
}

function getProductionWeight(
  category: AIProductionCategory,
  strategy: AIStrategy,
): number {
  switch (category) {
    case 'settler':
      return strategy.production.settlerWeight;
    case 'military':
      return strategy.production.militaryWeight;
    case 'foodBuilding':
      return strategy.production.foodBuildingWeight;
    case 'productionBuilding':
      return strategy.production.productionBuildingWeight;
    case 'goldBuilding':
      return strategy.production.goldBuildingWeight;
  }
}

/**
 * Returns the highest-scoring candidate. Ties resolve by list order, so the
 * caller controls priority by ordering candidates from preferred to fallback.
 * If every weighted score is non-positive, returns the first candidate so the
 * AI never stalls on production.
 */
export function pickBestAIProductionCandidate(
  candidates: readonly AIProductionCandidate[],
  strategy: AIStrategy,
): AIProductionCandidate | undefined {
  if (candidates.length === 0) return undefined;

  let best: AIProductionCandidate | undefined;
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    const score = scoreAIProductionCandidate(candidate, strategy);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  if (!best || bestScore <= 0) return candidates[0];
  return best;
}
