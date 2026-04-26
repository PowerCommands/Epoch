import type { GridCoord } from '../../types/grid';
import type { AIStrategy } from '../../types/aiStrategy';

// Strategy-based movement scoring shapes where AI units want to go,
// while existing pathfinding and movement rules still decide how they move.

export type AIMovementDestinationKind =
  | 'enemyCity'
  | 'enemyUnit'
  | 'ownCity'
  | 'frontline'
  | 'settlerEscort'
  | 'exploration'
  | 'holdPosition';

export interface AIMovementCandidate {
  readonly destination: GridCoord;
  readonly kind: AIMovementDestinationKind;
  readonly distance: number;
  readonly pathCost: number;
  readonly isReachable: boolean;
  readonly isNearOwnCity: boolean;
  readonly isNearEnemyCity: boolean;
  readonly isNearEnemyUnit: boolean;
}

const KIND_BASE_SCORE_AGGRESSION_SCALED: Record<
  Exclude<AIMovementDestinationKind, 'settlerEscort' | 'exploration' | 'holdPosition'>,
  { weight: number; useInverse: boolean }
> = {
  enemyCity: { weight: 80, useInverse: false },
  enemyUnit: { weight: 60, useInverse: false },
  ownCity: { weight: 60, useInverse: true },
  frontline: { weight: 50, useInverse: false },
};

const SETTLER_ESCORT_SCORE = 70;
const EXPLORATION_SCORE = 40;
const HOLD_POSITION_SCORE = 10;

const NEAR_OWN_CITY_BIAS = 20;
const NEAR_ENEMY_CITY_BIAS = 20;
const NEAR_ENEMY_UNIT_BIAS = 15;
const PATH_COST_PENALTY = 4;
const DISTANCE_PENALTY = 2;

export function scoreMovementCandidate(
  candidate: AIMovementCandidate,
  strategy: AIStrategy,
): number {
  if (!candidate.isReachable) return -Infinity;

  const aggression = strategy.military.aggression;
  let score = 0;

  switch (candidate.kind) {
    case 'enemyCity':
    case 'enemyUnit':
    case 'ownCity':
    case 'frontline': {
      const cfg = KIND_BASE_SCORE_AGGRESSION_SCALED[candidate.kind];
      const factor = cfg.useInverse ? (2 - aggression) : aggression;
      score += cfg.weight * factor;
      break;
    }
    case 'settlerEscort':
      score += SETTLER_ESCORT_SCORE;
      break;
    case 'exploration':
      score += EXPLORATION_SCORE;
      break;
    case 'holdPosition':
      score += HOLD_POSITION_SCORE;
      break;
  }

  if (candidate.isNearOwnCity) {
    score += NEAR_OWN_CITY_BIAS * (2 - aggression);
  }
  if (candidate.isNearEnemyCity) {
    score += NEAR_ENEMY_CITY_BIAS * aggression;
  }
  if (candidate.isNearEnemyUnit) {
    score += NEAR_ENEMY_UNIT_BIAS * aggression;
  }

  score -= candidate.pathCost * PATH_COST_PENALTY;
  score -= candidate.distance * DISTANCE_PENALTY;

  return score;
}

/**
 * Returns the highest-scoring movement candidate. Ties resolve by destination
 * coordinate (y, then x) so movement choices stay deterministic across runs.
 */
export function pickBestMovementCandidate(
  candidates: readonly AIMovementCandidate[],
  strategy: AIStrategy,
): AIMovementCandidate | undefined {
  if (candidates.length === 0) return undefined;

  const scored = candidates.map((candidate) => ({
    candidate,
    score: scoreMovementCandidate(candidate, strategy),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.candidate.destination.y !== b.candidate.destination.y) {
      return a.candidate.destination.y - b.candidate.destination.y;
    }
    return a.candidate.destination.x - b.candidate.destination.x;
  });

  if (scored[0].score === -Infinity) return undefined;
  return scored[0].candidate;
}
