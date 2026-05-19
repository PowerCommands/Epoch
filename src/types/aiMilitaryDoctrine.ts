export type AIMilitaryDoctrineRole =
  | 'melee'
  | 'ranged'
  | 'mounted'
  | 'siege'
  | 'navalMelee'
  | 'navalRanged'
  | 'air';

export type AIMilitaryDoctrineTargetComposition = Partial<Record<AIMilitaryDoctrineRole, number>>;

export interface AIMilitaryDoctrineMillitaryBudget {
  readonly strengthMultiplier: number;
  readonly maxUnitsMultiplier: number;
  readonly allowOverbuildingWhenThreatened: boolean;
}

export interface AIMilitaryDoctrineStrategicTolerance {
  readonly minHappinessForMilitaryBuilds: number;
  readonly minGoldReserveForMilitaryBuilds: number;
  readonly tolerateWarWeariness: boolean;
}

export interface AIMilitaryDoctrineProductionBehavior {
  readonly modernizationBias: number;
  readonly quantityBias: number;
  readonly qualityBias: number;
}

export interface AIMilitaryRolePreferences {
  readonly melee: number;
  readonly ranged: number;
  readonly mounted: number;
  readonly siege: number;
  readonly navalMelee: number;
  readonly navalRanged: number;
  readonly air: number;
}

export interface DoctrineProductionScoreBreakdown {
  readonly doctrineId: string;
  readonly role: AIMilitaryDoctrineRole | null;
  readonly preferredRoleMultiplier: number;
  readonly roleDeficitMultiplier: number;
  readonly pressureModifier: number;
  readonly reasonParts: readonly string[];
}

export interface AIMilitaryDoctrine {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** @deprecated Use productionBehavior.modernizationBias */
  readonly modernizationBias: number;
  /** @deprecated Use productionBehavior.quantityBias */
  readonly quantityBias: number;
  /** @deprecated Use productionBehavior.qualityBias */
  readonly qualityBias: number;
  readonly preferredRoles: AIMilitaryRolePreferences;
  readonly targetComposition: AIMilitaryDoctrineTargetComposition;
  readonly militaryBudget: AIMilitaryDoctrineMillitaryBudget;
  readonly strategicTolerance: AIMilitaryDoctrineStrategicTolerance;
  readonly productionBehavior: AIMilitaryDoctrineProductionBehavior;
}
