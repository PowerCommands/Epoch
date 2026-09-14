import type { City } from '../entities/City';
import type { CityBuildings } from '../entities/CityBuildings';
import { getBuildingById } from '../data/buildings';
import { ALL_TECHNOLOGIES, getTechnologyById } from '../data/technologies';
import { canDevelopIntoCity, CITY_POPULATION_CAPACITY_BONUS, getSettlementStage, getUrbanRequirement, getUrbanSlots } from './UrbanDevelopment';

/** Read-only projection of the same founding blueprint and completion rules used by gameplay. */
export function getSettlementProgress(city: City, buildings: CityBuildings, hasTech: (id: string) => boolean) {
  const completed = new Map(buildings.getAllEntries().map(entry => [getUrbanRequirement(entry.buildingId), entry]));
  const missingTechs = new Set<string>();
  const collectTech = (id: string): void => {
    if (hasTech(id) || missingTechs.has(id)) return;
    missingTechs.add(id);
    getTechnologyById(id)?.prerequisites.forEach(collectTech);
  };
  const slots = getUrbanSlots(city).map(slot => {
    const entry = slot.buildingId ? completed.get(slot.buildingId) : undefined;
    const tech = ALL_TECHNOLOGIES.find(t => t.unlocks.some(u => u.kind === 'building' && u.id === slot.buildingId));
    if (!entry && slot.buildingId && tech) collectTech(tech.id);
    return { ...slot, name: slot.buildingId ? getBuildingById(slot.buildingId)?.name ?? slot.buildingId : 'Unavailable',
      complete: !!entry, broken: entry?.broken ?? false, spriteId: entry?.buildingId,
      missingTech: !entry && tech && !hasTech(tech.id) ? tech.name : undefined };
  });
  return {
    from: 'Village', to: 'City', stage: getSettlementStage(buildings, city),
    possible: canDevelopIntoCity(city), populationBonus: CITY_POPULATION_CAPACITY_BONUS,
    slots, completed: slots.filter(s => s.complete).length,
    missingTechs: ALL_TECHNOLOGIES.filter(t => missingTechs.has(t.id)).map(t => ({ id: t.id, name: t.name })),
  };
}
export type SettlementProgress = ReturnType<typeof getSettlementProgress>;
