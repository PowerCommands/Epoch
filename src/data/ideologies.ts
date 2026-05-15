import type { IdeologyDefinition, IdeologyId } from '../types/ideology';

export const DEFAULT_IDEOLOGY_ID: IdeologyId = 'traditionalism';

export const IDEOLOGIES: readonly IdeologyDefinition[] = [
  {
    id: 'liberalism',
    name: 'Liberalism',
    description: 'Favors diplomacy, trade, open borders, and limited appetite for war.',
    diplomacyBias: 18,
    tradeBias: 18,
    warBias: -14,
    openBordersBias: 20,
    cultureResistance: 6,
    expansionBias: 0,
  },
  {
    id: 'conservatism',
    name: 'Conservatism',
    description: 'Prefers cautious diplomacy, controlled borders, steady trade, and cultural continuity.',
    diplomacyBias: 4,
    tradeBias: 8,
    warBias: 6,
    openBordersBias: -10,
    cultureResistance: 22,
    expansionBias: 2,
  },
  {
    id: 'nationalism',
    name: 'Nationalism',
    description: 'Prioritizes sovereignty, territorial growth, cultural resilience, and guarded borders.',
    diplomacyBias: -6,
    tradeBias: 6,
    warBias: 18,
    openBordersBias: -22,
    cultureResistance: 26,
    expansionBias: 22,
  },
  {
    id: 'globalism',
    name: 'Globalism',
    description: 'Strongly favors diplomacy, trade networks, open borders, and cultural exchange.',
    diplomacyBias: 28,
    tradeBias: 30,
    warBias: -20,
    openBordersBias: 30,
    cultureResistance: -8,
    expansionBias: -2,
  },
  {
    id: 'militarism',
    name: 'Militarism',
    description: 'Values military strength, conquest readiness, and territorial expansion over cooperation.',
    diplomacyBias: -18,
    tradeBias: -10,
    warBias: 30,
    openBordersBias: -18,
    cultureResistance: 14,
    expansionBias: 24,
  },
  {
    id: 'traditionalism',
    name: 'Traditionalism',
    description: 'Favors cautious relations, limited border access, modest trade, and strong cultural resistance.',
    diplomacyBias: 0,
    tradeBias: 2,
    warBias: 6,
    openBordersBias: -16,
    cultureResistance: 28,
    expansionBias: 4,
  },
  {
    id: 'progressivism',
    name: 'Progressivism',
    description: 'Leans toward diplomacy, open exchange, active trade, and low preference for war.',
    diplomacyBias: 20,
    tradeBias: 18,
    warBias: -16,
    openBordersBias: 22,
    cultureResistance: 4,
    expansionBias: -2,
  },
];

export function getIdeologyById(id: string | undefined): IdeologyDefinition {
  return IDEOLOGIES.find((ideology) => ideology.id === id) ?? getIdeologyByIdStrict(DEFAULT_IDEOLOGY_ID);
}

export function getIdeologyByIdStrict(id: IdeologyId): IdeologyDefinition {
  return IDEOLOGIES.find((ideology) => ideology.id === id) ?? IDEOLOGIES[0];
}
