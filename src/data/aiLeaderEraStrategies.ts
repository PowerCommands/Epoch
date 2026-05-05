import type { Era } from './technologies';
import type {
  AILeaderEraStrategy,
  AILeaderEraStrategyId,
  LeaderEraStrategyProfile,
} from '../types/aiLeaderEraStrategy';

const NEUTRAL_PRODUCTION = {
  settler: 1.0,
  scout: 1.0,
  military: 1.0,
  melee: 1.0,
  ranged: 1.0,
  naval: 1.0,
  foodBuilding: 1.0,
  productionBuilding: 1.0,
  goldBuilding: 1.0,
  happinessBuilding: 1.0,
  wonder: 1.0,
} as const;

const NEUTRAL_RESEARCH = {
  food: 1.0,
  production: 1.0,
  military: 1.0,
  naval: 1.0,
  economy: 1.0,
  science: 1.0,
  expansion: 1.0,
} as const;

const NEUTRAL_CULTURE = {
  expansion: 1.0,
  diplomacy: 1.0,
  military: 1.0,
  happiness: 1.0,
  economy: 1.0,
} as const;

const NEUTRAL_DIPLOMACY = {
  openBorders: 1.0,
  embassy: 1.0,
  trade: 1.0,
  war: 1.0,
} as const;

const NEUTRAL_MILITARY = {
  prepareForWar: false,
  targetWeakNeighbor: false,
  preferCapitalTargets: false,
  minimumMilitaryReadiness: 1.0,
} as const;

export const FRONTIER_EXPANSION_STRATEGY: AILeaderEraStrategy = {
  id: 'frontierExpansion',
  name: 'Frontier Expansion',
  description:
    'Early foundation strategy focused on founding cities, scouting territory, securing resources, and staying stable before later military escalation.',
  productionWeights: {
    settler: 1.35,
    scout: 1.25,
    military: 0.9,
    melee: 0.9,
    ranged: 1.0,
    naval: 0.8,
    foodBuilding: 1.0,
    productionBuilding: 1.0,
    goldBuilding: 1.0,
    happinessBuilding: 1.0,
    wonder: 0.8,
  },
  researchWeights: {
    food: 1.15,
    production: 1.05,
    military: 0.9,
    naval: 0.8,
    economy: 1.0,
    science: 1.0,
    expansion: 1.25,
  },
  cultureWeights: {
    expansion: 1.3,
    diplomacy: 1.0,
    military: 0.9,
    happiness: 1.0,
    economy: 1.0,
  },
  diplomacyWeights: {
    openBorders: 1.0,
    embassy: 1.0,
    trade: 1.0,
    war: 0.35,
  },
  militaryBehavior: {
    prepareForWar: false,
    targetWeakNeighbor: false,
    preferCapitalTargets: false,
    minimumMilitaryReadiness: 0.8,
  },
  foundingPreferences: {
    strategicResource: 1.4,
    luxuryResource: 1.0,
    coastalAccess: 0.6,
    waterResource: 0.8,
    foodYield: 1.0,
    productionYield: 1.2,
    distancePenalty: 0.8,
  },
};

export const BALANCED_GROWTH_STRATEGY: AILeaderEraStrategy = {
  id: 'balancedGrowth',
  name: 'Balanced Growth',
  description: 'Neutral baseline. No category is pushed; existing AI scoring is preserved.',
  productionWeights: { ...NEUTRAL_PRODUCTION },
  researchWeights: { ...NEUTRAL_RESEARCH },
  cultureWeights: { ...NEUTRAL_CULTURE },
  diplomacyWeights: { ...NEUTRAL_DIPLOMACY },
  militaryBehavior: { ...NEUTRAL_MILITARY },
};

export const MILITARY_PREPARATION_STRATEGY: AILeaderEraStrategy = {
  id: 'militaryPreparation',
  name: 'Military Preparation',
  description: 'Placeholder — biases toward building an army before committing to war.',
  productionWeights: { ...NEUTRAL_PRODUCTION },
  researchWeights: { ...NEUTRAL_RESEARCH },
  cultureWeights: { ...NEUTRAL_CULTURE },
  diplomacyWeights: { ...NEUTRAL_DIPLOMACY },
  militaryBehavior: { ...NEUTRAL_MILITARY },
};

export const CONQUEST_CAMPAIGN_STRATEGY: AILeaderEraStrategy = {
  id: 'conquestCampaign',
  name: 'Conquest Campaign',
  description: 'Placeholder — active offensive posture targeting weak neighbors.',
  productionWeights: { ...NEUTRAL_PRODUCTION },
  researchWeights: { ...NEUTRAL_RESEARCH },
  cultureWeights: { ...NEUTRAL_CULTURE },
  diplomacyWeights: { ...NEUTRAL_DIPLOMACY },
  militaryBehavior: { ...NEUTRAL_MILITARY },
};

export const DEFENSIVE_BUILDER_STRATEGY: AILeaderEraStrategy = {
  id: 'defensiveBuilder',
  name: 'Defensive Builder',
  description: 'Placeholder — favors defensive infrastructure and stable borders.',
  productionWeights: { ...NEUTRAL_PRODUCTION },
  researchWeights: { ...NEUTRAL_RESEARCH },
  cultureWeights: { ...NEUTRAL_CULTURE },
  diplomacyWeights: { ...NEUTRAL_DIPLOMACY },
  militaryBehavior: { ...NEUTRAL_MILITARY },
};

