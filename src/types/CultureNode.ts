import type { Era } from '../data/technologies';
import type { CultureUnlock } from './CultureUnlock';

export type CultureEffect =
  | { readonly type: 'influenceToHappiness'; readonly influenceCost: number; readonly happinessGain: number }
  | { readonly type: 'happinessPerTurnFlat'; readonly value: number }
  | { readonly type: 'futureCultureHappiness'; readonly value: number };

export interface CultureNode {
  id: string;
  name: string;
  cost: number;
  era: Era;
  readonly description: string;
  prerequisites?: string[];
  unlocks: CultureUnlock[];
  effects?: CultureEffect[];
}
