import type { Era } from '../data/technologies';

export type AILeaderEraStrategyId =
  | 'frontierExpansion'
  | 'balancedGrowth'
  | 'militaryPreparation'
  | 'conquestCampaign'
  | 'defensiveBuilder'
  | 'navalExpansion'
  | 'scientificDevelopment'
  | 'civicDevelopment';

export interface AILeaderEraProductionWeights {
  settler: number;
  scout: number;
  military: number;
  melee: number;
  ranged: number;
  naval: number;
  foodBuilding: number;
  productionBuilding: number;
  goldBuilding: number;
  happinessBuilding: number;
  wonder: number;
}

export interface AILeaderEraResearchWeights {
  food: number;
  production: number;
  military: number;
  naval: number;
  economy: number;
  science: number;
  expansion: number;
}

export interface AILeaderEraCultureWeights {
  expansion: number;
  diplomacy: number;
  military: number;
  happiness: number;
  economy: number;
}

export interface AILeaderEraDiplomacyWeights {
  openBorders: number;
  embassy: number;
  trade: number;
  war: number;
}

export interface AILeaderEraMilitaryBehavior {
  prepareForWar: boolean;
  targetWeakNeighbor: boolean;
  preferCapitalTargets: boolean;
  minimumMilitaryReadiness: number;
}

export interface AILeaderEraFoundingPreferences {
  strategicResource?: number;
  luxuryResource?: number;
  coastalAccess?: number;
  waterResource?: number;
  foodYield?: number;
  productionYield?: number;
  distancePenalty?: number;
}

export interface AILeaderEraStrategy {
  id: AILeaderEraStrategyId;
  name: string;
  description: string;
  productionWeights: AILeaderEraProductionWeights;
  researchWeights: AILeaderEraResearchWeights;
  cultureWeights: AILeaderEraCultureWeights;
  diplomacyWeights: AILeaderEraDiplomacyWeights;
  militaryBehavior: AILeaderEraMilitaryBehavior;
  foundingPreferences?: AILeaderEraFoundingPreferences;
}

export interface LeaderEraStrategyProfile {
  leaderId: string;
  strategiesByEra: Partial<Record<Era, AILeaderEraStrategyId>>;
}
