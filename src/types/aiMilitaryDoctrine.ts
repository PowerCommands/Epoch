export interface AIMilitaryRolePreferences {
  readonly melee: number;
  readonly ranged: number;
  readonly mounted: number;
  readonly siege: number;
  readonly navalMelee: number;
  readonly navalRanged: number;
  readonly air: number;
}

export interface AIMilitaryDoctrine {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly modernizationBias: number;
  readonly quantityBias: number;
  readonly qualityBias: number;
  readonly preferredRoles: AIMilitaryRolePreferences;
}
