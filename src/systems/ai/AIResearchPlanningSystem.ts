import {
  AI_BASELINE_TECH_PRIORITIES,
  DEFAULT_AI_EARLY_GAME_TURN_LIMIT,
} from '../../data/aiBaselinePriorities';
import { getLeaderPersonalityByNationId } from '../../data/leaders';
import type { Nation } from '../../entities/Nation';
import type { AILeaderEraResearchWeights, AILeaderEraStrategy } from '../../types/aiLeaderEraStrategy';
import type { Technology } from '../ResearchSystem';
import { getBehaviorWeights } from '../AIStrategyService';
/**
 * A concrete, gameplay-driven reason to prioritize one technology now. Produced
 * by systems with a blocked strategic intent (currently only overseas expansion
 * demanding `sailing`) and consumed as a scoring bonus — never as an override, so
 * prerequisites and the rest of the AI's research personality still apply.
 */
export interface ResearchDemand {
  readonly techId: string;
  readonly bonus: number;
  readonly reason: string;
}

/**
 * Overcomes the observed static disadvantage for `sailing` under a naval-averse
 * era strategy: a top production tech scores ~+4.5 while sailing's naval modifier
 * is ~-3.5 (gap ~8). A +12 demand bonus makes a genuinely blocked overseas intent
 * reliably win the next selection without touching any existing research weight.
 */
export const SAILING_OVERSEAS_RESEARCH_DEMAND_BONUS = 12;

export interface AIResearchPlanningContext {
  nation: Nation;
  availableTechnologies: Technology[];
  currentTurn: number;
  earlyGameTurnLimit?: number;
  eraStrategy?: AILeaderEraStrategy;
  /** Active strategic demands; a matching available tech gets its `bonus` added. */
  researchDemands?: readonly ResearchDemand[];
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
      + getEraStrategyResearchModifier(technology.id, context.eraStrategy)
      + getPersonalityModifier(context.nation.id, technology.id)
      + getResearchDemandBonus(technology.id, context.researchDemands);

    if (baselineScore > 0) {
      console.debug(`AI research baseline priority applied for ${context.nation.name}: ${technology.id} (+${baselineScore})`);
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

/**
 * Sum of every active demand for this tech. Applied only inside the available-tech
 * scoring loop, so a demand for a tech whose prerequisites are unmet never appears
 * here — prerequisites are respected by construction.
 */
function getResearchDemandBonus(
  techId: string,
  demands: readonly ResearchDemand[] | undefined,
): number {
  if (!demands || demands.length === 0) return 0;
  let bonus = 0;
  for (const demand of demands) {
    if (demand.techId === techId) bonus += demand.bonus;
  }
  return bonus;
}

function getStrategyModifier(nation: Nation, techId: string): number {
  if (techId !== 'writing') return 0;
  const weights = getBehaviorWeights(nation.aiStrategyId);
  return weights.diplomacy + weights.trade;
}

function getEraStrategyResearchModifier(
  techId: string,
  eraStrategy: AILeaderEraStrategy | undefined,
): number {
  if (!eraStrategy) return 0;
  const category = getTechnologyResearchCategory(techId);
  if (category === undefined) return 0;
  const weight = eraStrategy.researchWeights[category] ?? 1;
  return (weight - 1) * 10;
}

function getTechnologyResearchCategory(techId: string): keyof AILeaderEraResearchWeights | undefined {
  switch (techId) {
    case 'agriculture':
    case 'pottery':
    case 'the_wheel':
    case 'engineering':
      return 'food';
    case 'mining':
    case 'metal_casting':
    case 'machinery':
      return 'production';
    case 'currency':
    case 'trade_networks':
      return 'economy';
    case 'writing':
    case 'education':
      return 'science';
    case 'philosophy':
    case 'construction':
    case 'mathematics':
    case 'masonry':
      return 'wonder';
    case 'calendar':
      return 'culture';
    case 'archery':
    case 'bronze_working':
    case 'horseback_riding':
    case 'iron_working':
    case 'civil_service':
      return 'military';
    case 'sailing':
    case 'optics':
    case 'compass':
    case 'astronomy':
    case 'navigation':
      return 'naval';
    default:
      return undefined;
  }
}

function getPersonalityModifier(nationId: string, techId: string): number {
  if (techId !== 'writing') return 0;
  const personality = getLeaderPersonalityByNationId(nationId);
  return personality.diplomacyBias / 10;
}

function getDefinitionOrderTieBreakScore(totalCount: number, index: number): number {
  return (totalCount - index) / 1000;
}
