import type { TileType } from './map';

export type ResourceCategory = 'bonus' | 'luxury' | 'strategic';

export interface NaturalResourceYield {
  food: number;
  production: number;
  gold: number;
  science: number;
  culture: number;
  happiness: number;
}

export interface NaturalResourceDefinition {
  id: string;
  name: string;
  category: ResourceCategory;
  allowedTileTypes: TileType[];
  yieldBonus: NaturalResourceYield;
  iconKey: string;
  weight: number;
  improvementId?: string;
  notes?: string;
}
