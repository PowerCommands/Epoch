import type { Era } from '../data/technologies';
import type { ModifierSet } from '../types/modifiers';

export type BuildingPlacement = 'land' | 'water';

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
}
