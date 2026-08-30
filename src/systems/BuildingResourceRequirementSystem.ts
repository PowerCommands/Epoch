import { getBuildingRequiredResourceId } from '../data/buildingResourceRequirements';
import { getNaturalResourceById } from '../data/naturalResources';
import type { CityManager } from './CityManager';
import type { ResourceAccessSystem } from './ResourceAccessSystem';

/**
 * Enforces strategic-resource construction requirements for ordinary buildings
 * (currently Workshop → Iron, Factory → Coal; see
 * {@link ../data/buildingResourceRequirements}).
 *
 * Mirrors {@link PowerPlantSystem.getConstructionBlockReason}: the requirement
 * is *access* to the resource, evaluated through the canonical
 * {@link ResourceAccessSystem} (so imports, Foreign Resource Exploitation,
 * boycott and embargo all count exactly as they do elsewhere). It gates the
 * start of construction only — it never disables or removes a building that has
 * already been completed, and it introduces no resource stockpile.
 */
export class BuildingResourceRequirementSystem {
  constructor(
    private readonly cityManager: CityManager,
    private readonly resourceAccessSystem: ResourceAccessSystem,
  ) {}

  getRequiredResourceId(buildingId: string): string | undefined {
    return getBuildingRequiredResourceId(buildingId);
  }

  /** True when the nation may begin constructing the building given its resource access. */
  hasRequiredResourceAccess(nationId: string, buildingId: string): boolean {
    const resourceId = getBuildingRequiredResourceId(buildingId);
    if (!resourceId) return true;
    return this.resourceAccessSystem.hasResource(nationId, resourceId);
  }

  /** Reason the building cannot start construction, or undefined when it may. */
  getConstructionBlockReason(cityId: string, buildingId: string): string | undefined {
    const resourceId = getBuildingRequiredResourceId(buildingId);
    if (!resourceId) return undefined;
    const city = this.cityManager.getCity(cityId);
    if (!city) return undefined;
    if (this.resourceAccessSystem.hasResource(city.ownerId, resourceId)) return undefined;
    return `Requires ${this.getResourceName(resourceId)}`;
  }

  private getResourceName(resourceId: string): string {
    return getNaturalResourceById(resourceId)?.name ?? resourceId;
  }
}
