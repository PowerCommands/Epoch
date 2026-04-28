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

  /** Hide the resource on the map until this technology is researched. */
  readonly revealTechId?: string;

  /**
   * Resource is not usable for economy, trade, or strategic-resource
   * capacity until the owning/holding nation has researched this tech.
   * The tile and resource still exist; access is gated by `ResourceAccessSystem`.
   */
  readonly requiredTechId?: string;
}
