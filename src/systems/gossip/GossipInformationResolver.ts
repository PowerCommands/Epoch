import { AI_STRATEGIES, getAIStrategyById } from '../../data/aiStrategies';
import { getAINationalAgendaById } from '../../data/aiNationalAgendas';
import type { AINationalAgendaId } from '../../types/aiNationalAgenda';
import type { DiplomacyRelation } from '../DiplomacyManager';

export const RIVALRY_WEIGHTS = {
  hostility: 1,
  suspicion: 0.75,
  fear: 0.5,
  trust: -0.5,
  affinity: -0.5,
} as const;

export const WAR_RISK_WEIGHTS = {
  hostility: 0.7,
  suspicion: 0.6,
  fear: 0.35,
  leaderAggression: 1,
  ideologyWarBias: 0.5,
  strategyAggression: 25,
  currentlyAtWar: 25,
} as const;

export const MEANINGFUL_RIVALRY_SCORE = 0;
export const MEANINGFUL_WAR_RISK_SCORE = 10;

export function calculateGossipRivalryScore(relation: DiplomacyRelation): number {
  return relation.hostility * RIVALRY_WEIGHTS.hostility
    + relation.suspicion * RIVALRY_WEIGHTS.suspicion
    + relation.fear * RIVALRY_WEIGHTS.fear
    + relation.trust * RIVALRY_WEIGHTS.trust
    + relation.affinity * RIVALRY_WEIGHTS.affinity;
}

export interface GossipWarRiskSignals {
  readonly relation: DiplomacyRelation;
  readonly leaderAggressionBias: number;
  readonly ideologyWarBias: number;
  readonly strategyAggression: number;
}

export function calculateGossipWarRiskScore(signals: GossipWarRiskSignals): number {
  const { relation } = signals;
  return relation.hostility * WAR_RISK_WEIGHTS.hostility
    + relation.suspicion * WAR_RISK_WEIGHTS.suspicion
    + relation.fear * WAR_RISK_WEIGHTS.fear
    + signals.leaderAggressionBias * WAR_RISK_WEIGHTS.leaderAggression
    + signals.ideologyWarBias * WAR_RISK_WEIGHTS.ideologyWarBias
    + (signals.strategyAggression - 1) * WAR_RISK_WEIGHTS.strategyAggression
    + (relation.state === 'WAR' ? WAR_RISK_WEIGHTS.currentlyAtWar : 0);
}

/** Current strategy is the short-term answer; National Agenda is its fallback. */
export function describeGossipAgenda(strategyId: string | undefined, agendaId: string | undefined): string {
  const hasKnownCurrentStrategy = strategyId !== undefined
    && strategyId !== 'baseline'
    && AI_STRATEGIES.some((strategy) => strategy.id === strategyId);
  if (hasKnownCurrentStrategy) {
    switch (getAIStrategyById(strategyId).id) {
      case 'expansionist': return 'We intend to expand while there is still land worth claiming.';
      case 'defensive': return 'For now, securing our borders is what matters.';
      case 'aggressive': return 'Strength decides who shapes the world. We intend to remain strong.';
      case 'economic': return 'Our priority is strengthening our economy and infrastructure.';
      case 'cultural_dominance': return 'Our influence should reach farther than our armies ever could.';
      case 'balanced': return 'We are keeping our options open and strengthening the nation where needed.';
    }
  }

  switch (getAINationalAgendaById(agendaId as AINationalAgendaId | undefined).id) {
    case 'growth': return 'We mean to develop our cities, people, and productive strength.';
    case 'culture': return 'Culture, stability, and lasting influence guide our ambitions.';
    case 'economic': return 'Our priority is strengthening our economy and infrastructure.';
    case 'military_power': return 'Strength decides who shapes the world. We intend to remain strong.';
    case 'expansionist': return 'We intend to expand while there is still land worth claiming.';
    case 'naval_power': return 'Control of the seas is central to our plans.';
    case 'isolationist': return 'We prefer security, controlled borders, and freedom from unnecessary conflict.';
    case 'homeland_defense': return 'We will defend our homeland and make aggressors regret testing us.';
    case 'france_libre': return 'We will maintain the strength and independence to decide our own future.';
    case 'new_roman_empire': return 'Italy seeks the strength, territory, and prestige of a great power—and recognizes favorable opportunities.';
    case 'poland_shall_endure': return 'We prepare to defend our sovereignty and place great value on allies who keep their commitments.';
    case 'balanced': return 'We are keeping our options open and strengthening the nation where needed.';
  }
}
