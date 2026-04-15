export interface BuildingModifiers {
  foodPerTurn?: number;
  productionPerTurn?: number;
  goldPerTurn?: number;
}

export interface BuildingType {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly productionCost: number;
  readonly modifiers: BuildingModifiers;
}
