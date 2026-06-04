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
    siege: 0.65,
    navalMelee: 1.8,
    navalRanged: 2.3,
    air: 1.0,
  },
  targetComposition: { melee: 0.18, ranged: 0.23, mounted: 0.08, siege: 0.06, navalMelee: 0.13, navalRanged: 0.32 },
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

export const DISCIPLINED_INFANTRY_DOCTRINE: AIMilitaryDoctrine = {
  id: 'disciplinedInfantry',
  name: 'Disciplined Infantry',
  description: 'Professional land army centered on melee/ranged infantry and steady modernization.',
  modernizationBias: 1.2,
  quantityBias: 0.9,
  qualityBias: 1.2,
  preferredRoles: {
    melee: 1.35,
    ranged: 1.15,
    mounted: 0.65,
    siege: 1.0,
    navalMelee: 0.65,
    navalRanged: 0.65,
    air: 1.0,
  },
  targetComposition: { melee: 0.38, ranged: 0.30, mounted: 0.08, siege: 0.14, navalMelee: 0.05, navalRanged: 0.05 },
  militaryBudget: { strengthMultiplier: 1.1, maxUnitsMultiplier: 1.0, allowOverbuildingWhenThreatened: true },
  strategicTolerance: { minHappinessForMilitaryBuilds: 0, minGoldReserveForMilitaryBuilds: 10, tolerateWarWeariness: false },
  productionBehavior: { modernizationBias: 1.2, quantityBias: 0.9, qualityBias: 1.2 },
};

export const CHEAP_INFANTRY_SWARM_DOCTRINE: AIMilitaryDoctrine = {
  id: 'cheapInfantrySwarm',
  name: 'Cheap Infantry Swarm',
  description: 'Large low-quality army that accepts instability and prefers many basic land units.',
  modernizationBias: 0.7,
  quantityBias: 1.7,
  qualityBias: 0.55,
  preferredRoles: {
    melee: 1.55,
    ranged: 1.1,
    mounted: 0.55,
    siege: 0.55,
    navalMelee: 0.45,
    navalRanged: 0.35,
    air: 0.6,
  },
  targetComposition: { melee: 0.48, ranged: 0.32, mounted: 0.07, siege: 0.06, navalMelee: 0.04, navalRanged: 0.03 },
  militaryBudget: { strengthMultiplier: 1.2, maxUnitsMultiplier: 1.8, allowOverbuildingWhenThreatened: true },
  strategicTolerance: { minHappinessForMilitaryBuilds: -8, minGoldReserveForMilitaryBuilds: -10, tolerateWarWeariness: true },
  productionBehavior: { modernizationBias: 0.7, quantityBias: 1.7, qualityBias: 0.55 },
};

export const ELITE_ARMY_DOCTRINE: AIMilitaryDoctrine = {
  id: 'eliteArmy',
  name: 'Elite Army',
  description: 'Small, expensive, modern army focused on quality over quantity.',
  modernizationBias: 1.6,
  quantityBias: 0.45,
  qualityBias: 1.8,
  preferredRoles: {
    melee: 1.1,
    ranged: 1.25,
    mounted: 0.9,
    siege: 1.2,
    navalMelee: 0.8,
    navalRanged: 0.9,
    air: 1.3,
  },
  targetComposition: { melee: 0.25, ranged: 0.32, mounted: 0.12, siege: 0.16, navalMelee: 0.07, navalRanged: 0.08 },
  militaryBudget: { strengthMultiplier: 0.9, maxUnitsMultiplier: 0.65, allowOverbuildingWhenThreatened: false },
  strategicTolerance: { minHappinessForMilitaryBuilds: 5, minGoldReserveForMilitaryBuilds: 40, tolerateWarWeariness: false },
  productionBehavior: { modernizationBias: 1.6, quantityBias: 0.45, qualityBias: 1.8 },
};

