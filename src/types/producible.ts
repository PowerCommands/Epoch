import type { BuildingType } from '../entities/Building';
import type { UnitType } from '../entities/UnitType';

/**
 * Discriminated union för saker en stad kan producera.
 * Samma mönster som Selectable.
 */
export type Producible =
  | { kind: 'unit'; unitType: UnitType }
  | { kind: 'building'; buildingType: BuildingType };
