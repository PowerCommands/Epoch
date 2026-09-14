import type { City } from '../entities/City';
import type { CityBuildings } from '../entities/CityBuildings';
import { getBuildingById } from '../data/buildings';
import { ALL_TECHNOLOGIES, getTechnologyById } from '../data/technologies';
import { CITY_DEVELOPMENT_REQUIREMENTS, canDevelopIntoTown, TOWN_POPULATION_CAPACITY_BONUS, getSettlementStage, getUrbanRequirement, getUrbanSlots } from './UrbanDevelopment';

/** Read-only projection of the same founding blueprint and completion rules used by gameplay. */
export function getSettlementProgress(city: City, buildings: CityBuildings, hasTech: (id: string) => boolean) {
  const stage = getSettlementStage(buildings, city);
  const spatial = stage === 'Village';
  const completed = new Map(buildings.getAllEntries().map(entry => [getUrbanRequirement(entry.buildingId), entry]));
  const missingTechs = new Set<string>();
  const collectTech = (id: string): void => {
    if (hasTech(id) || missingTechs.has(id)) return;
    missingTechs.add(id);
    getTechnologyById(id)?.prerequisites.forEach(collectTech);
  };
  const requirements = spatial
    ? getUrbanSlots(city).map(slot => ({...slot, options: slot.buildingId ? [slot.buildingId] : []}))
    : CITY_DEVELOPMENT_REQUIREMENTS.map(options => ({buildingId:options[0], options, water:false, position:'', x:0, y:0, dq:0, dr:0}));
  const entries = new Map(buildings.getAllEntries().map(entry => [entry.buildingId, entry]));
  const slots = requirements.map(slot => {
    const entry = spatial ? (slot.buildingId ? completed.get(slot.buildingId) : undefined)
      : slot.options.map(id => entries.get(id)).find(candidate => candidate && !candidate.broken)
        ?? slot.options.map(id => entries.get(id)).find(Boolean);
    const technologies = slot.options.map(id => ALL_TECHNOLOGIES.find(t => t.unlocks.some(u => u.kind === 'building' && u.id === id)));
    const alternative = slot.options.length > 1;
    const tech = technologies[0];
    // Alternative routes are not cumulative research prerequisites. Keep the
    // mandatory research list limited to the other five requirements.
    if (!entry && !alternative && tech) collectTech(tech.id);
    const alternativeTechs = !entry && alternative && technologies.every(t => t && !hasTech(t.id))
      ? technologies.map(t => t!.name) : [];
    return { ...slot, name: slot.options.length ? slot.options.map(id => getBuildingById(id)?.name ?? id).join(' OR ') : 'Unavailable',
      complete: !!entry, broken: entry?.broken ?? false, spriteId: entry?.buildingId, alternativeTechs,
      missingTech: alternative ? alternativeTechs.join(' OR ') || undefined
        : !entry && tech && !hasTech(tech.id) ? tech.name : undefined };

  });
  return {
    from: spatial ? 'Village' : 'Town', to: spatial ? 'Town' : 'City', stage, spatial,
    possible: !spatial || canDevelopIntoTown(city), populationBonus: spatial ? TOWN_POPULATION_CAPACITY_BONUS : 0,
    slots, completed: slots.filter(s => s.complete).length,
    missingTechs: ALL_TECHNOLOGIES.filter(t => missingTechs.has(t.id)).map(t => ({ id: t.id, name: t.name })),
  };
}
export type SettlementProgress = ReturnType<typeof getSettlementProgress>;
