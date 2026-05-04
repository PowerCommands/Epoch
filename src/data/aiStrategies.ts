import type { AIStrategy } from '../types/aiStrategy';

export const BASELINE_AI_STRATEGY_ID = 'baseline';
export const BALANCED_AI_STRATEGY_ID = 'balanced';
export const EXPANSIONIST_AI_STRATEGY_ID = 'expansionist';
export const DEFENSIVE_AI_STRATEGY_ID = 'defensive';
export const AGGRESSIVE_AI_STRATEGY_ID = 'aggressive';
export const ECONOMIC_AI_STRATEGY_ID = 'economic';

/**
 * Baseline strategy preserves the legacy hard-coded AI behavior so the
 * refactor stays behavior-neutral. Acts as the global fallback when an
 * unknown id is requested.
 */
export const BASELINE_AI_STRATEGY: AIStrategy = {
  id: BASELINE_AI_STRATEGY_ID,
  name: 'Baseline',

  military: {
    maxUnits: 3,
    minAttackHealthRatio: 0.5,
    engageDistance: 6,
    preferReachableTargets: true,
    randomnessFactor: 0.1,
    aggression: 1.0,
  },

  expansion: {
    desiredCityCount: 3,
    settlerMinCityDistance: 7,
  },

  production: {
    lowNetFoodThreshold: 1,
    lowProductionThreshold: 2,
    settlerWeight: 1,
    militaryWeight: 1,
    foodBuildingWeight: 1,
    productionBuildingWeight: 1,
    goldBuildingWeight: 1,
  },
};

/** Generalist profile — close to baseline with even production weights. */
export const BALANCED_AI_STRATEGY: AIStrategy = {
  id: BALANCED_AI_STRATEGY_ID,
  name: 'Balanced',

  military: {
    maxUnits: 3,
    minAttackHealthRatio: 0.5,
    engageDistance: 8,
    preferReachableTargets: true,
    randomnessFactor: 0.1,
    aggression: 1.0,
  },

  expansion: {
    desiredCityCount: 3,
    settlerMinCityDistance: 8,
  },

  production: {
    lowNetFoodThreshold: 1,
    lowProductionThreshold: 2,
    settlerWeight: 1,
    militaryWeight: 1,
    foodBuildingWeight: 1,
    productionBuildingWeight: 1,
    goldBuildingWeight: 1,
  },
};

/** Wide growth — more cities, tighter spacing, stronger settler push. */
export const EXPANSIONIST_AI_STRATEGY: AIStrategy = {
  id: EXPANSIONIST_AI_STRATEGY_ID,
  name: 'Expansionist',

  military: {
    maxUnits: 3,
    minAttackHealthRatio: 0.55,
    engageDistance: 6,
    preferReachableTargets: true,
    randomnessFactor: 0.1,
    aggression: 1.2,
  },

  expansion: {
    desiredCityCount: 5,
    settlerMinCityDistance: 8,
  },

  production: {
    lowNetFoodThreshold: 1,
    lowProductionThreshold: 2,
    settlerWeight: 2,
    militaryWeight: 0.75,
    foodBuildingWeight: 1.25,
    productionBuildingWeight: 1,
    goldBuildingWeight: 1,
  },
};

/** Turtle profile — bigger garrisons, cautious aggression, short engage range. */
export const DEFENSIVE_AI_STRATEGY: AIStrategy = {
  id: DEFENSIVE_AI_STRATEGY_ID,
  name: 'Defensive',

  military: {
    maxUnits: 5,
    minAttackHealthRatio: 0.7,
    engageDistance: 5,
    preferReachableTargets: true,
    randomnessFactor: 0.05,
    aggression: 0.7,
  },

  expansion: {
    desiredCityCount: 4,
    settlerMinCityDistance: 7,
  },

  production: {
    lowNetFoodThreshold: 1,
    lowProductionThreshold: 2,
    settlerWeight: 0.75,
    militaryWeight: 1.5,
    foodBuildingWeight: 1,
    productionBuildingWeight: 1.25,
    goldBuildingWeight: 1,
  },
};

/** Warmonger — large standing army, low health threshold, far engagement. */
export const AGGRESSIVE_AI_STRATEGY: AIStrategy = {
  id: AGGRESSIVE_AI_STRATEGY_ID,
  name: 'Aggressive',

  military: {
    maxUnits: 6,
    minAttackHealthRatio: 0.35,
    engageDistance: 12,
    preferReachableTargets: true,
    randomnessFactor: 0.2,
    aggression: 1.8,
  },

  expansion: {
    desiredCityCount: 3,
    settlerMinCityDistance: 7,
  },

  production: {
    lowNetFoodThreshold: 1,
    lowProductionThreshold: 2,
    settlerWeight: 0.5,
    militaryWeight: 1.75,
    foodBuildingWeight: 1,
    productionBuildingWeight: 1,
    goldBuildingWeight: 0.75,
  },
};

/** Tall economy — lean army, prioritize gold and production buildings. */
export const ECONOMIC_AI_STRATEGY: AIStrategy = {
  id: ECONOMIC_AI_STRATEGY_ID,
  name: 'Economic',

  military: {
    maxUnits: 2,
    minAttackHealthRatio: 0.6,
    engageDistance: 6,
    preferReachableTargets: true,
    randomnessFactor: 0.1,
    aggression: 0.8,
  },

  expansion: {
    desiredCityCount: 6,
    settlerMinCityDistance: 9,
  },

  production: {
    lowNetFoodThreshold: 1,
    lowProductionThreshold: 2,
    settlerWeight: 0.75,
    militaryWeight: 0.5,
    foodBuildingWeight: 1.25,
    productionBuildingWeight: 1.5,
    goldBuildingWeight: 1.75,
  },
};

export const AI_STRATEGIES: readonly AIStrategy[] = [
  BASELINE_AI_STRATEGY,
  BALANCED_AI_STRATEGY,
  EXPANSIONIST_AI_STRATEGY,
  DEFENSIVE_AI_STRATEGY,
  AGGRESSIVE_AI_STRATEGY,
  ECONOMIC_AI_STRATEGY,
];

export function getAIStrategyById(id: string | undefined): AIStrategy {
  return AI_STRATEGIES.find((strategy) => strategy.id === id) ?? BASELINE_AI_STRATEGY;
}
