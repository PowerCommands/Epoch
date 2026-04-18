export interface UnitType {
  readonly id: string;
  readonly name: string;
  readonly productionCost: number;
  readonly movementPoints: number;
  readonly baseHealth: number;
  readonly baseStrength: number;
  readonly canFound?: boolean;
  readonly canBuildImprovements?: boolean;
  readonly range?: number;
  readonly isNaval?: boolean;
}
