import {
  AI_BASELINE_TECH_PRIORITIES,
  DEFAULT_AI_EARLY_GAME_TURN_LIMIT,
} from '../../data/aiBaselinePriorities';
import { getLeaderPersonalityByNationId } from '../../data/leaders';
import type { Nation } from '../../entities/Nation';
import type { Technology } from '../ResearchSystem';
import { getBehaviorWeights } from '../AIStrategyService';

export interface AIResearchPlanningContext {
  nation: Nation;
  availableTechnologies: Technology[];
  currentTurn: number;
  earlyGameTurnLimit?: number;
}

export function pickBestAIResearchTechnology(context: AIResearchPlanningContext): Technology | undefined {
  let bestCandidate: Technology | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < context.availableTechnologies.length; index += 1) {
    const technology = context.availableTechnologies[index];
    const baselineScore = applyBaselineTechPriority(
      technology.id,
      context.currentTurn,
      context.earlyGameTurnLimit ?? DEFAULT_AI_EARLY_GAME_TURN_LIMIT,
    );
    const score = getDefinitionOrderTieBreakScore(context.availableTechnologies.length, index)
      + baselineScore
      + getStrategyModifier(context.nation, technology.id)
      + getPersonalityModifier(context.nation.id, technology.id);

    if (baselineScore > 0) {
      console.debug(`Baseline priority applied: ${technology.id} (+${baselineScore})`);
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = technology;
    }
  }

  return bestCandidate;
}

export function applyBaselineTechPriority(
  techId: string,
  currentTurn: number,
  earlyGameTurnLimit = DEFAULT_AI_EARLY_GAME_TURN_LIMIT,
): number {
  const priority = AI_BASELINE_TECH_PRIORITIES.find((p) => p.id === techId);
  if (!priority) return 0;

  if (priority.phase === 'early' && currentTurn < earlyGameTurnLimit) {
    return priority.weight;
  }

  return 0;
}

function getStrategyModifier(nation: Nation, techId: string): number {
  if (techId !== 'writing') return 0;
  const weights = getBehaviorWeights(nation.aiStrategyId);
  return weights.diplomacy + weights.trade;
}

function getPersonalityModifier(nationId: string, techId: string): number {
  if (techId !== 'writing') return 0;
  const personality = getLeaderPersonalityByNationId(nationId);
  return personality.diplomacyBias / 10;
}

function getDefinitionOrderTieBreakScore(totalCount: number, index: number): number {
  return (totalCount - index) / 1000;
}
