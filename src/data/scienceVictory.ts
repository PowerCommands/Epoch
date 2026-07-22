export const AEROSPACE_INDUSTRIES_ID = 'aerospace_industries';
export const AEROSPACE_PARTS_ID = 'aerospace_parts';
export const DEFAULT_REQUIRED_AEROSPACE_PARTS = 10;
export const AEROSPACE_INDUSTRIES_PART_PRODUCTION_BONUS_PERCENT = 50;
export const AEROSPACE_PART_BASE_PRODUCTION_COST = 1200;
export const AEROSPACE_PART_COST_GROWTH_RATE = 0.10;

export interface AerospacePartCostConfiguration {
  readonly baseProductionCost: number;
  readonly growthRate: number;
}

export const AEROSPACE_PART_COST_CONFIGURATION: AerospacePartCostConfiguration = {
  baseProductionCost: AEROSPACE_PART_BASE_PRODUCTION_COST,
  growthRate: AEROSPACE_PART_COST_GROWTH_RATE,
};

/**
 * Base (pre-game-speed) production cost for a nation's next Aerospace Part.
 * Completed-part progress is national, so nations entering the race later
 * still begin at the lower end of the curve.
 */
export function calculateAerospacePartProductionCost(
  completedParts: number,
  configuration: AerospacePartCostConfiguration = AEROSPACE_PART_COST_CONFIGURATION,
): number {
  const normalizedCompletedParts = Math.max(0, Math.floor(completedParts));
  const normalizedBaseCost = Math.max(1, configuration.baseProductionCost);
  const normalizedGrowthRate = Math.max(0, configuration.growthRate);
  return Math.max(
    1,
    Math.round(normalizedBaseCost * ((1 + normalizedGrowthRate) ** normalizedCompletedParts)),
  );
}

export interface ManufacturedResourceProductionDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly productionCost: number;
  readonly requiredTechIds: readonly string[];
  readonly requiredResourceIds: readonly string[];
  readonly requiredBuildingId: string;
}

export const AEROSPACE_PART_PRODUCTION: ManufacturedResourceProductionDefinition = {
  id: AEROSPACE_PARTS_ID,
  name: 'Aerospace Part',
  description: 'Manufacture one Aerospace Part for the global space race.',
  productionCost: AEROSPACE_PART_BASE_PRODUCTION_COST,
  requiredTechIds: ['flight'],
  requiredResourceIds: ['aluminum'],
  requiredBuildingId: 'factory',
};

/** Natural resources whose global availability is mandatory for Science Victory. */
export const SCIENCE_VICTORY_REQUIRED_NATURAL_RESOURCE_IDS = [
  ...AEROSPACE_PART_PRODUCTION.requiredResourceIds,
] as const;

/**
 * Additive Aluminum sources for the space race. The base spreads access across
 * roughly one region per three nations; longer part races add one source per
 * five required completions beyond the first five-part tier.
 */
export function getScienceVictoryResourceBonusCount(
  activeNationCount: number,
  requiredAerospaceParts: number = DEFAULT_REQUIRED_AEROSPACE_PARTS,
): number {
  const regionalAvailability = Math.ceil(Math.max(0, activeNationCount) / 3);
  const requirementTiers = Math.max(1, Math.ceil(Math.max(1, requiredAerospaceParts) / 5));
  return Math.max(2, regionalAvailability + requirementTiers - 1);
}
