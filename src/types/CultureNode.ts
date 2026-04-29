import type { Era } from '../data/technologies';
import type { CultureUnlock } from './CultureUnlock';

export interface CultureNode {
  id: string;
  name: string;
  cost: number;
  era: Era;
  readonly description: string;
  prerequisites?: string[];
  unlocks: CultureUnlock[];
}
