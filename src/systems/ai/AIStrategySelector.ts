import {
  AGGRESSIVE_AI_STRATEGY_ID,
  BALANCED_AI_STRATEGY_ID,
  DEFENSIVE_AI_STRATEGY_ID,
  ECONOMIC_AI_STRATEGY_ID,
  EXPANSIONIST_AI_STRATEGY_ID,
  CULTURAL_DOMINANCE_AI_STRATEGY_ID,
} from '../../data/aiStrategies';
import { getAINationalAgendaById } from '../../data/aiNationalAgendas';
import type { AILeaderPersonality } from '../../types/aiLeaderPersonality';
import type { AINationalAgendaId } from '../../types/aiNationalAgenda';
import type { ThreatLevel } from './AIMilitaryThreatEvaluationSystem';

const LOW_CITY_COUNT = 2;
const LOW_GOLD = 100;
const MIN_TURNS_IN_STRATEGY = 5;
const EMERGENCY_THREAT_LEVEL: ThreatLevel = 'high';
const STRATEGY_SCORE_ORDER = [
  BALANCED_AI_STRATEGY_ID,
  EXPANSIONIST_AI_STRATEGY_ID,
  ECONOMIC_AI_STRATEGY_ID,
  CULTURAL_DOMINANCE_AI_STRATEGY_ID,
  DEFENSIVE_AI_STRATEGY_ID,
  AGGRESSIVE_AI_STRATEGY_ID,
] as const;

/**
 * Lightweight snapshot of an AI nation used to pick a strategy. The selector
 * is intentionally pure — callers gather the data and apply the result.
 */
export interface AIStrategyContext {
  readonly nationId: string;
  readonly currentTurn: number;
  readonly currentStrategyId: string;
  readonly strategyStartedTurn: number;
  readonly nationalAgendaId: AINationalAgendaId;
  readonly leaderPersonality: AILeaderPersonality;
  readonly cityCount: number;
  readonly unitCount: number;
  readonly gold: number;
  readonly goldPerTurn: number;
  readonly netHappiness: number;
  readonly atWar: boolean;
  readonly enemyMilitaryNearby: boolean;
  readonly highestThreatLevel: ThreatLevel;
}

/**
 * Picks the most appropriate AIStrategy id from a context snapshot.
 *
 * Behavior is intentionally simple — a small ordered rule list, no scoring.
 * Add or reorder rules here as the platform grows.
 */
export class AIStrategySelector {
  selectStrategy(context: AIStrategyContext): string {
    // Strategy stability prevents AI nations from changing long-term posture too often.
    // Emergency threats may still force an immediate defensive switch.
    if (this.isEmergency(context)) {
      return DEFENSIVE_AI_STRATEGY_ID;
    }

    const desiredStrategyId = this.selectDesiredStrategy(context);
    if (!this.canSwitchStrategy(context)) {
      return context.currentStrategyId;
    }
    return desiredStrategyId;
  }

  private selectDesiredStrategy(context: AIStrategyContext): string {
    const scores: Record<string, number> = {
      [BALANCED_AI_STRATEGY_ID]: 10,
      [EXPANSIONIST_AI_STRATEGY_ID]: context.cityCount <= LOW_CITY_COUNT ? 30 : 0,
      [ECONOMIC_AI_STRATEGY_ID]: context.goldPerTurn < 0 || context.gold < LOW_GOLD ? 30 : 0,
      [CULTURAL_DOMINANCE_AI_STRATEGY_ID]: 0,
      [DEFENSIVE_AI_STRATEGY_ID]: context.highestThreatLevel === 'medium' ? 30 : 0,
      [AGGRESSIVE_AI_STRATEGY_ID]: context.atWar ? 25 : 0,
    };

    // National Agenda is the long-term AI identity.
    // It biases strategy selection without directly executing actions.
    const agenda = getAINationalAgendaById(context.nationalAgendaId);
    for (const strategyId of Object.keys(scores)) {
      scores[strategyId] += agenda.strategyBias[strategyId] ?? 0;
    }

    // Leader personality adds a stable bias on top of national agenda.
    // It should shape preferences without hardcoding leader-specific behavior.
    scores[AGGRESSIVE_AI_STRATEGY_ID] += context.leaderPersonality.aggressionBias;
    scores[EXPANSIONIST_AI_STRATEGY_ID] += context.leaderPersonality.expansionBias;
    scores[ECONOMIC_AI_STRATEGY_ID] += context.leaderPersonality.economyBias;
    scores[BALANCED_AI_STRATEGY_ID] += Math.floor(context.leaderPersonality.diplomacyBias / 2);
    scores[DEFENSIVE_AI_STRATEGY_ID] += Math.max(0, -context.leaderPersonality.aggressionBias);
    scores[CULTURAL_DOMINANCE_AI_STRATEGY_ID] += context.leaderPersonality.cultureBias * 2;
    scores[BALANCED_AI_STRATEGY_ID] += Math.floor(context.leaderPersonality.cultureBias / 4);
    scores[ECONOMIC_AI_STRATEGY_ID] += Math.floor(context.leaderPersonality.cultureBias / 5);

    let bestStrategyId: string = STRATEGY_SCORE_ORDER[0];
    for (const strategyId of STRATEGY_SCORE_ORDER) {
      if (scores[strategyId] > scores[bestStrategyId]) {
        bestStrategyId = strategyId;
      }
    }
    return bestStrategyId;
  }

  private isEmergency(context: AIStrategyContext): boolean {
    return context.highestThreatLevel === EMERGENCY_THREAT_LEVEL;
  }

  private canSwitchStrategy(context: AIStrategyContext): boolean {
    return context.currentTurn - context.strategyStartedTurn >= MIN_TURNS_IN_STRATEGY;
  }
}
