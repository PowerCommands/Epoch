import {
  AGGRESSIVE_AI_STRATEGY_ID,
  BALANCED_AI_STRATEGY_ID,
  DEFENSIVE_AI_STRATEGY_ID,
  ECONOMIC_AI_STRATEGY_ID,
  EXPANSIONIST_AI_STRATEGY_ID,
} from '../../data/aiStrategies';

const LOW_CITY_COUNT = 2;
const LOW_UNIT_COUNT = 2;
const LOW_GOLD = 100;

/**
 * Lightweight snapshot of an AI nation used to pick a strategy. The selector
 * is intentionally pure — callers gather the data and apply the result.
 */
export interface AIStrategyContext {
  readonly nationId: string;
  readonly cityCount: number;
  readonly unitCount: number;
  readonly gold: number;
  readonly goldPerTurn: number;
  readonly netHappiness: number;
  readonly atWar: boolean;
  readonly enemyMilitaryNearby: boolean;
}

/**
 * Picks the most appropriate AIStrategy id from a context snapshot.
 *
 * Behavior is intentionally simple — a small ordered rule list, no scoring.
 * Add or reorder rules here as the platform grows.
 */
export class AIStrategySelector {
  selectStrategy(context: AIStrategyContext): string {
    if (context.atWar && context.unitCount < LOW_UNIT_COUNT) {
      return DEFENSIVE_AI_STRATEGY_ID;
    }
    if (context.atWar) {
      return AGGRESSIVE_AI_STRATEGY_ID;
    }
    if (context.goldPerTurn < 0 || context.gold < LOW_GOLD) {
      return ECONOMIC_AI_STRATEGY_ID;
    }
    if (context.cityCount < LOW_CITY_COUNT) {
      return EXPANSIONIST_AI_STRATEGY_ID;
    }
    return BALANCED_AI_STRATEGY_ID;
  }
}
