import { ALL_BUILDINGS } from '../data/buildings';
import type { BuildingType } from '../entities/Building';
import type { CityBuildings } from '../entities/CityBuildings';

function getUpgradeAncestors(building: BuildingType): string[] {
  const ancestors: string[] = [];
  const visited = new Set<string>();
  let predecessorId = building.upgradesFrom;
  while (predecessorId && !visited.has(predecessorId)) {
    visited.add(predecessorId);
    ancestors.push(predecessorId);
    predecessorId = ALL_BUILDINGS.find((candidate) => candidate.id === predecessorId)?.upgradesFrom;
  }
  return ancestors;
}

function isUpgradeDescendant(candidate: BuildingType, buildingId: string): boolean {
  return getUpgradeAncestors(candidate).includes(buildingId);
}

/** Existing infrastructure requirements survive replacement by a later level. */
export function buildingFulfillsRequirement(candidateId: string, requiredId: string): boolean {
  if (candidateId === requiredId) return true;
  const candidate = ALL_BUILDINGS.find(building => building.id === candidateId);
  return candidate !== undefined && isUpgradeDescendant(candidate, requiredId);
}

export function hasActiveBuildingOrUpgrade(buildings: Pick<CityBuildings, 'getAll'>, requiredId: string): boolean {
  return buildings.getAll().some(id => buildingFulfillsRequirement(id, requiredId));
}

/** True when this building has already been superseded in the given city. */
export function isBuildingObsoleteInCity(
  buildings: Pick<CityBuildings, 'has'>,
  building: BuildingType,
): boolean {
  return ALL_BUILDINGS.some((candidate) => (
    isUpgradeDescendant(candidate, building.id) && buildings.has(candidate.id)
  ));
}

/** Shared city-local construction rule used by Human, AI and completion paths. */
export function getBuildingUpgradeBlockReason(
  buildings: Pick<CityBuildings, 'has'> & Partial<Pick<CityBuildings, 'isProtected'>>,
  building: BuildingType,
): string | undefined {
  if (building.upgradesFrom && buildings.isProtected?.(building.upgradesFrom)) return 'Permanent Town infrastructure cannot be replaced.';
  const descendants = ALL_BUILDINGS.filter((candidate) => isUpgradeDescendant(candidate, building.id));
  const belongsToUpgradeChain = building.upgradesFrom !== undefined || descendants.length > 0;
  if (belongsToUpgradeChain && buildings.has(building.id)) {
    return `${building.name} already exists in this city.`;
  }
  if (isBuildingObsoleteInCity(buildings, building)) {
    return `${building.name} has already been replaced by a later upgrade in this city.`;
  }
  if (building.upgradesFrom && !building.canBuildWithoutPredecessor && !buildings.has(building.upgradesFrom)) {
    const predecessor = ALL_BUILDINGS.find((candidate) => candidate.id === building.upgradesFrom);
    return `Requires ${predecessor?.name ?? building.upgradesFrom} in this city.`;
  }
  return undefined;
}

/** Add the completed level and remove every earlier level in its upgrade chain. */
export function completeBuildingUpgrade(buildings: CityBuildings, building: BuildingType): string[] {
  if (getUpgradeAncestors(building).some(id => buildings.isProtected(id))) return [];
  buildings.add(building);
  const removed = getUpgradeAncestors(building).filter((buildingId) => buildings.remove(buildingId));
  return removed;
}

/** Normalize legacy city state by retaining only the highest stored chain level. */
export function normalizeBuildingUpgrades(buildings: CityBuildings): string[] {
  const removed: string[] = [];
  for (const building of ALL_BUILDINGS) {
    if (!buildings.has(building.id)) continue;
    for (const predecessorId of getUpgradeAncestors(building)) {
      if (buildings.remove(predecessorId)) removed.push(predecessorId);
    }
  }
  return removed;
}
