import type { Era } from '../data/technologies';

export type BuildingPlacement = 'land' | 'water';

export interface BuildingModifiers {
  foodPerTurn?: number;
  productionPerTurn?: number;
  goldPerTurn?: number;
  sciencePerTurn?: number;
  culturePerTurn?: number;
  happinessPerTurn?: number;
  foodPercent?: number;
  productionPercent?: number;
  goldPercent?: number;
  sciencePercent?: number;
  culturePercent?: number;
}

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
