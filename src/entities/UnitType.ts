import type { Era } from '../data/technologies';

export type UnitCategory =
  | 'melee'
  | 'ranged'
  | 'mounted'
  | 'siege'
  | 'naval_melee'
  | 'naval_ranged'
  | 'naval_recon'
  | 'air'
  | 'civilian'
  | 'recon'
  | 'leader';

/**
 * Describes how a unit relates to a nation, independent of its combat category.
 *
 * - `nation`: ordinary unit with a visible owner nation (the default).
 * - `hiddenNation`: unit has an internal ownerNationId but should be treated as
 *   not openly belonging to that nation (e.g. Privateers, future Spies/Agents).
 * - `independent`: unit has no nation owner (reserved for future Barbarians,
 *   Rebels and similar systems).
 */
export type AllegianceType = 'nation' | 'hiddenNation' | 'independent';

/** Allegiance assumed for any unit/unit type that does not specify one. */
export const DEFAULT_ALLEGIANCE_TYPE: AllegianceType = 'nation';

export interface UnitType {
  readonly id: string;
  readonly name: string;
  readonly era: Era;
  readonly category: UnitCategory;
  /**
   * Allegiance model for the unit, separate from its combat {@link category}.
   * Optional for backward compatibility; treat a missing value as
   * {@link DEFAULT_ALLEGIANCE_TYPE} (`'nation'`) via {@link getAllegianceType}.
   */
  readonly allegianceType?: AllegianceType;
  readonly productionCost: number;
  readonly upkeepGold?: number;
  readonly upgradeToUnitId?: string;
  readonly cargoCapacity?: number;
  readonly allowedCargoCategories?: readonly UnitCategory[];
  readonly movementPoints: number;
  readonly baseHealth: number;
  readonly baseStrength: number;
  readonly rangedStrength?: number;
  readonly canFound?: boolean;
  readonly canBuildImprovements?: boolean;
  /** May raze an enemy tile improvement it stands on. Defaults to false. */
  readonly canDestroyImprovement?: boolean;
  /** May raze an enemy building on the tile it stands on. Defaults to false. */
  readonly canDestroyBuilding?: boolean;
  readonly maxImprovementCharges?: number;
  readonly range?: number;
  readonly isNaval?: boolean;
  readonly ignoresUnitCollision?: boolean;
  readonly canTraverseWater?: boolean;
  readonly mustEndOnLand?: boolean;
  readonly uniquePerNation?: boolean;
  readonly residenceCapitalOnly?: boolean;
  readonly requiredResource?: {
    readonly resourceId: string;
    readonly amount: number;
  };
  readonly serviceLifeRounds?: number;
}

/**
 * Resolves the effective allegiance of a unit type, defaulting to
 * {@link DEFAULT_ALLEGIANCE_TYPE} when none is defined. Use this instead of
 * reading `allegianceType` directly so old data without the field keeps working.
 */
export function getAllegianceType(unitType: UnitType): AllegianceType {
  return unitType.allegianceType ?? DEFAULT_ALLEGIANCE_TYPE;
}
