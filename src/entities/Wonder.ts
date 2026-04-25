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
}

export interface WonderState {
  readonly wonderId: string;
  readonly cityId: string;
  readonly ownerId: string;
  readonly tileX?: number;
  readonly tileY?: number;
  readonly completedTurn: number;
}
