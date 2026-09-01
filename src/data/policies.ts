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
    id: 'foreign_intelligence',
    name: 'Foreign Intelligence',
    category: 'diplomatic',
    requiredCultureNodeId: 'colonialism',
    description: 'Spies, Agents, Partisans and Rebels cost 50% less Production.',
    modifiers: [{
      type: 'unitProductionCostPercent',
      unitTypeIds: ['spy', 'agent', 'partisans', 'rebels'],
      value: -50,
    }],
  }),
  policy({
    id: 'backroom_diplomacy',
    name: 'Backroom Diplomacy',
    category: 'diplomatic',
    requiredCultureNodeId: 'ideology',
    description: 'Gossip Manipulation costs 50% less Influence.',
    modifiers: [{ type: 'gossipManipulationInfluenceCostPercent', value: -50 }],
  }),
  policy({
    id: 'economic_imperialism',
    name: 'Economic Imperialism',
    category: 'diplomatic',
    requiredCultureNodeId: 'class_struggle',
    description: 'Resources exploited through Foreign Resource Exploitation Rights provide 50% more yield.',
    modifiers: [{ type: 'foreignExploitationYieldPercent', value: 50 }],
  }),
  policy({
    id: 'international_lobbying',
    name: 'International Lobbying',
    category: 'diplomatic',
    requiredCultureNodeId: 'suffrage',
    description: '+50% Influence generation while a World Council vote is active.',
    modifiers: [{ type: 'activeWorldCouncilVoteInfluencePercent', value: 50 }],
  }),
  policy({
    id: 'proxy_warfare',
    name: 'Proxy Warfare',
    category: 'diplomatic',
    requiredCultureNodeId: 'cold_war',
    description: 'Partisans and Rebels are 50% more effective in foreign territory.',
    modifiers: [{ type: 'foreignInsurgentEffectivenessPercent', value: 50 }],
  }),

  policy({
    id: 'aleksandr_barelin',
    name: 'Aleksandr Barelin',
    category: 'culture',
    requiredCultureNodeId: 'games_recreation',
    description: '+100 score in Wrestling during Games of Nations.',
    modifiers: [{ type: 'gamesOfNationsSportScoreBonus', sportId: 'wrestling', value: 100 }],
    humanOnly: true,
  }),
  policy({
    id: 'eliud_kiprun',
    name: 'Eliud Kiprun',
    category: 'culture',
    requiredCultureNodeId: 'drama_civics',
    description: '+100 score in Marathon during Games of Nations.',
    modifiers: [{ type: 'gamesOfNationsSportScoreBonus', sportId: 'marathon', value: 100 }],
    humanOnly: true,
  }),
  policy({
    id: 'michael_pelps',
    name: 'Michael Pelps',
    category: 'culture',
    requiredCultureNodeId: 'foreign_trade',
    description: '+100 score in Swimming during Games of Nations.',
    modifiers: [{ type: 'gamesOfNationsSportScoreBonus', sportId: 'swimming', value: 100 }],
    humanOnly: true,
  }),
  policy({
    id: 'jan_zeleznyx',
    name: 'Jan Zeleznyx',
    category: 'culture',
    requiredCultureNodeId: 'theology_civics',
    description: '+100 score in Javelin during Games of Nations.',
    modifiers: [{ type: 'gamesOfNationsSportScoreBonus', sportId: 'javelin', value: 100 }],
    humanOnly: true,
  }),
  policy({
    id: 'carl_leaps',
    name: 'Carl Leaps',
    category: 'culture',
    requiredCultureNodeId: 'feudalism',
    description: '+100 score in Long Jump during Games of Nations.',
    modifiers: [{ type: 'gamesOfNationsSportScoreBonus', sportId: 'long_jump', value: 100 }],
    humanOnly: true,
  }),
  policy({
    id: 'kim_true_shot',
    name: 'Kim True-Shot',
    category: 'culture',
    requiredCultureNodeId: 'guilds',
    description: '+100 score in Archery during Games of Nations.',
    modifiers: [{ type: 'gamesOfNationsSportScoreBonus', sportId: 'archery', value: 100 }],
    humanOnly: true,
  }),
  policy({
    id: 'isabella_worth',
    name: 'Isabella Worth',
    category: 'culture',
    requiredCultureNodeId: 'exploration',
    description: '+100 score in Equestrian during Games of Nations.',
    modifiers: [{ type: 'gamesOfNationsSportScoreBonus', sportId: 'equestrian', value: 100 }],
    humanOnly: true,
  }),
  policy({
    id: 'edoardo_blademari',
    name: 'Edoardo Blademari',
    category: 'culture',
    requiredCultureNodeId: 'humanism',
    description: '+100 score in Fencing during Games of Nations.',
    modifiers: [{ type: 'gamesOfNationsSportScoreBonus', sportId: 'fencing', value: 100 }],
    humanOnly: true,
  }),
  policy({
    id: 'eddy_mercxwell',
    name: 'Eddy Mercxwell',
    category: 'culture',
    requiredCultureNodeId: 'natural_history',
    description: '+100 score in Cycling during Games of Nations.',
    modifiers: [{ type: 'gamesOfNationsSportScoreBonus', sportId: 'cycling', value: 100 }],
    humanOnly: true,
  }),
  policy({
    id: 'simone_flies',
    name: 'Simone Flies',
    category: 'culture',
    requiredCultureNodeId: 'opera_ballet',
    description: '+100 score in Gymnastics during Games of Nations.',
    modifiers: [{ type: 'gamesOfNationsSportScoreBonus', sportId: 'gymnastics', value: 100 }],
    humanOnly: true,
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