export const NAVAL_PROJECTION_DOCTRINE: AIMilitaryDoctrine = {
  id: 'navalProjection',
  name: 'Naval Projection',
  description: 'Blue-water power projection with dominant naval forces and a lean land component.',
  modernizationBias: 1.3,
  quantityBias: 0.9,
  qualityBias: 1.25,
  preferredRoles: {
    melee: 0.75,
    ranged: 0.9,
    mounted: 0.45,
    siege: 0.85,
    navalMelee: 2.1,
    navalRanged: 2.2,
    air: 1.1,
  },
  targetComposition: { melee: 0.12, ranged: 0.18, mounted: 0.04, siege: 0.08, navalMelee: 0.28, navalRanged: 0.30 },
  militaryBudget: { strengthMultiplier: 1.2, maxUnitsMultiplier: 1.25, allowOverbuildingWhenThreatened: true },
  strategicTolerance: { minHappinessForMilitaryBuilds: 0, minGoldReserveForMilitaryBuilds: 20, tolerateWarWeariness: false },
  productionBehavior: { modernizationBias: 1.3, quantityBias: 0.9, qualityBias: 1.25 },
};

export const MOUNTED_AGGRESSION_DOCTRINE: AIMilitaryDoctrine = {
  id: 'mountedAggression',
  name: 'Mounted Aggression',
  description: 'Fast offensive land warfare built around dominant mounted forces.',
  modernizationBias: 1.0,
  quantityBias: 1.2,
  qualityBias: 1.0,
  preferredRoles: {
    melee: 0.8,
    ranged: 1.0,
    mounted: 2.25,
    siege: 0.8,
    navalMelee: 0.35,
    navalRanged: 0.35,
    air: 0.9,
  },
  targetComposition: { melee: 0.16, ranged: 0.22, mounted: 0.48, siege: 0.08, navalMelee: 0.03, navalRanged: 0.03 },
  militaryBudget: { strengthMultiplier: 1.35, maxUnitsMultiplier: 1.35, allowOverbuildingWhenThreatened: true },
  strategicTolerance: { minHappinessForMilitaryBuilds: -5, minGoldReserveForMilitaryBuilds: 0, tolerateWarWeariness: true },
  productionBehavior: { modernizationBias: 1.0, quantityBias: 1.2, qualityBias: 1.0 },
};

export const FORTIFIED_DEFENSE_DOCTRINE: AIMilitaryDoctrine = {
  id: 'fortifiedDefense',
  name: 'Fortified Defense',
  description: 'Static garrison defense leaning on ranged and siege units with low offensive mobility.',
  modernizationBias: 1.1,
  quantityBias: 0.85,
  qualityBias: 1.2,
  preferredRoles: {
    melee: 1.15,
    ranged: 1.45,
    mounted: 0.35,
    siege: 1.35,
    navalMelee: 0.75,
    navalRanged: 0.85,
    air: 1.0,
  },
  targetComposition: { melee: 0.30, ranged: 0.38, mounted: 0.04, siege: 0.18, navalMelee: 0.05, navalRanged: 0.05 },
  militaryBudget: { strengthMultiplier: 1.0, maxUnitsMultiplier: 0.9, allowOverbuildingWhenThreatened: true },
  strategicTolerance: { minHappinessForMilitaryBuilds: 2, minGoldReserveForMilitaryBuilds: 15, tolerateWarWeariness: false },
  productionBehavior: { modernizationBias: 1.1, quantityBias: 0.85, qualityBias: 1.2 },
};

export const RELIGIOUS_MILITIA_DOCTRINE: AIMilitaryDoctrine = {
  id: 'religiousMilitia',
  name: 'Religious Militia',
  description: 'Traditional popular army of many melee/ranged units with modest modernization.',
  modernizationBias: 0.85,
  quantityBias: 1.35,
  qualityBias: 0.75,
  preferredRoles: {
    melee: 1.35,
    ranged: 1.25,
    mounted: 0.55,
    siege: 0.75,
    navalMelee: 0.55,
    navalRanged: 0.55,
    air: 0.75,
  },
  targetComposition: { melee: 0.40, ranged: 0.34, mounted: 0.07, siege: 0.09, navalMelee: 0.05, navalRanged: 0.05 },
  militaryBudget: { strengthMultiplier: 1.05, maxUnitsMultiplier: 1.35, allowOverbuildingWhenThreatened: true },
  strategicTolerance: { minHappinessForMilitaryBuilds: -3, minGoldReserveForMilitaryBuilds: 0, tolerateWarWeariness: true },
  productionBehavior: { modernizationBias: 0.85, quantityBias: 1.35, qualityBias: 0.75 },
};

