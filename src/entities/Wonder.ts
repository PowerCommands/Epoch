import type { Era } from '../data/technologies';
import type { ModifierSet } from '../types/modifiers';

export type WonderScope = 'city' | 'nation' | 'global';

export interface WonderPlacementRule {
  readonly landOnly?: boolean;
  readonly waterOnly?: boolean;
  readonly requiresCoast?: boolean;
  readonly requiresRiver?: boolean;
  readonly requiresMountainAdjacent?: boolean;
}

export interface WonderType {
  readonly id: string;
  readonly name: string;
  readonly era: Era;
  readonly productionCost: number;
  readonly description: string;
  readonly modifiers: ModifierSet;
  readonly requiredTechnologyId?: string;
  readonly scope: WonderScope;
  readonly placement?: WonderPlacementRule;
  /**
   * Minimum city population required before construction may begin. A city
   * below this threshold cannot start the wonder (enforced for both human and
   * AI via WonderSystem). Absent => no population requirement.
   */
  readonly minimumPopulation?: number;
}

export interface WonderState {
  readonly wonderId: string;
  readonly cityId: string;
  readonly ownerId: string;
  readonly tileX?: number;
  readonly tileY?: number;
  readonly completedTurn: number;
  /**
   * When true the wonder is damaged and provides no effects (modifiers, culture,
   * victory/ranking) until repaired. It still physically exists, so it cannot be
   * rebuilt. Absent/false in old saves => working normally.
   */
  broken?: boolean;
}
