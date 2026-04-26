import type { AINationalAgenda, AINationalAgendaId } from '../types/aiNationalAgenda';
import {
  AGGRESSIVE_AI_STRATEGY_ID,
  BALANCED_AI_STRATEGY_ID,
  DEFENSIVE_AI_STRATEGY_ID,
  ECONOMIC_AI_STRATEGY_ID,
  EXPANSIONIST_AI_STRATEGY_ID,
} from './aiStrategies';

export const BALANCED_AGENDA_ID: AINationalAgendaId = 'balanced';

export const BALANCED_AGENDA: AINationalAgenda = {
  id: BALANCED_AGENDA_ID,
  name: 'Balanced',
  description: 'Keeps a flexible posture without strong long-term bias.',
  strategyBias: {
    [BALANCED_AI_STRATEGY_ID]: 10,
  },
};

export const GROWTH_AGENDA: AINationalAgenda = {
  id: 'growth',
  name: 'Growth',
  description: 'Prioritizes city development, food, and production.',
  strategyBias: {
    [BALANCED_AI_STRATEGY_ID]: 10,
    [ECONOMIC_AI_STRATEGY_ID]: 10,
    [EXPANSIONIST_AI_STRATEGY_ID]: 5,
  },
};

export const CULTURE_AGENDA: AINationalAgenda = {
  id: 'culture',
  name: 'Culture',
  description: 'Prioritizes stability, culture, happiness, and peaceful development.',
  strategyBias: {
    [BALANCED_AI_STRATEGY_ID]: 10,
    [ECONOMIC_AI_STRATEGY_ID]: 5,
    [DEFENSIVE_AI_STRATEGY_ID]: 5,
  },
};

export const ECONOMIC_AGENDA: AINationalAgenda = {
  id: 'economic',
  name: 'Economic',
  description: 'Prioritizes gold, production, and infrastructure.',
  strategyBias: {
    [ECONOMIC_AI_STRATEGY_ID]: 20,
    [BALANCED_AI_STRATEGY_ID]: 5,
  },
};

export const MILITARY_POWER_AGENDA: AINationalAgenda = {
  id: 'military_power',
  name: 'Military Power',
  description: 'Seeks military dominance and tolerates conflict.',
  strategyBias: {
    [AGGRESSIVE_AI_STRATEGY_ID]: 20,
    [EXPANSIONIST_AI_STRATEGY_ID]: 10,
  },
};

export const EXPANSIONIST_AGENDA: AINationalAgenda = {
  id: 'expansionist',
  name: 'Expansionist',
  description: 'Wants many cities and broad territorial growth.',
  strategyBias: {
    [EXPANSIONIST_AI_STRATEGY_ID]: 20,
    [AGGRESSIVE_AI_STRATEGY_ID]: 5,
    [ECONOMIC_AI_STRATEGY_ID]: 5,
  },
};

export const NAVAL_POWER_AGENDA: AINationalAgenda = {
  id: 'naval_power',
  name: 'Naval Power',
  description: 'Prioritizes coasts, fleets, and sea control.',
  strategyBias: {
    [BALANCED_AI_STRATEGY_ID]: 5,
    [AGGRESSIVE_AI_STRATEGY_ID]: 5,
    [ECONOMIC_AI_STRATEGY_ID]: 5,
  },
};
// Naval-specific strategy hooks will be added when naval AI is more developed.

export const ISOLATIONIST_AGENDA: AINationalAgenda = {
  id: 'isolationist',
  name: 'Isolationist',
  description: 'Prefers security, controlled borders, and low conflict risk.',
  strategyBias: {
    [DEFENSIVE_AI_STRATEGY_ID]: 20,
    [ECONOMIC_AI_STRATEGY_ID]: 5,
  },
};

export const AI_NATIONAL_AGENDAS: readonly AINationalAgenda[] = [
  BALANCED_AGENDA,
  GROWTH_AGENDA,
  CULTURE_AGENDA,
  ECONOMIC_AGENDA,
  MILITARY_POWER_AGENDA,
  EXPANSIONIST_AGENDA,
  NAVAL_POWER_AGENDA,
  ISOLATIONIST_AGENDA,
];

export function getAINationalAgendaById(id: string | undefined): AINationalAgenda {
  return AI_NATIONAL_AGENDAS.find((agenda) => agenda.id === id) ?? BALANCED_AGENDA;
}
