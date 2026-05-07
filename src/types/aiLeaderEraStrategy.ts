import type { Era } from '../data/technologies';

export type AILeaderEraStrategyId =
  | 'frontierExpansion'
  | 'coastalFoundation'
  | 'coastalTechEconomy'
  | 'imperialInfrastructure'
  | 'balancedGrowth'
  | 'militaryPreparation'
  | 'conquestCampaign'
  | 'defensiveBuilder'
  | 'navalExpansion'
  | 'scientificDevelopment'
  | 'civicDevelopment'
  | 'tallGrowth';

export interface AILeaderEraProductionWeights {
  settler: number;
  scout: number;
  military: number;
  melee: number;
  ranged: number;
  naval: number;
  foodBuilding: number;
  productionBuilding: number;
  scienceBuilding?: number;
  goldBuilding: number;
  happinessBuilding: number;
  wonder: number;
  worker?: number;
  workBoat?: number;
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

export interface AILeaderEraFoundingRules {
  minCityDistance?: number;
}

export interface AILeaderEraResourcePriorities {
  seaResourceExploitation?: number;
  workBoatProduction?: number;
}

export interface AILeaderEraTilePurchasePreferences {
  minGoldReserve?: number;
  minScore?: number;
}

export interface AILeaderEraHappinessBehavior {
  stabilizationThreshold?: number;
  criticalThreshold?: number;
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
  foundingRules?: AILeaderEraFoundingRules;
  resourcePriorities?: AILeaderEraResourcePriorities;
  tilePurchase?: AILeaderEraTilePurchasePreferences;
  happinessBehavior?: AILeaderEraHappinessBehavior;
}

export interface LeaderEraStrategyProfile {
  leaderId: string;
  strategiesByEra: Partial<Record<Era, AILeaderEraStrategyId>>;
}
