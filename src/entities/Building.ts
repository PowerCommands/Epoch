import type { Era } from '../data/technologies';
import type { ModifierSet } from '../types/modifiers';
import type { TileType } from '../types/map';

export type BuildingPlacement = 'land' | 'water' | 'city';

export type BuildingModifiers = ModifierSet;

/**
 * A generic, data-driven strategic-resource supply bonus supplied by an active
 * building. Each active building of the type raises the owning nation's usable
 * quantity of {@link resourceId} by {@link amount} — but only while the nation
 * has genuine underlying access to {@link requiresResourceAccessTo} that does
 * NOT itself come from this bonus (so a building can amplify an existing supply
 * but never conjure one from nothing). Consumed centrally by
 * {@link ../systems/BuildingResourceCapacitySystem}; no per-building special
 * casing lives in the resource systems.
 */
export interface BuildingResourceCapacityBonus {
  readonly resourceId: string;
  readonly amount: number;
  readonly requiresResourceAccessTo: string;
}

export interface BuildingType {
  readonly id: string;
  readonly name: string;
  readonly era: Era;
  readonly description: string;
  readonly placement: BuildingPlacement;
  readonly aircraftCapacity?: number;
  readonly maintenance: number;
  readonly productionCost: number;
  readonly modifiers: BuildingModifiers;
  /** Optional terrain whitelist for physically placed buildings. */
  readonly allowedTerrains?: readonly TileType[];
  /** One-time population added after this building completes successfully. */
  readonly populationOnCompletion?: number;
  /** Earlier city building replaced by this one when construction completes. */
  readonly upgradesFrom?: string;
  /** May also be constructed independently when the predecessor is absent. */
  readonly canBuildWithoutPredecessor?: boolean;
  /** Optional strategic-resource supply bonus granted while active (e.g. Stable → Horses). */
  readonly resourceCapacityBonus?: BuildingResourceCapacityBonus;
  /** Radius of ongoing map visibility projected from this building's physical tile. */
  readonly visibilityRadius?: number;
  /** Radius in which this building detects units using the canonical covert flag. */
  readonly covertDetectionRadius?: number;
}
