import type {
  AIMilitaryDoctrine,
  AIMilitaryDoctrineMillitaryBudget,
  AIMilitaryDoctrineProductionBehavior,
  AIMilitaryDoctrineStrategicTolerance,
  AIMilitaryDoctrineTargetComposition,
} from '../types/aiMilitaryDoctrine';

export const DEFAULT_AI_MILITARY_DOCTRINE_ID = 'balanced';

export const DEFAULT_TARGET_COMPOSITION: AIMilitaryDoctrineTargetComposition = {
  melee: 0.35,
  ranged: 0.30,
  mounted: 0.15,
  siege: 0.10,
  navalMelee: 0.05,
  navalRanged: 0.05,
};

export const DEFAULT_MILITARY_BUDGET: AIMilitaryDoctrineMillitaryBudget = {
  strengthMultiplier: 1.0,
  maxUnitsMultiplier: 1.0,
  allowOverbuildingWhenThreatened: true,
};

export const DEFAULT_STRATEGIC_TOLERANCE: AIMilitaryDoctrineStrategicTolerance = {
  minHappinessForMilitaryBuilds: 0,
  minGoldReserveForMilitaryBuilds: 0,
  tolerateWarWeariness: true,
};

export const DEFAULT_PRODUCTION_BEHAVIOR: AIMilitaryDoctrineProductionBehavior = {
  modernizationBias: 1.0,
  quantityBias: 1.0,
  qualityBias: 1.0,
};

export const BALANCED_DOCTRINE: AIMilitaryDoctrine = {
  id: 'balanced',
  name: 'Balanced',
  description: 'Neutral baseline with no strong preference for any unit role or build philosophy.',
  modernizationBias: 1.0,
  quantityBias: 1.0,
  qualityBias: 1.0,
  preferredRoles: {
    melee: 1.0,
    ranged: 1.0,
    mounted: 1.0,
    siege: 1.0,
    navalMelee: 1.0,
    navalRanged: 1.0,
    air: 1.0,
  },
  targetComposition: { melee: 0.30, ranged: 0.30, mounted: 0.20, siege: 0.10, navalMelee: 0.05, navalRanged: 0.05 },
  militaryBudget: { ...DEFAULT_MILITARY_BUDGET },
  strategicTolerance: { ...DEFAULT_STRATEGIC_TOLERANCE },
  productionBehavior: { modernizationBias: 1.0, quantityBias: 1.0, qualityBias: 1.0 },
};

export const STEPPE_HORDE_DOCTRINE: AIMilitaryDoctrine = {
  id: 'steppeHorde',
  name: 'Steppe Horde',
  description: 'Large land army driven by mounted and ranged units. Quantity over quality, low naval presence.',
  modernizationBias: 0.85,
  quantityBias: 1.35,
  qualityBias: 0.8,
  preferredRoles: {
    melee: 0.9,
    ranged: 1.35,
    mounted: 1.8,
    siege: 0.75,
    navalMelee: 0.25,
    navalRanged: 0.25,
    air: 0.8,
  },
  targetComposition: { melee: 0.18, ranged: 0.30, mounted: 0.42, siege: 0.07, navalMelee: 0.015, navalRanged: 0.015 },
  militaryBudget: { strengthMultiplier: 1.4, maxUnitsMultiplier: 1.5, allowOverbuildingWhenThreatened: true },
  strategicTolerance: { minHappinessForMilitaryBuilds: -5, minGoldReserveForMilitaryBuilds: 0, tolerateWarWeariness: true },
  productionBehavior: { modernizationBias: 0.85, quantityBias: 1.35, qualityBias: 0.8 },
};

export const NAVAL_POWER_DOCTRINE: AIMilitaryDoctrine = {
  id: 'navalPower',
  name: 'Naval Power',
  description: 'Strong navy with meaningful modernization and a balanced land component.',
  modernizationBias: 1.2,
  quantityBias: 0.9,
  qualityBias: 1.15,
  preferredRoles: {
    melee: 0.9,
    ranged: 1.0,
    mounted: 0.65,
    siege: 0.85,
    navalMelee: 1.8,
    navalRanged: 1.9,
    air: 1.0,
  },
  targetComposition: { melee: 0.18, ranged: 0.22, mounted: 0.08, siege: 0.10, navalMelee: 0.21, navalRanged: 0.21 },
  militaryBudget: { strengthMultiplier: 1.1, maxUnitsMultiplier: 1.1, allowOverbuildingWhenThreatened: true },
  strategicTolerance: { minHappinessForMilitaryBuilds: 0, minGoldReserveForMilitaryBuilds: 10, tolerateWarWeariness: false },
  productionBehavior: { modernizationBias: 1.2, quantityBias: 0.9, qualityBias: 1.15 },
};

