import type { AIStrategyBehaviorWeights } from '../types/aiStrategyBehavior';
import {
  AGGRESSIVE_AI_STRATEGY_ID,
  BALANCED_AI_STRATEGY_ID,
  BASELINE_AI_STRATEGY_ID,
  DEFENSIVE_AI_STRATEGY_ID,
  ECONOMIC_AI_STRATEGY_ID,
  EXPANSIONIST_AI_STRATEGY_ID,
} from './aiStrategies';

export const BALANCED_BEHAVIOR_WEIGHTS: AIStrategyBehaviorWeights = {
  exploration: 1,
  diplomacy: 1,
  trade: 1,
  aggression: 1,
  defense: 1,
};

export const AI_STRATEGY_BEHAVIOR_WEIGHTS: Record<string, AIStrategyBehaviorWeights> = {
  [BASELINE_AI_STRATEGY_ID]: BALANCED_BEHAVIOR_WEIGHTS,
  [BALANCED_AI_STRATEGY_ID]: BALANCED_BEHAVIOR_WEIGHTS,
  [ECONOMIC_AI_STRATEGY_ID]: {
    exploration: 1,
    diplomacy: 1,
    trade: 2,
    aggression: 0,
    defense: 1,
  },
  [EXPANSIONIST_AI_STRATEGY_ID]: {
    exploration: 2,
    diplomacy: 0,
    trade: 1,
    aggression: 1,
    defense: 0,
  },
  [DEFENSIVE_AI_STRATEGY_ID]: {
    exploration: 0,
    diplomacy: 1,
    trade: 1,
    aggression: 0,
    defense: 2,
  },
  [AGGRESSIVE_AI_STRATEGY_ID]: {
    exploration: 1,
    diplomacy: 0,
    trade: 0,
    aggression: 2,
    defense: 1,
  },
};