export const ECONOMIC_MINIMAL_ARMY_DOCTRINE: AIMilitaryDoctrine = {
  id: 'economicMinimalArmy',
  name: 'Economic Minimal Army',
  description: 'Very lean army that builds military reluctantly and prioritizes economy unless threatened.',
  modernizationBias: 1.15,
  quantityBias: 0.35,
  qualityBias: 1.25,
  preferredRoles: {
    melee: 0.75,
    ranged: 1.05,
    mounted: 0.45,
    siege: 0.55,
    navalMelee: 0.7,
    navalRanged: 0.75,
    air: 1.0,
  },
  targetComposition: { melee: 0.26, ranged: 0.36, mounted: 0.06, siege: 0.10, navalMelee: 0.11, navalRanged: 0.11 },
  militaryBudget: { strengthMultiplier: 0.55, maxUnitsMultiplier: 0.45, allowOverbuildingWhenThreatened: false },
  strategicTolerance: { minHappinessForMilitaryBuilds: 8, minGoldReserveForMilitaryBuilds: 60, tolerateWarWeariness: false },
  productionBehavior: { modernizationBias: 1.15, quantityBias: 0.35, qualityBias: 1.25 },
};

export const PIRATE_CODE_DOCTRINE: AIMilitaryDoctrine = {
  id: 'pirateCode',
  name: 'Pirate Code',
  description:
    'A fleet of raiders that lives and dies at sea. Overwhelmingly naval, fast and aggressive, with only a token land garrison for the home port.',
  modernizationBias: 1.1,
  quantityBias: 1.3,
  qualityBias: 1.0,
  preferredRoles: {
    melee: 0.5,
    ranged: 0.55,
    mounted: 0.2,
    siege: 0.3,
    navalMelee: 2.4,
    navalRanged: 2.0,
    air: 0.6,
  },
  targetComposition: { melee: 0.08, ranged: 0.08, mounted: 0.02, siege: 0.02, navalMelee: 0.46, navalRanged: 0.34 },
  militaryBudget: { strengthMultiplier: 1.3, maxUnitsMultiplier: 1.5, allowOverbuildingWhenThreatened: true },
  strategicTolerance: { minHappinessForMilitaryBuilds: -8, minGoldReserveForMilitaryBuilds: 0, tolerateWarWeariness: true },
  productionBehavior: { modernizationBias: 1.1, quantityBias: 1.3, qualityBias: 1.0 },
};

export const AI_MILITARY_DOCTRINES: readonly AIMilitaryDoctrine[] = [
  BALANCED_DOCTRINE,
  STEPPE_HORDE_DOCTRINE,
  NAVAL_POWER_DOCTRINE,
  CULTURAL_DEFENSE_DOCTRINE,
  DEFENSIVE_MODERN_DOCTRINE,
  IMPERIAL_COMBINED_ARMS_DOCTRINE,
  MARITIME_RAIDER_DOCTRINE,
  DISCIPLINED_INFANTRY_DOCTRINE,
  CHEAP_INFANTRY_SWARM_DOCTRINE,
  ELITE_ARMY_DOCTRINE,
  NAVAL_PROJECTION_DOCTRINE,
  MOUNTED_AGGRESSION_DOCTRINE,
  FORTIFIED_DEFENSE_DOCTRINE,
  RELIGIOUS_MILITIA_DOCTRINE,
  ECONOMIC_MINIMAL_ARMY_DOCTRINE,
  PIRATE_CODE_DOCTRINE,
];

export function getAIMilitaryDoctrineById(id: string | undefined): AIMilitaryDoctrine {
  return AI_MILITARY_DOCTRINES.find((doctrine) => doctrine.id === id) ?? BALANCED_DOCTRINE;
}
