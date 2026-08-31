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

/**
 * AI-only minimum interval (in turns since the nation last founded a city)
 * before normal expansion may initiate another Settler. The capital earns a
 * longer head start than later cities. Expedition-driven settlement is exempt
 * and never routes through this check.
 */
export const CAPITAL_EXPANSION_SETTLER_COOLDOWN_TURNS = 20;
export const SUBSEQUENT_EXPANSION_SETTLER_COOLDOWN_TURNS = 10;

export interface NormalExpansionCooldownInput {
  /** Turn the nation most recently founded a city; undefined if never. */
  readonly lastCityFoundedTurn: number | undefined;
  /** Nation's current city count (decides the 20- vs 10-turn interval). */
  readonly cityCount: number;
  /** Current game turn/round. */
  readonly currentTurn: number;
}

/**
 * Pure decision for the AI normal-expansion Settler cooldown. A nation that has
 * never founded a city in-game (e.g. scenario pre-placed) is never on cooldown.
 * At one city (capital only) the interval is 20 turns; at two or more it is 10.
 */
export function isNormalExpansionSettlerOnCooldown(input: NormalExpansionCooldownInput): boolean {
  if (input.lastCityFoundedTurn === undefined) return false;

  const cooldownTurns = input.cityCount <= 1
    ? CAPITAL_EXPANSION_SETTLER_COOLDOWN_TURNS
    : SUBSEQUENT_EXPANSION_SETTLER_COOLDOWN_TURNS;

  return input.currentTurn - input.lastCityFoundedTurn < cooldownTurns;
}
