import {
  AI_STRATEGY_BEHAVIOR_WEIGHTS,
  BALANCED_BEHAVIOR_WEIGHTS,
} from '../data/aiStrategyBehaviorWeights';
import type { AIStrategyBehaviorWeights } from '../types/aiStrategyBehavior';

export function getBehaviorWeights(strategyId: string | undefined): AIStrategyBehaviorWeights {
  if (strategyId === undefined) return BALANCED_BEHAVIOR_WEIGHTS;
  return AI_STRATEGY_BEHAVIOR_WEIGHTS[strategyId] ?? BALANCED_BEHAVIOR_WEIGHTS;
}

export function getMaxTradeDealsPerTurn(tradeWeight: number): number {
  if (tradeWeight <= 0) return 0;
  if (tradeWeight >= 2) return 2;
  return 1;
}
