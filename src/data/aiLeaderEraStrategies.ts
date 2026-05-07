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

export const COASTAL_FOUNDATION_STRATEGY: AILeaderEraStrategy = {
  id: 'coastalFoundation',
  name: 'Coastal Foundation',
  description:
    'Ancient coastal expansion strategy focused on locating coastlines, founding cities near water, preparing for Sailing, and enabling later naval recon/work boat play.',
  productionWeights: {
    settler: 1.25,
    scout: 1.1,
    military: 0.85,
    melee: 0.85,
    ranged: 0.95,
    naval: 1.2,
    foodBuilding: 1.0,
    productionBuilding: 1.0,
    goldBuilding: 1.05,
    happinessBuilding: 1.0,
    wonder: 0.9,
  },
  researchWeights: {
    food: 1.0,
    production: 1.0,
    military: 0.8,
    naval: 1.6,
    economy: 1.1,
    science: 1.0,
    expansion: 1.2,
  },
  cultureWeights: {
    expansion: 1.2,
    diplomacy: 1.0,
    military: 0.8,
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
    strategicResource: 0.8,
    luxuryResource: 1.1,
    coastalAccess: 2.0,
    waterResource: 1.6,
    foodYield: 1.1,
    productionYield: 1.0,
    distancePenalty: 0.8,
  },
  foundingRules: {
    minCityDistance: 6,
  },
  resourcePriorities: {
    seaResourceExploitation: 1.8,
    workBoatProduction: 1.6,
  },
};

export const COASTAL_TECH_ECONOMY_STRATEGY: AILeaderEraStrategy = {
  ...COASTAL_FOUNDATION_STRATEGY,
  id: 'coastalTechEconomy',
  name: 'Coastal Tech Economy',
  description:
    'Compact coastal development strategy layered on Coastal Foundation, focused on science, trade, food, sea resources, and defensive economic growth.',
  productionWeights: {
    ...COASTAL_FOUNDATION_STRATEGY.productionWeights,
    settler: 0.95,
    military: 0.65,
    melee: 0.65,
    ranged: 0.9,
    naval: 1.0,
    foodBuilding: 1.35,
    productionBuilding: 1.1,
    scienceBuilding: 1.55,
    goldBuilding: 1.45,
    happinessBuilding: 1.25,
    wonder: 0.85,
    worker: 1.15,
    workBoat: 1.65,
  },
  researchWeights: {
    ...COASTAL_FOUNDATION_STRATEGY.researchWeights,
    food: 1.25,
    production: 1.0,
    military: 0.6,
    naval: 1.35,
    economy: 1.45,
    science: 1.6,
    expansion: 0.95,
  },
  cultureWeights: {
    ...COASTAL_FOUNDATION_STRATEGY.cultureWeights,
    expansion: 0.9,
    diplomacy: 1.15,
    military: 0.55,
    happiness: 1.2,
    economy: 1.35,
  },
  diplomacyWeights: {
    ...COASTAL_FOUNDATION_STRATEGY.diplomacyWeights,
    openBorders: 1.05,
    embassy: 1.1,
    trade: 1.3,
    war: 0.2,
  },
  militaryBehavior: {
    ...COASTAL_FOUNDATION_STRATEGY.militaryBehavior,
    minimumMilitaryReadiness: 0.9,
  },
  foundingPreferences: {
    ...COASTAL_FOUNDATION_STRATEGY.foundingPreferences,
    strategicResource: 0.75,
    luxuryResource: 1.15,
    coastalAccess: 1.85,
    waterResource: 1.9,
    foodYield: 1.4,
    productionYield: 0.95,
    distancePenalty: 1.2,
  },
  foundingRules: {
    minCityDistance: 7,
  },
  resourcePriorities: {
    ...COASTAL_FOUNDATION_STRATEGY.resourcePriorities,
    seaResourceExploitation: 2.25,
    workBoatProduction: 2.05,
  },
  tilePurchase: {
    minGoldReserve: 110,
    minScore: 55,
  },
  happinessBehavior: {
    stabilizationThreshold: 4,
    criticalThreshold: 0,
  },
};

