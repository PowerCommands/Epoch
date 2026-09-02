import type { BuildingType } from '../entities/Building';
import type { UnitType } from '../entities/UnitType';
import type { WonderType } from '../entities/Wonder';
import type { CorporationDefinition } from '../data/corporations';
import type { ManufacturedResourceProductionDefinition } from '../data/scienceVictory';
import type { ProjectDefinition } from '../data/projects';

/**
 * Discriminated union för saker en stad kan producera.
 * Samma mönster som Selectable.
 */
export type Producible =
  | { kind: 'unit'; unitType: UnitType }
  | { kind: 'building'; buildingType: BuildingType }
  | { kind: 'wonder'; wonderType: WonderType }
  | { kind: 'corporation'; corporationType: CorporationDefinition }
  | { kind: 'manufacturedResource'; productionType: ManufacturedResourceProductionDefinition }
  | { kind: 'project'; projectType: ProjectDefinition }
  | { kind: 'tradeRoute'; connectionId: string; fromCityId: string; toCityId: string; targetNationId: string; displayName: string; establishmentTurns: number };
