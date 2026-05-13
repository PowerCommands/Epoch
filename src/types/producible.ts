import type { BuildingType } from '../entities/Building';
import type { UnitType } from '../entities/UnitType';
import type { WonderType } from '../entities/Wonder';
import type { CorporationDefinition } from '../data/corporations';

/**
 * Discriminated union för saker en stad kan producera.
 * Samma mönster som Selectable.
 */
export type Producible =
  | { kind: 'unit'; unitType: UnitType }
  | { kind: 'building'; buildingType: BuildingType }
  | { kind: 'wonder'; wonderType: WonderType }
  | { kind: 'corporation'; corporationType: CorporationDefinition };