export const TALL_GROWTH_STRATEGY: AILeaderEraStrategy = {
  id: 'tallGrowth',
  name: 'Tall Growth',
  description:
    'Peaceful tall-growth strategy focused on population, production, happiness stability, active workers, and selective tile purchases.',
  productionWeights: {
    settler: 0.85,
    scout: 0.85,
    military: 0.35,
    melee: 0.35,
    ranged: 0.45,
    naval: 0.45,
    foodBuilding: 1.6,
    productionBuilding: 1.5,
    goldBuilding: 1.15,
    happinessBuilding: 1.8,
    wonder: 0.75,
    worker: 1.8,
    workBoat: 1.3,
  },
  researchWeights: {
    food: 1.4,
    production: 1.35,
    military: 0.45,
    naval: 0.75,
    economy: 1.2,
    science: 1.0,
    expansion: 0.9,
  },
  cultureWeights: {
    expansion: 0.9,
    diplomacy: 1.15,
    military: 0.35,
    happiness: 1.6,
    economy: 1.2,
  },
  diplomacyWeights: {
    openBorders: 1.2,
    embassy: 1.2,
    trade: 1.3,
    war: 0.15,
  },
  militaryBehavior: {
    prepareForWar: false,
    targetWeakNeighbor: false,
    preferCapitalTargets: false,
    minimumMilitaryReadiness: 0.65,
  },
  foundingPreferences: {
    strategicResource: 0.8,
    luxuryResource: 1.4,
    coastalAccess: 0.7,
    waterResource: 0.9,
    foodYield: 1.6,
    productionYield: 1.45,
    distancePenalty: 1.0,
  },
  resourcePriorities: {
    workBoatProduction: 1.3,
  },
  tilePurchase: {
    minGoldReserve: 100,
    minScore: 45,
  },
  happinessBehavior: {
    stabilizationThreshold: 5,
    criticalThreshold: 0,
  },
};

export const IMPERIAL_INFRASTRUCTURE_STRATEGY: AILeaderEraStrategy = {
  id: 'imperialInfrastructure',
  name: 'Imperial Infrastructure',
  description:
    'Structured imperial development strategy focused on controlled expansion, production, workers, science, infrastructure, and defensive readiness.',
  productionWeights: {
    settler: 1.15,
    scout: 1.0,
    military: 0.85,
    melee: 0.9,
    ranged: 1.05,
    naval: 0.75,
    foodBuilding: 1.1,
    productionBuilding: 1.55,
    goldBuilding: 1.15,
    happinessBuilding: 1.15,
    wonder: 1.1,
    worker: 1.45,
    workBoat: 0.8,
  },
  researchWeights: {
    food: 1.05,
    production: 1.45,
    military: 0.9,
    naval: 0.65,
    economy: 1.2,
    science: 1.35,
    expansion: 1.1,
  },
  cultureWeights: {
    expansion: 1.15,
    diplomacy: 0.85,
    military: 0.8,
    happiness: 1.05,
    economy: 1.25,
  },
  diplomacyWeights: {
    openBorders: 0.8,
    embassy: 1.0,
    trade: 1.15,
    war: 0.45,
  },
  militaryBehavior: {
    prepareForWar: false,
    targetWeakNeighbor: false,
    preferCapitalTargets: false,
    minimumMilitaryReadiness: 1.05,
  },
  foundingPreferences: {
    strategicResource: 1.25,
    luxuryResource: 1.05,
    coastalAccess: 0.55,
    waterResource: 0.65,
    foodYield: 1.15,
    productionYield: 1.55,
    distancePenalty: 1.15,
  },
  foundingRules: {
    minCityDistance: 8,
  },
  tilePurchase: {
    minGoldReserve: 125,
    minScore: 60,
  },
  happinessBehavior: {
    stabilizationThreshold: 3,
    criticalThreshold: 0,
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
  COASTAL_FOUNDATION_STRATEGY,
  COASTAL_TECH_ECONOMY_STRATEGY,
  TALL_GROWTH_STRATEGY,
  IMPERIAL_INFRASTRUCTURE_STRATEGY,
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
  coastalFoundation: COASTAL_FOUNDATION_STRATEGY,
  coastalTechEconomy: COASTAL_TECH_ECONOMY_STRATEGY,
  tallGrowth: TALL_GROWTH_STRATEGY,
  imperialInfrastructure: IMPERIAL_INFRASTRUCTURE_STRATEGY,
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
  {
    leaderId: 'leader_oda-nobunaga',
    strategiesByEra: {
      ancient: 'coastalFoundation',
    },
  },
  {
    leaderId: 'leader_mahatma-gandhi',
    strategiesByEra: {
      ancient: 'tallGrowth',
    },
  },
  {
    leaderId: 'leader_qin-shi-huang',
    strategiesByEra: {
      ancient: 'imperialInfrastructure',
    },
  },
  {
    leaderId: 'leader_koxinga',
    strategiesByEra: {
      ancient: 'coastalTechEconomy',
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