export const NAVAL_EXPANSION_STRATEGY: AILeaderEraStrategy = {
  id: 'navalExpansion',
  name: 'Naval Expansion',
  description: 'Placeholder — emphasizes maritime reach and overseas presence.',
  productionWeights: { ...NEUTRAL_PRODUCTION },
  researchWeights: { ...NEUTRAL_RESEARCH },
  cultureWeights: { ...NEUTRAL_CULTURE },
  diplomacyWeights: { ...NEUTRAL_DIPLOMACY },
  militaryBehavior: { ...NEUTRAL_MILITARY },
};

export const SCIENTIFIC_DEVELOPMENT_STRATEGY: AILeaderEraStrategy = {
  id: 'scientificDevelopment',
  name: 'Scientific Development',
  description: 'Placeholder — biases toward research output and science infrastructure.',
  productionWeights: { ...NEUTRAL_PRODUCTION },
  researchWeights: { ...NEUTRAL_RESEARCH },
  cultureWeights: { ...NEUTRAL_CULTURE },
  diplomacyWeights: { ...NEUTRAL_DIPLOMACY },
  militaryBehavior: { ...NEUTRAL_MILITARY },
};

export const CIVIC_DEVELOPMENT_STRATEGY: AILeaderEraStrategy = {
  id: 'civicDevelopment',
  name: 'Civic Development',
  description: 'Placeholder — biases toward culture, happiness, and civic policies.',
  productionWeights: { ...NEUTRAL_PRODUCTION },
  researchWeights: { ...NEUTRAL_RESEARCH },
  cultureWeights: { ...NEUTRAL_CULTURE },
  diplomacyWeights: { ...NEUTRAL_DIPLOMACY },
  militaryBehavior: { ...NEUTRAL_MILITARY },
};

export const ALL_AI_LEADER_ERA_STRATEGIES: readonly AILeaderEraStrategy[] = [
  FRONTIER_EXPANSION_STRATEGY,
  BALANCED_GROWTH_STRATEGY,
  MILITARY_PREPARATION_STRATEGY,
  CONQUEST_CAMPAIGN_STRATEGY,
  DEFENSIVE_BUILDER_STRATEGY,
  NAVAL_EXPANSION_STRATEGY,
  SCIENTIFIC_DEVELOPMENT_STRATEGY,
  CIVIC_DEVELOPMENT_STRATEGY,
];

const STRATEGY_BY_ID: Record<AILeaderEraStrategyId, AILeaderEraStrategy> = {
  frontierExpansion: FRONTIER_EXPANSION_STRATEGY,
  balancedGrowth: BALANCED_GROWTH_STRATEGY,
  militaryPreparation: MILITARY_PREPARATION_STRATEGY,
  conquestCampaign: CONQUEST_CAMPAIGN_STRATEGY,
  defensiveBuilder: DEFENSIVE_BUILDER_STRATEGY,
  navalExpansion: NAVAL_EXPANSION_STRATEGY,
  scientificDevelopment: SCIENTIFIC_DEVELOPMENT_STRATEGY,
  civicDevelopment: CIVIC_DEVELOPMENT_STRATEGY,
};

export const LEADER_ERA_STRATEGY_PROFILES: readonly LeaderEraStrategyProfile[] = [
  {
    leaderId: 'leader_genghis-khan',
    strategiesByEra: {
      ancient: 'frontierExpansion',
    },
  },
];

const ERA_ORDER: readonly Era[] = [
  'ancient',
  'classical',
  'medieval',
  'renaissance',
  'industrial',
  'modern',
  'atomic',
  'information',
  'future',
];

export function getAILeaderEraStrategyById(id: AILeaderEraStrategyId): AILeaderEraStrategy {
  return STRATEGY_BY_ID[id] ?? BALANCED_GROWTH_STRATEGY;
}

export function getLeaderEraStrategyProfile(
  leaderId: string | undefined,
): LeaderEraStrategyProfile | undefined {
  if (!leaderId) return undefined;
  return LEADER_ERA_STRATEGY_PROFILES.find((profile) => profile.leaderId === leaderId);
}

/**
 * Resolve the active era strategy for a leader. Falls back to the most recent
 * earlier-era assignment if the current era has none configured, and finally
 * to balancedGrowth so callers always receive a usable preset.
 */
export function resolveLeaderEraStrategy(
  leaderId: string | undefined,
  era: Era,
): AILeaderEraStrategy {
  const profile = getLeaderEraStrategyProfile(leaderId);
  if (!profile) return BALANCED_GROWTH_STRATEGY;

  const direct = profile.strategiesByEra[era];
  if (direct) return getAILeaderEraStrategyById(direct);

  const currentRank = ERA_ORDER.indexOf(era);
  if (currentRank > 0) {
    for (let rank = currentRank - 1; rank >= 0; rank -= 1) {
      const earlier = ERA_ORDER[rank];
      const earlierStrategy = profile.strategiesByEra[earlier];
      if (earlierStrategy) return getAILeaderEraStrategyById(earlierStrategy);
    }
  }

  return BALANCED_GROWTH_STRATEGY;
}
