import { DOCK, getBuildingById } from '../../data/buildings';
import type { BuildingType } from '../../entities/Building';
import type { City } from '../../entities/City';
import type { CityBuildings } from '../../entities/CityBuildings';
import { CITY_DEVELOPMENT_REQUIREMENTS, getSettlementStage, canDevelopIntoTown, getUrbanSlots, getUrbanRequirement } from '../UrbanDevelopment';

/** Modest development candidates, not a mandatory build order. Dock has its own
 * naval value even on islands which can never complete Town development. */
export function getUrbanInfrastructureCandidates(
  city: City, buildings: CityBuildings, canBuild: (building: BuildingType) => boolean,
): Array<{ building: BuildingType; score: number }> {
  const candidates: Array<{ building: BuildingType; score: number }> = [];
  if (!buildings.has(DOCK.id) && canBuild(DOCK)) candidates.push({ building: DOCK, score: 35 });
  if (!canDevelopIntoTown(city)) return candidates;
  if (getSettlementStage(buildings, city) !== 'Village') {
    if (getSettlementStage(buildings, city) === 'Town') for (const options of CITY_DEVELOPMENT_REQUIREMENTS) {
      if (options.some(id => buildings.has(id))) continue;
      for (const id of options) {
        const building = getBuildingById(id)!;
        if (canBuild(building)) candidates.push({building, score:19});
      }
    }
    return candidates;
  }
  const completed = new Set(buildings.getAllEntries().map(b => getUrbanRequirement(b.buildingId)).filter((id): id is string => !!id));
  for (const slot of getUrbanSlots(city)) {
    if (!slot.buildingId || completed.has(slot.buildingId) || slot.buildingId === DOCK.id) continue;
    const building = getBuildingById(slot.buildingId)!;
    if (canBuild(building)) candidates.push({ building, score: 13 + completed.size });
  }
  return candidates;
}
