import type { AIMilitaryDoctrine } from '../types/aiMilitaryDoctrine';

export const DEFAULT_AI_MILITARY_DOCTRINE_ID = 'balanced';

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
