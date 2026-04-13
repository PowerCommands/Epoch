import type { Tile } from './map';
import type { City } from '../entities/City';
import type { Unit } from '../entities/Unit';

/**
 * Discriminated union för allt som kan hovras/väljas på kartan.
 * TypeScript smalnar av typen baserat på `kind`-fältet.
 */
export type Selectable =
  | { kind: 'tile'; tile: Tile }
  | { kind: 'city'; city: City }
  | { kind: 'unit'; unit: Unit };
