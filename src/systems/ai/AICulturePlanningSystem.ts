import {
  AI_BASELINE_CULTURE_PRIORITIES,
  DEFAULT_AI_EARLY_GAME_TURN_LIMIT,
} from '../../data/aiBaselinePriorities';
import { getLeaderByNationId, getLeaderPersonalityByNationId } from '../../data/leaders';
import type { Nation } from '../../entities/Nation';
import type { CultureTreeNode } from '../culture/CultureSystem';
import { HAPPINESS_STABLE_THRESHOLD } from '../culture/CultureEffectSystem';
import { getBehaviorWeights } from '../AIStrategyService';
import type { AILogFormatter } from './AILogFormatter';

const PRIORITY_BONUS = 50;
const LOW_HAPPINESS_EARLY_EMPIRE_BONUS = 30;

export interface AICulturePlanningContext {
  nation: Nation;
  availableCultureNodes: CultureTreeNode[];
  currentTurn: number;
  earlyGameTurnLimit?: number;
  netHappiness?: number;
  formatLog?: AILogFormatter;
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
    const leaderPriorityScore = getLeaderCulturePriorityModifier(context.nation.id, node.id);
    const lowHappinessScore = getLowHappinessCultureModifier(context.netHappiness, node.id);
    const score = getDefinitionOrderTieBreakScore(context.availableCultureNodes.length, index)
      + baselineScore
      + leaderPriorityScore
      + lowHappinessScore
      + getStrategyModifier(context.nation, node.id)
      + getPersonalityModifier(context.nation.id, node.id);

    if (baselineScore > 0) {
      console.debug(
        context.formatLog?.(context.nation.id, `AI culture baseline priority applied: ${node.id} (+${baselineScore})`)
          ?? `AI culture baseline priority applied for ${context.nation.name}: ${node.id} (+${baselineScore})`,
      );
    }

    if (leaderPriorityScore > 0 || lowHappinessScore > 0) {
      console.debug(
        context.formatLog?.(
          context.nation.id,
          `AI culture priority applied: ${node.id} (+${leaderPriorityScore + lowHappinessScore}; reason: ${formatCulturePriorityReason(leaderPriorityScore, lowHappinessScore)})`,
        ) ?? `AI culture priority applied for ${context.nation.name}: ${node.id} (+${leaderPriorityScore + lowHappinessScore}; reason: ${formatCulturePriorityReason(leaderPriorityScore, lowHappinessScore)})`,
      );
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = node;
    }
  }

  if (bestCandidate) {
    const leaderPriorityScore = getLeaderCulturePriorityModifier(context.nation.id, bestCandidate.id);
    const lowHappinessScore = getLowHappinessCultureModifier(context.netHappiness, bestCandidate.id);
    if (leaderPriorityScore > 0 || lowHappinessScore > 0) {
      console.debug(
        context.formatLog?.(
          context.nation.id,
          `prioritized ${bestCandidate.name} (reason: ${formatCulturePriorityReason(leaderPriorityScore, lowHappinessScore)})`,
        ) ?? `${context.nation.name} prioritized ${bestCandidate.name} (reason: ${formatCulturePriorityReason(leaderPriorityScore, lowHappinessScore)})`,
      );
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

function getLeaderCulturePriorityModifier(nationId: string, cultureId: string): number {
  return getLeaderByNationId(nationId)?.culturePriorities?.includes(cultureId)
    ? PRIORITY_BONUS
    : 0;
}

function getLowHappinessCultureModifier(netHappiness: number | undefined, cultureId: string): number {
  if (cultureId !== 'early_empire') return 0;
  if (netHappiness === undefined || netHappiness >= HAPPINESS_STABLE_THRESHOLD) return 0;
  return LOW_HAPPINESS_EARLY_EMPIRE_BONUS;
}

function formatCulturePriorityReason(leaderPriorityScore: number, lowHappinessScore: number): string {
  if (leaderPriorityScore > 0 && lowHappinessScore > 0) return 'low happiness + leader bias';
  if (leaderPriorityScore > 0) return 'leader bias';
  return 'low happiness';
}

function getDefinitionOrderTieBreakScore(totalCount: number, index: number): number {
  return (totalCount - index) / 1000;
}
