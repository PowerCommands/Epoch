import type { Era } from '../data/technologies';

export type UnitCategory =
  | 'melee'
  | 'ranged'
  | 'mounted'
  | 'siege'
  | 'naval_melee'
  | 'naval_ranged'
  | 'air'
  | 'civilian'
  | 'recon';

export interface UnitType {
  readonly id: string;
  readonly name: string;
  readonly era: Era;
  readonly category: UnitCategory;
  readonly productionCost: number;
  readonly upkeepGold?: number;
  readonly movementPoints: number;
  readonly baseHealth: number;
  readonly baseStrength: number;
  readonly rangedStrength?: number;
  readonly canFound?: boolean;
  readonly canBuildImprovements?: boolean;
  readonly maxImprovementCharges?: number;
  readonly range?: number;
  readonly isNaval?: boolean;
  readonly requiredResource?: {
    readonly resourceId: string;
    readonly amount: number;
  };
}
