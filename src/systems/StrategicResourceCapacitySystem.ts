import { getNaturalResourceById } from '../data/naturalResources';
import type { Unit } from '../entities/Unit';
import type { UnitType } from '../entities/UnitType';

export const STRATEGIC_RESOURCE_CAPACITY_PER_SOURCE = 4;

export interface StrategicResourceCapacity {
  resourceId: string;
  sources: number;
  capacity: number;
  used: number;
  available: number;
  deficit: number;
}

export interface StrategicResourceSourceProvider {
  getResourceSourceCount(nationId: string, resourceId: string): number;
}

export interface StrategicResourceUnitProvider {
  getUnitsByOwner(ownerId: string): Unit[];
}

export class StrategicResourceCapacitySystem {
  constructor(
    private readonly resourceSourceProvider: StrategicResourceSourceProvider,
    private readonly unitProvider: StrategicResourceUnitProvider,
  ) {}

  getCapacity(nationId: string, resourceId: string): StrategicResourceCapacity {
    const sources = this.resourceSourceProvider.getResourceSourceCount(nationId, resourceId);
    const capacity = sources * STRATEGIC_RESOURCE_CAPACITY_PER_SOURCE;
    const used = this.unitProvider.getUnitsByOwner(nationId)
      .filter((unit) => unit.unitType.requiredResource?.resourceId === resourceId)
      .length;
    const available = capacity - used;
    const deficit = Math.max(0, used - capacity);

    return {
      resourceId,
      sources,
      capacity,
      used,
      available,
      deficit,
    };
  }

  canProduceUnit(nationId: string, unitType: UnitType): boolean {
    const requirement = unitType.requiredResource;
    if (!requirement) return true;
    return this.getCapacity(nationId, requirement.resourceId).available >= requirement.amount;
  }

  getMissingRequirementReason(nationId: string, unitType: UnitType): string | undefined {
    const requirement = unitType.requiredResource;
    if (!requirement) return undefined;

    const capacity = this.getCapacity(nationId, requirement.resourceId);
    if (capacity.available >= requirement.amount) return undefined;

    const resourceName = getNaturalResourceById(requirement.resourceId)?.name ?? requirement.resourceId;
    return capacity.sources <= 0
      ? `Requires ${resourceName}`
      : `Requires ${resourceName} capacity`;
  }
}
