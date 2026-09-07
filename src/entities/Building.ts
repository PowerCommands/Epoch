import type { Era } from '../data/technologies';
import type { ModifierSet } from '../types/modifiers';
import type { TileType } from '../types/map';

export type BuildingPlacement = 'land' | 'water' | 'city';

export type BuildingModifiers = ModifierSet;

export interface BuildingType {
  readonly id: string;
  readonly name: string;
  readonly era: Era;
  readonly description: string;
  readonly placement: BuildingPlacement;
  readonly maintenance: number;
  readonly productionCost: number;
  readonly modifiers: BuildingModifiers;
  /** Optional terrain whitelist for physically placed buildings. */
  readonly allowedTerrains?: readonly TileType[];
  /** One-time population added after this building completes successfully. */
  readonly populationOnCompletion?: number;
  /** Earlier city building replaced by this one when construction completes. */
  readonly upgradesFrom?: string;
}
