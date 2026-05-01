export type PolicyCategory =
  | 'economic'
  | 'military'
  | 'diplomatic'
  | 'ideology';

export type PolicySlotCategory =
  | PolicyCategory
  | 'wildcard';

export type PolicyModifier =
  | { readonly type: 'happinessFlat'; readonly value: number }
  | { readonly type: 'happinessPerCity'; readonly value: number }
  | { readonly type: 'happinessPerLuxuryResource'; readonly value: number }
  | { readonly type: 'unhappinessPerCityFlat'; readonly value: number }
  | { readonly type: 'unhappinessPerPopulationPercent'; readonly value: number }
  | { readonly type: 'productionFlatPerCity'; readonly value: number }
  | { readonly type: 'productionPercent'; readonly value: number }
  | { readonly type: 'cultureFlatPerCity'; readonly value: number }
  | { readonly type: 'culturePercent'; readonly value: number }
  | { readonly type: 'goldFlatPerCity'; readonly value: number }
  | { readonly type: 'goldPercent'; readonly value: number }
  | { readonly type: 'scienceFlatPerCity'; readonly value: number }
  | { readonly type: 'sciencePercent'; readonly value: number }
  | { readonly type: 'influenceFlat'; readonly value: number }
  | { readonly type: 'influencePercent'; readonly value: number }
  | { readonly type: 'landUnitProductionPercent'; readonly value: number }
  | { readonly type: 'wonderProductionPercent'; readonly value: number }
  | { readonly type: 'cityDefenseFlat'; readonly value: number }
  | { readonly type: 'ownedTerritoryCombatFlat'; readonly value: number }
  | { readonly type: 'unitUpkeepPercent'; readonly value: number }
  | { readonly type: 'improvementBuildSpeedPercent'; readonly value: number };

export interface PolicyDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: PolicyCategory;
  readonly requiredCultureNodeId: string;
  readonly description: string;
  readonly modifiers: readonly PolicyModifier[];
}
