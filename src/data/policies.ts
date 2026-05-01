import { CULTURE_TREE } from './cultureTree';
import type { PolicyCategory, PolicyDefinition } from '../types/policy';

function policy(input: PolicyDefinition): PolicyDefinition {
  return input;
}

export const ALL_POLICIES: readonly PolicyDefinition[] = [
  policy({
    id: 'republic',
    name: 'Republic',
    category: 'economic',
    requiredCultureNodeId: 'craftsmanship',
    description: 'Each city gains +1 production.',
    modifiers: [{ type: 'productionFlatPerCity', value: 1 }],
  }),
  policy({
    id: 'public_works',
    name: 'Public Works',
    category: 'economic',
    requiredCultureNodeId: 'state_workforce',
    description: 'Builders complete tile improvements 15% faster.',
    modifiers: [{ type: 'improvementBuildSpeedPercent', value: 15 }],
  }),
  policy({
    id: 'civic_order',
    name: 'Civic Order',
    category: 'economic',
    requiredCultureNodeId: 'early_empire',
    description: 'Each city generates 1 less unhappiness.',
    modifiers: [{ type: 'unhappinessPerCityFlat', value: -1 }],
  }),
  policy({
    id: 'market_economy',
    name: 'Market Economy',
    category: 'economic',
    requiredCultureNodeId: 'medieval_faires',
    description: 'Each city gains +1 gold.',
    modifiers: [{ type: 'goldFlatPerCity', value: 1 }],
  }),
  policy({
    id: 'luxury_trade',
    name: 'Luxury Trade',
    category: 'economic',
    requiredCultureNodeId: 'mercantilism',
    description: 'Each unique luxury resource provides +1 happiness.',
    modifiers: [{ type: 'happinessPerLuxuryResource', value: 1 }],
  }),
  policy({
    id: 'industrial_planning',
    name: 'Industrial Planning',
    category: 'economic',
    requiredCultureNodeId: 'civil_engineering',
    description: 'Cities gain +10% production.',
    modifiers: [{ type: 'productionPercent', value: 10 }],
  }),

  policy({
    id: 'discipline',
    name: 'Discipline',
    category: 'military',
    requiredCultureNodeId: 'craftsmanship',
    description: 'Units gain +5 combat strength in owned territory.',
    modifiers: [{ type: 'ownedTerritoryCombatFlat', value: 5 }],
  }),
  policy({
    id: 'military_organization',
    name: 'Military Organization',
    category: 'military',
    requiredCultureNodeId: 'military_tradition',
    description: 'Cities gain +15% production toward land units.',
    modifiers: [{ type: 'landUnitProductionPercent', value: 15 }],
  }),
  policy({
    id: 'garrison_rule',
    name: 'Garrison Rule',
    category: 'military',
    requiredCultureNodeId: 'defensive_tactics',
    description: 'Each city provides +1 happiness.',
    modifiers: [{ type: 'happinessPerCity', value: 1 }],
  }),
  policy({
    id: 'border_defense',
    name: 'Border Defense',
    category: 'military',
    requiredCultureNodeId: 'defensive_tactics',
    description: 'Cities gain +5 defense.',
    modifiers: [{ type: 'cityDefenseFlat', value: 5 }],
  }),
  policy({
    id: 'war_economy',
    name: 'War Economy',
    category: 'military',
    requiredCultureNodeId: 'mobilization',
    description: 'Unit upkeep is reduced by 20%.',
    modifiers: [{ type: 'unitUpkeepPercent', value: -20 }],
  }),

  policy({
    id: 'diplomatic_corps',
    name: 'Diplomatic Corps',
    category: 'diplomatic',
    requiredCultureNodeId: 'diplomatic_service',
    description: 'Gain +1 influence per turn.',
    modifiers: [{ type: 'influenceFlat', value: 1 }],
  }),
  policy({
    id: 'trade_agreements',
    name: 'Trade Agreements',
    category: 'diplomatic',
    requiredCultureNodeId: 'civil_service_civics',
    description: 'Nationwide gold output increases by 10%.',
    modifiers: [{ type: 'goldPercent', value: 10 }],
  }),
  policy({
    id: 'open_channels',
    name: 'Open Channels',
    category: 'diplomatic',
    requiredCultureNodeId: 'globalization',
    description: 'Influence output increases by 10%.',
    modifiers: [{ type: 'influencePercent', value: 10 }],
  }),
  policy({
    id: 'soft_power',
    name: 'Soft Power',
    category: 'diplomatic',
    requiredCultureNodeId: 'social_media',
    description: 'Gain +1 happiness.',
    modifiers: [{ type: 'happinessFlat', value: 1 }],
  }),
  policy({
    id: 'foreign_aid',
    name: 'Foreign Aid',
    category: 'diplomatic',
    requiredCultureNodeId: 'globalization',
    description: 'Each city provides +1 happiness.',
    modifiers: [{ type: 'happinessPerCity', value: 1 }],
  }),

  policy({
    id: 'oral_tradition',
    name: 'Oral Tradition',
    category: 'ideology',
    requiredCultureNodeId: 'code_of_laws',
    description: 'Each city gains +1 culture.',
    modifiers: [{ type: 'cultureFlatPerCity', value: 1 }],
  }),
  policy({
    id: 'mystic_authority',
    name: 'Mystic Authority',
    category: 'ideology',
    requiredCultureNodeId: 'mysticism',
    description: 'Gain +2 happiness.',
    modifiers: [{ type: 'happinessFlat', value: 2 }],
  }),
  policy({
    id: 'centralized_power',
    name: 'Centralized Power',
    category: 'ideology',
    requiredCultureNodeId: 'political_philosophy',
    description: 'Cities gain +10% production.',
    modifiers: [{ type: 'productionPercent', value: 10 }],
  }),
  policy({
    id: 'national_identity',
    name: 'National Identity',
    category: 'ideology',
    requiredCultureNodeId: 'nationalism',
    description: 'Culture output increases by 15%.',
    modifiers: [{ type: 'culturePercent', value: 15 }],
  }),
  policy({
    id: 'modern_bureaucracy',
    name: 'Modern Bureaucracy',
    category: 'ideology',
    requiredCultureNodeId: 'urbanization',
    description: 'Population unhappiness is reduced by 10%.',
    modifiers: [{ type: 'unhappinessPerPopulationPercent', value: -10 }],
  }),
];

export function getPolicyById(id: string): PolicyDefinition | undefined {
  return ALL_POLICIES.find((entry) => entry.id === id);
}

export function getPoliciesByRequiredCultureNodeId(cultureNodeId: string): PolicyDefinition[] {
  return ALL_POLICIES.filter((entry) => entry.requiredCultureNodeId === cultureNodeId);
}

export function getPoliciesByCategory(category: PolicyCategory): PolicyDefinition[] {
  return ALL_POLICIES.filter((entry) => entry.category === category);
}

export function validatePolicyDefinitions(): string[] {
  const errors: string[] = [];
  const cultureNodeIds = new Set(CULTURE_TREE.map((node) => node.id));
  const seenPolicyIds = new Set<string>();

  for (const entry of ALL_POLICIES) {
    if (seenPolicyIds.has(entry.id)) {
      errors.push(`Duplicate policy id: ${entry.id}`);
    }
    seenPolicyIds.add(entry.id);

    if (!cultureNodeIds.has(entry.requiredCultureNodeId)) {
      errors.push(`Policy ${entry.id} references missing culture node: ${entry.requiredCultureNodeId}`);
    }

    if (entry.modifiers.length === 0) {
      errors.push(`Policy ${entry.id} has no modifiers.`);
    }
  }

  return errors;
}
