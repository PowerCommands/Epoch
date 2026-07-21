export const AEROSPACE_INDUSTRIES_ID = 'aerospace_industries';
export const AEROSPACE_PARTS_ID = 'aerospace_parts';
export const DEFAULT_REQUIRED_AEROSPACE_PARTS = 10;
export const AEROSPACE_INDUSTRIES_PART_PRODUCTION_BONUS_PERCENT = 50;

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
  productionCost: 300,
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

