import type { Producible } from '../../types/producible';
import type { AIStrategy } from '../../types/aiStrategy';
import type { AILeaderEraStrategy } from '../../types/aiLeaderEraStrategy';

// Strategy weights shape AI production preference without changing
// production rules. Categories map directly to AIStrategy.production weights.
export type AIProductionCategory =
  | 'settler'
  | 'scout'
  | 'military'
  | 'foodBuilding'
  | 'productionBuilding'
  | 'goldBuilding'
  | 'happinessBuilding'
  | 'wonder'
  | 'worker'
  | 'workBoat';

export interface AIProductionCandidate {
  readonly item: Producible;
  readonly baseScore: number;
  readonly category: AIProductionCategory;
}

export function scoreAIProductionCandidate(
  candidate: AIProductionCandidate,
  strategy: AIStrategy,
  eraStrategy?: AILeaderEraStrategy,
): number {
  const weight = getProductionWeight(candidate.category, strategy);
  const eraWeight = getEraProductionMultiplier(candidate, eraStrategy);
  return candidate.baseScore * weight * eraWeight;
}

function getProductionWeight(
  category: AIProductionCategory,
  strategy: AIStrategy,
): number {
  switch (category) {
    case 'settler':
      return strategy.production.settlerWeight;
    case 'scout':
    case 'worker':
    case 'workBoat':
      return 1;
    case 'military':
      return strategy.production.militaryWeight;
    case 'foodBuilding':
    case 'happinessBuilding':
      return strategy.production.foodBuildingWeight;
    case 'productionBuilding':
      return strategy.production.productionBuildingWeight;
    case 'goldBuilding':
      return strategy.production.goldBuildingWeight;
    case 'wonder':
      return 1;
  }
}

function getEraProductionMultiplier(
  candidate: AIProductionCandidate,
  eraStrategy: AILeaderEraStrategy | undefined,
): number {
  if (!eraStrategy) return 1;
  const weights = eraStrategy.productionWeights;

  switch (candidate.category) {
    case 'settler':
      return weights.settler;
    case 'scout':
      return weights.scout;
    case 'foodBuilding':
      return weights.foodBuilding;
    case 'productionBuilding':
      return weights.productionBuilding;
    case 'goldBuilding':
      return weights.goldBuilding;
    case 'happinessBuilding':
      return weights.happinessBuilding;
    case 'wonder':
      return weights.wonder;
    case 'worker':
      return weights.worker ?? 1;
    case 'workBoat':
      return weights.workBoat ?? 1;
    case 'military': {
      const subWeight = getMilitarySubweight(candidate, weights);
      return weights.military * subWeight;
    }
  }
}

function getMilitarySubweight(
  candidate: AIProductionCandidate,
  weights: AILeaderEraStrategy['productionWeights'],
): number {
  if (candidate.item.kind !== 'unit') return 1;
  const unitCategory = candidate.item.unitType.category;
  const isNaval = candidate.item.unitType.isNaval === true;
  if (isNaval) return weights.naval;
  if (unitCategory === 'ranged' || unitCategory === 'naval_ranged') return weights.ranged;
  if (unitCategory === 'melee' || unitCategory === 'mounted' || unitCategory === 'siege') {
    return weights.melee;
  }
  return 1;
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
  eraStrategy?: AILeaderEraStrategy,
): AIProductionCandidate | undefined {
  if (candidates.length === 0) return undefined;

  let best: AIProductionCandidate | undefined;
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    const score = scoreAIProductionCandidate(candidate, strategy, eraStrategy);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  if (!best || bestScore <= 0) return candidates[0];
  return best;
}
