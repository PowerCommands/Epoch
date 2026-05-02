import type { Unit } from '../../entities/Unit';
import type { City } from '../../entities/City';
import type { GridCoord } from '../../types/grid';
import type { AIStrategy } from '../../types/aiStrategy';
import type { MilitaryIntent } from './utils/AIMilitaryUtils';

// Strategy-based scoring allows AI to prioritize targets differently
// without changing core combat rules.

export interface AICombatContext {
  readonly attacker: Unit;
  readonly attackerPosition: GridCoord;
  readonly target: Unit | City;
  readonly targetPosition: GridCoord;

  readonly distance: number;
  readonly canAttack: boolean;

  readonly attackerHealthRatio: number;
  readonly targetHealthRatio: number;

  readonly isTargetCity: boolean;
  readonly isTargetUnit: boolean;

  readonly isNearOwnCity: boolean;
}

const BASE_CITY_SCORE = 80;
const BASE_UNIT_SCORE = 50;
const TARGET_WEAKNESS_WEIGHT = 40;
const ATTACKER_WOUND_PENALTY = 50;
const DISTANCE_PENALTY = 5;

const CITY_BIAS_WEIGHT = 20;
const NEAR_OWN_CITY_WEIGHT = 25;
const RISK_TOLERANCE_WEIGHT = 30;
const NEUTRAL_HEALTH_RATIO = 0.5;

const GOAL_CITY_BIAS_WEIGHT = 8;
const GOAL_DEFENSE_BIAS_WEIGHT = 10;

export function scoreCombatTarget(
  context: AICombatContext,
  strategy: AIStrategy,
  intent?: MilitaryIntent,
): number {
  if (!context.canAttack) return -Infinity;

  let score = 0;

  // Base value
  score += context.isTargetCity ? BASE_CITY_SCORE : BASE_UNIT_SCORE;

  // Prefer weaker targets
  score += (1 - context.targetHealthRatio) * TARGET_WEAKNESS_WEIGHT;

  // Avoid attacking when low HP
  score -= (1 - context.attackerHealthRatio) * ATTACKER_WOUND_PENALTY;

  // Distance penalty
  score -= context.distance * DISTANCE_PENALTY;

  // Strategic bias
  score += getStrategyBias(context, strategy);

  // Goal-driven bias (additive layer; pure 1s when no goals are present).
  if (intent) {
    if (context.isTargetCity) {
      score += GOAL_CITY_BIAS_WEIGHT * intent.expansionWar;
    }
    if (context.isNearOwnCity) {
      score += GOAL_DEFENSE_BIAS_WEIGHT * intent.defense;
    }
  }

  return score;
}

function getStrategyBias(
  context: AICombatContext,
  strategy: AIStrategy,
): number {
  const aggression = strategy.military.aggression;

  let bias = 0;

  // Aggressive: prefer cities and longer reach
  if (context.isTargetCity) {
    bias += CITY_BIAS_WEIGHT * aggression;
  }

  // Defensive: prefer targets near own cities
  if (context.isNearOwnCity) {
    bias += NEAR_OWN_CITY_WEIGHT * (2 - aggression);
  }

  // Risk tolerance — bolder when healthy under aggressive strategies.
  bias += (context.attackerHealthRatio - NEUTRAL_HEALTH_RATIO) * RISK_TOLERANCE_WEIGHT * aggression;

  return bias;
}