export const CULTURAL_DEFENSE_DOCTRINE: AIMilitaryDoctrine = {
  id: 'culturalDefense',
  name: 'Cultural Defense',
  description: 'Smaller, modern, defensive army leaning on ranged and siege units.',
  modernizationBias: 1.35,
  quantityBias: 0.65,
  qualityBias: 1.45,
  preferredRoles: {
    melee: 0.75,
    ranged: 1.35,
    mounted: 0.65,
    siege: 1.25,
    navalMelee: 0.75,
    navalRanged: 0.8,
    air: 1.0,
  },
  targetComposition: { melee: 0.30, ranged: 0.38, mounted: 0.10, siege: 0.08, navalMelee: 0.07, navalRanged: 0.07 },
  militaryBudget: { strengthMultiplier: 0.8, maxUnitsMultiplier: 0.7, allowOverbuildingWhenThreatened: false },
  strategicTolerance: { minHappinessForMilitaryBuilds: 5, minGoldReserveForMilitaryBuilds: 20, tolerateWarWeariness: false },
  productionBehavior: { modernizationBias: 1.35, quantityBias: 0.65, qualityBias: 1.45 },
};

export const DEFENSIVE_MODERN_DOCTRINE: AIMilitaryDoctrine = {
  id: 'defensiveModern',
  name: 'Defensive Modern',
  description: 'Avoids large armies. Prefers defensive quality and steady modernization.',
  modernizationBias: 1.25,
  quantityBias: 0.55,
  qualityBias: 1.35,
  preferredRoles: {
    melee: 0.8,
    ranged: 1.25,
    mounted: 0.55,
    siege: 0.75,
    navalMelee: 0.75,
    navalRanged: 0.8,
    air: 1.0,
  },
  targetComposition: { melee: 0.18, ranged: 0.36, mounted: 0.05, siege: 0.21, navalMelee: 0.10, navalRanged: 0.10 },
  militaryBudget: { strengthMultiplier: 0.7, maxUnitsMultiplier: 0.6, allowOverbuildingWhenThreatened: false },
  strategicTolerance: { minHappinessForMilitaryBuilds: 10, minGoldReserveForMilitaryBuilds: 30, tolerateWarWeariness: false },
  productionBehavior: { modernizationBias: 1.25, quantityBias: 0.55, qualityBias: 1.35 },
};

export const IMPERIAL_COMBINED_ARMS_DOCTRINE: AIMilitaryDoctrine = {
  id: 'imperialCombinedArms',
  name: 'Imperial Combined Arms',
  description: 'Balanced combined arms with a slight quality bias. Favors melee and siege.',
  modernizationBias: 1.15,
  quantityBias: 0.95,
  qualityBias: 1.15,
  preferredRoles: {
    melee: 1.1,
    ranged: 1.05,
    mounted: 0.9,
    siege: 1.1,
    navalMelee: 0.75,
    navalRanged: 0.75,
    air: 1.0,
  },
  targetComposition: { melee: 0.28, ranged: 0.25, mounted: 0.20, siege: 0.17, navalMelee: 0.05, navalRanged: 0.05 },
  militaryBudget: { strengthMultiplier: 1.2, maxUnitsMultiplier: 1.1, allowOverbuildingWhenThreatened: true },
  strategicTolerance: { minHappinessForMilitaryBuilds: 0, minGoldReserveForMilitaryBuilds: 10, tolerateWarWeariness: true },
  productionBehavior: { modernizationBias: 1.15, quantityBias: 0.95, qualityBias: 1.15 },
};

export const MARITIME_RAIDER_DOCTRINE: AIMilitaryDoctrine = {
  id: 'maritimeRaider',
  name: 'Maritime Raider',
  description: 'Aggressive coastal and naval doctrine with a competent land component.',
  modernizationBias: 1.1,
  quantityBias: 1.0,
  qualityBias: 1.05,
  preferredRoles: {
    melee: 1.0,
    ranged: 1.05,
    mounted: 0.75,
    siege: 0.95,
    navalMelee: 1.45,
    navalRanged: 1.5,
    air: 1.0,
  },
  targetComposition: { melee: 0.16, ranged: 0.24, mounted: 0.08, siege: 0.08, navalMelee: 0.22, navalRanged: 0.22 },
  militaryBudget: { strengthMultiplier: 1.15, maxUnitsMultiplier: 1.2, allowOverbuildingWhenThreatened: true },
  strategicTolerance: { minHappinessForMilitaryBuilds: -5, minGoldReserveForMilitaryBuilds: 0, tolerateWarWeariness: true },
  productionBehavior: { modernizationBias: 1.1, quantityBias: 1.0, qualityBias: 1.05 },
};

export const AI_MILITARY_DOCTRINES: readonly AIMilitaryDoctrine[] = [
  BALANCED_DOCTRINE,
  STEPPE_HORDE_DOCTRINE,
  NAVAL_POWER_DOCTRINE,
  CULTURAL_DEFENSE_DOCTRINE,
  DEFENSIVE_MODERN_DOCTRINE,
  IMPERIAL_COMBINED_ARMS_DOCTRINE,
  MARITIME_RAIDER_DOCTRINE,
];

export function getAIMilitaryDoctrineById(id: string | undefined): AIMilitaryDoctrine {
  return AI_MILITARY_DOCTRINES.find((doctrine) => doctrine.id === id) ?? BALANCED_DOCTRINE;
}
