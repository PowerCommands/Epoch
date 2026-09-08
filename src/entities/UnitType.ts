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
  // Special-purpose units operating outside normal diplomacy/warfare (Spy,
  // Agent, Rebels, Partisans). Kept separate from civilian/military/naval/air
  // for future UI filtering and behavior.
  | 'covert';

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

/**
 * National food burden of maintaining a unit, on a small integer scale:
 * - `0` — civilian / non-military units (no burden)
 * - `1` — Low (recon, light special forces)
 * - `2` — Medium (the normal standing military unit)
 * - `3` — High (unusually large military units, chiefly major warships)
 *
 * Unlike gold upkeep this value carries no positional or army-size modifiers;
 * it is summed as-is to slow a militarized nation's population growth.
 */
export type FoodUpkeep = 0 | 1 | 2 | 3;

export interface UnitType {
  readonly id: string;
  readonly name: string;
  readonly era: Era;
  readonly category: UnitCategory;
  /** Short flavor/role text for unit info / future Civilopedia. */
  readonly description?: string;
  /**
   * Allegiance model for the unit, separate from its combat {@link category}.
   * Optional for backward compatibility; treat a missing value as
   * {@link DEFAULT_ALLEGIANCE_TYPE} (`'nation'`) via {@link getAllegianceType}.
   */
  readonly allegianceType?: AllegianceType;
  readonly productionCost: number;
  readonly upkeepGold?: number;
  /**
   * National food upkeep on the {@link FoodUpkeep} 0–3 scale. Always resolved to
   * a concrete value by the unit factory (defaulting from category / combat role
   * when a definition does not set it), so consumers can read it directly.
   */
  readonly foodUpkeep: FoodUpkeep;
  readonly upgradeToUnitId?: string;
  readonly cargoCapacity?: number;
  readonly allowedCargoUnitIds?: readonly string[];
  readonly allowedCargoCategories?: readonly UnitCategory[];
  readonly movementPoints: number;
  readonly baseHealth: number;
  readonly baseStrength: number;
  readonly rangedStrength?: number;
  readonly canFound?: boolean;
  readonly canBuildImprovements?: boolean;
  /** Specialized improvement capabilities (for example Archaeologist → Dig). */
  readonly improvementCapabilities?: readonly string[];
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
  // ─── Covert-unit capability flags (placeholders; no behavior yet) ──────────
  /** Covert unit can gather intelligence (behavior added later). */
  readonly canGatherIntel?: boolean;
  /** Covert unit can sabotage tile improvements (behavior added later). */
  readonly canSabotageImprovements?: boolean;
  /** Covert unit can sabotage buildings (behavior added later). */
  readonly canSabotageBuildings?: boolean;
  /** Covert unit can assassinate enemy workers (behavior added later). */
  readonly canAssassinateWorkers?: boolean;
  /** Marks an insurgent proxy force (Rebels, Partisans). Behavior added later. */
  readonly isInsurgentForce?: boolean;
  /** Enemy units of this type require current human-player detection to render. */
  readonly covertDetectable?: boolean;
  /** Hex distance within which this unit detects any covert-detectable enemy. */
  readonly covertDetectionRange?: number;
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
