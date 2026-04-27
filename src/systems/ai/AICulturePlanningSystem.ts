import {
  AI_BASELINE_CULTURE_PRIORITIES,
  DEFAULT_AI_EARLY_GAME_TURN_LIMIT,
} from '../../data/aiBaselinePriorities';
import { getLeaderPersonalityByNationId } from '../../data/leaders';
import type { Nation } from '../../entities/Nation';
import type { CultureTreeNode } from '../culture/CultureSystem';
import { getBehaviorWeights } from '../AIStrategyService';

export interface AICulturePlanningContext {
  nation: Nation;
  availableCultureNodes: CultureTreeNode[];
  currentTurn: number;
  earlyGameTurnLimit?: number;
}

export function pickBestAICultureNode(context: AICulturePlanningContext): CultureTreeNode | undefined {
  let bestCandidate: CultureTreeNode | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < context.availableCultureNodes.length; index += 1) {
    const node = context.availableCultureNodes[index];
    const baselineScore = applyBaselineCulturePriority(
      node.id,
      context.currentTurn,
      context.earlyGameTurnLimit ?? DEFAULT_AI_EARLY_GAME_TURN_LIMIT,
    );
    const score = getDefinitionOrderTieBreakScore(context.availableCultureNodes.length, index)
      + baselineScore
      + getStrategyModifier(context.nation, node.id)
      + getPersonalityModifier(context.nation.id, node.id);

    if (baselineScore > 0) {
      console.debug(`Baseline priority applied: ${node.id} (+${baselineScore})`);
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = node;
    }
  }

  return bestCandidate;
}

export function applyBaselineCulturePriority(
  cultureId: string,
  currentTurn: number,
  earlyGameTurnLimit = DEFAULT_AI_EARLY_GAME_TURN_LIMIT,
): number {
  const priority = AI_BASELINE_CULTURE_PRIORITIES.find((p) => p.id === cultureId);
  if (!priority) return 0;

  if (priority.phase === 'early' && currentTurn < earlyGameTurnLimit) {
    return priority.weight;
  }

  return 0;
}

function getStrategyModifier(nation: Nation, cultureId: string): number {
  if (cultureId !== 'foreign_trade') return 0;
  const weights = getBehaviorWeights(nation.aiStrategyId);
  return weights.diplomacy + weights.trade;
}

function getPersonalityModifier(nationId: string, cultureId: string): number {
  if (cultureId !== 'foreign_trade') return 0;
  const personality = getLeaderPersonalityByNationId(nationId);
  return (personality.diplomacyBias + personality.cultureBias) / 10;
}

function getDefinitionOrderTieBreakScore(totalCount: number, index: number): number {
  return (totalCount - index) / 1000;
}
