import {
  AGGRESSIVE_AI_STRATEGY_ID,
  BALANCED_AI_STRATEGY_ID,
  DEFENSIVE_AI_STRATEGY_ID,
  ECONOMIC_AI_STRATEGY_ID,
  EXPANSIONIST_AI_STRATEGY_ID,
  CULTURAL_DOMINANCE_AI_STRATEGY_ID,
  getAIStrategyById,
} from '../../data/aiStrategies';
import type { AILeaderPersonality } from '../../types/aiLeaderPersonality';

export interface AIStrategyEvaluationInput {
  readonly leaderPersonality: AILeaderPersonality;
}

export interface AIStrategyEvaluationResult {
  readonly primaryStrategyId: string;
  readonly secondaryStrategyId: string;
  readonly scores: Readonly<Record<string, number>>;
}

const CANDIDATE_STRATEGY_IDS = [
  AGGRESSIVE_AI_STRATEGY_ID,
  EXPANSIONIST_AI_STRATEGY_ID,
  DEFENSIVE_AI_STRATEGY_ID,
  ECONOMIC_AI_STRATEGY_ID,
  CULTURAL_DOMINANCE_AI_STRATEGY_ID,
  BALANCED_AI_STRATEGY_ID,
] as const;

const NEUTRAL_WAR_TOLERANCE = 50;
const NEUTRAL_PEACE_PREFERENCE = 50;

/**
 * Pass-1 strategy evaluation: deterministic scoring of leader personality
 * into a primary + secondary strategy slot. Pure — no game state, no I/O.
 *
 * Adding more nations later only requires calling `evaluate` with their
 * personality. Adding more inputs (threat, economy, agenda) means extending
 * the input type and the score table — the candidate list stays the same.
 */
export class AIStrategyEvaluationSystem {
  evaluate(input: AIStrategyEvaluationInput): AIStrategyEvaluationResult {
    const p = input.leaderPersonality;

    const aggressive =
      p.aggressionBias * 2
      + (p.warTolerance - NEUTRAL_WAR_TOLERANCE)
      - (p.peacePreference - NEUTRAL_PEACE_PREFERENCE)
      + Math.max(0, -p.diplomacyBias);

    const expansionist = p.expansionBias * 2;

    const defensive =
      Math.max(0, -p.aggressionBias)
      + (p.peacePreference - NEUTRAL_PEACE_PREFERENCE)
      + Math.max(0, -p.diplomacyBias) / 2;

    const economic = p.economyBias * 2;
    const cultural = p.cultureBias * 2 + Math.max(0, p.diplomacyBias);

    const balanced = 5 + Math.floor(p.diplomacyBias / 2);

    const scores: Record<string, number> = {
      [AGGRESSIVE_AI_STRATEGY_ID]: aggressive,
      [EXPANSIONIST_AI_STRATEGY_ID]: expansionist,
      [DEFENSIVE_AI_STRATEGY_ID]: defensive,
      [ECONOMIC_AI_STRATEGY_ID]: economic,
      [CULTURAL_DOMINANCE_AI_STRATEGY_ID]: cultural,
      [BALANCED_AI_STRATEGY_ID]: balanced,
    };

    const ranked = [...CANDIDATE_STRATEGY_IDS].sort((a, b) => {
      const diff = scores[b] - scores[a];
      if (diff !== 0) return diff;
      // Stable tiebreak by candidate-list order so results stay deterministic.
      return CANDIDATE_STRATEGY_IDS.indexOf(a) - CANDIDATE_STRATEGY_IDS.indexOf(b);
    });

    return {
      primaryStrategyId: ranked[0],
      secondaryStrategyId: ranked[1],
      scores,
    };
  }
}

export function getStrategyDisplayName(strategyId: string): string {
  return getAIStrategyById(strategyId).name;
}
