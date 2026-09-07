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

/** Shared city-local construction rule used by Human, AI and completion paths. */
export function getBuildingUpgradeBlockReason(
  buildings: Pick<CityBuildings, 'has'>,
  building: BuildingType,
): string | undefined {
  const descendants = ALL_BUILDINGS.filter((candidate) => isUpgradeDescendant(candidate, building.id));
  const belongsToUpgradeChain = building.upgradesFrom !== undefined || descendants.length > 0;
  if (belongsToUpgradeChain && buildings.has(building.id)) {
    return `${building.name} already exists in this city.`;
  }
  if (descendants.some((candidate) => buildings.has(candidate.id))) {
    return `${building.name} has already been replaced by a later upgrade in this city.`;
  }
  if (building.upgradesFrom && !buildings.has(building.upgradesFrom)) {
    const predecessor = ALL_BUILDINGS.find((candidate) => candidate.id === building.upgradesFrom);
    return `Requires ${predecessor?.name ?? building.upgradesFrom} in this city.`;
  }
  return undefined;
}

/** Add the completed level and remove every earlier level in its upgrade chain. */
export function completeBuildingUpgrade(buildings: CityBuildings, building: BuildingType): string[] {
  const removed = getUpgradeAncestors(building).filter((buildingId) => buildings.remove(buildingId));
  buildings.add(building);
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
