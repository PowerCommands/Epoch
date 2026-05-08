import type { Producible } from '../../types/producible';
import type { AIStrategy } from '../../types/aiStrategy';
import type { AILeaderEraStrategy } from '../../types/aiLeaderEraStrategy';
import type { CityFocusType } from '../../entities/City';

// Strategy weights shape AI production preference without changing
// production rules. Categories map directly to AIStrategy.production weights.
export type AIProductionCategory =
  | 'settler'
  | 'scout'
  | 'military'
  | 'foodBuilding'
  | 'productionBuilding'
  | 'scienceBuilding'
  | 'cultureBuilding'
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
  cityFocus: CityFocusType = 'balanced',
): number {
  const weight = getProductionWeight(candidate.category, strategy);
  const eraWeight = getEraProductionMultiplier(candidate, eraStrategy);
  const focusWeight = getCityFocusProductionMultiplier(candidate, cityFocus);
  return candidate.baseScore * weight * eraWeight * focusWeight;
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
    case 'scienceBuilding':
      return 1;
    case 'cultureBuilding':
      return strategy.production.cultureBuildingWeight ?? 1;
    case 'goldBuilding':
      return strategy.production.goldBuildingWeight;
    case 'wonder':
      return strategy.production.wonderWeight ?? 1;
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
    case 'scienceBuilding':
      return weights.scienceBuilding ?? 1;
    case 'cultureBuilding':
      return weights.cultureBuilding ?? 1;
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

function getCityFocusProductionMultiplier(
  candidate: AIProductionCandidate,
  cityFocus: CityFocusType,
): number {
  switch (cityFocus) {
    case 'balanced':
      return 1;
    case 'cultural':
      return getCulturalFocusMultiplier(candidate);
    case 'military':
      return getMilitaryFocusMultiplier(candidate);
    case 'economic':
      return getEconomicFocusMultiplier(candidate);
    case 'naval':
      return getNavalFocusMultiplier(candidate);
    case 'scientific':
      return getScientificFocusMultiplier(candidate);
  }
}

function getCulturalFocusMultiplier(candidate: AIProductionCandidate): number {
  switch (candidate.category) {
    case 'cultureBuilding':
      return 2.5;
    case 'wonder':
      return 3;
    case 'happinessBuilding':
      return 1.15;
    case 'military':
      return 0.55;
    case 'worker':
      return 0.7;
    case 'workBoat':
      return 0.25;
    case 'goldBuilding':
      return 0.8;
    default:
      return 1;
  }
}

function getMilitaryFocusMultiplier(candidate: AIProductionCandidate): number {
  switch (candidate.category) {
    case 'military':
      return candidate.item.kind === 'unit' && candidate.item.unitType.isNaval === true ? 1.05 : 1.7;
    case 'productionBuilding':
      return 1.35;
    case 'worker':
      return 1.1;
    case 'wonder':
      return 0.75;
    case 'cultureBuilding':
      return 0.85;
    default:
      return 1;
  }
}

function getEconomicFocusMultiplier(candidate: AIProductionCandidate): number {
  switch (candidate.category) {
    case 'goldBuilding':
      return 1.8;
    case 'productionBuilding':
      return 1.15;
    case 'worker':
      return 1.1;
    case 'wonder':
      return 0.85;
    case 'military':
      return 0.85;
    default:
      return 1;
  }
}

function getNavalFocusMultiplier(candidate: AIProductionCandidate): number {
  if (candidate.item.kind === 'unit' && candidate.item.unitType.isNaval === true) return 1.8;
  if (candidate.item.kind === 'building' && isNavalInfrastructure(candidate.item.buildingType.id)) return 1.7;
  switch (candidate.category) {
    case 'workBoat':
      return 1.8;
    case 'goldBuilding':
    case 'productionBuilding':
      return 1.15;
    case 'military':
      return 0.9;
    case 'wonder':
      return 0.85;
    default:
      return 1;
  }
}

function getScientificFocusMultiplier(candidate: AIProductionCandidate): number {
  switch (candidate.category) {
    case 'scienceBuilding':
      return 2;
    case 'productionBuilding':
      return 1.15;
    case 'cultureBuilding':
      return 0.9;
    case 'wonder':
      return 0.9;
    default:
      return 1;
  }
}

function isNavalInfrastructure(buildingId: string): boolean {
  return /harbor|lighthouse|sea[_ -]?port/i.test(buildingId);
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
  cityFocus: CityFocusType = 'balanced',
): AIProductionCandidate | undefined {
  if (candidates.length === 0) return undefined;

  let best: AIProductionCandidate | undefined;
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    const score = scoreAIProductionCandidate(candidate, strategy, eraStrategy, cityFocus);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  if (!best || bestScore <= 0) return candidates[0];
  return best;
}
